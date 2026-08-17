/**
 * Solana Blockchain Collector
 * Implements IBlockchainCollector for Solana network
 * 
 * Uses Birdeye for OHLCV data and Helius for transaction data
 */

import { 
  IBlockchainCollector, 
  CollectorResult, 
  OHLCVCandle, 
  UniversalTransaction,
  WalletBalance,
  HolderInfo,
  WalletMetrics,
  CalculatedMetrics,
  NormalizedTransaction
} from '../types';
import { fetchOHLCV, fetchBirdeyeTransactions } from './birdeye';
import { fetchTransactions as fetchSolanaTransactions } from './helius';
import { buildWalletData as buildSolanaWalletData } from './walletEngine';
import { calculateMetrics as calculateSolanaMetrics } from './metrics';
import { detectHolderSpike } from '../../utils/holderSpike';
import { filterSystemAddresses } from '../../utils/addressFilter';
import { fetchGeckoTerminalTrades } from '../shared/geckoTerminal';
import { aggregateTrades } from '../../utils/aggregateTrades';

export class SolanaCollector implements IBlockchainCollector {
  private birdeyeApiKey: string;
  private heliusApiKey: string;

  constructor(birdeyeApiKey: string, heliusApiKey: string) {
    this.birdeyeApiKey = birdeyeApiKey;
    this.heliusApiKey = heliusApiKey;
  }

  /**
   * Get blockchain type
   */
  getBlockchain(): 'solana' {
    return 'solana';
  }

  /**
   * Fetch OHLCV data from Birdeye
   */
  async fetchOHLCV(address: string): Promise<OHLCVCandle[]> {
    console.log(`[SolanaCollector] Fetching OHLCV for ${address}...`);
    return await fetchOHLCV(address, this.birdeyeApiKey);
  }

  /**
   * Fetch transactions (DEX trades) with Birdeye primary and Helius fallback.
   * ohlcv is passed in so the Helius fallback path can interpolate priceUsd
   * from the nearest OHLCV candle when Birdeye is unavailable.
   */
  async fetchTransactions(
    address: string,
    maxTransactions: number,
    ohlcv: OHLCVCandle[] = []
  ): Promise<UniversalTransaction[]> {
    console.log(`[SolanaCollector] Ingesting transactions for ${address} (max: ${maxTransactions})...`);
    
    // 1. Try Birdeye trades API (Primary)
    try {
      console.log(`[SolanaCollector] [Primary] Fetching via Birdeye Token Trades API...`);
      const birdeyeTxs = await fetchBirdeyeTransactions(address, this.birdeyeApiKey, maxTransactions);
      
      if (birdeyeTxs && birdeyeTxs.length > 0) {
        console.log(`[SolanaCollector] [Primary] Birdeye retrieved ${birdeyeTxs.length} transactions successfully`);
        return birdeyeTxs.map((tx: any): UniversalTransaction => {
          const tokenAmount = tx.fromAddress?.toLowerCase() === address.toLowerCase() 
            ? tx.fromAmount 
            : tx.toAmount;
            
          const amount = tokenAmount || tx.toAmount || tx.fromAmount || 0;
          const priceUsd = amount > 0 ? (tx.volumeUsd / amount) : undefined;
          
          return {
            hash: tx.txHash,
            timestamp: tx.blockUnixTime,
            from: tx.fromAddress || '',
            to: tx.toAddress || '',
            amount: amount,
            type: tx.side === 'buy' ? 'buy' : tx.side === 'sell' ? 'sell' : 'transfer',
            token: { address: address },
            blockchain: 'solana',
            isTrade: true,
            priceUsd: priceUsd,
            wallet: tx.owner,
            raw: tx
          };
        });
      }
      console.warn(`[SolanaCollector] [Primary] Birdeye returned empty transactions. Falling back to Helius...`);
    } catch (error: any) {
      console.warn(`[SolanaCollector] [Primary] Birdeye transaction fetch failed: ${error.message}. Falling back to Helius...`);
    }

    // 2. Fallback: Helius enhanced transaction endpoint
    console.log(`[SolanaCollector] [Fallback] Fetching via Helius Address Transactions API...`);
    const solanaTransactions = await fetchSolanaTransactions(
      address,
      this.heliusApiKey,
      address, // Use address as mint
      maxTransactions
    );

    // Convert to universal format, enriching with OHLCV-interpolated prices
    return this.convertToUniversalTransactions(solanaTransactions, address, ohlcv);
  }

  /**
   * Interpolate USD price for a transaction timestamp from the OHLCV candle series.
   * Finds the candle whose interval contains the timestamp and returns its close price.
   * Returns undefined if no matching candle is found.
   */
  private interpolatePriceFromOHLCV(
    timestamp: number,
    ohlcv: OHLCVCandle[]
  ): number | undefined {
    if (!ohlcv || ohlcv.length === 0) return undefined;
    // OHLCV candles are 15-minute intervals; find the closest candle at or before the timestamp
    const CANDLE_INTERVAL = 15 * 60; // 15 minutes in seconds
    let closestInterval: OHLCVCandle | undefined;
    let closestFallback: OHLCVCandle | undefined;
    let minDiffInterval = Infinity;
    let minDiffFallback = Infinity;

    for (const candle of ohlcv) {
      const diff = Math.abs(candle.timestamp - timestamp);
      
      // 1. Check for close match within 15 mins
      if (diff < minDiffInterval && diff <= CANDLE_INTERVAL) {
        minDiffInterval = diff;
        closestInterval = candle;
      }
      
      // 2. Track overall closest as fallback
      if (diff < minDiffFallback) {
        minDiffFallback = diff;
        closestFallback = candle;
      }
    }

    if (closestInterval) {
      return closestInterval.close;
    }
    
    // Best-effort fallback for transactions outside the 24-hour window
    return closestFallback ? closestFallback.close : undefined;
  }

  /**
   * Convert Solana transactions (from Helius) to universal format.
   * Enriches each trade transaction with a USD price interpolated from
   * the OHLCV candle series, and correctly classifies buy/sell direction.
   */
  private convertToUniversalTransactions(
    solanaTransactions: NormalizedTransaction[],
    tokenAddress: string,
    ohlcv: OHLCVCandle[] = []
  ): UniversalTransaction[] {
    const universalTxs: UniversalTransaction[] = [];

    for (const solanaTx of solanaTransactions) {
      const isTrade = solanaTx.isTrade !== false;
      for (const transfer of solanaTx.transfers) {
        // Interpolate price from OHLCV candles (Helius doesn't provide USD price per tx)
        const priceUsd = isTrade
          ? this.interpolatePriceFromOHLCV(solanaTx.timestamp, ohlcv)
          : undefined;

        universalTxs.push({
          hash: solanaTx.signature || `${solanaTx.timestamp}-${transfer.from}-${transfer.to}`,
          timestamp: solanaTx.timestamp,
          from: transfer.from,
          to: transfer.to,
          amount: transfer.amount,
          type: isTrade ? this.detectTransactionType(transfer, solanaTx.wallets) : 'transfer',
          token: {
            address: tokenAddress,
            symbol: undefined,
            decimals: undefined
          },
          blockchain: 'solana',
          raw: solanaTx,
          isTrade: isTrade,
          priceUsd: priceUsd  // ← populated from OHLCV interpolation
        });
      }
    }

    return universalTxs;
  }

  /**
   * Classify a Helius token transfer as buy, sell, or transfer.
   *
   * Helius enhanced transactions include a wallets array of all accounts involved
   * in the transaction. For a DEX swap:
   *   - The token flows FROM the pool TO the buyer wallet   → 'buy'
   *   - The token flows FROM the seller wallet TO the pool  → 'sell'
   *
   * "pool" accounts are system/program accounts not in solanaTx.wallets (the user wallets).
   * If the FROM address is in the user wallets array, tokens are leaving a user → 'sell'.
   * If the TO address is in the user wallets array (and FROM is not), tokens enter → 'buy'.
   */
  private detectTransactionType(
    transfer: any,
    wallets: string[]
  ): 'buy' | 'sell' | 'transfer' {
    const walletSet = new Set(wallets.map(w => w.toLowerCase()));
    const from = (transfer.from || '').toLowerCase();
    const to = (transfer.to || '').toLowerCase();

    const fromIsUser = walletSet.has(from);
    const toIsUser = walletSet.has(to);

    if (fromIsUser && !toIsUser) return 'sell'; // user sends tokens to pool/program → sell
    if (toIsUser && !fromIsUser) return 'buy';  // pool/program sends tokens to user → buy
    return 'transfer'; // user-to-user or ambiguous
  }

  /**
   * Build wallet data from universal transactions
   */
  buildWalletData(transactions: UniversalTransaction[]): {
    wallets: Record<string, WalletBalance>;
    holders: HolderInfo[];
    metrics: WalletMetrics;
  } {
    const wallets: Record<string, WalletBalance> = {};

    // Track wallet activity
    for (const tx of transactions) {
      // Initialize wallets if not exists
      if (!wallets[tx.from]) {
        wallets[tx.from] = { total_in: 0, total_out: 0, tx_count: 0 };
      }
      if (!wallets[tx.to]) {
        wallets[tx.to] = { total_in: 0, total_out: 0, tx_count: 0 };
      }

      // Update balances
      wallets[tx.from].total_out += tx.amount;
      wallets[tx.from].tx_count++;
      wallets[tx.to].total_in += tx.amount;
      wallets[tx.to].tx_count++;
    }

    // Calculate holders (positive balance)
    const holders: HolderInfo[] = [];
    for (const [wallet, balance] of Object.entries(wallets)) {
      const netBalance = balance.total_in - balance.total_out;
      if (netBalance > 0) {
        holders.push({
          wallet,
          balance: netBalance,
          tx_count: balance.tx_count
        });
      }
    }

    // Sort by balance descending
    holders.sort((a, b) => b.balance - a.balance);

    const metrics: WalletMetrics = {
      total_wallets: Object.keys(wallets).length,
      total_holders: holders.length,
      top_10_wallets: holders.slice(0, 10)
    };

    return { wallets, holders, metrics };
  }

  /**
   * Calculate risk metrics
   */
  calculateMetrics(ohlcv: OHLCVCandle[], walletMetrics: WalletMetrics): CalculatedMetrics {
    return calculateSolanaMetrics(ohlcv, walletMetrics);
  }

  /**
   * Collect all data for a Solana token
   */
  async collect(address: string, maxTransactions: number, tokenDecimals?: number): Promise<CollectorResult> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[SolanaCollector] Starting collection for ${address}`);
    console.log(`[SolanaCollector] Max transactions: ${maxTransactions}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Fetch OHLCV
      let ohlcv: OHLCVCandle[] = [];
      try {
        console.log('[STEP 1/4] Fetching OHLCV from Birdeye...');
        ohlcv = await this.fetchOHLCV(address);
        console.log(`✅ Fetched ${ohlcv.length} OHLCV candles`);
      } catch (err: any) {
        console.warn(`[SolanaCollector] OHLCV fetch failed: ${err.message}`);
      }

      // Step 2: Fetch transactions — pass ohlcv so the Helius fallback can interpolate priceUsd
      let heliusTxs: UniversalTransaction[] = [];
      try {
        console.log('[STEP 2/4] Fetching transactions from Helius...');
        heliusTxs = await this.fetchTransactions(address, maxTransactions, ohlcv);
        console.log(`✅ Fetched ${heliusTxs.length} Helius transactions`);
      } catch (err: any) {
        console.warn(`[SolanaCollector] Helius transactions fetch failed: ${err.message}`);
      }

      // Fetch DEX trades from GeckoTerminal Solana pools (Feature 5/6)
      console.log('[STEP 2b/4] Fetching DEX trades from GeckoTerminal...');
      let dexTrades: UniversalTransaction[] = [];
      try {
        dexTrades = await fetchGeckoTerminalTrades('solana', address, maxTransactions) || [];
        console.log(`✅ Fetched ${dexTrades.length} DEX trades from GeckoTerminal`);
      } catch (err: any) {
        console.warn(`[SolanaCollector] GeckoTerminal fetch failed: ${err.message}`);
      }

      // Merge Helius transfers with GeckoTerminal trades (Feature 5/6)
      const mergedTransactions: UniversalTransaction[] = [];
      
      if (dexTrades.length > 0) {
        const dexTradesMap = new Map<string, UniversalTransaction>();
        for (const trade of dexTrades) {
          dexTradesMap.set(trade.hash, trade);
        }

        for (const tx of heliusTxs) {
          const signature = tx.hash;
          const matchingDexTrade = dexTradesMap.get(signature);

          if (matchingDexTrade) {
            tx.isTrade = true;
            tx.priceUsd = matchingDexTrade.priceUsd;
            tx.type = matchingDexTrade.type; // 'buy' or 'sell'
            dexTradesMap.delete(signature);
          } else {
            // Keep original isTrade, type, and priceUsd assigned by fetchTransactions.
            // Do not force-clobber Helius-only transactions to transfers/non-trades.
          }
          mergedTransactions.push(tx);
        }

        // Append any unmatched DEX trades from GeckoTerminal
        for (const [_, dexTx] of dexTradesMap) {
          mergedTransactions.push(dexTx);
        }
      } else {
        // Fallback: If no DEX trades from GeckoTerminal, keep Helius's original trade indicators
        mergedTransactions.push(...heliusTxs);
      }

      // Filter transactions into trades and transfers
      const trades = mergedTransactions.filter(tx => tx.isTrade);
      const transfers = mergedTransactions.filter(tx => !tx.isTrade);

      // Aggregate trades (Feature 7)
      const aggregatedTrades = aggregateTrades(trades);

      // Combine back
      const finalTransactions = [...aggregatedTrades, ...transfers];

      // Sort final list chronologically descending
      finalTransactions.sort((a, b) => b.timestamp - a.timestamp);
      const transactions = finalTransactions.slice(0, maxTransactions);

      if (transactions.length === 0) {
        console.warn('[SolanaCollector] Warning: No transactions found for this token');
      }

      // Step 3: Build wallet data
      console.log('[STEP 3/4] Building wallet balances...');
      const walletData = this.buildWalletData(transactions);
      console.log(`✅ Processed ${walletData.metrics.total_wallets} wallets, ${walletData.metrics.total_holders} holders`);

      // Step 4: Calculate metrics
      console.log('[STEP 4/4] Calculating metrics...');
      const metrics = this.calculateMetrics(ohlcv, walletData.metrics);
      console.log(`✅ Metrics: RF17=${metrics.RF17}, W5=${metrics.W5}`);

      const collectionTime = Date.now() - startTime;

      const result: CollectorResult = {
        ohlcv,
        transactions,
        wallets: walletData.wallets,
        holders: walletData.holders,
        holdersStatus: 'available',
        wallet_metrics: walletData.metrics,
        metrics,
        blockchain: 'solana',
        collectionTime,
        collectedAt: Math.floor(Date.now() / 1000)
      };

      // Apply Holder Spike Detection (Feature 1)
      detectHolderSpike(result);

      // Apply System Address Filtering (Feature 2)
      const filtered = await filterSystemAddresses(walletData.holders, 'solana', this.heliusApiKey);
      result.wallet_metrics.top_holders_filtered = filtered.slice(0, 10);
      result.wallet_metrics.top_10_wallets = filtered.slice(0, 10);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`[SolanaCollector] Collection complete in ${collectionTime}ms`);
      console.log(`${'='.repeat(60)}\n`);

      return result;
    } catch (error) {
      console.error('[SolanaCollector] Error:', error);
      throw error;
    }
  }
}

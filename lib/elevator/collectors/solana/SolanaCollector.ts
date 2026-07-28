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
import { fetchOHLCV } from './birdeye';
import { fetchTransactions as fetchSolanaTransactions } from './helius';
import { buildWalletData as buildSolanaWalletData } from './walletEngine';
import { calculateMetrics as calculateSolanaMetrics } from './metrics';

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
   * Fetch transactions from Helius and convert to universal format
   */
  async fetchTransactions(address: string, maxTransactions: number): Promise<UniversalTransaction[]> {
    console.log(`[SolanaCollector] Fetching transactions for ${address}...`);
    
    // Fetch Solana-specific transactions
    const solanaTransactions = await fetchSolanaTransactions(
      address,
      this.heliusApiKey,
      address, // Use address as mint
      maxTransactions
    );

    // Convert to universal format
    return this.convertToUniversalTransactions(solanaTransactions, address);
  }

  /**
   * Convert Solana transactions to universal format
   */
  private convertToUniversalTransactions(
    solanaTransactions: NormalizedTransaction[],
    tokenAddress: string
  ): UniversalTransaction[] {
    const universalTxs: UniversalTransaction[] = [];

    for (const solanaTx of solanaTransactions) {
      // Process each transfer in the transaction
      for (const transfer of solanaTx.transfers) {
        universalTxs.push({
          hash: `${solanaTx.timestamp}-${transfer.from}-${transfer.to}`, // Synthetic hash
          timestamp: solanaTx.timestamp,
          from: transfer.from,
          to: transfer.to,
          amount: transfer.amount,
          type: this.detectTransactionType(transfer, solanaTx.wallets),
          token: {
            address: tokenAddress,
            symbol: undefined, // Could be fetched from token metadata
            decimals: undefined
          },
          blockchain: 'solana',
          raw: solanaTx
        });
      }
    }

    return universalTxs;
  }

  /**
   * Detect transaction type (buy, sell, or transfer)
   * This is a simplified version - could be enhanced with DEX detection
   */
  private detectTransactionType(
    transfer: any,
    wallets: string[]
  ): 'buy' | 'sell' | 'transfer' {
    // For now, classify all as transfers
    // In the future, we could detect DEX interactions to identify buys/sells
    return 'transfer';
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
  async collect(address: string, maxTransactions: number): Promise<CollectorResult> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[SolanaCollector] Starting collection for ${address}`);
    console.log(`[SolanaCollector] Max transactions: ${maxTransactions}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Fetch OHLCV
      console.log('[STEP 1/4] Fetching OHLCV from Birdeye...');
      const ohlcv = await this.fetchOHLCV(address);
      console.log(`✅ Fetched ${ohlcv.length} OHLCV candles`);

      // Step 2: Fetch transactions
      console.log('[STEP 2/4] Fetching transactions from Helius...');
      const transactions = await this.fetchTransactions(address, maxTransactions);
      console.log(`✅ Fetched ${transactions.length} transactions`);

      if (transactions.length === 0) {
        throw new Error('No transactions found for this token');
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
        wallet_metrics: walletData.metrics,
        metrics,
        blockchain: 'solana',
        collectionTime
      };

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

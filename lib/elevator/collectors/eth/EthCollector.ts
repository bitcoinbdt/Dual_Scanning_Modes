/**
 * Ethereum Blockchain Collector
 * Implements IBlockchainCollector for Ethereum network.
 *
 * Transaction source priority:
 *   1. GeckoTerminal (free, accurate Uniswap/DEX swap events with exact buy/sell price)
 *   2. Birdeye /defi/txs/token (fallback, free tier, limited to ~100 trades)
 */

import {
  IBlockchainCollector,
  CollectorResult,
  OHLCVCandle,
  UniversalTransaction,
  WalletBalance,
  HolderInfo,
  WalletMetrics,
  CalculatedMetrics
} from '../types';
import { fetchOHLCV } from './birdeye';
import { fetchGeckoTerminalTrades } from '../shared/geckoTerminal';
import { fetchBirdeyeTrades } from '../shared/birdeyeTrades';
import { detectHolderSpike } from '../../utils/holderSpike';
import { filterSystemAddresses } from '../../utils/addressFilter';
import { aggregateTrades } from '../../utils/aggregateTrades';
import { isGoldrushConfigured, fetchGoldrushTokenHolders } from '../../../providers/goldrush/client';
import { adaptGoldrushHolders } from '../../../providers/goldrush/adapter';

export class EthCollector implements IBlockchainCollector {
  private birdeyeApiKey: string;

  constructor(birdeyeApiKey: string) {
    this.birdeyeApiKey = birdeyeApiKey;
  }

  /** Get blockchain type */
  getBlockchain(): 'eth' {
    return 'eth';
  }

  /** Fetch OHLCV data from Birdeye */
  async fetchOHLCV(address: string): Promise<OHLCVCandle[]> {
    console.log(`[EthCollector] Fetching OHLCV for ${address}...`);
    return await fetchOHLCV(address, this.birdeyeApiKey);
  }

  /**
   * Fetch swap transactions.
   * Tries GeckoTerminal first (Uniswap/DEX swap events), falls back to Birdeye trades.
   */
  async fetchTransactions(address: string, maxTransactions: number): Promise<UniversalTransaction[]> {
    console.log(`[EthCollector] Fetching swap transactions for ${address}...`);

    // --- Primary: GeckoTerminal ---
    console.log('[EthCollector] Trying GeckoTerminal...');
    const geckoTrades = await fetchGeckoTerminalTrades('eth', address, maxTransactions);
    if (geckoTrades && geckoTrades.length > 0) {
      console.log(`[EthCollector] ✅ GeckoTerminal: ${geckoTrades.length} trades`);
      const trades = geckoTrades.map(tx => ({ ...tx, isTrade: true }));
      return aggregateTrades(trades);
    }

    // --- Fallback: Birdeye trades ---
    console.log('[EthCollector] GeckoTerminal returned no data. Trying Birdeye fallback...');
    const birdeyeTrades = await fetchBirdeyeTrades('eth', address, this.birdeyeApiKey, maxTransactions);
    if (birdeyeTrades && birdeyeTrades.length > 0) {
      console.log(`[EthCollector] ✅ Birdeye fallback: ${birdeyeTrades.length} trades`);
      const trades = birdeyeTrades.map(tx => ({ ...tx, isTrade: true }));
      return aggregateTrades(trades);
    }

    console.warn('[EthCollector] Both sources returned no data.');
    return [];
  }

  /** Build wallet balance data from universal transactions */
  buildWalletData(transactions: UniversalTransaction[]): {
    wallets: Record<string, WalletBalance>;
    holders: HolderInfo[];
    metrics: WalletMetrics;
  } {
    const wallets: Record<string, WalletBalance> = {};

    for (const tx of transactions) {
      if (!wallets[tx.from]) wallets[tx.from] = { total_in: 0, total_out: 0, tx_count: 0 };
      if (!wallets[tx.to])   wallets[tx.to]   = { total_in: 0, total_out: 0, tx_count: 0 };

      wallets[tx.from].total_out += tx.amount;
      wallets[tx.from].tx_count++;
      wallets[tx.to].total_in += tx.amount;
      wallets[tx.to].tx_count++;
    }

    const holders: HolderInfo[] = Object.entries(wallets)
      .map(([wallet, balance]) => ({
        wallet,
        balance: balance.total_in - balance.total_out,
        tx_count: balance.tx_count
      }))
      .filter(h => h.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const metrics: WalletMetrics = {
      total_wallets: Object.keys(wallets).length,
      total_holders: holders.length,
      top_10_wallets: holders.slice(0, 10)
    };

    return { wallets, holders, metrics };
  }

  /** Calculate risk metrics */
  calculateMetrics(ohlcv: OHLCVCandle[], walletMetrics: WalletMetrics): CalculatedMetrics {
    if (ohlcv.length === 0) return { RF17: false, W5: null };

    const firstOpen = ohlcv[0].open;
    const lastClose = ohlcv[ohlcv.length - 1].close;
    const priceChange = (lastClose - firstOpen) / firstOpen;
    const totalVolume = ohlcv.reduce((sum, c) => sum + c.volume, 0);
    const avgVolume = totalVolume / ohlcv.length;

    return {
      RF17: totalVolume > avgVolume && Math.abs(priceChange) < 0.02,
      W5: walletMetrics.total_holders
    };
  }

  /** Collect all data for an Ethereum token */
  async collect(address: string, maxTransactions: number, tokenDecimals?: number): Promise<CollectorResult> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[EthCollector] Starting collection for ${address}`);
    console.log(`[EthCollector] Max transactions: ${maxTransactions}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: OHLCV
      let ohlcv: OHLCVCandle[] = [];
      try {
        console.log('[STEP 1/4] Fetching OHLCV from Birdeye...');
        ohlcv = await this.fetchOHLCV(address);
        console.log(`✅ Fetched ${ohlcv.length} OHLCV candles`);
      } catch (err: any) {
        console.warn(`[EthCollector] OHLCV fetch failed: ${err.message}`);
      }

      // Step 2: Swap trades (GeckoTerminal → Birdeye)
      let transactions: UniversalTransaction[] = [];
      try {
        console.log('[STEP 2/4] Fetching swap transactions...');
        transactions = await this.fetchTransactions(address, maxTransactions);
        console.log(`✅ Fetched ${transactions.length} transactions`);
      } catch (err: any) {
        console.warn(`[EthCollector] Swap transactions fetch failed: ${err.message}`);
      }

      if (transactions.length === 0) {
        console.warn('[EthCollector] Warning: No swap transactions found for this token on Ethereum');
      }

      // Step 3: Wallet data
      console.log('[STEP 3/4] Building wallet balances...');
      const walletData = this.buildWalletData(transactions);
      console.log(`✅ ${walletData.metrics.total_wallets} wallets, ${walletData.metrics.total_holders} holders`);

      // Step 4: Metrics
      console.log('[STEP 4/4] Calculating metrics...');
      const metrics = this.calculateMetrics(ohlcv, walletData.metrics);
      console.log(`✅ RF17=${metrics.RF17}, W5=${metrics.W5}`);

      const collectionTime = Date.now() - startTime;

      let holders: HolderInfo[] = [];
      let holdersStatus: 'available' | 'unavailable' | 'insufficient_data' = 'unavailable';

      if (isGoldrushConfigured()) {
        try {
          console.log('[EthCollector] Querying GoldRush token holders...');
          const raw = await fetchGoldrushTokenHolders('eth', address, 100);
          const dataset = adaptGoldrushHolders(raw, {
            chain: 'eth',
            tokenAddress: address,
            tokenDecimals: tokenDecimals,
            snapshotAt: Math.floor(Date.now() / 1000)
          });
          holders = dataset.holders;
          holdersStatus = dataset.status;
        } catch (err: any) {
          console.warn(`[EthCollector] GoldRush holder fetch failed: ${err.message}`);
          holdersStatus = 'unavailable';
        }
      }

      const result: CollectorResult = {
        ohlcv,
        transactions,
        wallets: walletData.wallets,
        holders,
        holdersStatus,
        wallet_metrics: walletData.metrics,
        metrics,
        blockchain: 'eth',
        collectionTime,
        collectedAt: Math.floor(Date.now() / 1000)
      };

      // Apply Holder Spike Detection (Feature 1)
      detectHolderSpike(result);

      // Apply System Address Filtering (Feature 2)
      const filtered = await filterSystemAddresses(walletData.holders, 'eth');
      result.wallet_metrics.top_holders_filtered = filtered.slice(0, 10);
      result.wallet_metrics.top_10_wallets = filtered.slice(0, 10);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`[EthCollector] Done in ${collectionTime}ms`);
      console.log(`${'='.repeat(60)}\n`);

      return result;
    } catch (error) {
      console.error('[EthCollector] Error:', error);
      throw error;
    }
  }
}

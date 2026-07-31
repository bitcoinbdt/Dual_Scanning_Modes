/**
 * BSC (Binance Smart Chain) Blockchain Collector
 * Implements IBlockchainCollector for BSC network.
 *
 * Transaction source priority:
 *   1. GeckoTerminal (free, accurate swap events with exact buy/sell price)
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

export class BscCollector implements IBlockchainCollector {
  private birdeyeApiKey: string;

  constructor(birdeyeApiKey: string) {
    this.birdeyeApiKey = birdeyeApiKey;
  }

  /** Get blockchain type */
  getBlockchain(): 'bsc' {
    return 'bsc';
  }

  /** Fetch OHLCV data from Birdeye */
  async fetchOHLCV(address: string): Promise<OHLCVCandle[]> {
    console.log(`[BscCollector] Fetching OHLCV for ${address}...`);
    return await fetchOHLCV(address, this.birdeyeApiKey);
  }

  /**
   * Fetch swap transactions.
   * Tries GeckoTerminal first (accurate swap events), falls back to Birdeye trades.
   */
  async fetchTransactions(address: string, maxTransactions: number): Promise<UniversalTransaction[]> {
    console.log(`[BscCollector] Fetching swap transactions for ${address}...`);

    // --- Primary: GeckoTerminal ---
    console.log('[BscCollector] Trying GeckoTerminal...');
    const geckoTrades = await fetchGeckoTerminalTrades('bsc', address, maxTransactions);
    if (geckoTrades && geckoTrades.length > 0) {
      console.log(`[BscCollector] ✅ GeckoTerminal: ${geckoTrades.length} trades`);
      return geckoTrades;
    }

    // --- Fallback: Birdeye trades ---
    console.log('[BscCollector] GeckoTerminal returned no data. Trying Birdeye fallback...');
    const birdeyeTrades = await fetchBirdeyeTrades('bsc', address, this.birdeyeApiKey, maxTransactions);
    if (birdeyeTrades && birdeyeTrades.length > 0) {
      console.log(`[BscCollector] ✅ Birdeye fallback: ${birdeyeTrades.length} trades`);
      return birdeyeTrades;
    }

    console.warn('[BscCollector] Both sources returned no data.');
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

  /** Collect all data for a BSC token */
  async collect(address: string, maxTransactions: number): Promise<CollectorResult> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[BscCollector] Starting collection for ${address}`);
    console.log(`[BscCollector] Max transactions: ${maxTransactions}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: OHLCV
      console.log('[STEP 1/4] Fetching OHLCV from Birdeye...');
      const ohlcv = await this.fetchOHLCV(address);
      console.log(`✅ Fetched ${ohlcv.length} OHLCV candles`);

      // Step 2: Swap trades (GeckoTerminal → Birdeye)
      console.log('[STEP 2/4] Fetching swap transactions...');
      const transactions = await this.fetchTransactions(address, maxTransactions);
      console.log(`✅ Fetched ${transactions.length} transactions`);

      if (transactions.length === 0) {
        throw new Error('No swap transactions found for this token on BSC');
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

      const result: CollectorResult = {
        ohlcv,
        transactions,
        wallets: walletData.wallets,
        holders: walletData.holders,
        wallet_metrics: walletData.metrics,
        metrics,
        blockchain: 'bsc',
        collectionTime
      };

      console.log(`\n${'='.repeat(60)}`);
      console.log(`[BscCollector] Done in ${collectionTime}ms`);
      console.log(`${'='.repeat(60)}\n`);

      return result;
    } catch (error) {
      console.error('[BscCollector] Error:', error);
      throw error;
    }
  }
}

/**
 * BSC (Binance Smart Chain) Blockchain Collector
 * Implements IBlockchainCollector for BSC network
 * 
 * Uses Birdeye for OHLCV data and BscScan for transaction data
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
import { fetchBscTransactions, getTokenInfo } from './bscscan';

export class BscCollector implements IBlockchainCollector {
  private birdeyeApiKey: string;
  private bscscanApiKey: string;

  constructor(birdeyeApiKey: string, bscscanApiKey: string) {
    this.birdeyeApiKey = birdeyeApiKey;
    this.bscscanApiKey = bscscanApiKey;
  }

  /**
   * Get blockchain type
   */
  getBlockchain(): 'bsc' {
    return 'bsc';
  }

  /**
   * Fetch OHLCV data from Birdeye
   */
  async fetchOHLCV(address: string): Promise<OHLCVCandle[]> {
    console.log(`[BscCollector] Fetching OHLCV for ${address}...`);
    return await fetchOHLCV(address, this.birdeyeApiKey);
  }

  /**
   * Fetch transactions from BscScan and convert to universal format
   */
  async fetchTransactions(address: string, maxTransactions: number): Promise<UniversalTransaction[]> {
    console.log(`[BscCollector] Fetching transactions for ${address}...`);
    
    // Fetch token info for metadata
    const tokenInfo = await getTokenInfo(address, this.bscscanApiKey);
    
    // Fetch raw BSC transactions
    const bscTransactions = await fetchBscTransactions(
      address,
      this.bscscanApiKey,
      maxTransactions
    );

    // Convert to universal format
    return this.convertToUniversalTransactions(bscTransactions, address, tokenInfo);
  }

  /**
   * Convert BscScan transactions to universal format
   */
  private convertToUniversalTransactions(
    bscTransactions: any[],
    tokenAddress: string,
    tokenInfo: { name?: string; symbol?: string; decimals?: number }
  ): UniversalTransaction[] {
    return bscTransactions.map(tx => {
      // Calculate actual token amount considering decimals
      const decimals = tokenInfo.decimals || parseInt(tx.tokenDecimal) || 18;
      const amount = parseFloat(tx.value) / Math.pow(10, decimals);

      return {
        hash: tx.hash,
        timestamp: parseInt(tx.timeStamp),
        from: tx.from.toLowerCase(),
        to: tx.to.toLowerCase(),
        amount: amount,
        type: this.detectTransactionType(tx),
        token: {
          address: tokenAddress.toLowerCase(),
          symbol: tokenInfo.symbol || tx.tokenSymbol,
          decimals: decimals
        },
        blockchain: 'bsc',
        gasUsed: parseInt(tx.gasUsed),
        gasFee: (parseInt(tx.gasUsed) * parseInt(tx.gasPrice)) / 1e18, // Convert to BNB
        raw: tx
      };
    });
  }

  /**
   * Detect transaction type (buy, sell, or transfer)
   * This is simplified - could be enhanced with DEX router detection
   */
  private detectTransactionType(tx: any): 'buy' | 'sell' | 'transfer' {
    // Common DEX router addresses on BSC (PancakeSwap, etc.)
    const dexRouters = [
      '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap V2
      '0x05ff2b0db69458a0750badebc4f9e13add608c7f', // PancakeSwap V1
      '0xd99d1c33f9fc3444f8101754abc46c52416550d1', // PancakeSwap Testnet
    ];

    const fromLower = tx.from.toLowerCase();
    const toLower = tx.to.toLowerCase();

    // Check if interacting with known DEX
    if (dexRouters.includes(fromLower)) {
      return 'sell'; // Tokens coming from DEX = sell
    }
    
    if (dexRouters.includes(toLower)) {
      return 'buy'; // Tokens going to DEX = buy
    }

    // Default to transfer
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
    if (ohlcv.length === 0) {
      return {
        RF17: false,
        W5: null
      };
    }

    const firstOpen = ohlcv[0].open;
    const lastClose = ohlcv[ohlcv.length - 1].close;

    // Calculate price change percentage
    const priceChange = (lastClose - firstOpen) / firstOpen;

    // Calculate volume metrics
    const totalVolume = ohlcv.reduce((sum, candle) => sum + candle.volume, 0);
    const avgVolume = totalVolume / ohlcv.length;

    // RF17: Wash trading indicator
    const RF17 = (totalVolume > avgVolume) && (Math.abs(priceChange) < 0.02);

    // W5: Total holder count
    const W5 = walletMetrics.total_holders;

    return { RF17, W5 };
  }

  /**
   * Collect all data for a BSC token
   */
  async collect(address: string, maxTransactions: number): Promise<CollectorResult> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[BscCollector] Starting collection for ${address}`);
    console.log(`[BscCollector] Max transactions: ${maxTransactions}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Fetch OHLCV
      console.log('[STEP 1/4] Fetching OHLCV from Birdeye...');
      const ohlcv = await this.fetchOHLCV(address);
      console.log(`✅ Fetched ${ohlcv.length} OHLCV candles`);

      // Step 2: Fetch transactions
      console.log('[STEP 2/4] Fetching transactions from BscScan...');
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
        blockchain: 'bsc',
        collectionTime
      };

      console.log(`\n${'='.repeat(60)}`);
      console.log(`[BscCollector] Collection complete in ${collectionTime}ms`);
      console.log(`${'='.repeat(60)}\n`);

      return result;
    } catch (error) {
      console.error('[BscCollector] Error:', error);
      throw error;
    }
  }
}

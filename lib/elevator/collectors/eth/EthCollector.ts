/**
 * Ethereum Blockchain Collector
 * Implements IBlockchainCollector for Ethereum network
 * 
 * Uses Birdeye for OHLCV data and Etherscan for transaction data
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
import { fetchEthTransactions, getTokenInfo } from './etherscan';

export class EthCollector implements IBlockchainCollector {
  private birdeyeApiKey: string;
  private etherscanApiKey: string;

  constructor(birdeyeApiKey: string, etherscanApiKey: string) {
    this.birdeyeApiKey = birdeyeApiKey;
    this.etherscanApiKey = etherscanApiKey;
  }

  /**
   * Get blockchain type
   */
  getBlockchain(): 'eth' {
    return 'eth';
  }

  /**
   * Fetch OHLCV data from Birdeye
   */
  async fetchOHLCV(address: string): Promise<OHLCVCandle[]> {
    console.log(`[EthCollector] Fetching OHLCV for ${address}...`);
    return await fetchOHLCV(address, this.birdeyeApiKey);
  }

  /**
   * Fetch transactions from Etherscan and convert to universal format
   */
  async fetchTransactions(address: string, maxTransactions: number): Promise<UniversalTransaction[]> {
    console.log(`[EthCollector] Fetching transactions for ${address}...`);
    
    // Fetch token info for metadata
    const tokenInfo = await getTokenInfo(address, this.etherscanApiKey);
    
    // Fetch raw Ethereum transactions
    const ethTransactions = await fetchEthTransactions(
      address,
      this.etherscanApiKey,
      maxTransactions
    );

    // Convert to universal format
    return this.convertToUniversalTransactions(ethTransactions, address, tokenInfo);
  }

  /**
   * Convert Etherscan transactions to universal format
   */
  private convertToUniversalTransactions(
    ethTransactions: any[],
    tokenAddress: string,
    tokenInfo: { name?: string; symbol?: string; decimals?: number }
  ): UniversalTransaction[] {
    return ethTransactions.map(tx => {
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
        blockchain: 'eth',
        gasUsed: parseInt(tx.gasUsed),
        gasFee: (parseInt(tx.gasUsed) * parseInt(tx.gasPrice)) / 1e18, // Convert to ETH
        raw: tx
      };
    });
  }

  /**
   * Detect transaction type (buy, sell, or transfer)
   * Enhanced with Uniswap and other major DEX routers
   */
  private detectTransactionType(tx: any): 'buy' | 'sell' | 'transfer' {
    // Common DEX router addresses on Ethereum
    const dexRouters = [
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
      '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
      '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // Uniswap Universal Router
      '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', // SushiSwap Router
      '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
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
   * Collect all data for an Ethereum token
   */
  async collect(address: string, maxTransactions: number): Promise<CollectorResult> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[EthCollector] Starting collection for ${address}`);
    console.log(`[EthCollector] Max transactions: ${maxTransactions}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Fetch OHLCV
      console.log('[STEP 1/4] Fetching OHLCV from Birdeye...');
      const ohlcv = await this.fetchOHLCV(address);
      console.log(`✅ Fetched ${ohlcv.length} OHLCV candles`);

      // Step 2: Fetch transactions
      console.log('[STEP 2/4] Fetching transactions from Etherscan...');
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
        blockchain: 'eth',
        collectionTime
      };

      console.log(`\n${'='.repeat(60)}`);
      console.log(`[EthCollector] Collection complete in ${collectionTime}ms`);
      console.log(`${'='.repeat(60)}\n`);

      return result;
    } catch (error) {
      console.error('[EthCollector] Error:', error);
      throw error;
    }
  }
}

/**
 * TypeScript type definitions for Elevator Scan data collector
 * Ported from data_collector JavaScript engine
 * 
 * Phase 2: Added universal interfaces for multi-chain support
 */

// ============================================================================
// UNIVERSAL TYPES (Used across all chains)
// ============================================================================

// OHLCV (Candlestick) Data from Birdeye
export interface OHLCVCandle {
  timestamp: number;
  open: number;
  close: number;
  volume: number;
}

// Universal transaction format that works for all blockchains
export interface UniversalTransaction {
  hash: string;                // Transaction hash/signature
  timestamp: number;            // Unix timestamp
  from: string;                 // Sender address
  to: string;                   // Receiver address
  amount: number;               // Token amount (normalized)
  type: 'buy' | 'sell' | 'transfer';  // Transaction type
  token: {
    address: string;            // Token contract address
    symbol?: string;            // Token symbol (if available)
    decimals?: number;          // Token decimals (if available)
  };
  blockchain: 'solana' | 'bsc' | 'eth';  // Source blockchain
  gasUsed?: number;             // Gas/fee used (optional)
  gasFee?: number;              // Gas fee in native token (optional)
  raw?: any;                    // Original transaction data (for debugging)
  isTrade?: boolean;            // Flag indicating if this transaction is a DEX trade
  priceUsd?: number;            // Exact trade price in USD
  wallet?: string;              // Address of the user executing the transaction
  aggregated?: boolean;         // Flag indicating if this trade was aggregated from multiple hops
  toExchange?: boolean;         // Flag indicating if tokens were sent to a CEX
  fromExchange?: boolean;       // Flag indicating if tokens were received from a CEX
  exchangeName?: string;        // Name of the centralized exchange
  gasCostUsd?: number;          // Estimated gas cost of transaction in USD
  dexFeeUsd?: number;           // Estimated liquidity provider fee in USD
  isWashTrader?: boolean;       // Flag indicating if this transaction belongs to a wash trading wallet
  roundTrips?: number;          // Number of buy-sell round-trips for the wash trader wallet
}

// Wallet balance and activity summary
export interface WalletBalance {
  total_in: number;
  total_out: number;
  tx_count: number;
}

// Holder information (wallet with positive balance)
export interface HolderInfo {
  wallet: string;
  balance: number;
  tx_count: number;
}

// Wallet metrics summary
export interface WalletMetrics {
  total_wallets: number;
  total_holders: number;
  top_10_wallets: HolderInfo[];
  top_holders_filtered?: HolderInfo[];
}

// Calculated risk metrics
export interface CalculatedMetrics {
  RF17: boolean;      // Wash trading indicator
  W5: number | null;  // Total holder count
}

// Complete collector result (unified for all chains)
export interface CollectorResult {
  ohlcv: OHLCVCandle[];
  transactions: UniversalTransaction[];
  wallets: Record<string, WalletBalance>;
  holders: HolderInfo[];
  wallet_metrics: WalletMetrics;
  metrics: CalculatedMetrics;
  blockchain: 'solana' | 'bsc' | 'eth';
  collectionTime: number;  // Time taken to collect (ms)
  holder_spike?: boolean;
  spike_percentage?: number;
  new_holders_24h?: number;
  total_holders_before_24h?: number;
}

// ============================================================================
// CHAIN-SPECIFIC TYPES (Solana legacy support)
// ============================================================================

// ============================================================================
// CHAIN-SPECIFIC TYPES (Solana legacy support)
// ============================================================================

// Token Transfer within a Solana transaction
export interface TokenTransfer {
  from: string;
  to: string;
  amount: number;
  type: 'token';
  mint: string;
}

// Normalized Solana Transaction
export interface NormalizedTransaction {
  signature?: string;           // Transaction signature/hash
  timestamp: number;
  wallets: string[];
  transfers: TokenTransfer[];
  isTrade?: boolean;            // Flag indicating if this transaction is a DEX trade
}

// Legacy Solana collector result (for backward compatibility)
export interface SolanaCollectorResult {
  ohlcv: OHLCVCandle[];
  transactions: NormalizedTransaction[];
  wallets: Record<string, WalletBalance>;
  holders: HolderInfo[];
  wallet_metrics: WalletMetrics;
  metrics: CalculatedMetrics;
}

// ============================================================================
// COLLECTOR INTERFACE (All chains must implement this)
// ============================================================================

/**
 * Universal blockchain collector interface
 * All chain-specific collectors (Solana, BSC, ETH) must implement this
 */
export interface IBlockchainCollector {
  /**
   * Fetch OHLCV (price candle) data for a token
   * @param address - Token contract address
   * @returns Array of OHLCV candles
   */
  fetchOHLCV(address: string): Promise<OHLCVCandle[]>;

  /**
   * Fetch transaction history for a token
   * @param address - Token contract address
   * @param maxTransactions - Maximum number of transactions to fetch
   * @returns Array of universal transactions
   */
  fetchTransactions(address: string, maxTransactions: number): Promise<UniversalTransaction[]>;

  /**
   * Build wallet balance data from transactions
   * @param transactions - Array of universal transactions
   * @returns Wallet balances, holders, and metrics
   */
  buildWalletData(transactions: UniversalTransaction[]): {
    wallets: Record<string, WalletBalance>;
    holders: HolderInfo[];
    metrics: WalletMetrics;
  };

  /**
   * Calculate risk metrics from OHLCV and wallet data
   * @param ohlcv - OHLCV candle data
   * @param walletMetrics - Wallet metrics summary
   * @returns Calculated metrics (RF17, W5)
   */
  calculateMetrics(ohlcv: OHLCVCandle[], walletMetrics: WalletMetrics): CalculatedMetrics;

  /**
   * Collect all data for a token (main entry point)
   * @param address - Token contract address
   * @param maxTransactions - Maximum number of transactions to fetch
   * @returns Complete collector result
   */
  collect(address: string, maxTransactions: number): Promise<CollectorResult>;

  /**
   * Get the blockchain type this collector handles
   */
  getBlockchain(): 'solana' | 'bsc' | 'eth';
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

// Collector configuration based on credits spent
export interface CollectorConfig {
  maxTransactions: number;
  tier: 'quick_peek' | 'standard' | 'professional' | 'institutional';
}

// API keys for different services
export interface CollectorApiKeys {
  BIRDEYE_API_KEY?: string;
  HELIUS_API_KEY?: string;
  BSCSCAN_API_KEY?: string;
  ETHERSCAN_API_KEY?: string;
}

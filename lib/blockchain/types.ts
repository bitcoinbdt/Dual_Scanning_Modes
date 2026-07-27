/**
 * TypeScript Type Definitions for Blockchain Scanner
 * 
 * Defines all interfaces and types used across the scanner services
 */

// ============================================================================
// Core Data Types
// ============================================================================

export interface Transaction {
  hash: string;
  fullHash?: string;
  from: string;
  to: string;
  amount: string;
  rawAmount?: number;
  rawTimestamp?: number;
  timestamp: string;
  type?: 'Buy' | 'Sell' | 'Transfer';
  tokenSymbol?: string;
}

export interface LiquidityPool {
  pair: string;
  dex: string;
  liquidityUsd: number;
  priceUsd?: number;
}

export interface LiquidityInfo {
  totalLiquidityUsd: number;
  mainPools: LiquidityPool[];
  tokenNameOverride?: string | null;
  symbolOverride?: string | null;
  fdv?: number | null;
  basePriceUsd?: number;
  source?: 'dexscreener' | 'geckoterminal' | 'defillama' | 'fallback';
}

export interface SecurityData {
  buyTax: number;
  sellTax: number;
  hasMintFunction: boolean;
  canBePaused: boolean;
  isHoneypot: boolean;
  holderCount: number;
  lpHolderCount: number;
  creatorAddress?: string;
  ownerAddress?: string;
}

export interface NetworkHealth {
  lastBlock: string;
  blockReward: string;
}

export interface ScanMetadata {
  confidence: number;
  failed_sources: string[];
  completed_sources: string[];
  partial_data: boolean;
}

// ============================================================================
// Scanner Result Types
// ============================================================================

export interface OnChainData {
  address: string;
  tokenName: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
  contractVerified: boolean;
  network: string;
  taxBuy: string;
  taxSell: string;
  mintFunction: string;
  freezable: string;
  liquidityLocked: boolean;
  recentTransactions: Transaction[];
  networkHealth: NetworkHealth;
  recentVolume: 'High' | 'Medium' | 'Low' | 'Unknown';
  holderConcentration: 'High' | 'Medium' | 'Low';
  securityInfo?: SecurityData | null;
  liquidityInfo?: LiquidityInfo;
  washTradingPercentage?: number;
  cacheStatus?: 'hit' | 'miss';
  cachedAt?: string;
  meta?: ScanMetadata;
}

export interface ScanResult {
  success: boolean;
  data: {
    onChainData: OnChainData;
    signal?: any; // Alpha signal (optional)
    metadata: {
      network: 'solana' | 'evm';
      chainId: string | null;
      cacheStatus: 'hit' | 'miss';
      scanDuration: number;
    };
  };
  timestamp: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface BasicScanResponse {
  address: string;
  tokenName: string;
  symbol: string;
  totalSupply: number;
  contractVerified: boolean;
  network: string;
  taxBuy: string;
  taxSell: string;
  mintFunction: string;
  freezable: string;
  liquidityLocked: boolean;
  timestamp: string;
  recentTransactions: Transaction[];
  liquidityInfo?: LiquidityInfo;
}

export interface AddressValidation {
  valid: boolean;
  network?: 'evm' | 'solana';
  address?: string;
  error?: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T = any> {
  data: T;
  expiry: number;
}

export interface StaticData {
  tokenName: string;
  symbol: string;
  decimals: number;
  bytecode?: string;
  contractVerified: boolean;
  network: string;
  cachedAt: string;
}

// ============================================================================
// Retry Configuration
// ============================================================================

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, maxAttempts: number, delay: number, error: Error) => void;
}

// ============================================================================
// Market Data Provider Types
// ============================================================================

export interface DexScreenerPair {
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  dexId: string;
  priceUsd: string;
  liquidity?: {
    usd: number;
  };
  fdv?: number;
  marketCap?: number;
}

export interface DexScreenerResponse {
  pairs: DexScreenerPair[];
}

// ============================================================================
// Chain Configuration
// ============================================================================

export interface ChainConfig {
  [chainId: string]: {
    name: string;
    rpcs: string[];
  };
}

export type ChainId = '1' | '56' | '137' | '42161' | '8453' | '10';

// ============================================================================
// Error Types
// ============================================================================

export class ScannerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ScannerError';
  }
}

export class RateLimitError extends ScannerError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT', details);
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends ScannerError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends ScannerError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

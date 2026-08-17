/**
 * TypeScript Type Definitions for Blockchain Scanner
 * 
 * Defines all interfaces and types used across the scanner services
 */

// ============================================================================
// Core Data Types
// ============================================================================
import type { CanonicalClmmProfile } from '../providers/adapter-types';
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

// ============================================================================
// Pool State Data Contract
// ============================================================================

/**
 * Describes the fee rate for an AMM pool.
 *
 * WHY: Not all pools use the canonical 0.3% Uniswap V2 fee.
 * Examples: Uniswap V3 tiers (0.01%, 0.05%, 0.3%, 1%), Curve (0.04%),
 * PancakeSwap V3 (0.01%, 0.05%, 0.25%, 1%).
 * If the fee is not known from provider metadata, we record it as unknown
 * rather than assuming 0.3% — the AMM simulator must decide how to handle
 * that (e.g. apply a conservative default and surface a warning).
 *
 * feeRate is expressed as a decimal fraction: 0.003 = 0.3%.
 */
export type PoolFeeInfo =
  | {
      /**
       * Fee is known from on-chain or provider metadata.
       * feeRate is the fraction applied to each swap input (e.g. 0.003 = 0.3%).
       */
      known: true;
      feeRate: number;
      /** Optional: fee tier in bps * 100 as used by Uniswap V3 (e.g. 3000 = 0.3%) */
      feeTierBps?: number;
      source: 'on-chain' | 'provider-metadata';
    }
  | {
      /**
       * Fee is not available from provider data.
       * The AMM simulator must not silently assume 0.3% for pool types
       * where that assumption is unsafe (e.g. Curve, CLMM, custom AMMs).
       */
      known: false;
    };

/**
 * AMM pool AMM model type.
 * - 'constant-product' : x*y=k AMM (Uniswap V2, PancakeSwap V2, SushiSwap, etc.)
 * - 'concentrated-liquidity' : tick-based CLMM (Uniswap V3, Raydium CLMM, Orca Whirlpools, Meteora)
 * - 'unknown' : pool type could not be determined from provider metadata
 */
export type PoolType = 'constant-product' | 'concentrated-liquidity' | 'unknown';

/**
 * Normalized pool state data contract.
 *
 * DATA PROVENANCE TAXONOMY:
 *   - 'observed'   : Value was directly returned by an on-chain RPC call or
 *                    an authoritative provider field mapping to an on-chain slot.
 *   - 'provider'   : Value was returned by a market data API (DexScreener,
 *                    GeckoTerminal, DefiLlama) but cannot be verified against
 *                    the chain directly within this system.
 *   - 'derived'    : Value was calculated from other fields (e.g. reserves
 *                    derived from liquidityUsd and spotPrice using the
 *                    constant-product 50/50 assumption). Derived values carry
 *                    inherent model uncertainty and must NEVER be presented as
 *                    authoritative on-chain observations.
 *   - 'unknown'    : Provenance could not be determined.
 *
 * MIGRATION NOTE:
 *   The legacy `LiquidityPool` shape (pair/dex/liquidityUsd/priceUsd/type)
 *   remains in use for Basic Scan and existing flow compatibility.
 *   `NormalizedPoolState` is the richer contract for Deep Scan engines.
 *   `toLegacyPool()` bridges the two.
 */
export interface NormalizedPoolState {
  // ── Identity ──

  /**
   * Pool contract address or a unique identifier string from the provider.
   * For DexScreener/GeckoTerminal data, this may be the pair label
   * (e.g. "TOKEN/USDT") until on-chain pool addresses are integrated.
   */
  poolIdentifier: string;

  /**
   * Whether poolIdentifier is an actual on-chain contract address or a
   * human-readable label from a provider API.
   */
  poolIdentifierType: 'address' | 'label';

  /** Chain the pool lives on (e.g. 'eth', 'bsc', 'solana') */
  chain?: string;

  /** DEX or source label (e.g. 'uniswap-v2', 'pancakeswap', 'raydium') */
  dex: string;

  // ── AMM Classification ──

  /** Pool AMM model type (see PoolType). */
  poolType: PoolType;

  // ── Price & Liquidity ──

  /**
   * Total pool liquidity in USD.
   * Provenance is almost always 'provider' (from API) rather than observed on-chain.
   */
  liquidityUsd: number;
  liquidityUsdProvenance: 'observed' | 'provider' | 'derived' | 'unknown';

  /**
   * Spot price of the base token in USD.
   * Typically 'provider' data from market data APIs.
   */
  spotPriceUsd?: number;
  spotPriceUsdProvenance?: 'observed' | 'provider' | 'derived' | 'unknown';

  // ── Reserves (optional — not provided by current market data APIs) ──

  /**
   * Token (base) reserve.
   * Can be observed directly on-chain via provider/RPC queries.
   * If derived virtual reserves are calculated, they are not stored here but computed on-the-fly.
   */
  tokenReserveRaw?: number;
  tokenReserveProvenance?: 'observed' | 'provider' | 'derived';

  /**
   * Quote (counter) reserve.
   * For observed reserves, this is represented as a derived USD value (tokenReserveRaw * spotPriceUsd)
   * since quote decimals may not be known. If derived virtual reserves are used, this is half of total liquidity.
   */
  quoteReserveRaw?: number;
  quoteReserveProvenance?: 'observed' | 'provider' | 'derived';

  // ── Fee ──

  /** Fee information for this pool (see PoolFeeInfo). */
  fee: PoolFeeInfo;

  // ── Snapshot ──

  /**
   * Unix timestamp (seconds) when this pool state snapshot was taken.
   * Undefined if the provider did not return timestamp metadata.
   */
  snapshotAt?: number;
  snapshotAtProvenance?: 'observed' | 'provider';
  /** Canonical CLMM profile from on-chain slot0() — only populated for V3 pools via Alchemy */
  clmmProfile?: CanonicalClmmProfile;
  /** Address of token0 in the pool contract (EVM only, normalized to lowercase) */
  token0?: string;
  /** Address of token1 in the pool contract (EVM only, normalized to lowercase) */
  token1?: string;
}

/**
 * Legacy pool shape used by Basic Scan and existing flow compatibility.
 * Kept for backward compatibility. Deep Scan engines work with NormalizedPoolState.
 */
export interface LiquidityPool {
  pair: string;
  poolAddress?: string;
  dex: string;
  liquidityUsd: number;
  priceUsd?: number;
  type?: PoolType;
}

/**
 * Lift a legacy LiquidityPool to a NormalizedPoolState.
 *
 * PROVENANCE NOTE: All values from LiquidityPool are treated as 'provider'
 * data (from a market data API) since the legacy shape carries no provenance.
 * Reserves are left undefined because they were never part of LiquidityPool.
 */
export function toNormalizedPoolState(
  pool: LiquidityPool,
  opts?: { chain?: string; snapshotAt?: number }
): NormalizedPoolState {
  const isValidAddress = pool.poolAddress && /^0x[a-fA-F0-9]{40}$/i.test(pool.poolAddress);
  return {
    poolIdentifier: isValidAddress ? pool.poolAddress! : pool.pair,
    poolIdentifierType: isValidAddress ? 'address' : 'label',
    chain: opts?.chain,
    dex: pool.dex,
    poolType: pool.type ?? 'unknown',
    liquidityUsd: pool.liquidityUsd,
    liquidityUsdProvenance: 'provider',
    spotPriceUsd: pool.priceUsd,
    spotPriceUsdProvenance: pool.priceUsd !== undefined ? 'provider' : undefined,
    // Reserves intentionally left undefined — not available from legacy shape
    fee: { known: false },
    snapshotAt: opts?.snapshotAt,
    snapshotAtProvenance: opts?.snapshotAt !== undefined ? 'provider' : undefined,
  };
}

/**
 * Convert a NormalizedPoolState back to the legacy LiquidityPool shape
 * for callers that have not been migrated.
 */
export function toLegacyPool(state: NormalizedPoolState): LiquidityPool {
  return {
    pair: state.poolIdentifierType === 'address' ? 'Unknown' : state.poolIdentifier,
    poolAddress: state.poolIdentifierType === 'address' ? state.poolIdentifier : undefined,
    dex: state.dex,
    liquidityUsd: state.liquidityUsd,
    priceUsd: state.spotPriceUsd,
    type: state.poolType,
  };
}

export interface LiquidityInfo {
  totalLiquidityUsd: number;
  mainPools: LiquidityPool[];
  tokenNameOverride?: string | null;
  symbolOverride?: string | null;
  fdv?: number | null;
  basePriceUsd?: number;
  volume24hUsd?: number | null;
  source?: 'dexscreener' | 'geckoterminal' | 'defillama' | 'fallback';
  timestamp?: number; // Unix timestamp of the data source snapshot (seconds)
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
  isPreGraduation?: boolean;
  launchpadPlatform?: 'pump' | 'launchlab' | 'none';
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
  pairAddress?: string;
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
  volume?: {
    h24?: number;
  };
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

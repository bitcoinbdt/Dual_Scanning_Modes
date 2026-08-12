/**
 * Canonical Adapter Output Types
 *
 * These types form the strict boundary between provider-specific API responses
 * and the Deep Scan engine layer.  Engines and analyzers must only consume
 * these canonical shapes — never raw provider JSON.
 *
 * PROVENANCE VOCABULARY (mirrors NormalizedPoolState conventions):
 *   'goldrush'   — value came from the GoldRush / Covalent API
 *   'alchemy-v2' — value came from Alchemy JSON-RPC (Uniswap V2 ABI)
 *   'bitquery'   — value came from a Bitquery GraphQL query
 *   'uniswap-v3' — value came from the Uniswap V3 API or slot0() on-chain call
 *
 * DATA INTEGRITY RULES:
 *   - 'unavailable' must NEVER be silently converted to zero.
 *   - tx_count = 0 in EvmHolderDataset is an explicit compatibility decision
 *     (GoldRush token-holder endpoint does not return per-wallet tx counts).
 *     This is documented here and at every call site.
 *   - Do NOT add fields not present in the provider response.
 *   - Distinguish 'provider_unavailable', 'pool_not_found', 'field_unavailable',
 *     and 'available' states explicitly — never collapse them.
 *
 * SERVER-SIDE ONLY:
 *   These types carry provider metadata and must never be imported by React
 *   components, API-route business logic, or any client-side module.
 */

import type { HolderInfo } from '../elevator/collectors/types';

// ─────────────────────────────────────────────────────────────────────────────
// A. GoldRush — EVM Holder Dataset
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical EVM holder dataset produced by the GoldRush adapter.
 *
 * STATUS SEMANTICS:
 *   'available'          — holders list is populated from the API response.
 *   'unavailable'        — API call failed, not configured, or raw input absent.
 *   'insufficient_data'  — API responded but returned zero items.
 *
 * TX_COUNT NOTE:
 *   The GoldRush /token_holders/ endpoint does NOT return per-wallet transaction
 *   counts.  All HolderInfo.tx_count values will be 0 for compatibility with
 *   the existing HolderInfo interface.  Do not interpret this zero as an
 *   observed count.  A separate endpoint or provider would be required to
 *   populate this field.
 */
export interface EvmHolderDataset {
  /** Adapter availability status. */
  status: 'available' | 'unavailable' | 'insufficient_data';

  /**
   * Top holders sorted by balance descending.
   * HolderInfo.tx_count is always 0 — see TX_COUNT NOTE above.
   */
  holders: HolderInfo[];

  /**
   * Total holder count as reported by the provider's pagination metadata.
   * May exceed the length of `holders` (which is a paginated subset).
   * Undefined if the provider did not return a total_count.
   */
  totalHolderCount?: number;

  /** EVM chain slug used in the API call (e.g. 'eth-mainnet', 'bsc-mainnet'). */
  chain?: string;

  /** Checksummed EVM token contract address. */
  tokenAddress?: string;

  /** Unix timestamp (seconds) when this dataset was fetched. */
  snapshotAt?: number;

  /** Human-readable explanation when status !== 'available'. */
  reason?: string;

  /** Data provenance identifier. */
  provenance: 'goldrush';
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Alchemy — Canonical V2 Pool State (from getReserves())
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical Uniswap V2-style pool state decoded from Alchemy JSON-RPC.
 *
 * STATUS SEMANTICS:
 *   'available'   — reserves decoded successfully.
 *   'unavailable' — RPC call failed, pool not found, or decoding error.
 *
 * RESERVE PROVENANCE:
 *   tokenReserve and quoteReserve are the raw uint112 values from getReserves().
 *   They are 'observed' on-chain values (not derived).  When these values are
 *   consumed by AmmSlippageSimulator, the simulator should record provenance
 *   as 'observed' rather than 'derived'.
 *
 * ORDERING NOTE:
 *   reserve0/reserve1 ordering follows the pool contract's internal token order.
 *   The caller must know which reserve corresponds to the base vs quote token.
 *   This adapter preserves the raw ordering without reordering.
 */
export interface CanonicalV2PoolState {
  /** Adapter availability status. */
  status: 'available' | 'unavailable';

  /** EVM pool contract address (lowercase). */
  poolAddress: string;

  /**
   * reserve0 from getReserves() — raw uint112 value.
   * Undefined when status is 'unavailable'.
   */
  tokenReserve?: bigint;

  /**
   * reserve1 from getReserves() — raw uint112 value.
   * Undefined when status is 'unavailable'.
   */
  quoteReserve?: bigint;

  /**
   * blockTimestampLast from getReserves() return value.
   * Unix timestamp (seconds) of the last swap recorded by the contract.
   */
  blockTimestampLast?: number;

  /** Block number at the time of the RPC call. */
  snapshotBlock?: number;

  /** Unix timestamp (seconds) when this state was fetched. */
  snapshotAt?: number;

  /**
   * Granular failure classification to distinguish:
   *   'provider_unavailable' — Alchemy not configured or network error.
   *   'pool_not_found'       — RPC call succeeded but pool address returned no data.
   *   'decode_error'         — Response was received but ABI decoding failed.
   *   'rpc_error'            — On-chain call reverted or returned an error.
   */
  failureKind?: 'provider_unavailable' | 'pool_not_found' | 'decode_error' | 'rpc_error';

  /** Human-readable explanation when status is 'unavailable'. */
  reason?: string;

  /** Data provenance identifier. */
  provenance: 'alchemy-v2';
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Bitquery — Wallet History Record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Availability of wallet history data from Bitquery.
 *
 *   'available' — at least one transaction found; first-seen data populated.
 *   'unavailable' — query failed or wallet has no history in the query window.
 *   'partial'   — response received but some fields could not be determined
 *                 (e.g. block number present but timestamp missing).
 */
export type WalletHistoryAvailability = 'available' | 'unavailable' | 'partial';

/**
 * Canonical wallet history record produced by the Bitquery adapter.
 *
 * SCOPE:
 *   This record reflects only what can be determined from a Bitquery
 *   EVM.Transfers query within the configured time window.  It does NOT
 *   represent the wallet's entire on-chain history.
 *
 * NEVER FABRICATE:
 *   If firstSeenTimestamp or firstSeenBlock cannot be determined, leave
 *   them undefined.  Do not substitute zero or epoch values.
 */
export interface WalletHistoryRecord {
  /** The wallet address this record describes. */
  wallet: string;

  /** Data availability classification. */
  availability: WalletHistoryAvailability;

  /**
   * Unix timestamp (seconds) of the earliest transfer involving this wallet
   * found within the Bitquery query window.
   */
  firstSeenTimestamp?: number;

  /**
   * Block number of the earliest transfer involving this wallet
   * found within the Bitquery query window.
   */
  firstSeenBlock?: number;

  /**
   * Count of transfer events returned by the query for this wallet.
   * This is the count within the query window, NOT total lifetime tx count.
   */
  txCountObserved?: number;

  /**
   * Structured reason code when availability !== 'available':
   *   'no_history_found'   — query succeeded but returned zero transfers.
   *   'malformed_response' — response shape did not match expected structure.
   *   'auth_failure'       — Bitquery OAuth token could not be obtained.
   *   'query_failure'      — network or GraphQL-level error.
   */
  failureKind?: 'no_history_found' | 'malformed_response' | 'auth_failure' | 'query_failure';

  /** Human-readable explanation when availability !== 'available'. */
  reason?: string;

  /** Data provenance identifier. */
  provenance: 'bitquery';
}

// ─────────────────────────────────────────────────────────────────────────────
// D. Uniswap — Canonical CLMM Profile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical concentrated-liquidity pool profile produced by the Uniswap adapter.
 *
 * STATUS SEMANTICS:
 *   'available'   — all required fields populated from the provider response.
 *   'unavailable' — provider not configured, pool not found, or required fields absent.
 *
 * FAILURE KIND TAXONOMY:
 *   'provider_unavailable' — Uniswap API not configured or unreachable.
 *   'pool_not_found'       — API responded but returned no pool for the address.
 *   'field_unavailable'    — Response received but required fields (sqrtPriceX96,
 *                            liquidity, tick) are missing or unparseable.
 *   'api_error'            — HTTP or API-level error from the Uniswap endpoint.
 *
 * DO NOT FABRICATE:
 *   sqrtPriceX96, liquidity, tick, and tickSpacing must only be set if the
 *   provider explicitly returned them.  Do not use defaults or derive these
 *   values — fabricated CLMM state can silently break risk calculations.
 *
 * CLMM NOTE:
 *   The AmmSlippageSimulator currently returns 'insufficient_data' for
 *   concentrated-liquidity pools.  This canonical type establishes the
 *   adapter boundary for future CLMM simulation integration.
 */
export interface CanonicalClmmProfile {
  /** Adapter availability status. */
  status: 'available' | 'unavailable';

  /** Pool contract address (lowercase). */
  poolAddress: string;

  /**
   * Current square root price in Q64.96 format as returned by slot0().
   * Undefined when status is 'unavailable'.
   */
  sqrtPriceX96?: bigint;

  /**
   * Current active tick index.
   * Undefined when status is 'unavailable'.
   */
  currentTick?: number;

  /**
   * Pool's configured tick spacing.
   * Undefined when status is 'unavailable' or not returned by the provider.
   */
  tickSpacing?: number;

  /**
   * Current in-range liquidity as returned by the pool contract.
   * Undefined when status is 'unavailable'.
   */
  liquidity?: bigint;

  /**
   * Fee tier in bps * 100 units (e.g. 3000 = 0.3%, 500 = 0.05%).
   * Undefined when not returned by the provider.
   */
  feeTier?: number;

  /** token0 address (lowercase). */
  token0?: string;

  /** token1 address (lowercase). */
  token1?: string;

  /** Unix timestamp (seconds) when this profile was fetched. */
  snapshotAt?: number;

  /** Granular failure classification. */
  failureKind?: 'provider_unavailable' | 'pool_not_found' | 'field_unavailable' | 'api_error';

  /** Human-readable explanation when status is 'unavailable'. */
  reason?: string;

  /** Data provenance identifier. */
  provenance: 'uniswap-v3';
}

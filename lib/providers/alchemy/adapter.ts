/**
 * Alchemy → Canonical V2 Pool State Adapter
 *
 * Transforms raw Alchemy JSON-RPC responses (ABI-encoded eth_call results for
 * Uniswap V2 / PancakeSwap V2 getReserves()) into the canonical
 * CanonicalV2PoolState shape.
 *
 * PURE TRANSFORMATION — no HTTP calls.
 * All network I/O is handled by lib/providers/alchemy/client.ts.
 * This adapter only decodes and normalizes already-fetched RPC data.
 *
 * SERVER-SIDE ONLY.
 * Must never be imported by React components or client-side modules.
 *
 * ABI DECODING:
 *   Uses the existing ethers v6 dependency (already present in package.json).
 *   Specifically uses ethers.AbiCoder.defaultAbiCoder() to decode the
 *   eth_call result for:
 *     function getReserves() external view returns (
 *       uint112 reserve0,
 *       uint112 reserve1,
 *       uint32  blockTimestampLast
 *     )
 *
 * FAILURE CLASSIFICATION:
 *   The adapter distinguishes four failure states:
 *     'provider_unavailable' — input was null/undefined (RPC not reached)
 *     'pool_not_found'       — result was '0x' or empty (no contract at address)
 *     'decode_error'         — hex present but ABI decoding failed
 *     'rpc_error'            — unexpected / unhandled response shape
 */

import { AbiCoder } from 'ethers';
import type { CanonicalV2PoolState } from '../adapter-types';

// ─────────────────────────────────────────────────────────────────────────────
// ABI definition for Uniswap V2 / PancakeSwap V2 getReserves()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ABI parameter types for decoding getReserves() return value.
 * Return tuple: (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)
 */
const GET_RESERVES_RETURN_TYPES = ['uint112', 'uint112', 'uint32'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Shared AbiCoder instance — ethers v6 singleton. */
const abiCoder = AbiCoder.defaultAbiCoder();

/**
 * Return true if the hex string represents an empty or zero-length response.
 * Indicates the pool address has no contract deployed (pool not found).
 */
function isEmptyHex(hex: string): boolean {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  return stripped.length === 0 || /^0+$/.test(stripped);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public adapter options
// ─────────────────────────────────────────────────────────────────────────────

export interface AdaptAlchemyV2ReservesOpts {
  /** EVM pool contract address (lowercase). */
  poolAddress: string;
  /** Block number at which the eth_call was made (optional). */
  snapshotBlock?: number;
  /** Unix timestamp (seconds) when the RPC call was made — set by caller. */
  snapshotAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decode a raw Alchemy eth_call result for getReserves() into a canonical
 * CanonicalV2PoolState.
 *
 * @param raw   - The hex string returned by the eth_call RPC (Alchemy result field).
 *                Pass null/undefined to produce failureKind='provider_unavailable'.
 * @param opts  - Pool address, optional block number, and snapshot timestamp.
 * @returns     Canonical CanonicalV2PoolState — never throws.
 *
 * CALLER CONTRACT:
 *   1. Execute the eth_call via lib/providers/alchemy/client.ts:
 *        const hex = await queryAlchemyRpc('eth_call', [{
 *          to: poolAddress,
 *          data: '0x0902f1ac', // getReserves() selector
 *        }, 'latest']);
 *   2. Pass the hex result string directly to this function.
 *   3. Set snapshotAt to Math.floor(Date.now() / 1000) at call time.
 *   4. Obtain snapshotBlock from a prior eth_blockNumber call if needed.
 *
 * RESERVE ORDERING:
 *   tokenReserve = reserve0 (first ABI tuple element)
 *   quoteReserve = reserve1 (second ABI tuple element)
 *   The caller must know which reserve is the base vs quote token.
 *   This adapter preserves the raw contract ordering.
 *
 * DATA PROVENANCE:
 *   Both reserves are 'observed' on-chain values — not derived from
 *   liquidityUsd or spot price.  Callers feeding these into
 *   NormalizedPoolState should set tokenReserveProvenance = 'observed'.
 */
export function adaptAlchemyV2Reserves(
  raw: unknown,
  opts: AdaptAlchemyV2ReservesOpts
): CanonicalV2PoolState {
  const poolAddress = (opts.poolAddress ?? '').toLowerCase();

  // ── Guard: null / undefined — provider did not return a result ──
  if (raw === null || raw === undefined) {
    return {
      status: 'unavailable',
      poolAddress,
      failureKind: 'provider_unavailable',
      reason: 'Alchemy RPC returned null or undefined (provider not reached or not configured).',
      snapshotBlock: opts.snapshotBlock,
      snapshotAt: opts.snapshotAt,
      provenance: 'alchemy-v2',
    };
  }

  // ── Guard: must be a non-empty string ──
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {
      status: 'unavailable',
      poolAddress,
      failureKind: 'rpc_error',
      reason: `Alchemy eth_call result has unexpected type: ${typeof raw}. Expected hex string.`,
      snapshotBlock: opts.snapshotBlock,
      snapshotAt: opts.snapshotAt,
      provenance: 'alchemy-v2',
    };
  }

  const hex = raw.trim();

  // ── Guard: empty result → no contract at pool address ──
  if (isEmptyHex(hex)) {
    return {
      status: 'unavailable',
      poolAddress,
      failureKind: 'pool_not_found',
      reason: `Alchemy returned empty data for pool ${poolAddress}. No contract deployed at this address.`,
      snapshotBlock: opts.snapshotBlock,
      snapshotAt: opts.snapshotAt,
      provenance: 'alchemy-v2',
    };
  }

  // ── Decode ABI-encoded tuple ──
  let decoded: any[];
  try {
    decoded = abiCoder.decode([...GET_RESERVES_RETURN_TYPES], hex) as any[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'unavailable',
      poolAddress,
      failureKind: 'decode_error',
      reason: `ABI decoding of getReserves() result failed: ${message}`,
      snapshotBlock: opts.snapshotBlock,
      snapshotAt: opts.snapshotAt,
      provenance: 'alchemy-v2',
    };
  }

  // ── Extract and validate decoded values ──
  // ethers v6 AbiCoder returns BigInt for uint types
  const reserve0 = decoded[0];
  const reserve1 = decoded[1];
  const blockTimestampLast = decoded[2];

  if (typeof reserve0 !== 'bigint' || typeof reserve1 !== 'bigint') {
    return {
      status: 'unavailable',
      poolAddress,
      failureKind: 'decode_error',
      reason: 'Decoded reserves are not BigInt — unexpected ABI output format.',
      snapshotBlock: opts.snapshotBlock,
      snapshotAt: opts.snapshotAt,
      provenance: 'alchemy-v2',
    };
  }

  // ── Success ──
  return {
    status: 'available',
    poolAddress,
    tokenReserve: reserve0,
    quoteReserve: reserve1,
    blockTimestampLast:
      typeof blockTimestampLast === 'bigint'
        ? Number(blockTimestampLast)
        : typeof blockTimestampLast === 'number'
        ? blockTimestampLast
        : undefined,
    snapshotBlock: opts.snapshotBlock,
    snapshotAt: opts.snapshotAt,
    provenance: 'alchemy-v2',
  };
}

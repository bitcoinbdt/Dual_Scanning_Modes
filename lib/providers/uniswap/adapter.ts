/**
 * Uniswap V3 → Canonical CLMM Profile Adapter
 *
 * Transforms raw Uniswap V3 pool state responses into the canonical
 * CanonicalClmmProfile shape.
 *
 * PURE TRANSFORMATION — no HTTP calls.
 * All network I/O is handled by lib/providers/uniswap/client.ts.
 * This adapter only parses and normalizes already-fetched provider data.
 *
 * SERVER-SIDE ONLY.
 * Must never be imported by React components or client-side modules.
 *
 * PROVIDER REALITY:
 *   The current lib/providers/uniswap/client.ts uses the Uniswap REST API
 *   (api.uniswap.org/v1).  The Uniswap REST API does NOT expose raw slot0()
 *   data (sqrtPriceX96, currentTick, liquidity) in a standardised endpoint.
 *   These fields are on-chain state from the V3 pool contract.
 *
 *   If the caller fetches pool state via an on-chain eth_call (e.g. through
 *   Alchemy), the raw response will be an ABI-decoded object.  If the caller
 *   uses the Uniswap REST API, the response shape will differ.
 *
 *   This adapter supports two input modes:
 *
 *   Mode A — On-chain decoded object (preferred, from eth_call slot0()):
 *     {
 *       sqrtPriceX96: "79228162514264337593543950336",  // string or bigint
 *       tick: 197823,
 *       observationIndex: 0,
 *       liquidity: "1234567890",                       // string or bigint
 *       fee: 3000,
 *       token0: "0xc02a...",
 *       token1: "0xa0b8...",
 *       tickSpacing: 60
 *     }
 *
 *   Mode B — Uniswap REST API pool object (partial):
 *     If the REST API returns a subset of these fields, the adapter will
 *     produce status='unavailable' with failureKind='field_unavailable'
 *     for any missing required fields.
 *
 * DO NOT FABRICATE:
 *   sqrtPriceX96, liquidity, currentTick, and tickSpacing must only be
 *   populated if the provider explicitly returned them.  Default values
 *   must NEVER be used for these fields — fabricated CLMM state can
 *   silently break risk calculations.
 *
 * CLMM NOTE:
 *   The AmmSlippageSimulator currently returns 'insufficient_data' for
 *   concentrated-liquidity pools.  This adapter establishes the clean
 *   boundary for future CLMM simulation integration without fabricating
 *   data in the interim.
 *
 * FAILURE TAXONOMY:
 *   'provider_unavailable' — raw input was null/undefined
 *   'pool_not_found'       — response indicated no pool at the address
 *   'field_unavailable'    — response received but required fields missing
 *   'api_error'            — response shape is entirely unexpected
 */

import type { CanonicalClmmProfile } from '../adapter-types';

// ─────────────────────────────────────────────────────────────────────────────
// Raw input shape (internal — not exported)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expected shape of a decoded Uniswap V3 pool state object.
 * Fields may arrive as strings (from JSON) or as bigints (from ABI decoding).
 */
interface RawV3PoolState {
  sqrtPriceX96?: string | bigint | null;
  tick?: number | string | null;
  liquidity?: string | bigint | null;
  fee?: number | string | null;
  tickSpacing?: number | string | null;
  token0?: string | null;
  token1?: string | null;
  observationIndex?: number | string | null;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse sqrtPriceX96 or liquidity — may arrive as string or bigint.
 * Returns undefined if the value is absent, empty, or non-numeric.
 * Never returns 0n as a fallback for missing data.
 */
function parseBigIntField(raw: string | bigint | null | undefined): bigint | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'bigint') return raw;
  const str = String(raw).trim();
  if (str === '' || str === '0x') return undefined;
  try {
    return BigInt(str);
  } catch {
    return undefined;
  }
}

/**
 * Parse a numeric field that may arrive as number or string.
 * Returns undefined if the value is absent or non-finite.
 */
function parseNumberField(raw: number | string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/**
 * Normalize an address to lowercase, returning undefined for falsy input.
 */
function normalizeAddr(raw: string | null | undefined): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const t = raw.trim().toLowerCase();
  return t.length > 0 ? t : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public adapter options
// ─────────────────────────────────────────────────────────────────────────────

export interface AdaptUniswapV3PoolStateOpts {
  /** Pool contract address (will be lowercased). */
  poolAddress: string;
  /** Unix timestamp (seconds) when the data was fetched — set by caller. */
  snapshotAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform a raw Uniswap V3 pool state response into a canonical
 * CanonicalClmmProfile.
 *
 * @param raw   - The pool state object from the provider.
 *                Pass null/undefined to produce failureKind='provider_unavailable'.
 * @param opts  - Pool address and snapshot timestamp.
 * @returns     Canonical CanonicalClmmProfile — never throws.
 *
 * REQUIRED FIELDS for status='available':
 *   sqrtPriceX96, currentTick, liquidity — all three must be present and
 *   parseable.  If any is missing, status='unavailable' with
 *   failureKind='field_unavailable' is returned.
 *
 * OPTIONAL FIELDS (populated when present, left undefined when absent):
 *   tickSpacing, feeTier, token0, token1
 *
 * CALLER CONTRACT:
 *   For on-chain slot0() data via Alchemy:
 *     const raw = await queryAlchemyRpc('eth_call', [{ to: poolAddress,
 *       data: '0x3850c7bd' }, 'latest']); // slot0() selector
 *     // ABI-decode the result before passing here.
 *   For Uniswap REST API pool data:
 *     const raw = await queryUniswap(`/pools/${poolAddress}`);
 *     // Pass the pool object directly.
 */
export function adaptUniswapV3PoolState(
  raw: unknown,
  opts: AdaptUniswapV3PoolStateOpts
): CanonicalClmmProfile {
  const poolAddress = (opts.poolAddress ?? '').toLowerCase().trim();

  // ── Guard: null / undefined — provider did not return data ──
  if (raw === null || raw === undefined) {
    return {
      status: 'unavailable',
      poolAddress,
      failureKind: 'provider_unavailable',
      reason: 'Uniswap provider returned null or undefined (not configured or unreachable).',
      snapshotAt: opts.snapshotAt,
      provenance: 'uniswap-v3',
    };
  }

  // ── Guard: must be a plain object ──
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      status: 'unavailable',
      poolAddress,
      failureKind: 'api_error',
      reason: `Uniswap pool state has unexpected shape: ${Array.isArray(raw) ? 'array' : typeof raw}. Expected object.`,
      snapshotAt: opts.snapshotAt,
      provenance: 'uniswap-v3',
    };
  }

  const state = raw as RawV3PoolState;

  // ── Guard: empty object — likely pool not found ──
  if (Object.keys(state).length === 0) {
    return {
      status: 'unavailable',
      poolAddress,
      failureKind: 'pool_not_found',
      reason: `Uniswap returned an empty object for pool ${poolAddress}. Pool may not exist on this network.`,
      snapshotAt: opts.snapshotAt,
      provenance: 'uniswap-v3',
    };
  }

  // ── Parse all fields ──
  const sqrtPriceX96 = parseBigIntField(state.sqrtPriceX96);
  const liquidity    = parseBigIntField(state.liquidity);
  const currentTick  = parseNumberField(state.tick);
  const tickSpacing  = parseNumberField(state.tickSpacing);
  const feeTier      = parseNumberField(state.fee);
  const token0       = normalizeAddr(state.token0);
  const token1       = normalizeAddr(state.token1);

  // ── Validate required fields ──
  const missingFields: string[] = [];
  if (sqrtPriceX96 === undefined) missingFields.push('sqrtPriceX96');
  if (liquidity === undefined)    missingFields.push('liquidity');
  if (currentTick === undefined)  missingFields.push('tick');

  if (missingFields.length > 0) {
    return {
      status: 'unavailable',
      poolAddress,
      failureKind: 'field_unavailable',
      reason:
        `Uniswap pool state is missing required CLMM fields: [${missingFields.join(', ')}]. ` +
        'The Uniswap REST API may not expose on-chain slot0() data. ' +
        'Use an on-chain RPC call (e.g. via Alchemy) to retrieve sqrtPriceX96, liquidity, and tick.',
      // Include any optional fields that were successfully parsed
      tickSpacing,
      feeTier,
      token0,
      token1,
      snapshotAt: opts.snapshotAt,
      provenance: 'uniswap-v3',
    };
  }

  // ── Full success ──
  return {
    status: 'available',
    poolAddress,
    sqrtPriceX96,
    currentTick,
    liquidity,
    tickSpacing,
    feeTier,
    token0,
    token1,
    snapshotAt: opts.snapshotAt,
    provenance: 'uniswap-v3',
  };
}

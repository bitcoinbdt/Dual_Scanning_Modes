/**
 * Liquidity Fragmentation Analyzer — Phase 4
 *
 * Measures how token liquidity is distributed across multiple AMM pools using
 * the Herfindahl–Hirschman Index (HHI). A high HHI means a single pool
 * dominates, creating a single point of failure. A low HHI means liquidity is
 * spread across several pools, which can cause slippage estimates to be
 * pool-specific rather than aggregate.
 *
 * IMPORTANT:
 *   - Input is the already-enriched pool array from DeepScanService.
 *     This engine does NOT call any providers.
 *   - Pools with liquidityUsd <= 0 are excluded from the HHI calculation.
 *   - Only the pool identifier (pair address / label) and liquidity USD are consumed.
 */

import { LiquidityFragmentationResult, PoolLiquidityShare, ModuleStatus, normalizeAddress } from '../types';
import { LiquidityPool } from '../../blockchain/types';
import { NormalizedPoolState } from '../../blockchain/types';

function round(n: number, dp = 4): number {
  const factor = Math.pow(10, dp);
  return Math.round(n * factor) / factor;
}

/**
 * Analyze liquidity fragmentation across multiple AMM pools.
 *
 * @param pools - Enriched pool states from the Deep Scan data layer.
 *                Accepts both NormalizedPoolState (Alchemy-enriched) and
 *                LiquidityPool (Basic Scan format).
 */
export function analyzeLiquidityFragmentation(
  pools: (NormalizedPoolState | LiquidityPool)[]
): LiquidityFragmentationResult {
  // ── Insufficient data guard ──
  if (!pools || pools.length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'No pool data available for fragmentation analysis.',
      poolHHI: 0,
      concentrationLevel: 'low',
      totalLiquidityUsd: 0,
      poolCount: 0,
      pools: [],
      isDominantPool: false,
      evidenceIds: [],
    };
  }

  // ── Extract pool identifier and liquidity from either pool type ──
  interface PoolEntry { id: string; liquidityUsd: number; }
  const entries: PoolEntry[] = [];
  const seenPools = new Set<string>();

  for (const pool of pools) {
    // NormalizedPoolState uses poolIdentifier; LiquidityPool uses pair
    const idRaw = ('poolIdentifier' in pool ? pool.poolIdentifier : pool.pair) ?? 'unknown';
    // Normalize consistently before comparison
    const idNormalized = normalizeAddress(idRaw);

    // Deduplicate by normalized pool identity: keep the first defined instance
    // (Deterministic First-Seen Handling: if the input contains duplicate pool addresses
    // with different liquidity values, we preserve the first encountered instance).
    if (seenPools.has(idNormalized)) {
      continue;
    }

    // Both types expose liquidityUsd
    const liq = pool.liquidityUsd ?? 0;
    if (liq > 0) {
      seenPools.add(idNormalized);
      entries.push({ id: idRaw, liquidityUsd: liq });
    }
  }

  if (entries.length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'All pools reported zero or missing liquidity — cannot compute fragmentation.',
      poolHHI: 0,
      concentrationLevel: 'low',
      totalLiquidityUsd: 0,
      poolCount: 0,
      pools: [],
      isDominantPool: false,
      evidenceIds: [],
    };
  }

  // ── Compute total liquidity and per-pool shares ──
  const totalLiquidityUsd = entries.reduce((sum, e) => sum + e.liquidityUsd, 0);

  const poolShares: PoolLiquidityShare[] = entries.map((e) => ({
    poolId: e.id,
    liquidityUsd: round(e.liquidityUsd, 2),
    share: round(e.liquidityUsd / totalLiquidityUsd, 6),
  }));

  // Sort descending by share for readability
  poolShares.sort((a, b) => b.share - a.share);

  // ── HHI = sum of squared market shares ──
  // Range: 1/N (perfectly equal) to 1.0 (monopoly)
  const poolHHI = round(
    poolShares.reduce((sum, p) => sum + p.share * p.share, 0),
    6
  );

  // ── Concentration classification ──
  // Thresholds are calibrated for pool-level (not wallet-level) HHI:
  //   < 0.25  → low          (3+ roughly equal pools)
  //   0.25–0.50 → moderate   (2–3 pools, one dominant)
  //   0.50–0.80 → high       (1 pool clearly dominant, 1–2 minor)
  //   > 0.80  → monopoly     (single pool holds ≥80% of liquidity)
  let concentrationLevel: 'low' | 'moderate' | 'high' | 'monopoly';
  if (poolHHI > 0.80) {
    concentrationLevel = 'monopoly';
  } else if (poolHHI > 0.50) {
    concentrationLevel = 'high';
  } else if (poolHHI > 0.25) {
    concentrationLevel = 'moderate';
  } else {
    concentrationLevel = 'low';
  }

  // ── Dominant pool signal ──
  // True when the single largest pool holds ≥80% of total liquidity.
  const isDominantPool = poolShares.length > 0 && poolShares[0].share >= 0.80;

  return {
    status: 'ok',
    poolHHI,
    concentrationLevel,
    totalLiquidityUsd: round(totalLiquidityUsd, 2),
    poolCount: poolShares.length,
    pools: poolShares,
    isDominantPool,
    evidenceIds: ['pool-liquidity-fragmentation'],
  };
}

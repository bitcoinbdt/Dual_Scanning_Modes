/**
 * AMM Slippage Simulator — Module 3
 *
 * Simulates constant-product (Uniswap V2 / PancakeSwap V2 style) execution impact
 * for custom position sizes using pool state data.
 *
 * POOL TYPE GATE:
 *   The constant-product formula (x*y=k) is ONLY valid for balanced 50/50 pools
 *   where both reserves are equal at spot price. Applying it to concentrated-
 *   liquidity pools (V3/CLMM such as Uniswap V3, Raydium CLMM, Orca Whirlpools,
 *   Meteora DLMM) produces grossly inaccurate impact estimates because those pools
 *   deploy liquidity non-uniformly across price ticks.
 *
 *   This simulator therefore:
 *     - Runs the V2 constant-product model ONLY for pools typed 'constant-product'.
 *     - Returns an explicit 'insufficient_data' status for 'concentrated-liquidity' pools.
 *     - For 'unknown' pool types: runs V2 model but surfaces a low-confidence warning.
 *     - Never fabricates reserves for a pool it cannot safely model.
 *
 * FEE HANDLING:
 *   If the pool fee is explicitly known (fee.known === true), the observed fee rate
 *   is used for the simulation, and the simulation result records the fee source.
 *
 *   If the fee is unknown (fee.known === false) and the pool is 'constant-product',
 *   the simulator applies the canonical 0.3% V2 default and surfaces this as an
 *   assumption in the result reason.
 *
 *   If the fee is unknown and the pool is 'unknown' type, the simulator applies the
 *   same 0.3% default but records BOTH caveats (unknown type + unknown fee).
 *
 *   This design avoids silent fabrication: every fee assumption is documented in
 *   the result and surfaced to the caller.
 *
 * RESERVE DERIVATION & OBSERVATION:
 *   By default, virtual reserves are DERIVED from liquidityUsd and spotPriceUsd
 *   using the balanced 50/50 assumption:
 *     token_reserve  = L / 2 / P
 *     quote_reserve  = L / 2
 *   This is recorded as 'derived' provenance.
 *
 *   If direct on-chain reserves are available (e.g. via Alchemy RPC), the simulator
 *   uses the observed tokenReserveRaw and derived quoteReserveRaw directly,
 *   recording provenance as 'observed'.
 *
 * V2 Formula:
 *   k = token_reserve * quote_reserve
 *   For selling `tokens_in` tokens with fee f:
 *     tokens_in_adj    = tokens_in * (1 - f)
 *     new_tok_reserve  = token_reserve + tokens_in_adj
 *     quote_out        = quote_reserve - k / new_tok_reserve
 *     execution_price  = quote_out / tokens_in     (USD received per token)
 *     price_impact_pct = (P - execution_price) / P * 100
 *
 * CLMM FUTURE EXTENSION POINT:
 *   A future CLMM simulator would require per-tick liquidity data:
 *     - currentTick          : active price tick at query time
 *     - sqrtPriceX96         : current sqrt price in Q64.96 format
 *     - tickSpacing          : the pool's configured tick spacing
 *     - ticks[]              : array of { tickIndex, liquidityNet } from the pool contract
 *     - feeTier              : e.g. 500, 3000, 10000 (bps * 100)
 *   None of this data is currently available in the codebase. Until a tick-array
 *   provider is integrated, concentrated-liquidity pools must remain unsupported.
 *
 * This is a pure calculation function — no HTTP calls.
 */

import {
  AmmSlippageResult,
  PositionSizeResult,
  RiskLevel,
  ModuleStatus,
} from '../types';
import {
  LiquidityPool,
  NormalizedPoolState,
  toNormalizedPoolState,
} from '../../blockchain/types';
import { DEEP_SCAN_CONFIG } from '../config';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_POSITION_SIZES_USD = DEEP_SCAN_CONFIG.amm.defaultPositionSizesUsd;

/**
 * Canonical V2 constant-product default fee (0.3%).
 * Applied ONLY when pool fee is unknown AND pool type is constant-product or unknown.
 * The fact that this default is applied is always surfaced in the result.
 */
const V2_DEFAULT_SWAP_FEE = DEEP_SCAN_CONFIG.amm.defaultSwapFee;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function classifyExitRisk(priceImpactPct: number): RiskLevel {
  const limits = DEEP_SCAN_CONFIG.amm.priceImpactRisk;
  if (priceImpactPct < limits.low) return 'low';
  if (priceImpactPct < limits.medium) return 'medium';
  if (priceImpactPct < limits.high) return 'high';
  return 'critical';
}

function round(n: number, dp = 4): number {
  const factor = Math.pow(10, dp);
  return Math.round(n * factor) / factor;
}

/**
 * Select the best pool from the available list.
 *
 * Priority: constant-product > unknown > concentrated-liquidity.
 * The V2 model cannot run on CLMM pools; we prefer a V2 pool even if it is
 * smaller than a CLMM pool because the math is valid for it.
 */
function selectPool(pools: NormalizedPoolState[]): NormalizedPoolState | null {
  if (!pools || pools.length === 0) return null;

  const sorted = [...pools].sort((a, b) => b.liquidityUsd - a.liquidityUsd);

  // Prefer the largest constant-product pool
  const cpPool = sorted.find(p => p.poolType === 'constant-product');
  if (cpPool) return cpPool;

  // Fall back to largest unknown pool (may or may not be constant-product)
  const unknownPool = sorted.find(p => p.poolType === 'unknown');
  if (unknownPool) return unknownPool;

  // Only concentrated-liquidity pools remain — we will return them to expose the correct refusal
  return sorted[0];
}

/**
 * Resolve the swap fee for a selected pool.
 *
 * Returns:
 *   { feeRate, feeSummary } where feeSummary is appended to the reason string
 *   to surface any assumptions made.
 *
 * For 'concentrated-liquidity' pools this is not called (they are refused before
 * fee resolution). For 'unknown' types with unknown fee, we apply V2 default and
 * record the compound warning.
 */
function resolveSwapFee(pool: NormalizedPoolState): {
  feeRate: number;
  feeKnown: boolean;
  feeWarning?: string;
} {
  if (pool.fee.known) {
    return { feeRate: pool.fee.feeRate, feeKnown: true };
  }

  // Fee is unknown — apply V2 default and document the assumption
  const baseWarning =
    `Swap fee is unknown for this pool. Applying V2 canonical default (${(V2_DEFAULT_SWAP_FEE * 100).toFixed(1)}%). ` +
    'Results may be inaccurate for non-standard fee pools.';

  return {
    feeRate: V2_DEFAULT_SWAP_FEE,
    feeKnown: false,
    feeWarning: baseWarning,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — accepts both legacy LiquidityPool[] and NormalizedPoolState[]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate AMM slippage for all position sizes.
 *
 * Accepts:
 *   - NormalizedPoolState[] (preferred — carries provenance and fee info)
 *   - LiquidityPool[] (legacy — converted internally via toNormalizedPoolState)
 *
 * @param pools            - Pool list (normalized or legacy)
 * @param spotPriceUsd     - Current spot price (USD per token)
 * @param positionSizesUsd - Array of USD trade sizes to simulate
 */
export function simulateAmmSlippage(
  pools: (NormalizedPoolState | LiquidityPool)[],
  spotPriceUsd: number,
  positionSizesUsd: number[] = DEFAULT_POSITION_SIZES_USD
): AmmSlippageResult {
  // ── Normalize to NormalizedPoolState[] ──
  const normalizedPools: NormalizedPoolState[] = pools.map(p =>
    'poolType' in p ? p : toNormalizedPoolState(p)
  );

  // ── Validation: input presence ──
  if (!normalizedPools || normalizedPools.length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'No pool data available for AMM simulation.',
      simulations: [],
      isThinLiquidity: false,
      evidenceIds: [],
    };
  }

  if (!Number.isFinite(spotPriceUsd) || spotPriceUsd <= 0) {
    return {
      status: 'insufficient_data',
      reason: 'Spot price is zero, NaN, or unavailable — cannot run AMM simulation.',
      simulations: [],
      isThinLiquidity: false,
      evidenceIds: [],
    };
  }

  // ── Select the best pool eligible for simulation ──
  const selectedPool = selectPool(normalizedPools);
  if (!selectedPool) {
    return {
      status: 'insufficient_data',
      reason: 'No usable pool found in the provided pool list.',
      simulations: [],
      isThinLiquidity: false,
      evidenceIds: [],
    };
  }

  const poolType = selectedPool.poolType;

  // ── Pool type gate ──
  // Do not apply the V2 constant-product model to CLMM pools.
  if (poolType === 'concentrated-liquidity') {
    return {
      status: 'insufficient_data',
      reason:
        'The primary pool uses concentrated liquidity (V3/CLMM). ' +
        'The constant-product x*y=k model is not applicable to this pool type. ' +
        'CLMM slippage simulation requires per-tick liquidity data (sqrtPriceX96, ' +
        'tickSpacing, liquidityNet per tick) which is not yet available in this system.',
      poolAddress: selectedPool.poolIdentifier,
      poolModel: 'concentrated-liquidity',
      simulations: [],
      isThinLiquidity: false,
      evidenceIds: [],
    };
  }

  // ── Fee resolution ──
  const { feeRate, feeKnown, feeWarning } = resolveSwapFee(selectedPool);

  // ── Build reason prefix from pool type and fee assumptions ──
  const warningParts: string[] = [];
  if (poolType === 'unknown') {
    warningParts.push(
      'Pool type could not be determined from provider metadata. ' +
      'Applying V2 constant-product model as a conservative approximation. ' +
      'Results may be inaccurate if this is a concentrated-liquidity pool.'
    );
  }
  if (feeWarning) {
    warningParts.push(feeWarning);
  }
  const contextWarning = warningParts.length > 0 ? warningParts.join(' ') : undefined;

  // ── Liquidity validation ──
  if (!Number.isFinite(selectedPool.liquidityUsd) || selectedPool.liquidityUsd <= 0) {
    return {
      status: 'insufficient_data',
      reason: 'Primary pool has zero or invalid liquidity.',
      poolAddress: selectedPool.poolIdentifier,
      poolModel: poolType,
      simulations: [],
      isThinLiquidity: true,
      evidenceIds: [],
    };
  }

  const poolLiquidityUsd = selectedPool.liquidityUsd;

  // ── Derive or use observed reserves ──
  // Prefer observed reserves if both are present. Otherwise, fall back to derived.
  const usingObservedReserves =
    selectedPool.tokenReserveRaw !== undefined &&
    selectedPool.quoteReserveRaw !== undefined;

  const tokenReserve = usingObservedReserves
    ? selectedPool.tokenReserveRaw!
    : poolLiquidityUsd / 2 / spotPriceUsd;
  const quoteReserve = usingObservedReserves
    ? selectedPool.quoteReserveRaw!
    : poolLiquidityUsd / 2;
  const reserveProvenance = usingObservedReserves ? 'observed' : 'derived';
  const k = tokenReserve * quoteReserve;

  const simulations: PositionSizeResult[] = [];

  for (const posUsd of positionSizesUsd) {
    if (posUsd <= 0) continue;

    // Tokens we are selling
    const tokensIn = posUsd / spotPriceUsd;
    const tokensInAdj = tokensIn * (1 - feeRate);
    const newTokenReserve = tokenReserve + tokensInAdj;

    // Would this size exceed the pool's total quote asset reserve?
    if (posUsd >= quoteReserve) {
      simulations.push({
        positionSizeUsd: posUsd,
        priceImpactPct: 100,
        slippagePct: 100,
        executionPriceUsd: 0,
        spotPriceUsd,
        tokensInvolved: tokensIn,
        poolLiquidityUsd,
        exitRiskLevel: 'critical',
        swapFee: feeRate,
        swapFeeKnown: feeKnown,
        reserveProvenance,
        status: 'insufficient_data',
        reason: `Position size ($${posUsd.toLocaleString()}) exceeds pool quote reserve ($${quoteReserve.toLocaleString()}).`,
      });
      continue;
    }

    // Would this drain the pool?
    if (newTokenReserve <= 0 || k / newTokenReserve >= quoteReserve) {
      simulations.push({
        positionSizeUsd: posUsd,
        priceImpactPct: 0,
        slippagePct: 0,
        executionPriceUsd: 0,
        spotPriceUsd,
        tokensInvolved: tokensIn,
        poolLiquidityUsd,
        exitRiskLevel: 'critical',
        swapFee: feeRate,
        swapFeeKnown: feeKnown,
        reserveProvenance,
        status: 'insufficient_data',
        reason: `Position size ($${posUsd.toLocaleString()}) exceeds available pool liquidity ($${poolLiquidityUsd.toLocaleString()}).`,
      });
      continue;
    }

    const quoteOut = quoteReserve - k / newTokenReserve;

    if (quoteOut <= 0) {
      simulations.push({
        positionSizeUsd: posUsd,
        priceImpactPct: 0,
        slippagePct: 0,
        executionPriceUsd: 0,
        spotPriceUsd,
        tokensInvolved: tokensIn,
        poolLiquidityUsd,
        exitRiskLevel: 'critical',
        swapFee: feeRate,
        swapFeeKnown: feeKnown,
        reserveProvenance,
        status: 'insufficient_data',
        reason: 'Calculated quote output is zero or negative.',
      });
      continue;
    }

    // USD received per token (effective execution price)
    const executionPriceUsd = quoteOut / tokensIn;
    const priceImpactPct = round((spotPriceUsd - executionPriceUsd) / spotPriceUsd * 100);
    const slippagePct = priceImpactPct; // Same for constant-product

    simulations.push({
      positionSizeUsd: posUsd,
      priceImpactPct: Math.max(0, priceImpactPct),
      slippagePct: Math.max(0, slippagePct),
      executionPriceUsd: round(executionPriceUsd, 6),
      spotPriceUsd: round(spotPriceUsd, 6),
      tokensInvolved: round(tokensIn, 4),
      poolLiquidityUsd: round(poolLiquidityUsd, 2),
      exitRiskLevel: classifyExitRisk(priceImpactPct),
      swapFee: feeRate,
      swapFeeKnown: feeKnown,
      reserveProvenance,
      status: 'ok',
    });
  }

  // ── Thin liquidity signal ──
  const sim1k = simulations.find((s) => s.positionSizeUsd === 1_000 && s.status === 'ok');
  const isThinLiquidity = !sim1k || sim1k.priceImpactPct > 2;

  // ── Minimum viable liquidity (last position with <10% impact) ──
  const okSims = simulations.filter((s) => s.status === 'ok' && s.priceImpactPct < 10);
  const minimumViableLiquidityUsd = okSims.length > 0
    ? okSims[okSims.length - 1].positionSizeUsd
    : undefined;

  const anyOk = simulations.some((s) => s.status === 'ok');

  return {
    status: anyOk ? 'ok' : 'insufficient_data',
    reason: !anyOk
      ? (contextWarning ?? 'All simulated position sizes exceed available pool liquidity.')
      : contextWarning,
    poolAddress: selectedPool.poolIdentifier,
    poolSnapshotAt: selectedPool.snapshotAt ?? Math.floor(Date.now() / 1000),
    poolModel: poolType,
    spotPriceUsd: round(spotPriceUsd, 6),
    poolLiquidityUsd: round(poolLiquidityUsd, 2),
    swapFeeUsed: feeRate,
    swapFeeKnown: feeKnown,
    reserveProvenance,
    simulations,
    minimumViableLiquidityUsd,
    isThinLiquidity,
    evidenceIds: [],
  };
}

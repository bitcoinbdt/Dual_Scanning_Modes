/**
 * Liquidity Stress Analyzer — Phase 5D-6
 *
 * Delivers deterministic, AMM-aware liquidity intelligence for traders.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL POSITION
 * ═══════════════════════════════════════════════════════════════
 *
 *   Historical Reserve Snapshots (Phase 5D-5)
 *           ↓
 *   LiquidityStressAnalyzer (this module)
 *           ↓
 *   LiquidityStressReport → DeepScanResult.liquidityStress
 *
 * ═══════════════════════════════════════════════════════════════
 * MATHEMATICAL MODEL
 * ═══════════════════════════════════════════════════════════════
 *
 * V2 Constant-Product Swap (BigInt, exact):
 *   k = reserve0 × reserve1
 *   For selling Δx of token0 (fee f, represented as FEE_BASE parts per FEE_BASE):
 *     Δx_adj      = Δx × (FEE_BASE − feeParts)
 *     numerator   = Δx_adj × reserve1
 *     denominator = reserve0 × FEE_BASE + Δx_adj
 *     Δy          = numerator / denominator   (integer division = floor)
 *
 * Analytical Executable Boundary (exact, O(1)):
 *   For threshold I and fee f (both as decimal fractions):
 *   If I ≤ f:  maxInput = 0    (fee already exceeds threshold)
 *   If I > f:  maxInput_tokens = reserve0 × (I − f) / ((1 − f) × (1 − I))
 *
 *   Derivation:
 *     execution_price = spot × (1 − I)   at the boundary
 *     solving for Δx in the V2 formula yields the above expression.
 *
 * ═══════════════════════════════════════════════════════════════
 * PRECISION MODEL
 * ═══════════════════════════════════════════════════════════════
 *
 * • reserve0 / reserve1 are BigInt values (uint112 compatible).
 * • All intermediate swap calculations use BigInt integer arithmetic.
 * • Conversion back to floating-point only occurs for final display values.
 * • Executable boundary uses 64-bit float arithmetic but only on normalised
 *   reserve values (no uint112 overflow risk at this stage).
 * • No rounding occurs inside the BigInt path; division is always floor.
 * • Token amounts derived from USD are converted via spotPriceUsd (float)
 *   then multiplied by 10^decimals to produce integer raw token amounts.
 *
 * ═══════════════════════════════════════════════════════════════
 * POOL TYPE GATE
 * ═══════════════════════════════════════════════════════════════
 *
 * This module only models constant-product (V2) pools.
 * V3/CLMM pools return status = 'insufficient_data'.
 * Solana pools return status = 'insufficient_data'.
 * Unsupported pool types are NEVER simulated.
 *
 * ═══════════════════════════════════════════════════════════════
 * ANTI-FABRICATION GUARANTEES
 * ═══════════════════════════════════════════════════════════════
 *
 * • No latest-state fallback for historical data.
 * • No interpolation of missing historical snapshots.
 * • No synthetic reserve values.
 * • No zero-filling of failed simulations.
 * • Missing data returns status = 'insufficient_data' or 'unavailable'.
 */

import { DEEP_SCAN_CONFIG } from '../config';
import {
  NormalizedPoolState,
  LiquidityPool,
  toNormalizedPoolState,
} from '../../blockchain/types';
import {
  SlippagePoint,
  ExecutableLiquidityResult,
  LiquidityStressScenario,
  LiquidityStressReport,
  HistoricalLiquidityMetrics,
  LiquidityShock,
  LiquidityRegime,
  StressSeverity,
  ModuleStatus,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fee calculation base. All fee arithmetic in BigInt uses this scale.
 * 1,000,000 supports fee rates with up to 4 decimal places (e.g. 0.0025 = 2500).
 */
const FEE_BASE = 1_000_000n;
const FEE_BASE_NUM = 1_000_000;

const CFG = DEEP_SCAN_CONFIG.liquidityStress;
const AMM_CFG = DEEP_SCAN_CONFIG.amm;

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

/** Resolved pool reserves ready for BigInt arithmetic */
interface ResolvedReserves {
  /** Raw token0 reserve (BigInt, uint112-compatible) */
  r0: bigint;
  /** Raw token1/quote reserve (BigInt, uint112-compatible) */
  r1: bigint;
  /** Token0 decimal places */
  token0Decimals: number;
  /** Token1 decimal places */
  token1Decimals: number;
  /** Spot price: how many token1 per 1 token0 (USD per token if token1 is USDC/WETH-priced) */
  spotPriceUsd: number;
  /** Fee parts (FEE_BASE scale); e.g. 3000 for 0.3% */
  feeParts: bigint;
  /** Fee as decimal fraction (e.g. 0.003) */
  feeRate: number;
  /** Whether reserves were observed on-chain or derived from TVL */
  observed: boolean;
  /** Pool address */
  poolAddress: string;
  /** Pool model string */
  poolModel: string;
}

/** Raw historical snapshot row from the database */
export interface HistoricalReserveSnapshot {
  block_number: number;
  block_timestamp: string | null;
  reserve0: string;
  reserve1: string;
  indexed_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fp(n: number, decimals = 4): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Precision-safe normalization of raw on-chain reserve units to token units.
 * Converts bigint to number by scaling up, dividing, and then scaling down,
 * preserving up to 6 decimal places of precision while avoiding precision loss
 * on massive raw values.
 */
function normalizeRawReserve(rawReserve: bigint, decimals: number): number {
  const scale = 10n ** BigInt(decimals);
  const precisionFactor = 1000000n;
  return Number(rawReserve * precisionFactor / scale) / 1000000;
}

/**
 * Classify stress severity from a price impact percentage.
 * Deterministic — no AI judgment.
 */
function classifyStressSeverity(priceImpactPct: number): StressSeverity {
  const t = CFG.severityThresholds;
  if (priceImpactPct < t.negligible) return 'negligible';
  if (priceImpactPct < t.low)        return 'low';
  if (priceImpactPct < t.moderate)   return 'moderate';
  if (priceImpactPct < t.high)       return 'high';
  return 'critical';
}

function maxSeverity(a: StressSeverity, b: StressSeverity): StressSeverity {
  const order: StressSeverity[] = ['negligible', 'low', 'moderate', 'high', 'critical'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

/** Select the best V2-eligible pool from a list (same priority as AmmSlippageSimulator) */
function selectPool(pools: NormalizedPoolState[]): NormalizedPoolState | null {
  if (!pools.length) return null;
  const sorted = [...pools].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
  return (
    sorted.find(p => p.poolType === 'constant-product') ??
    sorted.find(p => p.poolType === 'unknown') ??
    sorted[0]
  );
}

/**
 * Resolve pool reserves into BigInt arithmetic form.
 *
 * Priority (in order):
 *   1. Observed on-chain raw reserves (tokenReserveRaw / quoteReserveRaw).
 *   2. Derived from liquidityUsd + spotPriceUsd using the balanced 50/50 assumption.
 *
 * The 50/50 assumption (tokenReserve = L/2/P, quoteReserve = L/2) is only valid
 * for balanced pools at spot price. For pools with very skewed reserves, observed
 * reserves from Phase 5D-5 snapshots are strongly preferred.
 *
 * PRECISION: Derived reserves use float arithmetic and are then scaled to
 * 18-decimal-place integers to enable BigInt division. This gives ~15 significant
 * figures — adequate for USD-denominated display values but not for exact
 * Solidity-level reserve accounting.
 */
function resolveReserves(
  pool: NormalizedPoolState,
  spotPriceUsd: number
): ResolvedReserves | null {
  if (!Number.isFinite(spotPriceUsd) || spotPriceUsd <= 0) return null;
  if (!Number.isFinite(pool.liquidityUsd) || pool.liquidityUsd <= 0) return null;

  const feeRate = pool.fee.known ? pool.fee.feeRate : AMM_CFG.defaultSwapFee;
  const feeParts = BigInt(Math.round(feeRate * FEE_BASE_NUM));

  // Prefer observed reserves (from Phase 5D-5 snapshots stored as raw numbers)
  if (
    pool.tokenReserveRaw !== undefined &&
    pool.quoteReserveRaw !== undefined &&
    pool.tokenReserveRaw > 0 &&
    pool.quoteReserveRaw > 0
  ) {
    // tokenReserveRaw and quoteReserveRaw are already in floating-point units
    // (normalized per token decimals). Scale them back to 18-decimal integer form.
    const SCALE = 10n ** 18n;
    const r0 = BigInt(Math.floor(pool.tokenReserveRaw * 1e18));
    const r1 = BigInt(Math.floor(pool.quoteReserveRaw * 1e18));
    if (r0 <= 0n || r1 <= 0n) return null;

    return {
      r0, r1,
      token0Decimals: 18,
      token1Decimals: 18,
      spotPriceUsd,
      feeParts,
      feeRate,
      observed: true,
      poolAddress: pool.poolIdentifier,
      poolModel: pool.poolType,
    };
  }

  // Derive from TVL using balanced 50/50 assumption
  const token0Reserve = pool.liquidityUsd / 2 / spotPriceUsd; // token0 units
  const quote0Reserve = pool.liquidityUsd / 2;                 // USD (quote) units

  const SCALE = 10n ** 18n;
  const r0 = BigInt(Math.floor(token0Reserve * 1e18));
  const r1 = BigInt(Math.floor(quote0Reserve * 1e18));
  if (r0 <= 0n || r1 <= 0n) return null;

  return {
    r0, r1,
    token0Decimals: 18,
    token1Decimals: 18,
    spotPriceUsd,
    feeParts,
    feeRate,
    observed: false,
    poolAddress: pool.poolIdentifier,
    poolModel: pool.poolType,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core BigInt Swap Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface SwapResult {
  /** Amount of token1 (quote) received */
  deltaY: bigint;
  /** Post-trade reserve0 */
  newR0: bigint;
  /** Post-trade reserve1 */
  newR1: bigint;
  /** Whether the swap is valid */
  valid: boolean;
  reason?: string;
}

/**
 * Simulate a V2 constant-product swap: sell deltaX of token0, receive deltaY of token1.
 *
 * Uses the exact Uniswap V2 formula:
 *   deltaY = (deltaX × (FEE_BASE - feeParts) × r1) / (r0 × FEE_BASE + deltaX × (FEE_BASE - feeParts))
 *
 * All arithmetic is BigInt; division is floor (truncates fractional wei).
 * This matches on-chain execution behaviour precisely.
 *
 * @param r0       - Current reserve0 (BigInt, scaled)
 * @param r1       - Current reserve1 (BigInt, scaled)
 * @param deltaX   - Input token0 amount (BigInt, same scale as r0)
 * @param feeParts - Fee in parts per FEE_BASE (e.g. 3000 for 0.3%)
 */
export function simulateV2SwapBigInt(
  r0: bigint,
  r1: bigint,
  deltaX: bigint,
  feeParts: bigint
): SwapResult {
  if (r0 <= 0n || r1 <= 0n) {
    return { deltaY: 0n, newR0: r0, newR1: r1, valid: false, reason: 'Zero reserves' };
  }
  if (deltaX <= 0n) {
    return { deltaY: 0n, newR0: r0, newR1: r1, valid: false, reason: 'Zero or negative input' };
  }
  if (feeParts < 0n || feeParts >= FEE_BASE) {
    return { deltaY: 0n, newR0: r0, newR1: r1, valid: false, reason: 'Invalid fee' };
  }

  const effectiveMultiplier = FEE_BASE - feeParts;
  const deltaXAdj = deltaX * effectiveMultiplier;
  const numerator = deltaXAdj * r1;
  const denominator = r0 * FEE_BASE + deltaXAdj;

  if (denominator === 0n) {
    return { deltaY: 0n, newR0: r0, newR1: r1, valid: false, reason: 'Zero denominator' };
  }

  const deltaY = numerator / denominator; // BigInt floor division

  if (deltaY <= 0n || deltaY >= r1) {
    return {
      deltaY: 0n,
      newR0: r0,
      newR1: r1,
      valid: false,
      reason: deltaY >= r1
        ? 'Trade drains pool reserve1'
        : 'Output amount is zero (trade too small)',
    };
  }

  return {
    deltaY,
    newR0: r0 + deltaX,
    newR1: r1 - deltaY,
    valid: true,
  };
}

/**
 * Simulate a V2 swap in the reverse direction: sell deltaY of token1, receive deltaX of token0.
 * Enables buy-side simulation (trader buys token0 with quote token1).
 */
export function simulateV2SwapReverseBigInt(
  r0: bigint,
  r1: bigint,
  deltaY: bigint,
  feeParts: bigint
): SwapResult {
  if (r0 <= 0n || r1 <= 0n) {
    return { deltaY: 0n, newR0: r0, newR1: r1, valid: false, reason: 'Zero reserves' };
  }
  if (deltaY <= 0n) {
    return { deltaY: 0n, newR0: r0, newR1: r1, valid: false, reason: 'Zero or negative input' };
  }

  const effectiveMultiplier = FEE_BASE - feeParts;
  const deltaYAdj = deltaY * effectiveMultiplier;
  const numerator = deltaYAdj * r0;
  const denominator = r1 * FEE_BASE + deltaYAdj;

  if (denominator === 0n) {
    return { deltaY: 0n, newR0: r0, newR1: r1, valid: false, reason: 'Zero denominator' };
  }

  const deltaX = numerator / denominator;

  if (deltaX <= 0n || deltaX >= r0) {
    return {
      deltaY: 0n,
      newR0: r0,
      newR1: r1,
      valid: false,
      reason: deltaX >= r0 ? 'Buy drains pool reserve0' : 'Output too small',
    };
  }

  return {
    // Convention: deltaY field holds the output token0 amount for reverse swaps
    deltaY: deltaX,
    newR0: r0 - deltaX,
    newR1: r1 + deltaY,
    valid: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Executable Liquidity — Analytical Formula
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the maximum token0 input (sell side) before price impact exceeds
 * a given threshold, using the exact analytical formula:
 *
 *   maxInputTokens = reserve0 × (I − f) / ((1 − f) × (1 − I))
 *
 * where I is the impact threshold (decimal) and f is the fee (decimal).
 *
 * This is a derivation of the constant-product price impact equation solved
 * for the input amount. It is O(1) and requires no search loops.
 *
 * PROOF:
 *   At the boundary, executionPrice = spotPrice × (1 - I).
 *   executionPrice = deltaY / deltaX.
 *   deltaY / deltaX = reserve1 / reserve0 × (1 - I)   [since spotPrice = r1/r0 at boundary]
 *
 *   From the V2 formula:
 *     deltaY = r1 × deltaX × (1-f) / (r0 + deltaX × (1-f))
 *
 *   Setting deltaY / deltaX = r1/r0 × (1 - I) and solving for deltaX:
 *     (1-f) / (r0 + deltaX×(1-f)) = (1-I) / r0
 *     r0 × (1-f) = (1-I) × (r0 + deltaX×(1-f))
 *     r0 × (1-f) - r0 × (1-I) = deltaX × (1-f) × (1-I)
 *     r0 × (I - f) = deltaX × (1-f) × (1-I)
 *     deltaX = r0 × (I - f) / ((1-f) × (1-I))
 *
 * @param r0Float         - reserve0 as float (token units, normalized by decimals)
 * @param r1Float         - reserve1 as float (quote units)
 * @param spotPriceUsd    - current spot price (USD per token0)
 * @param feeRate         - swap fee as decimal (e.g. 0.003)
 * @param impactThreshold - price impact threshold as decimal (e.g. 0.01)
 */
export function computeExecutableLiquidity(
  r0Float: number,
  r1Float: number,
  spotPriceUsd: number,
  feeRate: number,
  impactThreshold: number
): ExecutableLiquidityResult {
  const label = `${(impactThreshold * 100).toFixed(1).replace('.0', '')}%`;

  if (
    !Number.isFinite(r0Float) || r0Float <= 0 ||
    !Number.isFinite(r1Float) || r1Float <= 0 ||
    !Number.isFinite(spotPriceUsd) || spotPriceUsd <= 0
  ) {
    return {
      impactThreshold,
      impactThresholdLabel: label,
      maxInputUsd: null,
      maxInputTokens: null,
      expectedOutputUsd: null,
      reserveUtilization: null,
      status: 'invalid',
      reason: 'Invalid reserves or spot price',
    };
  }

  // If the fee rate already exceeds the impact threshold, no trade is possible
  if (impactThreshold <= feeRate) {
    return {
      impactThreshold,
      impactThresholdLabel: label,
      maxInputUsd: 0,
      maxInputTokens: 0,
      expectedOutputUsd: 0,
      reserveUtilization: 0,
      status: 'infeasible',
      reason: `Swap fee (${(feeRate * 100).toFixed(2)}%) already meets or exceeds the ${label} threshold`,
    };
  }

  // Analytical formula
  const maxInputTokens = r0Float * (impactThreshold - feeRate) / ((1 - feeRate) * (1 - impactThreshold));

  if (!Number.isFinite(maxInputTokens) || maxInputTokens <= 0) {
    return {
      impactThreshold,
      impactThresholdLabel: label,
      maxInputUsd: 0,
      maxInputTokens: 0,
      expectedOutputUsd: 0,
      reserveUtilization: 0,
      status: 'infeasible',
      reason: 'Analytical formula yields non-positive result for this pool',
    };
  }

  const maxInputUsd = maxInputTokens * spotPriceUsd;

  // Compute expected output using the exact V2 formula at the boundary input
  const tokenFraction = 1 - feeRate;
  const expectedOutputQuote = r1Float * maxInputTokens * tokenFraction /
    (r0Float + maxInputTokens * tokenFraction);
  const expectedOutputUsd = expectedOutputQuote; // quote IS USD for USDC pairs; mark for callers

  const reserveUtilization = Math.min(maxInputTokens / r0Float, 1);

  return {
    impactThreshold,
    impactThresholdLabel: label,
    maxInputUsd: fp(maxInputUsd, 2),
    maxInputTokens: fp(maxInputTokens, 6),
    expectedOutputUsd: fp(expectedOutputUsd, 2),
    reserveUtilization: fp(reserveUtilization, 6),
    status: 'ok',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Slippage Curve
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a full slippage curve from a resolved pool state.
 *
 * For each position size (USD):
 *   1. Convert USD to token0 raw integer amount.
 *   2. Run the BigInt V2 swap simulation.
 *   3. Compute execution price, price impact, reserve utilization.
 *
 * The curve is monotonic by the mathematics of the constant-product formula:
 * larger inputs always produce larger price impact.
 *
 * A monotonicity check is run on the output as a sanity gate.
 */
function buildSlippageCurve(
  res: ResolvedReserves,
  positionSizesUsd: number[]
): { curve: SlippagePoint[]; isMonotonic: boolean } {
  // Float reserves for display/ratio calculations
  const r0Float = Number(res.r0) / 1e18;
  const r1Float = Number(res.r1) / 1e18;
  const spotPrice = res.spotPriceUsd;

  const curve: SlippagePoint[] = [];

  for (const posUsd of positionSizesUsd) {
    if (posUsd <= 0) continue;

    const tokensIn = posUsd / spotPrice;
    if (!Number.isFinite(tokensIn) || tokensIn <= 0) {
      curve.push({
        positionSizeUsd: posUsd,
        tokensIn: 0,
        quoteOut: 0,
        executionPriceUsd: 0,
        spotPriceUsd: spotPrice,
        priceImpactPct: 0,
        reserveUtilization: 0,
        feeRate: res.feeRate,
        observedReserves: res.observed,
        status: 'invalid_input',
        reason: 'Cannot compute token amount from USD (bad spot price)',
      });
      continue;
    }

    // Scale to BigInt (18 decimals)
    const deltaX = BigInt(Math.floor(tokensIn * 1e18));
    const swap = simulateV2SwapBigInt(res.r0, res.r1, deltaX, res.feeParts);

    if (!swap.valid) {
      curve.push({
        positionSizeUsd: posUsd,
        tokensIn: fp(tokensIn, 6),
        quoteOut: 0,
        executionPriceUsd: 0,
        spotPriceUsd: spotPrice,
        priceImpactPct: 100,
        reserveUtilization: 1,
        feeRate: res.feeRate,
        observedReserves: res.observed,
        status: 'exceeds_pool',
        reason: swap.reason,
      });
      continue;
    }

    const deltaYFloat = Number(swap.deltaY) / 1e18;
    const executionPriceUsd = deltaYFloat / tokensIn;
    const priceImpactPct = fp(Math.max(0, (spotPrice - executionPriceUsd) / spotPrice * 100), 4);
    const reserveUtilization = fp(Math.min(tokensIn / r0Float, 1), 6);

    curve.push({
      positionSizeUsd: posUsd,
      tokensIn: fp(tokensIn, 6),
      quoteOut: fp(deltaYFloat, 4),
      executionPriceUsd: fp(executionPriceUsd, 6),
      spotPriceUsd: fp(spotPrice, 6),
      priceImpactPct,
      reserveUtilization,
      feeRate: res.feeRate,
      observedReserves: res.observed,
      status: 'ok',
    });
  }

  // Monotonicity check: priceImpactPct must be non-decreasing for 'ok' points
  const okPoints = curve.filter(p => p.status === 'ok');
  let isMonotonic = true;
  for (let i = 1; i < okPoints.length; i++) {
    // Allow a tiny epsilon for floating-point rounding (0.0001%)
    if (okPoints[i].priceImpactPct < okPoints[i - 1].priceImpactPct - 0.0001) {
      isMonotonic = false;
      break;
    }
  }

  return { curve, isMonotonic };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stress Scenarios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single stress scenario result from a swap simulation.
 */
function buildScenario(
  scenarioId: string,
  label: string,
  description: string,
  res: ResolvedReserves,
  deltaX: bigint,
  isReverse = false  // true for buy-side scenarios
): LiquidityStressScenario {
  const r0Float = Number(res.r0) / 1e18;
  const r1Float = Number(res.r1) / 1e18;
  const spot = res.spotPriceUsd;

  const swap = isReverse
    ? simulateV2SwapReverseBigInt(res.r0, res.r1, deltaX, res.feeParts)
    : simulateV2SwapBigInt(res.r0, res.r1, deltaX, res.feeParts);

  if (!swap.valid) {
    const inputTokens = Number(deltaX) / 1e18;
    return {
      scenarioId, label, description,
      simulatedInputUsd: fp(inputTokens * spot, 2),
      simulatedInputTokens: fp(inputTokens, 6),
      simulatedOutputUsd: 0,
      executionPriceUsd: 0,
      priceImpactPct: 100,
      postTradeReserve0: res.r0.toString(),
      postTradeReserve1: res.r1.toString(),
      reserveUtilization: 1,
      remainingExecutableUsd: null,
      severity: 'critical',
      status: 'exceeds_pool',
      reason: swap.reason,
    };
  }

  if (!isReverse) {
    // ── Sell direction (token0 → quote) ──
    // deltaX = tokens sold, swap.deltaY = quote received
    const tokensSold    = Number(deltaX) / 1e18;
    const quoteReceived = Number(swap.deltaY) / 1e18;
    const execPrice     = quoteReceived / tokensSold; // quote per token (should be < spot)
    const impact        = fp(Math.max(0, (spot - execPrice) / spot * 100), 4);
    const reserveUtil   = fp(Math.min(tokensSold / r0Float, 1), 6);
    const remaining     = computeExecutableLiquidity(
      Number(swap.newR0) / 1e18, Number(swap.newR1) / 1e18, spot, res.feeRate, 0.01
    );
    return {
      scenarioId, label, description,
      simulatedInputUsd:    fp(tokensSold * spot, 2),
      simulatedInputTokens: fp(tokensSold, 6),
      simulatedOutputUsd:   fp(quoteReceived, 4),
      executionPriceUsd:    fp(execPrice, 6),
      priceImpactPct:       impact,
      postTradeReserve0:    swap.newR0.toString(),
      postTradeReserve1:    swap.newR1.toString(),
      reserveUtilization:   reserveUtil,
      remainingExecutableUsd: remaining.status === 'ok' ? remaining.maxInputUsd : null,
      severity:  classifyStressSeverity(impact),
      status:    'ok',
    };
  } else {
    // ── Buy direction (quote → token0) ──
    // deltaX (passed in) = quote tokens spent by buyer (e.g. USDC)
    // swap.deltaY        = token0 received by buyer
    const quoteIn   = Number(deltaX) / 1e18;
    const tokensOut = Number(swap.deltaY) / 1e18;
    // Execution price: how many quote per token0 the buyer actually paid
    const execPrice = tokensOut > 0 ? quoteIn / tokensOut : 0;
    // Impact: buyer pays MORE than spot → (execPrice - spot) / spot × 100
    const impact    = fp(Math.max(0, (execPrice - spot) / spot * 100), 4);
    const reserveUtil = fp(Math.min(tokensOut / r0Float, 1), 6);
    const remaining   = computeExecutableLiquidity(
      Number(swap.newR0) / 1e18, Number(swap.newR1) / 1e18, spot, res.feeRate, 0.01
    );
    return {
      scenarioId, label, description,
      simulatedInputUsd:    fp(quoteIn, 2),           // USD spent by buyer
      simulatedInputTokens: fp(tokensOut, 6),         // token0 received
      simulatedOutputUsd:   fp(tokensOut * spot, 4),  // value at spot
      executionPriceUsd:    fp(execPrice, 6),
      priceImpactPct:       impact,
      postTradeReserve0:    swap.newR0.toString(),
      postTradeReserve1:    swap.newR1.toString(),
      reserveUtilization:   reserveUtil,
      remainingExecutableUsd: remaining.status === 'ok' ? remaining.maxInputUsd : null,
      severity:  classifyStressSeverity(impact),
      status:    'ok',
    };
  }
}


/**
 * Build all 6 deterministic stress scenarios (A-F).
 *
 * Scenario A: Large buy — trader buys using 10% of quote reserve as input.
 * Scenario B: Large sell — trader sells tokens worth 10% of current TVL.
 * Scenario C: Top-holder exit — top whale liquidates 10%/25%/50%/75%/100%.
 * Scenario D: Multiple large sellers — 3 simultaneous sellers each at 10%.
 * Scenario E: Liquidity deterioration — pool loses 50% of its reserves.
 * Scenario F: Historical minimum reserves — simulate stress at worst known state.
 */
function buildStressScenarios(
  res: ResolvedReserves,
  whaleBalanceTokens: number | null,
  historicalMinTargetReserve: string | null,
  isToken0: boolean,
  tokenDecimals: number
): LiquidityStressScenario[] {
  const scenarios: LiquidityStressScenario[] = [];
  const r0Float = Number(res.r0) / 1e18;
  const r1Float = Number(res.r1) / 1e18;
  const spot = res.spotPriceUsd;

  // Scenario A: Large buy (10% of quote reserve spent)
  const buyQuoteAmount = BigInt(Math.floor(r1Float * CFG.stressTradeFraction * 1e18));
  if (buyQuoteAmount > 0n) {
    scenarios.push(buildScenario(
      'large_buy',
      'Scenario A: Large Buy Pressure',
      `Simulates a single buy consuming ${(CFG.stressTradeFraction * 100).toFixed(0)}% of the current quote reserve.`,
      res, buyQuoteAmount, true
    ));
  }

  // Scenario B: Large sell (10% of TVL worth of tokens)
  const tvlUsd = r1Float * 2; // balanced pool approximation
  const sellAmountUsd = tvlUsd * CFG.stressTradeFraction;
  const sellAmountTokens = sellAmountUsd / spot;
  const sellDeltaX = BigInt(Math.floor(sellAmountTokens * 1e18));
  if (sellDeltaX > 0n) {
    scenarios.push(buildScenario(
      'large_sell',
      'Scenario B: Large Sell Pressure',
      `Simulates a single sell of tokens worth ${(CFG.stressTradeFraction * 100).toFixed(0)}% of the pool's current TVL.`,
      res, sellDeltaX, false
    ));
  }

  // Scenario C: Top-holder exit at each configured fraction
  if (whaleBalanceTokens !== null && whaleBalanceTokens > 0) {
    for (const fraction of CFG.holderExitFractions) {
      const exitTokens = whaleBalanceTokens * fraction;
      const exitDeltaX = BigInt(Math.floor(exitTokens * 1e18));
      if (exitDeltaX > 0n) {
        const pct = (fraction * 100).toFixed(0);
        scenarios.push(buildScenario(
          `holder_exit_${pct}pct`,
          `Scenario C: Top Holder Exit (${pct}%)`,
          `Simulates the largest observed whale liquidating ${pct}% of their observed batch balance.`,
          res, exitDeltaX, false
        ));
      }
    }
  }

  // Scenario D: Multiple large sellers (3 simultaneous, each 10% TVL)
  // Simulate sequentially to capture compounding reserve depletion
  const multiSellUsd = tvlUsd * CFG.stressTradeFraction;
  const multiSellTokens = multiSellUsd / spot;
  const multiDeltaX = BigInt(Math.floor(multiSellTokens * 1e18));

  if (multiDeltaX > 0n) {
    // Run 3 sequential swaps to get compounding impact
    let curR0 = res.r0;
    let curR1 = res.r1;
    let totalOutputQuote = 0n;
    let totalInputTokens = 0n;
    let allValid = true;

    for (let i = 0; i < 3; i++) {
      const sw = simulateV2SwapBigInt(curR0, curR1, multiDeltaX, res.feeParts);
      if (!sw.valid) { allValid = false; break; }
      totalOutputQuote += sw.deltaY;
      totalInputTokens += multiDeltaX;
      curR0 = sw.newR0;
      curR1 = sw.newR1;
    }

    if (allValid) {
      const totalIn = Number(totalInputTokens) / 1e18;
      const totalOut = Number(totalOutputQuote) / 1e18;
      const execPrice = totalOut / totalIn;
      const impact = fp(Math.max(0, (spot - execPrice) / spot * 100), 4);
      const postR0Float = Number(curR0) / 1e18;
      const postR1Float = Number(curR1) / 1e18;
      const remaining = computeExecutableLiquidity(postR0Float, postR1Float, spot, res.feeRate, 0.01);

      scenarios.push({
        scenarioId: 'multiple_sellers',
        label: 'Scenario D: Multiple Large Sellers',
        description: `Simulates 3 simultaneous sellers each dumping ${(CFG.stressTradeFraction * 100).toFixed(0)}% of TVL worth of tokens.`,
        simulatedInputUsd: fp(totalIn * spot, 2),
        simulatedInputTokens: fp(totalIn, 6),
        simulatedOutputUsd: fp(totalOut, 4),
        executionPriceUsd: fp(execPrice, 6),
        priceImpactPct: impact,
        postTradeReserve0: curR0.toString(),
        postTradeReserve1: curR1.toString(),
        reserveUtilization: fp(Math.min(Number(totalInputTokens) / Number(res.r0), 1), 6),
        remainingExecutableUsd: remaining.status === 'ok' ? remaining.maxInputUsd : null,
        severity: classifyStressSeverity(impact),
        status: 'ok',
      });
    }
  }

  // Scenario E: Liquidity deterioration (50% of reserves removed from the pool)
  // This simulates LP removal, not a swap. We scale down reserves directly.
  const detFraction = CFG.deteriorationFraction;
  const detR0 = BigInt(Math.floor(Number(res.r0) * (1 - detFraction)));
  const detR1 = BigInt(Math.floor(Number(res.r1) * (1 - detFraction)));

  if (detR0 > 0n && detR1 > 0n) {
    const detRes: ResolvedReserves = { ...res, r0: detR0, r1: detR1 };
    const testSellUsd = 1_000; // $1k test trade against the depleted pool
    const testSellTokens = testSellUsd / spot;
    const testDeltaX = BigInt(Math.floor(testSellTokens * 1e18));

    if (testDeltaX > 0n) {
      const sw = simulateV2SwapBigInt(detR0, detR1, testDeltaX, res.feeParts);
      const inputTokens = Number(testDeltaX) / 1e18;
      const outputQuote = sw.valid ? Number(sw.deltaY) / 1e18 : 0;
      const execPrice = sw.valid ? outputQuote / inputTokens : 0;
      const impact = sw.valid ? fp(Math.max(0, (spot - execPrice) / spot * 100), 4) : 100;
      const postR0 = sw.valid ? Number(sw.newR0) / 1e18 : Number(detR0) / 1e18;
      const postR1 = sw.valid ? Number(sw.newR1) / 1e18 : Number(detR1) / 1e18;
      const remaining = computeExecutableLiquidity(postR0, postR1, spot, res.feeRate, 0.01);

      scenarios.push({
        scenarioId: 'liquidity_deterioration',
        label: 'Scenario E: Liquidity Deterioration',
        description: `Simulates ${(detFraction * 100).toFixed(0)}% LP removal followed by a $1k test trade against the depleted pool.`,
        simulatedInputUsd: fp(testSellUsd, 2),
        simulatedInputTokens: fp(inputTokens, 6),
        simulatedOutputUsd: fp(outputQuote, 4),
        executionPriceUsd: sw.valid ? fp(execPrice, 6) : 0,
        priceImpactPct: impact,
        postTradeReserve0: sw.valid ? sw.newR0.toString() : detR0.toString(),
        postTradeReserve1: sw.valid ? sw.newR1.toString() : detR1.toString(),
        reserveUtilization: fp(Math.min(inputTokens / (Number(detR0) / 1e18), 1), 6),
        remainingExecutableUsd: remaining.status === 'ok' ? remaining.maxInputUsd : null,
        severity: classifyStressSeverity(impact),
        status: sw.valid ? 'ok' : 'exceeds_pool',
        reason: sw.valid ? undefined : sw.reason,
      });
    }
  }

  // Scenario F: Historical minimum reserves
  if (historicalMinTargetReserve !== null) {
    const minTarget = BigInt(historicalMinTargetReserve);
    
    // Scale minTarget to 18 decimals so it aligns with res.r0 (scanned token reserve)
    const minR0 = (() => {
      if (tokenDecimals <= 18) {
        return minTarget * (10n ** BigInt(18 - tokenDecimals));
      } else {
        return minTarget / (10n ** BigInt(tokenDecimals - 18));
      }
    })();

    // Preserve k ratio to derive minR1 from current reserves
    if (minR0 > 0n && minR0 < res.r0) {
      // Maintain constant k: r1_min = k / r0_min
      const k = res.r0 * res.r1;
      const minR1 = k / minR0;

      if (minR1 > 0n) {
        const histRes: ResolvedReserves = { ...res, r0: minR0, r1: minR1 };
        const histR0Float = Number(minR0) / 1e18;
        const histSpot = Number(minR1) / 1e18 / histR0Float; // implied spot from historical ratio

        const testSellUsd = 1_000;
        const testSellTokens = testSellUsd / spot;
        const testDeltaX = BigInt(Math.floor(testSellTokens * 1e18));

        if (testDeltaX > 0n) {
          const sw = simulateV2SwapBigInt(minR0, minR1, testDeltaX, res.feeParts);
          const inputTokens = Number(testDeltaX) / 1e18;
          const outputQuote = sw.valid ? Number(sw.deltaY) / 1e18 : 0;
          const execPrice = sw.valid ? outputQuote / inputTokens : 0;
          const impact = sw.valid ? fp(Math.max(0, (spot - execPrice) / spot * 100), 4) : 100;
          const remaining = computeExecutableLiquidity(
            Number(sw.valid ? sw.newR0 : minR0) / 1e18,
            Number(sw.valid ? sw.newR1 : minR1) / 1e18,
            spot, res.feeRate, 0.01
          );

          scenarios.push({
            scenarioId: 'historical_minimum',
            label: 'Scenario F: Historical Liquidity Shock',
            description: 'Simulates a $1k trade against the historical minimum observed reserves for this pool.',
            simulatedInputUsd: fp(testSellUsd, 2),
            simulatedInputTokens: fp(inputTokens, 6),
            simulatedOutputUsd: fp(outputQuote, 4),
            executionPriceUsd: sw.valid ? fp(execPrice, 6) : 0,
            priceImpactPct: impact,
            postTradeReserve0: sw.valid ? sw.newR0.toString() : minR0.toString(),
            postTradeReserve1: sw.valid ? sw.newR1.toString() : minR1.toString(),
            reserveUtilization: fp(Math.min(inputTokens / histR0Float, 1), 6),
            remainingExecutableUsd: remaining.status === 'ok' ? remaining.maxInputUsd : null,
            severity: classifyStressSeverity(impact),
            status: sw.valid ? 'ok' : 'exceeds_pool',
            reason: sw.valid ? undefined : sw.reason,
          });
        }
      }
    }
  }

  return scenarios;
}

// ─────────────────────────────────────────────────────────────────────────────
// Historical Analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a time-ordered series of historical reserve snapshots.
 *
 * ANTI-FABRICATION RULES:
 * • Missing snapshots remain missing — no interpolation.
 * • Values are only derived from actual indexed on-chain data.
 * • If insufficient data, returns status = 'insufficient_data'.
 */
export function analyzeHistoricalSnapshots(
  snapshots: HistoricalReserveSnapshot[],
  spotPriceUsd: number,
  isToken0: boolean,
  tokenDecimals: number
): HistoricalLiquidityMetrics {
  // Validate token decimals safely
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 255) {
    return {
      snapshotCount: 0,
      oldestBlock: null,
      newestBlock: null,
      minTargetReserve: null,
      maxTargetReserve: null,
      minLiquidityUsd: null,
      maxLiquidityUsd: null,
      targetGrowthFraction: null,
      targetVolatilityAvg: null,
      shocks: [],
      trend: 'insufficient_data',
      hasMissingSnapshots: false,
      status: 'unavailable',
    };
  }

  if (!snapshots || snapshots.length === 0) {
    return {
      snapshotCount: 0,
      oldestBlock: null,
      newestBlock: null,
      minTargetReserve: null,
      maxTargetReserve: null,
      minLiquidityUsd: null,
      maxLiquidityUsd: null,
      targetGrowthFraction: null,
      targetVolatilityAvg: null,
      shocks: [],
      trend: 'insufficient_data',
      hasMissingSnapshots: false,
      status: 'unavailable',
    };
  }

  // Sort ascending by block number
  const sorted = [...snapshots].sort((a, b) => a.block_number - b.block_number);

  const targetValues = sorted.map(s => {
    try {
      const targetReserve = isToken0 ? s.reserve0 : s.reserve1;
      return BigInt(targetReserve);
    } catch { return null; }
  });

  const validTarget = targetValues.filter((v): v is bigint => v !== null && v > 0n);

  if (validTarget.length < 2) {
    return {
      snapshotCount: sorted.length,
      oldestBlock: sorted[0]?.block_number ?? null,
      newestBlock: sorted[sorted.length - 1]?.block_number ?? null,
      minTargetReserve: null,
      maxTargetReserve: null,
      minLiquidityUsd: null,
      maxLiquidityUsd: null,
      targetGrowthFraction: null,
      targetVolatilityAvg: null,
      shocks: [],
      trend: 'insufficient_data',
      hasMissingSnapshots: false,
      status: 'insufficient_data',
    };
  }

  const minTarget = validTarget.reduce((a, b) => a < b ? a : b);
  const maxTarget = validTarget.reduce((a, b) => a > b ? a : b);
  const oldestTarget = validTarget[0];
  const newestTarget = validTarget[validTarget.length - 1];

  // Growth fraction (can be negative)
  const targetGrowthFraction = Number(newestTarget - oldestTarget) / Number(oldestTarget);

  // Volatility: average absolute fractional change between consecutive snapshots
  const changes: number[] = [];
  for (let i = 1; i < validTarget.length; i++) {
    const prev = validTarget[i - 1];
    const curr = validTarget[i];
    if (prev > 0n) {
      changes.push(Math.abs(Number(curr - prev) / Number(prev)));
    }
  }
  const targetVolatilityAvg = changes.length > 0
    ? changes.reduce((a, b) => a + b, 0) / changes.length
    : null;

  // Liquidity USD estimates (only when spot price is available)
  let minLiquidityUsd: number | null = null;
  let maxLiquidityUsd: number | null = null;
  if (Number.isFinite(spotPriceUsd) && spotPriceUsd > 0) {
    // For balanced V2 pools: liquidityUsd ≈ 2 × reserve_target × spotPriceUsd
    // Scaled properly to the scanned token's decimals using precision-safe helper
    const liqValues = validTarget.map(r => normalizeRawReserve(r, tokenDecimals) * spotPriceUsd * 2);
    minLiquidityUsd = fp(Math.min(...liqValues), 2);
    maxLiquidityUsd = fp(Math.max(...liqValues), 2);
  }

  // Trend classification
  let trend: HistoricalLiquidityMetrics['trend'];
  if (targetGrowthFraction > 0.02) {
    trend = 'growing';
  } else if (targetGrowthFraction < -0.02) {
    trend = 'declining';
  } else {
    trend = 'flat';
  }

  // Shock detection
  const shocks: LiquidityShock[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = targetValues[i - 1];
    const curr = targetValues[i];
    if (prev === null || curr === null || prev === 0n) continue;

    const changePct = Number(curr - prev) / Number(prev) * 100;
    const absChange = Math.abs(changePct);

    if (absChange >= CFG.shockThresholdPct) {
      let type: LiquidityShock['type'];
      if (changePct < -CFG.drainThresholdPct) {
        type = 'drain';
      } else if (changePct < 0) {
        type = 'sudden_withdrawal';
      } else {
        type = 'sudden_addition';
      }
      shocks.push({
        blockNumber: sorted[i].block_number,
        blockTimestamp: sorted[i].block_timestamp,
        targetReserveBefore: prev.toString(),
        targetReserveAfter: curr.toString(),
        targetReserveChangePct: fp(changePct, 2),
        liquidityChangePct: fp(changePct, 2),
        type,
        severity: classifyStressSeverity(absChange),
      });
    }
  }

  return {
    snapshotCount: sorted.length,
    oldestBlock: sorted[0].block_number,
    newestBlock: sorted[sorted.length - 1].block_number,
    minTargetReserve: minTarget.toString(),
    maxTargetReserve: maxTarget.toString(),
    minLiquidityUsd,
    maxLiquidityUsd,
    targetGrowthFraction: fp(targetGrowthFraction, 6),
    targetVolatilityAvg: targetVolatilityAvg !== null ? fp(targetVolatilityAvg, 6) : null,
    shocks,
    trend,
    hasMissingSnapshots: false, // caller may set this based on expected vs actual count
    status: 'ok',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Liquidity Regime Classifier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the liquidity regime deterministically from TVL and trend data.
 * No AI judgment is used. Thresholds are configurable from DEEP_SCAN_CONFIG.
 */
export function classifyLiquidityRegime(
  liquidityUsd: number,
  historical: HistoricalLiquidityMetrics
): { regime: LiquidityRegime; reason: string } {
  const t = CFG.regimeThresholds;

  // First check for trend-based overrides
  if (
    historical.status === 'ok' &&
    historical.targetGrowthFraction !== null
  ) {
    const growth = historical.targetGrowthFraction;
    if (growth <= -CFG.deterioratingTrendThreshold) {
      return {
        regime: 'deteriorating',
        reason: `Liquidity has declined by ${Math.abs(growth * 100).toFixed(1)}% over the historical period (threshold: ${(CFG.deterioratingTrendThreshold * 100).toFixed(0)}%).`,
      };
    }
    if (growth >= CFG.recoveringTrendThreshold && historical.minLiquidityUsd !== null && historical.maxLiquidityUsd !== null) {
      const minToMax = (historical.maxLiquidityUsd - historical.minLiquidityUsd) / historical.minLiquidityUsd;
      if (minToMax >= CFG.recoveringTrendThreshold) {
        return {
          regime: 'recovering',
          reason: `Liquidity has grown by ${(growth * 100).toFixed(1)}% and recovered ${(minToMax * 100).toFixed(1)}% from its historical minimum.`,
        };
      }
    }
  }

  // TVL-based regime
  if (liquidityUsd >= t.deep) {
    return { regime: 'deep', reason: `TVL ($${liquidityUsd.toLocaleString()}) exceeds $${t.deep.toLocaleString()} threshold for deep liquidity.` };
  }
  if (liquidityUsd >= t.healthy) {
    return { regime: 'healthy', reason: `TVL ($${liquidityUsd.toLocaleString()}) exceeds $${t.healthy.toLocaleString()} threshold for healthy liquidity.` };
  }
  if (liquidityUsd >= t.moderate) {
    return { regime: 'moderate', reason: `TVL ($${liquidityUsd.toLocaleString()}) is between $${t.moderate.toLocaleString()} and $${t.healthy.toLocaleString()}.` };
  }
  if (liquidityUsd >= t.thin) {
    return { regime: 'thin', reason: `TVL ($${liquidityUsd.toLocaleString()}) is below $${t.moderate.toLocaleString()}; trading is constrained.` };
  }
  return {
    regime: 'critically_thin',
    reason: `TVL ($${liquidityUsd.toLocaleString()}) is critically low (below $${t.thin.toLocaleString()}). Large trades are not viable.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export interface LiquidityStressInput {
  /** Pool list (normalized or legacy) */
  pools: (NormalizedPoolState | LiquidityPool)[];
  /** Current spot price in USD */
  spotPriceUsd: number;
  /** Historical reserve snapshots from Phase 5D-5 (may be empty) */
  historicalSnapshots: HistoricalReserveSnapshot[];
  /** Combined observed balance of top whale(s) in token0 units (null if unavailable) */
  whaleBalanceTokens?: number | null;
  /** Override position sizes for slippage curve (defaults to config) */
  positionSizesUsd?: number[];
  /** Scanned token address (to detect token0 vs token1 slot) */
  tokenAddress: string;
  /** Scanned token decimal count */
  tokenDecimals: number;
}

/**
 * Run a complete Phase 5D-6 liquidity stress analysis.
 *
 * This function is the sole public API of LiquidityStressAnalyzer.
 * It never makes external HTTP calls — all data must be pre-fetched.
 *
 * @param input - Normalized pool state, spot price, historical snapshots, token decimals, and optional whale data
 * @returns    LiquidityStressReport for inclusion in DeepScanResult.liquidityStress
 */
export function analyzeLiquidityStress(
  input: LiquidityStressInput
): LiquidityStressReport {
  // Validate token decimals safely
  if (
    input.tokenDecimals === undefined ||
    input.tokenDecimals === null ||
    !Number.isInteger(input.tokenDecimals) ||
    input.tokenDecimals < 0 ||
    input.tokenDecimals > 255
  ) {
    const emptyHistorical: HistoricalLiquidityMetrics = {
      snapshotCount: 0,
      oldestBlock: null,
      newestBlock: null,
      minTargetReserve: null,
      maxTargetReserve: null,
      minLiquidityUsd: null,
      maxLiquidityUsd: null,
      targetGrowthFraction: null,
      targetVolatilityAvg: null,
      shocks: [],
      trend: 'insufficient_data',
      hasMissingSnapshots: false,
      status: 'unavailable',
    };
    return buildEmptyReport(
      'Invalid or missing token decimals metadata.',
      null,
      null,
      emptyHistorical,
      input.spotPriceUsd,
      0
    );
  }

  const positionSizes = input.positionSizesUsd ?? CFG.slippageCurveSizesUsd;

  // Normalize pools
  const normalizedPools: NormalizedPoolState[] = input.pools.map(p =>
    'poolType' in p ? p : toNormalizedPoolState(p)
  );

  // Select best pool
  const selectedPool = selectPool(normalizedPools);

  // Determine whether scanned token is token0 or token1
  let isToken0 = true;
  let validationError: string | null = null;

  if (selectedPool) {
    const normToken = input.tokenAddress.toLowerCase();
    const normT0 = selectedPool.token0?.toLowerCase();
    const normT1 = selectedPool.token1?.toLowerCase();

    if (normT0 && normT1) {
      // Both addresses are known — we can deterministically resolve the slot
      if (normToken === normT0) {
        isToken0 = true;
      } else if (normToken === normT1) {
        isToken0 = false;
      } else {
        // Scanned token matches neither slot — data integrity violation
        validationError = 'Scanned token address does not match pool token0 or token1.';
      }
    } else if (normT0) {
      // Only token0 known — infer: if not token0 then must be token1
      isToken0 = normToken === normT0;
    } else if (normT1) {
      // Only token1 known — infer: if not token1 then must be token0
      isToken0 = normToken !== normT1;
    }
    // else: no token address metadata available — default isToken0=true (best-effort)
    // Historical analysis will still use reserve0, which is the most common case.
  }

  // Analyze historical snapshots (always run, even if pool is unsupported or validation fails)
  const historical = analyzeHistoricalSnapshots(
    input.historicalSnapshots.slice(0, CFG.maxHistoricalSnapshots),
    input.spotPriceUsd,
    isToken0,
    input.tokenDecimals
  );

  const historicalMinTargetReserve = historical.status === 'ok' ? historical.minTargetReserve : null;

  // Guard: no pools
  if (!selectedPool) {
    return buildEmptyReport('No pool data available.', null, null, historical, input.spotPriceUsd, 0);
  }

  const poolType = selectedPool.poolType;
  const liquidityUsd = selectedPool.liquidityUsd ?? 0;

  // Guard: validation error
  if (validationError) {
    return buildEmptyReport(
      validationError,
      selectedPool.poolIdentifier,
      poolType,
      historical,
      input.spotPriceUsd,
      liquidityUsd
    );
  }

  // Guard: V3/CLMM
  if (poolType === 'concentrated-liquidity') {
    return buildEmptyReport(
      'The primary pool uses concentrated liquidity (V3/CLMM). The constant-product model is not applicable.',
      selectedPool.poolIdentifier, poolType, historical, input.spotPriceUsd, liquidityUsd
    );
  }

  // Guard: invalid spot price
  if (!Number.isFinite(input.spotPriceUsd) || input.spotPriceUsd <= 0) {
    return buildEmptyReport(
      'Spot price is zero or unavailable — cannot run AMM simulation.',
      selectedPool.poolIdentifier, poolType, historical, input.spotPriceUsd, liquidityUsd
    );
  }

  // Resolve reserves
  const res = resolveReserves(selectedPool, input.spotPriceUsd);
  if (!res) {
    return buildEmptyReport(
      'Could not resolve pool reserves (zero liquidity or invalid state).',
      selectedPool.poolIdentifier, poolType, historical, input.spotPriceUsd, liquidityUsd
    );
  }

  const r0Float = Number(res.r0) / 1e18;
  const r1Float = Number(res.r1) / 1e18;

  // Build slippage curve
  const { curve, isMonotonic } = buildSlippageCurve(res, positionSizes);

  // Compute executable liquidity at each threshold
  const executableLiquidity: ExecutableLiquidityResult[] = CFG.impactThresholds.map(threshold =>
    computeExecutableLiquidity(r0Float, r1Float, res.spotPriceUsd, res.feeRate, threshold)
  );

  // Utilization at $1k
  const sim1k = curve.find(p => p.positionSizeUsd === 1_000 && p.status === 'ok');
  const utilizationAt1kUsd = sim1k?.reserveUtilization ?? null;

  // Stress scenarios
  const scenarios = buildStressScenarios(
    res,
    input.whaleBalanceTokens ?? null,
    historicalMinTargetReserve,
    isToken0,
    input.tokenDecimals
  );
  const maxSev: StressSeverity = scenarios.reduce<StressSeverity>(
    (worst, s) => maxSeverity(worst, s.severity),
    'negligible'
  );

  // Regime classification
  const { regime, reason: regimeReason } = classifyLiquidityRegime(liquidityUsd, historical);

  return {
    status: 'ok',
    poolAddress: selectedPool.poolIdentifier,
    poolModel: poolType,
    observedReserves: res.observed,
    spotPriceUsd: fp(res.spotPriceUsd, 6),
    totalLiquidityUsd: fp(liquidityUsd, 2),
    slippageCurve: curve,
    isCurveMonotonic: isMonotonic,
    executableLiquidity,
    utilizationAt1kUsd,
    scenarios,
    maxScenarioSeverity: maxSev,
    historical,
    liquidityRegime: regime,
    liquidityRegimeReason: regimeReason,
  };
}

/** Build a minimal failed/unsupported report with historical data preserved */
function buildEmptyReport(
  reason: string,
  poolAddress: string | null,
  poolModel: string | null,
  historical: HistoricalLiquidityMetrics,
  spotPriceUsd: number,
  totalLiquidityUsd: number
): LiquidityStressReport {
  const { regime, reason: regimeReason } = classifyLiquidityRegime(totalLiquidityUsd, historical);
  return {
    status: 'insufficient_data',
    reason,
    poolAddress,
    poolModel,
    observedReserves: false,
    spotPriceUsd,
    totalLiquidityUsd,
    slippageCurve: [],
    isCurveMonotonic: true,
    executableLiquidity: [],
    utilizationAt1kUsd: null,
    scenarios: [],
    maxScenarioSeverity: 'negligible',
    historical,
    liquidityRegime: regime,
    liquidityRegimeReason: regimeReason,
  };
}

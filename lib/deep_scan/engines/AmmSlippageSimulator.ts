/**
 * AMM Slippage Simulator — Module 3
 *
 * Simulates constant-product (Uniswap V2 style) execution impact
 * for custom position sizes using cached pool reserve data.
 *
 * Formula derivation (for a token/USD pair):
 *   Given pool liquidity L (USD) and spot price P (USD/token):
 *     token_reserve  = L / 2 / P
 *     quote_reserve  = L / 2
 *     k = token_reserve * quote_reserve
 *
 *   For selling `tokens_in` tokens with fee f:
 *     tokens_in_adj    = tokens_in * (1 - f)
 *     new_tok_reserve  = token_reserve + tokens_in_adj
 *     quote_out        = quote_reserve - k / new_tok_reserve
 *     execution_price  = quote_out / tokens_in     (USD received per token)
 *     price_impact_pct = (P - execution_price) / P * 100
 *
 * This is a pure calculation function — no HTTP calls.
 */

import {
  AmmSlippageResult,
  PositionSizeResult,
  RiskLevel,
  ModuleStatus,
} from '../types';
import { LiquidityPool } from '../../blockchain/types';

const DEFAULT_POSITION_SIZES_USD = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];
const DEFAULT_SWAP_FEE = 0.003; // 0.3% — Uniswap V2 / PancakeSwap standard

function classifyExitRisk(priceImpactPct: number): RiskLevel {
  if (priceImpactPct < 1) return 'low';
  if (priceImpactPct < 5) return 'medium';
  if (priceImpactPct < 15) return 'high';
  return 'critical';
}

function round(n: number, dp = 4): number {
  const factor = Math.pow(10, dp);
  return Math.round(n * factor) / factor;
}

/**
 * Simulate AMM slippage for all position sizes.
 *
 * @param pools         - Pool list from Basic Scan / shared data layer
 * @param spotPriceUsd  - Current spot price (USD per token)
 * @param positionSizesUsd - Array of USD trade sizes to simulate (default: 6 standard sizes)
 */
export function simulateAmmSlippage(
  pools: LiquidityPool[],
  spotPriceUsd: number,
  positionSizesUsd: number[] = DEFAULT_POSITION_SIZES_USD
): AmmSlippageResult {
  // ── Validation ──
  if (!pools || pools.length === 0) {
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

  // ── Select the largest pool ──
  const sortedPools = [...pools].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
  const largestPool = sortedPools[0];

  if (!Number.isFinite(largestPool.liquidityUsd) || largestPool.liquidityUsd <= 0) {
    return {
      status: 'insufficient_data',
      reason: 'Primary pool has zero or invalid liquidity.',
      simulations: [],
      isThinLiquidity: true,
      evidenceIds: [],
    };
  }

  const poolLiquidityUsd = largestPool.liquidityUsd;
  const swapFee = DEFAULT_SWAP_FEE;

  // ── Derive virtual reserves from pool liquidity and spot price ──
  // For a balanced token/USDC pool:
  //   token_reserve = L/2 / P,  quote_reserve = L/2
  const tokenReserve = poolLiquidityUsd / 2 / spotPriceUsd;
  const quoteReserve = poolLiquidityUsd / 2;
  const k = tokenReserve * quoteReserve;

  const simulations: PositionSizeResult[] = [];

  for (const posUsd of positionSizesUsd) {
    if (posUsd <= 0) continue;

    // Tokens we are selling
    const tokensIn = posUsd / spotPriceUsd;
    const tokensInAdj = tokensIn * (1 - swapFee);
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
        swapFee,
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
        swapFee,
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
        swapFee,
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
      swapFee,
      status: 'ok',
    });
  }

  // ── Thin liquidity signal ──
  const sim1k = simulations.find((s) => s.positionSizeUsd === 1_000 && s.status === 'ok');
  const isThinLiquidity = !sim1k || sim1k.priceImpactPct > 2;

  // ── Minimum viable liquidity (last position with < 10% impact) ──
  const okSims = simulations.filter((s) => s.status === 'ok' && s.priceImpactPct < 10);
  const minimumViableLiquidityUsd = okSims.length > 0
    ? okSims[okSims.length - 1].positionSizeUsd
    : undefined;

  // ── Evidence IDs (pool address used as evidence source) ──
  const evidenceIds = ['amm-pool-snapshot'];

  return {
    status: simulations.some((s) => s.status === 'ok') ? 'ok' : 'insufficient_data',
    poolAddress: largestPool.pair ?? 'unknown',
    poolSnapshotAt: Math.floor(Date.now() / 1000),
    spotPriceUsd: round(spotPriceUsd, 6),
    poolLiquidityUsd: round(poolLiquidityUsd, 2),
    simulations,
    minimumViableLiquidityUsd,
    isThinLiquidity,
    evidenceIds,
  };
}

/**
 * Whale Exit Simulator — Module 7
 *
 * Simulates what would happen if top whale wallets liquidated
 * 10%, 25%, or 50% of their observed batch positions.
 *
 * CRITICAL DISCLAIMER:
 *   These are SIMULATED SCENARIOS, not actual transactions.
 *   Whale balances are LOCAL BATCH OBSERVATIONS, not authoritative balances.
 *   Results must never be presented as facts about past or future events.
 *
 * Uses the same constant-product AMM formula as AmmSlippageSimulator.
 * Pool selection follows the same priority: constant-product > unknown > clmm.
 */

import {
  WhaleExitResult,
  WhaleExitScenario,
  WhaleEntry,
  SeverityLevel,
  ModuleStatus,
} from '../types';
import {
  LiquidityPool,
  NormalizedPoolState,
  toNormalizedPoolState,
} from '../../blockchain/types';
import { DEEP_SCAN_CONFIG } from '../config';

const SIMULATION_DISCLAIMER =
  'These are SIMULATED scenarios based on local batch balance observations. ' +
  'They represent what WOULD happen mathematically if these wallets liquidated — ' +
  'they are NOT actual transactions.';

/**
 * Canonical V2 default fee applied when pool fee is unknown.
 * See AmmSlippageSimulator for the full rationale.
 */
const V2_DEFAULT_SWAP_FEE = DEEP_SCAN_CONFIG.amm.defaultSwapFee;

const FRACTIONS = DEEP_SCAN_CONFIG.whaleExit.liquidationFractions;

/**
 * Select the best pool for whale exit simulation.
 * Mirrors AmmSlippageSimulator.selectPool priority:
 *   constant-product > unknown > concentrated-liquidity
 */
function selectExitPool(pools: NormalizedPoolState[]): NormalizedPoolState | null {
  if (!pools || pools.length === 0) return null;
  const sorted = [...pools].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
  const cpPool = sorted.find(p => p.poolType === 'constant-product');
  if (cpPool) return cpPool;
  const unknownPool = sorted.find(p => p.poolType === 'unknown');
  if (unknownPool) return unknownPool;
  return sorted[0]; // all CLMM — return for explicit refusal
}

function round(n: number, dp = 4): number {
  const factor = Math.pow(10, dp);
  return Math.round(n * factor) / factor;
}

function classifySeverity(priceDeltaPct: number): SeverityLevel {
  const limits = DEEP_SCAN_CONFIG.whaleExit.severityLimits;
  if (priceDeltaPct < limits.low) return 'low';
  if (priceDeltaPct < limits.medium) return 'medium';
  if (priceDeltaPct < limits.high) return 'high';
  return 'critical';
}

/**
 * Simulate whale exit scenarios using the constant-product AMM model.
 *
 * @param whales       - Whale entries from WhaleBehaviorAnalyzer (batch observations)
 * @param pools        - Pool list from shared data layer
 * @param spotPriceUsd - Current spot price (USD)
 * @param totalSupply  - Token total supply
 */
export function simulateWhaleExit(
  whales: WhaleEntry[],
  pools: (NormalizedPoolState | LiquidityPool)[],
  spotPriceUsd: number,
  totalSupply: number
): WhaleExitResult {
  // ── Large-Cap Bypass Gate ──
  const fdv = totalSupply * spotPriceUsd;
  if (fdv > 50_000_000) {
    return {
      status: 'insufficient_data',
      reason: 'Whale exit simulation skipped for Large-Cap tokens.',
      simulationDisclaimer: SIMULATION_DISCLAIMER,
      targetWallets: [],
      combinedObservedBalance: 0,
      scenarios: [],
      maxSeverity: 'low',
      evidenceIds: [],
    };
  }

  // Normalize to NormalizedPoolState[]
  const normalizedPools: NormalizedPoolState[] = pools.map(p =>
    'poolType' in p ? p : toNormalizedPoolState(p)
  );

  // ── Validation ──
  if (!whales || whales.length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'No whale data available — cannot simulate exit scenarios.',
      simulationDisclaimer: SIMULATION_DISCLAIMER,
      targetWallets: [],
      combinedObservedBalance: 0,
      scenarios: [],
      maxSeverity: 'low',
      evidenceIds: [],
    };
  }

  if (!normalizedPools || normalizedPools.length === 0 || spotPriceUsd <= 0) {
    return {
      status: 'insufficient_data',
      reason: 'Missing pool data or spot price — cannot run AMM exit simulation.',
      simulationDisclaimer: SIMULATION_DISCLAIMER,
      targetWallets: whales.slice(0, 3).map((w) => w.wallet),
      combinedObservedBalance: 0,
      scenarios: [],
      maxSeverity: 'low',
      evidenceIds: [],
    };
  }

  // ── Select top 3 whales by observed batch balance ──
  const topWhales = [...whales]
    .filter((w) => !w.isFiltered)
    .sort((a, b) => b.observedBatchBalance - a.observedBatchBalance)
    .slice(0, 3);

  const targetWallets = topWhales.map((w) => w.wallet);
  const combinedObservedBalance = topWhales.reduce(
    (sum, w) => sum + w.observedBatchBalance,
    0
  );

  // ── Select pool for simulation (mirrors AmmSlippageSimulator pool-type priority) ──
  const selectedPool = selectExitPool(normalizedPools);
  if (!selectedPool) {
    return {
      status: 'insufficient_data',
      reason: 'No usable pool found for whale exit simulation.',
      simulationDisclaimer: SIMULATION_DISCLAIMER,
      targetWallets,
      combinedObservedBalance: round(combinedObservedBalance, 4),
      scenarios: [],
      maxSeverity: 'low',
      evidenceIds: [],
    };
  }

  // ── Pool type gate: refuse CLMM pools ──
  if (selectedPool.poolType === 'concentrated-liquidity') {
    return {
      status: 'insufficient_data',
      reason:
        'The primary pool uses concentrated liquidity (V3/CLMM). ' +
        'The constant-product exit simulation model is not applicable to this pool type.',
      simulationDisclaimer: SIMULATION_DISCLAIMER,
      targetWallets,
      combinedObservedBalance: round(combinedObservedBalance, 4),
      scenarios: [],
      maxSeverity: 'low',
      evidenceIds: [],
    };
  }

  const poolLiquidityUsd = selectedPool.liquidityUsd;

  if (poolLiquidityUsd <= 0) {
    return {
      status: 'insufficient_data',
      reason: 'Selected pool has zero liquidity.',
      simulationDisclaimer: SIMULATION_DISCLAIMER,
      targetWallets,
      combinedObservedBalance: round(combinedObservedBalance, 4),
      scenarios: [],
      maxSeverity: 'low',
      evidenceIds: [],
    };
  }

  // ── Resolve swap fee ──
  // If pool fee is known, use it. Otherwise apply V2 default.
  const swapFee = selectedPool.fee.known ? selectedPool.fee.feeRate : V2_DEFAULT_SWAP_FEE;

  // ── Derive AMM virtual reserves ──
  // PROVENANCE: DERIVED — balanced 50/50 assumption; not observed on-chain.
  const tokenReserve = poolLiquidityUsd / 2 / spotPriceUsd;
  const quoteReserve = poolLiquidityUsd / 2;
  const k = tokenReserve * quoteReserve;

  // ── Simulate each liquidation fraction ──
  const scenarios: WhaleExitScenario[] = [];
  let maxSeverity: SeverityLevel = 'low';

  for (const { fraction, label } of FRACTIONS) {
    const tokensSold = combinedObservedBalance * fraction;
    const usdAtSpot = tokensSold * spotPriceUsd;

    if (tokensSold <= 0) {
      scenarios.push({
        liquidationFraction: fraction,
        label,
        simulatedTokensSold: 0,
        simulatedUsdValueAtSpot: 0,
        simulatedQuoteReceived: 0,
        simulatedExecutionPriceUsd: 0,
        priceImpactPct: 0,
        priceDeltaPct: 0,
        severity: 'low',
        status: 'insufficient_data',
        reason: 'Zero combined balance — cannot simulate.',
      });
      continue;
    }

    const tokensAdj = tokensSold * (1 - swapFee);
    const newTokenReserve = tokenReserve + tokensAdj;

    // Check if this drains the pool
    const projectedQuoteReserve = k / newTokenReserve;
    if (projectedQuoteReserve <= 0 || projectedQuoteReserve >= quoteReserve) {
      scenarios.push({
        liquidationFraction: fraction,
        label,
        simulatedTokensSold: round(tokensSold, 4),
        simulatedUsdValueAtSpot: round(usdAtSpot, 2),
        simulatedQuoteReceived: 0,
        simulatedExecutionPriceUsd: 0,
        priceImpactPct: 100,
        priceDeltaPct: 100,
        severity: 'critical',
        status: 'insufficient_data',
        reason: 'Simulated sell volume exceeds available pool liquidity.',
      });
      if (maxSeverity !== 'critical') maxSeverity = 'critical';
      continue;
    }

    const quoteReceived = quoteReserve - projectedQuoteReserve;
    const executionPriceUsd = quoteReceived / tokensSold;
    const priceDeltaPct = round(
      ((spotPriceUsd - executionPriceUsd) / spotPriceUsd) * 100,
      4
    );
    const priceImpactPct = priceDeltaPct;
    const severity = classifySeverity(priceDeltaPct);

    // Track worst severity
    const severityOrder: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
    if (severityOrder.indexOf(severity) > severityOrder.indexOf(maxSeverity)) {
      maxSeverity = severity;
    }

    scenarios.push({
      liquidationFraction: fraction,
      label,
      simulatedTokensSold: round(tokensSold, 4),
      simulatedUsdValueAtSpot: round(usdAtSpot, 2),
      simulatedQuoteReceived: round(quoteReceived, 2),
      simulatedExecutionPriceUsd: round(executionPriceUsd, 6),
      priceImpactPct: Math.max(0, priceImpactPct),
      priceDeltaPct: Math.max(0, priceDeltaPct),
      severity,
      status: 'ok',
    });
  }

  return {
    status: 'ok',
    simulationDisclaimer: SIMULATION_DISCLAIMER,
    targetWallets,
    combinedObservedBalance: round(combinedObservedBalance, 4),
    scenarios,
    maxSeverity,
    evidenceIds: ['whale-exit-simulation-top3'],
  };
}

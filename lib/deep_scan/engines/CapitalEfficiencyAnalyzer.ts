/**
 * Capital Efficiency Analyzer — Module 12
 *
 * Evaluates the token's market cap to liquidity ratio and rates price sensitivity.
 * Reuses FDV, price, and reserve values from cache without duplicate API calls.
 */

import { CapitalEfficiencyResult, CapitalSensitivity, ModuleStatus } from '../types';

function round(n: number, dp = 2): number {
  return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp);
}

/**
 * Calculate capital efficiency metrics.
 *
 * @param fdvUsd            - Fully Diluted Valuation (from DexScreener/Basic Scan)
 * @param totalLiquidityUsd - Combined liquidity reserves (from shared data layer)
 * @param spotPriceUsd      - Spot price (from shared data layer)
 */
export function analyzeCapitalEfficiency(
  fdvUsd: number,
  totalLiquidityUsd: number,
  spotPriceUsd: number
): CapitalEfficiencyResult {
  if (!fdvUsd || !totalLiquidityUsd || !spotPriceUsd || fdvUsd <= 0 || totalLiquidityUsd <= 0 || spotPriceUsd <= 0) {
    return {
      status: 'insufficient_data',
      reason: 'Missing or zero FDV, liquidity reserves, or spot price data.',
      fdvToLiquidityRatio: 0,
      capitalSensitivityMultiplier: 0,
      sensitivity: 'high',
      fdvUsd: 0,
      totalLiquidityUsd: 0,
      spotPriceUsd: 0,
      evidenceIds: [],
    };
  }

  const marketCapToLiquidityRatio = fdvUsd / totalLiquidityUsd;
  const capitalSensitivityMultiplier = marketCapToLiquidityRatio; // Standard approximation

  let sensitivity: CapitalSensitivity = 'medium';
  if (marketCapToLiquidityRatio < 10) {
    sensitivity = 'low';
  } else if (marketCapToLiquidityRatio >= 50) {
    sensitivity = 'high';
  }

  return {
    status: 'ok',
    fdvToLiquidityRatio: round(marketCapToLiquidityRatio),
    capitalSensitivityMultiplier: round(capitalSensitivityMultiplier),
    sensitivity,
    fdvUsd: round(fdvUsd),
    totalLiquidityUsd: round(totalLiquidityUsd),
    spotPriceUsd: round(spotPriceUsd, 6),
    evidenceIds: ['capital-efficiency-calculation'],
  };
}

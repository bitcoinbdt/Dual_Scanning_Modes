/**
 * Buyer Quality Analyzer — Module 6
 *
 * Profiles the recent buyer cohort from the transaction batch and
 * produces a normalized 0–100 quality score.
 *
 * NOTE: Wallet age, cross-token history, and funding source analysis
 * are UNAVAILABLE without a historical indexer (Dune/Covalent — P2).
 * All unavailable metrics are explicitly listed in the result.
 */

import {
  BuyerQualityResult,
  BuyerCohortMetrics,
  BuyerQualityFactor,
  ModuleStatus,
  normalizeAddress,
} from '../types';
import { UniversalTransaction } from '../../elevator/collectors/types';

const UNAVAILABLE_METRICS = [
  'walletAge',
  'crossTokenHistory',
  'fundingSourceAnalysis',
  'historicalWinRate',
];

function round(n: number, dp = 4): number {
  return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Analyze buyer quality from the transaction batch.
 *
 * @param transactions   - Normalized transaction batch from Elevator
 * @param cexWallets     - CEX wallets to exclude (reused from Elevator)
 * @param contractWallets - Contract wallets to exclude (reused from Elevator)
 */
export function analyzeBuyerQuality(
  transactions: UniversalTransaction[],
  cexWallets: Set<string> = new Set(),
  contractWallets: Set<string> = new Set()
): BuyerQualityResult {
  // ── Build normalized sets for lookup ──
  const normalizedCex = new Set<string>();
  for (const w of cexWallets) normalizedCex.add(normalizeAddress(w));

  const normalizedContract = new Set<string>();
  for (const w of contractWallets) normalizedContract.add(normalizeAddress(w));

  // ── Filter to buy trades ──
  const buyTrades = transactions.filter(
    (tx) => {
      const normalizedTo = normalizeAddress(tx.to);
      return (
        tx.type === 'buy' &&
        tx.isTrade === true &&
        !normalizedCex.has(normalizedTo) &&
        !normalizedContract.has(normalizedTo)
      );
    }
  );

  if (buyTrades.length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'No buy transactions found in the batch.',
      buyerQualityScore: 0,
      cohortMetrics: {
        totalBuyers: 0,
        returningBuyers: 0,
        singleUseBuyers: 0,
        returningBuyerRatio: 0,
        freshWalletRatio: 0,
        avgBuyValueUsd: 0,
        buyValueStdDevUsd: 0,
        capitalDiversityIndex: 0,
      },
      positiveFactors: [],
      negativeFactors: [],
      unavailableMetrics: UNAVAILABLE_METRICS,
      evidenceIds: ['buyer-cohort-analysis'],
      confidence: 0,
    };
  }

  // ── Per-buyer aggregation ──
  const buyerTxCounts = new Map<string, number>();
  const buyerUsdVolumes = new Map<string, number>();
  const allBuyUsdValues: number[] = [];

  for (const tx of buyTrades) {
    const normalizedTo = normalizeAddress(tx.to);
    const usdVal = tx.amount * (tx.priceUsd ?? 0);
    buyerTxCounts.set(normalizedTo, (buyerTxCounts.get(normalizedTo) ?? 0) + 1);
    buyerUsdVolumes.set(normalizedTo, (buyerUsdVolumes.get(normalizedTo) ?? 0) + usdVal);
    if (usdVal > 0) allBuyUsdValues.push(usdVal);
  }

  const totalBuyers = buyerTxCounts.size;
  const returningBuyers = [...buyerTxCounts.values()].filter((c) => c > 1).length;
  const singleUseBuyers = totalBuyers - returningBuyers;
  const returningBuyerRatio = totalBuyers > 0 ? round(returningBuyers / totalBuyers, 4) : 0;

  const totalBuyUsd = allBuyUsdValues.reduce((a, b) => a + b, 0);
  const avgBuyValueUsd = allBuyUsdValues.length > 0
    ? round(totalBuyUsd / allBuyUsdValues.length, 2)
    : 0;
  const buyValueStdDevUsd = round(stdDev(allBuyUsdValues), 2);

  // Capital diversity: lower std dev relative to mean = more uniform = more diverse
  let capitalDiversityIndex = 0;
  if (avgBuyValueUsd > 0) {
    const coefficientOfVariation = buyValueStdDevUsd / avgBuyValueUsd;
    capitalDiversityIndex = round(Math.max(0, Math.min(1, 1 - coefficientOfVariation / 2)), 4);
  }

  const cohortMetrics: BuyerCohortMetrics = {
    totalBuyers,
    returningBuyers,
    singleUseBuyers,
    returningBuyerRatio,
    freshWalletRatio: 0, // UNAVAILABLE — requires cross-token historical data
    avgBuyValueUsd,
    buyValueStdDevUsd,
    capitalDiversityIndex,
  };

  // ── Score calculation ──
  let score = 60; // base score
  const positiveFactors: BuyerQualityFactor[] = [];
  const negativeFactors: BuyerQualityFactor[] = [];

  // Positive: returning buyers
  if (returningBuyerRatio > 0.6) {
    score += 10;
    positiveFactors.push({
      name: 'High Returning Buyer Rate',
      value: `${(returningBuyerRatio * 100).toFixed(1)}%`,
      isPositive: true,
      weight: 10,
      description: 'Over 60% of buyers made multiple purchases — indicates sustained demand.',
    });
  } else if (returningBuyerRatio > 0.3) {
    score += 5;
    positiveFactors.push({
      name: 'Moderate Returning Buyers',
      value: `${(returningBuyerRatio * 100).toFixed(1)}%`,
      isPositive: true,
      weight: 5,
      description: 'Over 30% of buyers are recurring — demand shows some stickiness.',
    });
  }

  // Positive: capital diversity
  if (capitalDiversityIndex > 0.5) {
    score += 10;
    positiveFactors.push({
      name: 'Diverse Capital Distribution',
      value: capitalDiversityIndex.toFixed(3),
      isPositive: true,
      weight: 10,
      description: 'Buy sizes are reasonably uniform — suggests organic retail participation.',
    });
  }

  // Positive: sufficient buyer base
  if (totalBuyers >= 20) {
    score += 5;
    positiveFactors.push({
      name: 'Sufficient Buyer Sample',
      value: `${totalBuyers} buyers`,
      isPositive: true,
      weight: 5,
      description: 'Large buyer count provides higher confidence in quality metrics.',
    });
  }

  // Negative: mostly single-use buyers
  if (totalBuyers > 0 && singleUseBuyers / totalBuyers > 0.8) {
    score -= 20;
    negativeFactors.push({
      name: 'High Single-Use Buyer Rate',
      value: `${((singleUseBuyers / totalBuyers) * 100).toFixed(1)}%`,
      isPositive: false,
      weight: -20,
      description: 'Over 80% of buyers only bought once — may indicate snipers or one-time participants.',
    });
  }

  // Negative: extremely erratic buy sizes
  if (avgBuyValueUsd > 0 && buyValueStdDevUsd / avgBuyValueUsd > 3.0) {
    score -= 10;
    negativeFactors.push({
      name: 'Erratic Buy Size Distribution',
      value: `CV = ${(buyValueStdDevUsd / avgBuyValueUsd).toFixed(2)}`,
      isPositive: false,
      weight: -10,
      description: 'Buy sizes vary extremely — may indicate mixed retail and whale activity.',
    });
  }

  // Negative: very thin buyer base
  if (totalBuyers < 5) {
    score -= 15;
    negativeFactors.push({
      name: 'Very Few Buyers',
      value: `${totalBuyers} buyers`,
      isPositive: false,
      weight: -15,
      description: 'Fewer than 5 unique buyers in batch — demand is too thin to assess.',
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── Confidence based on sample size ──
  let confidence =
    totalBuyers >= 20 ? 80 :
    totalBuyers >= 10 ? 65 :
    totalBuyers >= 5  ? 50 : 30;

  // Reduce confidence if no priceUsd data on most transactions
  const hasPriceData = buyTrades.filter((tx) => tx.priceUsd && tx.priceUsd > 0).length;
  if (hasPriceData / buyTrades.length < 0.5) {
    confidence = Math.max(20, confidence - 10);
  }

  const status: ModuleStatus = totalBuyers < 3 ? 'partial' : 'ok';

  return {
    status,
    buyerQualityScore: score,
    cohortMetrics,
    positiveFactors,
    negativeFactors,
    unavailableMetrics: UNAVAILABLE_METRICS,
    evidenceIds: ['buyer-cohort-analysis'],
    confidence,
  };
}

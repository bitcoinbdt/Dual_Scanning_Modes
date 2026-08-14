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
import { DEEP_SCAN_CONFIG } from '../config';
import type { WalletQualityProfile } from '../../providers/adapter-types';

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
 * @param walletProfiles  - Phase 5C: real wallet quality profiles from cache/enrichment.
 *                          Wallets absent from this map are excluded from freshWalletRatio.
 */
export function analyzeBuyerQuality(
  transactions: UniversalTransaction[],
  cexWallets: Set<string> = new Set(),
  contractWallets: Set<string> = new Set(),
  walletProfiles: Map<string, WalletQualityProfile> = new Map()
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
    const buyerKey = normalizeAddress(tx.to); // buyer = receiver of the bought tokens
    const usdVal = tx.amount * (tx.priceUsd ?? 0);
    buyerTxCounts.set(buyerKey, (buyerTxCounts.get(buyerKey) ?? 0) + 1);
    buyerUsdVolumes.set(buyerKey, (buyerUsdVolumes.get(buyerKey) ?? 0) + usdVal);
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
    freshWalletRatio: 0, // populated below from real profiles when available
    avgBuyValueUsd,
    buyValueStdDevUsd,
    capitalDiversityIndex,
  };

  // ── Phase 5C: Wallet profile freshness ratio ──
  // Only buyers WITH a profile in the cache are included in the denominator.
  // Buyers without profiles are excluded — never substituted with zero.
  const FRESH_WALLET_MAX_AGE_DAYS = 7;
  const allBuyerAddresses = [...buyerTxCounts.keys()];
  const profiledBuyers = allBuyerAddresses.filter((addr) => walletProfiles.has(addr));
  const missingProfileCount = allBuyerAddresses.length - profiledBuyers.length;
  const missingProfileRatio = allBuyerAddresses.length > 0
    ? missingProfileCount / allBuyerAddresses.length
    : 0;

  let freshWalletCount = 0;
  for (const addr of profiledBuyers) {
    const profile = walletProfiles.get(addr)!;
    if (profile.walletAgeDays < FRESH_WALLET_MAX_AGE_DAYS) {
      freshWalletCount++;
    }
  }

  // freshWalletRatio is only meaningful when profiled buyers exist.
  // When profiledBuyers is empty, freshWalletRatio stays 0 and walletAge
  // remains in unavailableMetrics below.
  const walletAgeAvailable = profiledBuyers.length > 0;
  if (walletAgeAvailable) {
    cohortMetrics.freshWalletRatio = round(freshWalletCount / profiledBuyers.length, 4);
  }

  // ── Score calculation ──
  const bqCfg = DEEP_SCAN_CONFIG.buyerQuality;
  let score = bqCfg.baseScore;
  const positiveFactors: BuyerQualityFactor[] = [];
  const negativeFactors: BuyerQualityFactor[] = [];

  // Positive: returning buyers
  if (returningBuyerRatio > bqCfg.returningBuyer.highLimit) {
    score += bqCfg.returningBuyer.highBonus;
    positiveFactors.push({
      name: 'High Returning Buyer Rate',
      value: `${(returningBuyerRatio * 100).toFixed(1)}%`,
      isPositive: true,
      weight: bqCfg.returningBuyer.highBonus,
      description: `Over ${bqCfg.returningBuyer.highLimit * 100}% of buyers made multiple purchases — indicates sustained demand.`,
    });
  } else if (returningBuyerRatio > bqCfg.returningBuyer.modLimit) {
    score += bqCfg.returningBuyer.modBonus;
    positiveFactors.push({
      name: 'Moderate Returning Buyers',
      value: `${(returningBuyerRatio * 100).toFixed(1)}%`,
      isPositive: true,
      weight: bqCfg.returningBuyer.modBonus,
      description: `Over ${bqCfg.returningBuyer.modLimit * 100}% of buyers are recurring — demand shows some stickiness.`,
    });
  }

  // Positive: capital diversity
  if (capitalDiversityIndex > bqCfg.capitalDiversity.uniformLimit) {
    score += bqCfg.capitalDiversity.uniformBonus;
    positiveFactors.push({
      name: 'Diverse Capital Distribution',
      value: capitalDiversityIndex.toFixed(3),
      isPositive: true,
      weight: bqCfg.capitalDiversity.uniformBonus,
      description: 'Buy sizes are reasonably uniform — suggests organic retail participation.',
    });
  }

  // Positive: sufficient buyer base
  if (totalBuyers >= bqCfg.sampleCount.sufficientLimit) {
    score += bqCfg.sampleCount.sufficientBonus;
    positiveFactors.push({
      name: 'Sufficient Buyer Sample',
      value: `${totalBuyers} buyers`,
      isPositive: true,
      weight: bqCfg.sampleCount.sufficientBonus,
      description: 'Large buyer count provides higher confidence in quality metrics.',
    });
  }

  // Negative: mostly single-use buyers
  if (totalBuyers > 0 && singleUseBuyers / totalBuyers > bqCfg.singleUse.highLimit) {
    score -= bqCfg.singleUse.highPenalty;
    negativeFactors.push({
      name: 'High Single-Use Buyer Rate',
      value: `${((singleUseBuyers / totalBuyers) * 100).toFixed(1)}%`,
      isPositive: false,
      weight: -bqCfg.singleUse.highPenalty,
      description: `Over ${bqCfg.singleUse.highLimit * 100}% of buyers only bought once — may indicate snipers or one-time participants.`,
    });
  }

  // Negative: extremely erratic buy sizes
  if (avgBuyValueUsd > 0 && buyValueStdDevUsd / avgBuyValueUsd > bqCfg.erraticSizes.cvLimit) {
    score -= bqCfg.erraticSizes.cvPenalty;
    negativeFactors.push({
      name: 'Erratic Buy Size Distribution',
      value: `CV = ${(buyValueStdDevUsd / avgBuyValueUsd).toFixed(2)}`,
      isPositive: false,
      weight: -bqCfg.erraticSizes.cvPenalty,
      description: 'Buy sizes vary extremely — may indicate mixed retail and whale activity.',
    });
  }

  // Negative: very thin buyer base
  if (totalBuyers < bqCfg.sampleCount.thinLimit) {
    score -= bqCfg.sampleCount.thinPenalty;
    negativeFactors.push({
      name: 'Very Few Buyers',
      value: `${totalBuyers} buyers`,
      isPositive: false,
      weight: -bqCfg.sampleCount.thinPenalty,
      description: `Fewer than ${bqCfg.sampleCount.thinLimit} unique buyers in batch — demand is too thin to assess.`,
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── Confidence based on sample size ──
  const confLevels = [...bqCfg.confidenceLevels].sort((a, b) => b.minBuyers - a.minBuyers);
  let confidence = confLevels[confLevels.length - 1].confidence; // fallback to lowest if nothing matches
  const matched = confLevels.find(level => totalBuyers >= level.minBuyers);
  if (matched) {
    confidence = matched.confidence;
  }

  // Reduce confidence if no priceUsd data on most transactions
  const hasPriceData = buyTrades.filter((tx) => tx.priceUsd && tx.priceUsd > 0).length;
  if (hasPriceData / buyTrades.length < bqCfg.missingPriceThreshold) {
    confidence = Math.max(20, confidence - bqCfg.missingPricePenalty);
  }

  // Phase 5C: Reduce confidence when majority of buyers lack wallet profiles
  if (missingProfileRatio > 0.5) {
    confidence = Math.max(10, confidence - 15);
  }

  // Phase 5C: Remove 'walletAge' from unavailableMetrics when real profiles are available
  const activeUnavailableMetrics = walletAgeAvailable
    ? UNAVAILABLE_METRICS.filter((m) => m !== 'walletAge')
    : UNAVAILABLE_METRICS;

  const status: ModuleStatus = totalBuyers < bqCfg.sampleCount.insufficientLimit ? 'partial' : 'ok';

  return {
    status,
    buyerQualityScore: score,
    cohortMetrics,
    positiveFactors,
    negativeFactors,
    unavailableMetrics: activeUnavailableMetrics,
    evidenceIds: ['buyer-cohort-analysis'],
    confidence,
  };
}

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
import type { SmartMoneyReputationRecord } from '../types';

const UNAVAILABLE_METRICS = [
  'walletAge',
  'crossTokenHistory',
  'fundingSourceAnalysis',
  'historicalWinRate',
  'creatorFundingAnalysis',
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
 * @param transactions      - Normalized transaction batch from Elevator
 * @param cexWallets        - CEX wallets to exclude (reused from Elevator)
 * @param contractWallets   - Contract wallets to exclude (reused from Elevator)
 * @param walletProfiles    - Phase 5C: real wallet quality profiles from cache/enrichment.
 *                            Wallets absent from this map are excluded from freshWalletRatio.
 * @param walletReputations - Phase 5D-8: pre-fetched SmartMoney reputation records keyed by
 *                            normalised wallet address. Only top-N buyers are expected.
 *                            Wallets absent from this map are excluded from win-rate averaging.
 */
export function analyzeBuyerQuality(
  transactions: UniversalTransaction[],
  cexWallets: Set<string> = new Set(),
  contractWallets: Set<string> = new Set(),
  walletProfiles: Map<string, WalletQualityProfile> = new Map(),
  walletReputations: Map<string, SmartMoneyReputationRecord> = new Map(),
  creatorAddress?: string
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

  // ── Phase 5D-7: Wallet Quality & Funding Source Integration ──
  const bqCfg = DEEP_SCAN_CONFIG.buyerQuality;
  let profiledBuyerCount = profiledBuyers.length;
  let knownFundingSourceBuyerCount = 0;
  let uniqueFundingSourceCount = 0;
  let largestFundingSourceBuyerCount = 0;
  let largestFundingSourceBuyerRatio = 0;
  let lowActivityBuyerCount = 0;
  let lowActivityBuyerRatio = 0;
  let freshBuyerCount = 0;
  let freshBuyerRatio = 0;

  if (bqCfg.phase5D7?.enabled !== false && profiledBuyers.length > 0) {
    const fundingGroups = new Map<string, string[]>();
    const freshAgeDaysLimit = bqCfg.phase5D7?.freshAgeDaysLimit ?? 7;
    const lowActivityTxCountLimit = bqCfg.phase5D7?.lowActivityTxCountLimit ?? 5;
    const lowActivityDaysLimit = bqCfg.phase5D7?.lowActivityDaysLimit ?? 2;

    for (const addr of profiledBuyers) {
      const profile = walletProfiles.get(addr)!;

      // 1. Funding Source grouping
      if (profile.fundingSource && profile.fundingSource.trim()) {
        const normFunder = normalizeAddress(profile.fundingSource);
        if (!fundingGroups.has(normFunder)) {
          fundingGroups.set(normFunder, []);
        }
        fundingGroups.get(normFunder)!.push(addr);
        knownFundingSourceBuyerCount++;
      }

      // 2. Activity Quality
      const isLowActivity = (profile.transactionCount != null && profile.transactionCount < lowActivityTxCountLimit) ||
                            (profile.activeDaysCount != null && profile.activeDaysCount < lowActivityDaysLimit);
      if (isLowActivity) {
        lowActivityBuyerCount++;
      }

      // 3. Freshness Check (using config limit)
      if (profile.walletAgeDays < freshAgeDaysLimit) {
        freshBuyerCount++;
      }
    }

    uniqueFundingSourceCount = fundingGroups.size;
    
    // Find the largest funding source group
    for (const addrs of fundingGroups.values()) {
      if (addrs.length > largestFundingSourceBuyerCount) {
        largestFundingSourceBuyerCount = addrs.length;
      }
    }

    largestFundingSourceBuyerRatio = round(largestFundingSourceBuyerCount / profiledBuyers.length, 4);
    lowActivityBuyerRatio = round(lowActivityBuyerCount / profiledBuyers.length, 4);
    freshBuyerRatio = round(freshBuyerCount / profiledBuyers.length, 4);
  }

  // Write back into cohortMetrics
  cohortMetrics.profiledBuyerCount = profiledBuyerCount;
  cohortMetrics.knownFundingSourceBuyerCount = knownFundingSourceBuyerCount;
  cohortMetrics.uniqueFundingSourceCount = uniqueFundingSourceCount;
  cohortMetrics.largestFundingSourceBuyerCount = largestFundingSourceBuyerCount;
  cohortMetrics.largestFundingSourceBuyerRatio = largestFundingSourceBuyerRatio;
  cohortMetrics.lowActivityBuyerCount = lowActivityBuyerCount;
  cohortMetrics.lowActivityBuyerRatio = lowActivityBuyerRatio;
  cohortMetrics.freshBuyerCount = freshBuyerCount;
  cohortMetrics.freshBuyerRatio = freshBuyerRatio;

  // ── Phase 5D-8: Cross-Token History & Historical Win Rate Cohort Integration ──
  // Only uses pre-fetched cached reputation data. No live API calls are made here.
  let profiledReputationCount = 0;
  let crossTokenBuyerCount = 0;
  let crossTokenBuyerRatio: number | undefined;
  let cohortAvgWinRate: number | null | undefined;

  const bq8Cfg = bqCfg.phase5D8;
  if (bq8Cfg?.enabled !== false && walletReputations.size > 0) {
    // Walk every unique buyer in the batch and check for a reputation record.
    const uniqueBuyersNorm = [...new Set(buyTrades.map(tx => normalizeAddress(tx.to)))];
    let winRateSum = 0;
    let winRateContributors = 0;

    for (const normAddr of uniqueBuyersNorm) {
      const rep = walletReputations.get(normAddr);
      if (!rep || rep.status === 'unavailable' || rep.status === 'pending') continue;

      profiledReputationCount++;

      // Cross-token history: wallet has traded at least one other token
      const dtt = rep.distinctTokensTraded ?? 0;
      if (dtt >= 1) {
        crossTokenBuyerCount++;
      }

      // Win-rate averaging: exclude wallets with zero closed trades (no valid win rate)
      const closed = rep.closedTradeCount ?? 0;
      if (closed > 0 && rep.winRate != null) {
        winRateSum += rep.winRate;
        winRateContributors++;
      }
    }

    if (profiledReputationCount > 0) {
      crossTokenBuyerRatio = round(crossTokenBuyerCount / profiledReputationCount, 4);
    }
    if (winRateContributors > 0) {
      cohortAvgWinRate = round(winRateSum / winRateContributors, 4);
    } else {
      cohortAvgWinRate = null;
    }
  }

  // Write Phase 5D-8 fields back into cohortMetrics
  cohortMetrics.profiledReputationCount = profiledReputationCount;
  cohortMetrics.crossTokenBuyerCount = crossTokenBuyerCount;
  cohortMetrics.crossTokenBuyerRatio = crossTokenBuyerRatio;
  cohortMetrics.cohortAvgWinRate = cohortAvgWinRate;

  // ── Phase 5D-9: Creator-Funded Buyer Detection ──
  let creatorFundedBuyerCount = 0;
  let creatorFundedBuyerRatio: number | undefined;
  const creatorAddressNorm = creatorAddress ? normalizeAddress(creatorAddress) : '';

  if (creatorAddressNorm && profiledBuyers.length > 0) {
    const excludedFundingTypes = new Set(['cex', 'bridge', 'contract']);
    for (const addr of profiledBuyers) {
      const profile = walletProfiles.get(addr)!;
      if (profile.fundingSource && profile.fundingSource.trim()) {
        const normFunder = normalizeAddress(profile.fundingSource);
        if (normFunder === creatorAddressNorm) {
          const isExcluded = profile.fundingSourceType && excludedFundingTypes.has(profile.fundingSourceType);
          if (!isExcluded) {
            creatorFundedBuyerCount++;
          }
        }
      }
    }
    creatorFundedBuyerRatio = round(creatorFundedBuyerCount / profiledBuyers.length, 4);
  }

  // Write Phase 5D-9 fields back into cohortMetrics
  cohortMetrics.creatorFundedBuyerCount = creatorFundedBuyerCount;
  cohortMetrics.creatorFundedBuyerRatio = creatorFundedBuyerRatio;

  // ── Score calculation ──
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

  // ── Phase 5D-7: Score Penalties ──
  if (bqCfg.phase5D7?.enabled && profiledBuyers.length > 0) {
    const profileCoverage = profiledBuyers.length / totalBuyers;
    if (profileCoverage >= bqCfg.phase5D7.minimumProfileCoverage) {
      // 1. Funding concentration penalty
      if (
        profiledBuyers.length >= bqCfg.phase5D7.minProfiledForConcentration &&
        largestFundingSourceBuyerRatio > bqCfg.phase5D7.fundingConcentrationThreshold
      ) {
        score -= bqCfg.phase5D7.fundingConcentrationPenalty;
        negativeFactors.push({
          name: 'High Funding Concentration',
          value: `${(largestFundingSourceBuyerRatio * 100).toFixed(1)}%`,
          isPositive: false,
          weight: -bqCfg.phase5D7.fundingConcentrationPenalty,
          description: `Over ${(bqCfg.phase5D7.fundingConcentrationThreshold * 100).toFixed(0)}% of profiled buyers share the same funding origin (${largestFundingSourceBuyerCount} of ${profiledBuyers.length} profiled).`,
        });
      }

      // 2. Low activity penalty
      if (lowActivityBuyerRatio > bqCfg.phase5D7.lowActivityRatioThreshold) {
        score -= bqCfg.phase5D7.lowActivityRatioPenalty;
        negativeFactors.push({
          name: 'High Low-Activity Buyer Rate',
          value: `${(lowActivityBuyerRatio * 100).toFixed(1)}%`,
          isPositive: false,
          weight: -bqCfg.phase5D7.lowActivityRatioPenalty,
          description: `Over ${(bqCfg.phase5D7.lowActivityRatioThreshold * 100).toFixed(0)}% of profiled buyers have extremely low historical activity (${lowActivityBuyerCount} of ${profiledBuyers.length} profiled).`,
        });
      }

      // 3. Fresh wallet penalty
      if (freshBuyerRatio > bqCfg.phase5D7.freshRatioThreshold) {
        score -= bqCfg.phase5D7.freshRatioPenalty;
        negativeFactors.push({
          name: 'High Fresh Wallet Rate',
          value: `${(freshBuyerRatio * 100).toFixed(1)}%`,
          isPositive: false,
          weight: -bqCfg.phase5D7.freshRatioPenalty,
          description: `Over ${(bqCfg.phase5D7.freshRatioThreshold * 100).toFixed(0)}% of profiled buyers are fresh wallets (${freshBuyerCount} of ${profiledBuyers.length} profiled).`,
        });
      }
    }
  }

  // ── Phase 5D-8: Cross-Token History & Win Rate Score Adjustments ──
  if (bq8Cfg?.enabled !== false && profiledReputationCount > 0) {
    // Coverage gate: fraction of unique buyers in the batch that have a reputation record
    const uniqueBuyerCount = new Set(buyTrades.map(tx => normalizeAddress(tx.to))).size;
    const reputationCoverage = profiledReputationCount / Math.max(uniqueBuyerCount, 1);

    if (reputationCoverage >= bq8Cfg.minimumReputationCoverage) {
      // 1. Cross-token history penalty: cohort is mostly fresh/single-token traders
      if (crossTokenBuyerRatio !== undefined && crossTokenBuyerRatio < bq8Cfg.crossTokenThreshold) {
        score -= bq8Cfg.crossTokenPenalty;
        negativeFactors.push({
          name: 'Low Cross-Token Activity',
          value: `${(crossTokenBuyerRatio * 100).toFixed(1)}%`,
          isPositive: false,
          weight: -bq8Cfg.crossTokenPenalty,
          description: `Only ${(crossTokenBuyerRatio * 100).toFixed(1)}% of reputation-profiled buyers have traded multiple tokens — cohort appears to lack trading experience.`,
        });
      }

      // 2. Win-rate adjustments (only when valid avg win rate is available)
      if (cohortAvgWinRate != null) {
        if (cohortAvgWinRate < bq8Cfg.lowWinRateThreshold) {
          score -= bq8Cfg.lowWinRatePenalty;
          negativeFactors.push({
            name: 'Low Cohort Historical Win Rate',
            value: `${(cohortAvgWinRate * 100).toFixed(1)}%`,
            isPositive: false,
            weight: -bq8Cfg.lowWinRatePenalty,
            description: `Cohort average historical win rate of ${(cohortAvgWinRate * 100).toFixed(1)}% is below the quality threshold — buyers have a weak track record on closed trades.`,
          });
        } else if (cohortAvgWinRate >= bq8Cfg.highWinRateThreshold) {
          score += bq8Cfg.highWinRateBonus;
          positiveFactors.push({
            name: 'High Cohort Historical Win Rate',
            value: `${(cohortAvgWinRate * 100).toFixed(1)}%`,
            isPositive: true,
            weight: bq8Cfg.highWinRateBonus,
            description: `Cohort average historical win rate of ${(cohortAvgWinRate * 100).toFixed(1)}% indicates experienced, profitable traders among the buyer cohort.`,
          });
        }
      }
    }
  }

  // ── Phase 5D-9: Creator-Funded Buyer Score Adjustments ──
  const bq9Cfg = bqCfg.phase5D9;
  if (bq9Cfg?.enabled !== false && creatorAddressNorm && profiledBuyers.length > 0) {
    const profileCoverage = profiledBuyers.length / totalBuyers;
    if (profileCoverage >= bq9Cfg.minimumProfileCoverage) {
      if (creatorFundedBuyerRatio !== undefined && creatorFundedBuyerRatio > bq9Cfg.creatorFundingThreshold) {
        score -= bq9Cfg.creatorFundingPenalty;
        negativeFactors.push({
          name: 'Creator-Funded Buyers Detected',
          value: `${(creatorFundedBuyerRatio * 100).toFixed(1)}%`,
          isPositive: false,
          weight: -bq9Cfg.creatorFundingPenalty,
          description: `${creatorFundedBuyerCount} of ${profiledBuyers.length} profiled buyers show a direct funding-source match with the token creator address.`,
        });
      }
    }
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

  // Phase 5C, 5D-7, 5D-8: Remove available metrics from unavailableMetrics list when real data is present
  const reputationCoverageForFilter = profiledReputationCount / Math.max(new Set(buyTrades.map(tx => normalizeAddress(tx.to))).size, 1);
  const reputationCoverageGateMet = profiledReputationCount > 0 &&
    reputationCoverageForFilter >= (bq8Cfg?.minimumReputationCoverage ?? 0.20);

  const activeUnavailableMetrics = UNAVAILABLE_METRICS.filter((m) => {
    if (m === 'walletAge') return !walletAgeAvailable;
    if (m === 'fundingSourceAnalysis') return profiledBuyers.length === 0;
    if (m === 'crossTokenHistory') return !reputationCoverageGateMet;
    if (m === 'historicalWinRate') return !(reputationCoverageGateMet && cohortAvgWinRate != null);
    if (m === 'creatorFundingAnalysis') return !(profiledBuyers.length > 0 && creatorAddressNorm);
    return true;
  });

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

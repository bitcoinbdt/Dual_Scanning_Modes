/**
 * SmartMoney Analyzer — Phase 5D-3
 *
 * Implements strict qualification rules to flag high-value Smart Money wallets
 * and aggregates cohort-level analytics across evaluated buyer address lists.
 *
 * SERVER-SIDE ONLY.
 */

import { SmartMoneyResult, SmartMoneyReputationRecord, SmartMoneyCohortSummary, ModuleStatus } from '../types';

/**
 * Perform reputation check for SmartMoney tags on a single wallet or buyer cohort.
 *
 * Qualification Rules:
 *   - A wallet qualifies as Smart Money only when:
 *     1. >= 3 distinct traded tokens (distinctTokensTraded)
 *     2. >= 1 closed profitable trade (profitableTradeCount)
 *     3. Valid positive realized PnL (> 0)
 *     4. Valid positive ROI (> 0)
 */
export function analyzeSmartMoney(
  wallets: string | string[],
  chain: string,
  tradeHistory: any[] = [], // Kept for backward signature compatibility
  reputationsInput?: any
): SmartMoneyResult {
  const walletList = Array.isArray(wallets)
    ? wallets
    : wallets && typeof wallets === 'string' && wallets.trim()
    ? [wallets.trim()]
    : [];

  let reps: (SmartMoneyReputationRecord | null)[] = [];
  if (reputationsInput) {
    reps = Array.isArray(reputationsInput)
      ? reputationsInput
      : [reputationsInput];
  }

  // 1. Map reputations by lowercased wallet address
  const repMap = new Map<string, SmartMoneyReputationRecord>();
  for (const r of reps) {
    if (r && r.walletAddress) {
      repMap.set(r.walletAddress.toLowerCase().trim(), r);
    }
  }

  // 2. Cohort analysis counters
  let profiledWalletCount = 0;
  let smartMoneyWalletCount = 0;
  let incompleteProfileCount = 0;
  let unavailableProfileCount = 0;
  let pendingProfileCount = 0;
  let staleProfileCount = 0;

  for (const wallet of walletList) {
    const norm = wallet.toLowerCase().trim();
    const rep = repMap.get(norm);

    if (!rep) {
      unavailableProfileCount++;
      continue;
    }

    if (rep.status === 'pending') {
      pendingProfileCount++;
    } else if (rep.status === 'unavailable') {
      unavailableProfileCount++;
    } else if (rep.status === 'available') {
      profiledWalletCount++;

      if (rep.freshness === 'STALE_CACHE') {
        staleProfileCount++;
      }

      if (rep.pnlStatus === 'incomplete') {
        incompleteProfileCount++;
      }

      // Strict SmartMoney qualification rules
      const distinct = rep.distinctTokensTraded ?? 0;
      const wins = rep.profitableTradeCount ?? 0;
      const pnl = rep.realizedPnl;
      const roi = rep.roi;

      const isSmart = distinct >= 3 && wins >= 1 && pnl != null && pnl > 0 && roi != null && roi > 0;
      if (isSmart) {
        smartMoneyWalletCount++;
      }
    } else {
      unavailableProfileCount++;
    }
  }

  // 3. Ratios & status model
  const smartMoneyWalletRatio = profiledWalletCount > 0
    ? smartMoneyWalletCount / profiledWalletCount
    : null;

  const isAnySmart = smartMoneyWalletCount >= 1;

  let status: ModuleStatus = 'unavailable';
  let reason = 'No indexed trade reputation found for the evaluated wallets.';

  if (profiledWalletCount > 0) {
    status = 'ok';
    reason = `Evaluated ${profiledWalletCount} buyer wallets. Found ${smartMoneyWalletCount} Smart Money wallet(s).`;
  } else if (pendingProfileCount > 0) {
    status = 'pending';
    reason = 'SmartMoney indexing jobs are currently pending/processing in the background.';
  }

  // 4. Cohort summary block
  const cohortSummary: SmartMoneyCohortSummary = {
    profiledWalletCount,
    smartMoneyWalletCount,
    smartMoneyWalletRatio,
    smartMoneyConfidence: 0, // Calculated below
    incompleteProfileCount,
    unavailableProfileCount,
    pendingProfileCount,
    staleProfileCount,
  };

  // 5. Confidence model
  let confidence = 0;
  if (profiledWalletCount > 0) {
    let score = 100;
    // Penalize for missing/unavailable/stale wallets in cohort
    score -= unavailableProfileCount * 10;
    score -= pendingProfileCount * 15;
    score -= staleProfileCount * 5;
    score -= incompleteProfileCount * 10;
    confidence = Math.max(30, Math.min(95, score));
  }
  cohortSummary.smartMoneyConfidence = confidence;

  // 6. Expose the first available wallet's metrics in the root for backward compatibility
  const firstAvailableRep = walletList
    .map(w => repMap.get(w.toLowerCase().trim()))
    .find(r => r && r.status === 'available') ?? null;

  // Global freshness mapping
  let freshness = 'UNAVAILABLE';
  if (profiledWalletCount > 0) {
    if (staleProfileCount > 0) {
      freshness = 'STALE_CACHE';
    } else {
      freshness = reps.some(r => r && r.freshness === 'LIVE') ? 'LIVE' : 'FRESH_CACHE';
    }
  }

  return {
    status,
    reason,
    isSmartMoney: isAnySmart,
    confidence,
    metrics: {
      totalIndexedEvents:   firstAvailableRep?.totalIndexedEvents ?? null,
      recognizedSwapCount:  firstAvailableRep?.recognizedSwapCount ?? null,
      closedTradeCount:     firstAvailableRep?.closedTradeCount ?? null,
      profitableTradeCount: firstAvailableRep?.profitableTradeCount ?? null,
      losingTradeCount:     firstAvailableRep?.losingTradeCount ?? null,
      distinctTokensTraded: firstAvailableRep?.distinctTokensTraded ?? null,
      realizedPnl:          firstAvailableRep?.realizedPnl ?? null,
      realizedCostBasis:    firstAvailableRep?.realizedCostBasis ?? null,
      roi:                  firstAvailableRep?.roi ?? null,
      winRate:              firstAvailableRep?.winRate ?? null,
      openPositionCount:    firstAvailableRep?.openPositionCount ?? null,
      coverage:             firstAvailableRep?.coverage ?? null,
      pnlStatus:            firstAvailableRep?.pnlStatus ?? null,
      // Backward compatibility fields
      tradeCount:           firstAvailableRep?.tradeCount ?? null,
      profitableTrades:     firstAvailableRep?.profitableTrades ?? null,
      realizedUsdPnl:       firstAvailableRep?.realizedUsdPnl ?? null,
    },
    cohortSummary,
    evidenceIds: [],
  };
}

/**
 * Risk Scoring Engine — Module 14 / Module 9
 *
 * Aggregates individual module metrics into an explainable, weighted 0–100 risk score.
 * Explains each sub-score, lists active mitigators, and flags top prioritized risks.
 *
 * Weighted formula (applied ONLY over modules that returned measured data):
 *   - Whale Exit Risk (Module 7):          25%
 *   - AMM Slippage Risk (Module 3):        20%
 *   - Volume Concentration Risk (Module 2): 20%
 *   - Whale Distribution Risk (Module 4):  15%
 *   - Capital Efficiency Risk (Module 12): 10%
 *   - Buyer Quality Risk (Module 6):       10%
 *
 * Missing/unavailable modules:
 *   - Contribute ZERO to the overall score (no synthetic defaults).
 *   - Their weight is excluded from the denominator during normalization.
 *   - This means the overall score is a proper weighted average of observed risk only.
 *
 * Mitigators (applied to the measured score):
 *   - Renounced ownership or clean contract flags: -10 points
 *   - Broad buyer base (>30 wallets): -5 points
 */

import {
  ExplainableRiskScore,
  SubScore,
  RiskMitigator,
  RiskSignal,
  RiskLevel,
  SeverityLevel,
  ModuleStatus,
} from '../types';
import {
  AmmSlippageResult,
  VolumeConcentrationResult,
  WhaleBehaviorResult,
  WhaleExitResult,
  BuyerQualityResult,
  CapitalEfficiencyResult,
} from '../types';
import { DEEP_SCAN_CONFIG } from '../config';

function classifyRiskLevel(score: number): RiskLevel {
  const limits = DEEP_SCAN_CONFIG.riskScoring.scoreLimits;
  if (score < limits.low) return 'low';
  if (score < limits.medium) return 'medium';
  if (score < limits.high) return 'high';
  return 'critical';
}

function classifySeverity(score: number): SeverityLevel {
  const limits = DEEP_SCAN_CONFIG.riskScoring.scoreLimits;
  if (score < limits.low) return 'low';
  if (score < limits.medium) return 'medium';
  if (score < limits.high) return 'high';
  return 'critical';
}

/** Resolve dataAvailability from a module status. */
function toAvailability(status: ModuleStatus): SubScore['dataAvailability'] {
  if (status === 'ok' || status === 'partial') return 'measured';
  if (status === 'insufficient_data') return 'insufficient_data';
  return 'unavailable'; // 'error' or anything unexpected
}

/**
 * Deterministically compute the explainable risk score and map risk signals.
 *
 * KEY INVARIANT:
 *   Any module that is not 'ok' or 'partial' contributes weightedContribution = 0.
 *   The overall score is a normalized weighted average of MEASURED modules only.
 *   No hardcoded fallback score is ever injected for missing data.
 */
export function calculateRiskScore(params: {
  ammSlippage: AmmSlippageResult;
  volumeConcentration: VolumeConcentrationResult;
  whaleBehavior: WhaleBehaviorResult;
  whaleExit: WhaleExitResult;
  buyerQuality: BuyerQualityResult;
  capitalEfficiency: CapitalEfficiencyResult;
  isHoneypot?: boolean;
  // ── EVM GoPlus contract risk flags (CTR-001–007) ──
  evmContractRisk?: {
    isProxy?: boolean;           // CTR-001: upgradeable proxy
    transferPausable?: boolean;  // CTR-002: owner can pause transfers
    isBlacklisted?: boolean;     // CTR-003: owner can blacklist wallets
    ownerChangeBalance?: boolean;// CTR-004: owner can modify balances
    canTakeBackOwnership?: boolean; // CTR-005: renounced but re-takeable
    isMintable?: boolean;        // CTR-006: unlimited mint authority
    tradingCooldown?: boolean;   // CTR-007: trade cooldown
  };
  // ── Solana authority flags (SOL-CTR-001–003) ──
  solanaAuthorityRisk?: {
    mintAuthorityActive?: boolean;   // SOL-CTR-001: can mint more tokens
    freezeAuthorityActive?: boolean; // SOL-CTR-002: can freeze wallets
    upgradeAuthorityActive?: boolean;// SOL-CTR-003: program upgradeable (new token only)
  };
  socialSignals?: RiskSignal[];
  // ── Safety override inputs ──
  /** Token flagged as rug-pull by RugPatternMatcher — forces score to 100 */
  isRugPull?: boolean;
  /** Total pool liquidity in USD — forces score to 100 if < 100 USD (unless pre-graduation) */
  totalLiquidityUsd?: number;
  /** True when token is still on a bonding curve / presale (skip liquidity check) */
  isPreGraduation?: boolean;
  /** Deployer's current % holdings of total supply — forces score to 100 if > 50 */
  deployerHoldingsPct?: number;
  /** True if the token is a Large-Cap token (bypasses micro-cap heuristics like HHI warnings, exit simulator) */
  isLargeCap?: boolean;
}): ExplainableRiskScore {
  const subScores: SubScore[] = [];
  const topRisks: RiskSignal[] = [];
  const mitigators: RiskMitigator[] = [];

  // ─────────────────────────────────────────────
  // 1. AMM Slippage Risk (Weight: 20%)
  // ─────────────────────────────────────────────
  const ammStatus = params.ammSlippage.status;
  const ammAvail = toAvailability(ammStatus);
  let ammScore = 0;
  let ammConfidence = 0;

  if (ammAvail === 'measured') {
    const sim25k = params.ammSlippage.simulations.find(s => s.positionSizeUsd === 25_000);
    if (sim25k) {
      if (sim25k.status === 'ok') {
        const impact = sim25k.priceImpactPct;
        ammScore = impact < 2 ? 10 : impact < 5 ? 35 : impact < 15 ? 70 : 100;
        ammConfidence = 85;
      } else {
        // simulation failed due to pool size — that is itself a measurable risk signal
        ammScore = 100;
        ammConfidence = 90;
      }
    }
  }

  subScores.push({
    module: 'ammSlippage',
    label: 'AMM Slippage Impact',
    score: ammScore,
    weight: DEEP_SCAN_CONFIG.riskScoring.weights.ammSlippage,
    weightedContribution: ammAvail === 'measured' ? Math.round(ammScore * DEEP_SCAN_CONFIG.riskScoring.weights.ammSlippage * 100) / 100 : 0,
    confidence: ammConfidence,
    evidenceIds: params.ammSlippage.evidenceIds || [],
    dataAvailability: ammAvail,
  });

  // Only emit a risk signal when we have measured data
  if (ammAvail === 'measured' && ammScore >= 35) {
    topRisks.push({
      riskId: 'thin-liquidity-slippage',
      riskName: 'Severe Price Impact at Execution',
      severity: classifySeverity(ammScore),
      status: 'active',
      evidenceIds: params.ammSlippage.evidenceIds || [],
      description: 'A trade size of $25K incurs high price impact. Position entries or exits will suffer high slippage fees.',
      confidence: ammConfidence,
    });
  }

  // ─────────────────────────────────────────────
  // 2. Whale Exit Risk (Weight: 25%)
  // ─────────────────────────────────────────────
  const whaleExitStatus = params.whaleExit.status;
  const whaleExitAvail = toAvailability(whaleExitStatus);
  let whaleExitScore = 0;
  let whaleExitConfidence = 0;

  if (whaleExitAvail === 'measured') {
    if (params.isLargeCap === true) {
      whaleExitScore = 0;
      whaleExitConfidence = 95;
    } else {
      const scenario50 = params.whaleExit.scenarios.find(s => s.label === '50%');
      if (scenario50) {
        if (scenario50.status === 'ok') {
          const drop = scenario50.priceDeltaPct;
          whaleExitScore = drop < 10 ? 15 : drop < 25 ? 40 : drop < 50 ? 75 : 100;
        } else {
          whaleExitScore = 100;
        }
        whaleExitConfidence = 70; // local batch data
      }
    }
  }

  subScores.push({
    module: 'whaleExit',
    label: 'Whale Exit Impact',
    score: whaleExitScore,
    weight: DEEP_SCAN_CONFIG.riskScoring.weights.whaleExit,
    weightedContribution: whaleExitAvail === 'measured' ? Math.round(whaleExitScore * DEEP_SCAN_CONFIG.riskScoring.weights.whaleExit * 100) / 100 : 0,
    confidence: whaleExitConfidence,
    evidenceIds: params.whaleExit.evidenceIds || [],
    dataAvailability: whaleExitAvail,
  });

  if (whaleExitAvail === 'measured' && whaleExitScore >= 35 && params.isLargeCap !== true) {
    topRisks.push({
      riskId: 'whale-selloff-cascade',
      riskName: 'Vulnerable Whale Concentration',
      severity: classifySeverity(whaleExitScore),
      status: 'active',
      evidenceIds: params.whaleExit.evidenceIds || [],
      description: 'Simulated whale exit scenarios indicate a 50% liquidation by top holders would wipe out over 30% of token value.',
      confidence: whaleExitConfidence,
    });
  }

  // ─────────────────────────────────────────────
  // 3. Volume Concentration Risk (Weight: 20%)
  // ─────────────────────────────────────────────
  const volStatus = params.volumeConcentration.status;
  const volAvail = toAvailability(volStatus);
  let volumeScore = 0;
  let volumeConfidence = 0;

  if (volAvail === 'measured') {
    if (params.isLargeCap === true) {
      volumeScore = 0;
      volumeConfidence = 95;
    } else {
      volumeScore = 100 - params.volumeConcentration.organicScore;
      volumeConfidence = params.volumeConcentration.uniqueBuyers >= 10 ? 80 : 55;
    }
  }

  subScores.push({
    module: 'volumeConcentration',
    label: 'Volume Concentration (HHI)',
    score: volumeScore,
    weight: DEEP_SCAN_CONFIG.riskScoring.weights.volumeConcentration,
    weightedContribution: volAvail === 'measured' ? Math.round(volumeScore * DEEP_SCAN_CONFIG.riskScoring.weights.volumeConcentration * 100) / 100 : 0,
    confidence: volumeConfidence,
    evidenceIds: params.volumeConcentration.evidenceIds || [],
    dataAvailability: volAvail,
  });

  if (volAvail === 'measured' && volumeScore >= 30 && params.isLargeCap !== true) {
    topRisks.push({
      riskId: 'skewed-volume-concentration',
      riskName: 'Highly Concentrated Volume',
      severity: classifySeverity(volumeScore),
      status: 'active',
      evidenceIds: params.volumeConcentration.evidenceIds || [],
      description: 'The Herfindahl-Hirschman Index indicates volume is concentrated in a tiny number of active buyer/seller wallets.',
      confidence: volumeConfidence,
    });
  }

  // ─────────────────────────────────────────────
  // 4. Whale Behavior Risk (Weight: 15%)
  // ─────────────────────────────────────────────
  const whaleBehStatus = params.whaleBehavior.status;
  const whaleBehAvail = toAvailability(whaleBehStatus);
  let whaleBehScore = 0;
  let whaleBehConfidence = 0;

  if (whaleBehAvail === 'measured') {
    if (params.whaleBehavior.phase === 'distribution') {
      whaleBehScore = 90;
    } else if (params.whaleBehavior.phase === 'accumulation') {
      whaleBehScore = 15;
    } else if (params.whaleBehavior.phase === 'dormant') {
      // Score scales with how much supply dormant whales hold.
      // A 5% supply share → score 10; a 25%+ share → score 50 (capped).
      whaleBehScore = Math.min(50, Math.round(params.whaleBehavior.totalWhaleSupplySharePct * 2));
    } else {
      // neutral / no active direction
      whaleBehScore = 40;
    }
    whaleBehConfidence = 65;
  }

  subScores.push({
    module: 'whaleBehavior',
    label: 'Whale Directional Behavior',
    score: whaleBehScore,
    weight: DEEP_SCAN_CONFIG.riskScoring.weights.whaleBehavior,
    weightedContribution: whaleBehAvail === 'measured' ? Math.round(whaleBehScore * DEEP_SCAN_CONFIG.riskScoring.weights.whaleBehavior * 100) / 100 : 0,
    confidence: whaleBehConfidence,
    evidenceIds: params.whaleBehavior.evidenceIds || [],
    dataAvailability: whaleBehAvail,
  });

  if (whaleBehAvail === 'measured' && params.whaleBehavior.phase === 'distribution') {
    topRisks.push({
      riskId: 'active-whale-distribution',
      riskName: 'Active Whale Distribution',
      severity: classifySeverity(whaleBehScore),
      status: 'active',
      evidenceIds: params.whaleBehavior.evidenceIds || [],
      description: 'Major whale wallets are actively selling or distributing supply in this transaction batch.',
      confidence: whaleBehConfidence,
    });
  } else if (whaleBehAvail === 'measured' && params.whaleBehavior.phase === 'dormant' && params.whaleBehavior.totalWhaleSupplySharePct >= 30) {
    topRisks.push({
      riskId: 'dormant-whale-concentration',
      riskName: 'Dormant Whale Concentration',
      severity: 'medium',
      status: 'active',
      evidenceIds: params.whaleBehavior.evidenceIds || [],
      description: `Significant supply (${params.whaleBehavior.totalWhaleSupplySharePct.toFixed(1)}%) is concentrated in dormant whale wallets. Sudden re-activation presents a sell-off risk.`,
      confidence: whaleBehConfidence,
    });
  }

  // ─────────────────────────────────────────────
  // 5. Capital Efficiency Risk (Weight: 10%)
  // ─────────────────────────────────────────────
  const capStatus = params.capitalEfficiency.status;
  const capAvail = toAvailability(capStatus);
  let capScore = 0;
  let capConfidence = 0;

  if (capAvail === 'measured') {
    const sens = params.capitalEfficiency.sensitivity;
    capScore = sens === 'high' ? 90 : sens === 'medium' ? 50 : 20;
    capConfidence = 90;
  }

  subScores.push({
    module: 'capitalEfficiency',
    label: 'Capital Efficiency / Sensitivity',
    score: capScore,
    weight: DEEP_SCAN_CONFIG.riskScoring.weights.capitalEfficiency,
    weightedContribution: capAvail === 'measured' ? Math.round(capScore * DEEP_SCAN_CONFIG.riskScoring.weights.capitalEfficiency * 100) / 100 : 0,
    confidence: capConfidence,
    evidenceIds: params.capitalEfficiency.evidenceIds || [],
    dataAvailability: capAvail,
  });

  // ─────────────────────────────────────────────
  // 6. Buyer Quality Risk (Weight: 10%)
  // ─────────────────────────────────────────────
  const buyerStatus = params.buyerQuality.status;
  const buyerAvail = toAvailability(buyerStatus);
  let buyerScore = 0;
  let buyerConfidence = 0;

  if (buyerAvail === 'measured') {
    buyerScore = 100 - params.buyerQuality.buyerQualityScore;
    buyerConfidence = params.buyerQuality.confidence;
  }

  subScores.push({
    module: 'buyerQuality',
    label: 'Buyer Quality cohorts',
    score: buyerScore,
    weight: DEEP_SCAN_CONFIG.riskScoring.weights.buyerQuality,
    weightedContribution: buyerAvail === 'measured' ? Math.round(buyerScore * DEEP_SCAN_CONFIG.riskScoring.weights.buyerQuality * 100) / 100 : 0,
    confidence: buyerConfidence,
    evidenceIds: params.buyerQuality.evidenceIds || [],
    dataAvailability: buyerAvail,
  });

  // Phase 5D-9: Creator-Funded Buyers risk signal
  if (buyerAvail === 'measured') {
    const bq9Cfg = DEEP_SCAN_CONFIG.buyerQuality.phase5D9;
    const cohortM = params.buyerQuality.cohortMetrics;
    const cfRatio = cohortM.creatorFundedBuyerRatio;
    const cfCount = cohortM.creatorFundedBuyerCount ?? 0;
    const profiledCount = cohortM.profiledBuyerCount ?? 0;
    const totalBuyers = cohortM.totalBuyers;
    const profileCoverage = totalBuyers > 0 ? profiledCount / totalBuyers : 0;

    if (
      bq9Cfg?.enabled !== false &&
      cfRatio !== undefined &&
      profileCoverage >= bq9Cfg.minimumProfileCoverage &&
      cfRatio > bq9Cfg.creatorFundingThreshold
    ) {
      topRisks.push({
        riskId: 'creator-funded-buyers',
        riskName: 'Creator-Funded Buyer Cohort Detected',
        severity: cfRatio >= 0.50 ? 'critical' : 'high',
        status: 'active',
        evidenceIds: params.buyerQuality.evidenceIds || [],
        description: `${cfCount} of ${profiledCount} profiled buyers show a direct funding-source match with the token creator address (${(cfRatio * 100).toFixed(1)}% of profiled cohort).`,
        confidence: buyerConfidence,
      });
    }
  }


  // ─────────────────────────────────────────────
  // 7. Mitigators & Critical Overrides
  // ─────────────────────────────────────────────
  const verifiedHoneypot = params.isHoneypot === true;

  // Mitigator: Broad buyer base
  if (params.buyerQuality.status === 'ok' && params.buyerQuality.cohortMetrics.totalBuyers >= 30) {
    mitigators.push({
      name: 'Broad Buyer Base',
      description: 'Over 30 unique buyer addresses in the active session suggests distributed demand.',
      reductionPoints: DEEP_SCAN_CONFIG.riskScoring.mitigationPoints.broadBuyerBase,
    });
  }

  // Mitigator: Organic Volume
  if (params.volumeConcentration.status === 'ok' && params.volumeConcentration.organicScore > 80) {
    mitigators.push({
      name: 'Highly Organic Volume Profile',
      description: 'HHI volume distribution indicates a highly decentralized set of transacting accounts.',
      reductionPoints: DEEP_SCAN_CONFIG.riskScoring.mitigationPoints.organicVolume,
    });
  }

  // ─────────────────────────────────────────────
  // 7b. Contract Risk Signals (EVM CTR-001–007 & Solana SOL-CTR-001–003)
  // ─────────────────────────────────────────────
  // These are additive penalty points added directly to overallScore AFTER
  // the weighted normalization step below. They represent objective on-chain
  // facts (authority flags) rather than behavioural patterns, so they are
  // applied as flat additions rather than weighted sub-scores.
  let contractRiskPenalty = 0;

  const ctr = params.evmContractRisk;
  if (ctr) {
    if (ctr.isProxy) {
      contractRiskPenalty += 8;
      topRisks.push({ riskId: 'CTR-001', riskName: 'Upgradeable Proxy Contract', severity: 'medium', status: 'active', evidenceIds: [], description: 'Contract is an upgradeable proxy. The owner can silently alter token logic after deployment.', confidence: 95 });
    }
    if (ctr.transferPausable) {
      contractRiskPenalty += 12;
      topRisks.push({ riskId: 'CTR-002', riskName: 'Transfer Pause Function', severity: 'high', status: 'active', evidenceIds: [], description: 'Owner can pause all token transfers at any time, trapping holders.', confidence: 95 });
    }
    if (ctr.isBlacklisted) {
      contractRiskPenalty += 10;
      topRisks.push({ riskId: 'CTR-003', riskName: 'Blacklist Function Enabled', severity: 'high', status: 'active', evidenceIds: [], description: 'Owner can blacklist specific wallets, preventing them from transferring tokens.', confidence: 95 });
    }
    if (ctr.ownerChangeBalance) {
      contractRiskPenalty += 20;
      topRisks.push({ riskId: 'CTR-004', riskName: 'Owner Can Modify Balances', severity: 'critical', status: 'active', evidenceIds: [], description: 'Contract contains a function allowing the owner to directly alter any wallet\'s token balance.', confidence: 98 });
    }
    if (ctr.canTakeBackOwnership) {
      contractRiskPenalty += 15;
      topRisks.push({ riskId: 'CTR-005', riskName: 'Ownership Re-takeable Despite Renouncement', severity: 'high', status: 'active', evidenceIds: [], description: 'Ownership appears renounced but a hidden function allows the original deployer to reclaim it.', confidence: 90 });
      // Cancel the renounced-ownership mitigator if present (CTR-005 nullifies the -10 reduction)
      const renouncedIdx = mitigators.findIndex(m => m.name === 'Renounced Ownership');
      if (renouncedIdx !== -1) mitigators.splice(renouncedIdx, 1);
    }
    if (ctr.isMintable) {
      contractRiskPenalty += 12;
      topRisks.push({ riskId: 'CTR-006', riskName: 'Unlimited Mint Authority Active', severity: 'high', status: 'active', evidenceIds: [], description: 'Owner can mint an unlimited number of new tokens, enabling supply dilution or rug-pull.', confidence: 95 });
    }
    if (ctr.tradingCooldown) {
      contractRiskPenalty += 3;
      topRisks.push({ riskId: 'CTR-007', riskName: 'Trading Cooldown Restriction', severity: 'low', status: 'active', evidenceIds: [], description: 'Contract enforces a timed delay between consecutive buy or sell transactions.', confidence: 90 });
    }
  }

  const sol = params.solanaAuthorityRisk;
  if (sol) {
    if (sol.mintAuthorityActive) {
      contractRiskPenalty += 12;
      topRisks.push({ riskId: 'SOL-CTR-001', riskName: 'Mint Authority Not Revoked', severity: 'high', status: 'active', evidenceIds: [], description: 'Token mint authority is still active. The deployer can create additional supply at any time.', confidence: 95 });
    }
    if (sol.freezeAuthorityActive) {
      contractRiskPenalty += 10;
      topRisks.push({ riskId: 'SOL-CTR-002', riskName: 'Freeze Authority Not Revoked', severity: 'high', status: 'active', evidenceIds: [], description: 'Token freeze authority is still active. The deployer can freeze any holder\'s token account.', confidence: 95 });
    }
    if (sol.upgradeAuthorityActive) {
      contractRiskPenalty += 6;
      topRisks.push({ riskId: 'SOL-CTR-003', riskName: 'Program Upgrade Authority Active', severity: 'medium', status: 'active', evidenceIds: [], description: 'The underlying token program is upgradeable. Logic may be altered post-deployment.', confidence: 80 });
    }
  }

  // ─────────────────────────────────────────────
  // 7.5. Apply Social Risk Penalty & Signals
  // ─────────────────────────────────────────────
  let socialPenalty = 0;
  if (params.socialSignals) {
    for (const signal of params.socialSignals) {
      topRisks.push({
        riskId: signal.riskId || `SOC-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        riskName: signal.riskName,
        severity: signal.severity,
        status: 'active',
        evidenceIds: signal.evidenceIds || [],
        description: signal.description,
        confidence: 90,
      });

      if (signal.severity === 'critical') socialPenalty += 20;
      else if (signal.severity === 'high') socialPenalty += 12;
      else if (signal.severity === 'medium') socialPenalty += 6;
      else if (signal.severity === 'low') socialPenalty += 2;
    }
  }

  // ─────────────────────────────────────────────
  // 8. Normalized weighted score (measured modules only)
  // ─────────────────────────────────────────────
  const measuredSubScores = subScores.filter(s => s.dataAvailability === 'measured');
  const totalModuleCount = subScores.length;
  const availableModuleCount = measuredSubScores.length;

  let overallScore: number;

  if (availableModuleCount === 0) {
    // No module produced measured data; score is meaningless — return 0.
    overallScore = 0;
  } else {
    // Normalize: divide the sum of weighted contributions by the sum of measured weights
    // so the resulting score is still on the 0–100 scale regardless of how many modules contributed.
    const measuredWeightSum = measuredSubScores.reduce((sum, s) => sum + s.weight, 0);
    const rawWeightedSum = measuredSubScores.reduce((sum, s) => sum + s.score * s.weight, 0);
    overallScore = rawWeightedSum / measuredWeightSum;

    // Apply mitigators
    const totalReduction = mitigators.reduce((sum, m) => sum + m.reductionPoints, 0);
    overallScore = Math.max(0, overallScore - totalReduction);

    // Apply contract risk penalty (CTR/SOL-CTR flat additive points) + social penalty — capped at 100
    overallScore = Math.min(100, overallScore + contractRiskPenalty + socialPenalty);
  }

  if (verifiedHoneypot) {
    overallScore = 100;
    topRisks.unshift({
      riskId: 'honeypot-verified',
      riskName: 'Verified Honeypot Contract',
      severity: 'critical',
      status: 'active',
      evidenceIds: [],
      description: 'Basic scan flagged this contract as a honeypot. Standard users cannot execute sell transactions.',
      confidence: 100,
    });
  }

  if (params.isRugPull === true) {
    overallScore = 100;
    topRisks.unshift({
      riskId: 'rugpull-verified',
      riskName: 'Verified Rug Pull Pattern',
      severity: 'critical',
      status: 'active',
      evidenceIds: [],
      description: 'Historical deployer behavior, wallet history, or bytecode matches known rug-pull signatures.',
      confidence: 100,
    });
  }

  if (params.totalLiquidityUsd !== undefined && params.totalLiquidityUsd < 100 && params.isPreGraduation !== true) {
    overallScore = 100;
    topRisks.unshift({
      riskId: 'extremely-low-liquidity',
      riskName: 'Extremely Low Liquidity',
      severity: 'critical',
      status: 'active',
      evidenceIds: [],
      description: `Token liquidity ($${params.totalLiquidityUsd.toFixed(2)}) is below $100. Trade execution is highly dangerous.`,
      confidence: 100,
    });
  }

  if (params.deployerHoldingsPct !== undefined && params.deployerHoldingsPct > 50) {
    overallScore = 100;
    topRisks.unshift({
      riskId: 'excessive-deployer-holdings',
      riskName: 'Excessive Deployer Holdings',
      severity: 'critical',
      status: 'active',
      evidenceIds: [],
      description: `Deployer wallet holds ${params.deployerHoldingsPct.toFixed(1)}% of total supply, presenting extreme dump risk.`,
      confidence: 100,
    });
  }

  const roundedOverallScore = Math.round(overallScore);
  const riskLevel = classifyRiskLevel(roundedOverallScore);

  // Collect all unique evidence IDs from measured modules only
  const allEvidenceIds = Array.from(new Set(
    measuredSubScores.flatMap(s => s.evidenceIds)
  ));

  // Aggregate confidence from measured modules only
  const confidence = availableModuleCount > 0
    ? Math.round(measuredSubScores.reduce((sum, s) => sum + s.confidence, 0) / availableModuleCount)
    : 0;

  // Sufficient data: at least one module produced a measured score or any override is active
  const sufficientData = availableModuleCount > 0 ||
    verifiedHoneypot ||
    params.isRugPull === true ||
    (params.totalLiquidityUsd !== undefined && params.totalLiquidityUsd < 100 && params.isPreGraduation !== true) ||
    (params.deployerHoldingsPct !== undefined && params.deployerHoldingsPct > 50);

  // Score completeness
  const scoreCompleteness: ExplainableRiskScore['scoreCompleteness'] =
    !sufficientData ? 'insufficient_data'
    : availableModuleCount === totalModuleCount ? 'complete'
    : 'partial';

  const status: ModuleStatus = verifiedHoneypot
    ? 'ok'
    : sufficientData
    ? 'ok'
    : 'insufficient_data';

  return {
    status,
    overallRiskScore: roundedOverallScore,
    riskLevel,
    subScores,
    topRisks: topRisks.slice(0, DEEP_SCAN_CONFIG.riskScoring.topRisksMax),
    mitigators,
    confidence,
    evidenceIds: allEvidenceIds,
    sufficientData,
    scoreCompleteness,
    availableModuleCount,
    totalModuleCount,
  };
}

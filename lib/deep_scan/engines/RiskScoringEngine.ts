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

  if (whaleExitAvail === 'measured' && whaleExitScore >= 35) {
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
    volumeScore = 100 - params.volumeConcentration.organicScore;
    volumeConfidence = params.volumeConcentration.uniqueBuyers >= 10 ? 80 : 55;
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

  if (volAvail === 'measured' && volumeScore >= 30) {
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
    if (params.whaleBehavior.isDistributionRisk) {
      whaleBehScore = 90;
    } else if (params.whaleBehavior.phase === 'accumulation') {
      whaleBehScore = 15;
    } else {
      whaleBehScore = Math.min(100, params.whaleBehavior.totalWhaleSupplySharePct * 2);
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

  if (whaleBehAvail === 'measured' && whaleBehScore >= 35) {
    topRisks.push({
      riskId: 'active-whale-distribution',
      riskName: 'Active Whale Distribution',
      severity: classifySeverity(whaleBehScore),
      status: 'active',
      evidenceIds: params.whaleBehavior.evidenceIds || [],
      description: 'Major whale wallets are actively selling or distributing supply in this transaction batch.',
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

  // Sufficient data: at least one module produced a measured score
  const sufficientData = availableModuleCount > 0 || verifiedHoneypot;

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

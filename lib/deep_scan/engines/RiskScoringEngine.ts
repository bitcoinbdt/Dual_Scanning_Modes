/**
 * Risk Scoring Engine — Module 14 / Module 9
 *
 * Aggregates individual module metrics into a explainable, weighted 0–100 risk score.
 * Explains each sub-score, lists active mitigators, and flags top prioritized risks.
 *
 * Weighted formula:
 *   - Whale Exit Risk (Module 7): 25%
 *   - AMM Slippage Risk (Module 3): 20%
 *   - Volume Concentration Risk (Module 2): 20%
 *   - Whale Distribution Risk (Module 4): 15%
 *   - Capital Efficiency Risk (Module 12): 10%
 *   - Buyer Quality Risk (Module 6): 10%
 *
 * Mitigators:
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

function classifyRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
}

function classifySeverity(score: number): SeverityLevel {
  if (score < 30) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
}

/**
 * Deterministically compute the explainable risk score and map risk signals.
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
  let ammRisk = 50; // default if insufficient data
  let ammConfidence = 50;
  if (params.ammSlippage.status === 'ok') {
    const sim25k = params.ammSlippage.simulations.find(s => s.positionSizeUsd === 25_000);
    if (sim25k) {
      if (sim25k.status === 'ok') {
        const impact = sim25k.priceImpactPct;
        ammRisk = impact < 2 ? 10 : impact < 5 ? 35 : impact < 15 ? 70 : 100;
        ammConfidence = 85;
      } else {
        // simulation failed due to pool size
        ammRisk = 100;
        ammConfidence = 90;
      }
    }
  }
  subScores.push({
    module: 'ammSlippage',
    label: 'AMM Slippage Impact',
    score: ammRisk,
    weight: 0.20,
    weightedContribution: Math.round(ammRisk * 0.20 * 100) / 100,
    confidence: ammConfidence,
    evidenceIds: params.ammSlippage.evidenceIds || [],
  });

  if (ammRisk >= 35) {
    topRisks.push({
      riskId: 'thin-liquidity-slippage',
      riskName: 'Severe Price Impact at Execution',
      severity: classifySeverity(ammRisk),
      status: 'active',
      evidenceIds: params.ammSlippage.evidenceIds || [],
      description: 'A trade size of $25K incurs high price impact. Position entries or exits will suffer high slippage fees.',
      confidence: ammConfidence,
    });
  }

  // ─────────────────────────────────────────────
  // 2. Whale Exit Risk (Weight: 25%)
  // ─────────────────────────────────────────────
  let whaleExitRisk = 40;
  let whaleExitConfidence = 50;
  if (params.whaleExit.status === 'ok') {
    const scenario50 = params.whaleExit.scenarios.find(s => s.label === '50%');
    if (scenario50) {
      if (scenario50.status === 'ok') {
        const drop = scenario50.priceDeltaPct;
        whaleExitRisk = drop < 10 ? 15 : drop < 25 ? 40 : drop < 50 ? 75 : 100;
      } else {
        whaleExitRisk = 100;
      }
      whaleExitConfidence = 70; // local batch data
    }
  }
  subScores.push({
    module: 'whaleExit',
    label: 'Whale Exit Impact',
    score: whaleExitRisk,
    weight: 0.25,
    weightedContribution: Math.round(whaleExitRisk * 0.25 * 100) / 100,
    confidence: whaleExitConfidence,
    evidenceIds: params.whaleExit.evidenceIds || [],
  });

  if (whaleExitRisk >= 35) {
    topRisks.push({
      riskId: 'whale-selloff-cascade',
      riskName: 'Vulnerable Whale Concentration',
      severity: classifySeverity(whaleExitRisk),
      status: 'active',
      evidenceIds: params.whaleExit.evidenceIds || [],
      description: 'Simulated whale exit scenarios indicate a 50% liquidation by top holders would wipe out over 30% of token value.',
      confidence: whaleExitConfidence,
    });
  }

  // ─────────────────────────────────────────────
  // 3. Volume Concentration Risk (Weight: 20%)
  // ─────────────────────────────────────────────
  let volumeRisk = 40;
  let volumeConfidence = 50;
  if (params.volumeConcentration.status === 'ok') {
    volumeRisk = 100 - params.volumeConcentration.organicScore;
    volumeConfidence = params.volumeConcentration.uniqueBuyers >= 10 ? 80 : 55;
  }
  subScores.push({
    module: 'volumeConcentration',
    label: 'Volume Concentration (HHI)',
    score: volumeRisk,
    weight: 0.20,
    weightedContribution: Math.round(volumeRisk * 0.20 * 100) / 100,
    confidence: volumeConfidence,
    evidenceIds: params.volumeConcentration.evidenceIds || [],
  });

  if (volumeRisk >= 30) {
    topRisks.push({
      riskId: 'skewed-volume-concentration',
      riskName: 'Highly Concentrated Volume',
      severity: classifySeverity(volumeRisk),
      status: 'active',
      evidenceIds: params.volumeConcentration.evidenceIds || [],
      description: 'The Herfindahl-Hirschman Index indicates volume is concentrated in a tiny number of active buyer/seller wallets.',
      confidence: volumeConfidence,
    });
  }

  // ─────────────────────────────────────────────
  // 4. Whale Behavior Risk (Weight: 15%)
  // ─────────────────────────────────────────────
  let whaleBehRisk = 30;
  let whaleBehConfidence = 50;
  if (params.whaleBehavior.status === 'ok') {
    if (params.whaleBehavior.isDistributionRisk) {
      whaleBehRisk = 90;
    } else if (params.whaleBehavior.phase === 'accumulation') {
      whaleBehRisk = 15;
    } else {
      whaleBehRisk = Math.min(100, params.whaleBehavior.totalWhaleSupplySharePct * 2);
    }
    whaleBehConfidence = 65;
  }
  subScores.push({
    module: 'whaleBehavior',
    label: 'Whale Directional Behavior',
    score: whaleBehRisk,
    weight: 0.15,
    weightedContribution: Math.round(whaleBehRisk * 0.15 * 100) / 100,
    confidence: whaleBehConfidence,
    evidenceIds: params.whaleBehavior.evidenceIds || [],
  });

  if (whaleBehRisk >= 35) {
    topRisks.push({
      riskId: 'active-whale-distribution',
      riskName: 'Active Whale Distribution',
      severity: classifySeverity(whaleBehRisk),
      status: 'active',
      evidenceIds: params.whaleBehavior.evidenceIds || [],
      description: 'Major whale wallets are actively selling or distributing supply in this transaction batch.',
      confidence: whaleBehConfidence,
    });
  }

  // ─────────────────────────────────────────────
  // 5. Capital Efficiency Risk (Weight: 10%)
  // ─────────────────────────────────────────────
  let capRisk = 50;
  let capConfidence = 50;
  if (params.capitalEfficiency.status === 'ok') {
    const sens = params.capitalEfficiency.sensitivity;
    capRisk = sens === 'high' ? 90 : sens === 'medium' ? 50 : 20;
    capConfidence = 90;
  }
  subScores.push({
    module: 'capitalEfficiency',
    label: 'Capital Efficiency / Sensitivity',
    score: capRisk,
    weight: 0.10,
    weightedContribution: Math.round(capRisk * 0.10 * 100) / 100,
    confidence: capConfidence,
    evidenceIds: params.capitalEfficiency.evidenceIds || [],
  });

  // ─────────────────────────────────────────────
  // 6. Buyer Quality Risk (Weight: 10%)
  // ─────────────────────────────────────────────
  let buyerRisk = 40;
  let buyerConfidence = 50;
  if (params.buyerQuality.status === 'ok' || params.buyerQuality.status === 'partial') {
    buyerRisk = 100 - params.buyerQuality.buyerQualityScore;
    buyerConfidence = params.buyerQuality.confidence;
  }
  subScores.push({
    module: 'buyerQuality',
    label: 'Buyer Quality cohorts',
    score: buyerRisk,
    weight: 0.10,
    weightedContribution: Math.round(buyerRisk * 0.10 * 100) / 100,
    confidence: buyerConfidence,
    evidenceIds: params.buyerQuality.evidenceIds || [],
  });

  // ─────────────────────────────────────────────
  // 7. Mitigators & Critical Overrides
  // ─────────────────────────────────────────────
  // Honeypot absolute override: if verified honeypot, override score to 100
  const verifiedHoneypot = params.isHoneypot === true;
  
  // Mitigator: Broad buyer base
  if (params.buyerQuality.status === 'ok' && params.buyerQuality.cohortMetrics.totalBuyers >= 30) {
    mitigators.push({
      name: 'Broad Buyer Base',
      description: 'Over 30 unique buyer addresses in the active session suggests distributed demand.',
      reductionPoints: 5,
    });
  }

  // Mitigator: Organic Volume
  if (params.volumeConcentration.status === 'ok' && params.volumeConcentration.organicScore > 80) {
    mitigators.push({
      name: 'Highly Organic Volume Profile',
      description: 'HHI volume distribution indicates a highly decentralized set of transacting accounts.',
      reductionPoints: 5,
    });
  }

  // Calculate weighted sum
  let overallScore = subScores.reduce((sum, s) => sum + s.weightedContribution, 0);
  
  // Apply mitigators
  const totalReduction = mitigators.reduce((sum, m) => sum + m.reductionPoints, 0);
  overallScore = Math.max(0, overallScore - totalReduction);
  
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

  // Collect all unique evidence IDs
  const allEvidenceIds = Array.from(new Set(subScores.flatMap((s) => s.evidenceIds)));

  // Compute aggregate confidence
  const validScores = subScores.filter(s => s.confidence > 0);
  const confidence = validScores.length > 0 
    ? Math.round(validScores.reduce((sum, s) => sum + s.confidence, 0) / validScores.length)
    : 50;

  // ── Sufficient data check ──
  // If every module returned insufficient_data, the score is based
  // entirely on hardcoded defaults and MUST NOT be trusted.
  const sufficientData =
    params.ammSlippage.status === 'ok' ||
    params.volumeConcentration.status === 'ok' ||
    params.whaleBehavior.status === 'ok' ||
    params.whaleExit.status === 'ok' ||
    (params.buyerQuality.status === 'ok' || params.buyerQuality.status === 'partial') ||
    params.capitalEfficiency.status === 'ok';

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
    topRisks: topRisks.slice(0, 5), // return top 5 maximum
    mitigators,
    confidence,
    evidenceIds: allEvidenceIds,
    sufficientData,
  };
}

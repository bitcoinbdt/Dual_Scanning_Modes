/**
 * Trader Intelligence Generator — Module 15
 *
 * Compiles final structured outputs into the Markdown layout defined in report_prompt.md.
 * Ensures strict compliance with no-fabrication constraints.
 */

import {
  TraderIntelligenceReport,
  RegimeLabel,
  RiskLevel,
  EvidenceNode,
  RiskSignal,
  ModuleStatus,
} from '../types';
import {
  AmmSlippageResult,
  VolumeConcentrationResult,
  WhaleBehaviorResult,
  WhaleExitResult,
  BuyerQualityResult,
  CapitalEfficiencyResult,
  ExplainableRiskScore,
  MarketRegimeResult,
  LiquidityFragmentationResult,
} from '../types';

/**
 * Generate a trader-focused markdown report from structured analysis.
 */
export function generateTraderIntelligenceReport(params: {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  network: string;
  ammSlippage: AmmSlippageResult;
  volumeConcentration: VolumeConcentrationResult;
  whaleBehavior: WhaleBehaviorResult;
  whaleExit: WhaleExitResult;
  buyerQuality: BuyerQualityResult;
  marketRegime: MarketRegimeResult;
  capitalEfficiency: CapitalEfficiencyResult;
  liquidityFragmentation?: LiquidityFragmentationResult;
  riskScore: ExplainableRiskScore;
  evidence: EvidenceNode[];
  dataQuality: {
    staleDataWarning: boolean;
    elevatorDataReused: boolean;
    transactionCount: number;
    ohlcvCandleCount: number;
  };
  limitations: string[];
  scanId: string;
  timestamp: number;
}): TraderIntelligenceReport {
  const timestampStr = new Date(params.timestamp).toUTCString();

  // ── 1. Executive Summary & Market Regime ──
  const regime = params.marketRegime?.regime ?? 'INSUFFICIENT_DATA';
  const regimeConf = params.marketRegime?.confidence ?? 0;
  
  let traderCondition = 'Caution';
  if (params.riskScore.overallRiskScore >= 75) {
    traderCondition = 'Extreme Risk';
  } else if (params.riskScore.overallRiskScore >= 50) {
    traderCondition = 'High Risk';
  } else if (params.riskScore.overallRiskScore < 30) {
    traderCondition = 'Healthy';
  }

  // Key Conclusion
  let keyConclusion = 'Trading activity is within typical parameters.';
  if (params.riskScore.overallRiskScore >= 75) {
    keyConclusion = 'EXTREME EXECUTION RISK: Thin liquidity pools combined with high holder concentration make exit pathways fragile.';
  } else if (regime === 'BREAKOUT' && params.buyerQuality.buyerQualityScore > 70) {
    keyConclusion = 'Volume BREAKOUT detected: last candle volume is anomalously high versus the 24h batch mean. Confirm on-chain before acting.';
  } else if (regime === 'MOMENTUM' && params.buyerQuality.buyerQualityScore > 70) {
    keyConclusion = 'Breakout phase backed by high-quality buyer cohort; liquidity remains sufficient for standard positions.';
  } else if (params.whaleBehavior.phase === 'dormant') {
    keyConclusion = 'Large holders are present but made no trades in the scanned window. Sudden re-activation could shift supply dynamics rapidly.';
  } else if (params.whaleBehavior.isDistributionRisk) {
    keyConclusion = 'WARNING: Identified whale balances show distribution activity in this batch window, presenting selling pressure.';
  }

  const executiveSummary = params.riskScore.sufficientData
    ? `This token is currently in a ${regime} market phase with a safety condition of ${traderCondition}. ${keyConclusion}`
    : `⚠️ INSUFFICIENT DATA: The risk score of ${params.riskScore.overallRiskScore}/100 is based entirely on default values — no module returned usable data for this scan. Do not rely on this score for trading decisions. Market regime: ${regime}.`;

  // Regime narrative: add BREAKOUT-specific context
  let regimeNarrativeExtra = params.marketRegime?.regimeDescription ?? '';
  if (regime === 'BREAKOUT') {
    const zScore = params.marketRegime?.stats?.volumeZScore;
    if (zScore !== undefined) {
      regimeNarrativeExtra += ` Volume Z-score: ${zScore.toFixed(2)} (vs. 24h batch mean). This data is window-scoped and does NOT imply future continuation.`;
    }
  } else if (regime === 'DEAD') {
    regimeNarrativeExtra += ' This classification does NOT constitute financial advice. Verify liquidity and trading activity independently.';
  }
  const regimeNarrative = `Regime is classified as ${regime} with ${regimeConf}% confidence. ${regimeNarrativeExtra} Note: This describes current behavior, not future outcomes.`;

  // ── 3. Position Execution Simulations ──
  let executionConditions = 'Simulation results: ';
  const simsNarratives: string[] = [];
  if (params.ammSlippage.status === 'ok') {
    for (const sim of params.ammSlippage.simulations) {
      const formattedSize = `$${sim.positionSizeUsd.toLocaleString()}`;
      if (sim.status === 'ok') {
        const impactLabel = sim.priceImpactPct < 2 ? 'Clean' : sim.priceImpactPct < 5 ? 'Moderate Impact' : sim.priceImpactPct < 15 ? 'High Slippage' : 'Extreme Impact';
        simsNarratives.push(`${formattedSize} Position: Price Impact: ${sim.priceImpactPct.toFixed(2)}% | Slippage: ${sim.slippagePct.toFixed(2)}% | Execution: ${impactLabel}`);
      } else {
        simsNarratives.push(`${formattedSize} Position: Simulation Failed (${sim.reason ?? 'drains pool'}) | Execution: Critical Impact`);
      }
    }
    executionConditions = simsNarratives.join('\n');
  } else {
    executionConditions = 'AMM simulation unavailable: ' + (params.ammSlippage.reason ?? 'Missing pool data.');
  }

  // ── 4. Whale & Holder Risk ──
  let holderRisk = `Whale holdings constitute ${params.whaleBehavior.totalWhaleSupplySharePct}% of supply (local batch balance observations). `;

  // Phase classification narrative
  if (params.whaleBehavior.phase === 'dormant') {
    holderRisk += `Whale phase: DORMANT — identified large holders made zero buys or sells in this scan window. ` +
      `This may reflect deliberate inactivity or a position established before the scan window. ` +
      `Sudden re-activation is a tail risk not captured by this batch.`;
  } else if (params.whaleBehavior.phase === 'distribution') {
    holderRisk += `Whale phase: DISTRIBUTION — net outflow from large holders observed. `;
  } else if (params.whaleBehavior.phase === 'accumulation') {
    holderRisk += `Whale phase: ACCUMULATION — net inflow to large holders observed. `;
  }

  // Freshness composition summary (Phase 4)
  const whaleCount = params.whaleBehavior.whales?.length ?? 0;
  if (whaleCount > 0) {
    const freshCount    = params.whaleBehavior.whales.filter(w => w.freshnessTag === 'fresh').length;
    const recentCount   = params.whaleBehavior.whales.filter(w => w.freshnessTag === 'recent').length;
    const estCount      = params.whaleBehavior.whales.filter(w => w.freshnessTag === 'established').length;
    const unknownCount  = params.whaleBehavior.whales.filter(w => w.freshnessTag === 'unknown').length;
    if (freshCount + recentCount + estCount > 0) {
      holderRisk += ` Wallet freshness (90-day window): ${freshCount} fresh (<7d), ${recentCount} recent (7–30d), ${estCount} established (>30d), ${unknownCount} unknown.`;
    }
  }

  // Exit simulation
  if (params.whaleExit.status === 'ok') {
    const sc50 = params.whaleExit.scenarios.find(s => s.label === '50%');
    if (sc50 && sc50.status === 'ok') {
      holderRisk += ` A simulated liquidation of 50% of whale batch balances would cause an estimated ${sc50.priceDeltaPct.toFixed(1)}% price drop on the primary pool.`;
    }
  }

  // ── 5. Volume Quality ──
  let volumeQuality = `Unique transactors: ${params.volumeConcentration.uniqueBuyers} buyers, ${params.volumeConcentration.uniqueSellers} sellers. `;
  if (params.volumeConcentration.status === 'ok') {
    volumeQuality += `Buyer concentration HHI: ${params.volumeConcentration.buyerHHI.hhi.toFixed(4)} (${params.volumeConcentration.buyerHHI.concentrationLevel} concentration). `;
    if (params.volumeConcentration.washVolumeRatio > 0.05) {
      volumeQuality += `Elevator wash detection flags ${(params.volumeConcentration.washVolumeRatio * 100).toFixed(1)}% of trading volume as wash-related.`;
    }
  }

  // ── 6. Buyer Quality Cohorts ──
  let buyerQualityAssessment = `Buyer Quality Score: ${params.buyerQuality.buyerQualityScore}/100. `;
  if (params.buyerQuality.status === 'ok') {
    buyerQualityAssessment += `${(params.buyerQuality.cohortMetrics.returningBuyerRatio * 100).toFixed(1)}% returning buyers, with capital diversity rating ${params.buyerQuality.cohortMetrics.capitalDiversityIndex.toFixed(3)}.`;
  }

  // ── 7. Capital Efficiency ──
  let capitalEfficiencyAssessment = 'Capital efficiency metrics: ';
  if (params.capitalEfficiency.status === 'ok') {
    capitalEfficiencyAssessment = `FDV to Liquidity Ratio is ${params.capitalEfficiency.fdvToLiquidityRatio.toFixed(2)}x (uses Fully Diluted Valuation, not circulating market cap). Capital sensitivity multiplier: ${params.capitalEfficiency.capitalSensitivityMultiplier.toFixed(2)}x (Sensitivity: ${params.capitalEfficiency.sensitivity.toUpperCase()}).`;
  } else {
    capitalEfficiencyAssessment = 'Capital efficiency unavailable: ' + (params.capitalEfficiency.reason ?? 'Missing data.');
  }

  // ── 7b. Liquidity Fragmentation (Phase 4) ──
  let liquidityFragmentationAssessment = '';
  const frag = params.liquidityFragmentation;
  if (frag && frag.status === 'ok') {
    liquidityFragmentationAssessment =
      `Liquidity fragmentation across ${frag.poolCount} pool(s): pool HHI ${frag.poolHHI.toFixed(4)} (${frag.concentrationLevel} concentration). ` +
      (frag.isDominantPool
        ? `A single pool holds ≥80% of total liquidity — slippage estimates apply to that pool only; multi-pool routing is minimal.`
        : `Liquidity is spread across multiple pools; execution price may vary by pool.`);
  }

  // ── 8. Top Prioritized Risks Summary ──
  const topRisksSummary = params.riskScore.topRisks.map((risk, index) => {
    return `${index + 1}. **${risk.riskName}** (Severity: ${risk.severity.toUpperCase()})\n   * **Evidence**: IDs: ${risk.evidenceIds.join(', ')}\n   * **Impact**: ${risk.description}`;
  });

  return {
    status: 'ok',
    scanId: params.scanId,
    generatedAt: timestampStr,
    executiveSummary,
    regimeNarrative,
    executionConditions,
    holderRisk,
    volumeQuality,
    buyerQualityAssessment,
    capitalEfficiencyAssessment: liquidityFragmentationAssessment
      ? capitalEfficiencyAssessment + ' ' + liquidityFragmentationAssessment
      : capitalEfficiencyAssessment,
    topRisksSummary,
    confidence: params.riskScore.confidence,
    dataLimitations: params.limitations,
  };
}

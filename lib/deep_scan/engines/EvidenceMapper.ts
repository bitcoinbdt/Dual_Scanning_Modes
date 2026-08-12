/**
 * Evidence Mapper
 *
 * Builds typed EvidenceNode objects from module outputs.
 * Every signal in Deep Scan must be traceable to an EvidenceNode.
 *
 * Rules:
 *  - Never fabricate transaction hashes
 *  - Mark simulated events explicitly
 *  - Only reference data that was actually observed
 */

import { EvidenceNode } from '../types';

let _evidenceCounter = 0;

/**
 * Generate a scan-scoped deterministic evidence ID.
 * Format: `<prefix>-<n>` where n is a monotonically increasing counter reset
 * at the start of each scan via resetEvidenceCounter().
 *
 * WHY: Runtime timestamp IDs (e.g. `amm-pool-1735000000000-1`) can never be
 * referenced by static strings in engine results. All ID ownership belongs
 * exclusively to EvidenceMapper; engines must receive IDs back from the mapper.
 */
function makeId(prefix: string): string {
  _evidenceCounter += 1;
  return `${prefix}-${_evidenceCounter}`;
}

/**
 * Reset the scan-scoped evidence counter.
 * Must be called once at the start of each scan in DeepScanService to
 * ensure IDs are deterministic and do not leak across scan invocations.
 */
export function resetEvidenceCounter(): void {
  _evidenceCounter = 0;
}

// ─────────────────────────────────────────────
// AMM Pool evidence
// ─────────────────────────────────────────────

export function buildAmmPoolEvidence(params: {
  poolAddress: string;
  liquidityUsd: number;
  spotPriceUsd: number;
  swapFee: number;
  snapshotAt: number;
  impactAt1k: number;
  impactAt50k: number;
}): EvidenceNode {
  return {
    evidenceId: makeId('amm-pool'),
    fact: `Pool ${params.poolAddress} holds $${params.liquidityUsd.toFixed(2)} USD liquidity at spot price $${params.spotPriceUsd.toFixed(6)}/token (snapshot: ${new Date(params.snapshotAt * 1000).toISOString()}).`,
    metric: `Price impact: $1K sell → ${params.impactAt1k.toFixed(2)}% | $50K sell → ${params.impactAt50k.toFixed(2)}%`,
    pattern: 'Constant-product AMM (Uniswap V2 model), fee = ' + (params.swapFee * 100).toFixed(1) + '%',
    signal:
      params.impactAt50k > 15
        ? 'CRITICAL_EXECUTION_SLIPPAGE'
        : params.impactAt50k > 5
        ? 'HIGH_EXECUTION_SLIPPAGE'
        : 'ACCEPTABLE_EXECUTION_SLIPPAGE',
    traderImpact:
      params.impactAt50k > 15
        ? `A $50K position sell causes ${params.impactAt50k.toFixed(1)}% price impact — large positions face severe execution risk.`
        : `Slippage is within acceptable range for medium-sized positions.`,
    confidence: 85,
    sources: [params.poolAddress, `DexScreener/GeckoTerminal pool snapshot at ${params.snapshotAt}`],
    generatedAt: Math.floor(Date.now() / 1000),
  };
}

// ─────────────────────────────────────────────
// Whale exit simulation evidence (SIMULATION ONLY)
// ─────────────────────────────────────────────

export function buildWhaleExitEvidence(params: {
  targetWallets: string[];
  combinedBalance: number;
  scenario: '10%' | '25%' | '50%';
  priceDeltaPct: number;
  isSimulated: true;
}): EvidenceNode {
  const id = makeId('whale-exit-sim');
  return {
    evidenceId: id,
    fact: `SIMULATED EVENT: Top ${params.targetWallets.length} whale wallet(s) [${params.targetWallets.slice(0, 2).join(', ')}${params.targetWallets.length > 2 ? '...' : ''}] hold a combined batch-observed balance of ${params.combinedBalance.toFixed(2)} tokens. This is a local batch observation, not an authoritative balance.`,
    metric: `Simulated ${params.scenario} liquidation → ${params.priceDeltaPct.toFixed(2)}% price decline`,
    pattern: 'Constant-product AMM exit simulation — not an actual transaction',
    signal:
      params.priceDeltaPct >= 30
        ? 'CRITICAL_WHALE_EXIT_RISK'
        : params.priceDeltaPct >= 15
        ? 'HIGH_WHALE_EXIT_RISK'
        : params.priceDeltaPct >= 5
        ? 'MEDIUM_WHALE_EXIT_RISK'
        : 'LOW_WHALE_EXIT_RISK',
    traderImpact: `If top whales liquidated ${params.scenario} of their observed holdings, price would decline approximately ${params.priceDeltaPct.toFixed(1)}% (SIMULATION ONLY).`,
    confidence: 70, // Lower confidence because based on batch balances, not authoritative
    sources: [
      `SIMULATION — NOT AN ACTUAL TRANSACTION`,
      ...params.targetWallets.slice(0, 3),
    ],
    generatedAt: Math.floor(Date.now() / 1000),
  };
}

// ─────────────────────────────────────────────
// Volume HHI evidence
// ─────────────────────────────────────────────

export function buildVolumeHHIEvidence(params: {
  buyerHHI: number;
  sellerHHI: number;
  uniqueBuyers: number;
  uniqueSellers: number;
  totalVolumeUsd: number;
  washVolumeRatio: number;
  topBuyerWallet?: string;
  topBuyerSharePct?: number;
}): EvidenceNode {
  return {
    evidenceId: makeId('volume-hhi'),
    fact: `${params.uniqueBuyers} unique buyers, ${params.uniqueSellers} unique sellers across $${params.totalVolumeUsd.toFixed(2)} total USD volume in this transaction batch.`,
    metric: `Buyer HHI = ${params.buyerHHI.toFixed(4)} | Seller HHI = ${params.sellerHHI.toFixed(4)} | Wash volume ratio (Elevator) = ${(params.washVolumeRatio * 100).toFixed(1)}%`,
    pattern:
      params.buyerHHI > 0.35
        ? 'Extremely concentrated — top buyers dominate volume'
        : params.buyerHHI > 0.18
        ? 'High concentration — a few wallets control most buy activity'
        : 'Reasonably distributed buying activity',
    signal:
      params.buyerHHI > 0.35
        ? 'EXTREME_BUYER_CONCENTRATION'
        : params.buyerHHI > 0.18
        ? 'HIGH_BUYER_CONCENTRATION'
        : 'NORMAL_BUYER_DISTRIBUTION',
    traderImpact:
      params.buyerHHI > 0.35
        ? 'Volume is dominated by a handful of wallets — organic demand cannot be confirmed. Exit risk is elevated.'
        : 'Volume distribution appears reasonably organic across multiple buyers.',
    confidence: params.uniqueBuyers >= 10 ? 80 : 55,
    sources: [
      `Batch: ${params.uniqueBuyers} buyers, ${params.uniqueSellers} sellers`,
      params.topBuyerWallet
        ? `Top buyer: ${params.topBuyerWallet} (${params.topBuyerSharePct?.toFixed(1)}% of buy volume)`
        : 'Top buyer data unavailable',
    ],
    generatedAt: Math.floor(Date.now() / 1000),
  };
}

// ─────────────────────────────────────────────
// Whale behavior evidence
// ─────────────────────────────────────────────

export function buildWhaleBehaviorEvidence(params: {
  whaleCount: number;
  totalWhaleSupplySharePct: number;
  netInflowTokens: number;
  netOutflowTokens: number;
  phase: string;
}): EvidenceNode {
  return {
    evidenceId: makeId('whale-behavior'),
    fact: `${params.whaleCount} whale wallet(s) identified from batch transaction data holding a combined ${params.totalWhaleSupplySharePct.toFixed(1)}% of total supply (LOCAL BATCH OBSERVATION — not authoritative on-chain balance).`,
    metric: `Net inflow: ${params.netInflowTokens.toFixed(2)} tokens | Net outflow: ${params.netOutflowTokens.toFixed(2)} tokens | Phase: ${params.phase.toUpperCase()}`,
    pattern:
      params.phase === 'accumulation'
        ? 'Whale wallets are net buyers in this transaction window'
        : params.phase === 'distribution'
        ? 'Whale wallets are net sellers in this transaction window'
        : 'No dominant directional bias detected in whale wallets',
    signal:
      params.phase === 'distribution' && params.totalWhaleSupplySharePct > 15
        ? 'HIGH_WHALE_DISTRIBUTION_RISK'
        : params.phase === 'accumulation'
        ? 'WHALE_ACCUMULATION_SIGNAL'
        : 'WHALE_NEUTRAL',
    traderImpact:
      params.phase === 'distribution' && params.totalWhaleSupplySharePct > 15
        ? `Whale wallets controlling ${params.totalWhaleSupplySharePct.toFixed(1)}% of supply are net sellers. Elevated exit risk.`
        : params.phase === 'accumulation'
        ? `Large wallets are net buyers. May indicate demand at current price levels.`
        : 'Whale activity shows no dominant direction in this batch window.',
    confidence: 65, // Batch data only — lower confidence than authoritative
    sources: [
      `Local batch observation: ${params.whaleCount} whales`,
      `Supply share computed from batch balance, not on-chain snapshot`,
    ],
    generatedAt: Math.floor(Date.now() / 1000),
  };
}

// ─────────────────────────────────────────────
// Market regime evidence
// ─────────────────────────────────────────────

export function buildMarketRegimeEvidence(params: {
  regime: string;
  candleCount: number;
  priceSlopePct: number;
  volumeSlope: number;
  priceVolatility: number;
  totalPriceChangePct: number;
  confidence: number;
}): EvidenceNode {
  return {
    evidenceId: makeId('market-regime'),
    fact: `${params.candleCount} OHLCV candles analyzed. Total price change: ${params.totalPriceChangePct.toFixed(2)}%.`,
    metric: `Price slope/candle: ${(params.priceSlopePct * 100).toFixed(3)}% | Volume slope/candle: ${params.volumeSlope.toFixed(2)} | Volatility (std dev): ${(params.priceVolatility * 100).toFixed(2)}%`,
    pattern: `Regime classified as ${params.regime} based on price direction, volume trend, and volatility`,
    signal: `REGIME_${params.regime}`,
    traderImpact: `Market is currently in ${params.regime} phase. This describes CURRENT behavior only — not a prediction of future price.`,
    confidence: params.confidence,
    sources: [`OHLCV candle series (${params.candleCount} candles from Birdeye/Elevator)`],
    generatedAt: Math.floor(Date.now() / 1000),
  };
}

// ─────────────────────────────────────────────
// Capital efficiency evidence
// ─────────────────────────────────────────────

export function buildCapitalEfficiencyEvidence(params: {
  fdvUsd: number;
  liquidityUsd: number;
  ratio: number;
  sensitivity: string;
  multiplier: number;
}): EvidenceNode {
  return {
    evidenceId: makeId('capital-efficiency'),
    fact: `FDV: $${params.fdvUsd.toLocaleString()} | Total Liquidity: $${params.liquidityUsd.toLocaleString()} | FDV/Liquidity Ratio: ${params.ratio.toFixed(2)}x (Note: uses Fully Diluted Valuation, not circulating market cap)`,
    metric: `Capital Sensitivity Multiplier: ${params.multiplier.toFixed(2)}x | Sensitivity: ${params.sensitivity.toUpperCase()}`,
    pattern:
      params.ratio > 50
        ? 'Extremely thin liquidity relative to valuation — price is highly sensitive to capital flows'
        : params.ratio > 10
        ? 'Moderate liquidity depth relative to valuation'
        : 'Healthy liquidity depth relative to valuation',
    signal:
      params.sensitivity === 'high'
        ? 'HIGH_CAPITAL_SENSITIVITY'
        : params.sensitivity === 'medium'
        ? 'MEDIUM_CAPITAL_SENSITIVITY'
        : 'LOW_CAPITAL_SENSITIVITY',
    traderImpact:
      params.sensitivity === 'high'
        ? `With a ${params.ratio.toFixed(1)}x MC/Liquidity ratio, small capital movements cause disproportionate price changes. Entry and exit require careful sizing.`
        : `Capital sensitivity is manageable at ${params.ratio.toFixed(1)}x ratio.`,
    confidence: 90,
    sources: [
      `FDV from DexScreener/GeckoTerminal`,
      `Pool liquidity from shared data layer`,
    ],
    generatedAt: Math.floor(Date.now() / 1000),
  };
}

// ─────────────────────────────────────────────
// Buyer quality evidence
// ─────────────────────────────────────────────

export function buildBuyerQualityEvidence(params: {
  score: number;
  totalBuyers: number;
  returningBuyerRatio: number;
  capitalDiversityIndex: number;
  unavailableMetrics: string[];
}): EvidenceNode {
  return {
    evidenceId: makeId('buyer-quality'),
    fact: `${params.totalBuyers} unique buyers analyzed in this transaction batch. ${(params.returningBuyerRatio * 100).toFixed(1)}% are returning buyers (appeared multiple times in this window).`,
    metric: `Buyer Quality Score: ${params.score}/100 | Capital Diversity Index: ${params.capitalDiversityIndex.toFixed(3)}`,
    pattern:
      params.returningBuyerRatio > 0.5
        ? 'Majority of buyers are repeat participants — suggests sustained demand'
        : 'Most buyers are single-occurrence — may indicate one-time interest or sniping',
    signal:
      params.score >= 70
        ? 'HIGH_BUYER_QUALITY'
        : params.score >= 45
        ? 'MEDIUM_BUYER_QUALITY'
        : 'LOW_BUYER_QUALITY',
    traderImpact:
      params.score < 45
        ? 'Low buyer quality suggests demand may be thin or one-sided. Position risk is elevated.'
        : `Buyer quality at ${params.score}/100 is ${params.score >= 70 ? 'healthy' : 'moderate'}. Wallet age and cross-token history unavailable (${params.unavailableMetrics.join(', ')}).`,
    confidence: params.totalBuyers >= 20 ? 80 : params.totalBuyers >= 10 ? 65 : 40,
    sources: [
      `Batch transaction analysis: ${params.totalBuyers} buyers`,
      `UNAVAILABLE: ${params.unavailableMetrics.join(', ')} (requires historical indexer)`,
    ],
    generatedAt: Math.floor(Date.now() / 1000),
  };
}

// ─────────────────────────────────────────────
// Utility: collect all EvidenceNodes into a deduplicated list
// ─────────────────────────────────────────────

export function collectEvidence(...nodes: (EvidenceNode | EvidenceNode[])[]): EvidenceNode[] {
  const seen = new Set<string>();
  const result: EvidenceNode[] = [];
  for (const item of nodes) {
    const arr = Array.isArray(item) ? item : [item];
    for (const node of arr) {
      if (!seen.has(node.evidenceId)) {
        seen.add(node.evidenceId);
        result.push(node);
      }
    }
  }
  return result;
}

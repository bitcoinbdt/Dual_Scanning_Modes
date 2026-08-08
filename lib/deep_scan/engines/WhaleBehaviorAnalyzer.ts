/**
 * Whale Behavior Analyzer — Module 4
 *
 * Identifies whale wallets using dynamic thresholds and classifies their
 * accumulation/distribution phase from the transaction batch.
 *
 * CRITICAL DATA SEMANTIC:
 *   All balances are derived from the LOCAL TRANSACTION BATCH WINDOW.
 *   They are OBSERVATIONS, not authoritative on-chain holder balances.
 *   This is enforced by the dataSemanticWarning field in the result.
 *
 * Dynamic thresholds (per DEEP_SCAN_SCOPE.md):
 *   Supply threshold:    >= 1% of total supply
 *   Liquidity threshold: >= 5% of total pool liquidity value
 */

import {
  WhaleBehaviorResult,
  WhaleEntry,
  WhalePhase,
  ModuleStatus,
  normalizeAddress,
} from '../types';
import { UniversalTransaction, HolderInfo } from '../../elevator/collectors/types';

const SUPPLY_THRESHOLD_PCT = 1.0;    // 1%
const LIQUIDITY_THRESHOLD_PCT = 5.0; // 5%

const DATA_SEMANTIC_WARNING =
  'Whale balances are derived from the local transaction batch window only. ' +
  'They are observations, not authoritative on-chain holder balances.';

function round(n: number, dp = 4): number {
  const factor = Math.pow(10, dp);
  return Math.round(n * factor) / factor;
}

/**
 * Analyze whale behavior from batch transaction data.
 *
 * @param transactions        - Normalized transaction batch from Elevator
 * @param batchHolders        - Top holders derived from the batch (Elevator output)
 * @param totalSupply         - Token total supply (from Basic Scan)
 * @param totalLiquidityUsd   - Total pool liquidity in USD (from shared data layer)
 * @param spotPriceUsd        - Spot price in USD (from shared data layer)
 * @param cexWallets          - CEX wallets to exclude (reused from Elevator)
 * @param contractWallets     - Contract/system wallets to exclude (reused from Elevator)
 */
export function analyzeWhaleBehavior(
  transactions: UniversalTransaction[],
  batchHolders: HolderInfo[],
  totalSupply: number,
  totalLiquidityUsd: number,
  spotPriceUsd: number,
  cexWallets: Set<string> = new Set(),
  contractWallets: Set<string> = new Set()
): WhaleBehaviorResult {
  // ── Validation ──
  if (!batchHolders || batchHolders.length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'No holder data available from transaction batch.',
      dataSemanticWarning: DATA_SEMANTIC_WARNING,
      supplyThresholdPct: SUPPLY_THRESHOLD_PCT,
      liquidityThresholdPct: LIQUIDITY_THRESHOLD_PCT,
      whales: [],
      activeWhaleCount: 0,
      totalWhaleSupplySharePct: 0,
      whaleNetInflow: 0,
      whaleNetOutflow: 0,
      phase: 'insufficient_data',
      isDistributionRisk: false,
      evidenceIds: [],
    };
  }

  if (totalSupply <= 0) {
    return {
      status: 'insufficient_data',
      reason: 'Total supply is zero or unavailable — cannot compute whale supply share.',
      dataSemanticWarning: DATA_SEMANTIC_WARNING,
      supplyThresholdPct: SUPPLY_THRESHOLD_PCT,
      liquidityThresholdPct: LIQUIDITY_THRESHOLD_PCT,
      whales: [],
      activeWhaleCount: 0,
      totalWhaleSupplySharePct: 0,
      whaleNetInflow: 0,
      whaleNetOutflow: 0,
      phase: 'insufficient_data',
      isDistributionRisk: false,
      evidenceIds: [],
    };
  }

  // ── Build wallet net flow map from transactions ──
  const netFlowByWallet = new Map<string, number>();
  const txCountByWallet = new Map<string, number>();

  for (const tx of transactions) {
    if (!tx.isTrade) continue;

    const normalizedTo = normalizeAddress(tx.to);
    const normalizedFrom = normalizeAddress(tx.from);

    // For a buy: receiver (tx.to) gets tokens → positive inflow
    // For a sell: sender (tx.from) sends tokens → negative flow (outflow)
    if (tx.type === 'buy') {
      netFlowByWallet.set(normalizedTo, (netFlowByWallet.get(normalizedTo) ?? 0) + tx.amount);
      txCountByWallet.set(normalizedTo, (txCountByWallet.get(normalizedTo) ?? 0) + 1);
    } else if (tx.type === 'sell') {
      netFlowByWallet.set(normalizedFrom, (netFlowByWallet.get(normalizedFrom) ?? 0) - tx.amount);
      txCountByWallet.set(normalizedFrom, (txCountByWallet.get(normalizedFrom) ?? 0) + 1);
    }
  }

  // ── Identify whales ──
  const whales: WhaleEntry[] = [];

  // ── Build normalized sets for lookup ──
  const normalizedCex = new Set<string>();
  for (const w of cexWallets) normalizedCex.add(normalizeAddress(w));

  const normalizedContract = new Set<string>();
  for (const w of contractWallets) normalizedContract.add(normalizeAddress(w));

  for (const holder of batchHolders) {
    const wallet = holder.wallet;
    const normalizedWallet = normalizeAddress(wallet);

    // Skip filtered addresses
    const isFiltered = normalizedCex.has(normalizedWallet) || normalizedContract.has(normalizedWallet);
    if (isFiltered) continue;

    const supplySharePct = round((holder.balance / totalSupply) * 100, 4);

    // Liquidity share (if data available)
    let liquiditySharePct: number | undefined;
    if (totalLiquidityUsd > 0 && spotPriceUsd > 0) {
      const holderValueUsd = holder.balance * spotPriceUsd;
      liquiditySharePct = round((holderValueUsd / totalLiquidityUsd) * 100, 4);
    }

    const isAboveSupplyThreshold = supplySharePct >= SUPPLY_THRESHOLD_PCT;
    const isAboveLiquidityThreshold =
      liquiditySharePct !== undefined && liquiditySharePct >= LIQUIDITY_THRESHOLD_PCT;

    // Include as whale if above either threshold
    if (!isAboveSupplyThreshold && !isAboveLiquidityThreshold) continue;

    const netFlow = netFlowByWallet.get(normalizedWallet) ?? 0;

    whales.push({
      wallet, // preserves original case
      observedBatchBalance: round(holder.balance, 4),
      supplySharePct,
      liquiditySharePct,
      isAboveSupplyThreshold,
      isAboveLiquidityThreshold,
      netFlow: round(netFlow, 4),
      txCount: txCountByWallet.get(normalizedWallet) ?? holder.tx_count ?? 0,
      isFiltered: false,
    });
  }

  // ── Aggregate phase metrics ──
  let totalWhaleSupplySharePct = 0;
  let whaleNetInflow = 0;
  let whaleNetOutflow = 0;

  for (const w of whales) {
    totalWhaleSupplySharePct += w.supplySharePct;
    if (w.netFlow > 0) whaleNetInflow += w.netFlow;
    else whaleNetOutflow += Math.abs(w.netFlow);
  }

  totalWhaleSupplySharePct = round(totalWhaleSupplySharePct, 2);

  // ── Phase classification ──
  let phase: WhalePhase;
  if (whales.length === 0) {
    phase = 'insufficient_data';
  } else if (whaleNetInflow > whaleNetOutflow * 1.2) {
    phase = 'accumulation';
  } else if (whaleNetOutflow > whaleNetInflow * 1.2) {
    phase = 'distribution';
  } else {
    phase = 'neutral';
  }

  const isDistributionRisk = phase === 'distribution' && totalWhaleSupplySharePct > 15;

  return {
    status: 'ok',
    dataSemanticWarning: DATA_SEMANTIC_WARNING,
    supplyThresholdPct: SUPPLY_THRESHOLD_PCT,
    liquidityThresholdPct: LIQUIDITY_THRESHOLD_PCT,
    whales,
    activeWhaleCount: whales.length,
    totalWhaleSupplySharePct,
    whaleNetInflow: round(whaleNetInflow, 4),
    whaleNetOutflow: round(whaleNetOutflow, 4),
    phase,
    isDistributionRisk,
    evidenceIds: ['whale-batch-balances', 'whale-net-flows'],
  };
}

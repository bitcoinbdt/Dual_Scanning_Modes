/**
 * Volume Concentration Analyzer — Module 2
 *
 * Computes Herfindahl-Hirschman Index (HHI) over buy and sell volumes
 * from a normalized transaction batch.
 *
 * HHI = Σ(si²), where si = wallet_volume / total_volume
 * Range: 0 (perfectly distributed) → 1 (single-wallet monopoly)
 *
 * IMPORTANT:
 *  - Wash trading detection is REUSED from Elevator's existing batch detector.
 *  - Deep Scan does NOT re-implement basic round-trip detection.
 *  - This module EXPANDS by computing cross-wallet volume concentration (HHI).
 */

import {
  VolumeConcentrationResult,
  HHIResult,
  WalletVolumeEntry,
  ModuleStatus,
  normalizeAddress,
} from '../types';
import { UniversalTransaction } from '../../elevator/collectors/types';
import { DEEP_SCAN_CONFIG } from '../config';

function round(n: number, dp = 4): number {
  const factor = Math.pow(10, dp);
  return Math.round(n * factor) / factor;
}

function computeHHI(
  volumeByWallet: Map<string, number>,
  totalVolume: number
): HHIResult {
  if (totalVolume <= 0 || volumeByWallet.size === 0) {
    return {
      hhi: 0,
      concentrationLevel: 'low',
      topWallets: [],
    };
  }

  let hhi = 0;
  const walletEntries: WalletVolumeEntry[] = [];

  for (const [wallet, volume] of volumeByWallet.entries()) {
    const share = volume / totalVolume;
    hhi += share * share;
    walletEntries.push({
      wallet,
      volumeUsd: round(volume, 2),
      txCount: 0, // filled below
      shareOfTotal: round(share, 6),
    });
  }

  walletEntries.sort((a, b) => b.volumeUsd - a.volumeUsd);
  const topWallets = walletEntries.slice(0, 5);

  const hhiThresholds = DEEP_SCAN_CONFIG.volumeHhi.thresholds;
  const concentrationLevel =
    hhi < hhiThresholds.low ? 'low' :
    hhi < hhiThresholds.moderate ? 'moderate' :
    hhi < hhiThresholds.high ? 'high' : 'extreme';

  return {
    hhi: round(hhi, 6),
    concentrationLevel,
    topWallets,
  };
}

/**
 * Analyze volume concentration using HHI.
 *
 * @param transactions     - Normalized transaction batch from Elevator
 * @param washTraderWallets - Wallets flagged by Elevator's basic wash detector (REUSED)
 */
export function analyzeVolumeConcentration(
  transactions: UniversalTransaction[],
  washTraderWallets: Set<string> = new Set(),
  cexWallets: Set<string> = new Set(),
  contractWallets: Set<string> = new Set()
): VolumeConcentrationResult {
  if (!transactions || transactions.length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'No transactions available for volume concentration analysis.',
      totalBuyVolumeUsd: 0,
      totalSellVolumeUsd: 0,
      buySellRatio: 0,
      uniqueBuyers: 0,
      uniqueSellers: 0,
      buyerHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] },
      sellerHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] },
      totalVolumeHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] },
      elevatorWashTraderCount: 0,
      elevatorWashVolumeUsd: 0,
      washVolumeRatio: 0,
      volumePriceDivergence: false,
      organicScore: 0,
      evidenceIds: [],
    };
  }

  // ── Filter to trades with price data ──
  const trades = transactions.filter(
    (tx) =>
      tx.isTrade === true &&
      tx.priceUsd !== undefined &&
      tx.priceUsd !== null &&
      tx.priceUsd > 0 &&
      tx.amount > 0
  );

  if (trades.length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'No trade transactions with price data found.',
      totalBuyVolumeUsd: 0,
      totalSellVolumeUsd: 0,
      buySellRatio: 0,
      uniqueBuyers: 0,
      uniqueSellers: 0,
      buyerHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] },
      sellerHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] },
      totalVolumeHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] },
      elevatorWashTraderCount: 0,
      elevatorWashVolumeUsd: 0,
      washVolumeRatio: 0,
      volumePriceDivergence: false,
      organicScore: 0,
      evidenceIds: [],
    };
  }

  // ── Build normalized sets for lookup ──
  const normalizedWash = new Set<string>();
  for (const w of washTraderWallets) normalizedWash.add(normalizeAddress(w));

  const normalizedCex = new Set<string>();
  for (const w of cexWallets) normalizedCex.add(normalizeAddress(w));

  const normalizedContract = new Set<string>();
  for (const w of contractWallets) normalizedContract.add(normalizeAddress(w));

  // ── Build per-wallet buy/sell volumes ──
  const buyVolumeByWallet = new Map<string, number>();
  const sellVolumeByWallet = new Map<string, number>();
  const buyTxCountByWallet = new Map<string, number>();
  const sellTxCountByWallet = new Map<string, number>();
  const allWalletVolume = new Map<string, number>();

  // Map normalized wallet -> original casing (to preserve casing in final results)
  const originalWalletCase = new Map<string, string>();
  const getOriginalCase = (addr: string): string => {
    const norm = normalizeAddress(addr);
    if (!originalWalletCase.has(norm)) {
      originalWalletCase.set(norm, addr);
    }
    return originalWalletCase.get(norm)!;
  };

  let totalBuyVolumeUsd = 0;
  let totalSellVolumeUsd = 0;
  let elevatorWashVolumeUsd = 0;
  const elevatorWashWalletsFound = new Set<string>();

  for (const tx of trades) {
    const usdVolume = tx.amount * (tx.priceUsd ?? 0);
    // Determine the relevant wallet for this side of the trade
    const buyerWallet = tx.to;
    const sellerWallet = tx.from;

    const normalizedBuyer = normalizeAddress(buyerWallet);
    const normalizedSeller = normalizeAddress(sellerWallet);

    // Populate original casings
    getOriginalCase(buyerWallet);
    getOriginalCase(sellerWallet);

    // Elevator wash trader accounting (REUSE — not re-detection)
    const isWashTrader = normalizedWash.has(normalizeAddress(tx.from)) || normalizedWash.has(normalizeAddress(tx.to));
    if (isWashTrader) {
      elevatorWashVolumeUsd += usdVolume;
      if (normalizedWash.has(normalizeAddress(tx.from))) elevatorWashWalletsFound.add(normalizeAddress(tx.from));
      if (normalizedWash.has(normalizeAddress(tx.to))) elevatorWashWalletsFound.add(normalizeAddress(tx.to));
    }

    if (tx.type === 'buy') {
      // Skip CEX and contract wallets from HHI computation (F-1 fix)
      if (!normalizedCex.has(normalizedBuyer) && !normalizedContract.has(normalizedBuyer)) {
        totalBuyVolumeUsd += usdVolume;
        buyVolumeByWallet.set(normalizedBuyer, (buyVolumeByWallet.get(normalizedBuyer) ?? 0) + usdVolume);
        buyTxCountByWallet.set(normalizedBuyer, (buyTxCountByWallet.get(normalizedBuyer) ?? 0) + 1);
        allWalletVolume.set(normalizedBuyer, (allWalletVolume.get(normalizedBuyer) ?? 0) + usdVolume);
      }
    } else if (tx.type === 'sell') {
      // Skip CEX and contract wallets from HHI computation (F-1 fix)
      if (!normalizedCex.has(normalizedSeller) && !normalizedContract.has(normalizedSeller)) {
        totalSellVolumeUsd += usdVolume;
        sellVolumeByWallet.set(normalizedSeller, (sellVolumeByWallet.get(normalizedSeller) ?? 0) + usdVolume);
        sellTxCountByWallet.set(normalizedSeller, (sellTxCountByWallet.get(normalizedSeller) ?? 0) + 1);
        allWalletVolume.set(normalizedSeller, (allWalletVolume.get(normalizedSeller) ?? 0) + usdVolume);
      }
    }
  }

  // ── Fill tx counts into buyer/seller HHI wallets ──
  const buyerHHI = computeHHI(buyVolumeByWallet, totalBuyVolumeUsd);
  buyerHHI.topWallets = buyerHHI.topWallets.map((w) => ({
    ...w,
    wallet: originalWalletCase.get(w.wallet) ?? w.wallet,
    txCount: buyTxCountByWallet.get(w.wallet) ?? 0,
  }));

  const sellerHHI = computeHHI(sellVolumeByWallet, totalSellVolumeUsd);
  sellerHHI.topWallets = sellerHHI.topWallets.map((w) => ({
    ...w,
    wallet: originalWalletCase.get(w.wallet) ?? w.wallet,
    txCount: sellTxCountByWallet.get(w.wallet) ?? 0,
  }));

  const totalVolumeUsd = totalBuyVolumeUsd + totalSellVolumeUsd;
  const totalVolumeHHI = computeHHI(allWalletVolume, totalVolumeUsd);
  totalVolumeHHI.topWallets = totalVolumeHHI.topWallets.map((w) => ({
    ...w,
    wallet: originalWalletCase.get(w.wallet) ?? w.wallet,
  }));

  // ── Derived metrics ──
  const buySellRatio =
    totalSellVolumeUsd > 0 ? round(totalBuyVolumeUsd / totalSellVolumeUsd, 4) : 0;

  const washVolumeRatio =
    totalVolumeUsd > 0 ? round(elevatorWashVolumeUsd / totalVolumeUsd, 4) : 0;

  // Simple proxy for volume-price divergence:
  // High buyer concentration + very skewed buy/sell ratio
  const divCfg = DEEP_SCAN_CONFIG.volumeHhi.divergence;
  const volumePriceDivergence =
    buyerHHI.hhi > divCfg.buyerHhiLimit && buySellRatio > divCfg.buySellRatioLimit;

  // ── Organic score: higher = more organic ──
  // Penalize: high buyer HHI, high wash volume, high seller HHI
  const organicWeights = DEEP_SCAN_CONFIG.volumeHhi.organicWeights;
  const rawScore =
    100 -
    buyerHHI.hhi * organicWeights.buyerHhi -
    washVolumeRatio * organicWeights.washRatio -
    sellerHHI.hhi * organicWeights.sellerHhi;
  const organicScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    status: 'ok',
    totalBuyVolumeUsd: round(totalBuyVolumeUsd, 2),
    totalSellVolumeUsd: round(totalSellVolumeUsd, 2),
    buySellRatio,
    uniqueBuyers: buyVolumeByWallet.size,
    uniqueSellers: sellVolumeByWallet.size,
    buyerHHI,
    sellerHHI,
    totalVolumeHHI,
    elevatorWashTraderCount: elevatorWashWalletsFound.size,
    elevatorWashVolumeUsd: round(elevatorWashVolumeUsd, 2),
    washVolumeRatio,
    volumePriceDivergence,
    organicScore,
    evidenceIds: ['volume-hhi-buyers', 'volume-hhi-sellers'],
  };
}

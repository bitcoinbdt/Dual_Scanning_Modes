/**
 * Deep Scan Service
 *
 * Coordinates the Deep Scan analysis lifecycle.
 * Reuses Elevator and Basic scan caches.
 */

import { DeepScanInput, DeepScanResult, EvidenceNode, normalizeAddress } from './types';
import { simulateAmmSlippage } from './engines/AmmSlippageSimulator';
import { analyzeVolumeConcentration } from './engines/VolumeConcentrationAnalyzer';
import { analyzeWhaleBehavior } from './engines/WhaleBehaviorAnalyzer';
import { simulateWhaleExit } from './engines/WhaleExitSimulator';
import { analyzeBuyerQuality } from './engines/BuyerQualityAnalyzer';
import { analyzeMarketRegime } from './engines/MarketRegimeAnalyzer';
import { analyzeCapitalEfficiency } from './engines/CapitalEfficiencyAnalyzer';
import { calculateRiskScore } from './engines/RiskScoringEngine';
import { generateTraderIntelligenceReport } from './engines/TraderIntelligenceGenerator';
import * as EvidenceMapper from './engines/EvidenceMapper';

import { CollectorFactory, SupportedBlockchain } from '../elevator/collectors/CollectorFactory';
import { scanEVMToken } from '../blockchain/evmScanner';
import { scanSolanaToken } from '../blockchain/solanaScanner';
import { detectWashTrading } from '../elevator/washTradingDetector';

// ── Session cache with TTL eviction ──
// Key = 'deep:<userId>:<network>:<normalizedAddress>' — scoped per user and network to prevent leaks.
// Entries expire after CACHE_TTL_MS. If userId is absent, caching is skipped entirely.
const CACHE_TTL_MS = 60_000; // 60 seconds
export const sessionCache = new Map<string, { result: DeepScanResult; expiresAt: number }>();

export function cleanExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of sessionCache.entries()) {
    if (now > entry.expiresAt) {
      sessionCache.delete(key);
    }
  }
}

export function getCachedResult(key: string): DeepScanResult | null {
  cleanExpiredEntries(); // Bounded inline cleanup
  const entry = sessionCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(key);
    return null;
  }
  return entry.result;
}

export function setCachedResult(key: string, result: DeepScanResult): void {
  cleanExpiredEntries(); // Bounded inline cleanup
  sessionCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

export class DeepScanService {
  /**
   * Run the full Deep Scan analytics suite.
   */
  static async runScan(input: DeepScanInput): Promise<DeepScanResult> {
    const startTime = Date.now();
    const scanId = input.sessionId || `deep-scan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    let network = input.network.toLowerCase();
    const address = input.tokenAddress;

    // Normalize network name
    if (network === 'ethereum' || network === '1') network = 'eth';
    if (network === '56') network = 'bsc';

    // 1. Check session cache — only cache when userId is known to prevent cross-user collisions.
    // Key format: 'deep:<userId>:<network>:<normalizedAddress>' ensures each user/network has its own cache entry.
    const cacheKey = input.userId
      ? `deep:${input.userId}:${network}:${normalizeAddress(address)}`
      : null; // No userId → no caching (safe degradation)

    if (cacheKey) {
      const cached = getCachedResult(cacheKey);
      if (cached) {
        console.log(`[DEEP SERVICE] Cache hit for ${input.tokenAddress} on ${network} (user ${input.userId}, TTL valid)`);
        return cached;
      }
    }

    console.log(`[DEEP SERVICE] Starting scan for token ${address} on ${network}...`);

    // ─────────────────────────────────────────────
    // Step 1: Resolve Basic / Token Metadata
    // ─────────────────────────────────────────────
    let meta = input.tokenMetadata;
    let basicScanData: any = null;

    if (!meta) {
      console.log(`[DEEP SERVICE] Basic metadata missing. Querying basic token scanner...`);
      try {
        if (network === 'solana') {
          basicScanData = await scanSolanaToken(address);
        } else {
          // EVM chain ID fallback (eth/bsc)
          const chainId = network === 'bsc' ? '56' : '1';
          basicScanData = await scanEVMToken(address, chainId);
        }
        
        meta = {
          name: basicScanData.tokenName,
          symbol: basicScanData.symbol,
          decimals: basicScanData.decimals,
          totalSupply: basicScanData.totalSupply,
          fdvUsd: basicScanData.liquidityInfo?.fdv ?? null,
          spotPriceUsd: basicScanData.liquidityInfo?.basePriceUsd ?? 0,
          totalLiquidityUsd: basicScanData.liquidityInfo?.totalLiquidityUsd ?? 0,
          mainPools: basicScanData.liquidityInfo?.mainPools ?? [],
          creatorAddress: basicScanData.securityInfo?.creatorAddress ?? undefined,
          securityFlags: {
            isHoneypot: basicScanData.securityInfo?.isHoneypot ?? false,
            hasMintFunction: basicScanData.mintFunction === 'Enabled',
            canBePaused: basicScanData.freezable === 'Yes',
          }
        };
      } catch (err: any) {
        console.error(`[DEEP SERVICE] Basic metadata scan failed:`, err.message);
      }
    }

    // Fallbacks if metadata is empty or failed
    const finalDecimals = meta?.decimals ?? 18;
    const finalTotalSupply = meta?.totalSupply ?? 0;
    const finalSpotPrice = meta?.spotPriceUsd ?? 0;
    const finalFdv = meta?.fdvUsd ?? (finalTotalSupply * finalSpotPrice);
    const finalLiquidity = meta?.totalLiquidityUsd ?? 0;
    const finalPools = meta?.mainPools ?? [];
    const isHoneypot = meta?.securityFlags?.isHoneypot ?? false;

    // ─────────────────────────────────────────────
    // Step 2: Resolve Elevator Data (Scenario A/B)
    // ─────────────────────────────────────────────
    let elevatorResult = input.elevatorResult;
    let elevatorReused = true;

    if (!elevatorResult) {
      console.log(`[DEEP SERVICE] Elevator results missing (Scenario B). Ingesting transaction batch...`);
      elevatorReused = false;
      
      const maxTx = input.maxTransactions ?? 100;
      const chain = (network === 'solana' ? 'solana' : network === 'bsc' ? 'bsc' : 'eth') as SupportedBlockchain;
      
      const apiKeys = {
        BIRDEYE_API_KEY: process.env.BIRDEYE_API_KEY || '',
        HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
      };

      try {
        const collector = CollectorFactory.create(chain, apiKeys);
        elevatorResult = await collector.collect(address, maxTx);
      } catch (err: any) {
        console.error(`[DEEP SERVICE] Ingesting transaction batch failed:`, err.message);
      }
    }

    // F-11: Cap transaction array to maxTransactions even in Scenario A.
    // Callers may pass arbitrarily large elevatorResult.transactions arrays.
    const maxTxCap = input.maxTransactions ?? 100;
    const txs = (elevatorResult?.transactions ?? []).slice(0, maxTxCap);
    const ohlcv = elevatorResult?.ohlcv ?? [];
    const batchHolders = elevatorResult?.holders ?? [];

    // ── Build contract/CEX exclusion sets ──
    // F-12: Use actual pool pair addresses and token address rather than heuristic string matching.
    // Pool pair contract addresses (LP positions) must be excluded from whale/buyer analysis.
    const contractWallets = new Set<string>();
    const cexWallets = new Set<string>();

    // Always exclude the token contract address itself
    contractWallets.add(normalizeAddress(address));

    // Exclude known LP pair addresses from pool metadata
    for (const pool of finalPools) {
      if (pool.pair) contractWallets.add(normalizeAddress(pool.pair));
    }

    // Exclude known CEX wallets from transaction metadata
    for (const tx of txs) {
      if (tx.toExchange) cexWallets.add(normalizeAddress(tx.to));
      if (tx.fromExchange) cexWallets.add(normalizeAddress(tx.from));
    }

    // Additionally exclude any holder whose wallet matches the token contract or a pool pair
    for (const h of batchHolders) {
      if (contractWallets.has(normalizeAddress(h.wallet))) {
        contractWallets.add(normalizeAddress(h.wallet));
      }
    }

    // ─────────────────────────────────────────────
    // Step 3: Run Wash Trading & Labeling Extensions
    // ─────────────────────────────────────────────
    const washTraderWallets = new Set<string>();
    if (txs.length > 0) {
      // Run wash trading detector to reuse the wash trading flags
      const washResult = detectWashTrading(txs);
      for (const addr of washResult.summary.washWallets) {
        washTraderWallets.add(normalizeAddress(addr));
      }
    }

    // ─────────────────────────────────────────────
    // Step 4: Run Analytical Engines
    // ─────────────────────────────────────────────
    
    // 1. AMM Slippage
    const posSizes = input.simulatedPositionSizes || [1000, 5000, 10000, 25000, 50000, 100000];
    const ammResult = simulateAmmSlippage(finalPools, finalSpotPrice, posSizes);

    // 2. Volume HHI — now excludes CEX and contract wallets from HHI computation
    const hhiResult = analyzeVolumeConcentration(txs, washTraderWallets, cexWallets, contractWallets);

    // 3. Whale Behavior
    const whaleResult = analyzeWhaleBehavior(
      txs,
      batchHolders,
      finalTotalSupply,
      finalLiquidity,
      finalSpotPrice,
      cexWallets,
      contractWallets
    );

    // 4. Whale Exit Simulation
    const whaleExitResult = simulateWhaleExit(
      whaleResult.whales,
      finalPools,
      finalSpotPrice,
      finalTotalSupply
    );

    // 5. Buyer Quality
    const buyerQualityResult = analyzeBuyerQuality(txs, cexWallets, contractWallets);

    // 6. Market Regime
    const regimeResult = analyzeMarketRegime(ohlcv);

    // 7. Capital Efficiency
    const capitalResult = analyzeCapitalEfficiency(finalFdv, finalLiquidity, finalSpotPrice);

    // ─────────────────────────────────────────────
    // Step 5: Evidence & Risk Score Synthesis
    // ─────────────────────────────────────────────
    const evidenceNodes: EvidenceNode[] = [];

    if (ammResult.status === 'ok') {
      const sim1k = ammResult.simulations.find(s => s.positionSizeUsd === 1000);
      const sim50k = ammResult.simulations.find(s => s.positionSizeUsd === 50000);
      evidenceNodes.push(
        EvidenceMapper.buildAmmPoolEvidence({
          poolAddress: ammResult.poolAddress || 'unknown',
          liquidityUsd: finalLiquidity,
          spotPriceUsd: finalSpotPrice,
          swapFee: 0.003,
          snapshotAt: ammResult.poolSnapshotAt || Math.floor(Date.now() / 1000),
          impactAt1k: sim1k?.priceImpactPct ?? 0,
          impactAt50k: sim50k?.priceImpactPct ?? 0,
        })
      );
    }

    if (whaleExitResult.status === 'ok') {
      const scenario50 = whaleExitResult.scenarios.find(s => s.label === '50%');
      if (scenario50 && scenario50.status === 'ok') {
        evidenceNodes.push(
          EvidenceMapper.buildWhaleExitEvidence({
            targetWallets: whaleExitResult.targetWallets,
            combinedBalance: whaleExitResult.combinedObservedBalance,
            scenario: '50%',
            priceDeltaPct: scenario50.priceDeltaPct,
            isSimulated: true,
          })
        );
      }
    }

    if (hhiResult.status === 'ok') {
      const topBuyer = hhiResult.buyerHHI.topWallets[0];
      evidenceNodes.push(
        EvidenceMapper.buildVolumeHHIEvidence({
          buyerHHI: hhiResult.buyerHHI.hhi,
          sellerHHI: hhiResult.sellerHHI.hhi,
          uniqueBuyers: hhiResult.uniqueBuyers,
          uniqueSellers: hhiResult.uniqueSellers,
          totalVolumeUsd: hhiResult.totalBuyVolumeUsd + hhiResult.totalSellVolumeUsd,
          washVolumeRatio: hhiResult.washVolumeRatio,
          topBuyerWallet: topBuyer?.wallet,
          topBuyerSharePct: topBuyer ? topBuyer.shareOfTotal * 100 : undefined,
        })
      );
    }

    if (whaleResult.status === 'ok' && whaleResult.activeWhaleCount > 0) {
      evidenceNodes.push(
        EvidenceMapper.buildWhaleBehaviorEvidence({
          whaleCount: whaleResult.activeWhaleCount,
          totalWhaleSupplySharePct: whaleResult.totalWhaleSupplySharePct,
          netInflowTokens: whaleResult.whaleNetInflow,
          netOutflowTokens: whaleResult.whaleNetOutflow,
          phase: whaleResult.phase,
        })
      );
    }

    if (regimeResult.status === 'ok') {
      evidenceNodes.push(
        EvidenceMapper.buildMarketRegimeEvidence({
          regime: regimeResult.regime,
          candleCount: regimeResult.stats?.candleCount ?? 0,
          priceSlopePct: regimeResult.stats?.priceSlopePerCandle ?? 0,
          volumeSlope: regimeResult.stats?.volumeSlopePerCandle ?? 0,
          priceVolatility: regimeResult.stats?.priceVolatility ?? 0,
          totalPriceChangePct: regimeResult.stats?.totalPriceChangePct ?? 0,
          confidence: regimeResult.confidence,
        })
      );
    }

    if (capitalResult.status === 'ok') {
      evidenceNodes.push(
        EvidenceMapper.buildCapitalEfficiencyEvidence({
          fdvUsd: finalFdv,
          liquidityUsd: finalLiquidity,
          ratio: capitalResult.fdvToLiquidityRatio,
          sensitivity: capitalResult.sensitivity,
          multiplier: capitalResult.capitalSensitivityMultiplier,
        })
      );
    }

    if (buyerQualityResult.status === 'ok' || buyerQualityResult.status === 'partial') {
      evidenceNodes.push(
        EvidenceMapper.buildBuyerQualityEvidence({
          score: buyerQualityResult.buyerQualityScore,
          totalBuyers: buyerQualityResult.cohortMetrics.totalBuyers,
          returningBuyerRatio: buyerQualityResult.cohortMetrics.returningBuyerRatio,
          capitalDiversityIndex: buyerQualityResult.cohortMetrics.capitalDiversityIndex,
          unavailableMetrics: buyerQualityResult.unavailableMetrics,
        })
      );
    }

    const compiledEvidence = EvidenceMapper.collectEvidence(evidenceNodes);

    // Calculate aggregated risk score
    const riskScoreResult = calculateRiskScore({
      ammSlippage: ammResult,
      volumeConcentration: hhiResult,
      whaleBehavior: whaleResult,
      whaleExit: whaleExitResult,
      buyerQuality: buyerQualityResult,
      capitalEfficiency: capitalResult,
      isHoneypot,
    });

    // ─────────────────────────────────────────────
    // Step 6: Generate Trader Intelligence Report
    // ─────────────────────────────────────────────
    const reportResult = generateTraderIntelligenceReport({
      tokenAddress: address,
      tokenSymbol: meta?.symbol ?? 'TOKEN',
      tokenName: meta?.name ?? 'Unknown Token',
      network,
      ammSlippage: ammResult,
      volumeConcentration: hhiResult,
      whaleBehavior: whaleResult,
      whaleExit: whaleExitResult,
      buyerQuality: buyerQualityResult,
      marketRegime: regimeResult,
      capitalEfficiency: capitalResult,
      riskScore: riskScoreResult,
      evidence: compiledEvidence,
      dataQuality: {
        staleDataWarning: false,
        elevatorDataReused: elevatorReused,
        transactionCount: txs.length,
        ohlcvCandleCount: ohlcv.length,
      },
      limitations: buyerQualityResult.unavailableMetrics,
      scanId,
      timestamp: Date.now(),
    });

    // ─────────────────────────────────────────────
    // Step 7: Package Final Result
    // ─────────────────────────────────────────────
    const scanDurationMs = Date.now() - startTime;

    const result: DeepScanResult = {
      status: 'success',
      scanId,
      timestamp: Date.now(),
      tokenMetadata: {
        address,
        name: meta?.name ?? 'Unknown Token',
        symbol: meta?.symbol ?? 'TOKEN',
        decimals: finalDecimals,
        totalSupply: finalTotalSupply,
        creatorAddress: meta?.creatorAddress,
      },
      marketSummary: {
        priceUsd: finalSpotPrice,
        volume24hUsd: null, // Not collected from data source — expose null so UI can render "N/A" instead of $0
        fdvUsd: finalFdv,
        marketRegime: regimeResult.regime,
        totalLiquidityUsd: finalLiquidity,
      },
      ammSlippage: ammResult,
      volumeConcentration: hhiResult,
      whaleBehavior: whaleResult,
      whaleExit: whaleExitResult,
      buyerQuality: buyerQualityResult,
      marketRegime: regimeResult,
      capitalEfficiency: capitalResult,
      riskScore: riskScoreResult,
      topRisks: riskScoreResult.topRisks,
      evidence: compiledEvidence,
      traderIntelligence: reportResult,
      dataQuality: {
        staleDataWarning: false,
        elevatorDataReused: elevatorReused,
        transactionCount: txs.length,
        ohlcvCandleCount: ohlcv.length,
      },
      limitations: buyerQualityResult.unavailableMetrics,
      overallConfidence: riskScoreResult.confidence,
      scanDurationMs,
    };

    // Store in session cache (only when userId is present — prevents cross-user key collisions)
    if (cacheKey) {
      setCachedResult(cacheKey, result);
    }
    return result;
  }
}

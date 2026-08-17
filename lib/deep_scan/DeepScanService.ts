/**
 * Deep Scan Service
 *
 * Coordinates the Deep Scan analysis lifecycle.
 * Reuses Elevator and Basic scan caches.
 */

import { DeepScanInput, DeepScanResult, EvidenceNode, DataFreshnessStatus, normalizeAddress, SmartMoneyReputationRecord } from './types';
import { simulateAmmSlippage } from './engines/AmmSlippageSimulator';
import { analyzeVolumeConcentration } from './engines/VolumeConcentrationAnalyzer';
import { analyzeWhaleBehavior } from './engines/WhaleBehaviorAnalyzer';
import { simulateWhaleExit } from './engines/WhaleExitSimulator';
import { analyzeBuyerQuality } from './engines/BuyerQualityAnalyzer';
import { analyzeMarketRegime } from './engines/MarketRegimeAnalyzer';
import { analyzeCapitalEfficiency } from './engines/CapitalEfficiencyAnalyzer';
import { analyzeLiquidityFragmentation } from './engines/LiquidityFragmentationAnalyzer';
import { calculateRiskScore } from './engines/RiskScoringEngine';
import { generateTraderIntelligenceReport } from './engines/TraderIntelligenceGenerator';
import * as EvidenceMapper from './engines/EvidenceMapper';
import { enrichPoolsWithAlchemyReserves, enrichClmmPoolsWithSlot0 } from './poolEnrichment';
import { NormalizedPoolState, LiquidityPool } from '../blockchain/types';
import { enrichWhaleWallets, WALLET_INTELLIGENCE_LOOKBACK_DAYS } from './walletIntelligence';
import { WhaleFreshnessTag } from './types';
// Phase 5C — WalletQuality Infrastructure
import { lookupWalletProfile, upsertWalletProfile, enqueueWalletEnrichmentJob } from './walletQualityCache';
import { enrichTopWalletsSync } from './walletEnrichment';
import type { WalletQualityProfile } from '../providers/adapter-types';
import { analyzeSmartMoney } from './engines/SmartMoneyAnalyzer';
import { enqueueSmartMoneyIndexingJob, lookupSmartMoneyReputation } from './smartMoneyCache';
import { queryAlchemyHistoricalRpc } from '../providers/alchemy/historicalRpc';
import { schedulePoolReservesIndexing, queryHistoricalReserves } from './historical/HistoricalPoolReservesIndexer';
import { analyzeLiquidityStress } from './engines/LiquidityStressAnalyzer';
import { analyzeHistoricalBehavior } from './engines/HistoricalBehaviorAnalyzer';
import { Connection } from '@solana/web3.js';
import { RaydiumPoolReader } from '../solana/RaydiumPoolReader';
import { DeployerProfiler } from '../reputation/DeployerProfiler';
import { TokenUnlockTracker } from '../traceability/TokenUnlockTracker';
import { RugPatternMatcher } from '../reputation/RugPatternMatcher';
import { InsiderAccumulationDetector } from './engines/InsiderAccumulationDetector';
import { ExchangeListingAgent } from '../ai/ExchangeListingAgent';
import { NewsAgent } from '../ai/NewsAgent';

import { CollectorFactory, SupportedBlockchain } from '../elevator/collectors/CollectorFactory';
import { HolderDataset } from '../elevator/collectors/types';
import { scanEVMToken } from '../blockchain/evmScanner';
import { scanSolanaToken } from '../blockchain/solanaScanner';
import { detectWashTrading } from '../elevator/washTradingDetector';
import { DEEP_SCAN_CONFIG } from './config';

// ── Session cache with TTL eviction ──
// Key = 'deep:<userId>:<network>:<normalizedAddress>' — scoped per user and network to prevent leaks.
// Entries expire after CACHE_TTL_MS. If userId is absent, caching is skipped entirely.
const CACHE_TTL_MS = DEEP_SCAN_CONFIG.cache.ttlMs;
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

  const result = entry.result;
  const freshness = result.dataQuality?.freshness;

  // Fix C: If the cached result had known-fresh data at scan time, re-evaluate whether
  // that data has since exceeded freshness thresholds relative to the current wall clock.
  // We do NOT contact external providers — only compare stored provider timestamps to now.
  // If the underlying data has gone stale since caching, invalidate the entry so the
  // caller gets a fresh scan. Cached stale/unknown results are preserved as-is.
  if (freshness) {
    const nowSec = Math.floor(Date.now() / 1000);

    if (freshness.marketDataFreshness === 'fresh' && freshness.marketDataTimestamp !== undefined) {
      if (nowSec - freshness.marketDataTimestamp > FRESHNESS_THRESHOLDS.MARKET_DATA) {
        console.log(`[DEEP CACHE] Invalidating: market data (timestamp ${freshness.marketDataTimestamp}) has become stale since caching.`);
        sessionCache.delete(key);
        return null;
      }
    }

    if (freshness.ohlcvFreshness === 'fresh' && freshness.ohlcvTimestamp !== undefined) {
      if (nowSec - freshness.ohlcvTimestamp > FRESHNESS_THRESHOLDS.OHLCV) {
        console.log(`[DEEP CACHE] Invalidating: OHLCV data (timestamp ${freshness.ohlcvTimestamp}) has become stale since caching.`);
        sessionCache.delete(key);
        return null;
      }
    }

    if (freshness.transactionFreshness === 'fresh' && freshness.transactionTimestamp !== undefined) {
      if (nowSec - freshness.transactionTimestamp > FRESHNESS_THRESHOLDS.TRANSACTIONS) {
        console.log(`[DEEP CACHE] Invalidating: transaction data (timestamp ${freshness.transactionTimestamp}) has become stale since caching.`);
        sessionCache.delete(key);
        return null;
      }
    }

    // Update cacheAgeSeconds dynamically so the consumer always sees the true elapsed time
    const cacheAgeSeconds = Math.max(0, nowSec - freshness.scanTime);
    return {
      ...result,
      dataQuality: {
        ...result.dataQuality,
        freshness: { ...freshness, cacheAgeSeconds },
      },
    };
  }

  return result;
}

export function setCachedResult(key: string, result: DeepScanResult): void {
  cleanExpiredEntries(); // Bounded inline cleanup
  sessionCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Centralized freshness thresholds (in seconds)
export const FRESHNESS_THRESHOLDS = {
  MARKET_DATA: DEEP_SCAN_CONFIG.freshnessThresholds.marketData,
  OHLCV: DEEP_SCAN_CONFIG.freshnessThresholds.ohlcv,
  TRANSACTIONS: DEEP_SCAN_CONFIG.freshnessThresholds.transactions,
};

function isSameTransactionWindow(txs1: any[], txs2: any[]): boolean {
  if (!txs1 || !txs2) return false;
  if (txs1.length !== txs2.length) return false;
  if (txs1.length === 0) return true;
  const mid = Math.floor(txs1.length / 2);
  return (
    txs1[0]?.hash === txs2[0]?.hash &&
    txs1[mid]?.hash === txs2[mid]?.hash &&
    txs1[txs1.length - 1]?.hash === txs2[txs2.length - 1]?.hash
  );
}

export class DeepScanService {
  /**
   * Run the full Deep Scan analytics suite.
   */
  static async runScan(input: DeepScanInput): Promise<DeepScanResult> {
    const startTime = Date.now();
    const scanId = input.sessionId || `deep-scan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Reset the evidence ID counter so every scan produces deterministic, consecutive IDs
    // starting at 1. This prevents ID drift and makes evidence references predictable.
    EvidenceMapper.resetEvidenceCounter();

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
      // ── BOUNDARY COMPATIBILITY FALLBACK: Basic Token Metadata ──
      // This is a backward-compatibility path for Scenario B where the caller has
      // not provided tokenMetadata from a prior Basic Scan. While the Basic Scanner
      // owns token metadata, we invoke it here as a fallback to prevent failure.
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
          volume24hUsd: basicScanData.liquidityInfo?.volume24hUsd ?? null,
          mainPools: basicScanData.liquidityInfo?.mainPools ?? [],
          creatorAddress: basicScanData.securityInfo?.creatorAddress ?? undefined,
          securityFlags: {
            isHoneypot: basicScanData.securityInfo?.isHoneypot ?? false,
            hasMintFunction: basicScanData.mintFunction === 'Enabled',
            canBePaused: basicScanData.freezable === 'Yes',
          },
          timestamp: basicScanData.liquidityInfo?.timestamp,
          source: basicScanData.liquidityInfo?.source,
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

    // ── Large-Cap Router Gate ──
    // Tokens with FDV > $50M or volume24h > $10M are considered Large-Cap.
    // Downstream engines (WhaleExit, HHI sniper warnings) self-bypass via this flag.
    const isLargeCap = finalFdv > 50_000_000 || ((meta?.volume24hUsd ?? 0) > 10_000_000);
    if (isLargeCap) {
      console.log(`[DEEP SERVICE] 🔵 Large-Cap token detected (FDV: $${finalFdv.toLocaleString()}). Bypassing micro-cap risk heuristics.`);
    }
    const initialPools = meta?.mainPools ?? [];
    const isHoneypot = meta?.securityFlags?.isHoneypot ?? false;

    // Step 1b: Enrich pools with V2 reserves and V3 slot0
    const enrichedPools = await enrichPoolsWithAlchemyReserves(
      initialPools,
      address,
      finalDecimals,
      finalSpotPrice,
      network
    );
    const fullyEnrichedPools = await enrichClmmPoolsWithSlot0(enrichedPools, network);
    const finalPools: (NormalizedPoolState | LiquidityPool)[] = fullyEnrichedPools;

    // Step 1c: If Solana, enrich the primary Raydium pool with actual reserves using RaydiumPoolReader
    if (network === 'solana') {
      try {
        const primaryV2 = finalPools.find(
          p => 'poolType' in p && p.poolType === 'constant-product' && p.poolIdentifierType === 'address'
        ) as NormalizedPoolState | undefined;
        
        if (primaryV2) {
          const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
          const reserves = await RaydiumPoolReader.getPoolReserves(primaryV2.poolIdentifier, conn);
          if (reserves) {
            console.log(`[DEEP SERVICE] Enriched Solana pool reserves: base=${reserves.baseReserve.toString()}, quote=${reserves.quoteReserve.toString()}`);
            primaryV2.tokenReserveRaw = Number(reserves.baseReserve) / (10 ** finalDecimals);
            primaryV2.quoteReserveRaw = Number(reserves.quoteReserve) / 1e9; // SOL is 9 decimals standard
          }
        }
      } catch (err: any) {
        console.warn(`[DEEP SERVICE] Solana pool reserve enrichment failed:`, err.message);
      }
    }

    // ─────────────────────────────────────────────
    // Step 2: Resolve Elevator Data (Scenario A/B)
    // ─────────────────────────────────────────────
    let elevatorResult = input.elevatorResult;
    let elevatorReused = true;

    if (!elevatorResult) {
      // ── BOUNDARY COMPATIBILITY FALLBACK: Ingest Transaction Batch (Scenario B) ──
      // If the caller has not run Elevator Scan first and passed in elevatorResult,
      // we run a fallback transaction collection step. This guarantees that direct
      // REST API calls or standalone queries remain functional.
      console.log(`[DEEP SERVICE] Elevator results missing (Scenario B). Ingesting transaction batch...`);
      elevatorReused = false;
      
      // Deep scans default to 10,000 transactions — this drives accurate HHI/Gini scoring.
      // Callers may override with a smaller value for preview/quick modes.
      const maxTx = input.maxTransactions ?? 10000;
      const chain = (network === 'solana' ? 'solana' : network === 'bsc' ? 'bsc' : 'eth') as SupportedBlockchain;
      
      const apiKeys = {
        BIRDEYE_API_KEY: process.env.BIRDEYE_API_KEY || '',
        HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
      };

      try {
        const collector = CollectorFactory.create(chain, apiKeys);
        elevatorResult = await collector.collect(address, maxTx, finalDecimals);
      } catch (err: any) {
        console.error(`[DEEP SERVICE] Ingesting transaction batch failed:`, err.message);
      }
    }

    // F-11: Cap transaction array to maxTransactions even in Scenario A.
    // Callers may pass arbitrarily large elevatorResult.transactions arrays.
    const maxTxCap = input.maxTransactions ?? 10000;
    const txs = (elevatorResult?.transactions ?? []).slice(0, maxTxCap);
    const ohlcv = elevatorResult?.ohlcv ?? [];

    // ── Holder Dataset: Explicit availability contract ──
    // holdersStatus is set by each collector:
    //   'available'         → provider was queried; holders array reflects actual result (may be empty if token has no holders).
    //   'unavailable'       → provider was NOT queried for this chain; whale analysis MUST be skipped, not silently treated as empty.
    //   'insufficient_data' → provider was queried but returned usable output below minimum threshold.
    //   undefined           → legacy path (caller injected elevatorResult without status); treat as 'available' for backward compat.
    const rawHoldersStatus = elevatorResult?.holdersStatus;
    const holdersStatusResolved: HolderDataset['status'] =
      rawHoldersStatus === 'unavailable' ? 'unavailable'
      : rawHoldersStatus === 'insufficient_data' ? 'insufficient_data'
      : 'available'; // 'available' or legacy undefined both map to available

    const holderDataset: HolderDataset = {
      status: holdersStatusResolved,
      holders: holdersStatusResolved === 'unavailable' ? [] : (elevatorResult?.holders ?? []),
      reason:
        holdersStatusResolved === 'unavailable'
          ? `Holder data is not collected for ${network.toUpperCase()} tokens. ` +
            'Whale behavior and exit analysis are unavailable until an EVM holder provider is integrated.'
          : holdersStatusResolved === 'insufficient_data'
          ? 'Holder provider returned insufficient data for reliable whale analysis.'
          : undefined,
    };
    const batchHolders = holderDataset.holders;

    // ── Build contract/CEX exclusion sets ──
    // Passive Extraction: We build CEX and contract exclusion sets by reading CEX flags 
    // and LP addresses returned from the Elevator/Basic collectors. No duplicate RPC 
    // or external provider calls are introduced.
    const contractWallets = new Set<string>();
    const cexWallets = new Set<string>();

    // Always exclude the token contract address itself
    contractWallets.add(normalizeAddress(address));

    // Exclude known LP pair addresses from pool metadata
    for (const pool of finalPools) {
      const pair = 'poolIdentifier' in pool ? pool.poolIdentifier : pool.pair;
      if (pair) contractWallets.add(normalizeAddress(pair));
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
      const hasWashTradingField = elevatorResult && (elevatorResult.washTrading || elevatorResult.wash_trading);
      const canReuseWash = hasWashTradingField && elevatorResult && isSameTransactionWindow(txs, elevatorResult.transactions);

      if (canReuseWash && elevatorResult) {
        console.log('[DEEP SERVICE] Reusing existing wash-trading analysis from Elevator...');
        const wallets = elevatorResult.washTrading?.washWallets || elevatorResult.wash_trading?.wash_wallets || [];
        for (const addr of wallets) {
          washTraderWallets.add(normalizeAddress(addr));
        }

        // Tag transactions in txs as wash trades if their wallet is in washTraderWallets
        for (const tx of txs) {
          const walletNormalized = tx.wallet ? normalizeAddress(tx.wallet) : '';
          const isWash = walletNormalized && washTraderWallets.has(walletNormalized);
          tx.isWashTrader = !!isWash;
          if (isWash) {
            tx.roundTrips = tx.roundTrips || 1;
          } else {
            tx.roundTrips = 0;
          }
        }
      } else {
        // ── BOUNDARY COMPATIBILITY FALLBACK: Wash Trading Ingestion ──
        // If the caller has provided transaction arrays but no pre-computed wash-trading flags,
        // we run the Elevator wash trading detector as a fallback. This preserves correctness
        // but represents a boundary fallback that should be avoided by callers running Elevator first.
        console.log('[DEEP SERVICE] Running wash trading detector fallback...');
        const washResult = detectWashTrading(txs);
        for (const addr of washResult.summary.washWallets) {
          washTraderWallets.add(normalizeAddress(addr));
        }
      }
    }

    // ─────────────────────────────────────────────
    // Step 4: Run Analytical Engines
    // ─────────────────────────────────────────────
    
    // 1. AMM Slippage
    const posSizes = input.simulatedPositionSizes || DEEP_SCAN_CONFIG.amm.defaultPositionSizesUsd;
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
      contractWallets,
      holderDataset.status
    );

    // Phase 3: Bitquery wallet intelligence enrichment for top whale wallets
    if (whaleResult.status === 'ok' && whaleResult.whales.length > 0) {
      const activeWhales = whaleResult.whales.filter(w => !w.isFiltered);
      const topWhales = activeWhales
        .sort((a, b) => b.observedBatchBalance - a.observedBatchBalance)
        .map(w => w.wallet);

      const lookbackMs = WALLET_INTELLIGENCE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
      const sinceIso = new Date(Date.now() - lookbackMs).toISOString();

      const intelligence = await enrichWhaleWallets(topWhales, sinceIso);
      if (intelligence.recordCount > 0) {
        whaleResult.walletIntelligence = intelligence;

        // ── Phase 4: Populate freshnessTag per WhaleEntry ──
        // Build a lookup map from wallet address (lower-cased) → firstSeenTimestamp.
        // Only wallets within the WALLET_INTELLIGENCE_MAX (top 10) cap have records;
        // all others remain at 'unknown' (set by WhaleBehaviorAnalyzer).
        //
        // IMPORTANT: Use a fixed epoch reference (scanTimeMs) captured BEFORE the
        // enrichment call to ensure deterministic tag values for each whale.
        const scanTimeMs = Date.now();
        const freshnessMap = new Map<string, number | undefined>();
        for (const record of intelligence.records) {
          freshnessMap.set(record.wallet.toLowerCase(), record.firstSeenTimestamp);
        }

        const SEVEN_DAYS_S  = 7  * 24 * 60 * 60;
        const THIRTY_DAYS_S = 30 * 24 * 60 * 60;
        const scanTimeSec = Math.floor(scanTimeMs / 1000);

        for (const whale of whaleResult.whales) {
          const normalizedWallet = whale.wallet.toLowerCase();
          if (!freshnessMap.has(normalizedWallet)) {
            // Not in enrichment set (outside top-10 cap) — leave 'unknown'
            continue;
          }
          const firstSeen = freshnessMap.get(normalizedWallet);
          if (firstSeen === undefined || firstSeen <= 0) {
            // Record exists but has no usable timestamp (unavailable / no_history_found)
            whale.freshnessTag = 'unknown';
            continue;
          }
          const ageSeconds = scanTimeSec - firstSeen;
          let tag: WhaleFreshnessTag;
          if (ageSeconds < 0) {
            // Future timestamp: invalid/unreliable due to node clock drift. Set to 'unknown'
            tag = 'unknown';
          } else if (ageSeconds <= SEVEN_DAYS_S) {
            tag = 'fresh';
          } else if (ageSeconds <= THIRTY_DAYS_S) {
            tag = 'recent';
          } else {
            tag = 'established';
          }
          whale.freshnessTag = tag;
        }
      }
    }

    // 4. Whale Exit Simulation
    const whaleExitResult = simulateWhaleExit(
      whaleResult.whales,
      finalPools,
      finalSpotPrice,
      finalTotalSupply
    );

    // Phase 5C: Wallet profile cache-first lookup + bounded sync enrichment for buyers
    const SYNC_WALLET_LIMIT: number = DEEP_SCAN_CONFIG.buyerQuality.syncWalletLimit ?? 10;
    const walletProfiles = new Map<string, WalletQualityProfile>();

    // Collect unique buyer wallet addresses from the transaction batch
    const buyerAddressSet = new Set<string>();
    for (const tx of txs) {
      if (tx.type === 'buy' && tx.isTrade === true && tx.to) {
        buyerAddressSet.add(normalizeAddress(tx.to));
      }
    }
    const uniqueBuyerWallets = [...buyerAddressSet];

    if (uniqueBuyerWallets.length > 0) {
      const cacheMisses: string[] = [];
      const swrRevalidate: string[] = [];

      // Cache-first lookup — parallel, failures do not block the scan
      await Promise.allSettled(
        uniqueBuyerWallets.map(async (addr) => {
          const result = await lookupWalletProfile(addr, network);
          if ((result.status === 'fresh' || result.status === 'swr' || result.status === 'stale') && result.profile) {
            walletProfiles.set(addr, result.profile);
            if (result.status === 'swr' || result.status === 'stale') {
              swrRevalidate.push(addr);
            }
          } else if (result.status === 'miss') {
            cacheMisses.push(addr);
          }
          // 'unavailable' (DB error) — treat as miss but don't add to cacheMisses
          // to avoid hammering a failing database with enrichment requests
        })
      );

      // Enqueue SWR revalidation (non-blocking)
      for (const addr of swrRevalidate) {
        enqueueWalletEnrichmentJob(addr, network).catch(() => {});
      }

      if (cacheMisses.length > 0) {
        const topMisses   = cacheMisses.slice(0, SYNC_WALLET_LIMIT);
        const asyncMisses = cacheMisses.slice(SYNC_WALLET_LIMIT);

        // Synchronously enrich top-N wallets (parallel with per-wallet timeout)
        if (topMisses.length > 0) {
          console.log(`[DEEP SERVICE] Sync enriching ${topMisses.length} buyer wallet(s)...`);
          const freshProfiles = await enrichTopWalletsSync(topMisses, network, topMisses.length);
          for (const [addr, profile] of freshProfiles) {
            walletProfiles.set(addr, profile);
            upsertWalletProfile(profile).catch(() => {}); // persist non-blocking
          }
        }

        // Enqueue remaining wallets for async enrichment
        for (const addr of asyncMisses) {
          enqueueWalletEnrichmentJob(addr, network).catch(() => {});
        }
      }
    }

    // 5. Buyer Quality — now receives real wallet profiles (5C) and reputation cache (5D-8).
    // Defer until after SmartMoney reputations are resolved, so the rep map can be passed in.
    // buyerQualityResult is declared here; populated below after rep resolution.

    // ── Phase 5D-1 & 5D-3: SmartMoney Cache-First Cohort Evaluation ──
    // Identify top buyer wallets for SmartMoney reputation lookup.
    // We check the existing cache and enqueue misses/stale asynchronously.
    // The scan NEVER waits for live SmartMoney indexing.
    let smartMoneyResult;
    // Phase 5D-8: Reputation map (keyed by normalised address) forwarded to BuyerQualityAnalyzer.
    const walletReputationMap = new Map<string, SmartMoneyReputationRecord>();
    try {
      const topBuyerWallets = uniqueBuyerWallets.slice(0, 5);
      if (topBuyerWallets.length > 0) {
        const reputations = await Promise.allSettled(
          topBuyerWallets.map((addr) => lookupSmartMoneyReputation(addr, network))
        );
        const resolvedReps = reputations.map((r) => (r.status === 'fulfilled' ? r.value : null));

        for (let i = 0; i < topBuyerWallets.length; i++) {
          const rep = resolvedReps[i];
          if (!rep || rep.status === 'pending' || rep.freshness === 'UNAVAILABLE') {
            // Cache miss or not indexed yet — enqueue async
            enqueueSmartMoneyIndexingJob(topBuyerWallets[i], network).catch(() => {});
          }
          // Build Phase 5D-8 reputation map regardless of freshness status;
          // BuyerQualityAnalyzer will skip pending/unavailable records internally.
          if (rep) {
            walletReputationMap.set(normalizeAddress(topBuyerWallets[i]), rep);
          }
        }
        smartMoneyResult = analyzeSmartMoney(topBuyerWallets, network, [], resolvedReps);
      } else {
        smartMoneyResult = analyzeSmartMoney([], network, [], []);
      }
    } catch {
      // SmartMoney must never crash the main scan
      smartMoneyResult = analyzeSmartMoney([], network, [], []);
    }

    // 5. Buyer Quality — invoked after reputations resolved so Phase 5D-8 data is available
    const buyerQualityResult = analyzeBuyerQuality(txs, cexWallets, contractWallets, walletProfiles, walletReputationMap, meta?.creatorAddress);

    if (smartMoneyResult && buyerQualityResult) {
      buyerQualityResult.smartMoneyBuyerCount = smartMoneyResult.cohortSummary?.smartMoneyWalletCount ?? null;
      buyerQualityResult.smartMoneyBuyerRatio = smartMoneyResult.cohortSummary?.smartMoneyWalletRatio ?? null;
      buyerQualityResult.smartMoneyBuyerConfidence = smartMoneyResult.cohortSummary?.smartMoneyConfidence ?? null;
    }

    // 6. Market Regime
    const regimeResult = analyzeMarketRegime(ohlcv);

    // 7. Capital Efficiency
    const capitalResult = analyzeCapitalEfficiency(finalFdv, finalLiquidity, finalSpotPrice);

    // 8. Liquidity Fragmentation (Phase 4)
    const fragmentationResult = analyzeLiquidityFragmentation(finalPools);

    // ─────────────────────────────────────────────
    // Step 5: Evidence & Risk Score Synthesis
    // ─────────────────────────────────────────────
    const evidenceNodes: EvidenceNode[] = [];

    // ── Evidence identity contract ──
    // EvidenceMapper.build*() is the sole owner of evidence IDs.
    // After each node is built, its .evidenceId is written back into the
    // corresponding engine result's .evidenceIds[] so that:
    //   SubScore.evidenceIds → RiskSignal.evidenceIds → compiledEvidence[]
    // all resolve to the same EvidenceNode without any static string mismatch.

    if (ammResult.status === 'ok') {
      const sim1k = ammResult.simulations.find(s => s.positionSizeUsd === 1000);
      const sim50k = ammResult.simulations.find(s => s.positionSizeUsd === 50000);
      const ammNode = EvidenceMapper.buildAmmPoolEvidence({
        poolAddress: ammResult.poolAddress || 'unknown',
        liquidityUsd: finalLiquidity,
        spotPriceUsd: finalSpotPrice,
        // Use the fee that was actually applied in the simulation.
        // swapFeeUsed is always set by the simulator; fall back to V2 default only as a safety net.
        swapFee: ammResult.swapFeeUsed ?? 0.003,
        snapshotAt: ammResult.poolSnapshotAt || Math.floor(Date.now() / 1000),
        impactAt1k: sim1k?.priceImpactPct ?? 0,
        impactAt50k: sim50k?.priceImpactPct ?? 0,
      });
      evidenceNodes.push(ammNode);
      // Write canonical ID back into the engine result
      ammResult.evidenceIds = [ammNode.evidenceId];
    } else {
      ammResult.evidenceIds = [];
    }

    if (whaleExitResult.status === 'ok') {
      const scenario50 = whaleExitResult.scenarios.find(s => s.label === '50%');
      if (scenario50 && scenario50.status === 'ok') {
        const exitNode = EvidenceMapper.buildWhaleExitEvidence({
          targetWallets: whaleExitResult.targetWallets,
          combinedBalance: whaleExitResult.combinedObservedBalance,
          scenario: '50%',
          priceDeltaPct: scenario50.priceDeltaPct,
          isSimulated: true,
        });
        evidenceNodes.push(exitNode);
        // Write canonical ID back into the engine result
        whaleExitResult.evidenceIds = [exitNode.evidenceId];
      } else {
        whaleExitResult.evidenceIds = [];
      }
    } else {
      whaleExitResult.evidenceIds = [];
    }

    if (hhiResult.status === 'ok') {
      const topBuyer = hhiResult.buyerHHI.topWallets[0];
      const hhiNode = EvidenceMapper.buildVolumeHHIEvidence({
        buyerHHI: hhiResult.buyerHHI.hhi,
        sellerHHI: hhiResult.sellerHHI.hhi,
        uniqueBuyers: hhiResult.uniqueBuyers,
        uniqueSellers: hhiResult.uniqueSellers,
        totalVolumeUsd: hhiResult.totalBuyVolumeUsd + hhiResult.totalSellVolumeUsd,
        washVolumeRatio: hhiResult.washVolumeRatio,
        topBuyerWallet: topBuyer?.wallet,
        topBuyerSharePct: topBuyer ? topBuyer.shareOfTotal * 100 : undefined,
      });
      evidenceNodes.push(hhiNode);
      // Write canonical ID back into the engine result
      hhiResult.evidenceIds = [hhiNode.evidenceId];
    } else {
      hhiResult.evidenceIds = [];
    }

    if (whaleResult.status === 'ok' && whaleResult.activeWhaleCount > 0) {
      const whaleNode = EvidenceMapper.buildWhaleBehaviorEvidence({
        whaleCount: whaleResult.activeWhaleCount,
        totalWhaleSupplySharePct: whaleResult.totalWhaleSupplySharePct,
        netInflowTokens: whaleResult.whaleNetInflow,
        netOutflowTokens: whaleResult.whaleNetOutflow,
        phase: whaleResult.phase,
      });
      evidenceNodes.push(whaleNode);
      // Write canonical ID back into the engine result
      whaleResult.evidenceIds = [whaleNode.evidenceId];
    } else {
      whaleResult.evidenceIds = [];
    }

    if (regimeResult.status === 'ok') {
      const regimeNode = EvidenceMapper.buildMarketRegimeEvidence({
        regime: regimeResult.regime,
        candleCount: regimeResult.stats?.candleCount ?? 0,
        priceSlopePct: regimeResult.stats?.priceSlopePerCandle ?? 0,
        volumeSlope: regimeResult.stats?.volumeSlopePerCandle ?? 0,
        priceVolatility: regimeResult.stats?.priceVolatility ?? 0,
        totalPriceChangePct: regimeResult.stats?.totalPriceChangePct ?? 0,
        confidence: regimeResult.confidence,
      });
      evidenceNodes.push(regimeNode);
      // Market regime is not a direct scoring module — no evidenceIds writeback needed
    }

    if (capitalResult.status === 'ok') {
      const capNode = EvidenceMapper.buildCapitalEfficiencyEvidence({
        fdvUsd: finalFdv,
        liquidityUsd: finalLiquidity,
        ratio: capitalResult.fdvToLiquidityRatio,
        sensitivity: capitalResult.sensitivity,
        multiplier: capitalResult.capitalSensitivityMultiplier,
      });
      evidenceNodes.push(capNode);
      // Write canonical ID back into the engine result
      capitalResult.evidenceIds = [capNode.evidenceId];
    } else {
      capitalResult.evidenceIds = [];
    }

    if (buyerQualityResult.status === 'ok' || buyerQualityResult.status === 'partial') {
      const buyerNode = EvidenceMapper.buildBuyerQualityEvidence({
        score: buyerQualityResult.buyerQualityScore,
        totalBuyers: buyerQualityResult.cohortMetrics.totalBuyers,
        returningBuyerRatio: buyerQualityResult.cohortMetrics.returningBuyerRatio,
        capitalDiversityIndex: buyerQualityResult.cohortMetrics.capitalDiversityIndex,
        unavailableMetrics: buyerQualityResult.unavailableMetrics,
      });
      evidenceNodes.push(buyerNode);
      // Write canonical ID back into the engine result
      buyerQualityResult.evidenceIds = [buyerNode.evidenceId];
    } else {
      buyerQualityResult.evidenceIds = [];
    }

    // ── Build limitations array: merge engine-level unavailable metrics with holder availability status ──
    const limitations: string[] = [...(buyerQualityResult.unavailableMetrics ?? [])];
    if (holderDataset.status === 'unavailable') {
      limitations.push(
        `Whale behavior analysis is unavailable for ${network.toUpperCase()} tokens: ` +
        'on-chain holder snapshot provider is not yet integrated. ' +
        'Risk score whale sub-scores use default fallback values.'
      );
    } else if (holderDataset.status === 'insufficient_data') {
      limitations.push(
        'Holder provider returned insufficient data. Whale behavior confidence is reduced.'
      );
    }

    const compiledEvidence = EvidenceMapper.collectEvidence(evidenceNodes);

    // Calculate aggregated risk score
    // NOTE: Evidence IDs in engine results were written back from EvidenceMapper above,
    // so SubScore.evidenceIds and RiskSignal.evidenceIds now carry the real node IDs.
    //
    // ── Extract GoPlus / Solana authority flags from basicScanData (if available) ──
    // basicScanData.securityInfo holds the raw GoPlus response for EVM tokens.
    // For Solana, solanaScanner.ts stores mintFunction / freezable as string flags.
    const secInfo = basicScanData?.securityInfo;
    const evmContractRisk = (network !== 'solana' && secInfo) ? {
      isProxy:              secInfo.is_proxy === '1',
      transferPausable:     secInfo.transfer_pausable === '1',
      isBlacklisted:        secInfo.is_blacklisted === '1',
      ownerChangeBalance:   secInfo.owner_change_balance === '1',
      canTakeBackOwnership: secInfo.can_take_back_ownership === '1',
      isMintable:           secInfo.is_mintable === '1',
      tradingCooldown:      secInfo.trading_cooldown === '1',
    } : undefined;

    const solanaAuthorityRisk = (network === 'solana' && basicScanData) ? {
      mintAuthorityActive:   basicScanData.mintFunction === 'Enabled',
      freezeAuthorityActive: basicScanData.freezable === 'Yes',
      upgradeAuthorityActive: false, // requires separate program account check
    } : undefined;

    const riskScoreResult = calculateRiskScore({
      ammSlippage: ammResult,
      volumeConcentration: hhiResult,
      whaleBehavior: whaleResult,
      whaleExit: whaleExitResult,
      buyerQuality: buyerQualityResult,
      capitalEfficiency: capitalResult,
      isHoneypot,
      evmContractRisk,
      solanaAuthorityRisk,
    });

    // ── Evidence ID integrity validation ──
    // Verify every risk signal and subscore evidenceId resolves to an actual EvidenceNode.
    // Broken references are surfaced as warnings so they are caught during development/testing.
    if (process.env.NODE_ENV !== 'production') {
      const packagedIds = new Set(compiledEvidence.map(n => n.evidenceId));
      const broken: string[] = [];
      for (const signal of riskScoreResult.topRisks) {
        for (const id of signal.evidenceIds) {
          if (id && !packagedIds.has(id)) broken.push(`RiskSignal[${signal.riskId}] → "${id}"`);
        }
      }
      for (const sub of riskScoreResult.subScores) {
        for (const id of sub.evidenceIds) {
          if (id && !packagedIds.has(id)) broken.push(`SubScore[${sub.module}] → "${id}"`);
        }
      }
      if (broken.length > 0) {
        console.warn(
          `[DEEP SERVICE] ⚠ Evidence ID integrity check FAILED — ${broken.length} unresolvable reference(s):\n` +
          broken.map(b => `  • ${b}`).join('\n') +
          '\n  Ensure EvidenceMapper.build*() is called before calculateRiskScore() and IDs are written back.'
        );
      }
    }

    // ── Calculate Data Freshness (Fix B) ──
    //
    // Three explicit states per dataset:
    //   'fresh'   – valid provider timestamp within threshold
    //   'stale'   – valid provider timestamp but exceeds threshold
    //   'unknown' – no usable timestamp (provider failed, no data, empty dataset)
    //
    // isXStale is true for BOTH 'stale' and 'unknown' — provider failure must never
    // resolve as 'not stale' (i.e. false). This drives staleDataWarning correctly.
    const scanTime = Math.floor(Date.now() / 1000);

    // Cache Age (Elevator scan cache age)
    const cacheAgeSeconds = elevatorResult?.collectedAt ? (scanTime - elevatorResult.collectedAt) : undefined;

    // ── Market Data Freshness ──
    const marketDataTimestamp = meta?.timestamp;
    let marketDataFreshness: DataFreshnessStatus;
    let marketDataAgeSeconds: number | undefined;
    if (marketDataTimestamp !== undefined && marketDataTimestamp > 0) {
      marketDataAgeSeconds = scanTime - marketDataTimestamp;
      marketDataFreshness = marketDataAgeSeconds > FRESHNESS_THRESHOLDS.MARKET_DATA ? 'stale' : 'fresh';
    } else if (meta?.source && meta.source !== 'fallback' && meta.source !== '') {
      // Provider succeeded but returned no explicit timestamp (e.g. DexScreener, GeckoTerminal).
      // The data was collected during this scan run, so it is known fresh.
      marketDataAgeSeconds = undefined;
      marketDataFreshness = 'fresh';
    } else {
      // No usable timestamp and no live provider — freshness is unknown.
      marketDataAgeSeconds = undefined;
      marketDataFreshness = 'unknown';
    }
    const isMarketDataStale = marketDataFreshness !== 'fresh';

    // ── OHLCV Freshness ──
    const latestCandle = ohlcv && ohlcv.length > 0
      ? ohlcv.reduce((latest, candle) => candle.timestamp > latest.timestamp ? candle : latest, ohlcv[0])
      : null;
    const ohlcvTimestamp = latestCandle?.timestamp;
    let ohlcvFreshness: DataFreshnessStatus;
    let ohlcvAgeSeconds: number | undefined;
    if (ohlcvTimestamp !== undefined) {
      ohlcvAgeSeconds = scanTime - ohlcvTimestamp;
      ohlcvFreshness = ohlcvAgeSeconds > FRESHNESS_THRESHOLDS.OHLCV ? 'stale' : 'fresh';
    } else {
      ohlcvAgeSeconds = undefined;
      ohlcvFreshness = 'unknown';
    }
    const isOhlcvStale = ohlcvFreshness !== 'fresh';

    // ── Transaction Freshness ──
    const latestTx = txs && txs.length > 0
      ? txs.reduce((latest, tx) => tx.timestamp > latest.timestamp ? tx : latest, txs[0])
      : null;
    const transactionTimestamp = latestTx?.timestamp;
    let transactionFreshness: DataFreshnessStatus;
    let transactionAgeSeconds: number | undefined;
    if (transactionTimestamp !== undefined) {
      transactionAgeSeconds = scanTime - transactionTimestamp;
      transactionFreshness = transactionAgeSeconds > FRESHNESS_THRESHOLDS.TRANSACTIONS ? 'stale' : 'fresh';
    } else {
      transactionAgeSeconds = undefined;
      transactionFreshness = 'unknown';
    }
    const isTransactionStale = transactionFreshness !== 'fresh';

    // Aggregate warning: fires when ≥2 datasets are not fresh (stale OR unknown).
    // unknown ≠ fresh — provider failure must not silence the warning.
    const nonFreshCount = (isMarketDataStale ? 1 : 0) + (isOhlcvStale ? 1 : 0) + (isTransactionStale ? 1 : 0);
    const staleDataWarning = nonFreshCount >= 2;

    const freshness = {
      scanTime,
      cacheAgeSeconds,
      marketDataTimestamp,
      marketDataAgeSeconds,
      marketDataFreshness,
      isMarketDataStale,
      ohlcvTimestamp,
      ohlcvAgeSeconds,
      ohlcvFreshness,
      isOhlcvStale,
      transactionTimestamp,
      transactionAgeSeconds,
      transactionFreshness,
      isTransactionStale,
    };

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
      liquidityFragmentation: fragmentationResult,
      riskScore: riskScoreResult,
      evidence: compiledEvidence,
      dataQuality: {
        staleDataWarning,
        elevatorDataReused: elevatorReused,
        transactionCount: txs.length,
        ohlcvCandleCount: ohlcv.length,
      },
      limitations,
      scanId,
      timestamp: Date.now(),
    });

    // ── Determine Scan Outcome ──
    let outcome: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'INSUFFICIENT_DATA' | 'FAILED' = 'SUCCESS';

    const allModulesOkOrPartial =
      ammResult.status !== 'insufficient_data' &&
      hhiResult.status !== 'insufficient_data' &&
      whaleResult.status !== 'insufficient_data' &&
      whaleExitResult.status !== 'insufficient_data' &&
      buyerQualityResult.status !== 'insufficient_data' &&
      regimeResult.status !== 'insufficient_data' &&
      capitalResult.status !== 'insufficient_data';

    if (!riskScoreResult.sufficientData) {
      outcome = 'INSUFFICIENT_DATA';
    } else if (network !== 'solana') {
      // For EVM network, holders are unavailable, so it is always at best PARTIAL_SUCCESS
      outcome = 'PARTIAL_SUCCESS';
    } else if (!allModulesOkOrPartial) {
      outcome = 'PARTIAL_SUCCESS';
    }

    const finalStatus: 'success' | 'partial_failure' | 'failure' =
      outcome === 'SUCCESS' ? 'success'
      : outcome === 'PARTIAL_SUCCESS' ? 'partial_failure'
      : 'failure';

    // ─────────────────────────────────────────────
    // Step 6B: Phase 5D-6 — Liquidity Stress Analysis
    // ─────────────────────────────────────────────
    let liquidityStressResult: import('./types').LiquidityStressReport | undefined;
    try {
      // Load historical snapshots for the primary V2 pool (non-blocking failure allowed)
      let historicalSnapshots: { block_number: number; block_timestamp: string | null; reserve0: string; reserve1: string }[] = [];
      const v2Pool = finalPools.find(
        p => 'poolType' in p && p.poolType === 'constant-product' && p.poolIdentifierType === 'address'
      ) as NormalizedPoolState | undefined;

      if (v2Pool && network !== 'solana') {
        const records = await queryHistoricalReserves(
          network,
          v2Pool.poolIdentifier,
          DEEP_SCAN_CONFIG.liquidityStress.maxHistoricalSnapshots
        );
        // Map HistoricalReservesRecord to HistoricalReserveSnapshot
        historicalSnapshots = records.map(r => ({
          block_number: r.block_number,
          block_timestamp: r.timestamp,
          reserve0: r.reserve0,
          reserve1: r.reserve1,
        }));
      }

      // Top whale combined balance for holder exit scenarios
      const whaleBalanceTokens: number | null = (() => {
        if (whaleResult.status !== 'ok' || !whaleResult.whales.length) return null;
        const top = [...whaleResult.whales]
          .filter(w => !w.isFiltered)
          .sort((a, b) => b.observedBatchBalance - a.observedBatchBalance)[0];
        return top ? top.observedBatchBalance : null;
      })();

      liquidityStressResult = analyzeLiquidityStress({
        pools: finalPools,
        spotPriceUsd: finalSpotPrice,
        historicalSnapshots,
        whaleBalanceTokens,
        positionSizesUsd: input.simulatedPositionSizes || DEEP_SCAN_CONFIG.liquidityStress.slippageCurveSizesUsd,
        // Required for correct token slot selection and decimal normalization
        tokenAddress: address,
        tokenDecimals: finalDecimals,
      });
    } catch (err: any) {
      console.warn('[DEEP SERVICE] Phase 5D-6 liquidity stress analysis failed (non-fatal):', err?.message);
    }

    // ─────────────────────────────────────────────
    // Step 6C: Module 13 — Historical Behavior Analysis
    // ─────────────────────────────────────────────
    let historicalBehaviorResult: import('./types').HistoricalBehaviorResult | undefined;
    try {
      historicalBehaviorResult = analyzeHistoricalBehavior(ohlcv, txs);
    } catch (err: any) {
      console.warn('[DEEP SERVICE] Module 13 historical behavior analysis failed (non-fatal):', err?.message);
    }

    // ─────────────────────────────────────────────
    // Step 7: Package Final Result
    // ─────────────────────────────────────────────
    // ─────────────────────────────────────────────
    // Phase 4: Run Reputation & Traceability Modules
    // ─────────────────────────────────────────────
    let deployerProfileResult: any = undefined;
    let unlockScheduleResult: any = undefined;
    let rugMatchResult: any = undefined;
    let insiderAccumulationResult: any = undefined;

    try {
      // 1. Deployer Profiling (with 2s timeout handled internally by DeployerProfiler)
      const deployerAddr = meta?.creatorAddress || basicScanData?.securityInfo?.creatorAddress || '';
      if (deployerAddr) {
        let solConn: Connection | undefined = undefined;
        if (network === 'solana') {
          solConn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        }
        deployerProfileResult = await DeployerProfiler.profile(deployerAddr, network, solConn);
      }
    } catch (err: any) {
      console.warn('[DEEP SERVICE] Phase 4 Deployer Profiling failed (non-fatal):', err.message);
    }

    try {
      // 2. Token Unlock & Vesting Schedule Tracking
      let solConn: Connection | undefined = undefined;
      if (network === 'solana') {
        solConn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      }
      unlockScheduleResult = await TokenUnlockTracker.getUnlockSchedule(
        address,
        network,
        txs,
        finalTotalSupply,
        solConn
      );
    } catch (err: any) {
      console.warn('[DEEP SERVICE] Phase 4 Token Unlock Tracking failed (non-fatal):', err.message);
    }

    try {
      // 3. Rug Pattern Matching
      const deployerAddr = meta?.creatorAddress || basicScanData?.securityInfo?.creatorAddress || '';
      const bytecode = basicScanData?.bytecode || null;
      if (deployerAddr) {
        rugMatchResult = await RugPatternMatcher.analyze(
          address,
          deployerAddr,
          bytecode,
          network
        );
      }
    } catch (err: any) {
      console.warn('[DEEP SERVICE] Phase 4 Rug Pattern Matching failed (non-fatal):', err.message);
    }

    try {
      // 4. Insider Accumulation Detection
      const volume24h = meta?.volume24hUsd || 0;
      insiderAccumulationResult = InsiderAccumulationDetector.analyze(
        ohlcv,
        txs,
        finalSpotPrice,
        volume24h
      );
    } catch (err: any) {
      console.warn('[DEEP SERVICE] Phase 4 Insider Accumulation Detection failed (non-fatal):', err.message);
    }

    // ─────────────────────────────────────────────
    // Phase 5: Run AI Agents in Parallel
    // (Exchange Listing + News) — non-blocking via Promise.allSettled
    // ─────────────────────────────────────────────
    let exchangeListingResult: any = undefined;
    let newsResult: any = undefined;

    try {
      const tokenName = meta?.name ?? 'Unknown Token';
      const tokenSymbol = meta?.symbol ?? 'TOKEN';

      const [listingSettled, newsSettled] = await Promise.allSettled([
        ExchangeListingAgent.run(tokenName, tokenSymbol, address),
        NewsAgent.run(tokenName, tokenSymbol),
      ]);

      if (listingSettled.status === 'fulfilled') {
        exchangeListingResult = listingSettled.value;
      } else {
        console.warn('[DEEP SERVICE] Phase 5 ExchangeListingAgent rejected:', listingSettled.reason?.message);
      }

      if (newsSettled.status === 'fulfilled') {
        newsResult = newsSettled.value;
      } else {
        console.warn('[DEEP SERVICE] Phase 5 NewsAgent rejected:', newsSettled.reason?.message);
      }
    } catch (err: any) {
      console.warn('[DEEP SERVICE] Phase 5 AI agents failed (non-fatal):', err.message);
    }

    const scanDurationMs = Date.now() - startTime;

    const result: DeepScanResult = {
      status: finalStatus,
      outcome,
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
        volume24hUsd: meta?.volume24hUsd ?? null,
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
      liquidityFragmentation: fragmentationResult,
      smartMoney: smartMoneyResult,
      liquidityStress: liquidityStressResult,
      historicalBehavior: historicalBehaviorResult,
      deployerProfile: deployerProfileResult,
      tokenUnlockSchedule: unlockScheduleResult,
      rugPatternMatch: rugMatchResult,
      insiderAccumulation: insiderAccumulationResult,
      exchangeListing: exchangeListingResult,
      news: newsResult,
      riskScore: riskScoreResult,
      topRisks: riskScoreResult.topRisks,
      evidence: compiledEvidence,
      traderIntelligence: reportResult,
      dataQuality: {
        staleDataWarning,
        elevatorDataReused: elevatorReused,
        transactionCount: txs.length,
        ohlcvCandleCount: ohlcv.length,
        freshness,
      },
      limitations,
      overallConfidence: riskScoreResult.confidence,
      scanDurationMs,
    };

    // Enqueue historical pool reserve indexing asynchronously (non-blocking)
    const primaryV2Pool = finalPools.find(
      p => 'poolType' in p && p.poolType === 'constant-product' && p.poolIdentifierType === 'address'
    ) as NormalizedPoolState | undefined;

    if (primaryV2Pool && network !== 'solana') {
      (async () => {
        try {
          const hexBlock = await queryAlchemyHistoricalRpc<string>(network, 'eth_blockNumber');
          const latestBlock = parseInt(hexBlock, 16);
          if (latestBlock > 0) {
            await schedulePoolReservesIndexing(primaryV2Pool, network, latestBlock);
          }
        } catch (err: any) {
          console.warn(`[DEEP SERVICE] Asynchronous historical reserves scheduling skipped/failed:`, err.message);
        }
      })().catch(() => {});
    }

    // Store in session cache (only when userId is present — prevents cross-user key collisions)
    if (cacheKey) {
      setCachedResult(cacheKey, result);
    }
    return result;
  }
}

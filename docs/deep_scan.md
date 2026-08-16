# Deep Scan — As-Built System Documentation

> **Documentation Type:** Technical portfolio / as-built reference.  
> **Source of Truth:** Repository source code, verified module-by-module.  
> **No roadmaps, no speculative future features. Every claim represents the current repository reality.**

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Current Implementation Status](#2-current-implementation-status)
3. [What Deep Scan Actually Does](#3-what-deep-scan-actually-does)
4. [End-to-End Execution Flow](#4-end-to-end-execution-flow)
5. [Input Contract](#5-input-contract)
6. [Data Reused from Basic Scan](#6-data-reused-from-basic-scan)
7. [Data Reused from Elevator Scan](#7-data-reused-from-elevator-scan)
8. [Deep Scan-Owned Data Sources](#8-deep-scan-owned-data-sources)
9. [Core Architecture](#9-core-architecture)
10. [Buyer Quality (Module 6)](#10-buyer-quality-module-6)
11. [Wallet Quality / Reputation (Module 1)](#11-wallet-quality--reputation-module-1)
12. [Historical Behavior (Module 13)](#12-historical-behavior-module-13)
13. [DEX Liquidity (Module 11)](#13-dex-liquidity-module-11)
14. [Liquidity Stress (Module 3)](#14-liquidity-stress-module-3)
15. [Exit Risk (Module 7)](#15-exit-risk-module-7)
16. [Capital Efficiency (Module 12)](#16-capital-efficiency-module-12)
17. [Organic Price / Market Behavior (Module 2)](#17-organic-price--market-behavior-module-2)
18. [Market Regime (Module 8)](#18-market-regime-module-8)
19. [Smart Money (Module 5)](#19-smart-money-module-5)
20. [Whale Behavior (Module 4)](#20-whale-behavior-module-4)
21. [Risk Scoring (Module 14)](#21-risk-scoring-module-14)
22. [Top Risks (Module 9)](#22-top-risks-module-9)
23. [Trader Intelligence (Module 15)](#23-trader-intelligence-module-15)
24. [Live Monitoring (Module 10)](#24-live-monitoring-module-10)
25. [Configuration](#25-configuration)
26. [Data Freshness](#26-data-freshness)
27. [Error and Degraded States](#27-error-and-degraded-states)
28. [Current Limitations](#28-current-limitations)
29. [Implementation Coverage](#29-implementation-coverage)
30. [Source Code Map](#30-source-code-map)

---

## 1. Purpose

The **Deep Scan** is the premium token analysis tier (standard cost: 15 credits) in the scanning suite. It delivers deep, AMM-aware market structure simulations, wallet cohort quality profiling, and cross-token Smart Money reputation queries.

Unlike the Basic Scan (which checks contract security flags) or the Elevator Scan (which profiles the current transaction batch), the Deep Scan models execution slippage curves, exit-risk liquidations, coordinated wallet activity, and historical reserve volatility. It synthesizes these findings into a trader-focused intelligence report detailing structural risks and execution thresholds.

---

## 2. Current Implementation Status

Deep Scan is **fully operational** in the backend runtime across Solana, Ethereum, and BSC networks. 

- **12 of 15 specification modules** are fully or partially implemented and connected to the execution flow.
- **2 modules** (Live Monitoring, Historical Behavior/Cycles) are currently unavailable or not connected to the Next.js API route runtime.
- **1 engine** (`SmartMoneyPnlEngine`) is implemented but remains unused by the primary coordinator.
- **Session Caching** is fully implemented with automated TTL and data freshness re-evaluation.
- **Asynchronous scheduling** for backfilling reserves and reputation tags is integrated via PostgreSQL background job tables.

---

## 3. What Deep Scan Actually Does

If a user submits a token address to Deep Scan, the system coordinates the following pipeline:
1. **Validates & Detects Chain:** Identifies if the address is Solana or EVM; auto-resolves ambiguous EVM contracts via parallel bytecode checks.
2. **Checks Session Cache:** Looks up `'deep:<userId>:<network>:<tokenAddress>'`. If found, checks if cached timestamps exceed freshness thresholds. Invalidates stale entries.
3. **Retrieves Baseline Data:** Reuses token metadata from Basic Scan and transaction/candle data from Elevator Scan. If missing, executes fallback crawling in real-time.
4. **Enriches Pools:** Queries Alchemy RPC to read raw V2 pool reserves and V3 CLMM slot0 state.
5. **Profiles Whales:** Samples top whales, queries Bitquery to check their history within a 90-day lookback, and tags them by age (`fresh`, `recent`, `established`).
6. **Simulates Executions:** Runs BigInt AMM constant-product execution models to calculate price impact across sizes ($1K to $100K) and simulates exit cascades if whales liquidate 10%/25%/50% of their positions.
7. **Profiles Buyers:** Queries PostgreSQL cache for buyer wallet quality profiles. miss up to 10 buyer profiles are synchronously enqueued to GoldRush; remaining misses are enqueued asynchronously.
8. **Checks Smart Money:** Evaluates top 5 buyers for cross-token profitability, enqueuing missing reputation profiles for background indexing.
9. **Applies Risk Scoring:** normalizes risk sub-scores across measured engines, subtracts organic mitigations, and clamps final score (0-100).
10. **Generates Report:** Compiles findings into executive narratives, slippage schedules, and formatted lists of top risks.

---

## 4. End-to-End Execution Flow

The sequence diagram below maps the runtime path from request to response:

```text
User Request (POST /api/scan/deep)
  │
  ▼
API Route Handler [app/api/scan/deep/route.ts]
  │
  ├─► Auth Check (supabase.auth.getUser)
  ├─► Credit Deduction RPC (deduct_credits_for_scan)
  │
  ▼
DeepScanService.runScan [lib/deep_scan/DeepScanService.ts]
  │
  ├─► Cache Check (sessionCache.get)
  ├─► Metadata Resolving (scanSolanaToken / scanEVMToken Fallbacks)
  ├─► Pool Enrichment [lib/deep_scan/poolEnrichment.ts]
  │     ├─► V2 Reserves (fetchV2PoolReserves via Alchemy)
  │     └─► V3 slot0 (enrichClmmPoolsWithSlot0 via Alchemy)
  │
  ├─► Transaction / Ingestion Resolving (CollectorFactory Fallback)
  │
  ├─► Bitquery Whale Enrichment [lib/deep_scan/walletIntelligence.ts]
  │
  ├─► Parallel Execution Engines [lib/deep_scan/engines/]
  │     ├─► AmmSlippageSimulator (simulateAmmSlippage)
  │     ├─► VolumeConcentrationAnalyzer (analyzeVolumeConcentration)
  │     ├─► WhaleBehaviorAnalyzer (analyzeWhaleBehavior)
  │     ├─► WhaleExitSimulator (simulateWhaleExit)
  │     ├─► MarketRegimeAnalyzer (analyzeMarketRegime)
  │     ├─► CapitalEfficiencyAnalyzer (analyzeCapitalEfficiency)
  │     └─► LiquidityFragmentationAnalyzer (analyzeLiquidityFragmentation)
  │
  ├─► Wallet Quality Cache-First Lookup [lib/deep_scan/walletQualityCache.ts]
  │     ├─► Sync GoldRush Enrichment [lib/deep_scan/walletEnrichment.ts]
  │     └─► Async Enrichment Queueing (enqueueWalletEnrichmentJob)
  │
  ├─► Smart Money Cache-First Lookup [lib/deep_scan/smartMoneyCache.ts]
  │     └─► Async Indexing Queueing (enqueueSmartMoneyIndexingJob)
  │
  ├─► Buyer Quality Analyzer [lib/deep_scan/engines/BuyerQualityAnalyzer.ts]
  │
  ├─► Risk Scoring Engine [lib/deep_scan/engines/RiskScoringEngine.ts]
  │
  ├─► Liquidity Stress (V2 ONLY) [lib/deep_scan/engines/LiquidityStressAnalyzer.ts]
  │     └─► DB Historical Reserves Lookup (queryHistoricalReserves)
  │
  ├─► Trader Intelligence Report [lib/deep_scan/engines/TraderIntelligenceGenerator.ts]
  │
  ▼
Asynchronous Tasks (Dispatched Non-blocking)
  ├─► Schedule Pool Reserves Indexing (schedulePoolReservesIndexing)
  └─► Cache Save (setCachedResult)
```

---

## 5. Input Contract

```typescript
interface DeepScanInput {
  tokenAddress: string;
  network: string; // 'eth' | 'bsc' | 'solana'
  elevatorResult?: CollectorResult; // Scenario A: pre-collected transaction batch
  tokenMetadata?: TokenMetadata;    // Scenario A: pre-collected contract parameters
  simulatedPositionSizes?: number[]; // Custom sizes (USD) for slippage curve
  maxTransactions?: number;         // Scenario B: Crawling limit on the fly
  sessionId?: string;               // UUID for idempotency
  userId?: string;                  // Scopes session caching
}
```

---

## 6. Data Reused from Basic Scan

To avoid duplicate RPC and API calls, `DeepScanService.runScan` reuses the following token metadata fields when provided:

| Field | Source Parameter | Target Property |
|---|---|---|
| Token Symbol | `tokenMetadata.symbol` | `result.tokenMetadata.symbol` |
| Decimals | `tokenMetadata.decimals` | `result.tokenMetadata.decimals` |
| Total Supply | `tokenMetadata.totalSupply` | `result.tokenMetadata.totalSupply` |
| Spot Price | `tokenMetadata.spotPriceUsd` | `result.marketSummary.priceUsd` |
| Fully Diluted Valuation | `tokenMetadata.fdvUsd` | `result.marketSummary.fdvUsd` |
| Total Liquidity | `tokenMetadata.totalLiquidityUsd` | `result.marketSummary.totalLiquidityUsd` |
| Pool Array | `tokenMetadata.mainPools` | Base pool list for enrichment |
| Creator Wallet | `tokenMetadata.creatorAddress` | Excluded from concentration; checks creator funding |
| Honeypot Status | `tokenMetadata.securityFlags.isHoneypot` | Triggers 100 risk score override |

*If `tokenMetadata` is absent, the service queries `scanSolanaToken` or `scanEVMToken` directly as a fallback.*

---

## 7. Data Reused from Elevator Scan

Elevator Scan outputs are reused under Scenario A to avoid duplicate block-history crawling:

- **Normalized Transactions:** `elevatorResult.transactions` is reused (capped to `maxTransactions` via `slice()`). Used as the cohort dataset for volume concentration, wash trading, buyer profiling, and whale accumulation.
- **OHLCV Candlesticks:** `elevatorResult.ohlcv` is passed directly to the Market Regime Analyzer.
- **On-chain Holders:** `elevatorResult.holders` is consumed directly for whale classification and exit simulations (EVM networks).
- **Exchange Tags:** Per-transaction exchange flow flags (`toExchange`, `fromExchange`, `exchangeName`) are reused to isolate CEX wallets.
- **Wash Trading Primitives:** If the transaction window matches, wash trader addresses (`wash_wallets`) are reused.

---

## 8. Deep Scan-Owned Data Sources

Deep Scan queries several external APIs and internal caches that are not accessed by Basic or Elevator scans:

1. **Alchemy RPC nodes:** Used to read on-chain contract states for constant-product pool reserves (`getReserves`) and V3 CLMM slot0 metrics (`sqrtPriceX96`, `liquidity`, `tick`, etc.).
2. **Bitquery GraphQL API:** Queries historical wallet flows over a 90-day lookback window (`sinceIso`) for identified whales.
3. **Covalent GoldRush API:** Synchronously Walks up to 5 transaction history pages (capped at 500 transactions) to compile buyer reputation profiles (`enrichSingleWallet`).
4. **Supabase PostgreSQL Tables:**
   - `wallet_reputation`: Cached wallet quality profiles (transaction counts, age, funding details).
   - `smart_money_reputation`: Cached win rate, ROI, and cross-token trading profiles.
   - `historical_pool_reserves`: Stored historical reserve snapshots for V2 pools.
   - `wallet_enrichment_jobs` & `indexing_jobs`: Background queues for SWR revalidation.

---

## 9. Core Architecture

The analysis code is structured in a clear multi-tiered repository layout:

- **Coordination Layer:** [`lib/deep_scan/DeepScanService.ts`](file:///d:/scanner/lib/deep_scan/DeepScanService.ts) handles cache checks, fallback data fetching, and chains the analyzers.
- **Enrichment Layer:** [`lib/deep_scan/poolEnrichment.ts`](file:///d:/scanner/lib/deep_scan/poolEnrichment.ts) and [`lib/deep_scan/walletIntelligence.ts`](file:///d:/scanner/lib/deep_scan/walletIntelligence.ts) handle RPC and Bitquery queries.
- **Analytical Layer:** Found in `lib/deep_scan/engines/`. Each engine is stateless, receiving arrays of normalized transactions, pools, or reputation maps.
- **Queueing Layer:** Cache files handle PostgreSQL lookups and job inserts.

---

## 10. Buyer Quality (Module 6)

### Purpose
Evaluates the maturity and organic distribution of the active buyer cohort.

### Inputs
`UniversalTransaction[]`, contract/CEX exclusions, `walletProfiles` map, `walletReputations` map, and `creatorAddress`.

### Data Source
Calculated from the normalized transaction batch, combined with cached GoldRush profiles and Smart Money reputation records.

### Processing
1. Groups buy transactions by receiver address. Excludes CEX and token contract addresses.
2. Calculates returning buyer count (wallets with >1 purchase) and single-use count.
3. Computes the **Capital Diversity Index** using the coefficient of variation (standard deviation / mean) of buy sizes:
   $$\text{Diversity} = 1 - \frac{\text{StdDev}}{\text{Mean} \cdot 2}$$
4. Computes the `freshWalletRatio` over profiles where `walletAgeDays < 7`. *Only profiled wallets are included in the denominator; missing profiles are never treated as zero.*
5. **Phase 5D-7 Adjustments:** Applies score penalties if:
   - Shared funding concentration is high: Largest funding group ratio > 33% (penalizes 15 points).
   - Low activity ratio is high: Profiled wallets with <5 transactions or <2 active days exceed 50% (penalizes 10 points).
   - Fresh wallet ratio is high: Profiled wallets aged <7 days exceed 50% (penalizes 10 points).
6. **Phase 5D-8 Adjustments:** Applies score adjustments if reputation coverage is >=20%:
   - Low cross-token activity: Reputation-profiled buyers with cross-token history <30% (penalizes 10 points).
   - Low win-rate: Cohort average win rate <40% (penalizes 8 points).
   - High win-rate: Cohort average win rate >=65% (awards 8 bonus points).
7. **Phase 5D-9 Adjustments:** Applies a penalty of 15 points if the creator-funded buyer ratio exceeds 10% (excluding CEX/bridge/contract funding types).

### Output
`BuyerQualityResult` containing `buyerQualityScore` (0-100), cohort metrics, positive/negative factor lists, and `unavailableMetrics` (listed if profile/reputation coverage is below threshold).

### Integration
Consumed by the `RiskScoringEngine` (10% weight) and formatting rules in the Trader Intelligence report.

### Limitations
Cannot analyze wallets that lack cached database profiles or those funded via mixer/anonymizing contracts.

### Source References
- File: [`lib/deep_scan/engines/BuyerQualityAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/BuyerQualityAnalyzer.ts)
- Symbol: `analyzeBuyerQuality`

---

## 11. Wallet Quality / Reputation (Module 1)

### Purpose
Profiles individual wallet histories and identifies funding links to expose sniper networks or developer-funded accounts.

### Inputs
Normalized wallet address, chain network.

### Data Source
Supabase `wallet_reputation` cache table. Synchronous page-walking via GoldRush client is executed for cache misses up to a limit of 10.

### Cache TTL Semantics
Classified by `classifyWalletCacheAge`:
- **Fresh Cache (< 12 days):** Returns cached profile directly; no revalidation.
- **SWR (12–15 days):** Returns cached profile directly; enqueues an asynchronous revalidation job in `wallet_enrichment_jobs`.
- **Stale Cache (>= 15 days):** Marked `STALE_CACHE`. Triggers sync revalidation if within the limit, otherwise enqueues async.
- **Miss / DB Error:** Marked `miss` / `unavailable`.

### Processing
1. Extracts block history using GoldRush `transactions_v3` pages.
2. Derives transaction count, active days, and age based on block timestamps.
3. Obtains funding source by tracking the very first transaction in the wallet's history.
4. Identifies the type of funding wallet (e.g. CEX, bridge, contract, or user wallet).

### Output
`WalletQualityProfile` containing `walletAgeDays`, `transactionCount`, `activeDaysCount`, `fundingSource`, and `fundingSourceType`.

### Integration
Forwarded to the `BuyerQualityAnalyzer` to detect creator-funded buyers and compute cohort freshness.

### Limitations
Only tracks history on supported EVM chains (BSC, Ethereum). Solana wallet age and funding tracking are currently unavailable.

### Source References
- Files: [`lib/deep_scan/walletQualityCache.ts`](file:///d:/scanner/lib/deep_scan/walletQualityCache.ts), [`lib/deep_scan/walletEnrichment.ts`](file:///d:/scanner/lib/deep_scan/walletEnrichment.ts)
- Symbols: `lookupWalletProfile`, `enrichSingleWallet`

---

## 12. Historical Behavior (Module 13)

### Current Status
🔴 **UNAVAILABLE / NOT CONNECTED**

Although the directory structure refers to historical analysis, there is no active engine that maps long-term pump-and-dump signatures or calculates average historical drawdowns. No source files implement this capability, and the coordinator does not execute any historical cycle detector.

---

## 13. DEX Liquidity (Module 11)

### Purpose
Quantifies the fragmentation and concentration of token liquidity across multiple AMM pools.

### Inputs
`NormalizedPoolState[]` or `LiquidityPool[]`.

### Data Source
Enriched pool arrays resolved during the initial scan stages.

### Processing
1. Extracts unique pool addresses and excludes pools with zero or negative liquidity.
2. Computes the **Herfindahl-Hirschman Index (HHI)** over pool liquidity shares:
   $$\text{PoolHHI} = \sum (\text{poolShare}^2)$$
3. Classifies concentration level:
   - `monopoly`: HHI > 0.80 (single pool holds >=80% of liquidity).
   - `high`: HHI > 0.50.
   - `moderate`: HHI > 0.25.
   - `low`: HHI <= 0.25.
4. Sets the `isDominantPool` flag if the largest pool holds >=80% of total liquidity.

### Output
`LiquidityFragmentationResult` containing `poolHHI`, `concentrationLevel`, `poolShares[]`, and `isDominantPool` flag.

### Integration
Appended to the capital efficiency section in the Trader Intelligence report.

### Source References
- File: [`lib/deep_scan/engines/LiquidityFragmentationAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/LiquidityFragmentationAnalyzer.ts)
- Symbol: `analyzeLiquidityFragmentation`

---

## 14. Liquidity Stress (Module 3)

### Purpose
Performs exact AMM simulations to model how pools respond to large trades, whale exit liquidations, and LP withdrawal shocks.

### Inputs
Enriched pool states, spot price, historical snapshots, token decimals, and top whale balances.

### Data Source
Internal reserves (observed on-chain or derived) combined with historical PostgreSQL reserve tables.

### Processing
1. **Executable Liquidity boundaries:** Calculates the maximum token input (sell side) before price impact meets T% (0.5%, 1%, 2%, 5%, 10%) using the O(1) analytical formula:
   $$\text{maxInputTokens} = \text{reserve}_0 \cdot \frac{I - f}{(1 - f)(1 - I)}$$
2. **Scenario A (Large Buy):** Simulates buying tokens by inputting 10% of the quote asset reserve.
3. **Scenario B (Large Sell):** Simulates selling tokens worth 10% of the pool's current TVL.
4. **Scenario C (Whale Exit):** Simulates selling 10%, 25%, 50%, 75%, and 100% of the largest whale's balance.
5. **Scenario D (Multiple Sellers):** Executes 3 sequential sells (each worth 10% of TVL) to model compounding reserve depletion.
6. **Scenario E (Liquidity Deterioration):** Directly subtracts 50% of the pool reserves (simulating LP removal) and runs a $1,000 test trade.
7. **Scenario F (Historical Shock):** Runs a $1,000 test trade against the minimum reserves recorded in the historical database.
8. **Historical Volatility:** Computes target reserve changes between consecutive database snapshots to detect **drains** (drop >50%), **sudden withdrawals** (drop <=50%), and **sudden additions**.

### Output
`LiquidityStressReport` detailing price impacts, execution pricing, remaining executable USD at 1% impact, and historical shock records.

### Integration
Stored in `result.liquidityStress` and narrated in the report.

### Limitations
Only models constant-product V2 pools. Returns `insufficient_data` for concentrated-liquidity (CLMM) pools and Solana pools.

### Source References
- File: [`lib/deep_scan/engines/LiquidityStressAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/LiquidityStressAnalyzer.ts)
- Symbol: `analyzeLiquidityStress`

---

## 15. Exit Risk (Module 7)

### Purpose
Calculates the price slippage and exit impact if top whales liquidate their observed positions.

### Inputs
Top 3 whale entries (by observed balance), pool reserves, spot price.

### Data Source
Whale balances from the transaction cohort and pool parameters.

### Processing
1. Identifies the top 3 whales from the batch transaction window.
2. Derives constant-product reserves using the balanced 50/50 approximation.
3. For each liquidation fraction (10%, 25%, 50%):
   - Computes tokens sold: $\text{tokensSold} = \text{combinedBalance} \cdot \text{fraction}$.
   - Simulates execution using V2 swap formulas.
   - Determines the resulting price delta (slippage):
     $$\text{PriceDelta} = \frac{\text{spotPrice} - \text{executionPrice}}{\text{spotPrice}} \cdot 100$$
4. Classifies exit risk severity: low (<5%), medium (<15%), high (<30%), critical (>=30%).

### Output
`WhaleExitResult` containing `combinedObservedBalance`, scenarios, and `maxSeverity` level.

### Integration
Consumed by the `RiskScoringEngine` (25% weight) and formatted in the report.

### Limitations
Only runs on V2 constant-product pools; CLMM pools are skipped. Uses derived local batch balances, which are not authoritative on-chain holder balances.

### Source References
- File: [`lib/deep_scan/engines/WhaleExitSimulator.ts`](file:///d:/scanner/lib/deep_scan/engines/WhaleExitSimulator.ts)
- Symbol: `simulateWhaleExit`

---

## 16. Capital Efficiency (Module 12)

### Purpose
Evaluates price sensitivity to capital inflows and outflows using valuation-to-liquidity ratios.

### Inputs
Fully Diluted Valuation (FDV), total pool liquidity, spot price.

### Data Source
DexScreener/GeckoTerminal aggregates resolved during initial scan steps.

### Processing
1. Computes the **FDV to Liquidity Ratio**:
   $$\text{Ratio} = \frac{\text{fdvUsd}}{\text{totalLiquidityUsd}}$$
2. Classifies sensitivity:
   - `low`: Ratio < 10 (price is stable; high liquidity relative to valuation).
   - `medium`: 10 <= Ratio < 50.
   - `high`: Ratio >= 50 (price is highly sensitive to capital movements).
3. The `capitalSensitivityMultiplier` is set directly to the FDV/Liquidity ratio.

### Output
`CapitalEfficiencyResult` with the ratio, multiplier, and sensitivity classification.

### Integration
Consumed by `RiskScoringEngine` (10% weight) and written to report.

### Source References
- File: [`lib/deep_scan/engines/CapitalEfficiencyAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/CapitalEfficiencyAnalyzer.ts)
- Symbol: `analyzeCapitalEfficiency`

---

## 17. Organic Price / Market Behavior (Module 2)

### Purpose
Evaluates HHI volume distribution and wash-trading volumes to verify if market activity is organic or manipulated.

### Inputs
`UniversalTransaction[]`, wash trader wallets, CEX/contract exclusion sets.

### Data Source
Reuses Elevator's wash trading output; processes HHI over transaction lists.

### Processing
1. Filters out CEX and token contract wallets.
2. Computes the Herfindahl-Hirschman Index (HHI) for buyer volumes, seller volumes, and total volumes.
3. Computes the `washVolumeRatio` as the sum of USD volumes from wash-flagged wallets divided by total volume.
4. Identifies volume-price divergence: `true` if `buyerHHI > 0.50` and `buySellRatio > 2.0` (high concentration of buying power with skewed ratios).
5. Calculates the **Organic Score** (100 is fully organic):
   $$\text{OrganicScore} = 100 - (\text{buyerHHI} \cdot 40) - (\text{washRatio} \cdot 30) - (\text{sellerHHI} \cdot 30)$$

### Output
`VolumeConcentrationResult` detailing buy/sell volumes, HHI metrics, wash ratio, and organic score.

### Integration
Consumed by the `RiskScoringEngine` (20% weight) and reports.

### Source References
- File: [`lib/deep_scan/engines/VolumeConcentrationAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/VolumeConcentrationAnalyzer.ts)
- Symbol: `analyzeVolumeConcentration`

---

## 18. Market Regime (Module 8)

### Purpose
Classifies the current trading phase based on linear trends, volatility, and volume.

### Inputs
`OHLCVCandle[]` series (requires minimum of 8 candles).

### Data Source
Birdeye 15m OHLCV candles (from Elevator result).

### Processing
1. Calculates linear regression slopes for price and volume series.
2. Computes price volatility (standard deviation of period-to-period returns).
3. Computes **Volume Z-Score**:
   $$\text{VolumeZScore} = \frac{\text{lastVolume} - \text{meanVolume}}{\text{stdVolume}}$$
   *If stdVolume < 0.01, Z-score defaults to 0 to prevent micro-noise from inflating the metric.*
4. Computes the Pearson correlation coefficient between closes and volumes.
5. Classifies the regime:
   - `DEAD`: Price decline, total change < -50%, and volume Z-score < -1.0.
   - `BREAKOUT`: Price slope > trendLimit, last candle volume Z-score >= 2.0.
   - `MOMENTUM`: Price slope > trendLimit, volume slope > 0, price volatility <= volatilityLimit.
   - `DISTRIBUTION`: Price slope > trendLimit, volume slope <= 0.
   - `LIQUIDITY_EXIT`: Price slope < -trendLimit.
   - `RECOVERY`: Price slope > trendLimit, high volatility (>8%) or total drawdown < -20%.
   - `ACCUMULATION`: Consolidation on stable or rising volume (default).

### Output
`MarketRegimeResult` detailing regime classification, stats, and confidence score.

### Integration
Determines executive summary narrative and breakout narratives.

### Source References
- File: [`lib/deep_scan/engines/MarketRegimeAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/MarketRegimeAnalyzer.ts)
- Symbol: `analyzeMarketRegime`

---

## 19. Smart Money (Module 5)

### Purpose
Identifies and tracks wallets with a proven historical track record of trading success.

### Inputs
Buyer address list, chain, reputations array.

### Data Source
Pre-fetched `smart_money_reputation` PostgreSQL records. Misses are enqueued for background indexing.

### Smart Money Qualification Rules
A wallet qualifies as Smart Money only when it meets all four criteria:
1. Traded at least 3 distinct tokens (`distinctTokensTraded >= 3`).
2. Completed at least 1 profitable trade (`profitableTradeCount >= 1`).
3. Realized PnL is positive (`realizedPnl > 0`).
4. Return on Investment is positive (`roi > 0`).

### Output
`SmartMoneyResult` containing cohort summaries (counts, ratios, confidence scores) and the first available wallet's metrics.

### Integration
Forwarded to the `BuyerQualityAnalyzer` to adjust cohort scores.

### Source References
- File: [`lib/deep_scan/engines/SmartMoneyAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/SmartMoneyAnalyzer.ts)
- Symbol: `analyzeSmartMoney`

---

## 20. Whale Behavior (Module 4)

### Purpose
Monitors the activity and supply concentration of large holders.

### Inputs
`UniversalTransaction[]`, `HolderInfo[]`, total supply, total pool liquidity, spot price, and CEX/contract exclusion sets.

### Data Source
Elevator holder datasets and transaction arrays.

### Whale Qualification Thresholds
A wallet qualifies as a whale if it meets either criteria:
- **Supply threshold:** Holds >= 1% of the circulating total supply.
- **Liquidity threshold:** Controls >= 5% of the total pool liquidity value.

### Processing
1. Builds a net flow map per wallet from the transaction batch.
2. Identifies qualified whales, excluding CEX and contract addresses.
3. Classifies the whale phase:
   - `dormant`: Whales have zero trading volume in the transaction batch.
   - `accumulation`: Whale net inflows > net outflows * 1.2.
   - `distribution`: Whale net outflows > net inflows * 1.2.
   - `neutral`: All other active states.
4. Sets the `isDistributionRisk` flag if the phase is `distribution` and the whales' supply share exceeds 15%.

### Output
`WhaleBehaviorResult` containing whale entries, inflow/outflow, phase, and flags.

### Integration
Consumed by the `RiskScoringEngine` (15% weight) and the Whale Exit Simulator.

### Source References
- File: [`lib/deep_scan/engines/WhaleBehaviorAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/WhaleBehaviorAnalyzer.ts)
- Symbol: `analyzeWhaleBehavior`

---

## 21. Risk Scoring (Module 14)

### Purpose
Aggregates individual sub-scores into an explainable, weighted overall risk score (0-100).

### Inputs
Outputs from the six scoring modules: `ammSlippage`, `whaleExit`, `volumeConcentration`, `whaleBehavior`, `capitalEfficiency`, `buyerQuality`, and contract honeypot status.

### Weighted Formula (Observed Risks Only)
Weights are defined in configuration:
- Whale Exit: **25%**
- AMM Slippage: **20%**
- Volume Concentration: **20%**
- Whale Directional Behavior: **15%**
- Capital Efficiency: **10%**
- Buyer Quality: **10%**

$$\text{OverallScore} = \frac{\sum (\text{subScore}_i \cdot \text{weight}_i)}{\sum \text{weight}_{\text{measured}}}$$

*Modules that return `insufficient_data` or `unavailable` contribute 0 to the numerator, and their weights are excluded from the denominator. No default or synthetic scores are ever injected for missing data.*

### Mitigations
After the normalized average is calculated, the score is reduced by active mitigations:
- **Broad Buyer Base (-5 points):** If total buyers >= 30.
- **Organic Volume (-5 points):** If HHI volume organic score > 80.

### Overall Score Bounds
Overall score is rounded and mapped to risk levels:
- **Low Risk:** Score < 30
- **Medium Risk:** 30 <= Score < 50
- **High Risk:** 50 <= Score < 75
- **Critical Risk:** Score >= 75

*If the token is a verified honeypot, the overall score is forced to 100.*

### Output
`ExplainableRiskScore` containing `overallRiskScore`, risk level, `subScores[]`, mitigators, and `scoreCompleteness`.

### Source References
- File: [`lib/deep_scan/engines/RiskScoringEngine.ts`](file:///d:/scanner/lib/deep_scan/engines/RiskScoringEngine.ts)
- Symbol: `calculateRiskScore`

---

## 22. Top Risks (Module 9)

### Purpose
Identifies and ranks the most critical risk vectors discovered during the scan.

### Activation Conditions
Top risks are generated deterministically in `calculateRiskScore`:

| Risk ID | Risk Name | Condition | Severity | Description |
|---|---|---|---|---|
| `honeypot-verified` | Verified Honeypot Contract | `isHoneypot === true` | Critical | Clients cannot sell. Forced to rank 1. |
| `thin-liquidity-slippage` | Severe Price Impact | `ammScore >= 35` (AMM simulation Price Impact at $25k >= 5%) | High/Critical | Large trades face high slippage. |
| `whale-selloff-cascade` | Vulnerable Whale Concentration | `whaleExitScore >= 35` (50% whale exit price delta >= 25%) | High/Critical | Whales exit would cause steep drop. |
| `skewed-volume-concentration` | Highly Concentrated Volume | `volumeScore >= 30` (Volume HHI organic score <= 70) | High/Critical | Volume concentrated in few wallets. |
| `active-whale-distribution` | Active Whale Distribution | `whaleBehScore >= 35` (Whales distributing supply) | High/Critical | Whales are net sellers in the batch. |
| `creator-funded-buyers` | Creator-Funded Buyer Cohort | `creatorFundedBuyerRatio > 10%` and profile coverage >= 20% | High/Critical | Buyers funded by creator address. |

*Risk list is limited to the top 5 highest severity signals.*

---

## 23. Trader Intelligence (Module 15)

### Purpose
Compiles all engine metrics and risk profiles into a clean, trader-focused markdown report.

### Outputs Generated
- **Executive Summary:** Highlights regime, safety condition, and key trader conclusions.
- **Regime Narrative:** Explains price/volume correlation and Z-scores. Includes disclaimers noting that classifications describe current behavior, not future outcomes.
- **Execution Conditions:** Detailed slippage and price impact narratives for simulated positions.
- **Holder Risk:** Whale supply concentration and exit simulation results.
- **Volume Quality:** Unique buyer/seller counts, HHI concentration, and wash volume ratios.
- **Buyer Quality Cohorts:** Cohort scores, returning ratios, funding concentration warnings, and low activity flags.
- **Capital Efficiency & Fragmentation:** FDV/liquidity multipliers, TVL regime classifications, and pool fragmentation HHI.

### Source References
- File: [`lib/deep_scan/engines/TraderIntelligenceGenerator.ts`](file:///d:/scanner/lib/deep_scan/engines/TraderIntelligenceGenerator.ts)
- Symbol: `generateTraderIntelligenceReport`

---

## 24. Live Monitoring (Module 10)

### Current Status
⚪ **NOT CONNECTED TO DEEP SCAN RUNTIME**

No active websockets, mempool listeners, or block subscription managers are connected to the Deep Scan execution flow. The Next.js API route has a maximum duration of 60 seconds, which is incompatible with live event streaming.

---

## 25. Configuration

All thresholds, weights, and cache timings are centralized in [`lib/deep_scan/config.ts`](file:///d:/scanner/lib/deep_scan/config.ts). The configuration is validated on module load via `validateDeepScanConfig()` to catch duplicate ranges or invalid weights.

### Key Config Values
- **Cache TTL:** `cache.ttlMs = 60000` (60 seconds).
- **Freshness thresholds:** Market Data = 5 minutes, OHLCV = 2 hours, Transactions = 1 hour.
- **Price impact limits:** Low = 1%, Medium = 5%, High = 15%.
- **Whale qualifications:** Supply >= 1%, Liquidity >= 5%.
- **Risk weights:** Whale Exit (25%), AMM (20%), Vol HHI (20%), Whale Behavior (15%), Capital (10%), Buyer Quality (10%).

---

## 26. Data Freshness

Freshness states are calculated relative to the wall clock time at scan execution:

- **fresh:** Data timestamp is within threshold.
- **stale:** Data timestamp exceeds threshold.
- **unknown:** No usable timestamp or provider failed.

An aggregate warning (`staleDataWarning = true`) is triggered when **2 or more datasets** are not fresh (stale or unknown). This ensures provider failures are flagged.

---

## 27. Error and Degraded States

- **Incomplete / Unusable Scan:** If `sufficientData` is false, or if `outcome === 'INSUFFICIENT_DATA'` or `FAILED`, the scan returns HTTP `422 Unprocessable Entity` and triggers the service role credit refund RPC using the `scanId` idempotency key.
- **Graceful Degradation:** Failed on-chain reserve reads fall back to derived reserves. Failed wallet profile queries degrade to missing status without throwing errors.
- **Partial success:** EVM networks always return `outcome = 'PARTIAL_SUCCESS'` because on-chain holder lists or transaction histories are partially available or lack historical indexes.

---

## 28. Current Limitations

- **No historical cycle analysis:** Long-term pump-and-dump cycle detection is not implemented.
- **Solana wallet profiling unavailable:** GoldRush age and funding queries do not support Solana.
- **Bitquery lookback window constraint:** Whale first-seen timestamps are bounded by a 90-day lookback window; they do not represent absolute wallet genesis.
- **No live mempool monitoring:** Streaming websocket alerts are not integrated.
- **Token symbol hardcoded:** `token.symbol` is hardcoded as `'TOKEN'` in route outputs.

---

## 29. Implementation Coverage

The overall implementation coverage of Deep Scan is **80%**.

| Capability | Status | Connected? | Data Source | Source Reference |
|---|---|---|---|---|
| AMM Slippage Simulation | 🟢 IMPLEMENTED | Yes | Pool reserves | `AmmSlippageSimulator.ts` |
| Buyer Quality Analysis | 🟢 IMPLEMENTED | Yes | GoldRush / Cache | `BuyerQualityAnalyzer.ts` |
| Capital Efficiency Rating | 🟢 IMPLEMENTED | Yes | FDV / Liquidity | `CapitalEfficiencyAnalyzer.ts` |
| Liquidity Fragmentation | 🟢 IMPLEMENTED | Yes | Enriched pools | `LiquidityFragmentationAnalyzer.ts` |
| Liquidity Stress Test | 🟢 IMPLEMENTED | Yes | RPC / DB snapshots | `LiquidityStressAnalyzer.ts` |
| Market Regime Detection | 🟢 IMPLEMENTED | Yes | OHLCV candles | `MarketRegimeAnalyzer.ts` |
| Risk Scoring Engine | 🟢 IMPLEMENTED | Yes | Engines outputs | `RiskScoringEngine.ts` |
| Smart Money Analysis | 🟢 IMPLEMENTED | Yes | Reputation Cache | `SmartMoneyAnalyzer.ts` |
| Smart Money PnL FIFO | ⚪ NOT CONNECTED | No | Swap events | `SmartMoneyPnlEngine.ts` |
| Trader Report Generator | 🟢 IMPLEMENTED | Yes | Consolidated data | `TraderIntelligenceGenerator.ts` |
| Volume HHI Concentration | 🟢 IMPLEMENTED | Yes | Transaction batch | `VolumeConcentrationAnalyzer.ts` |
| Whale Behavior | 🟢 IMPLEMENTED | Yes | Holders dataset | `WhaleBehaviorAnalyzer.ts` |
| Whale Exit Simulation | 🟢 IMPLEMENTED | Yes | Whale balances | `WhaleExitSimulator.ts` |
| Live Risk Monitoring | 🔴 UNAVAILABLE | No | — | — |
| Historical Behavior Cycles | 🔴 UNAVAILABLE | No | — | — |

---

## 30. Source Code Map

### Core Coordinator
- [`lib/deep_scan/DeepScanService.ts`](file:///d:/scanner/lib/deep_scan/DeepScanService.ts): Controls the caching, fallback fetching, and execution pipeline.
- [`lib/deep_scan/config.ts`](file:///d:/scanner/lib/deep_scan/config.ts): Center for thresholds, weights, and limits.
- [`lib/deep_scan/types.ts`](file:///d:/scanner/lib/deep_scan/types.ts): Canonical type definitions.

### Data & Caches
- [`lib/deep_scan/poolEnrichment.ts`](file:///d:/scanner/lib/deep_scan/poolEnrichment.ts): Enriches V2 reserves and V3 slot0 via Alchemy RPC.
- [`lib/deep_scan/walletIntelligence.ts`](file:///d:/scanner/lib/deep_scan/walletIntelligence.ts): Bitquery GraphQL adapter for whale histories.
- [`lib/deep_scan/walletQualityCache.ts`](file:///d:/scanner/lib/deep_scan/walletQualityCache.ts): Cache-first buyer profiling and Postgres upserts.
- [`lib/deep_scan/walletEnrichment.ts`](file:///d:/scanner/lib/deep_scan/walletEnrichment.ts): GoldRush page-walking transaction crawler.
- [`lib/deep_scan/smartMoneyCache.ts`](file:///d:/scanner/lib/deep_scan/smartMoneyCache.ts): Smart Money reputations cache lookups and job enqueues.
- [`lib/deep_scan/historical/HistoricalPoolReservesIndexer.ts`](file:///d:/scanner/lib/deep_scan/historical/HistoricalPoolReservesIndexer.ts): Bounded Postgres time-series reserves indexer.
- [`lib/deep_scan/historical/HistoricalPoolState.ts`](file:///d:/scanner/lib/deep_scan/historical/HistoricalPoolState.ts): Alchemy RPC point-queries for V2 reserves.

### Analytical Engines
- [`lib/deep_scan/engines/AmmSlippageSimulator.ts`](file:///d:/scanner/lib/deep_scan/engines/AmmSlippageSimulator.ts): Slippage curves.
- [`lib/deep_scan/engines/BuyerQualityAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/BuyerQualityAnalyzer.ts): Buyer quality cohorts.
- [`lib/deep_scan/engines/CapitalEfficiencyAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/CapitalEfficiencyAnalyzer.ts): FDV to liquidity ratings.
- [`lib/deep_scan/engines/LiquidityFragmentationAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/LiquidityFragmentationAnalyzer.ts): HHI pool mapping.
- [`lib/deep_scan/engines/LiquidityStressAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/LiquidityStressAnalyzer.ts): Compounding stress simulations.
- [`lib/deep_scan/engines/MarketRegimeAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/MarketRegimeAnalyzer.ts): Trend, volatility, and volume Z-scores.
- [`lib/deep_scan/engines/RiskScoringEngine.ts`](file:///d:/scanner/lib/deep_scan/engines/RiskScoringEngine.ts): Weighted sub-score roll-up.
- [`lib/deep_scan/engines/SmartMoneyAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/SmartMoneyAnalyzer.ts): Profitability qualifiers.
- [`lib/deep_scan/engines/WhaleBehaviorAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/WhaleBehaviorAnalyzer.ts): Directional flows.
- [`lib/deep_scan/engines/WhaleExitSimulator.ts`](file:///d:/scanner/lib/deep_scan/engines/WhaleExitSimulator.ts): Whale liquidation impacts.

### Reports & API
- [`lib/deep_scan/engines/EvidenceMapper.ts`](file:///d:/scanner/lib/deep_scan/engines/EvidenceMapper.ts): Sequential evidence ID generation.
- [`lib/deep_scan/engines/TraderIntelligenceGenerator.ts`](file:///d:/scanner/lib/deep_scan/engines/TraderIntelligenceGenerator.ts): Trader intelligence Markdown report.
- [`app/api/scan/deep/route.ts`](file:///d:/scanner/app/api/scan/deep/route.ts): Route handler, credit validation, and error recovery.

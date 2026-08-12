# Deep Scan — Forensic Data Funnel Audit v2

## 0. Methodology

This forensic audit represents an independent, code-level analysis of the Deep Scan intelligence system. Every claim, lineage map, fallback path, and vulnerability described here is verified against the active source files.

### 0.1 Inspected Files
- **Orchestration & Routing**:
  - [`app/api/scan/deep/route.ts`](file:///d:/scanner/app/api/scan/deep/route.ts) (173 lines)
  - [`lib/deep_scan/DeepScanService.ts`](file:///d:/scanner/lib/deep_scan/DeepScanService.ts) (442 lines)
  - [`lib/deep_scan/types.ts`](file:///d:/scanner/lib/deep_scan/types.ts) (573 lines)
- **Analytical Engines**:
  - [`lib/deep_scan/engines/AmmSlippageSimulator.ts`](file:///d:/scanner/lib/deep_scan/engines/AmmSlippageSimulator.ts) (212 lines)
  - [`lib/deep_scan/engines/VolumeConcentrationAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/VolumeConcentrationAnalyzer.ts) (268 lines)
  - [`lib/deep_scan/engines/WhaleBehaviorAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/WhaleBehaviorAnalyzer.ts) (207 lines)
  - [`lib/deep_scan/engines/WhaleExitSimulator.ts`](file:///d:/scanner/lib/deep_scan/engines/WhaleExitSimulator.ts) (210 lines)
  - [`lib/deep_scan/engines/BuyerQualityAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/BuyerQualityAnalyzer.ts) (249 lines)
  - [`lib/deep_scan/engines/MarketRegimeAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/MarketRegimeAnalyzer.ts) (187 lines)
  - [`lib/deep_scan/engines/CapitalEfficiencyAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/CapitalEfficiencyAnalyzer.ts) (61 lines)
- **Synthesis & Presentation**:
  - [`lib/deep_scan/engines/RiskScoringEngine.ts`](file:///d:/scanner/lib/deep_scan/engines/RiskScoringEngine.ts) (340 lines)
  - [`lib/deep_scan/engines/EvidenceMapper.ts`](file:///d:/scanner/lib/deep_scan/engines/EvidenceMapper.ts) (301 lines)
  - [`lib/deep_scan/engines/TraderIntelligenceGenerator.ts`](file:///d:/scanner/lib/deep_scan/engines/TraderIntelligenceGenerator.ts) (155 lines)
  - [`components/deep_scan/DeepScanResultView.tsx`](file:///d:/scanner/components/deep_scan/DeepScanResultView.tsx) (800 lines)
- **Upstream Scanners / Collectors**:
  - [`lib/elevator/collectors/CollectorFactory.ts`](file:///d:/scanner/lib/elevator/collectors/CollectorFactory.ts) (84 lines)
  - [`lib/blockchain/marketDataFallback.ts`](file:///d:/scanner/lib/blockchain/marketDataFallback.ts)
  - [`lib/blockchain/evmScanner.ts`](file:///d:/scanner/lib/blockchain/evmScanner.ts)
  - [`lib/blockchain/solanaScanner.ts`](file:///d:/scanner/lib/blockchain/solanaScanner.ts)
  - [`lib/elevator/washTradingDetector.ts`](file:///d:/scanner/lib/elevator/washTradingDetector.ts)

---

## 1. System Architecture Overview

```
      [External Providers]
   (DexScreener, GeckoTerminal, Birdeye, GoPlus, Helius, RPCs)
               │
               ▼
       [Upstream Layer]
   Basic Scan (Metadata & Pools)  ◄── (Scenario A Injection)
   Elevator Scan (Trades & Candles) ◄── (Scenario A Injection)
               │
               ▼
     [DeepScanService.ts] (Orchestrator)
               │
       ┌───────┼───────┬───────┬───────┬───────┐
       ▼       ▼       ▼       ▼       ▼       ▼
     [AMM]   [HHI]  [Whale] [Exit]  [Buyer] [Regime]  (Engines)
       │       │       │       │       │       │
       └───────┼───────┴───────┼───────┴───────┘
               ▼               ▼
        [Risk Engine]   [Evidence Mapper]
               │               │
               ▼               ▼
     [Trader Intel] ──► [Final Result Packaging]
                               │
                               ▼
                        [POST /api/scan/deep]
                               │
                               ▼
                        [Frontend React View]
```

All 7 engines operate as pure, synchronous mathematical functions. Downstream synthesis aggregates results, constructs evidence, and yields the final response payload parsed by `DeepScanResultView.tsx`.

---

## 2. Entry Point Audit

**File:** [`app/api/scan/deep/route.ts`](file:///d:/scanner/app/api/scan/deep/route.ts)

1. **Authentication Gate (Lines 29–49)**:
   - Reads `Authorization` header, extracts `Bearer` token.
   - Calls `supabase.auth.getUser(token)`.
   - Rejects unauthenticated requests with `HTTP 401`.
2. **Chain Detection (Lines 65–78)**:
   - Invokes `detectChain(address, resolvedChain)`.
   - If ambiguous EVM, invokes `autoDetectChainId(address)` to query RPCs and determine if BSC (`56`) or ETH (`1`).
   - If invalid/unsupported, returns `HTTP 400`.
3. **Atomic Credit System (Lines 94–117, 140–167)**:
   - Calls Supabase RPC function `deduct_credits_for_scan` with `p_amount = 15` credits.
   - Passes `p_scan_id = scanId` (UUID) to prevent double-deduction.
   - If deduction fails, returns `HTTP 402` (Insufficient Credits) or `HTTP 500` (Database Error).
   - In case of failure during `runScan()` execution, a refund is issued using RPC `refund_credits_for_scan` (Lines 150–156). Double-refund is prevented by the `refundIssued` boolean variable (Line 146).

---

## 3. DeepScanService Audit

**File:** [`lib/deep_scan/DeepScanService.ts`](file:///d:/scanner/lib/deep_scan/DeepScanService.ts)

1. **Caching Mechanism (Lines 25–54)**:
   - Key layout: `deep:${input.userId}:${network}:${normalizeAddress(address)}`.
   - Scope is isolated per-user and per-chain to prevent cross-user leakage.
   - TTL is exactly 60 seconds (`CACHE_TTL_MS = 60_000`).
   - **Forensic Check**: If `input.userId` is absent, cache keys return `null`, and caching is bypassed entirely.
2. **Upstream Data Fetching vs Integration**:
   - If `tokenMetadata` is missing, `DeepScanService` triggers basic scanner (`scanSolanaToken` or `scanEVMToken`) (Lines 96–102).
   - If `elevatorResult` is missing, it dynamically calls `CollectorFactory.create()` to collect recent swap transactions (Lines 141–158).
3. **Filtering Rules (Lines 168–195)**:
   - Excludes contract addresses (deployer/token and LP pair addresses) from whale/buyer statistics.
   - Excludes CEX wallets from concentration calculation based on `tx.toExchange` and `tx.fromExchange` flags.

---

## 4. External Provider Inventory

| Provider | Base URL | Authentication | Chain | File | Function | Data Retrieved |
|---|---|---|---|---|---|---|
| **DexScreener** | `https://api.dexscreener.com` | None | EVM/Solana | `marketDataFallback.ts` | `fetchDexScreenerPools` | Spot price, FDV, pool details |
| **GeckoTerminal** | `https://api.geckoterminal.com` | None | EVM/Solana | `marketDataFallback.ts` / `BscCollector.ts` | `fetchGeckoTerminalPools` / `collect` | OHLCV, Trades, Prices |
| **DefiLlama** | `https://coins.llama.fi` | None | EVM/Solana | `marketDataFallback.ts` | `fetchDefiLlamaPrice` | Spot price |
| **Birdeye** | `https://public-api.birdeye.so` | Header Key | EVM/Solana | Solana/BSC/Eth Collectors | `collect` | OHLCV, Trades fallback |
| **Helius** | `https://mainnet.helius-rpc.com` | Query Key | Solana | `SolanaCollector.ts` | `collect` | Swap transaction logs |
| **GoPlus** | `https://api.gopluslabs.io` | None | EVM | `evmScanner.ts` | `scanEVMToken` | Contract security flags |

---

## 5. Provider Fallback Chains

1. **Spot Price, FDV, Liquidity, & Pool Data**:
   - `DexScreener` (Primary) ──► `GeckoTerminal` (Secondary) ──► `DefiLlama` (Tertiary, price-only) ──► Default `0`/`null`
2. **EVM Transaction Swaps**:
   - `GeckoTerminal` (Primary) ──► `Birdeye` (Fallback) ──► Default `[]`
3. **Solana Transaction Swaps**:
   - `Helius` ──► Default `[]` (no fallback provider implemented)
4. **OHLCV candles**:
   - `Birdeye` ──► Default `[]` (no fallback provider implemented)

---

## 6. Basic Scan → Deep Scan Lineage

| Field | Source Function | Provider Source | Default | Used By | Risk Impact |
|---|---|---|---|---|---|
| `decimals` | `scanEVMToken`/`scanSolanaToken` | RPC call | `18` | `DeepScanService` | Formatting only |
| `totalSupply` | `scanEVMToken`/`scanSolanaToken` | RPC call | `0` | `WhaleBehaviorAnalyzer` | Critical for Whale ratio; if `0`, whale behavior returns `insufficient_data` |
| `spotPriceUsd` | `marketDataFallback` | DexScreener/GeckoTerminal/DefiLlama | `0` | All engines | Div-by-zero protector exists. If `0`, AMM, Whale behavior, and exit simulations return `insufficient_data` |
| `totalLiquidityUsd` | `marketDataFallback` | DexScreener/GeckoTerminal | `0` | `CapitalEfficiencyAnalyzer` / `AmmSlippageSimulator` | Critical. If `0`, sensitivity maps to `high`, slippage fails, and score gets maximum penalty |
| `creatorAddress` | `scanEVMToken`/`scanSolanaToken` | GoPlus / RPC deployer transaction | `undefined` | Frontend view | Displays deployer address in header chip |
| `isHoneypot` | `scanEVMToken` | GoPlus (EVM) | `false` | `RiskScoringEngine` | Honeypot override: forces final risk score to `100` |

---

## 7. Elevator Scan → Deep Scan Lineage

1. **`transactions` (UniversalTransaction[])**:
   - Originate from `GeckoTerminal` (EVM) or `Helius` (Solana).
   - Normalization converts native formats into standard buy/sell trades with `amount`, `priceUsd`, `from`, `to`, `isTrade`, and CEX flags.
   - Capped at `maxTransactions` (typically 100) (DeepScanService.ts Line 164).
2. **`ohlcv` (OHLCVCandle[])**:
   - Originate from `Birdeye` (via collector). Used by `MarketRegimeAnalyzer` to compute price/volume linear regressions, volatility, and regime label.
3. **`holders` (HolderInfo[])**:
   - Solana: Originate from `Birdeye` `/token_holder` endpoint.
   - EVM (BSC/ETH): **Not collected** by BscCollector/EthCollector (returns `[]`). This forces the `WhaleBehaviorAnalyzer` to fail with `insufficient_data` on all EVM tokens.
4. **`washTraderWallets` (Set<string>)**:
   - Reused from `detectWashTrading(txs)` from Elevator's detector (DeepScanService.ts Line 201). Used to calculate organic HHI score.

---

## 8. Data Window / Temporal Coverage

| Dataset | Max Records | Time Window | Timestamp Source | Freshness Check |
|---|---|---|---|---|
| **Transactions** | `100` | Real-time block window | Block timestamp | None (stale checking bypassed) |
| **OHLCV candles** | Variable | Depends on query | Candle timestamp | None (stale checking bypassed) |
| **Holders** | `20` (Solana) / `0` (EVM) | Snapshot at query time | System clock | None |
| **Market Data** | Single snapshot | Snapshot at query time | System clock | Bypassed (hardcoded `staleDataWarning = false`) |

---

## 9. Null / Zero / Empty Data Audit

- `volume24hUsd` can be `null` and is correctly passed to the frontend to avoid displaying fake `$0` values (types.ts Line 527).
- If `totalSupply === 0`, `WhaleBehaviorAnalyzer.ts` returns `insufficient_data` (Line 77).
- If `spotPriceUsd === 0`, `AmmSlippageSimulator.ts` returns `insufficient_data` (Line 69).
- If `totalLiquidityUsd === 0`, `CapitalEfficiencyAnalyzer.ts` returns `insufficient_data` (Line 26).
- If `holders = []`, `WhaleBehaviorAnalyzer.ts` returns `insufficient_data` (Line 59).
- **Silent Conversion Danger**: If GoPlus fails to scan an EVM token, `isHoneypot` defaults to `false` (DeepScanService.ts Line 116), silently treating a potentially unvalidated token as safe.

---

## 10. Deep Scan Engine Inventory

The following engines are evaluated by the orchestrator:

1. **AmmSlippageSimulator**: Simulates selling positions on Uniswap V2 constant product curves using virtual reserves.
2. **VolumeConcentrationAnalyzer**: Computes buyer and seller HHI on transacting wallets.
3. **WhaleBehaviorAnalyzer**: Aggregates whale flows and determines if they are accumulating or distributing.
4. **WhaleExitSimulator**: Models impact of top 3 whales dumping 10%, 25%, and 50% of their holdings.
5. **BuyerQualityAnalyzer**: Scores quality of the buying cohort based on recurrence rates and size diversity.
6. **MarketRegimeAnalyzer**: Classifies market phase (`MOMENTUM`, `DEAD`, `ACCUMULATION`, etc.) from OHLCV trends.
7. **CapitalEfficiencyAnalyzer**: Calculates valuation/liquidity ratios and capital sensitivity multipliers.

---

## 11. Mathematical / Algorithmic Audit

1. **Constant-Product Reserve Derivation** (`AmmSlippageSimulator.ts` Lines 99–101):
   - Virtual token reserve is derived as:
     $$\text{token\_reserve} = \frac{\text{Liquidity}_{\text{USD}}}{2 \cdot \text{SpotPrice}_{\text{USD}}}$$
   - Virtual quote reserve is derived as:
     $$\text{quote\_reserve} = \frac{\text{Liquidity}_{\text{USD}}}{2}$$
   - **Vulnerability**: This model assumes Uniswap V2 style balanced pools. For concentrated liquidity pools (Uniswap V3, Raydium CLMM), price impact is highly non-linear and virtual reserves will significantly underestimate slippage near range boundaries.
2. **Linear Regression Slope** (`MarketRegimeAnalyzer.ts` Lines 30–53):
   - Slope is derived using least-squares linear regression:
     $$\text{Slope} = \frac{n \sum (x_i y_i) - \sum x_i \sum y_i}{n \sum (x_i^2) - (\sum x_i)^2}$$
   - Correctly handles denominators of zero.
3. **Pearson Correlation** (`MarketRegimeAnalyzer.ts` Lines 55–76):
   - Derived correctly. Safeguarded against zero variance (Line 74).

---

## 12. Whale / Holder Analysis Audit

1. **Solana**: Uses Birdeye's `/token_holder` endpoint to get actual current holder counts and balances.
2. **EVM (BSC/ETH)**: `BscCollector.ts` and `EthCollector.ts` do not implement holder collection.
   - **Cascade Failure**: Since `holders` is empty, `WhaleBehaviorAnalyzer` returns `status: 'insufficient_data'`.
   - In turn, `WhaleExitSimulator` fails with `status: 'insufficient_data'`.
   - This causes 40% of the overall risk score (25% exit weight + 15% behavior weight) to fall back to hardcoded defaults (40 and 30, respectively), meaning EVM scans produce risk scores that are heavily skewed towards neutral defaults regardless of real whale concentration.

---

## 13. Transaction / Wallet Analysis Audit

1. **EVM/Solana Address Normalization**:
   - `normalizeAddress()` (types.ts Lines 564–572) converts hex-based EVM addresses to lowercase and preserves base58 Solana case.
   - Address comparison logic is correct and prevents key mismatch bugs in HHI maps.
2. **CEX and Contract Filtering**:
   - Correctly filters deployers, tokens, and LP pairs from HHI, whale behavior, and buyer quality calculations to avoid skewing organic metrics.

---

## 14. Wash Trading Audit

1. **Data Ingestion**:
   - `detectWashTrading(txs)` is called from `DeepScanService.ts` (Line 201).
   - Wash trader wallets are collected into `washTraderWallets` set.
2. **Engine Consumption**:
   - Consumed by `VolumeConcentrationAnalyzer.ts` (Line 79) to calculate the `washVolumeRatio`.
   - Directly penalizes the `organicScore` by up to 30 points:
     $$\text{organicScore} = 100 - (BuyerHHI \cdot 40) - (WashRatio \cdot 30) - (SellerHHI \cdot 30)$$
   - The organic score reduces the risk score (RiskScoringEngine.ts Line 154) and generates alerts if wash trading is high.

---

## 15. Risk Scoring Audit

**File:** [`lib/deep_scan/engines/RiskScoringEngine.ts`](file:///d:/scanner/lib/deep_scan/engines/RiskScoringEngine.ts)

### 15.1 Mathematical Score Equation
The baseline risk score is computed as:
$$\text{Baseline} = (\text{WhaleExit} \cdot 0.25) + (\text{AMM} \cdot 0.20) + (\text{VolumeHHI} \cdot 0.20) + (\text{WhaleBehavior} \cdot 0.15) + (\text{Capital} \cdot 0.10) + (\text{BuyerQuality} \cdot 0.10)$$

Mitigating factors are deducted:
- Broad Buyer Base (total buyers $\ge$ 30): $-5$ points (Line 262)
- Highly Organic Volume Profile (organic score $> 80$): $-5$ points (Line 271)

$$\text{FinalScore} = \max(0, \text{Baseline} - \text{Mitigation})$$

*Honeypot Override*: If `isHoneypot` is `true`, `FinalScore` is immediately locked to `100` (Line 287).

### 15.2 Effective Contribution of Missing Modules (Defaults)
If a module returns `insufficient_data`, the score engine inserts a fallback value:

| Module | Default Score | Weighted Contribution |
|---|---|---|
| Whale Exit (25%) | `40` | `+10.0` |
| AMM Slippage (20%) | `50` | `+10.0` |
| Volume HHI (20%) | `40` | `+8.0` |
| Whale Behavior (15%) | `30` | `+4.5` |
| Capital Efficiency (10%) | `50` | `+5.0` |
| Buyer Quality (10%) | `40` | `+4.0` |

- **No Data Score**: If every module is missing (`sufficientData = false`), the score engine defaults to `41.5` (rounded to `42`).
- **EVM Scenario B (Missing holders)**: Both Whale modules fail, adding exactly `14.5` points to the base score by default, rendering 40% of the risk decision completely synthetic.

---

## 16. Evidence Chain Audit

**File:** [`lib/deep_scan/engines/EvidenceMapper.ts`](file:///d:/scanner/lib/deep_scan/engines/EvidenceMapper.ts)

- **Vulnerability**: Engine files define static evidence IDs (e.g. `['amm-pool-snapshot']` in `AmmSlippageSimulator.ts` Line 198), while `EvidenceMapper.ts` generates dynamic IDs at runtime using `makeId` (e.g. `amm-pool-1786...-1`).
- **Break Point**: `SubScore.evidenceIds` in the risk score references the static IDs, whereas the packaged `evidence` array contains the dynamic IDs. Because they do not match, the frontend cannot map a risk signal's `evidenceIds` to the corresponding `EvidenceNode`. The tracing chain is broken.

---

## 17. Freshness / Staleness Audit

- **Vulnerability**: There is no data age validation in `DeepScanService`.
- Both `generateTraderIntelligenceReport()` and `DeepScanResult` hardcode `staleDataWarning: false` (DeepScanService.ts Lines 379, 425).
- Upstream price data does not carry provider freshness timestamps.
- **Result**: Stale cached pools or delayed transaction streams propagate directly into execution calculations and risk scoring without alerting the trader.

---

## 18. Cache Audit

- **Cache Scope**: Key is formatted as `deep:${userId}:${network}:${normalizedAddress}`. Bypassed if `userId` is absent.
- **TTL**: 60 seconds.
- **Stale Behavior**: Entries are evicted synchronously on read/write via inline `cleanExpiredEntries()` calls.
- **Process Persistence**: Map-based cache stored in process memory. Lost on server restarts.

---

## 19. API / Credit / Failure Audit

- **Idempotency**: Implemented at the database layer. `scanId` is passed as `p_scan_id` to prevent double-deduction for concurrent retries.
- **Refund Policy**: If the orchestrator fails before completing (`scanCompleted = false`), `refund_credits_for_scan` is called to return the 15 credits.
- **Vulnerability**: If a provider fails and returning empty data triggers `insufficient_data` fallbacks, the user is still charged 15 credits for a scan containing no real data.

---

## 20. Frontend Truth Audit

**File:** [`components/deep_scan/DeepScanResultView.tsx`](file:///d:/scanner/components/deep_scan/DeepScanResultView.tsx)

| UI Field | Backend Field | Real Source | Missing Behavior | UI Representation | Misleading? |
|---|---|---|---|---|---|
| **Risk Score** | `riskScore.overallRiskScore` | Weighted scoring | Gauge hidden if `sufficientData === false` | Gauge displaying 0-100 | **Yes** for EVM scans: displays a real score even though 40% of the input data is missing/defaulted |
| **Deployer Address** | `tokenMetadata.creatorAddress` | Deployer TX / GoPlus | Omitted if missing | Shortened hex string | No |
| **24h Vol** | `marketSummary.volume24hUsd` | marketDataFallback | Null check | Rendered as `N/A` | No (null-safety works) |
| **Combined HHI** | `volumeConcentration.totalVolumeHHI` | HHI engine | Omitted if missing | Raw numeric score | No |
| **Whale Details** | `whaleBehavior.whales` | Whale engine | Collapsible hidden if empty | List of wallets & net flows | No (warning present) |
| **Stale Warning** | `dataQuality.staleDataWarning` | dataQuality object | Always false (hardcoded) | Warning hidden | **Yes** — hidden even if market data is stale |

---

## 21. Decision-Path Audit

Let's trace how the final exit risk decision is reached:

```
  [DexScreener/GeckoTerminal] (Liquidity/Pool data)
               │
               ▼
  [marketDataFallback] (Extracts basePriceUsd & totalLiquidityUsd)
               │
               ▼
  [DeepScanService] (Populates finalPools & finalSpotPrice)
               │
               ▼
  [WhaleBehaviorAnalyzer] (Identifies whale balances using Birdeye holders)
               │
               ▼ (combined whale balances)
  [WhaleExitSimulator] (Runs constant product formula for 50% exit drop)
               │
               ▼ (priceDeltaPct)
  [RiskScoringEngine] (Checks exit threshold & sets severity)
               │
               ▼ (topRisks list)
  [TraderIntelligenceGenerator] (Synthesizes narrative)
               │
               ▼
  [DeepScanResultView] (Renders "Vulnerable Whale Concentration" warning)
```

**Broken path for EVM**: If scanning an EVM token, Birdeye holder collection is absent, the holder list is empty, and the whale behavior/exit pipeline collapses. The UI warning is never generated, and the exit risk subscore simply falls back to the hardcoded default of 40.

---

## 22. Basic vs Elevator vs Deep Duplication Audit

- **Wash Trading**: Elevator runs `detectWashTrading(txs)`. Deep Scan imports it and runs it again (DeepScanService.ts Line 201). This is a duplicate execution but uses the identical algorithm.
- **CEX Wallet Labeling**: Elevator normalizes transactions with CEX exchange flags. Deep Scan parses these same flags to build its `cexWallets` set. This is a correct reuse of upstream labels.

---

## 23. Missing Data Primitives

The following primitives are missing from the system:
1. **EVM Holder Ledger API**: Needed to support Whale behavior/exit simulation on BSC/ETH.
2. **On-Chain Reserve Queries**: Needed to verify real pool token/quote amounts rather than deriving virtual reserves from USD approximations.
3. **Tick Array Ingestion**: Needed to accurately simulate slippage for concentrated liquidity pools (Uniswap V3 / Raydium CLMM).
4. **Historical Indexer**: Needed to fetch wallet age, cross-token funding, and win-rate profiles.

---

## 24. Hardcoded Values

| File | Line | Value | Meaning | Risk |
|---|---|---|---|---|
| `DeepScanService.ts` | 28 | `60_000` | Session cache TTL (60s) | Bounded memory consumption |
| `DeepScanService.ts` | 379 / 425 | `false` | `staleDataWarning` flag | **High** — warning is never triggered |
| `AmmSlippageSimulator.ts` | 32 | `0.003` | Constant swap fee (0.3%) | Inaccurate for pools with high/variable fees |
| `WhaleBehaviorAnalyzer.ts` | 26 / 27 | `1.0` / `5.0` | Whale supply & liquidity thresholds | Non-configurable heuristics |
| `WhaleBehaviorAnalyzer.ts` | 182 / 184 | `1.2` | Accumulation/distribution ratio | Static threshold |
| `RiskScoringEngine.ts` | 91 / 131 / etc. | Variable | Module scoring weights | Static tuning |

---

## 25. Complete Field Lineage Table

| Final Output | Engine | Engine Input | Upstream Scanner | Provider | Default | Missing Behavior | Risk Impact |
|---|---|---|---|---|---|---|---|
| `marketSummary.priceUsd` | — | Spot price | `marketDataFallback` | DexScreener | `0` | Defaults to `0` | Div-by-zero safety |
| `marketSummary.volume24hUsd` | — | 24h volume | `marketDataFallback` | DexScreener | `null` | Displayed as `N/A` | None |
| `ammSlippage.simulations` | AmmSlippageSimulator | Pools, Spot price | `marketDataFallback` | DexScreener | `[]` | Insufficient data | 20% weight defaults |
| `volumeConcentration.buyerHHI` | VolumeConcentrationAnalyzer | Trades, wash wallets | Collectors | GeckoTerminal | `0` | Insufficient data | 20% weight defaults |
| `whaleBehavior.phase` | WhaleBehaviorAnalyzer | Holders, net flow | Collectors | Birdeye | `insufficient_data` | Insufficient data | 15% weight defaults |
| `whaleExit.maxSeverity` | WhaleExitSimulator | Whales, pools | Collectors | Birdeye | `low` | Insufficient data | 25% weight defaults |
| `buyerQuality.buyerQualityScore` | BuyerQualityAnalyzer | Trades, CEX/Contract lists | Collectors | GeckoTerminal | `0` | Insufficient data | 10% weight defaults |
| `marketRegime.regime` | MarketRegimeAnalyzer | OHLCV candles | Collectors | Birdeye | `INSUFFICIENT_DATA`| Insufficient data | Narrative only |
| `capitalEfficiency.fdvToLiquidityRatio`| CapitalEfficiencyAnalyzer | FDV, liquidity | `marketDataFallback` | DexScreener | `0` | Insufficient data | 10% weight defaults |

---

## 26. Confirmed Correct

- ✅ GoPlus is integrated correctly for EVM tokens (creator, honeypot, mint, pause/freeze).
- ✅ Dynamic EVM chain detection works correctly via `autoDetectChainId`.
- ✅ Double-refund safety check works correctly via `refundIssued` boolean.
- ✅ CEX/Contract wallet exclusions are correctly populated before computing HHI and buyer statistics.
- ✅ Custom position sizes (`[1000, 5000, 10000, 25000, 50000, 100000]`) simulate correct constant-product slippage.
- ✅ Pearson correlation volume checks are protected against standard deviation of zero.

---

## 27. Confirmed Issues

- ⚠️ **G-4 (P3)**: `staleDataWarning` is permanently `false` (hardcoded).
- ⚠️ **EVM Whale Gap**: BSC/ETH collectors do not fetch holders. Whale behavior and exit simulator always fail on EVM Scenario B scans.
- ⚠️ **Evidence ID Mismatch**: Subscore evidence lists use static strings (`'amm-pool-snapshot'`), whereas EvidenceMapper uses dynamic timestamps (`amm-pool-1786...`). Tracing from signal to node is broken.
- ⚠️ **Concentrated Liquidity Failure**: Deriving virtual reserves from spot price/liquidity fails on Uniswap V3 / Raydium CLMM pools, leading to incorrect slippage estimates.
- ⚠️ **Paid Scans for Empty Results**: If a provider fails and returning empty data triggers `insufficient_data` fallbacks, the user is still charged 15 credits.

---

## 28. Severity Matrix

| ID | Issue | Severity | Affected Chain | Affected Module | Risk Impact |
|---|---|---|---|---|---|
| **P1-A** | EVM Whale Analysis Gap | High | EVM (BSC/ETH) | Whale Behavior & Exit | 40% of risk score defaults to neutral values |
| **P1-B** | Concentrated Liquidity Slippage | High | All CLMM Pools | AMM Slippage Simulator | Underestimates execution slippage |
| **P2-A** | Evidence ID Tracing Break | Medium | All | Evidence Mapper | Users cannot link subscores to specific facts |
| **P2-B** | Charged for Provider Failure | Medium | All | API Route | Users lose credits on empty scans |
| **P3-A** | Permanently False Stale Warning | Low | All | Orchestration / UI | UI never displays market data age warnings |

---

## 29. Critical Data Funnel Breaks

1. **EVM Holder Funnel Break**:
   ```
   EVM Token
   └── BscCollector/EthCollector (does not fetch holders)
       └── WhaleBehaviorAnalyzer (receives empty holders array)
           └── WhaleExitSimulator (receives empty whale list)
               └── RiskScoringEngine (whale scores fall back to static defaults)
   ```
2. **Evidence ID Tracing Break**:
   ```
   RiskScoringEngine (records static ID e.g., 'amm-pool-snapshot')
   EvidenceMapper (generates dynamic ID e.g., 'amm-pool-17861657-1')
   DeepScanResultView (fails to link risk signal ID to EvidenceCard)
   ```

---

## 30. Recommended Fix Order

1. **Implement EVM Holder Ingestion**: Add BSC/ETH holder endpoints to `BscCollector.ts` and `EthCollector.ts` to restore whale calculations.
2. **Align Evidence IDs**: Modify `RiskScoringEngine` or `EvidenceMapper` to use uniform IDs so signal arrays can map directly to evidence nodes in the UI.
3. **Handle Concentrated Liquidity**: Support tick arrays or reserve-adjusted liquidity profiles for concentrated pools.
4. **Fix Stale Data Warning**: Replace the hardcoded `staleDataWarning` flag with real age-threshold validation.
5. **No-Data Fee Protection**: Skip or refund credit deductions if the scan completes but all primary data sources return `insufficient_data`.

---

## 31. Final Verdict

1. **Is Deep Scan currently receiving the data its algorithms claim to need?**
   **No** for EVM tokens (no holder data is collected). **Yes** for Solana tokens.
2. **Which modules operate on real data?**
   Volume Concentration, Buyer Quality, Market Regime, and Capital Efficiency.
3. **Which modules operate on partial data?**
   AMM Slippage (uses derived virtual reserves instead of on-chain contract reserves).
4. **Which modules operate on defaults?**
   Whale Behavior and Whale Exit on all EVM chains.
5. **Which modules are unavailable by chain?**
   Whale Behavior and Whale Exit are unavailable on EVM.
6. **Which risk-score components are trustworthy?**
   Honeypot overrides, volume HHI, and buyer quality. Whale-related scores are only trustworthy on Solana.
7. **Which trader-facing outputs are potentially misleading?**
   The overall risk gauge on EVM tokens (as it ignores whale concentration risks) and the AMM slippage tables on concentrated liquidity pools.
8. **What are the top 5 fixes required?**
   (1) Add EVM holder queries, (2) align Evidence IDs, (3) fix the stale data warning, (4) support concentrated liquidity, and (5) implement no-data refund safety.

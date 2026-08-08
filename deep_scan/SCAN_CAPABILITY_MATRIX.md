# Scan Capability Matrix

> **Source of Truth**: Based on audit of existing production code in `lib/blockchain/`, `lib/elevator/`, `app/api/scan/`, `components/`, and the Deep Scan specification in `deep_scan/`.
> All decisions cite actual file evidence. Unverifiable items are marked `UNKNOWN`.

---

## 1. Executive Summary

Three scanning systems exist or are proposed in this project:

| Scanner | Status | Cost | Primary Job |
|:---|:---|:---|:---|
| **Basic Scan** | Production | 2 credits | Fast static snapshot of token metadata and contract security |
| **Elevator Scan** | Production | 5–30 credits | Recent transaction batch analysis, CEX flow, wash trading, trust verification |
| **Deep Scan** | Proposed / Phase 1 Spec | TBD | Behavioral intelligence, simulation, historical analysis, AI synthesis |

**Key findings:**
- **No genuine capability duplication** currently exists between Basic and Elevator — they operate at completely different data layers.
- **13 of 15 Deep Scan modules have zero implementation in any current scanner** — Deep Scan's scope is genuinely additive.
- **2 modules have partial primitives** in existing scanners that Deep Scan must expand (not duplicate): Multi-DEX pool discovery (Basic/Elevator) and Organic Price/Wash Trading (Elevator).
- **Elevator already collects reusable data** (pool addresses, normalized transactions, wallet net balances) that Deep Scan should consume rather than re-fetch.
- **Basic Scan has a broken UI card** (`AdvancedRiskMetricsCard`) that displays zero values because `recentTransactions = []` — this card belongs to Elevator/Deep, not Basic.

---

## 2. Scanner Purpose

### Basic Scan
> **Question answered**: *Is this token contract structurally safe and what are its basic market parameters?*

A **30-second health check**. Validates that a token contract is deployed, verified, has sane economics (supply, decimals), is not a honeypot, and has real liquidity on at least one DEX. No transaction history required, no behavior required.

**File evidence**: `lib/blockchain/evmScanner.ts`, `lib/blockchain/goPlusSecurity.ts`, `lib/blockchain/marketDataFallback.ts`

---

### Elevator Scan
> **Question answered**: *What has been happening on-chain for this token in the recent transaction batch — who bought and sold, did anyone wash trade, did tokens flow to/from exchanges?*

A **transaction-level audit** of the most recent N swaps (50–500 depending on credit tier). Reconstructs per-wallet net balances *within that window*, tags CEX flows, flags wash trading, and verifies 3 random trades against RPC receipts.

**File evidence**: `app/api/scan/elevator/route.ts`, `lib/elevator/collectors/`, `lib/elevator/washTradingDetector.ts`

---

### Deep Scan
> **Question answered**: *Is this token's price movement organic, where is the structural risk, and what should a trader know before entering or exiting a position?*

A **behavioral and simulation intelligence engine**. Requires cross-wallet historical analysis, AMM constant-product simulations, wallet reputation scoring across multiple tokens, and an AI-synthesized trader report. Cannot be approximated by Basic or Elevator Scan.

**File evidence**: `deep_scan/SKILL.md`, `deep_scan/modules/`

---

## 3. Capability Taxonomy

All capabilities in the matrix are classified by **type**:

| Type | Definition | Example |
|:---|:---|:---|
| **DATA** | Raw collected values with no transformation | Transaction hash, block number, wallet address |
| **METRIC** | Calculated numerical summary derived from data | Buy/sell volume ratio, top-10 concentration % |
| **ANALYSIS** | Interpretation of patterns from metrics | "This wallet has both bought and sold — wash risk" |
| **SIGNAL** | Actionable flag or threshold breach | Holder spike detected (>50% new holders in 24h) |
| **DECISION SUPPORT** | Synthesized narrative for trader action | "Exiting $50K here causes 6.8% price impact" |

---

## 4. Master Capability Matrix

| # | Capability | Type | Depth | Basic | Elevator | Deep | Final Owner | Priority |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Token name / symbol / decimals / supply | DATA | L0 | YES | NO | NO | BASIC | P0 |
| 2 | Contract bytecode verification | DATA | L0 | YES | NO | NO | BASIC | P0 |
| 3 | Chain auto-detection (ETH/BSC/SOL) | DATA | L0 | YES | YES | NO | SHARED | P0 |
| 4 | Token creator address | DATA | L0 | YES | NO | NO | BASIC | P1 |
| 5 | Honeypot / tax simulation | ANALYSIS | L1 | YES | NO | NO | BASIC | P0 |
| 6 | Mintable / Freezable / Proxy flags | METRIC | L1 | YES | NO | NO | BASIC | P0 |
| 7 | Buy / Sell tax percentage | METRIC | L1 | YES | NO | NO | BASIC | P0 |
| 8 | Current spot price (USD) | DATA | L1 | YES | NO | NO | BASIC | P0 |
| 9 | Total liquidity (USD) | METRIC | L1 | YES | NO | NO | BASIC | P0 |
| 10 | Pool list (address, pair, reserve snapshot) | DATA | L1 | YES | NO | NO | BASIC→SHARED | P0 |
| 11 | Current FDV / Market Cap | METRIC | L1 | YES | NO | NO | BASIC | P0 |
| 12 | Liquidity locked status | DATA | L1 | YES | NO | NO | BASIC | P1 |
| 13 | Token-2022 transfer fee config (Solana) | DATA | L1 | YES | NO | NO | BASIC | P1 |
| 14 | Normalized swap transactions (buy/sell/transfer) | DATA | L2 | NO | YES | NO | ELEVATOR | P0 |
| 15 | Raw transaction hashes + timestamps | DATA | L2 | NO | YES | NO | ELEVATOR | P0 |
| 16 | Per-wallet net balance (within batch window) | METRIC | L2 | NO | YES | NO | ELEVATOR | P0 |
| 17 | Buy / sell classification per transaction | ANALYSIS | L2 | NO | YES | NO | ELEVATOR | P0 |
| 18 | CEX deposit / withdrawal tagging | ANALYSIS | L2 | NO | YES | NO | ELEVATOR | P0 |
| 19 | Net exchange flow (tokens to/from CEX) | METRIC | L2 | NO | YES | NO | ELEVATOR | P0 |
| 20 | Wash trading detection (batch-only round-trips) | ANALYSIS | L2 | NO | YES | NO | ELEVATOR | P0 |
| 21 | Multi-hop trade aggregation (router swaps) | ANALYSIS | L2 | NO | YES | NO | ELEVATOR | P0 |
| 22 | On-chain trust verification (3 random trades) | SIGNAL | L2 | NO | YES | NO | ELEVATOR | P0 |
| 23 | Gas cost estimation per trade | METRIC | L2 | NO | YES | NO | ELEVATOR | P1 |
| 24 | LP fee estimation per trade | METRIC | L2 | NO | YES | NO | ELEVATOR | P1 |
| 25 | Contract wallet filtering from top holders | ANALYSIS | L2 | NO | YES | NO | ELEVATOR | P1 |
| 26 | Holder spike detection (24h new recipients) | SIGNAL | L2 | NO | YES | NO | ELEVATOR | P1 |
| 27 | Top 10 holders (net balance from batch) | METRIC | L2 | NO | YES | NO | ELEVATOR | P1 |
| 28 | Unique wallet count (from batch) | METRIC | L2 | NO | YES | NO | ELEVATOR | P1 |
| 29 | OHLCV price candles (Birdeye) | DATA | L2 | NO | YES | YES | SHARED | P0 |
| 30 | Wallet age / first transaction date | DATA | L3 | NO | NO | YES | DEEP | P1 |
| 31 | Wallet funding source detection | ANALYSIS | L3 | NO | NO | YES | DEEP | P1 |
| 32 | Shared-funding wallet clustering | ANALYSIS | L3 | NO | NO | YES | DEEP | P1 |
| 33 | Coordinated buy-block detection | SIGNAL | L3 | NO | NO | YES | DEEP | P1 |
| 34 | Sniper wallet identification | SIGNAL | L3 | NO | NO | YES | DEEP | P1 |
| 35 | Volume concentration HHI index | METRIC | L3 | NO | NO | YES | DEEP | P0 |
| 36 | Unique buyer count trend | METRIC | L3 | NO | NO | YES | DEEP | P0 |
| 37 | Buy/sell volume ratio (behavioral) | METRIC | L3 | NO | NO | YES | DEEP | P0 |
| 38 | Wash trading ring detection (cross-wallet) | ANALYSIS | L3 | NO | NO | YES | DEEP | P0 |
| 39 | AMM constant-product slippage simulation | ANALYSIS | L5 | NO | NO | YES | DEEP | P0 |
| 40 | Price impact for custom position sizes ($1K–$100K) | DECISION SUPPORT | L5 | NO | NO | YES | DEEP | P0 |
| 41 | Liquidity utilization per position | METRIC | L5 | NO | NO | YES | DEEP | P0 |
| 42 | Whale threshold detection (>1% supply or >5% liquidity) | ANALYSIS | L3 | NO | NO | YES | DEEP | P0 |
| 43 | Whale net inflow / outflow tracking | METRIC | L3 | NO | NO | YES | DEEP | P0 |
| 44 | Whale accumulation / distribution phase | SIGNAL | L3 | NO | NO | YES | DEEP | P0 |
| 45 | Cross-token historical wallet ROI | METRIC | L4 | NO | NO | YES | DEEP | P1 |
| 46 | Wallet win rate across past tokens | METRIC | L4 | NO | NO | YES | DEEP | P1 |
| 47 | Smart money entry / exit identification | SIGNAL | L4 | NO | NO | YES | DEEP | P1 |
| 48 | Buyer quality score (age, capital diversity) | ANALYSIS | L3 | NO | NO | YES | DEEP | P0 |
| 49 | New vs. returning buyer ratio | METRIC | L3 | NO | NO | YES | DEEP | P0 |
| 50 | Single-use wallet ratio in recent buyers | METRIC | L3 | NO | NO | YES | DEEP | P0 |
| 51 | Top holder exit simulation (10/25/50%) | DECISION SUPPORT | L5 | NO | NO | YES | DEEP | P0 |
| 52 | Executable liquidity ratio | METRIC | L5 | NO | NO | YES | DEEP | P0 |
| 53 | Exit impact score | SIGNAL | L5 | NO | NO | YES | DEEP | P0 |
| 54 | Market regime classification (ACCUMULATION / MOMENTUM / DISTRIBUTION / etc.) | ANALYSIS | L4 | NO | NO | YES | DEEP | P0 |
| 55 | Price/volume slope analysis | METRIC | L4 | NO | NO | YES | DEEP | P0 |
| 56 | Volatility Z-score | METRIC | L4 | NO | NO | YES | DEEP | P1 |
| 57 | Top 3–5 ranked risk signals | SIGNAL | L6 | NO | NO | YES | DEEP | P0 |
| 58 | Live block-by-block monitoring (websocket) | DATA | L2 | NO | NO | YES | DEEP | P2 |
| 59 | Real-time large transfer alerts | SIGNAL | L2 | NO | NO | YES | DEEP | P2 |
| 60 | Liquidity fragmentation index | METRIC | L3 | NO | NO | YES | DEEP | P0 |
| 61 | Per-pool reserve breakdown | DATA | L1 | PARTIAL | NO | YES | DEEP | P0 |
| 62 | Market cap / liquidity ratio | METRIC | L3 | PARTIAL | NO | YES | DEEP | P0 |
| 63 | Capital sensitivity rating | ANALYSIS | L3 | NO | NO | YES | DEEP | P0 |
| 64 | Historical pump/dump cycle detection | ANALYSIS | L4 | NO | NO | YES | DEEP | P1 |
| 65 | Average historical drawdown (%) | METRIC | L4 | NO | NO | YES | DEEP | P1 |
| 66 | Distribution speed (historical days to dump) | METRIC | L4 | NO | NO | YES | DEEP | P1 |
| 67 | Overall weighted risk score (0–100) | METRIC | L6 | NO | NO | YES | DEEP | P0 |
| 68 | Decomposed sub-scores per module | METRIC | L6 | NO | NO | YES | DEEP | P0 |
| 69 | Evidentiary audit trail | DATA | L6 | NO | NO | YES | DEEP | P0 |
| 70 | AI-synthesized trader intelligence report | DECISION SUPPORT | L6 | NO | NO | YES | DEEP | P0 |
| 71 | Confidence score per finding | METRIC | L6 | NO | NO | YES | DEEP | P0 |

---

## 5. Basic Scan Capabilities

**Source**: `lib/blockchain/evmScanner.ts`, `lib/blockchain/solanaScanner.ts`, `lib/blockchain/goPlusSecurity.ts`, `lib/blockchain/marketDataFallback.ts`, `lib/blockchain/cache.ts`

| Capability | Status | Notes |
|:---|:---|:---|
| Token name / symbol / decimals / supply | Existing | Direct ERC-20 / SPL RPC calls |
| Contract bytecode verification | Existing | `provider.getCode()` on multiple chains in parallel |
| Chain auto-detection | Existing | `autoDetectChainId()` — parallel bytecode checks |
| Honeypot / tax simulation | Existing | GoPlus Labs API + Honeypot.is fallback |
| Mintable / Freezable / Proxy flags | Existing | GoPlus Labs `is_mintable`, `can_take_back_ownership` fields |
| Buy / Sell tax percentage | Existing | GoPlus `buy_tax`, `sell_tax`; Honeypot.is simulation fallback |
| Current spot price (USD) | Existing | DexScreener → GeckoTerminal → DefiLlama fallback |
| Total liquidity (USD) | Existing | Sum of pool reserves from DexScreener/GeckoTerminal |
| Pool list (address, pair, reserve snapshot) | Existing | `mainPools[]` from `marketDataFallback.ts` |
| Token-2022 transfer fee config | Existing (Solana only) | `transferFeeConfig.transferFeeBasisPoints / 100` |
| Top 10 holder concentration | **BROKEN** | Requires `recentTransactions` which is `[]` — always returns 0 |
| Token velocity / transaction frequency | **BROKEN** | Same — hardcoded empty array; `AdvancedRiskMetricsCard` shows 0 |
| Wash trading percentage | **BROKEN** | Hardcoded `washTradingPercentage: 0` in `evmScanner.ts` |

---

## 6. Elevator Scan Capabilities

**Source**: `app/api/scan/elevator/route.ts`, `lib/elevator/`, `lib/fees/`, `lib/verification/`

| Capability | Status | Notes |
|:---|:---|:---|
| Normalized swap transactions (buy/sell/transfer) | Existing | `UniversalTransaction[]` from GeckoTerminal / Helius |
| Raw tx hashes + timestamps | Existing | `hash`, `timestamp` fields in `UniversalTransaction` |
| Buy/sell classification per tx | Existing | From GeckoTerminal `kind: 'buy'/'sell'` or Helius DEX source detection |
| Multi-hop trade aggregation | Existing | `aggregateTrades()` — collapses Jupiter/Uniswap hops by tx hash |
| Per-wallet net balance (batch window) | Existing | `buildWalletData()` — `total_in - total_out` |
| CEX deposit / withdrawal tagging | Existing | `cex-addresses.json` lookup in `tagAndComputeExchangeFlow()` |
| Net exchange flow metric | Existing | `totalTokensToExchanges - totalTokensFromExchanges` |
| Wash trading detection (batch round-trips) | Existing | `washTradingDetector.ts` — per-wallet buy+sell pairs |
| On-chain trust verification (3 trades) | Existing | `verifyTransactions.ts` — random sample against RPC receipts |
| Gas cost estimation per trade | Existing | `feeEstimator.ts` — `eth_getTransactionReceipt` or Helius |
| LP fee estimation (0.3% approx) | Existing | `feeEstimator.ts` — `tradeAmount * priceUsd * 0.003` |
| Contract wallet filtering (top 30) | Existing | `filterSystemAddresses()` — RPC bytecode check |
| Holder spike detection | Existing | `detectHolderSpike()` — ≥10 new, >50% growth in 24h window |
| Top 10 filtered wallet holders | Existing | `top_holders_filtered` — excludes DEX routers and contracts |
| Unique wallet count from batch | Existing | Count of distinct `from`/`to` in transaction set |
| OHLCV candles (Birdeye) | Existing | 24h price/volume candles — used for RF17 metric |
| RF17 metric (wash trading indicator) | Existing | `totalVolume > avgVolume && Math.abs(priceChange) < 0.02` |
| Pool discovery (top 5 by 24h volume) | Existing | GeckoTerminal `/tokens/{addr}/pools` sorted by `volume_usd.h24` |
| Per-pool reserve in USD | Existing | `reserve_in_usd` from GeckoTerminal pool data |

---

## 7. Deep Scan Proposed Capabilities

**Source**: `deep_scan/SKILL.md`, `deep_scan/modules/`

All 15 modules are **fully proposed** — none are yet implemented in production. They are organized by the intelligence layer they belong to:

**Behavioral / Wallet Layer**: Modules 1, 5, 6  
**Market Structure Layer**: Modules 2, 8, 11, 12, 13  
**Execution Risk Layer**: Modules 3, 7  
**Monitoring**: Module 10  
**Aggregation / Synthesis**: Modules 4, 9, 14, 15

---

## 8. Deep Module Mapping

| # | Module | Elevator Primitive Exists? | Basic Primitive Exists? | Deep-Only? | Overlap Risk | Verdict |
|:---:|:---|:---:|:---:|:---:|:---:|:---|
| 1 | Wallet Quality Analysis | NONE | NONE | YES | LOW | Keep in Deep. Wallet age + funding + clustering are not collected anywhere. |
| 2 | Organic Price Movement | PARTIAL | NONE | PARTIAL | MEDIUM | Elevator's RF17 and wash detection are primitives. Deep must expand to HHI, unique buyer trend, multi-wallet wash rings — *not duplicate*. |
| 3 | Liquidity Stress Test | NONE | NONE | YES | LOW | AMM constant-product simulation doesn't exist anywhere. Pure Deep. |
| 4 | Whale Behavior Analysis | NONE | NONE | YES | LOW | Dynamic threshold (>1% supply / >5% liquidity) + phase detection is absent everywhere. |
| 5 | Smart Money Detection | NONE | NONE | YES | LOW | Cross-token ROI history requires indexer APIs not called by any current scanner. |
| 6 | Buyer Quality Analysis | NONE | NONE | YES | LOW | Wallet age + capital diversity scoring is not collected by Basic or Elevator. |
| 7 | Exit Risk Analysis | NONE | NONE | YES | LOW | Scenario simulation (holders sell 10/25/50%) against AMM curve — pure Deep. |
| 8 | Market Regime Detection | NONE | NONE | YES | LOW | Price/volume regime classification not performed anywhere. |
| 9 | Top Risk Detection | NONE | NONE | YES | LOW | Aggregation of all module outputs — inherently Deep-internal. |
| 10 | Live Risk Monitoring | NONE | NONE | YES | LOW | Websocket block streaming not implemented in any scanner. |
| 11 | Multi-DEX Liquidity Mapping | PARTIAL (both) | PARTIAL (both) | PARTIAL | HIGH | **Pool addresses already fetched by GeckoTerminal in both Basic and Elevator.** Deep must reuse these, then add: liquidity fragmentation index, routing efficiency, per-pool depth ranking. Do NOT re-fetch pools from scratch. |
| 12 | Capital Efficiency Analysis | PARTIAL | PARTIAL | PARTIAL | MEDIUM | Basic gives total liquidity + FDV. Elevator gives per-pool reserves. Deep adds: MC/Liquidity ratio computation + capital sensitivity rating. Use shared data. |
| 13 | Historical Behavior Analysis | NONE | NONE | YES | LOW | Past pump/dump cycle detection requires historical price databases. Not available in current scanners. |
| 14 | Explainable Risk Scoring | NONE | NONE | YES | LOW | Weighted sub-score aggregation — inherently internal to Deep. |
| 15 | Evidence-Based Trader Intelligence | NONE | NONE | YES | LOW | AI synthesis of all module outputs into a trader narrative — not in any current scanner. |

---

## 9. Duplicate Analysis

| Apparent Duplicate | Scanner A | Scanner B | True Duplicate? | Verdict |
|:---|:---:|:---:|:---:|:---|
| Pool discovery | Basic | Elevator | NO — Same Data / Different Depth | Basic: static snapshot from DexScreener API. Elevator: top-5 pools by 24h volume from GeckoTerminal, used to fetch swap events. Both should write to shared cache. |
| Wash trading flag | Basic | Elevator | NO — Same Topic / Different Depth | Basic: hardcoded `washTradingPercentage: 0` (broken, non-functional). Elevator: `detectWashTrading()` — actual round-trip detection per batch. Different capability. |
| Wash trading | Elevator | Deep | NO — Same Topic / Different Depth | Elevator: single-wallet buy+sell within batch window. Deep: cross-wallet coordinated wash rings, HHI concentration analysis. Must not duplicate. |
| Top holders | Elevator | Deep | NO — Same Topic / Different Depth | Elevator: net balance ledger within batch window (local, imprecise). Deep: real on-chain holder snapshot from RPC/indexer (full, accurate). Elevator data is a preview; Deep data is authoritative. |
| Market cap / Liquidity ratio | Basic | Deep | NO — Same Data / Different Intelligence | Basic: provides raw FDV + total liquidity (numbers). Deep: computes ratio, interprets sensitivity, generates capital efficiency rating. Not duplicate. |
| OHLCV data | Elevator | Deep | YES — Same Capability, Same Source | Both would call Birdeye OHLCV. **Must be shared.** Elevator should write to cache; Deep should read from cache. |

---

## 10. Basic → Shared Data

Data from Basic Scan that should be written to a shared cache and consumed by Elevator/Deep instead of re-fetched:

| Data | Basic Scan Source | Useful to Elevator | Useful to Deep | Re-fetch Required? |
|:---|:---|:---:|:---:|:---:|
| Token decimals | `evmScanner.ts` — direct ERC-20 RPC call | YES (normalize amounts) | YES (normalize amounts) | NO — cache it |
| Token symbol | `evmScanner.ts` — direct ERC-20 RPC call | YES (labelling) | YES (labelling) | NO — cache it |
| Total supply | `evmScanner.ts` — `totalSupply()` | NO | YES (whale % calculations) | NO — cache it |
| Chain / network ID | `autoDetectChainId()` | YES (collector routing) | YES (module routing) | NO — already shared via `detectChain()` |
| Pool addresses + reserves | `marketDataFallback.ts` — DexScreener | YES (starting point for pool queries) | YES (avoid re-querying) | NO — cache pool list |
| Spot price (USD) | `marketDataFallback.ts` | YES (fee USD conversion) | YES (position sizing) | NO — cache with TTL |
| GoPlus security flags | `goPlusSecurity.ts` | NO | YES (risk scoring context) | NO — cache it |

**Evidence**: `lib/blockchain/cache.ts` already implements `cacheStaticData()` / `getStaticData()`. This should be extended to serve Elevator and Deep.

---

## 11. Elevator → Deep Reusable Data

| Data | Elevator Source | Used By Elevator | Useful to Deep | Re-fetch Required? |
|:---|:---|:---:|:---:|:---:|
| Normalized `UniversalTransaction[]` | `geckoTerminal.ts`, `helius.ts` | YES | YES — wallet analysis, wash ring detection, volume HHI | NO — pass to Deep if same session |
| Transaction hashes + timestamps | `UniversalTransaction.hash` | YES | YES — evidence trail, chronological ordering | NO |
| Wallet addresses from batch | `UniversalTransaction.from`, `.to` | YES | YES — seed list for wallet quality analysis | NO |
| Buy/sell type per transaction | `UniversalTransaction.type` | YES | YES — buyer quality analysis, organic price input | NO |
| Per-pool reserve in USD | GeckoTerminal `reserve_in_usd` | Indirectly | YES — liquidity stress + exit risk simulations | NO |
| Pool addresses (top 5 by volume) | GeckoTerminal pool discovery | YES | YES — Multi-DEX mapping starting point | NO |
| CEX-tagged wallet addresses | `cex-addresses.json` + `tagAndComputeExchangeFlow()` | YES | YES — exclude CEX wallets from wallet quality scoring | NO |
| OHLCV candles | `birdeye.ts` | YES (RF17 metric) | YES — market regime detection, volatility Z-score | NO — share via cache |
| Wash trader flagged wallets | `washTradingDetector.ts` output | YES | YES — exclude from buyer quality, inform organic price module | NO |
| Contract-filtered top holders | `filterSystemAddresses()` | YES | YES — whale threshold analysis starting list | NO |

**Key design principle**: If a user runs both Elevator and Deep on the same token in the same session, Deep should receive Elevator's `CollectorResult` directly rather than re-invoking GeckoTerminal or Helius for the same block window.

---

## 12. Shared Data Entities

Data entities that should exist once in a shared cache/store and be consumed by all scanners:

| Entity | Producer | Consumers | Should Be Cached? | Reason |
|:---|:---|:---|:---:|:---|
| Token (name, symbol, decimals, supply, chain) | Basic Scan | Basic, Elevator, Deep | YES (TTL: 1h) | Static metadata changes rarely. Avoid duplicate RPC calls. |
| Contract security flags (GoPlus) | Basic Scan | Basic, Deep | YES (TTL: 30min) | GoPlus API has rate limits. Deep's risk scoring needs these flags. |
| Pool list (address, DEX, pair, reserve snapshot) | Basic Scan or Elevator | All | YES (TTL: 5min) | Pool addresses are the foundation for liquidity analysis. |
| Spot price (USD) | Basic Scan | All | YES (TTL: 1min) | Used for fee conversion, position sizing, MC calculations. |
| OHLCV candles | Elevator (Birdeye) | Elevator, Deep | YES (TTL: 5min) | Birdeye is API-key-gated; avoid duplicate calls. |
| Normalized swap transactions | Elevator | Elevator, Deep | YES (session-scoped) | Re-fetching the same block window is wasteful and slow. |
| CEX address registry | `data/cex-addresses.json` | Elevator, Deep | YES (permanent) | Static registry file — both scanners already need it. |
| Chain ID resolution | `autoDetectChainId()` | Basic, Elevator, Deep | YES (TTL: permanent) | Address→chain mapping doesn't change. |

---

## 13. Scanner Boundaries

### Basic Scan

**Owns:**
- Token contract metadata (name, symbol, decimals, supply, creator)
- Contract bytecode verification (is it deployed?)
- Contract security: mintable, freezable, proxy, honeypot, hidden owner
- Buy/sell tax (GoPlus + Honeypot.is simulation)
- Current spot price (USD snapshot)
- Total liquidity USD (aggregated from DEX aggregators)
- Pool list as a static snapshot (not transaction-level data)
- Liquidity lock status
- Solana Token-2022 extension parsing (transfer fees)
- Chain auto-detection

**Does NOT own:**
- Any capability requiring transaction history
- Wallet age, funding, or relationship analysis
- Swap event decoding or classification
- Price impact simulation or slippage calculation
- Behavioral or historical analysis of any kind
- The `AdvancedRiskMetricsCard` — this card must be disabled/hidden during Basic Scan since `recentTransactions = []`

---

### Elevator Scan

**Owns:**
- Normalized swap / transfer transaction batch (50–500 records)
- Buy/sell classification of individual swaps from DEX event data
- Multi-hop trade aggregation (collapsing Jupiter/Uniswap router hops)
- Per-wallet net balance reconstruction (within batch window only)
- CEX deposit/withdrawal tagging from the transaction set
- Net exchange flow metrics (tokens in vs. out to exchanges)
- Wash trading detection within the batch (round-trip pairs per wallet)
- On-chain trust verification (3 random transactions verified against RPC)
- Gas cost and LP fee estimation per trade
- Contract wallet filtering from top holder list (RPC bytecode check)
- Holder spike detection (24h new recipient growth)
- OHLCV candle data (Birdeye)

**Does NOT own:**
- Wallet age, cross-token reputation, or smart money profiling
- Coordinated wallet clustering (cross-wallet relationships)
- AMM constant-product price impact simulations
- Historical cycle analysis (pump/dump patterns)
- Market regime classification
- AI-synthesized trader reports
- Full holder distribution (only approximates from transaction window)

---

### Deep Scan

**Owns:**
- Wallet age and first-transaction analysis
- Wallet funding source detection (funding wallet graph)
- Coordinated wallet clustering (shared-funding nodes)
- Cross-token smart money ROI and win-rate analysis
- Volume concentration HHI index (wash ring detection across wallets)
- AMM constant-product slippage simulation ($1K–$100K positions)
- Exit risk scenarios (top holders selling 10/25/50%)
- Market regime classification (ACCUMULATION / MOMENTUM / DISTRIBUTION / etc.)
- Buyer quality scoring (age, capital diversity, return frequency)
- Whale threshold detection and phase tracking (accumulation vs. distribution)
- Historical pump/dump cycle detection
- Capital efficiency / market cap × liquidity sensitivity rating
- Per-module evidence chains and confidence scores
- Explainable risk scoring with sub-score decomposition
- AI-synthesized trader intelligence report
- Live block monitoring (websocket streaming — Phase 2)

**Does NOT own:**
- Basic contract metadata or security flags (reuse Basic Scan output)
- Raw transaction fetching (reuse Elevator's `CollectorResult`)
- Pool address discovery (reuse from Basic/Elevator shared cache)
- CEX address registry (reuse `cex-addresses.json`)

---

## 14. Capability Reallocation

| Capability | Current Location | Recommended Action | Reason | Evidence | Priority |
|:---|:---:|:---:|:---|:---|:---:|
| `AdvancedRiskMetricsCard` (Top 10 Concentration, Velocity, Frequency) | Basic UI | MOVE TO ELEVATOR / DEEP | These metrics require `recentTransactions` which Basic never fetches. Card always shows 0. | `evmScanner.ts` L192: `recentTransactions: []` | P0 |
| Wash trading % | Basic | REMOVE FROM BASIC | `washTradingPercentage: 0` is hardcoded — non-functional. Elevator owns real wash detection. | `evmScanner.ts` — hardcoded value | P0 |
| Pool discovery | Basic + Elevator | SHARE VIA CACHE | Both scanners fetch pool lists independently. Should write to shared cache once. | `marketDataFallback.ts` vs `geckoTerminal.ts` | P1 |
| OHLCV data | Elevator | SHARE WITH DEEP VIA CACHE | Deep's market regime module requires OHLCV. Elevator already fetches it. Don't duplicate. | `lib/elevator/collectors/solana/birdeye.ts` | P1 |
| RF17 metric (volume vs. price change) | Elevator | EXPAND IN DEEP | RF17 is a single binary flag. Deep should expand to full organic price analysis with HHI, buyer trend, etc. Keep RF17 in Elevator as a quick indicator. | `EthCollector.ts:calculateMetrics()` | P1 |
| Market cap / liquidity ratio | Basic (data only) | EXPAND IN DEEP | Basic provides FDV + liquidity as raw numbers. Deep should compute ratio + sensitivity rating. | `marketDataFallback.ts` returns `liquidityInfo` | P1 |
| Multi-DEX pool mapping | Both | DEEP ONLY — REUSE EXISTING | Both scanners already discover pools. Deep adds: fragmentation index, routing efficiency. Must not re-fetch. | `geckoTerminal.ts:fetchTokenPools()` | P1 |
| Smart money / cross-token wallet history | Neither | DEEP ONLY | Requires Covalent/Dune/Nansen-class indexing. Not feasible in Basic or Elevator context. | Codebase has no such indexer integration | P2 |
| Live block monitoring | Neither | DEEP (P2 / Phase 2) | Websocket streaming requires infrastructure not present in the Next.js API route model. | SKILL.md Module 10 | P2 |

---

## 15. Deep Scan True Core

After removing Basic duplicates, Elevator primitives, and deferred infrastructure, the following are genuinely unique to Deep Scan and provide maximum trader differentiation:

### P0 — Essential (Must Build First)

| # | Capability | Trader Problem Solved |
|:---:|:---|:---|
| 1 | AMM constant-product slippage simulation | "What is my actual exit price if I sell $50K right now?" |
| 2 | Exit risk scenario (top holder 10/25/50% sell) | "Can I get out before the top holders do?" |
| 3 | Volume concentration HHI + wash ring detection | "Is this volume real or manufactured by 3 wallets cycling?" |
| 4 | Whale behavior (threshold, phase, net flow) | "Are large holders accumulating or distributing right now?" |
| 5 | Buyer quality score | "Are the buyers healthy organic wallets or fresh snipers?" |
| 6 | Market regime classification | "Is this token in pump-and-dump distribution or genuine breakout?" |
| 7 | Capital efficiency / MC×Liquidity sensitivity | "How much buy pressure does it take to move price 10%?" |
| 8 | Explainable risk score (0–100, decomposed) | "What is my overall risk summary, and why?" |
| 9 | AI-synthesized trader report | "Give me a 5-sentence briefing on whether to trade this." |
| 10 | Evidence chain per finding | "Show me the transaction hashes behind every claim." |

### P1 — Important (Build in Phase 2)

| # | Capability | Trader Problem Solved |
|:---:|:---|:---|
| 11 | Wallet age + funding source analysis | "Are these fresh wallets funded by the same creator?" |
| 12 | Coordinated wallet clustering | "How many coordinated buy wallets are in this token?" |
| 13 | Smart money entry/exit detection | "Have historically profitable wallets entered or exited?" |
| 14 | Historical cycle detection (pump/dump patterns) | "Has this token done this exact pattern before?" |

### P2 — Optional (Build in Phase 3 or Later)

| # | Capability | Trader Problem Solved |
|:---:|:---|:---|
| 15 | Live block monitoring (websocket) | "Alert me if a whale just sold." |
| 16 | Cross-token wallet ROI / win-rate | "What is this wallet's track record across 50 tokens?" |

---

## 16. Trader Problem Alignment

| Module | Trader Problem | New Information vs. Basic/Elevator | Differentiation |
|:---|:---|:---|:---:|
| Liquidity Stress Test | "Can I exit $50K without destroying price?" | Neither Basic nor Elevator simulates AMM impact | HIGH |
| Exit Risk Analysis | "Are top holders about to dump on me?" | Elevator shows top holders from batch; Deep simulates their exit scenario | HIGH |
| Volume HHI + Organic Price | "Is volume real?" | Elevator flags wash round-trips; Deep computes market-wide HHI concentration | HIGH |
| Whale Behavior | "What are large wallets doing?" | Elevator shows batch-only net balance; Deep tracks real-time accumulation/distribution phase | HIGH |
| Buyer Quality | "Who is buying this?" | Elevator shows unique wallet count; Deep scores wallet age, capital, return ratio | HIGH |
| Market Regime | "What phase is this token in?" | Not present in either scanner | HIGH |
| Capital Efficiency | "How sensitive is price to flows?" | Basic gives raw numbers; Deep computes multiplier effect and rating | HIGH |
| Smart Money | "Are profitable traders in this?" | Not present in either scanner | HIGH |
| Historical Cycles | "Has this dumped before like this?" | Not present in either scanner | MEDIUM |
| Live Monitoring | "Alert me in real-time" | Not present in either scanner | MEDIUM |
| Risk Score | "What is the overall risk?" | Not present in either scanner | HIGH |
| Trader Report | "One-paragraph summary for a trade decision" | Not present in either scanner | HIGH |

---

## 17. Anti-TokenSniffer Differentiation

Deep Scan deliberately avoids the following TokenSniffer/standard scanner patterns:

| Pattern | TokenSniffer Approach | Deep Scan Approach |
|:---|:---:|:---:|
| Contract security | Static bytecode scan | ✅ Delegated to Basic Scan; Deep does NOT re-audit contracts |
| Honeypot detection | Simulation of buy/sell | ✅ Basic Scan owns this — Deep does NOT duplicate |
| Tax / fees | GoPlus flags | ✅ Basic Scan owns this — Deep reads from shared cache |
| Liquidity check | "Has liquidity?" (binary) | ✅ Deep runs AMM constant-product simulation — execution price for real position sizes |
| Holder count | Static snapshot | ✅ Deep analyzes holder quality, age, coordination, funding source |
| Volume | Raw number | ✅ Deep computes HHI concentration, buy/sell ratio, unique buyer trend |
| Price movement | Chart display | ✅ Deep classifies into regime (ACCUMULATION / DISTRIBUTION / etc.) with evidence |

Deep Scan's output is structured to answer the question a **trader** asks before entering or exiting a position — not a developer auditing a contract.

---

## 18. Final Capability Roadmap

### P0 — Must Exist (Core Trader Value)

| Capability | Owner | Rationale |
|:---|:---:|:---|
| AMM slippage simulation ($1K–$100K) | DEEP | No existing system does this. Core trader question. |
| Exit risk scenarios (top holder sell-off) | DEEP | Direct answer to "Can I exit before whales?" |
| Volume HHI concentration + wash ring detection | DEEP | Elevator's RF17 is too simplistic for real analysis. |
| Whale phase detection (accumulation/distribution) | DEEP | Directly actionable for swing traders. |
| Buyer quality scoring | DEEP | No existing scanner profiles buyer wallet quality. |
| Market regime classification | DEEP | Frame all other signals in context. |
| Capital efficiency / MC×Liquidity ratio | DEEP | Tells traders how volatile/sensitive price is to flows. |
| Explainable risk score (decomposed 0–100) | DEEP | Required for a professional-grade output. |
| AI trader report narrative | DEEP | Ultimate synthesis — unique competitive advantage. |
| Evidence chain for all findings | DEEP | Distinguishes this from opaque scanners. |
| Pool list (shared) | SHARED | Foundation for all liquidity work. |
| OHLCV candles (shared, from Elevator) | SHARED | Required by market regime + capital efficiency. |
| Fix: Remove/hide `AdvancedRiskMetricsCard` in Basic | BASIC FIX | Currently shows 0 everywhere — must be corrected. |
| Fix: Remove hardcoded `washTradingPercentage: 0` | BASIC FIX | Misleading output must be removed. |

### P1 — Should Exist

| Capability | Owner |
|:---|:---:|
| Wallet age + funding source analysis | DEEP |
| Coordinated wallet clustering | DEEP |
| Smart money entry/exit | DEEP |
| Historical pump/dump cycle detection | DEEP |
| Pool-level liquidity fragmentation index | DEEP |

### P2 — Later

| Capability | Owner |
|:---|:---:|
| Live websocket block monitoring | DEEP |
| Cross-token smart money ROI/win-rate | DEEP |
| Historical volatility Z-score per regime | DEEP |

### DROP — Do Not Build

| Capability | Reason |
|:---|:---|
| Contract reentrancy / audit | TokenSniffer territory; Basic/GoPlus already covers this |
| Token social sentiment | Out of scope; no signal value for on-chain analysis |
| Price prediction / forecasting | Violates evidence-first principle; legally risky |

---

## 19. Critical Decisions

| # | Decision | Options | Recommendation | Risk |
|:---:|:---|:---:|:---:|:---:|
| 1 | Should Deep Scan re-fetch transactions if Elevator has already run? | A: Always re-fetch. B: Reuse Elevator's `CollectorResult`. | **B — Reuse** | Session-scoping requires API design coordination |
| 2 | Should `AdvancedRiskMetricsCard` be hidden in Basic Scan? | A: Hide it. B: Fix Basic to fetch transactions. C: Remove card. | **A — Hide it** (conditionally render only when Elevator/Deep data present) | Low risk |
| 3 | Should pool data be written to a shared database table by Basic and read by Deep? | A: Each scanner re-fetches. B: Shared cache layer. | **B — Shared cache** (extend `cache.ts`) | Requires schema work |
| 4 | Should Smart Money (Module 5) require Dune/Covalent/Nansen APIs? | A: Build without indexer. B: Require third-party indexer. C: Defer. | **C — Defer to Phase 2** | No current indexer integration in codebase |
| 5 | Should Live Monitoring (Module 10) use websockets in Next.js API routes? | A: Build in Next.js API routes. B: Separate event streaming service. | **B — Separate service** (Next.js API routes have 60s timeout) | Architectural dependency |
| 6 | Should OHLCV data be shared from Elevator to Deep? | A: Each fetches independently. B: Elevator writes to cache, Deep reads. | **B — Shared** | Requires cache TTL coordination |

---

## 20. Unknown / Unverified Items

| Item | Status | Notes |
|:---|:---:|:---|
| Supabase credit deduction schema | UNKNOWN | `deduct_credits_for_scan` RPC is in database; not inspectable from filesystem. |
| Dune Analytics / Covalent API availability | UNKNOWN | No integration exists yet. Smart money module feasibility depends on this. |
| Birdeye API rate limits and tier | UNKNOWN | Rate limits are provider-controlled; not defined in codebase. |
| `BscCollector.ts` full implementation | NOT FULLY AUDITED | File exists; confirmed structure mirrors `EthCollector` but not read in detail. |
| Solana `walletEngine.ts` / `metrics.ts` full logic | NOT FULLY AUDITED | These Solana-specific helpers were listed but not fully read during audit. |
| GoPlus rate limiting behavior in production | UNKNOWN | High-traffic periods may hit free-tier rate limits silently. |
| Deep Scan credit pricing model | UNDEFINED | Not defined in any existing file. Must be decided before implementation. |

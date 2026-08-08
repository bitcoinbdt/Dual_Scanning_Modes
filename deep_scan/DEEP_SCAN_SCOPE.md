# Deep Scan Scope

## 1. Purpose
The Deep Scan system is a trader-focused on-chain intelligence and decision-support engine. Unlike standard contract security scanners that focus purely on static code vulnerabilities (e.g., Honeypots, Reentrancy), Deep Scan converts raw on-chain transaction histories and liquidity reserve balances into behavioral intelligence, execution-risk simulations, and market-structure analysis. It assists active traders in evaluating execution conditions, exit safety, buyer demand quality, and capital efficiency.

---

## 2. Scope Definition
The boundary between Basic, Elevator, Shared Data, and Deep Scan is defined as follows:
* **Basic Scan**: Owns static contract metadata validation and baseline security checks (honeypots, mintable/freezable check, tax percentages, nominal aggregates).
* **Elevator Scan**: Owns recent transaction collection, buy/sell trade classification, CEX flow tagging, basic wash trading heuristics, and 3-transaction random audit trail checks.
* **Shared Data Layer**: Provides a consolidated cache for token decimals, symbols, total supply, active pool lists, spot prices, OHLCV candles, and normalized transaction sets, ensuring no scanner makes duplicate API or RPC requests.
* **Deep Scan**: Owns constant-product AMM slippage simulations, exit price impacts, coordinated wallet/funding graph clustering, historical smart money win-rate checks, market regime classification, and AI synthesis narratives.

---

## 3. Deep Scan Core Question
The single core question Deep Scan must answer is:
> *"What does the token's on-chain behavior and market structure mean for a trader's entry, position sizing, and exit safety?"*

---

## 4. Deep Scan Responsibilities
Deep Scan is responsible for:
1. **AMM Position Slippage Simulations**: Calculating exact price impact for position sizes ($1K to $100K).
2. **Whale Position Exit Scenarios**: Simulating the price impact if top holders liquidate 10%, 25%, or 50% of their positions.
3. **Wallet Co-Funding Analysis**: Identifying shared funding originations and timing correlation across buyer wallets.
4. **Volume Concentration Analysis**: Computing Herfindahl-Hirschman Indices (HHI) for buyer/seller volumes.
5. **Buyer Quality Scoring**: Profiling wallet ages, return frequencies, and capital diversity of recent cohorts.
6. **Market Regime Classification**: Categorizing the token's price-volume slope (e.g., ACCUMULATION, MOMENTUM, DISTRIBUTION).
7. **Capital Efficiency Profiling**: Tracking Market Cap to Liquidity ratios and multiplier effects.
8. **Explainable Risk Aggregation**: Synthesizing sub-scores with verifiable evidence indices (transaction hashes).
9. **AI Narrative Generation**: Compiling evidence-based trader briefings without hallucination.

---

## 5. Explicit Non-Responsibilities
Deep Scan must NOT own or duplicate:
1. **Contract Auditing**: Checking for compiler warnings, reentrancy bugs, or standard security flags (Basic Scan responsibility).
2. **Tax & Honeypot Simulations**: Simulating buys/sells to estimate tax basis points (Basic Scan responsibility).
3. **Raw Transaction Ingestion**: Querying raw blocks or logs from node APIs (Elevator Scan responsibility).
4. **Multi-hop Router Trade Aggregation**: Collapsing aggregator swap paths (Elevator Scan responsibility).
5. **CEX IP/Address Registries**: Maintaining lists of centralized exchange hot wallets (Shared Data Layer responsibility).
6. **Price Forecasting / Prediction**: Generating speculative future price targets or buy/sell recommendations (Explicitly dropped).

---

## 6. Deep Scan Module Scope

### Module 1: Wallet Quality Analysis
* **Purpose**: Profiling cohort legitimacy and sniper presence.
* **Trader Problem**: *"Are the token holders organic or coordinated actors?"*
* **Inputs**: Wallet address list, funding transaction history.
* **Reused Basic Data**: Creator address.
* **Reused Elevator Data**: Transaction sender/recipient lists.
* **New Intelligence**: Shared funding origin tracking, coordinated buy-block analysis, sniper/fresh wallet ratios.
* **Output**: Cluster list, shared funding node paths, and age distribution metrics.
* **Priority**: P1
* **Dependencies**: None.
* **Duplication Risk**: None; Elevator only lists top holders based on batch transactions.
* **Scope Decision**: **REUSE + EXPAND** (Consume Elevator's transaction sender lists; generate graph-based clustering).

### Module 2: Organic Price Movement Analysis
* **Purpose**: Evaluating the authenticity of volume momentum.
* **Trader Problem**: *"Is this volume real or artificially generated?"*
* **Inputs**: Swap logs, unique sender metrics.
* **Reused Basic Data**: None.
* **Reused Elevator Data**: Unique wallet count, raw swap list.
* **New Intelligence**: Herfindahl-Hirschman Index (HHI) volume concentration, unique buyer count trend.
* **Output**: HHI indices, buy/sell ratios, volume concentration score.
* **Priority**: P0
* **Dependencies**: None.
* **Duplication Risk**: Elevator's wash trading detector flags single-wallet round-trips.
* **Scope Decision**: **REUSE + EXPAND** (Elevator handles basic round-trips; Deep adds volume concentration and multi-wallet wash rings).

### Module 3: Liquidity Stress Test
* **Purpose**: Simulating execution impact for trade sizes.
* **Trader Problem**: *"What is my actual slippage if I execute a $25K trade?"*
* **Inputs**: AMM Pool reserves, swap fee structures.
* **Reused Basic Data**: Pool addresses.
* **Reused Elevator Data**: Pool reserve snapshots.
* **New Intelligence**: Constant-product price impact simulations, execution fee models.
* **Output**: Simulated price impacts for custom position arrays ($1K, $5K, $10K, $25K, $50K, $100K).
* **Priority**: P0
* **Dependencies**: None.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (Build execution simulator using cached pool reserves).

### Module 4: Whale Behavior Analysis
* **Purpose**: Dynamic monitoring of high-concentration wallets.
* **Trader Problem**: *"Are whales accumulating or distributing?"*
* **Inputs**: Holder balances.
* **Reused Basic Data**: Total supply.
* **Reused Elevator Data**: Contract-filtered top holders.
* **New Intelligence**: Dynamic whale thresholds (controls $>1\%$ supply or $>5\%$ liquidity), net whale inflows.
* **Output**: Whale net flows and accumulation/distribution phase signals.
* **Priority**: P0
* **Dependencies**: Module 1 (filtering system contracts).
* **Duplication Risk**: None.
* **Scope Decision**: **REUSE + EXPAND** (Elevator identifies top holders; Deep applies dynamic thresholds and accumulation phase signals).

### Module 5: Smart Money Detection
* **Purpose**: Tracking historically profitable addresses.
* **Trader Problem**: *"Are successful wallets entering this token?"*
* **Inputs**: Historical cross-token transaction histories.
* **Reused Basic Data**: None.
* **Reused Elevator Data**: Wallet address seed lists.
* **New Intelligence**: Cross-token wallet ROI profiling, early entry frequency, historical win rate.
* **Output**: Smart money entries, net flow directions.
* **Priority**: P2
* **Dependencies**: None.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (Requires advanced third-party indexing like Dune/Covalent; deferred).

### Module 6: Buyer Quality Analysis
* **Purpose**: Profiling the health of incoming buyer cohorts.
* **Trader Problem**: *"Are buyers healthy retail wallets or low-quality snipers?"*
* **Inputs**: Buyer address histories from the last 24 hours.
* **Reused Basic Data**: None.
* **Reused Elevator Data**: Transaction wallets list.
* **New Intelligence**: Ratio of returning vs. single-use buyers, buyer capital diversity, buyer age distribution.
* **Output**: Quality score (0-100), positive and negative factor lists.
* **Priority**: P0
* **Dependencies**: Module 1.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (Performs long-term profiling on incoming addresses).

### Module 7: Exit Risk Analysis
* **Purpose**: Modeling concentration sell pressure.
* **Trader Problem**: *"Can I exit my position before whales dump on me?"*
* **Inputs**: Holder balances, AMM reserves.
* **Reused Basic Data**: Pool reserves.
* **Reused Elevator Data**: Top holders list.
* **New Intelligence**: Top holder liquidation simulation (10%, 25%, 50%), exit impact scoring.
* **Output**: Liquidation scenario price impact tables.
* **Priority**: P0
* **Dependencies**: Module 3, Module 4.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (Build exit simulator using AMM curves).

### Module 8: Market Regime Detection
* **Purpose**: Framing token trading phases.
* **Trader Problem**: *"Is this token in a healthy accumulation phase or distribution phase?"*
* **Inputs**: Price, volume, capital flow series.
* **Reused Basic Data**: None.
* **Reused Elevator Data**: OHLCV candles (Birdeye).
* **New Intelligence**: Price/volume slope analysis, volatility Z-scores, regime classification.
* **Output**: Regime classification label and transition metrics.
* **Priority**: P0
* **Dependencies**: None.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (Performs mathematical time-series modeling on candles).

### Module 9: Top Risk Detection
* **Purpose**: Bubbling up critical risks.
* **Trader Problem**: *"What are the 3 biggest risk factors I face?"*
* **Inputs**: Output data from Modules 1-8.
* **Reused Basic Data**: Basic security flags.
* **Reused Elevator Data**: Wash trading flags.
* **New Intelligence**: Cross-module risk severity ranking.
* **Output**: Array of top risk objects with severity, evidence, and confidence scores.
* **Priority**: P0
* **Dependencies**: Modules 1-8.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (Synthesis logic).

### Module 10: Live Risk Monitoring
* **Purpose**: Block-by-block update stream.
* **Trader Problem**: *"Alert me if liquidity is pulled or a whale exits."*
* **Inputs**: Event listeners.
* **Reused Basic Data**: None.
* **Reused Elevator Data**: None.
* **New Intelligence**: Block-by-block volume spike alerts, transaction monitoring.
* **Output**: Real-time event notifications.
* **Priority**: P2
* **Dependencies**: None.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (Requires persistent websocket service; deferred).

### Module 11: Multi-DEX Liquidity Mapping
* **Purpose**: Identifying liquidity locations.
* **Trader Problem**: *"Where is the real liquidity located?"*
* **Inputs**: Factory contracts, token pools.
* **Reused Basic Data**: Pool addresses.
* **Reused Elevator Data**: Pool reserve values.
* **New Intelligence**: Liquidity fragmentation index, routing efficiency metrics.
* **Output**: Pool reserve shares and fragmentation statistics.
* **Priority**: P1
* **Dependencies**: None.
* **Duplication Risk**: Basic Scan reads DexScreener pools; Elevator Scan reads GeckoTerminal pools.
* **Scope Decision**: **REUSE + EXPAND** (Do not re-discover pools; consume existing pool caches and calculate fragmentation).

### Module 12: Capital Efficiency Analysis
* **Purpose**: Evaluating price sensitivity to inflows.
* **Trader Problem**: *"How much capital flow does it take to move price?"*
* **Inputs**: Circulating supply, price, AMM reserves.
* **Reused Basic Data**: FDV, spot price.
* **Reused Elevator Data**: Pool reserves.
* **New Intelligence**: Market Cap to Liquidity Ratio, Capital Sensitivity ratings.
* **Output**: Sensitivity metrics, efficiency multiplier.
* **Priority**: P0
* **Dependencies**: Module 11.
* **Duplication Risk**: None.
* **Scope Decision**: **REUSE + EXPAND** (Use FDV/liquidity figures to calculate efficiency metrics).

### Module 13: Historical Behavior Analysis
* **Purpose**: Mapping historical cycle drawdowns.
* **Trader Problem**: *"What is the typical drawdown speed for this token class?"*
* **Inputs**: Price/Volume histories.
* **Reused Basic Data**: None.
* **Reused Elevator Data**: None.
* **New Intelligence**: Historical drawdown percentage, pump-to-dump cycle durations.
* **Output**: Cycle summary, recurring pattern analysis.
* **Priority**: P1
* **Dependencies**: Module 8.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (Requires historical time-series data).

### Module 14: Explainable Risk Scoring
* **Purpose**: Generating verifiable risk index scores.
* **Trader Problem**: *"What is the overall safety score, and how is it calculated?"*
* **Inputs**: Sub-scores from other modules.
* **Reused Basic Data**: Security flags.
* **Reused Elevator Data**: Wash trading results.
* **New Intelligence**: Weighted scoring aggregation, mitigators calculations.
* **Output**: Overall risk score (0-100), detailed sub-score array.
* **Priority**: P0
* **Dependencies**: Modules 1-13.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (Scoring engine).

### Module 15: Evidence-Based Trader Intelligence
* **Purpose**: Compiling the final trader report.
* **Trader Problem**: *"Give me a single-paragraph summary of the opportunity and risk."*
* **Inputs**: Outputs from Modules 1-14.
* **Reused Basic Data**: None.
* **Reused Elevator Data**: None.
* **New Intelligence**: AI narrative synthesis of structured metrics.
* **Output**: Actionable markdown report, overall confidence rating.
* **Priority**: P0
* **Dependencies**: Modules 1-14.
* **Duplication Risk**: None.
* **Scope Decision**: **DEEP-ONLY** (AI report synthesis).

---

## 7. P0 Scope
The initial release of Deep Scan must focus on core trader values:
1. **Module 3 (Liquidity Stress)**: Constant-product execution slippage simulation for sizes $1K–$100K.
2. **Module 7 (Exit Risk)**: Top holder exit simulation (10%, 25%, 50% sell scenario).
3. **Module 2 (Organic Price)**: HHI volume concentration index and unique buyer trends.
4. **Module 4 (Whale Behavior)**: Dynamic whale thresholds and accumulation/distribution phase signals.
5. **Module 6 (Buyer Quality)**: Cohort age and capital diversity profiling.
6. **Module 8 (Market Regime)**: Price-volume slope and volatility Z-scores.
7. **Module 12 (Capital Efficiency)**: Market Cap to Liquidity Ratio calculations.
8. **Module 14 (Risk Scoring)**: Decomposed explainable risk index.
9. **Module 15 (Trader Intelligence)**: AI-synthesized narrative report.
10. **Evidence Chain**: Verifiable transaction hashes linked to all signals.

---

## 8. P1 Scope
Important features deferred to the second release:
1. **Module 1 (Wallet Quality)**: Shared funding wallet clustering and coordinated sniper analysis.
2. **Module 11 (Multi-DEX Mapping)**: Fragmentation index and routing efficiency.
3. **Module 13 (Historical Behavior)**: Historical cycle drawdown speed and dump speed mapping.

---

## 9. P2 Scope
Deferred capabilities requiring third-party indexing or persistent streaming:
1. **Module 5 (Smart Money)**: Cross-token wallet ROI win-rate historical analysis (requires Dune/Covalent APIs).
2. **Module 10 (Live Monitoring)**: Real-time websocket-based block streaming (requires a separate service).

---

## 10. Shared Data Dependencies
Deep Scan consumes the following shared variables:

| Shared Entity | Producer | Data Purpose | Freshness Requirement | Cached? |
|:---|:---|:---|:---|:---|
| Token Decimals | Basic Scan | Normalizing amounts | `UNKNOWN` (permanent) | Yes |
| Total Supply | Basic Scan | Whale percentage calculation | `UNKNOWN` (permanent) | Yes |
| Pool Reserves | Basic Scan / Elevator | Constant-product simulation seed | < 5 minutes | Yes |
| Spot Price | Basic Scan | Conversion of native tokens to USD | < 1 minute | Yes |
| OHLCV Candles | Elevator Scan | Volatility Z-scores & regime detection | < 5 minutes | Yes |
| Universal Transactions | Elevator Scan | Volume HHI & buyer quality mapping | Session-scoped | Yes |
| CEX Labels | Shared Data | Filtering out CEX addresses | Permanent | Yes |
| Wash-Trader Flags | Elevator Scan | Excluding wash addresses from buyer scores | Session-scoped | Yes |

---

## 11. Input Boundary
Deep Scan expects the following transaction boundaries:
* **Elevator Data Present (Scenario A)**: Deep Scan consumes the normalized `UniversalTransaction[]` array directly from the session cache, preventing duplicate node calls.
* **Elevator Data Missing (Scenario B / Independent Run)**: If Deep Scan is executed independently, it will call the Elevator collector internally to fetch the necessary transaction batch (max 500 logs) before running behavioral analyses.

---

## 12. Data Semantics

### Classification
* **DATA**: Raw values fetched from the blockchain (e.g., transaction signature: `0xabc...`, gas cost: `0.0001 SOL`).
* **METRIC**: Structured mathematical summaries (e.g., volume HHI index: `0.35`, top 10 concentration: `45%`).
* **ANALYSIS**: Logical deductions made from metrics (e.g., "This wallet has executed both a buy and a sell within the window").
* **SIGNAL**: Actionable flag triggers (e.g., "Holder spike detected: 60% growth in 24h").
* **DECISION SUPPORT**: Actionable trader advice based on simulated impact (e.g., "Exiting a $50K position causes 6.8% slippage").

### Batch Data vs. Authoritative Truth
* **Imprecise Wallet Ledgers**: Elevator Scan's wallet balances are derived from the local transaction batch. Deep Scan treats these balances strictly as *local observations* rather than absolute on-chain holder balances.
* **Exclusion of Contract Addresses**: To prevent system routing addresses (DEX pairs, router contracts) from skewing whale metrics, Deep Scan must run them through the bytecode check filter before running simulations.

---

## 13. Trader Decision Mapping
Every P0 capability maps directly to a concrete trader decision:

| Capability | Trader Decision Supported |
|:---|:---|
| Constant-product simulation | **Position Sizing**: "How large can my order be before price impact ruins my execution?" |
| Exit risk simulation | **Risk Mitigation**: "Can I enter this token if the top 3 holders can trigger a 40% price drop?" |
| HHI concentration | **Execution Safety**: "Is this volume organic demand or wash trading manipulation?" |
| Whale accumulation signals | **Trend Trading**: "Are whales buying up tokens, indicating a potential breakout?" |
| Buyer quality score | **Momentum Legitimacy**: "Is the price rise backed by strong retail wallets or snipers?" |
| Regime classification | **Strategy Selection**: "Should I buy the breakout or avoid entering due to distribution?" |

---

## 14. Anti-Duplication Rules

| Proposed Feature | Basic/Elevator Status | Deep Scan Boundary | Classification |
|:---|:---|:---|:---|
| Pool lookup | Basic and Elevator fetch pool details. | Deep consumes the pool lists directly from the cache to calculate fragmentation. | **SHARED PRIMITIVE** |
| Wash trading | Elevator flags round-trips. | Deep parses multi-wallet coordinate rings and volume HHI. | **REUSE + EXPAND** |
| Top holder listing | Elevator lists balances in batch. | Deep runs exit simulations against AMM constant-product curves. | **REUSE + EXPAND** |
| Spot price / Valuations | Basic fetches spot price. | Deep uses the spot price to calculate MC/Liquidity ratios. | **SHARED PRIMITIVE** |

---

## 15. Anti-TokenSniffer Boundary
Deep Scan deliberately ignores and delegates:
* **No Contract Audits**: Does not parse bytecode for ownership renounce or reentrancy vectors.
* **No Honeypot Checks**: Relies entirely on GoPlus and Honeypot.is outputs from Basic Scan.
* **No Raw Price charts**: Avoids rendering static candles; focuses strictly on Z-scores and regime categories.
* **No Price Predictions**: Does not predict future price targets.

---

## 16. Deep Scan Core
The absolute core MVP of Deep Scan consists of:
1. **AMM Position Slippage Simulation**: Simulating execution impact for size arrays ($1K–$100K).
2. **Whale Exit Risk Simulation**: Simulating the effect of whale exit sell-offs.
3. **Volume HHI concentration**: Categorizing volume legitimacy.
4. **Weighted Explainable Risk Score**: Integrating all metrics into a consolidated index.
5. **AI narrative report**: A concise trader summary citing specific hashes and reserves.

---

## 17. Deferred Capabilities
The following capabilities will not block the initial Deep Scan implementation:
* **Module 5 (Smart Money)**: Deferred to P2 due to Dune/Covalent dependency.
* **Module 10 (Live WebSockets)**: Deferred to P2 due to persistent service requirements.

---

## 18. Open Questions / Unknowns
* **Supabase RPC limits**: The execution boundaries and throughput limits of `deduct_credits_for_scan` are `UNKNOWN` (internal to Supabase).
* **Indexer availability**: Availability and rate limits of Dune/Covalent API keys are `UNKNOWN` (requires a platform config decision).
* **Deep Scan Credit Cost**: The price of running a Deep Scan has not been determined in the product roadmap.

---

## 19. Final Scope Contract

### Deep Scan MUST build:
* Constant-product AMM slippage simulators ($1K–$100K position price impacts).
* Whale position exit simulators (10%, 25%, 50% liquidation scenarios).
* Volume concentration Herfindahl-Hirschman Indices (HHI).
* Dynamic whale classification and phase trackers (accumulation/distribution).
* Buyer quality profiling engine (age, returning frequency).
* Capital efficiency MC/Liquidity ratio metrics.
* Explainable risk scoring (0-100 index) and evidence index mappings.
* AI narrative generator (citing reserves, hashes, and specific indicators).

### Deep Scan MAY build later:
* Shared funding wallet clustering and coordinated sniper analysis (P1).
* Multi-DEX liquidity mapping (fragmentation index and routing efficiency) (P1).
* Historical cycle drawdown speed and pump-to-dump patterns (P1).
* Cross-token smart money tracking (P2).
* Real-time websocket live monitors (P2).

### Deep Scan MUST NOT build:
* Smart contract security scanners or reentrancy checks.
* Honeypot simulations or buy/sell tax calculators.
* Independent block log/transaction crawlers (uses Elevator collector output).
* Multi-hop router aggregators.
* Centralized exchange hot wallet address directories.

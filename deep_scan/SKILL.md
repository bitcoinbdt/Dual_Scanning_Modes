# Skill: Trader On-Chain Trading Intelligence Engine (Deep Scan)

## 1. Skill Identity
* **Name**: Deep Scan (On-Chain Trading Intelligence Engine)
* **Type**: Advanced Blockchain Data Engineering & Market Intelligence Skill
* **Domain**: Decentralized Finance (DeFi), On-Chain Analytics, Algorithmic Risk Assessment, Wallet Behavior Profiling
* **Target Audience**: Active Crypto Traders, Liquidity Providers, On-Chain Analysts

---

## 2. Purpose
The Deep Scan skill converts raw blockchain ledger entries into actionable, evidence-supported trader intelligence. It determines the underlying drivers of a token's price, the health and behavior of its trading cohorts, the stress-limits of its liquidity, and the structural risks inherent in its market regime. 

This engine does **not** simply inspect contract bytecodes for standard vulnerabilities (e.g., reentrancy, honeypots), nor is it a TokenSniffer clone. Its goal is to answer:
* **Who** is trading the token?
* **Why** is the price moving? Is the momentum organic?
* **Where** is the real versus fragile liquidity located?
* **What** are whales and historical "Smart Money" wallets doing?
* **How** vulnerable is the market structure to position exits or capital efficiency changes?

---

## 3. Scope
The scope of this skill covers read-only scanning, monitoring, and analysis of EVM-compatible tokens (and future non-EVM integrations) across decentralized exchanges (DEXs). It aggregates data from multiple blocks, indices, explorer APIs, and order books, feeding them into 15 logical modules to generate an evidence-first risk evaluation.

---

## 4. Core Principles
1. **Evidence Over Assumptions**: Every signal or risk claim must map directly to verifiable facts and calculated metrics.
2. **Trader-Centric Context**: Frame all conclusions around liquidity depth, exit impact, and capital flow sensitivity.
3. **No Fabrication**: If a metric cannot be calculated due to missing history or block gaps, classify it as `UNKNOWN` or `INSUFFICIENT DATA`.
4. **Behavioral Wallet Clustering**: Look for wallet relationships based on shared funding nodes, timing correlation, and transaction vectors, without making absolute ownership claims unless cryptographically proven.
5. **Multi-Horizon Analysis**: Analyze snapshots across multiple timeframes (5m, 15m, 1h, 4h, 24h, 7d, 30d) to detect shifting regimes.
6. **Strict Read-Only Execution**: Never request private keys, interact with write methods, or execute trades.

---

## 5. Input Specification
The execution of a scan requires a structured input schema conforming to the following parameters:
* **`token_address`** (String, Required): Hexadecimal contract address of the target token.
* **`network`** (String, Required): Blockchain network identifier (e.g., `ethereum`, `arbitrum`, `base`, `solana`).
* **`simulated_position_sizes`** (Array of Numbers, Optional): Custom dollar values to evaluate in liquidity stress tests. Defaults: `[1000, 5000, 10000, 25000, 50000, 100000]`.
* **`timeframe`** (String, Optional): Lookback window for trend analysis (default: `24h`).
* **`use_cache`** (Boolean, Optional): Enable/disable cache retrieval for historical data (default: `true`).

---

## 6. Data Requirements
For a complete scan, the engine requires ingestion of three distinct layers of data:
1. **Contract & Pool Metadata**: Token name, symbol, decimals, total supply, creator address, and verified pool addresses (AMM contract pairs).
2. **DEX Liquidity Reserves**: Reserves of Token A and Token B in AMM pools, swap event streams, fee tiers, and routing arrays.
3. **Transaction History**: Transfer events, swap logs, block timestamps, sender/receiver addresses, and gas fees paid.

---

## 7. Analysis Pipeline
The scanner executes sequentially through these stages:
```
[Token Address Input]
         ↓
1. Validate Address & Chain
         ↓
2. Fetch Metadata & AMM Pools
         ↓
3. Extract Transfer & Swap Event Logs
         ↓
4. Build Wallet Graph & Cohorts
         ↓
5. Execute 15 Analytical Modules
         ↓
6. Generate Evidentiary Audit Trail
         ↓
7. Compute Weighted Risk Scores
         ↓
8. Synthesize Trader Intelligence Report
```

---

## 8. The 15 Intelligence Modules

### Module 1: Wallet Quality Analysis
* **Objective**: Identify the organic or coordinated nature of token holders and traders.
* **Required Data**: Transfer events, ERC-20 creator transactions, gas funding transactions.
* **Data Sources**: Explorer APIs, indexed block databases.
* **Inputs**: Wallet address list, transaction history.
* **Processing Logic**: Analyze the age of trading wallets, first block activity, token entry blocks, holding durations, and funding sources. Detect if multiple holders are funded by the same central wallet or exchange hot-wallet sub-account.
* **Metrics**: Wallet Age Distribution, Shared Funding Ratio, Coordinated Buy Blocks.
* **Detection Logic**: High percentage of fresh wallets (< 24h old) funded by a single external source buying in the same blocks indicates coordinated or sniper behavior.
* **Output Schema**: Lists of clusters, shared funding nodes, and age distribution metrics.
* **Evidence Requirements**: Transaction hashes linking funding to wallets.
* **Confidence Calculation**: Proportional to the number of correlated criteria (funding, timing, size).
* **Failure Conditions**: RPC lookup timeouts on transfer events.
* **Data Limitations**: Anonymizing bridges (Tornado Cash) obscure funding sources.

### Module 2: Organic Price Movement Analysis
* **Objective**: Determine if price momentum is supported by broad market demand.
* **Required Data**: Swap logs, unique sender/receiver metrics, trading volume.
* **Data Sources**: DEX Indexing APIs (DexScreener, GeckoTerminal, Subgraphs).
* **Inputs**: Price feed, transaction-level swap volumes.
* **Processing Logic**: Compare volume growth against the rate of unique buyer growth. Identify if a small cohort of wallets is cycling volume (wash trading).
* **Metrics**: Buy/Sell Volume Ratio, Unique Buyer count, Volume Concentration HHI (Herfindahl-Hirschman Index).
* **Detection Logic**: Divergence where price rises on high volume but unique buyers decline, indicating volume concentration.
* **Output Schema**: Volume concentration metrics, buyer count trends, buy/sell ratios.
* **Evidence Requirements**: Transaction counts and volume distribution by wallet.
* **Confidence Calculation**: Determined by the completeness of the swap history window.
* **Failure Conditions**: API rate limits preventing complete fetch of swap logs.
* **Data Limitations**: Off-chain matchers or aggregated routers can obfuscate individual swap events.

### Module 3: Liquidity Stress Test
* **Objective**: Estimate price impact and execution pricing for key position sizes.
* **Required Data**: AMM Pool reserves, contract fee structures.
* **Data Sources**: Directly queried RPC pool states.
* **Inputs**: Custom position sizes (default $1K - $100K).
* **Processing Logic**: Apply constant product formula $x \times y = k$ adjusted for fee rates ($1 - \text{fee}$) to simulate state updates for swap paths.
* **Metrics**: Price Impact (%), Slippage (%), Liquidity Utilization, Executable Price.
* **Detection Logic**: Highlight when a simulated size consumes more than 10% of active reserves.
* **Output Schema**: Simulation array with size, price impact, and exit difficulty flag.
* **Evidence Requirements**: Current pool reserve states and fee properties.
* **Confidence Calculation**: 100/100 for Uniswap V2; lower for V3 concentration ranges if active tick bounds are volatile.
* **Failure Conditions**: Failure to fetch target pool reserves.
* **Data Limitations**: Multi-hop routing pathways might dynamically change during execution.

### Module 4: Whale Behavior Analysis
* **Objective**: Monitor activity of largest holders without fixed arbitrary thresholds.
* **Required Data**: Complete holder ledger snapshot.
* **Data Sources**: Node RPCs, token indexes.
* **Inputs**: Holder balances.
* **Processing Logic**: Dynamically calculate the "Whale Threshold" as any wallet holding $> 1\%$ of circulating supply or controlling $> 5\%$ of executable liquidity. Track transfers, accumulation, and distribution phases.
* **Metrics**: Whale Supply Share (%), Net Whale Inflow/Outflow.
* **Detection Logic**: Whales actively moving tokens to DEX pools or selling into the order book.
* **Output Schema**: Whale classification categories, net position changes.
* **Evidence Requirements**: Balance change logs of addresses identified as whales.
* **Confidence Calculation**: High if full distribution history is available.
* **Failure Conditions**: Large token contracts failing to return complete holder lists due to timeout.
* **Data Limitations**: Split wallets under coordinated control may bypass individual thresholds.

### Module 5: Smart Money Detection
* **Objective**: Track wallets with historical trading success in the same token class.
* **Required Data**: Historical address trading ledger across multiple tokens.
* **Data Sources**: Indexed on-chain transaction data.
* **Inputs**: Wallet address trade histories.
* **Processing Logic**: Analyze historical ROI, trade win rates, early entry frequencies, and average holding periods.
* **Metrics**: Historical ROI (%), Realized PnL, Win Rate (%).
* **Detection Logic**: Identify if wallets with $>60\%$ win rate and multiple profitable trades are entering the token.
* **Output Schema**: Smart money positions, flow direction (Entry/Accumulation/Exit).
* **Evidence Requirements**: Tx hashes of previous successful trades by the same addresses.
* **Confidence Calculation**: Scaled by the number of historic trades tracked (minimum 10 trades required).
* **Failure Conditions**: Lack of historic cross-token transaction index.
* **Data Limitations**: Smart money wallets rotate addresses frequently to avoid tracking.

### Module 6: Buyer Quality Analysis
* **Objective**: Evaluate the quality and maturity of incoming buyer demand.
* **Required Data**: Buyer transaction history, funding wallets, wallet age.
* **Data Sources**: Indexed blockchain logs.
* **Inputs**: Buyer addresses from the last 24h.
* **Processing Logic**: Calculate the proportion of returning buyers vs. one-time buyers, average wallet ages, and capital diversity.
* **Metrics**: Buyer Quality Score, New Buyer Ratio, Capital Diversity Index.
* **Detection Logic**: High proportion of fresh, single-use, poorly-funded wallets signals low quality.
* **Output Schema**: Score (0-100), positive factors list, negative factors list.
* **Evidence Requirements**: Statistics on wallet age and transaction count.
* **Confidence Calculation**: Dependent on volume captured in the analyzed period.
* **Failure Conditions**: RPC failure to retrieve historical sender attributes.
* **Data Limitations**: Exchanges batching withdrawals might make distinct buyers look similarly funded.

### Module 7: Exit Risk Analysis
* **Objective**: Model potential sell pressure against executable liquidity.
* **Required Data**: Holder balance distribution, AMM pool reserves.
* **Data Sources**: Explorer indexers, RPC nodes.
* **Inputs**: Scenarios (Conservative, Moderate, Aggressive).
* **Processing Logic**: Simulate top holders selling 10%, 25%, or 50% of their positions, and map this volume against the pool's constant product liquidity curve.
* **Metrics**: Executable Liquidity Ratio, Exit Impact Score.
* **Detection Logic**: A 10% sell by top 3 holders causing $>30\%$ price drop indicates extreme exit risk.
* **Output Schema**: Scenario tables with simulated price outcomes.
* **Evidence Requirements**: Pool reserves and holder distribution statistics.
* **Confidence Calculation**: High, based directly on mathematical AMM modeling.
* **Failure Conditions**: Empty or unmapped liquidity pools.
* **Data Limitations**: Does not account for sudden external liquidity additions (backstops).

### Module 8: Market Regime Detection
* **Objective**: Classify the token's trading phase.
* **Required Data**: Price, volume, buyer counts, capital flow.
* **Data Sources**: Market aggregation feeds, subgraphs.
* **Inputs**: Historical price/volume series.
* **Processing Logic**: Categorize price-volume relationships to determine if the token is in: `ACCUMULATION`, `BREAKOUT`, `MOMENTUM`, `DISTRIBUTION`, `LIQUIDITY EXIT`, `DEAD`, or `RECOVERY`.
* **Metrics**: Price/Volume Slope, Volatility Z-Score.
* **Detection Logic**: Increasing volume with flat price = Accumulation. Decreasing price with decreasing liquidity = Liquidity Exit.
* **Output Schema**: Identified regime, transition direction, confidence.
* **Evidence Requirements**: Price/volume charts and trend calculations.
* **Confidence Calculation**: Weighted by data duration and consistency across parameters.
* **Failure Conditions**: Insufficient historical price/volume feed.
* **Data Limitations**: Manipulation/wash trading can simulate fake breakout regimes.

### Module 9: Top Risk Detection
* **Objective**: Synthesize all anomalies into the top 3-5 critical risks.
* **Required Data**: Output data from Modules 1-8.
* **Data Sources**: Module outputs.
* **Inputs**: Analytical metrics.
* **Processing Logic**: Compare the severity and confidence of detected risks across all modules and rank them.
* **Metrics**: Severity Rank, Risk Index.
* **Detection Logic**: High severity risks like "Smart Money Exit" or "Fragile Liquidity" are bubbled to the top.
* **Output Schema**: Array of top risk objects (Name, Severity, Evidence, Confidence).
* **Evidence Requirements**: Cross-referenced data from source modules.
* **Confidence Calculation**: Combined average of source module confidence.
* **Failure Conditions**: Critical failure in dependent modules.
* **Data Limitations**: Limited by the granularity of upstream modules.

### Module 10: Live Risk Monitoring
* **Objective**: Detect real-time updates and anomalies after the baseline scan.
* **Required Data**: Mempool data, recent block events.
* **Data Sources**: Live RPC node websockets, event listeners.
* **Inputs**: Target contract addresses and pool filters.
* **Processing Logic**: Continuously stream and check incoming swaps/transfers against baseline thresholds.
* **Metrics**: Block-by-block volume spikes, large transfers.
* **Detection Logic**: Sudden large sell order or liquidity withdrawal in a single block.
* **Output Schema**: Real-time event notifications.
* **Evidence Requirements**: Transaction hash of the triggering live event.
* **Confidence Calculation**: High (verifiable single-event confirmations).
* **Failure Conditions**: Websocket connection loss.
* **Data Limitations**: Reorgs can modify block events slightly post-facto.

### Module 11: Multi-DEX Liquidity Mapping
* **Objective**: Map liquidity locations and fragmentation.
* **Required Data**: Pool addresses across DEXs (Uniswap, Sushiswap, Balancer, etc.).
* **Data Sources**: DEX Factory contracts, block indexes.
* **Inputs**: Token contract address.
* **Processing Logic**: Query factory contracts for pairs containing the token. Calculate reserves and volume per pair.
* **Metrics**: Total Liquidity, Liquidity Fragmentation Index, Largest Pool Share (%).
* **Detection Logic**: High fragmentation across 5 pools may cause inefficient routing and high slippage unless aggregated.
* **Output Schema**: Map of pools, reserves, and shares.
* **Evidence Requirements**: Factory contract queries and pool reserve snapshots.
* **Confidence Calculation**: Directly tied to successful contract reads.
* **Failure Conditions**: Unindexed factories or custom non-standard AMM pools.
* **Data Limitations**: Private or off-chain liquidity sources cannot be mapped.

### Module 12: Capital Efficiency Analysis
* **Objective**: Evaluate price sensitivity to inflows/outflows.
* **Required Data**: Circulating supply, price, AMM reserves.
* **Data Sources**: CoinGecko, GeckoTerminal, RPC.
* **Inputs**: Circulating supply, reserve metrics.
* **Processing Logic**: Compute Market Cap / Liquidity ratio. Estimate the "multiplier effect" (how much price moves per dollar of net flow).
* **Metrics**: Market Cap / Liquidity Ratio, Capital Sensitivity (Low/Medium/High).
* **Detection Logic**: Ratio > 50x indicates extreme sensitivity to capital inflows/outflows.
* **Output Schema**: Capital efficiency rating, ratio, description.
* **Evidence Requirements**: Fully Diluted Valuation (FDV) and total liquidity reserves.
* **Confidence Calculation**: Calculated from reserve verify status.
* **Failure Conditions**: Missing circulating supply data.
* **Data Limitations**: Dynamic lockups/vesting contracts distort circulating supply calculations.

### Module 13: Historical Behavior Analysis
* **Objective**: Find behavioral patterns from past cycles.
* **Required Data**: Long-term price, volume, and holder metrics.
* **Data Sources**: Historic price databases, archive nodes.
* **Inputs**: Price/Volume histories.
* **Processing Logic**: Identify previous pump/dump cycles, average drawdowns, and typical distribution timeframes.
* **Metrics**: Average Drawdown (%), Distribution Speed (Days).
* **Detection Logic**: Match current volume/price behavior to past distribution signatures.
* **Output Schema**: Historic cycle summaries, recurring pattern matches.
* **Evidence Requirements**: Historical chart coordinates.
* **Confidence Calculation**: Based on historical sample sizes.
* **Failure Conditions**: Token age < 7 days (insufficient history).
* **Data Limitations**: Past behavior is not a guarantee of future outcomes.

### Module 14: Explainable Risk Scoring
* **Objective**: Generate clear, decomposed risk metrics.
* **Required Data**: All module outputs.
* **Data Sources**: All modules.
* **Inputs**: Sub-scores from other modules.
* **Processing Logic**: Apply weighted arithmetic average of sub-scores, subtracting positive mitigators.
* **Metrics**: Overall Risk Score (0-100), Sub-scores.
* **Detection Logic**: A token with low liquidity and high whale distribution receives a high overall risk score.
* **Output Schema**: Detailed score breakdown, weights, and evidence trails.
* **Evidence Requirements**: Sub-score values.
* **Confidence Calculation**: Function of the combined confidence of sub-modules.
* **Failure Conditions**: Missing crucial sub-scores.
* **Data Limitations**: Scoring weights must be periodically adjusted to fit market changes.

### Module 15: Evidence-Based Trader Intelligence
* **Objective**: Compile the ultimate actionable trader report.
* **Required Data**: Outputs from Modules 1-14.
* **Data Sources**: All modules.
* **Inputs**: Consolidated scan dataset.
* **Processing Logic**: Summarize conclusions into a concise narrative, answering "Who, Why, Where, and What." Highlight evidence and limitations.
* **Metrics**: Overall Confidence Score.
* **Detection Logic**: Cross-examine signals to resolve conflicting observations.
* **Output Schema**: Comprehensive structured markdown report and API JSON response.
* **Evidence Requirements**: Reference indices for all facts stated.
* **Confidence Calculation**: System-wide average confidence.
* **Failure Conditions**: Inability to construct a cohesive summary.
* **Data Limitations**: Stale or missing API data is clearly flagged.

---

## 9. Evidence Rules
To prevent unsupported AI statements, every key finding must adhere to the **Evidence Chain**:
1. **FACT**: A specific, immutable data point (e.g., "Wallet `0x3a...` sold 50,000 tokens at block `218491`").
2. **METRIC**: Calculated value expressing significance (e.g., "This sale accounted for 42% of the hour's volume").
3. **PATTERN**: Relationship to historical baselines (e.g., "This wallet has cleared its position 3 times before prior to corrections").
4. **SIGNAL**: System inference (e.g., "Distribution pressure is accelerating").
5. **TRADER IMPACT**: Meaningful outcome (e.g., "Traders entering now face high immediate price impact risk").

---

## 10. Confidence Rules
Signals must be assigned a confidence rating on a scale of **0-100**, calculated based on:
$$\text{Confidence} = w_1 \cdot \text{Data Freshness} + w_2 \cdot \text{Sample Size} + w_3 \cdot \text{Source Quality}$$
* **High Confidence (80-100)**: Complete on-chain transaction traces directly from RPC nodes.
* **Medium Confidence (50-79)**: Reliance on cached indexer APIs with minor latencies.
* **Low Confidence (0-49)**: Insufficient or fragmented data, unverified pools, or short lifespan.

---

## 11. Data Quality Rules
* Prior to processing, the engine must execute validation checks:
  1. Validate address format (Regex check for EVM address).
  2. Query token decimals and symbol via basic ERC-20 `read` methods.
  3. Validate active price feed discrepancy (limit differences between sources to $< 2\%$).
* Stale data (last update $> 10$ minutes ago) must flag a warning.

---

## 12. Error Handling & Partial Failures
* **Graceful Degradation**: If an external API provider is rate-limited, the engine continues processing with RPC nodes and returns a status of `PARTIAL_ANALYSIS`.
* Failed modules are flagged in the `limitations` array with their exact error reason, ensuring the user is aware of what couldn't be checked.

---

## 13. Security Rules
* **Strict Read-Only Mode**: The code contains no capability to request user keys, import private credentials, or execute state-changing transactions.
* **Address Sanitization**: All address inputs are lowercased and verified to prevent injection attacks or path manipulation in cache directories.

---

## 14. Privacy Rules
* No tracking of user wallets or IP addresses is performed.
* Calculations are executed server-side or locally without shipping trade data to third-party AI endpoints except for pure, anonymized numeric signal analysis.

---

## 15. Output Specification
The final result must return both a structured JSON response (matching `schemas/scan_output.json`) and a clean markdown report formatted for fast reading by active traders.

---

## 16. AI Reasoning Rules
* **Data-First**: The AI model interpreting the output must not write narratives without citing the specific metrics and hashes.
* **Separation of Concerns**: Keep facts isolated from interpretations.
* **Regime Consistency**: Ensure the described market regime aligns with the volume and price metrics shown.

---

## 17. No-Fabrication Rules
* Never hallucinate wallet names (e.g., do not call a wallet "Binance Deployer" unless verified by known public label directories).
* Never fake transaction histories or fill empty metrics with arbitrary values. Use `UNKNOWN`.

---

## 18. Trader-Centric Language Rules
* Prefer objective risk descriptors:
  * "Distribution pressure is accelerating."
  * "Exit risk is elevated due to concentration."
  * "Liquidity depth is thin relative to position size."
* Avoid emotional or predictive hype:
  * "This token is going to pump/dump."
  * "100% safe."
  * "Guaranteed 10x."

---

## 19. Architecture
The Deep Scan skill is structured as a modular collection of specifications, prompt templates, and schema configurations. It operates as an engine within the broader parent scanner framework, isolating trading analytics from standard smart contract auditing.

---

## 20. Success Criteria
* Successful generation of the full schema-compliant output report for any verified ERC-20 token address.
* Mathematical validation of constant-product slippage predictions matching actual pool calculations within $\pm 0.5\%$.
* Complete evidentiary tracing where every score has at least one associated `evidence` node.

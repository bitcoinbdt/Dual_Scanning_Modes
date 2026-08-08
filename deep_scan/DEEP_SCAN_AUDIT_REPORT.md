# Deep Scan Architecture Audit

## 1. Executive Summary
This document provides a comprehensive technical audit of the **Deep Scan (Trader On-Chain Trading Intelligence Engine)** foundation package. 
Overall, the Deep Scan design represents a highly valuable, trader-centric intelligence system that shifts the focus from static contract code security (e.g., TokenSniffer) to dynamic, behavior-driven, on-chain liquidity and wallet flows. 

However, the audit has identified several **CRITICAL** and **HIGH** severity discrepancies and feasibility gaps:
1. **Schema Mismatch**: The final report output schema (`scan_output.json`) is missing properties for five active analytical modules (including `historical_behavior`, `dex_liquidity`, `risk_scoring`, and `market_regime`).
2. **Data Feasibility Blocker**: Profiling "Smart Money" wallets (requiring win rate and realized ROI calculations across $\ge 5$ past tokens) in real-time is impossible via simple RPC nodes or standard block explorer APIs. It requires massive cross-token historical indexing databases (e.g. Covalent, Dune API, or Dune/Nansen queries).
3. **Solana vs. EVM Abstraction Gaps**: The event log mapping and pool reserve structures assume EVM patterns (`getReserves` or standard ERC-20 `Swap` log topics), while Solana's account-based model is fundamentally different and lacks proper normalization detail.

The system is classified as **EARLY DESIGN / PARTIALLY READY** and requires key adjustments to schemas and data-sourcing models before implementation.

---

## 2. Current Architecture
The current codebase is a self-contained blueprint comprised of:
* **`SKILL.md`**: The master operating instructions detailing system inputs, pipelines, 15 modules, and safety rules.
* **`README.md`**: Directory overview and navigational linkages.
* **`architecture/`**: Standard diagrams outlining the Coordinator orchestrating caches, RPC/API queries, module evaluations, and report compilers.
* **`data/`**: Normalization rules, freshness metrics, caching limits, and provider fallback rankings.
* **`prompts/`**: Prompt configuration templates directing the AI agent personas in system, analysis, and report phases.
* **`schemas/`**: JSON Schema specifications enforcing inputs, outputs, transactions, and signals.
* **`modules/`**: Fifteen individual module files defining specific goals, mathematics, outputs, and constraints.

---

## 3. File Inventory

| File | Purpose | Role | Dependencies | Inputs | Outputs | Referenced By | References | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SKILL.md` | Canonical specification | Master guide | None | User Address | Report structure | README.md | All modules | Complete |
| `README.md` | Navigation & Index | Hub | None | None | None | None | All files | Complete |
| `architecture/system_architecture.md` | Components diagram | Structural | Mermaid GFM | None | Block layout | README.md | None | Complete |
| `architecture/data_flow.md` | Processing sequence | Pipeline | Mermaid GFM | None | Data stages | README.md | None | Complete |
| `architecture/agent_workflow.md` | AI agent decision loops | Orchestration | None | Data metrics | Resolution path | README.md | None | Complete |
| `data/data_sources.md` | API/RPC provider hierarchy | Integration | None | Request type | Selected provider | README.md | None | Complete |
| `data/normalization.md` | Data formatting | Standards | None | Raw data | Schema output | README.md | None | Complete |
| `data/freshness.md` | Latency thresholds & TTL | Cache control | None | Age of record | Stale flag | README.md | None | Complete |
| `prompts/system_prompt.md` | AI core identity | Persona | None | User input | Safe reasoning | README.md | None | Complete |
| `prompts/analysis_prompt.md` | Module-level AI logic | Formatting | None | Module data | FACT-to-IMPACT | README.md | None | Complete |
| `prompts/report_prompt.md` | Final report structure | Output layout | None | Module inputs | Consolidated report | README.md | None | Complete |
| `schemas/scan_input.json` | Validate API params | Validation | Draft-07 | JSON input | Boolean valid | README.md | None | Complete |
| `schemas/scan_output.json` | Validate output payload | Validation | Draft-07 | JSON output | Boolean valid | README.md | `risk_signal`, `evidence` | Needs Update |
| `schemas/evidence.json` | Evidentiary nodes | Sub-schema | Draft-07 | Analysis logs | Valid evidence | `scan_output` | None | Complete |
| `schemas/wallet.json` | Wallet behavior profiles | Sub-schema | Draft-07 | Ledger trace | Valid wallet | `scan_output` | None | Complete |
| `schemas/transaction.json` | Swap & transfer standard | Sub-schema | Draft-07 | Raw tx data | Valid transaction | `scan_output` | None | Complete |
| `schemas/liquidity.json` | Multi-pool reserves | Sub-schema | Draft-07 | RPC states | Valid reserves | `scan_output` | None | Complete |
| `schemas/risk_signal.json` | Risk item description | Sub-schema | Draft-07 | Score indicators | Valid risk item | `scan_output` | None | Complete |
| `modules/wallet_quality.md` | Co-funding & sniper flags | Analysis | `wallet.json` | Transfer events | Cluster records | `SKILL.md` | None | Complete |
| `modules/organic_price.md` | Wash trading checks | Analysis | None | Swap logs | Concentration index| `SKILL.md` | None | Complete |
| `modules/liquidity_stress.md` | Slippage simulations | Analysis | `liquidity.json` | Reserves & fee | Position impact array| `SKILL.md` | None | Complete |
| `modules/whale_behavior.md` | Large holder tracks | Analysis | None | Balance list | Net whale flow | `SKILL.md` | None | Complete |
| `modules/smart_money.md` | ROI profit profiling | Analysis | `wallet.json` | Active traders | Net smart money flow| `SKILL.md` | None | Complete |
| `modules/buyer_quality.md` | Demand quality profiling | Analysis | `wallet.json` | 24h buyers | Quality score | `SKILL.md` | None | Complete |
| `modules/exit_risk.md` | Top holder sell simulation | Analysis | `liquidity.json` | Holder supply | Price impact delta | `SKILL.md` | None | Complete |
| `modules/market_regime.md` | Classification logic | Analysis | None | Historical prices | Active regime | `SKILL.md` | None | Complete |
| `modules/top_risks.md` | Key risks ranking | Analysis | `risk_signal.json` | Module inputs | Prioritized risks | `SKILL.md` | None | Complete |
| `modules/live_monitoring.md` | Websocket triggers | Analysis | None | Event streams | Alert queue | `SKILL.md` | None | Complete |
| `modules/dex_liquidity.md` | Cross-pool mapping | Analysis | `liquidity.json` | Factory query | Total liquidity pool| `SKILL.md` | None | Complete |
| `modules/capital_efficiency.md` | Sensitivity multipliers | Analysis | None | Supply & price | Sensitivity grade | `SKILL.md` | None | Complete |
| `modules/historical_behavior.md`| Cycle drawdowns | Analysis | None | Chart series | Drawdown stats | `SKILL.md` | None | Complete |
| `modules/risk_scoring.md` | Unified score engine | Analysis | None | Sub-scores | Weighted overall score| `SKILL.md` | None | Complete |
| `modules/trader_intelligence.md`| Consolidated summaries | Analysis | `scan_output.json`| Integrated stats| Synthesis markdown | `SKILL.md` | None | Complete |

---

## 4. SKILL.md Assessment

### 4.1 Strong Parts
* **Persona Definition**: Clearly frames the scanner's focus around trader indicators (capital efficiency, liquidity depth, price impact) rather than static vulnerability audits.
* **Evidentiary Standard**: The requirement for FACT -> METRIC -> PATTERN -> SIGNAL -> IMPACT enforces logical consistency and prevents generalized AI hallucination.
* **Execution Boundary**: Strictly limits the engine to read-only capabilities, prohibiting private key access or write-actions.

### 4.2 Weak Parts
* **Solana Details**: Mentions Solana support in input validators but defines processing pipelines and logs based heavily on EVM structures.
* **Staking Pool Exclusions**: The definition of circulating supply vs. total supply in Module 12 lacks specific algorithms to identify on-chain locking contracts, causing distorted ratios if locked tokens are treated as liquid.

### 4.3 Missing Parts
* **API Providers for Smart Money**: While it mentions free/low-cost fallbacks, it fails to state which free providers can handle the massive cross-token historical trade checks required by Module 5.

### 4.4 Status
* **Partially Complete**: Master specifications are complete for design, but detail on non-EVM compatibility is ambiguous.

---

## 5. 15 Module Scorecard

| # | Module | Score | Status | Key Issue | Severity |
| :- | :--- | :---: | :--- | :--- | :--- |
| 1 | Wallet Quality Analysis | 2 | Adequate | Centralized exchange hot wallets create false co-funding clusters. | MEDIUM |
| 2 | Organic Price Movement | 2 | Adequate | MEV sandwich cycles can be misidentified as wash trading. | MEDIUM |
| 3 | Liquidity Stress Test | 3 | Strong | Excellent constant-product slippage modeling. | INFO |
| 4 | Whale Behavior Analysis | 3 | Strong | Dynamic thresholds scaling with pool reserves are superior to static numbers. | INFO |
| 5 | Smart Money Detection | 1 | Weak | **Direct RPC/Explorer queries cannot profile cross-token wallet history.** | CRITICAL |
| 6 | Buyer Quality Analysis | 2 | Adequate | Trading bots skew wallet age statistics. | LOW |
| 7 | Exit Risk Analysis | 3 | Strong | Mathematical models are clean and realistic. | INFO |
| 8 | Market Regime Detection | 2 | Adequate | Highly dependent on accurate smart money indices. | MEDIUM |
| 9 | Top Risk Detection | 2 | Adequate | Prioritization math requires initial weighting tuning. | LOW |
| 10| Live Risk Monitoring | 1 | Weak | Reorgs and block latencies are not mapped out in flow. | HIGH |
| 11| Multi-DEX Liquidity Mapping| 3 | Strong | Clean factory registry search pipeline. | INFO |
| 12| Capital Efficiency Analysis| 2 | Adequate | Circulating supply verification is ambiguous on locked tokens. | MEDIUM |
| 13| Historical Behavior | 2 | Adequate | Patterns limited by token age and chart availability. | LOW |
| 14| Explainable Risk Scoring | 2 | Adequate | Weight allocation details require dynamic tuning. | LOW |
| 15| Evidence-Based Synthesis | 3 | Strong | Consolidated report template is highly structured. | INFO |

---

## 6. Module Dependency Graph

### 6.1 Dependency Map
```text
[Raw Blockchain RPC / Aggregators]
         │
         ├──► [Module 11: Multi-DEX Liquidity Mapping] ──────┐
         │                                                   │
         ├──► [Module 1: Wallet Quality Analysis] ───┐       │
         │                                           ▼       ▼
         ├──► [Module 4: Whale Behavior] ──────► [Module 7: Exit Risk Analysis]
         │                                                   │
         ├──► [Module 5: Smart Money] ──┐                    ▼
         │                              ▼       [Module 14: Explainable Risk Scoring]
         └──► [Module 2: Organic Price] ┴────────► [Module 8: Market Regime]
                                                             │
                                                             ▼
                                                [Module 15: Trader Intelligence]
```

### 6.2 Sequential vs. Parallel Execution
* **Parallel Ingest Group**: Modules 1, 2, 4, 5, 11, 12, and 13 can execute concurrently as they rely on independent datasets queryable in parallel.
* **Sequential Blocks**:
  * Module 7 (Exit Risk) *must* execute after Module 4 (Whales) and Module 11 (Liquidity Mapping) are complete.
  * Module 8 (Market Regime) *must* wait for Module 2 (Organic Price) and Module 5 (Smart Money) to resolve.
  * Module 14 (Scoring) and 15 (Synthesis) *must* wait for all upstream calculations to finalize.

### 6.3 Circular / Duplicate Calculations
* Both `organic_price` and `buyer_quality` compute transaction-level concentration HHI indexes. This should be calculated once in the normalization/ingestion stage and shared.

---

## 7. Data Feasibility

### 7.1 Realistically Obtainable Data
* **AMM reserves & spot price**: Highly obtainable. Simple RPC query (`getReserves`) on the active pair.
* **Token metadata & transfers**: Highly obtainable via explorer API or RPC event signatures.
* **Historical price candles**: Obtainable via DexScreener/GeckoTerminal free REST endpoints.

### 7.2 Feasibility Blockers
* **Cross-Token Trade History (Module 5)**: **Blocked under baseline RPC/Explorer setup.** To find if wallet `0xabc` has a $>60\%$ win rate across 5 historical tokens, you must search every swap receipt of that address historically. Explorer transaction listings do not resolve execution PnL or swap pairs easily.
  * *Required Solution*: Integrated indices like Dune API, Nansen API, Covalent, or a local index database tracking swap histories.

---

## 8. Data Source Gaps
* **High Reliance on Explorer APIs**: Explorer APIs (Etherscan, Solscan) have strict free-tier rate limits (5 requests/sec). Simultaneous user queries will quickly choke.
* **Real-time websocket streams**: Standard public RPC nodes do not allow persistent websocket subscriptions or drop connections frequently. High reliability requires dedicated nodes (e.g. Alchemy, QuickNode).

---

## 9. Schema Consistency

### 9.1 Missing Fields in Output Schema (`schemas/scan_output.json`)
The following modules output structured data that is entirely absent from the unified `scan_output.json` definition:
* **`dex_liquidity`**: The schema contains `liquidity_stress` and `capital_efficiency` but is missing the detailed `pools_mapped` output of Module 11.
* **`historical_behavior`**: The fields generated by Module 13 (`ath_usd`, `drawdown_from_ath_pct`, `average_drawdown_pct`) are missing.
* **`risk_scoring`**: The specific sub-score allocations and contributor weights from Module 14 are not defined in `scan_output.json`.
* **`live_monitoring`**: The stream event format is missing.
* **`market_regime`**: The module outputs confidence and transition status, while `scan_output.json` only holds `market_regime` as a primitive string.

### 9.2 Type Mismatches
* `wallet.json` specifies `balance` as a string (representing high-precision wei), while some module templates treat balances as standard numbers, which can lead to overflow errors in execution runtimes.

---

## 10. Prompt Consistency
* **No-Fabrication Constraints**: The prompts in `prompts/system_prompt.md` and `prompts/analysis_prompt.md` align strongly with the rules of `SKILL.md`. Both explicitly instruct the AI to return `UNKNOWN` and avoid predictive price claims.
* **No-Ownership Rule**: `SKILL.md` states: *"Do not claim wallet ownership without strong evidence. Use 'Potentially connected' instead."* `prompts/analysis_prompt.md` correctly repeats this using the identical terminology.

---

## 11. Architecture Problems
* **Single Point of Failure**: The Coordinator system architecture represents a bottleneck. If the cache database write operations lock, the entire scan pipeline freezes.
* **Slow Operations**: Tracing gas funding sources recursively for a buyer cohort of 500 wallets requires 500 individual explorer transactions queries. This takes up to 100 seconds on standard rate-limited explorer endpoints.

---

## 12. Trader Problem Alignment
The system has exceptional alignment with real trader concerns:
* **High Utility**: Simulating price impact at specific positions ($1K - $100K) tells the trader *exactly* what their execution loss will be before they click swap.
* **Low Utility**: General wallet age distribution counts. This is only useful if it directly flags a coordinated sniper cluster. Plain numbers should be filtered.

---

## 13. Anti-TokenSniffer Assessment
The system successfully avoids drifting into a static code scanner:
* **Differentiators**: 13 out of 15 modules are based entirely on dynamic balance modifications, routing arithmetic, and flows rather than contract bytecode pattern matching.
* **Guardrails**: Ensure future integrations of standard explorer metrics (like creator balances or honeypot status) are kept under the `data_quality` check block and do not dilute the trading scoring math.

---

## 14. Evidence & Confidence Audit
* **Evidentiary Trace**: The structure defined in `schemas/evidence.json` enforces `evidence_id`, `fact`, `metric`, and `sources` (list of transaction hashes/blocks), allowing programmatic verification of all AI claims.
* **Confidence Calculation**: Confidence values in the module specs are described conceptually, but lack a coded fallback logic for when inputs are partial.

---

## 15. Mathematical Audit

### 15.1 Constant-Product Swap Equation
$$\Delta y = y \cdot \left(1 - \frac{x}{x + \Delta x \cdot (1 - f)}\right)$$
This formula in `modules/liquidity_stress.md` is mathematically correct and accounts for standard pool swap fees.

### 15.2 Herfindahl-Hirschman Index (HHI)
$$\text{HHI} = \sum_{i=1}^{n} (s_i)^2$$
Where $s_i$ is the fractional volume share. This standard mathematical formula is correctly implemented to verify volume centralization.

---

## 16. Real-Time Feasibility
* **Alert Trigger Latency**: WebSocket listener latency is low, but re-evaluating the full system risk score for every incoming swap is unfeasible.
* **Reorg Handling**: If block reorganizations occur, logs can be deleted. The system must implement a 2-block confirmation delay for monitoring.

---

## 17. Historical Data Feasibility
* **Archive Queries**: Querying historical reserves at block $N$ requires an Archive Node RPC. Standard RPC providers charge a premium for archive queries, creating a cost bottleneck for historical simulations.

---

## 18. Security Audit

### 18.1 Key Vulnerability Classifications
* **API Key Exposure (Severity: Medium)**: Running client-side scans exposes block explorer and RPC keys. Key management must use server-side proxies.
* **Cache Path Poisoning (Severity: Low)**: Token contract address inputs must be sanitized using strict EVM address regex matching before querying local SQLite cache paths to prevent path traversal issues.

---

## 19. Cost Audit
* **RPC Costs (HIGH)**: Reconstructing historical transfer histories requires scanning hundreds of blocks, consuming substantial RPC compute units.
* **AI API Costs (MEDIUM)**: Running system, analysis, and report prompts sequentially for every scan consumes up to 8,000 tokens. This requires prompt optimization or local model caching.

---

## 20. Performance Audit
* **Latency Bottleneck**: Graph traversal of wallet clusters. If the buyer list exceeds 1,000 unique wallets, building the adjacency list takes several seconds.
* **Mitigation**: Execute cluster calculations asynchronously in background jobs, updating the cache DB periodically rather than on-demand.

---

## 21. Redundancy
* **Common Code**: Wallet age metrics and address funding are recalculated in both Module 1 (Wallet Quality) and Module 6 (Buyer Quality).
* **Fix**: Move wallet age metadata resolution into a shared parser utility preceding module execution.

---

## 22. Missing Capabilities

### 22.1 Critical Missing
* **Cross-Token Wallet API Integration**: A specified integration schema/adapter for Dune, Covalent, or similar indexer APIs is required to make Module 5 (Smart Money) technically feasible.

### 22.2 Important Missing
* **Solana Normalization Adapter**: Specific event parameters translating Solana Program Logs (from Raydium/Orca) into the standard transaction schema.

---

## 23. Critical Issues

### 23.1 Schema Completeness
* **Problem**: The properties `dex_liquidity`, `historical_behavior`, `risk_scoring`, and `market_regime` are missing from the `scan_output.json` schema.
* **Impact**: Runtimes returning compliant outputs will fail schema checks when these modules populate details.

### 23.2 Smart Money Data Sourcing
* **Problem**: Module 5 requires cross-token trade profiling which is technically impossible to resolve using simple RPC nodes or explorer APIs.
* **Impact**: Smart Money detection returns `UNKNOWN` in 100% of cases unless an indexed database provider is added.

---

## 24. Recommended Changes

### Recommendation 1
* **File**: `schemas/scan_output.json`
* **Section**: `properties`
* **Problem**: Missing keys for five active modules (`dex_liquidity`, `historical_behavior`, `risk_scoring`, `live_monitoring`, `market_regime`).
* **Why it matters**: Prevents modules from returning detailed reports, leading to incomplete API payloads.
* **Recommended change**: Append properties matching the output schemas defined in each module markdown file.
* **Priority**: CRITICAL

### Recommendation 2
* **File**: `data/data_sources.md`
* **Section**: `Source Mapping`
* **Problem**: Lack of index-level providers for cross-token profiling.
* **Why it matters**: Smart Money module fails completely without Covalent, Dune, or comparable historical transaction indexing API.
* **Recommended change**: Explicitly integrate an index-level API provider and specify the schema fields.
* **Priority**: HIGH

### Recommendation 3
* **File**: `data/normalization.md`
* **Section**: `Solana Adaptations`
* **Problem**: No definition of how Solana program logs translate to the EVM event standard.
* **Why it matters**: Solana scanning will crash when standard block logs parser tries to ingest non-EVM patterns.
* **Recommended change**: Define Raydium and Orca event mappings.
* **Priority**: HIGH

---

## 25. Final Scorecard

* **Architecture**: 8/10
* **Data Feasibility**: 5/10
* **Trader Utility**: 9/10
* **Evidence Quality**: 9/10
* **AI Agent Readiness**: 8/10
* **Schema Consistency**: 4/10
* **Module Completeness**: 8/10
* **Security**: 9/10
* **Cost Efficiency**: 7/10
* **Scalability**: 6/10
* **Implementation Readiness**: 5/10

### Overall Score: 71/100

---

## 26. Implementation Readiness
* **Classification**: **PARTIALLY READY**
* **Reason**: The structural specifications are clean and aligned, but the missing fields in the master JSON schema (`scan_output.json`) and the lack of an indexed API provider configuration for Smart Money profiling block direct development. Once these recommended changes are integrated, the foundation is fully ready for codebase construction.

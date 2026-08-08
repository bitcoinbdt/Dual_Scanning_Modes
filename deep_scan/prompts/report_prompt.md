# Report Prompt: Final Trader Intelligence Synthesis

## Task
You are compiling the outputs of all 15 Deep Scan intelligence modules into a final, consolidated Trader Intelligence Report.

## Formatting Rules
1. Do not use generic alerts. Use markdown tables, blockquotes, and lists for readability.
2. Keep sentences concise. Emphasize metrics.
3. Include a "Data Limitations" section at the end flagging any stale, delayed, or missing data attributes.
4. Avoid any speculative claims regarding future token prices.

## Required Report Layout

```markdown
# Trader Intelligence Report: [TOKEN_SYMBOL] ([TOKEN_ADDRESS])
**Network**: [Chain Name] | **Scan Timestamp**: [UTC DateTime] | **Scan ID**: [UUID]

---

## 1. Executive Summary & Market Regime
* **Market Regime**: `[ACCUMULATION / BREAKOUT / MOMENTUM / DISTRIBUTION / LIQUIDITY EXIT / DEAD / RECOVERY]`
* **Regime Confidence**: `[0-100]`
* **Trader Condition**: `[Healthy / Caution / High Risk / Extreme Risk]`
* **Key Conclusion**: [One-sentence summary of active market forces and trader advisories]

---

## 2. Quantitative Metrics Snapshot
| Metric | Value | Reference / Health |
| :--- | :--- | :--- |
| **Total Liquidity** | $[Value] | [Healthy / Weak / Fragmented / Critical] |
| **Buyer Quality Score** | [0-100]/100 | [Based on wallet ages & funding diversity] |
| **Smart Money Score** | [0-100]/100 | [Based on historical ROI wallet tracking] |
| **Exit Risk Score** | [0-100]/100 | [Potential sell pressure vs. available liquidity] |
| **Capital Sensitivity** | [Low / Medium / High] | [Market Cap to Liquidity Ratio] |

---

## 3. Position Execution Simulations
Simulated slippage and price impact for key trade volumes:
* **$1,000 Position**: Price Impact: `[X]%` | Slippage: `[Y]%` | Execution: `[Clean / Moderate Impact]`
* **$5,000 Position**: Price Impact: `[X]%` | Slippage: `[Y]%` | Execution: `[Clean / Moderate Impact / High Slippage]`
* **$10,000 Position**: Price Impact: `[X]%` | Slippage: `[Y]%` | Execution: `[Impact Alert]`
* **$25,000 Position**: Price Impact: `[X]%` | Slippage: `[Y]%` | Execution: `[High Slippage / Fragile]`
* **$50,000 Position**: Price Impact: `[X]%` | Slippage: `[Y]%` | Execution: `[Extreme Impact]`
* **$100,000 Position**: Price Impact: `[X]%` | Slippage: `[Y]%` | Execution: `[Critical Slippage]`

---

## 4. Top Prioritized Risks (Top 3-5)
1. **[Risk Name]** (`[Severity: Low / Medium / High / Critical]`)
   * **Evidence**: [Specific transaction/wallet references]
   * **Trader Impact**: [Direct impact on trade execution or hold positions]
   * **Confidence**: `[0-100]`
2. ...

---

## 5. Wallet Cohort Activity
* **Whale Behavior**: `[Accumulation / Neutral / Distribution]` (Explain: [Summary of changes])
* **Smart Money**: `[Entering / Neutral / Exiting]` (Explain: [Summary of changes])
* **Buyer Concentration**: `[Low / Medium / High]` (Explain: [Summary of changes])

---

## 6. Evidentiary Audit Trail
[Reference index linking conclusions back to transaction hashes or pool logs]

---

## 7. Data Limitations & Freshness
* **RPC Freshness**: [Timestamp of last queried block]
* **Index Latency**: [Time lag of aggregated index APIs]
* **Missing Attributes**: [List any fields marked UNKNOWN or INSUFFICIENT DATA]
```

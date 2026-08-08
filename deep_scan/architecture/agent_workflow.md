# AI Agent Orchestration Workflow

## Overview
This document specifies how the AI Agent orchestrates raw data metrics, evaluates data quality, applies constraints, and reasons through findings to build reports.

---

## 1. Agent Reasoning Cycle

```text
               +---------------------------+
               |    Receive Scan Request   |
               +---------------------------+
                             │
                             ▼
               +---------------------------+
               |  Check Data Completeness  |
               +---------------------------+
                             │
              ┌──────────────┴──────────────┐
     [Complete Data]                 [Partial Data]
              │                             │
              ▼                             ▼
+---------------------------+ +---------------------------+
|    Run All 15 Modules     | |  Set status = PARTIAL     |
+---------------------------+ |  Append log to LIMITATIONS|
              │               +---------------------------+
              │                             │
              └──────────────┬──────────────┘
                             │
                             ▼
               +---------------------------+
               |   Cross-Check Conflicts   |
               +---------------------------+
                             │
                             ▼
               +---------------------------+
               |    Apply Evidence Rules   |
               +---------------------------+
                             │
                             ▼
               +---------------------------+
               |  Calculate Confidence %   |
               +---------------------------+
                             │
                             ▼
               +---------------------------+
               | Synthesize MD Report/JSON |
               +---------------------------+
```

---

## 2. Decision Logic & Branching

### 2.1 Conflict Resolution Logic
If one signal indicates safety while another indicates high risk, apply the following resolution weights:
* **Liquidity Depth vs. Code Audit**: Liquidity signals override contract code audit. A verified, perfect contract with zero liquidity is marked as `UNTRADEABLE` (high risk).
* **Smart Money Net Flow vs. Retail Buying**: Smart money movements carry three times ($3$x) the weight of retail buyers in determining the market regime transition.
* **Whale Distribution vs. Price Momentum**: If price is rising but dynamic whales are distributing supply, override momentum to set the threat advisory to `Caution` (Whale Distribution).

### 2.2 Data Incompleteness Handling
If explorer API keys are throttled:
1. Do not halt execution.
2. Flag `wallet_quality` and `buyer_quality` as `INSUFFICIENT DATA`.
3. Clear all downstream scores that depend on those parameters.
4. Set overall scan status to `partial_failure`.
5. Return the report containing the remaining completed modules (such as liquidity stress simulations and multi-pool maps).

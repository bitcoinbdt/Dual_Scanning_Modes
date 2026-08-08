# Deep Scan On-Chain Trading Intelligence Engine

Welcome to the foundation of the **Deep Scan** engine. This directory contains the complete conceptual models, schemas, AI prompt templates, and system architecture specifications for a trader-focused on-chain analytics system.

Unlike typical contract scanners that focus purely on static code analysis or simple rug-pull checks, Deep Scan evaluates market structure, buyer quality, wallet relationships, capital flows, and liquidity vulnerability under stress.

## Directory Structure

Click the links below to explore the specifications:

```text
deep_scan/
│
├── SKILL.md                          ← Master skill definition & source of truth
├── README.md                         ← Navigation & directory overview (this file)
│
├── prompts/                          ← AI configuration templates
│   ├── system_prompt.md              ← AI agent behavior guidelines
│   ├── analysis_prompt.md            ← Module-level reasoning templates
│   └── report_prompt.md              ← Final report formatting & synthesis
│
├── schemas/                          ← JSON schemas for strict schema-compliance
│   ├── scan_input.json               ← Scan invocation parameters
│   ├── scan_output.json              ← Full execution output report structure
│   ├── evidence.json                 ← Structuring evidentiary nodes
│   ├── wallet.json                   ← Wallet identity & behavior metadata
│   ├── transaction.json              ← Standard transaction entry
│   ├── liquidity.json                ← Pool reserve details
│   └── risk_signal.json              ← Risk assessment criteria
│
├── modules/                          ← Detailed specification for each of the 15 modules
│   ├── wallet_quality.md             ← Module 1: Wallet quality & co-funding analysis
│   ├── organic_price.md              ← Module 2: Organic vs. wash trading evaluation
│   ├── liquidity_stress.md           ← Module 3: Slippage & price impact simulation
│   ├── whale_behavior.md             ← Module 4: Dynamic whale threshold & tracking
│   ├── smart_money.md                ← Module 5: ROI-based smart trader profiling
│   ├── buyer_quality.md              ← Module 6: Fresh vs. mature demand profiling
│   ├── exit_risk.md                  ← Module 7: Scenario-based exit stress modeling
│   ├── market_regime.md              ← Module 8: Accumulation/Breakout/Distribution identification
│   ├── top_risks.md                  ← Module 9: Top 3-5 prioritized risk highlights
│   ├── live_monitoring.md            ← Module 10: Event streaming & notification triggers
│   ├── dex_liquidity.md              ← Module 11: Multi-pool liquidity mapping
│   ├── capital_efficiency.md         ← Module 12: MC/Liquidity ratio & sensitivity checks
│   ├── historical_behavior.md        ← Module 13: Drawdowns & pattern recognition
│   ├── risk_scoring.md               ← Module 14: Explainable risk metric scoring
│   └── trader_intelligence.md        ← Module 15: Consolidated intelligence synthesis
│
├── data/                             ← Data freshness & provider protocols
│   ├── data_sources.md               ← API & RPC fallbacks & cost-optimization
│   ├── normalization.md              ← Multi-chain/DEX standard representations
│   └── freshness.md                  ← Stale thresholds & cache policies
│
└── architecture/                     ← System design diagrams and guides
    ├── system_architecture.md        ← Component block diagram
    ├── data_flow.md                  ← Stage-by-stage data transformation
    └── agent_workflow.md             ← Autonomous reasoning & feedback loops
```

## Quick Reference Links

* **System Guidelines**: [`prompts/system_prompt.md`](file:///d:/scanner/deep_scan/prompts/system_prompt.md)
* **Master Skill Definition**: [`SKILL.md`](file:///d:/scanner/deep_scan/SKILL.md)
* **Execution Flow**: [`architecture/data_flow.md`](file:///d:/scanner/deep_scan/architecture/data_flow.md)
* **Output Schema**: [`schemas/scan_output.json`](file:///d:/scanner/deep_scan/schemas/scan_output.json)

---
*Note: This is a read-only architecture and specification repository. Production implementation adapters are mapped out in the specifications.*

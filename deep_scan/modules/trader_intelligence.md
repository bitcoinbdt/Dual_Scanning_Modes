# Module 15: Evidence-Based Trader Intelligence

## Objective
Consolidate all modular findings, risk rankings, simulations, and evidence chains into a unified, actionable Trader Intelligence Report.

## Required Data
* Completed output objects and data logs from Modules 1-14.

## Data Sources
* Prior analytical modules.

## Inputs
* Integrated module results object.

## Processing Logic
1. **Conflict Resolution**: Crosscheck signals for contradictions (e.g., if Module 2 flags "Wash Trading" but Module 6 flags "High Buyer Quality," check volume concentration weights to override and downgrade Buyer Quality).
2. **Synthesis**: Compile executive summaries answering "Who is trading, why is price moving, where is liquidity, what are whales/smart money doing, and what are the top risks."
3. **Markdown Generation**: Format outputs using the standardized layout defined in `prompts/report_prompt.md`.

## Metrics
* **Report Integrity**: Boolean flag indicating all required sections are populated.
* **Overall Confidence Score (0-100)**: Average confidence across all modules.

## Detection Logic
* If any critical risk is active, force the executive summary header to display a `CAUTION` or `CRITICAL RISK` condition.

## Output Schema
Reference schema: `schemas/scan_output.json`.
```json
{
  "module": "trader_intelligence",
  "trader_condition": "Caution",
  "overall_confidence": 88,
  "executive_summary": "The token is experiencing high volume momentum, but exit liquidity is fragile for positions over $10,000 USD.",
  "report_markdown_path": "reports/scan_report.md"
}
```

## Evidence Requirements
* Linked indices for every statement made in the consolidated report.

## Confidence Calculation
* The combined average confidence of the input data and reasoning modules.

## Failure Conditions
* Critical structural schemas are invalid or corrupted.

## Data Limitations
* The consolidated intelligence is a snapshot of current on-chain states and cannot forecast future events or developers modifying smart contract parameters.

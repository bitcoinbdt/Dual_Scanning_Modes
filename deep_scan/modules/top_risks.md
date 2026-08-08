# Module 9: Top Risk Detection

## Objective
Filter and prioritize all detected risk signals into a concise list of the top 3-5 critical risks for the trader.

## Required Data
* Risk outputs from Modules 1-8.

## Data Sources
* Internal outputs of other Deep Scan modules.

## Inputs
* Compiled risk indicators array.

## Processing Logic
1. **Prioritization Score**: For each detected risk, calculate its Prioritization Score:
   $$\text{Score} = \text{Severity Weight} \cdot \text{Confidence}$$
   * Severity Weights: `critical` = 4.0, `high` = 3.0, `medium` = 2.0, `low` = 1.0.
2. **Deduplication**: Merge related risks (e.g. "Low Liquidity" and "High Exit Slippage" merged into "Liquidity Fragility").
3. **Sort and Slice**: Sort risks by Prioritization Score descending and return the top 3-5 items.

## Metrics
* **Risk Severity Index**: Average severity of top risks.
* **Risk Density**: Count of active distinct risks.

## Detection Logic
* Automatically bubble up any active critical severity risks (such as "Liquidity Exit" or "Coordinated Insider Selling").

## Output Schema
Reference schema: `schemas/risk_signal.json`.
```json
{
  "module": "top_risks",
  "active_risks_count": 3,
  "risks": [
    {
      "risk_id": "RSK_LIQ_FRAGILE",
      "risk_name": "Fragile Liquidity Depth",
      "severity": "critical",
      "status": "active",
      "evidence_ids": ["EV_LIQ_001"],
      "description": "Simulated $10,000 USD sell trade causes a 18% price drop due to thin AMM reserves."
    }
  ]
}
```

## Evidence Requirements
* Consolidated list of underlying module evidence nodes.

## Confidence Calculation
* Calculated as the average confidence of the merged risk components.

## Failure Conditions
* Critical modules fail to return data, preventing proper ranking.

## Data Limitations
* Qualitative risks (e.g., project team reputation) cannot be parsed or ranked.

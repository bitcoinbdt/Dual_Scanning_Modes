# Module 14: Explainable Risk Scoring

## Objective
Synthesize all quantitative and qualitative analytical metrics into clean, explainable, evidence-based sub-scores and an Overall Risk Score.

## Required Data
* Completed output metrics from Modules 1 through 13.

## Data Sources
* Outputs of prior analytical modules.

## Inputs
* Metrics database.

## Processing Logic
1. **Sub-Score Calculations (0-100)**:
   * **Liquidity Score**: Derived from simulated slippage and multi-pool depth.
   * **Buyer Quality Score**: Based on wallet age and funding diversity.
   * **Exit Risk Score**: Ratio of top holder supply to executable pool depth.
2. **Overall Risk Score (0-100)**:
   * Weighted calculation combining sub-scores:
     $$\text{Overall Risk} = w_l \cdot \text{Exit Risk} + w_b \cdot (100 - \text{Buyer Quality}) + w_m \cdot \text{Manipulation Risk}$$
3. **Evidence Association**: Every score must carry pointers to the exact evidence nodes that contributed to its value.

## Metrics
* **Sub-Scores**: Liquidity, Buyer Quality, Exit Risk, Manipulation Risk.
* **Overall Risk Score**.
* **Impact Contributors**: Sorted list of positive/negative scoring contributors with weights.

## Detection Logic
* A score change of $>15$ points must trigger a recalculation alert listing the exact underlying metric change (e.g. "Whale selling increased by 30%").

## Output Schema
```json
{
  "module": "risk_scoring",
  "overall_risk_score": 72,
  "sub_scores": {
    "liquidity_score": 45,
    "buyer_quality_score": 68,
    "exit_risk_score": 85,
    "manipulation_risk_score": 50
  },
  "contributors": [
    {
      "factor": "High Exit Risk from Top Holders",
      "impact": 35,
      "direction": "negative",
      "evidence_id": "EV_EXT_002"
    },
    {
      "factor": "Diverse Buyer Wallet Age",
      "impact": 15,
      "direction": "positive",
      "evidence_id": "EV_BUY_004"
    }
  ]
}
```

## Evidence Requirements
* Metrics used to feed the scoring mathematical formulas.
* Evidence IDs mapping to raw transactions.

## Confidence Calculation
* Score confidence is computed as the weighted average confidence of the input signals.

## Failure Conditions
* Critical sub-scores missing from upstream modules.

## Data Limitations
* Scoring weights are static templates and may require parameter adjustments in highly volatile market regimes.

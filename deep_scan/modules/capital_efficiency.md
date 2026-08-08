# Module 12: Capital Efficiency Analysis

## Objective
Analyze token market capitalization relative to executable liquidity and determine price sensitivity to relatively small capital inflows/outflows.

## Required Data
* Token circulating supply.
* Token spot price.
* Total executable liquidity.

## Data Sources
* Coingecko/GeckoTerminal APIs.
* Direct RPC pool reserve checks.

## Inputs
* Token contract address.
* Circulating supply metric.

## Processing Logic
1. **Ratio Calculations**:
   * Calculate Market Cap to Liquidity Ratio:
     $$\text{Ratio} = \frac{\text{Market Capitalization}}{\text{Total Liquidity USD}}$$
2. **Sensitivity Mapping**:
   * **Low Capital Sensitivity**: Ratio $< 5$x. Price requires significant capital to shift.
   * **Medium Capital Sensitivity**: Ratio between 5x and 20x.
   * **High Capital Sensitivity**: Ratio $> 20$x. Extremely thin liquidity relative to the nominal valuation. A small transaction can cause explosive price volatility.

## Metrics
* **Market Cap / Liquidity Ratio**.
* **Capital Sensitivity Grade** (`low`, `medium`, `high`).
* **FDV to Liquidity Ratio**.

## Detection Logic
* **Leveraged Price Risk**: If the MC/Liquidity ratio exceeds 40x, trigger a "High Capital Sensitivity" warning, alerting traders that nominal valuation is highly volatile and thin exit doors exist.

## Output Schema
```json
{
  "module": "capital_efficiency",
  "market_cap_usd": 12000000.0,
  "liquidity_usd": 300000.0,
  "mc_liquidity_ratio": 40.0,
  "sensitivity": "high",
  "explanation": "Token price is highly sensitive to capital changes. A $7,500 trade will cause significant price swings."
}
```

## Evidence Requirements
* Spot price, verified circulating supply parameters, and active liquidity reserve readings.

## Confidence Calculation
* **High (80-100)**: Supply and reserves fully verified.
* **Medium (50-79)**: Circulating supply is estimated (assumed equal to max supply due to lack of lockup indexes).
* **Low (0-49)**: Highly ambiguous supply metrics (mintable token without clear caps).

## Failure Conditions
* Unable to verify token price or supply.

## Data Limitations
* Does not account for dynamic token burn mechanisms or progressive vesting schedules that modify real-time circulating supply.

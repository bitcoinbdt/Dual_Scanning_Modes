# Module 13: Historical Behavior Analysis

## Objective
Analyze historical cycles of the token to discover recurring behaviors during pump, dump, accumulation, and distribution phases.

## Required Data
* Historical price and volume charts (hourly/daily intervals over the token's lifetime).
* Past whale transactions and liquidity modifications.

## Data Sources
* Historical data aggregators.
* Archive nodes.

## Inputs
* Token contract address.

## Processing Logic
1. **Cycle Demarcation**: Split the token's historical chart into structural cycles (e.g. Pump phases, correction phases).
2. **Drawdown Calculation**: For each cycle, calculate the peak-to-trough drawdown:
   $$\text{Drawdown} = \frac{\text{ATH Price} - \text{Cycle Low Price}}{\text{ATH Price}}$$
3. **Behavior Correlation**: Compare the current price-volume slope with historical signatures preceding past major sell-offs.

## Metrics
* **All-Time High (ATH) Drawdown (%)**.
* **Average Historical Drawdown (%)**.
* **Recovery Rate (%)**: Proportion of drawdowns that were subsequently recovered.

## Detection Logic
* **Historic Distribution Signal**: Current volume expansion accompanied by a flattening price aligns with previous signatures that preceded historical average drawdowns of $\ge 40\%$.

## Output Schema
```json
{
  "module": "historical_behavior",
  "ath_usd": 4.50,
  "drawdown_from_ath_pct": 72.4,
  "historical_cycles_count": 3,
  "average_drawdown_pct": 55.0,
  "pattern_match": "high_volume_distribution"
}
```

## Evidence Requirements
* Coordinates of historic chart points (ATH, lows, volume spikes).
* Timestamp listings of past identified dump events.

## Confidence Calculation
* **High (80-100)**: Token age $> 90$ days with continuous, verified price-volume datasets.
* **Medium (50-79)**: Token age between 14 and 90 days; limited cycle samples.
* **Low (0-49)**: Token age $< 14$ days (insufficient history to identify reliable patterns).

## Failure Conditions
* Token has less than 24 hours of trading history.

## Data Limitations
* Past behavior is purely contextual and cannot guarantee future market movements.

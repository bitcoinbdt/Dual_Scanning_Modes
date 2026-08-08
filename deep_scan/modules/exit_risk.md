# Module 7: Exit Risk Analysis

## Objective
Model potential future selling pressure from top holders, snipers, and unrealized profit holders against available executable pool liquidity.

## Required Data
* Holder balance list.
* Token acquisition prices (to compute unrealized profits).
* DEX pool reserves.

## Data Sources
* Token contract balance snapshot.
* Historical token price feed.

## Inputs
* Token contract address.
* Pool reserve states.

## Processing Logic
1. **Unrealized Profit Calculations**: For each top holder, determine their average entry price. Calculate current unrealized PnL:
   $$\text{Unrealized PnL} = (\text{Current Spot Price} - \text{Entry Price}) \cdot \text{Balance}$$
2. **Scenario Simulations**:
   * *Conservative*: Top 3 holders sell 10% of their supply.
   * *Moderate*: Top 5 holders and snipers sell 25% of their supply.
   * *Aggressive*: Top 10 holders sell 50% of their supply.
3. Compute the resulting price crash using the constant product pool formula for each scenario.

## Metrics
* **Top 10 Supply Concentration (%)**.
* **Liquid Sell Pressure Ratio**: $\frac{\text{Supply held by top 10 wallets}}{\text{Pool token reserves}}$.
* **Exit Crash Percentage** per scenario.

## Detection Logic
* **Critical Exit Risk**: If a moderate scenario (25% sell by top 5 holders) results in a price drop of $\ge 50\%$, flag the exit risk as `CRITICAL`.

## Output Schema
```json
{
  "module": "exit_risk",
  "risk_level": "high",
  "liquid_sell_pressure_ratio": 2.8,
  "scenarios": {
    "conservative_price_impact_pct": 12.5,
    "moderate_price_impact_pct": 38.2,
    "aggressive_price_impact_pct": 71.4
  }
}
```

## Evidence Requirements
* Balances of top 10 holders.
* Current AMM reserve balances.

## Confidence Calculation
* **High (90-100)**: Direct mathematical derivation from blockchain pool reserves and balance ledger.
* **Medium (60-80)**: Cached reserves or older ledger data.
* **Low (0-59)**: Multi-token routing calculations where pools are not fully mapped.

## Failure Conditions
* Unable to resolve top holder balances or entry prices.
* No active AMM reserves found.

## Data Limitations
* Does not model dynamic order placement behavior, limit orders, or OTC (Over-The-Counter) trades.

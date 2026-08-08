# Module 3: Liquidity Stress Test

## Objective
Simulate buy/sell executions at various position sizes to estimate price impact, slippage, and market exit fragility.

## Required Data
* Active AMM pool reserves (Token reserves $x$ and $y$).
* Contract swap fee rate (e.g. $0.3\%$).

## Data Sources
* Direct query to pool contracts (`getReserves` or slot readings).
* DEX factory queries.

## Inputs
* Base position sizes: `[1000, 5000, 10000, 25000, 50000, 100000]` in USD value.
* Target trade direction (Buy/Sell).

## Processing Logic
1. Calculate token amount matching target USD size based on current spot price.
2. For Constant-Product Pools ($x \cdot y = k$):
   * Adjusted swap formula:
     $$\Delta y = y \cdot \left(1 - \frac{x}{x + \Delta x \cdot (1 - f)}\right)$$
     where $f$ is the fee tier (e.g. $0.003$).
   * Calculate Price Impact:
     $$\text{Price Impact} = 1 - \frac{\text{Execution Price}}{\text{Spot Price}}$$
3. Assess Slippage including standard price impact and expected routing latency penalty.

## Metrics
* **Simulated Price Impact (%)** for each position tier.
* **Liquidity Utilization**: $\frac{\Delta x}{x}$ (fraction of total reserves swapped).
* **Exit Fragility Score**: Ratio of top holder supply to executable pool depth.

## Detection Logic
* **Fragile Liquidity**: If a $10,000 USD sell trade causes $> 15\%$ price impact, mark exit condition as `CRITICAL`.
* **Execution Blockage**: If trade size exceeds pool reserves ($\Delta x \ge x$), mark as `UNTRADEABLE`.

## Output Schema
Reference schema: `schemas/liquidity.json` and simulation outputs.
```json
{
  "module": "liquidity_stress",
  "simulations": [
    {
      "position_usd": 10000,
      "price_impact_pct": 4.2,
      "slippage_pct": 4.5,
      "expected_execution_price": 1.23,
      "level": "medium"
    }
  ]
}
```

## Evidence Requirements
* Snapshot of pool reserve values ($x$, $y$) with block number.
* Pool contract address and verified ABI format.

## Confidence Calculation
* **High (95-100)**: Direct state reading from active blockchain RPC block height.
* **Medium (70-94)**: Inferences from index APIs (may suffer block lags).
* **Low (0-69)**: Concentrated liquidity pools (V3) without dynamic tick-range maps.

## Failure Conditions
* Pool reserves queried as zero.
* Complex multi-hop routes where intermediate pool metrics are missing.

## Data Limitations
* Does not predict sandwich attacks in the public mempool which can drastically increase real slippage.

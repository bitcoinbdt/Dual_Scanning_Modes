# Module 2: Organic Price Movement Analysis

## Objective
Determine whether price changes are driven by broad-based organic user demand or artificial wash trading and volume concentration.

## Required Data
* Swap events (`Swap` logs from AMM pools).
* Unique seller/buyer addresses.
* Token prices over time.

## Data Sources
* Subgraphs (The Graph, Goldsky).
* DEX market-data APIs (DexScreener, GeckoTerminal).

## Inputs
* Token contract address.
* Historical candle/trade data (1m, 5m, 1h intervals).

## Processing Logic
1. **Volume Concentration**: Compute the Herfindahl-Hirschman Index (HHI) on buying and selling volumes per wallet.
2. **Cycle Detection**: Identify circular swap paths (e.g., Wallet A sells to Pool, Wallet B buys, Wallet B transfers back to Wallet A).
3. **Price-Volume Divergence**: Look for rising price trends accompanying declining unique trading entities.

## Metrics
* **HHI Index**: $\sum (s_i)^2$, where $s_i$ is the volume share of wallet $i$. High HHI ($> 0.25$) represents extreme concentration.
* **Volume/Unique Trader Ratio**: $\frac{\text{Swap Volume USD}}{\text{Unique Active Traders}}$.
* **Buy/Sell Volume Skew**: $\frac{\text{Buy Volume}}{\text{Sell Volume}}$.

## Detection Logic
* **Wash Trading**: A single wallet or cluster executing $\ge 5$ circular buy-sell trades within 1 hour representing $> 15\%$ of total pool volume.
* **Artificial Momentum**: Price increase of $>20\%$ accompanied by a $> 30\%$ drop in hourly active unique buyers.

## Output Schema
```json
{
  "module": "organic_price",
  "organic_score": 45,
  "hhi_index": 0.38,
  "wash_trading_detected": true,
  "details": "Three wallets control 65% of the total buying volume."
}
```

## Evidence Requirements
* List of trade transaction hashes for highly concentrated wallets.
* Graph of unique buyers vs. price slopes over the timeframe.

## Confidence Calculation
* **High (80-100)**: Exhaustive trade log coverage with exact matching wallet patterns.
* **Medium (50-79)**: Summarized API data with minor gaps in transaction-level resolution.
* **Low (0-49)**: Highly fragmented trade details or reliance on coarse daily snapshots.

## Failure Conditions
* Inability to retrieve transaction-level event logs.
* Unusually high swap frequency overflowing standard buffers.

## Data Limitations
* Aggregated MEV (Maximal Extractable Value) sandwiches can distort buy/sell ratios and HHI scores without being creator-led wash trading.

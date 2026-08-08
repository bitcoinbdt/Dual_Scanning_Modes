# Module 8: Market Regime Detection

## Objective
Classify the current market regime of the token using price, volume, liquidity trends, and participant behaviors.

## Required Data
* Price history (daily/hourly).
* Volume history.
* Net capital flows.
* Whale net transfers.

## Data Sources
* Subgraphs.
* Market aggregators.

## Inputs
* Token contract address.
* Historical window (default: `7d` lookback).

## Processing Logic
Classify the market regime based on these conditions:
* **ACCUMULATION**: Volume increasing, Price sideways ($\pm 5\%$), Net smart money inflow positive.
* **BREAKOUT**: Price breaks upper Bollinger Band, volume $> 2$x 7-day average.
* **MOMENTUM**: Price increasing, Volume increasing, Buyer count growing.
* **DISTRIBUTION**: Price sideways/decreasing, Volume elevated, Whale net outflow positive.
* **LIQUIDITY EXIT**: Price dropping, Liquidity dropping ($> 15\%$), Whale sales high.
* **DEAD**: Volume $< \$1000$ USD/24h, zero price volatility.
* **RECOVERY**: Price reclaiming support, Buyer count increasing after major drawdown.

## Metrics
* **Price Velocity**: Rate of price change.
* **Volume Trend Coefficient**: Linear regression slope of hourly volume.
* **Liquidity Trend Score**: Slope of reserve changes.

## Detection Logic
* Assign current regime, confidence, and primary triggering indicators.

## Output Schema
```json
{
  "module": "market_regime",
  "current_regime": "DISTRIBUTION",
  "transition_status": "momentum_to_distribution",
  "confidence": 85,
  "factors": [
    "Volume remains high but price growth has flattened",
    "Whale outflow has turned negative (-$45,000 USD/24h)"
  ]
}
```

## Evidence Requirements
* Price, volume, and liquidity timeseries data.
* Net flow directions for whales and smart money over 7 days.

## Confidence Calculation
* **High (80-100)**: All input data streams are fresh and show high correlation.
* **Medium (50-79)**: Conflicting indicators (e.g. rising price but declining buyers, or lack of smart money tracking).
* **Low (0-49)**: Highly volatile data with low sample size (< 3 days active trade).

## Failure Conditions
* Missing price or volume timeseries.

## Data Limitations
* Wash trading can artificially fake breakout or momentum regimes.

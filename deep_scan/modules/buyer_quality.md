# Module 6: Buyer Quality Analysis

## Objective
Assess the quality and reliability of recent buyers to determine if price demand is driven by sustainable, independent traders.

## Required Data
* List of addresses executing `swap` buy transactions in the last 24 hours.
* Wallet histories, ages, and funding addresses.

## Data Sources
* Indexed swap events database.
* Blockchain RPC node endpoints.

## Inputs
* Token contract address.
* Timeframe (default: `24h`).

## Processing Logic
1. **Buyer Classification**: Categorize buyers into:
   * `Fresh`: Wallets $< 24$ hours old.
   * `Established`: Wallets $> 30$ days old with $> 100$ transactions.
   * `Co-funded`: Wallets sharing a gas-funding node.
2. **Quality Scoring**: Compute a Buyer Quality Score (0-100) using a weighted formula:
   $$\text{Score} = w_1 \cdot (1 - \text{Fresh Ratio}) + w_2 \cdot \text{Established Ratio} + w_3 \cdot (1 - \text{Co-funded Ratio})$$

## Metrics
* **New Buyer Ratio**: $\frac{\text{New buyers}}{\text{Total buyers}}$.
* **Capital Diversity Index**: Entropy of buyer transaction sizes.
* **Buyer Quality Score** (0-100).

## Detection Logic
* **Deteriorating Buyer Quality**: Score falls below 40 due to a massive spike in fresh wallets ($> 60\%$) funded by a single hot-wallet or private source.
* **Retail Dispersion**: High score ($> 80$) indicating diverse, mature wallets making independent, varying size purchases.

## Output Schema
```json
{
  "module": "buyer_quality",
  "score": 68,
  "metrics": {
    "new_buyer_ratio": 0.18,
    "established_buyer_ratio": 0.55,
    "co_funded_ratio": 0.05
  },
  "verdict": "healthy"
}
```

## Evidence Requirements
* Age distribution statistics of buying wallets.
* Gas funder addresses and associated member sets.

## Confidence Calculation
* **High (80-100)**: Fully resolved wallet age and gas funding data for $> 90\%$ of buyers.
* **Medium (50-79)**: Minor gas funder resolution gaps (unknown funding addresses).
* **Low (0-49)**: Highly incomplete wallet history files.

## Failure Conditions
* API timeout when querying transaction counts of buyer lists.

## Data Limitations
* High-volume retail integrations (e.g. Telegram trading bots) create many fresh wallets, which can artificially lower quality scores even if the demand is real.

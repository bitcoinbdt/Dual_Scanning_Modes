# Module 4: Whale Behavior Analysis

## Objective
Track the actions of high-balance token holders using dynamic, market-scaled thresholds instead of static values.

## Required Data
* Token holder distribution (list of all balances).
* Circulating supply.
* Active pool reserves.

## Data Sources
* Explorer Token Holders API.
* Token Indexers.

## Inputs
* Token contract address.
* Maximum supply and circulating supply calculations.

## Processing Logic
1. **Dynamic Threshold Calculation**:
   * Determine "Whale" status if an address holds:
     $$\text{Balance} \ge \max(1\% \text{ of Circulating Supply}, 5\% \text{ of executable pool reserves})$$
2. **Phase Classification**:
   * Identify wallet actions over the timeframe:
     * `ACCUMULATION`: Net balance increase $> 5\%$.
     * `DISTRIBUTION`: Net balance decrease $> 5\%$.
     * `HOLDING`: Net balance change between $\pm 5\%$.
     * `DORMANT`: Zero transactions in the last 7 days.

## Metrics
* **Whale Supply Concentration**: $\frac{\sum \text{Whale Balances}}{\text{Circulating Supply}}$.
* **Net Whale Flow**: Sum of whale transfers/swaps over the timeframe.
* **Whale Count**: Number of unique addresses crossing the dynamic whale threshold.

## Detection Logic
* **Aggressive Distribution**: If $\ge 3$ whales begin distribution behavior (transferring to DEX or selling) within a 12-hour window, flag "Whale Distribution Alert."
* **Concentration Risk**: If top 10 whales control $>65\%$ of circulating supply, flag "High Whale Concentration."

## Output Schema
```json
{
  "module": "whale_behavior",
  "whale_threshold_tokens": "1250000.0",
  "whale_concentration_pct": 52.4,
  "active_whales": [
    {
      "address": "0xwhale1...",
      "balance": "3000000",
      "status": "distribution",
      "net_change_24h": "-250000"
    }
  ]
}
```

## Evidence Requirements
* List of wallet balances and transaction hashes for Whale addresses.
* Timestamps of movements to or from decentralized exchange contracts.

## Confidence Calculation
* **High (80-100)**: Fully queried ledger with zero missing accounts.
* **Medium (50-79)**: Holder lists capped at top 100 accounts.
* **Low (0-49)**: Fragmented balances or uncounted staking contracts.

## Failure Conditions
* Explorer failing to return holder list.
* Failure to distinguish staking contracts/bridges from individual user wallets.

## Data Limitations
* Whales splitting holdings across dozens of fresh sub-wallets will bypass the individual dynamic whale thresholds.

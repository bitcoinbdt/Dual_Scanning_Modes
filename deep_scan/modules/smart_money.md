# Module 5: Smart Money Detection

## Objective
Identify historically successful trading wallets ("Smart Money") and track their accumulation or distribution of the target token.

## Required Data
* Historical swap transactions for active token buyers.
* Historic token prices at the time of those swaps.

## Data Sources
* DeFi subgraphs and trade trackers.
* Centralized wallet behavior indexes (Debank, Nansen, local profit index database).

## Inputs
* Active trader address list.
* Token contract address.

## Processing Logic
1. **Wallet ROI Profiling**: For each active trader address, analyze historic trade transactions across at least 5 other tokens:
   * Calculate Realized ROI:
     $$\text{ROI} = \frac{\text{Total Sell Value} - \text{Total Buy Value}}{\text{Total Buy Value}}$$
   * Calculate Win Rate:
     $$\text{Win Rate} = \frac{\text{Profitable Closed Positions}}{\text{Total Closed Positions}}$$
2. **Filter Smart Wallets**: Flag wallets as "Smart Money" if they have:
   * $\ge 10$ historical trades,
   * Realized win rate $\ge 65\%$,
   * Cumulative realized profit $\ge \$10,000$ USD.
3. **Target Token Flow**: Track the net buying/selling of these filtered wallets on the target token.

## Metrics
* **Smart Money Net Flow**: Cumulative net buys/sells by Smart Money in the last 24 hours.
* **Smart Money Concentration**: $\frac{\text{Smart Money holdings}}{\text{Circulating Supply}}$.

## Detection Logic
* **Smart Money Accumulation**: Net buy flow from Smart Money is positive and represents $> 5\%$ of daily pool volume.
* **Smart Money Exit**: Realized profit-taking or complete token clearance by $> 50\%$ of tracked Smart Money wallets.

## Output Schema
```json
{
  "module": "smart_money",
  "smart_money_score": 75,
  "net_flow_usd_24h": 42000.0,
  "flow_status": "accumulation",
  "active_smart_wallets": [
    {
      "address": "0xsmart1...",
      "historical_win_rate": 0.72,
      "net_token_change_24h": "15000"
    }
  ]
}
```

## Evidence Requirements
* Transaction histories and ROI calculations for the identified smart wallets.
* Swap logs of these wallets on the target token.

## Confidence Calculation
* **High (80-100)**: Over 3 months of verified historical transaction data across multiple DeFi protocols.
* **Medium (50-79)**: Profitable trades observed but only on a single chain or index.
* **Low (0-49)**: A wallet marked smart based on only 1 or 2 lucky trades.

## Failure Conditions
* Lack of historical transaction database for the trading addresses.
* Inability to resolve historical prices of tokens traded by wallets.

## Data Limitations
* Many smart money wallets operate via private MevBots or change addresses hourly to avoid copy-traders.

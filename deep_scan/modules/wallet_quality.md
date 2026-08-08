# Module 1: Wallet Quality Analysis

## Objective
Evaluate whether holders and active traders exhibit organic, individual behaviors or appear suspicious, fresh, or coordinated (insider-like/Sybil clusters).

## Required Data
* Token transfers (ERC-20 transfer event logs).
* Native currency transfer transactions (for gas funding detection).
* Wallet creation/first transaction metadata.

## Data Sources
* Block Explorer APIs (Etherscan, Blockscout).
* Direct blockchain RPC node queries (`eth_getLogs`).

## Inputs
* Token contract address.
* List of holder addresses (top 100-1000).
* List of trading addresses (from swap events).

## Processing Logic
1. **First-Tx Tracking**: For each address, query its first recorded transaction block.
2. **Co-Funding Graph**: Build an adjacency list mapping addresses to their funding source (the account that sent them native token for gas/first-tx fees).
3. **Temporal Grouping**: Check if wallets bought/entered the token within identical block numbers or narrow time windows.

## Metrics
* **Fresh Wallet Ratio**: $\frac{\text{Wallets } < 24h \text{ old}}{\text{Total Trading Wallets}}$
* **Co-Funded Ratio**: $\frac{\text{Wallets sharing same gas fund source}}{\text{Total Trading Wallets}}$
* **Temporal Coherence**: Standard deviation of acquisition block numbers.

## Detection Logic
* **Coordinated Insiders**: If a single external wallet funds $\ge 5$ holder wallets, and those wallets purchase tokens within 3 blocks of each other, flag a "Coordinated Funding Cluster."
* **Fresh Sniper Inflow**: If $> 30\%$ of buying volume in the last hour originates from wallets $< 6$ hours old, flag "Fresh Sniper Inflow."

## Output Schema
Reference schema: `schemas/wallet.json`.
```json
{
  "module": "wallet_quality",
  "fresh_wallet_ratio": 0.24,
  "co_funded_clusters": [
    {
      "source_address": "0xabc...",
      "member_addresses": ["0x123...", "0x456..."],
      "total_tokens_held": "50000"
    }
  ]
}
```

## Evidence Requirements
* Transaction hashes linking gas funding source to target addresses.
* Blocks and timestamps of token acquisition.

## Confidence Calculation
* **High (80-100)**: Direct funding links visible on-chain.
* **Medium (50-79)**: Funding links obscured, but high temporal correlation of buys (identical blocks, identical swap amounts).
* **Low (0-49)**: Weak correlation; small holdings, single-characteristic overlap.

## Failure Conditions
* Explorer API timeouts preventing first-tx checks.
* Token transfers exceed index limit (e.g. $> 100,000$ transfers).

## Data Limitations
* Centralized Exchange (CEX) hot wallets fund many organic users, creating false co-funding signals. Must maintain CEX address whitelists.

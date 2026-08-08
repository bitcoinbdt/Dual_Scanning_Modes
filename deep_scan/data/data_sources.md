# Data Sources: Integration & Fallbacks

## Overview
To keep operational costs minimal while maintaining high data reliability, the Deep Scan engine uses a preferred hierarchy of data providers, falling back to more expensive or slower options only when necessary.

---

## 1. Provider Hierarchy
When querying information, the system searches in the following order:

```text
[Local Database & Cache]
         ↓ (Cache Miss)
[DEX Market Data APIs] (Free tier: DexScreener, GeckoTerminal)
         ↓ (Rate-limited or missing pools)
[Blockchain Indexers & Subgraphs] (The Graph, Goldsky)
         ↓ (Missing recent logs)
[Block Explorer APIs] (Etherscan, Blockscout)
         ↓ (No indexer data available)
[Direct RPC Node Connection] (Alchemy, Infura, local node)
```

---

## 2. Source Mapping by Data Type

| Data Category | Primary Source | Fallback Source | Cost Level |
| :--- | :--- | :--- | :--- |
| **Token Metadata** | Explorer API | RPC (`name()`, `decimals()`) | Free / Low |
| **AMM Reserves** | RPC (`getReserves`) | DEX Subgraph | Low (Gas-free read) |
| **Swap Logs** | Subgraph Indexer | RPC (`eth_getLogs`) | Medium / High (RPC heavy) |
| **Historical Price**| GeckoTerminal API | Subgraph candle data | Free |
| **Gas Funding** | Explorer API | RPC Transaction trace | Medium |
| **Holders List** | Explorer API | Token balance scan (RPC) | High |

---

## 3. Fallback & Failover Strategy
* **Rate Limits (HTTP 429)**: Switch instantly to a backup provider API key or different endpoint.
* **RPC Timeouts**: If `eth_getLogs` times out, partition the query block window into smaller sub-windows (e.g. query 100 blocks at a time instead of 1000).
* **Missing Pool Pairs**: If the DEX aggregator API doesn't list a pair, query the factory contracts on-chain to discover if the pool exists.

---

## 4. Cost Optimization Guidelines
1. **Cache Swaps**: Historical transaction logs are immutable. Store them in a local sqlite/postgres database; never query the same block logs twice.
2. **Batch RPC Calls**: Use Multicall contracts (`aggregate`) to retrieve reserves and balances for multiple wallets/pools in a single RPC request.
3. **De-duplicate Requests**: Ensure multiple concurrent scans for the same token use a shared pending promise pool.

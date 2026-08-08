# Data Freshness & Caching Policies

## Overview
Active trading requires fresh market data. However, making on-chain calls for every user request is expensive and rate-limiting. This document outlines caching lifetimes, data freshness requirements, and stale data rules.

---

## 1. Caching Lifetimes by Data Type

| Data Class | Lifetime (TTL) | Explanation / Context |
| :--- | :--- | :--- |
| **Token Basic Metadata** | 7 Days | Symbols, Decimals, Name, and Creator do not change. |
| **AMM Pool Registries** | 24 Hours | Factories rarely deploy new pools for the same token. |
| **Holder Balance Ledger** | 4 Hours | For exit calculations, hourly/quarter-day charts suffice. |
| **Historical Price Candles** | 1 Hour | Aggregated hourly intervals are static. |
| **Real-time Price & Reserves**| 10 Seconds | Spot reserves change block-by-block. |
| **Live websocket swaps** | Instant (No cache) | Direct mempool or head block stream. |

---

## 2. Freshness & Latency Thresholds
* **Block Latency Warning**: If the last recorded block height in the query response is $> 20$ blocks behind the current chain head, trigger a data freshness warning (`stale_data_warning: true` in `schemas/scan_output.json`).
* **Timestamp Delta**: Any pricing or reserve data older than 10 minutes must be flagged as `stale` and requires a reload from primary node RPCs.

---

## 3. Cache Invalidation Triggers
A cache reload must occur immediately if:
* Simulated position size in user input is larger than cached total pool reserves.
* Real-time monitoring detects a block reserve delta $> 10\%$ (indicating a major swap or liquidity modification).
* A force-reload flag is passed in the invocation parameters (`use_cache: false`).

---

## 4. Stale Handling in Reports
Reports generated with stale metrics must append a disclaimer at the top of the Trader Intelligence Report:
> [!WARNING]
> This report contains data that is approximately 14 minutes behind the active blockchain tip. Slippage simulations and whale balances may differ from current state.

# Deployer Wallet Behavior Profiling Specification

This document details the reputation analysis engine to be integrated into `deep_scan` for tracking deployer history, financial patterns, and connected wallets.

---

## 1. Reputation & Risk Categories

Every deployer address will be evaluated and assigned one of the following reputations:

| Status | Code | Criteria |
|---|---|---|
| **Trusted** | `trusted` | Highly active, holds own tokens long-term, added and locked LP responsibly, zero rugs. |
| **Neutral** | `neutral` | Standard developer wallet with no historical record or clean/ordinary transactions. |
| **Caution** | `caution` | Low transaction counts, young wallet, or small percentage of tokens dumped. |
| **Dangerous** | `dangerous` | Pattern of quick token creations, high dump ratios within the first hour of launch. |
| **Known Rugger** | `known_rugger` | 2+ tokens where liquidity was removed within 7 days, or verified wallet clustering ties to previously blacklisted addresses. |

---

## 2. Risk Heuristics & Scoring

An overall **Deployer Risk Score (0-100)** is calculated based on:

1. **Launch Success Rate (30%)**
   * Formula: \(\text{Success Rate} = \frac{\text{Tokens Active } > 30\text{ Days}}{\text{Total Created}}\)
   * Score reduction proportional to failed or abandoned tokens.

2. **LP Management (25%)**
   * Immediate removal of liquidity pools (\(< 7\) days) without locks triggers a critical flag.
   * Lock verification reduces risk points.

3. **Trading & Dumping Behavior (25%)**
   * Flag triggered if deployer sells \(>50\%\) of initial developer allocation within 1 hour post-launch.

4. **Wallet Clustering / Sybil Connections (20%)**
   * Inspecting transaction history to detect transfer patterns between the deployer and top token holder addresses.

---

## 3. Heuristic Data Gathering (Technical Flow)

### Solana (via `@solana/web3.js` & RPC)
1. **Locate Token Creator**: Query the oldest signature for the token mint address to find the creator address.
2. **Collect Deployer History**:
   ```typescript
   // Fetch first 100 signatures to analyze general activity
   const signatures = await connection.getSignaturesForAddress(deployerAddress, { limit: 100 });
   ```
3. **Trace LP Transfers**: Scan transactions involving liquidity provider tokens matching Raydium pool templates.

### EVM (via Ethers.js & Explorer APIs)
1. **Contract Creator Check**: Query blockchain explorer API to fetch contract creator and creation hash.
2. **Check Past Deployments**: Query transaction history for `Contract Creation` logs.
3. **Verify LP Token Locks**: Read standard locker interfaces (e.g., PinkLock, Unicrypt) for the deployer address.

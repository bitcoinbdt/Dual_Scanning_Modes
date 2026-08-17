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

---

## 4. Technical Feasibility, Cost & Implementation Details

### A. Locating Deployer / Creator Address
- **EVM**: Query Explorer API `/api?module=contract&action=getcontractcreation&contractaddresses={address}`.
  - **Feasibility**: **Highly Feasible**. Returns creator address instantly.
  - **Cost**: $0 (Standard free-tier key).
- **Solana**: Query oldest mint transaction signature using standard RPC.
  - **Feasibility**: **Highly Feasible**. Uses pagination to extract signature.
  - **Cost**: $0 (Standard RPC node request).

### B. Deployer History Auditing
- **EVM**: Query Explorer API `/api?module=account&action=txlist&address={deployer}` to list all outgoing transactions. Filter for transactions where `to` is empty (contract creations).
  - **Feasibility**: **Highly Feasible**. Explorer returns history instantly in one call.
  - **Cost**: $0 (Uses standard free-tier key).
- **Solana**: Query `getSignaturesForAddress(deployerAddress, { limit: 100 })` to fetch latest transactions. Scan metadata logs for `initialize` or `create` instructions.
  - **Feasibility**: **Highly Feasible** when limited to a window of 100 transactions. Checking full historical token creations requires indexers like Helius.
  - **Cost**: $0 (Uses standard RPC calls).
- **Limitation**: Insiders use fresh burner wallets for each deployment. When a burner wallet is detected (age < 24h, 0 prior tokens), the reputation score falls back to "Unknown" but flags the wallet freshness.

#### ✅ C-005 RESOLVED — Cross-Chain Deployer History Limitation

**Problem was**: A rugger who deploys on BSC is not caught when they launch a new token on Ethereum Base, because the deployer history lookup is single-chain only.

**Accepted Limitation**: Cross-chain wallet correlation is **out of scope for Phase 1**. The scanner operates per-chain only. This is explicitly acknowledged in the UI.

**Phase 1 Behaviour** (what we implement):
- Deployer history is checked on the **same chain** as the scanned token.
- If deployer has no history on that chain (fresh wallet), the reputation falls back to `neutral` with a `wallet_fresh: true` flag.
- The UI shows: *"New wallet — no history on this chain."*

**Phase 2 Enhancement** (future, not blocking):
- Integrate [Arkham Intelligence public entity labels](https://platform.arkhamintelligence.com/) or [Dune Analytics](https://dune.com) cross-chain wallet queries.
- Maintain a local `cross_chain_deployers` table mapping known multi-chain deployer addresses, populated by admin curation over time.



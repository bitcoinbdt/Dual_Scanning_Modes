# Codebase Gap Analysis: Current vs. Proposed Scan Architecture

This document highlights the differences between the current scanning implementation in the project and the proposed updates in `both_scan_update.md`, `deployer_profiling.md`, and `bonding_curve_funnel.md`.

---

## 1. Scanner Entry Point & Network Detection

### Current State
* **File**: [`lib/blockchain/tokenScanner.ts`](file:///d:/scanner/lib/blockchain/tokenScanner.ts)
* **Function**: `scanToken(address, chainId)`
* **Current Logic**:
  * Calls `detectNetwork(address)` which simply categorizes the token as `EVM` or `Solana` based on whether the string starts with `0x`.
  * Forwards directly to `scanSolanaToken` or `scanEVMToken`.
* **Gap**: No check is performed to identify if the address originates from a bonding curve program (like Pump.fun or Raydium LaunchLab) before routing. It assumes all tokens belong to standard on-chain pools.

---

## 2. Solana Scan Engine

### Current State
* **File**: [`lib/blockchain/solanaScanner.ts`](file:///d:/scanner/lib/blockchain/solanaScanner.ts)
* **Logic**:
  * Probes public Solana RPCs.
  * Queries `connection.getTokenSupply` and `connection.getParsedAccountInfo` to read token decimals and authorities (mint/freeze configs).
  * Uses `fetchMarketDataWithFallback` (which queries DexScreener API) for metadata and liquidity figures.
* **Gaps**:
  1. **DexScreener Fallback Vulnerability**: Active bonding curve tokens (pre-graduation) do not have pools on DexScreener yet. In these cases, DexScreener returns no pool data or fails, causing `fetchMarketDataWithFallback` to fall back to `totalLiquidityUsd: 0` and names like `"Unknown Solana Token"`. This results in false warnings of "0 liquidity" and "untradeable" token states.
  2. **No Curve Calculation**: The scanner does not query the bonding curve program (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) or calculate virtual reserves.

---

## 3. Deep Scan & Risk Scoring Engines

### Current State
* **Directory**: [`lib/deep_scan/`](file:///d:/scanner/lib/deep_scan/)
* **Key Components**:
  * [`DeepScanService.ts`](file:///d:/scanner/lib/deep_scan/DeepScanService.ts) Orchestrates multiple sub-analyzers.
  * [`RiskScoringEngine.ts`](file:///d:/scanner/lib/deep_scan/engines/RiskScoringEngine.ts) Compiles the final security score.
  * Sub-analyzers evaluate `WhaleExitSimulator`, `LiquidityStressAnalyzer`, and `AmmSlippageSimulator`.
* **Gaps**:
  1. **AMM-Centric Bias**: All existing analyzers assume the token resides in a standard AMM pool. If ran against active curve tokens, simulation calculations (e.g. slippage, exit simulator) will throw math errors or output incorrect results.
  2. **No Deployer Profile Tracking**: The engine assesses wallet concentrations but does not build historical developer reputation profiles (e.g., matching developer's previous tokens to count rug pulls).
  3. **No Age-Specific Funnel**: The risk score remains static regardless of whether a token was deployed 2 hours ago or 2 years ago.

---

## 4. Required Bridges (The Action Plan)

To transition to the robust, strengthened dual-path architecture without breaking the existing codebase:

```text
[User Scan Request]
       │
       ▼
1. Route Detection (Update tokenScanner.ts)
   ├── Check if Address is an Active Bonding Curve Token
   │     ├─ Yes: Route to NEW BondingCurveScanner
   │     └─ No: Proceed to standard Solana/EVM Scanner
   │
2. API Layer Upgrade (Update app/api/scan/basic & deep)
   ├── Prevent DexScreener fallback errors for active curves
   └── Fetch virtual curve metadata if pre-graduation
   
3. Risk Score Adjustments (Update RiskScoringEngine.ts)
   ├── Incorporate TokenAge classification (0-7 days badges)
   └── If age < 7 days, trigger NewTokenSurvivalScore weights
```

# Bonding Curve Lifecycle Funnel Specification

This document details the age-based token classification, stage gates, and survival score calculation guidelines for tokens launched via bonding curve platforms.

---

## 1. Age-Based Funnel Classification

New tokens carry elevated risk profiles that shift significantly over their first week of life. We categorize tokens into three distinct age intervals:

* **Brand New (0-72 hours)**: Extremely volatile. Primary focus is on deployer activity, initial liquidity adequacy, and immediate sell pressure.
* **New (73-168 hours)**: Focus shifts to holder growth rates, liquidity stability, and early price consolidation.
* **Established (169+ hours)**: Evaluated using standard scan engines; no special funnel badges.

---

## 2. 3-Stage Lifecycle Gates

We evaluate new tokens across three stages to determine their market health:

### Stage 1: Launch (0-24 hours)
* **Goal**: Validate creation integrity and baseline organic interest.
* **Checks**:
  * Initial Liquidity added (e.g., Target vs Current).
  * Source code verification (Explorer match).
  * Dev allocation size (\(>5\%\) triggers warning).

### Stage 2: Early Growth (24-72 hours)
* **Goal**: Track accumulation behavior and identify exit scams.
* **Checks**:
  * Holder count velocity (\(\text{Growth Rate} > 15\%\) daily is green).
  * Liquidity changes (detect if developers are draining pools).
  * Price volatility (consolidating vs pump-and-dump patterns).

### Stage 3: Momentum (3-7 days)
* **Goal**: Assess long-term survival probability.
* **Checks**:
  * Liquidity locking (PinkLock, Raydium Lock, or burned LP check).
  * Sustained daily trading volume (minimum threshold based on chain).
  * Holder distribution Gini coefficient improvement.

---

## 3. New Token Survival Score Heuristic

A **Survival Score (0-100)** is calculated for tokens in the 0-7 day window:

$$\text{Survival Score} = \text{LQ} + \text{HD} + \text{DR} + \text{TA} + \text{CS}$$

Where:
* **LQ (Liquidity Health - 25 points)**: Evaluates pool depth, lock status, and token burn percentage.
* **HD (Holder Distribution - 25 points)**: Higher scores for lower concentration in the top 10 wallets.
* **DR (Deployer Reputation - 20 points)**: Based on developer's history of previous token lifespans.
  > ✅ **NEW-009 RESOLVED** — The Deployer Reputation lookup is a slow async network call. To prevent
  > the Survival Score from blocking: call `DeployerProfiler.run()` with a **2-second timeout**.
  > If the lookup completes in time, use the reputation score. If it times out or errors,
  > default `DR = 10` (neutral, half-score) and append a note to the scan result:
  > *"Deployer reputation lookup timed out — score defaulted to neutral."*
* **TA (Trading Activity - 15 points)**: Evaluates volume consistency and buy/sell ratios.
* **CS (Contract Security - 15 points)**: Deducts points for honeypots, mintable permissions, or freeze authorities.


---

## 4. Case Study: Pepe (Graduated) vs. XXX (Active Curve)

To illustrate the importance of dynamic engine routing, let's contrast two scan scenarios:

### Scenario 1: Token `pepe` (Graduated from Pump.fun 1 Year Ago)
* **Age Classification**: Established (No age badges).
* **Funnel Stage**: Complete.
* **Scan Path**: 
  * The engine detects `pepe` originates from the Pump.fun creator address.
  * It verifies that the bonding curve is `100% graduated` and a Raydium pool exists.
  * Routing switches to the **Standard DEX Engine** to verify the current locked liquidity pool, trade tax, and holder distribution.
  * Returns standard analysis without any new-token warnings.

### Scenario 2: Token `xxx` (Launched 2 Hours Ago, Active Curve)
* **Age Classification**: Brand New (0-72h - Red Badge).
* **Funnel Stage**: Stage 1 (Launch).
* **Scan Path**:
  * The engine detects the token address but finds **no active AMM pool** on Raydium/DexScreener.
  * It checks the Pump.fun bonding curve program and detects the token's funds are **still deposited inside the curve**.
  * Routing switches to the **Bonding Curve Engine**.
  * It displays the progress (e.g. `12.4 SOL / 85 SOL (14.5% complete)`) and flags creator transactions directly on the curve (e.g. checking if the developer is already dumping on the curve).
  * Returns context-specific bonding curve diagnostics, avoiding false-positive "Zero Liquidity" errors.

---

## 5. Technical Feasibility, Cost & Implementation Details

### A. Token Age Retrieval
- **EVM (BSC/Ethereum)**:
  - **Mechanism**: Query first transaction (block-0) timestamp using Etherscan/BscScan contract creation API: `GET /api?module=contract&action=getcontractcreation&contractaddresses={address}`.
  - **Feasibility**: **Highly Feasible**. Returns creation date/block instantly.
  - **Cost**: $0 (Standard free-tier key).
- **Solana**:
  - **Mechanism**: Query first transaction signature metadata using Helius or public RPC pagination: `connection.getSignaturesForAddress(mintAddress, { limit: 1, before: undefined })`. The oldest signature timestamp returns the exact mint date.
  - **Feasibility**: **Highly Feasible**. Only 1 RPC call is required.
  - **Cost**: $0 (Standard public RPC query).

### B. Bonding Curve Progress Calculation
- **Mechanism**: Read the bonding curve account balance. For Pump.fun, the target graduation target is 85 SOL.
  - Fetch account balance using standard Web3 libraries (`connection.getBalance(bondingCurvePda)`).
  - Calculate: `Progress % = (currentBalance / 85) * 100`.
- **Feasibility**: **Highly Feasible**. Uses a simple raw account balance check.
- **Cost**: $0 (Standard RPC node request).

### ✅ NEW-001 RESOLVED — Full Pump.fun BondingCurveState Account Layout

`implementation_resolutions.md §7 (C-002)` references this section for the
Pump.fun bonding curve account deserialization. The full struct is defined here.

**BondingCurveState Layout** (Pump.fun program, Borsh-encoded, 8-byte discriminator prefix):
```typescript
// lib/solana/PumpFunCurveReader.ts

// Byte offsets after the 8-byte discriminator:
// 0:  virtualTokenReserves  (u64, 8 bytes)
// 8:  virtualSolReserves    (u64, 8 bytes)
// 16: realTokenReserves     (u64, 8 bytes)
// 24: realSolReserves       (u64, 8 bytes)
// 32: tokenTotalSupply      (u64, 8 bytes)
// 40: complete              (bool, 1 byte)

export interface BondingCurveState {
  virtualTokenReserves: bigint;  // Tokens available in virtual AMM
  virtualSolReserves: bigint;    // SOL in virtual AMM (determines price)
  realTokenReserves: bigint;     // Actual tokens held by the curve
  realSolReserves: bigint;       // Actual SOL deposited by buyers
  tokenTotalSupply: bigint;      // Total token supply
  complete: boolean;             // true = graduated to Raydium
}

export async function readPumpFunCurveState(
  connection: Connection,
  bondingCurvePda: PublicKey
): Promise<BondingCurveState | null> {
  const accountInfo = await connection.getAccountInfo(bondingCurvePda);
  if (!accountInfo?.data) return null;

  const data = accountInfo.data;
  const offset = 8; // Skip 8-byte discriminator
  return {
    virtualTokenReserves: data.readBigUInt64LE(offset),
    virtualSolReserves:   data.readBigUInt64LE(offset + 8),
    realTokenReserves:    data.readBigUInt64LE(offset + 16),
    realSolReserves:      data.readBigUInt64LE(offset + 24),
    tokenTotalSupply:     data.readBigUInt64LE(offset + 32),
    complete:             data[offset + 40] === 1,
  };
}
```

**Deriving the bonding curve PDA**:
```typescript
const [bondingCurvePda] = PublicKey.findProgramAddressSync(
  [Buffer.from('bonding-curve'), mintAddress.toBuffer()],
  new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')
);
```

**Spot price from virtual reserves**:
```
currentPrice (SOL per token) = virtualSolReserves / virtualTokenReserves
```
This is the constant-product formula (x × y = k) applied to the virtual pool.
Convert to USD by multiplying by the current SOL/USD price.

**Graduation check**: `complete === true` means the curve has migrated to
Raydium. Route to the standard DEX engine in this case.




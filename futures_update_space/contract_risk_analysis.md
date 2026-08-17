# Smart Contract Code Risk Analysis

This document specifies on-chain contract code risk detection for both EVM
and Solana tokens — covering proxy upgradability, hidden minting, hidden
ownership, time-locks, and blacklist functions. This intelligence is consumed
by the Risk Scoring Engine and displayed as objective facts in the Deep Scan
report.

> **Scope note**: EVM tokens already pass through GoPlus Security API
> (`lib/blockchain/goPlusSecurity.ts`). This document extends that foundation
> with additional checks that GoPlus does not cover, and adds Solana-native
> authority checks.

---

## 1. Current State (What GoPlus Already Returns)

From `goPlusSecurity.ts`, the scanner already reads:

| GoPlus Field | Meaning | Current Use |
|---|---|---|
| `is_honeypot` | Cannot sell token | Used in RiskScoringEngine mitigator |
| `buy_tax` / `sell_tax` | % fee on swap | Displayed |
| `is_mintable` | Owner can mint new supply | Stored |
| `is_proxy` | Upgradeable contract | Stored but NOT risk-weighted |
| `transfer_pausable` | Owner can freeze all transfers | Stored but NOT risk-weighted |
| `is_blacklisted` | Owner can blacklist wallets | Stored but NOT risk-weighted |
| `trading_cooldown` | Time delay between trades | Stored but NOT risk-weighted |
| `owner_change_balance` | Owner can modify wallet balances | Stored but NOT risk-weighted |
| `can_take_back_ownership` | Renounced but re-takeable | Stored but NOT risk-weighted |
| `creator_address` | Deployer address | Passed to BuyerQualityAnalyzer |

**Gap**: GoPlus fields are fetched but most are not mapped to risk signals or
risk score contributions. They sit in the data layer without intelligence weight.

---

## 2. EVM Contract Risk Signals (Missing Risk Weights)

The following signals should be added to `RiskScoringEngine.ts` as named signals:

| Signal ID | Source Field | Condition | Severity | Risk Score Contribution |
|---|---|---|---|---|
| `CTR-001` | `is_proxy` | Proxy contract (upgradeable) | `medium` | +8 points |
| `CTR-002` | `transfer_pausable` | Owner can pause transfers | `high` | +12 points |
| `CTR-003` | `is_blacklisted` | Owner can blacklist wallets | `high` | +10 points |
| `CTR-004` | `owner_change_balance` | Owner can modify balances | `critical` | +20 points |
| `CTR-005` | `can_take_back_ownership` | Renounced but recallable | `high` | +15 points |
| `CTR-006` | `is_mintable` | Unlimited mint authority | `high` | +12 points |
| `CTR-007` | `trading_cooldown` | Cooldown on buys/sells | `low` | +3 points |

**Important**: These are additive to the existing weighted score. The current
`RiskScoringEngine.ts` has a mitigator for renounced ownership (`-10 points`).
That mitigator is **cancelled** if `can_take_back_ownership = true`.

---

## 3. Solana-Specific Authority Checks

GoPlus does **not** support Solana. The Solana scanner (`solanaScanner.ts`)
already queries `connection.getParsedAccountInfo` for the token mint. Extract:

```typescript
interface SolanaAuthorityStatus {
  // Mint authority: can create new tokens
  mintAuthority: string | null;   // null = permanently revoked (safe)
  mintAuthorityRevoked: boolean;  // true = mintAuthority is null

  // Freeze authority: can freeze any wallet's token account
  freezeAuthority: string | null; // null = permanently revoked (safe)
  freezeAuthorityRevoked: boolean;

  // Upgrade authority (program accounts only)
  upgradeAuthority: string | null; // null = immutable program
}
```

Risk signals for Solana:

| Signal ID | Condition | Severity | Score Contribution |
|---|---|---|---|
| `SOL-CTR-001` | `mintAuthority` is NOT null (can mint more tokens) | `high` | +12 points |
| `SOL-CTR-002` | `freezeAuthority` is NOT null (can freeze wallets) | `high` | +10 points |
| `SOL-CTR-003` | `upgradeAuthority` is NOT null AND token < 30 days old | `medium` | +6 points |

**Solana source**: `connection.getParsedAccountInfo(mintAddress)` already called
in `solanaScanner.ts` — the data is there, just not wired to risk signals.

---

## 4. Concentrated Supply Risk (Gini Coefficient)

The scanner has `VolumeConcentrationAnalyzer.ts` (HHI-based). This should be
supplemented with a **Gini Coefficient** calculation on token holder distribution,
which is a more intuitive metric for professional traders.

### Gini Formula
```
Gini = (2 * sum(rank_i * balance_i)) / (N * total_supply) - (N + 1) / N
where wallets are sorted ascending by balance
```

| Gini Range | Classification | Risk |
|---|---|---|
| 0.00 – 0.40 | Distributed | Low |
| 0.41 – 0.65 | Moderate Concentration | Medium |
| 0.66 – 0.85 | High Concentration | High |
| 0.86 – 1.00 | Extreme Concentration | Critical |

**Data source**: `HolderInfo[]` already returned by the Elevator collectors.
For EVM chains where `holdersStatus = 'unavailable'`, skip Gini and return
`status: 'insufficient_data'`.

#### ✅ C-015 RESOLVED — EVM Gini Always Returns `insufficient_data`

**Problem was**: Most EVM tokens (especially new micro-caps on Base and BSC) do
not have `HolderInfo[]` in the Elevator collectors, making Gini useless for EVM.

**Resolution — EVM Holder Distribution Fallback**:
When the Elevator returns `holdersStatus = 'unavailable'` for an EVM token,
the backend attempts a fallback query to the block explorer API:

```typescript
// Fallback: Etherscan / BscScan token holder list
// GET /api?module=token&action=tokenholderlist&contractaddress={addr}&page=1&offset=100
// Returns: [ { TokenHolderAddress, TokenHolderQuantity }, ... ]

async function fetchEVMHolders(
  tokenAddress: string,
  chainId: string
): Promise<HolderInfo[] | null> {
  const explorerUrl = EXPLORER_API_MAP[chainId]; // e.g. api.etherscan.io
  const res = await fetch(
    `${explorerUrl}?module=token&action=tokenholderlist` +
    `&contractaddress=${tokenAddress}&page=1&offset=100&apikey=${process.env.EXPLORER_API_KEY}`
  );
  const data = await res.json();
  if (data.status !== '1') return null;
  return data.result.map((h: any) => ({
    address: h.TokenHolderAddress,
    balance: BigInt(h.TokenHolderQuantity),
  }));
}
```

| Chain | Explorer API | Free Tier |
|---|---|---|
| Ethereum | `api.etherscan.io` | 5 req/sec |
| BSC | `api.bscscan.com` | 5 req/sec |
| Base | `api.basescan.org` | 5 req/sec |
| Polygon | `api.polygonscan.com` | 5 req/sec |

**Fallback cascade**:
1. Use Elevator `HolderInfo[]` if available.
2. If not, query block explorer API for top-100 holders.
3. If that also fails (rate limit / unsupported chain), return `status: 'insufficient_data'`.

**Cache**: Explorer holder list is cached for **30 minutes** to avoid excessive API usage.


### UI Display
```
Holder Gini: 0.73  [High Concentration]
Top 10 wallets own 61.4% of supply
```
No label like "dangerous" or "safe" — only the number and classification.

---

## 5. Multi-Position Slippage Tiers (Extending AmmSlippageSimulator)

Current `AmmSlippageSimulator.ts` tests only `$25,000` and one other fixed
position size. Professional traders need a **tiered ladder**:

| Tier | Position Size | Audience |
|---|---|---|
| T1 | $1,000 | Retail/small |
| T2 | $5,000 | Active retail |
| T3 | $25,000 | Semi-professional (current) |
| T4 | $100,000 | Professional / fund |
| T5 | $500,000 | Whale / institution |

Only simulate tiers where `positionSizeUsd < poolLiquidityUsd * 0.5` — beyond
50% of pool depth, the result is unreliable for a V2 model. Report `status:
'insufficient_data'` for over-depth tiers.

### UI Display (Deep Scan — Slippage Ladder)
```
Exit Impact Simulation:
  $1,000    →  0.12% slippage   [Low Risk]
  $5,000    →  0.61% slippage   [Low Risk]
  $25,000   →  3.1%  slippage   [Medium Risk]
  $100,000  →  12.4% slippage   [High Risk]
  $500,000  →  N/A (exceeds pool depth)
```

---

## 6. Codebase Integration Points

| File | Change Required |
|---|---|
| `lib/blockchain/goPlusSecurity.ts` | Already fetches GoPlus fields. No change needed. |
| `lib/deep_scan/engines/RiskScoringEngine.ts` | **[MODIFY]** Add CTR-001 to CTR-007 as named risk signals with score weights |
| `lib/blockchain/solanaScanner.ts` | **[MODIFY]** Wire `mintAuthority`/`freezeAuthority` null-checks to SOL-CTR signals |
| `lib/deep_scan/engines/VolumeConcentrationAnalyzer.ts` | **[MODIFY]** Add Gini coefficient computation alongside existing HHI |
| `lib/deep_scan/engines/AmmSlippageSimulator.ts` | **[MODIFY]** Extend from 2 position sizes to 5-tier ladder |
| `lib/deep_scan/types.ts` | **[MODIFY]** Add `contractRisk: ContractRiskResult` to `DeepScanResult` |

---

## 7. Technical Feasibility, Cost & Implementation Details

### A. EVM / GoPlus Risk Wiring
- **Mechanism**: The GoPlus security query is already implemented. The logic change is purely in `RiskScoringEngine.ts` to add standard conditional checks:
  ```typescript
  if (params.isProxy) overallScore += 8;
  if (params.isBlacklisted) overallScore += 10;
  ```
  - **Feasibility**: **Highly Feasible**. Changes are in local logic only.
  - **Cost**: $0 (0 additional external requests).

### B. Solana Authority Verification
- **Mechanism**: Standard RPC `getParsedAccountInfo` returns mint details (including `mintAuthority` and `freezeAuthority` addresses). If these values are `null`, the authorities are revoked.
  - **Feasibility**: **Highly Feasible**. Data is already fetched during the Solana scan; it only needs mapping to risk signals.
  - **Cost**: $0 (Uses standard RPC calls).

### C. Gini Coefficient & Slippage Ladder Calculations
- **Gini**: Local in-memory math sorting `HolderInfo[]` in ascending order:
  - Time complexity: $O(N \log N)$ where $N \le 100$ top holders. Complete execution is $<1$ millisecond.
- **Slippage Ladder**: Mathematical formula loop executed 5 times instead of 2.
  - Time complexity: $O(1)$. Complete execution is $<0.5$ milliseconds.
  - **Feasibility**: **Highly Feasible**. No external API calls are made for these calculations.
  - **Cost**: $0.


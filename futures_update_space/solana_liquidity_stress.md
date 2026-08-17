# Solana Raydium Pool Liquidity Stress Analysis

`LiquidityStressAnalyzer.ts` currently returns `status: 'insufficient_data'`
for **all Solana tokens**. This means every Deep Scan on a Solana token has
zero liquidity stress intelligence — a major gap given that Solana is the
dominant chain for new token launches.

This document specifies a Solana-native liquidity stress model that mirrors
the EVM V2 implementation already in the engine.

---

## 1. Why This Gap Exists

The existing `LiquidityStressAnalyzer.ts` reads on-chain V2 pool reserves
from `historical_pool_reserves` — a table populated by
`HistoricalPoolReservesIndexer.ts`, which is **EVM-only** (uses `ethers.js`
provider calls). There is no equivalent Solana reserve indexer.

Additionally, the stress analyzer requires `NormalizedPoolState` with
`reserve0` and `reserve1` as `BigInt` values, which must be sourced from
Raydium pool account data.

---

## 2. Raydium Pool Types & Support Matrix

| Pool Type | Solana Program | Model | Supported? |
|---|---|---|---|
| Raydium AMM V4 (Legacy) | `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8` | Constant-product (V2-style) | ✅ Yes |
| Raydium CLMM | `CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK` | Concentrated liquidity | ❌ Skip (same as EVM V3) |
| Raydium CPMM (CP-Swap) | `CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C` | Constant-product | ✅ Yes |
| Orca Whirlpool | `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc` | Concentrated liquidity | ❌ Skip |
| Meteora DLMM | `LBUZKhRxPF3XUpBCjp4YzTKgLe4eLDTT8nfH1fP6N7B` | Bin-based liquidity | ❌ Skip |

For pools that cannot be modelled, return `status: 'insufficient_data'` with
a clear `reason` string describing which pool type was detected and why it
was skipped.

---

## 3. On-Chain Data Source: Raydium Pool Accounts

### V4 AMM Pool State
Raydium V4 pool accounts store reserves directly. Read via Helius RPC:

```typescript
// Pool state layout for Raydium V4 AMM
interface RaydiumV4PoolState {
  pcVaultBalance: bigint;     // Quote token reserve (usually SOL/USDC)
  coinVaultBalance: bigint;   // Base token reserve
  pcDecimals: number;
  coinDecimals: number;
  lpSupply: bigint;
}
```

**API call sequence**:
1. Identify the pool address from DexScreener's `/pairs` response
   (`pairAddress` field for Raydium pairs)
2. Call `connection.getAccountInfo(poolAddress)` to get raw buffer
3. Deserialize using the Raydium V4 AMM layout

### ✅ C-003 RESOLVED — Borsh Package & Serverless Strategy

**Problem was**: The full `@raydium-io/raydium-sdk` is 50MB+ and causes
serverless cold-start failures and Vercel bundle limit errors.

**Resolution**: Do NOT import the full Raydium SDK. Use one of the following
two approaches in priority order:

**Approach A (Primary) — Raydium Public REST API (No SDK)**:
```typescript
// Zero bundle impact. Raydium exposes reserves directly as JSON.
const res = await fetch(
  `https://api.raydium.io/v2/ammV3/ammInfo?ids=${poolAddress}`,
  { next: { revalidate: 60 } } // Next.js 60-second cache
);
const data = await res.json();
const baseReserve = BigInt(data[0].baseReserve);   // Already parsed
const quoteReserve = BigInt(data[0].quoteReserve);
```
- **Feasibility**: Highly Feasible. No SDK, no bundle issues.
- **Cost**: $0 (Public Raydium API).
- **Latency**: ~100ms. Cache for 60 seconds.

**Approach B (Fallback) — Minimal Manual Borsh Layout**:
If the REST API is down, manually decode only the vault pubkeys using
`@solana/web3.js` (already a dependency) + a hand-written 8-field offset map.
Do NOT install `@raydium-io/raydium-sdk` for this purpose alone.
```typescript
// Read vault pubkeys at known byte offsets in V4 pool state buffer
// coinVaultOffset = 336, pcVaultOffset = 368 (from community V4 layout docs)
const coinVaultPubkey = new PublicKey(buffer.slice(336, 368));
const pcVaultPubkey = new PublicKey(buffer.slice(368, 400));
// Then call getTokenAccountBalance on each vault
```

4. Extract `coinVaultBalance` and `pcVaultBalance` as BigInt reserves

**Alternative (no borsh)**:
Use Helius `getAsset` or `getProgramAccounts` with the pool address directly.
Raydium also exposes a REST API: `https://api.raydium.io/v2/ammV3/ammInfo`
that returns `baseReserve` and `quoteReserve` in human-readable form — use
this as a fallback if raw deserialization is unreliable.


### CPMM Pool State
Same constant-product model. Raydium CPMM stores reserves in token vault
accounts. Read the vault token accounts via `getTokenAccountBalance`.

---

## 4. Normalized Pool State Mapping

Convert Raydium reserves to the `NormalizedPoolState` shape that
`LiquidityStressAnalyzer.ts` already understands:

```typescript
function toSolanaPoolState(
  coinVault: bigint,      // base token raw amount
  pcVault: bigint,        // quote token raw amount (SOL or USDC)
  coinDecimals: number,
  pcDecimals: number,
  spotPriceUsd: number,
  poolAddress: string,
  poolType: 'raydium-v4' | 'raydium-cpmm'
): NormalizedPoolState {
  return {
    reserve0: coinVault,        // BigInt, raw token units
    reserve1: pcVault,          // BigInt, raw quote units
    decimals0: coinDecimals,
    decimals1: pcDecimals,
    spotPriceUsd,
    poolLiquidityUsd: /* calculate from reserves + price */,
    poolAddress,
    poolModel: 'constant-product',
    swapFee: poolType === 'raydium-v4' ? 0.0025 : 0.003, // V4=0.25%, CPMM=0.3%
    swapFeeKnown: true,
    reserveProvenance: 'observed',  // Direct on-chain read
    snapshotAt: Date.now() / 1000,
    chain: 'solana',
  };
}
```

Once mapped, pass directly to the existing
`LiquidityStressAnalyzer.analyzeLiquidity()` — no other changes needed in
the analyzer engine itself.

---

## 5. Historical Reserve Snapshots for Solana

The EVM path uses `historical_pool_reserves` table to run trend analysis
(liquidity growing/shrinking over time). For Solana:

- **Phase 1 (MVP)**: Use a single current-snapshot only — no historical trend.
  Return `liquidityTrend: 'insufficient_data'` in the stress report.
- **Phase 2**: Extend `HistoricalPoolReservesIndexer.ts` to support Solana
  pool accounts via Helius RPC, storing snapshots in the same table with
  `chain = 'solana'`. Run indexer every 30 minutes per active pool.

---

## 6. Caching

Reserve data from Raydium changes with every trade. Cache aggressively for
consistency within a single scan session, but short enough to avoid stale data:

```typescript
// Cache key: "raydium_reserves:<poolAddress>"
// TTL: 60 seconds (matches existing market data cache policy in GEMINI.md)
```

---

## 7. Codebase Integration Points

| File | Change |
|---|---|
| `lib/deep_scan/engines/LiquidityStressAnalyzer.ts` | Remove blanket Solana skip. Add pool-type gate that accepts `raydium-v4` and `raydium-cpmm`. |
| `lib/solana/RaydiumPoolReader.ts` | **[NEW]** Fetches and deserializes Raydium V4 / CPMM pool state |
| `lib/solana/RaydiumPoolResolver.ts` | **[NEW]** Resolves pool address from token address via DexScreener pairAddress |
| `lib/deep_scan/DeepScanService.ts` | For Solana deep scans, call `RaydiumPoolReader` before `LiquidityStressAnalyzer` |
| `lib/deep_scan/historical/HistoricalPoolReservesIndexer.ts` | Phase 2: Add Solana branch using Helius RPC |

---

## 8. Technical Feasibility, Cost & Implementation Details

### A. Raydium Pool Account Query
- **Mechanism**: The Raydium V4 AMM pool state account is a standard Solana account.
  - Query via `connection.getAccountInfo(new PublicKey(poolAddress))`.
  - Parse the raw `accountInfo.data` buffer using the standard Raydium V4 Borsh layout (available from `@raydium-io/raydium-sdk` or standard community definitions).
  - Extract the base vault and quote vault public keys.
  - Run a batch `connection.getMultipleAccountsInfo([baseVault, quoteVault])` to extract the raw token reserves (`amount` field in the SPL token account layout).
- **Feasibility**: **Highly Feasible**. All standard Web3 nodes support this directly.
- **Cost**: $0 (Standard public RPC requests).
- **Latency**: ~80ms to 150ms.

### B. Fallback REST Option
- **Mechanism**: If Borsh decoding fails or is unstable, query Raydium's public API: `GET https://api.raydium.io/v2/ammV3/ammInfo?ids={poolAddress}`.
- **Feasibility**: **Highly Feasible**. Raydium's public API returns JSON reserves.
- **Cost**: $0 (Free public API).
- **Caching**: Vault balances are cached for **60 seconds** to prevent duplicate RPC calls for concurrent scans on the same token.


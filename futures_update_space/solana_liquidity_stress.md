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
3. Deserialize using Raydium V4 AMM layout (borsh schema)
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

# Elevator Scan — As-Built System Documentation

> **Documentation type:** Technical portfolio / as-built reference.
> **Source of truth:** Repository source code, verified file-by-file.
> **No roadmaps, no speculative future features. Every claim is grounded in a real file and line.**

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [API Entry Point](#2-api-entry-point)
3. [Request Contract](#3-request-contract)
4. [Credit Tiering & Transaction Limits](#4-credit-tiering--transaction-limits)
5. [Authentication & Credit Deduction](#5-authentication--credit-deduction)
6. [Chain Detection & EVM Auto-Resolution](#6-chain-detection--evm-auto-resolution)
7. [Collector Factory & Dispatch](#7-collector-factory--dispatch)
8. [Solana Data Collection Pipeline](#8-solana-data-collection-pipeline)
   - [8a. OHLCV — Birdeye](#8a-ohlcv--birdeye)
   - [8b. Transaction Ingestion — Helius](#8b-transaction-ingestion--helius)
   - [8c. DEX Trade Enrichment — GeckoTerminal](#8c-dex-trade-enrichment--geckoterminal)
   - [8d. Merge Strategy: Helius + GeckoTerminal](#8d-merge-strategy-helius--geckoterminal)
   - [8e. Trade Aggregation](#8e-trade-aggregation)
   - [8f. Wallet Balance & Holder Derivation](#8f-wallet-balance--holder-derivation)
   - [8g. Metric Calculation](#8g-metric-calculation)
   - [8h. Holder Spike Detection](#8h-holder-spike-detection)
   - [8i. System Address Filtering](#8i-system-address-filtering)
9. [BSC / ETH Data Collection Pipeline](#9-bsc--eth-data-collection-pipeline)
   - [9a. OHLCV — Birdeye](#9a-ohlcv--birdeye)
   - [9b. Swap Transactions — GeckoTerminal (Primary)](#9b-swap-transactions--geckoterminal-primary)
   - [9c. Fallback — Birdeye Trades](#9c-fallback--birdeye-trades)
   - [9d. Wallet Balance & Holder Derivation](#9d-wallet-balance--holder-derivation)
   - [9e. GoldRush On-Chain Holder List (Conditional)](#9e-goldrush-on-chain-holder-list-conditional)
   - [9f. Metric Calculation](#9f-metric-calculation)
   - [9g. Holder Spike Detection & System Address Filtering](#9g-holder-spike-detection--system-address-filtering)
10. [Post-Collection Pipeline (All Chains)](#10-post-collection-pipeline-all-chains)
    - [10a. Wash Trading Detection](#10a-wash-trading-detection)
    - [10b. CEX Exchange Tagging & Flow Calculation](#10b-cex-exchange-tagging--flow-calculation)
    - [10c. Gas & DEX Fee Estimation](#10c-gas--dex-fee-estimation)
    - [10d. On-Chain Transaction Verification](#10d-on-chain-transaction-verification)
    - [10e. Network Health Probe](#10e-network-health-probe)
11. [Response Schema](#11-response-schema)
12. [Error Handling & Credit Refund](#12-error-handling--credit-refund)
13. [Runtime Configuration](#13-runtime-configuration)
14. [External APIs & Providers Summary](#14-external-apis--providers-summary)
15. [Source Code Map](#15-source-code-map)

---

## 1. Purpose & Scope

The **Elevator Scan** is a mid-tier token analysis scan that collects on-chain DEX trade history, OHLCV price data, wallet distribution, holder metrics, wash trading signals, exchange flow, and trust verification across **Solana**, **BSC**, and **Ethereum** networks.

It is designed to occupy the space between the lightweight Basic Scan (GoPlus static contract data) and the Deep Scan (full wallet enrichment graph analysis). The credit cost and transaction limit are both configurable by the caller at runtime.

---

## 2. API Entry Point

| Property | Value |
|---|---|
| **Route** | `POST /api/scan/elevator` |
| **File** | [`app/api/scan/elevator/route.ts`](file:///d:/scanner/app/api/scan/elevator/route.ts) |
| **Runtime** | Node.js (`export const runtime = 'nodejs'`) |
| **Max Duration** | 60 seconds (`export const maxDuration = 60`) |

---

## 3. Request Contract

```json
{
  "address":        "<token address>",
  "creditsSpent":   10,
  "preferredChain": "eth" | "bsc" | "solana"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `address` | `string` | **Yes** | Token contract address on any supported chain |
| `creditsSpent` | `number` | No (default `10`) | Must be one of `5`, `10`, `20`, or `30`. Validated server-side at [`route.ts:143`](file:///d:/scanner/app/api/scan/elevator/route.ts#L143) |
| `preferredChain` | `'eth' \| 'bsc' \| 'solana'` | No | Disambiguates EVM addresses; if absent and the address is EVM-format, auto-detection is attempted |

**Authentication:** Bearer JWT token is required in the `Authorization` header. The server calls `supabase.auth.getUser(token)` to validate the session ([`route.ts:51`](file:///d:/scanner/app/api/scan/elevator/route.ts#L51)).

---

## 4. Credit Tiering & Transaction Limits

Implemented in [`lib/elevator/collectors/config.ts`](file:///d:/scanner/lib/elevator/collectors/config.ts) — function [`getCollectorConfig`](file:///d:/scanner/lib/elevator/collectors/config.ts#L10).

| Credits Spent | Max Transactions | Tier Name |
|---|---|---|
| ≤ 5 | 50 | `quick_peek` |
| ≤ 10 | 100 | `standard` |
| ≤ 20 | 200 | `professional` |
| > 20 | 500 | `institutional` |

The `maxTransactions` value is passed directly to the collector's `collect()` method and used to bound all data-fetching loops.

---

## 5. Authentication & Credit Deduction

### Credit Deduction (Atomic)

Before any data collection begins, credits are deducted from the user's balance using the Supabase RPC function `deduct_credits_for_scan` ([`route.ts:151`](file:///d:/scanner/app/api/scan/elevator/route.ts#L151)):

```typescript
await supabase.rpc('deduct_credits_for_scan', {
  p_user_id:      user.id,
  p_amount:       creditsSpent,
  p_scan_type:    'ELEVATOR',
  p_token_address: address,
  p_scan_id:      scanId,   // UUID generated with crypto.randomUUID()
})
```

- A UUID `scanId` is generated at the start of every request for **database-level idempotency**.
- If the RPC returns an error message containing `'Insufficient credit balance'`, HTTP `402` is returned immediately without running the scan.

### Credit Refund (Error Recovery)

If any error occurs after credits are deducted, the catch block calls the Supabase RPC `refund_credits_for_scan` with the same `scanId` ([`route.ts:381`](file:///d:/scanner/app/api/scan/elevator/route.ts#L381)):

```typescript
await supabase.rpc('refund_credits_for_scan', {
  p_user_id:       userId,
  p_amount:        creditsSpentVal,
  p_scan_type:     'ELEVATOR',
  p_token_address: tokenAddr,
  p_scan_id:       scanId,
})
```

A local boolean `refundIssued` prevents double-refunding within a single request lifecycle.

---

## 6. Chain Detection & EVM Auto-Resolution

### Static Format Detection

The function [`detectChain`](file:///d:/scanner/lib/elevator/utils/chainDetector.ts#L23) in [`lib/elevator/utils/chainDetector.ts`](file:///d:/scanner/lib/elevator/utils/chainDetector.ts) classifies the address by regex:

| Pattern | Classification |
|---|---|
| `/^0x[a-fA-F0-9]{40}$/` | EVM (BSC or Ethereum) |
| `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/` | Solana (base58) |
| All others | `unknown` / `unsupported_format` |

If `preferredChain` is supplied, cross-chain mismatches (e.g. Solana address + `preferredChain=eth`) return a `WRONG_CHAIN` error immediately.

If the address is EVM-format and no `preferredChain` is given, `reason: 'ambiguous_evm'` is returned by `detectChain`.

### Dynamic EVM Chain Auto-Detection

When the result is `ambiguous_evm`, the route calls [`autoDetectChainId`](file:///d:/scanner/lib/blockchain/evmScanner.ts#L88) from [`lib/blockchain/evmScanner.ts`](file:///d:/scanner/lib/blockchain/evmScanner.ts) ([`route.ts:79`](file:///d:/scanner/app/api/scan/elevator/route.ts#L79)):

- Probes configured EVM chains **in parallel** using `ethers.JsonRpcProvider.getCode(address)`.
- If bytecode is found on a chain, that chain ID is returned.
- Chain ID `'56'` → resolved as `'bsc'`; any other → resolved as `'eth'`.
- Defaults to `'1'` (Ethereum) if no bytecode is found on any chain.

---

## 7. Collector Factory & Dispatch

[`lib/elevator/collectors/CollectorFactory.ts`](file:///d:/scanner/lib/elevator/collectors/CollectorFactory.ts) instantiates the correct collector based on the resolved chain:

```typescript
CollectorFactory.create('solana' | 'bsc' | 'eth', {
  BIRDEYE_API_KEY: birdeyeKey,
  HELIUS_API_KEY:  heliusKey,
})
```

| Chain | Collector Class |
|---|---|
| `'solana'` | [`SolanaCollector`](file:///d:/scanner/lib/elevator/collectors/solana/SolanaCollector.ts) |
| `'bsc'` | [`BscCollector`](file:///d:/scanner/lib/elevator/collectors/bsc/BscCollector.ts) |
| `'eth'` | [`EthCollector`](file:///d:/scanner/lib/elevator/collectors/eth/EthCollector.ts) |

All three collectors implement the [`IBlockchainCollector`](file:///d:/scanner/lib/elevator/collectors/types.ts#L157) interface defined in [`lib/elevator/collectors/types.ts`](file:///d:/scanner/lib/elevator/collectors/types.ts).

**Required API keys per chain:**

| Chain | Required Keys |
|---|---|
| Solana | `BIRDEYE_API_KEY`, `HELIUS_API_KEY` |
| BSC | `BIRDEYE_API_KEY` |
| ETH | `BIRDEYE_API_KEY` |

Missing keys result in HTTP `500` before any collection is attempted ([`route.ts:184–201`](file:///d:/scanner/app/api/scan/elevator/route.ts#L184)).

---

## 8. Solana Data Collection Pipeline

Implemented in [`lib/elevator/collectors/solana/SolanaCollector.ts`](file:///d:/scanner/lib/elevator/collectors/solana/SolanaCollector.ts), method [`collect()`](file:///d:/scanner/lib/elevator/collectors/solana/SolanaCollector.ts#L180).

The collection proceeds in four numbered steps logged to console:

```
[STEP 1/4] Fetching OHLCV from Birdeye...
[STEP 2/4] Fetching transactions from Helius...
[STEP 2b/4] Fetching DEX trades from GeckoTerminal...
[STEP 3/4] Building wallet balances...
[STEP 4/4] Calculating metrics...
```

Each step is individually try/caught. A failure in any step degrades gracefully to an empty default without aborting the overall collection.

### 8a. OHLCV — Birdeye

**File:** [`lib/elevator/collectors/solana/birdeye.ts`](file:///d:/scanner/lib/elevator/collectors/solana/birdeye.ts)

- **Endpoint:** `GET https://public-api.birdeye.so/defi/ohlcv`
- **Params:** `address`, `type=15m`, `time_from=now-86400`, `time_to=now` (last 24 hours)
- **Auth header:** `X-API-KEY: <BIRDEYE_API_KEY>`, `x-chain: solana`
- **Output fields normalized:** `unixTime|timestamp` → `timestamp`, `o|open` → `open`, `c|close` → `close`, `v|volume` → `volume`
- **Returns:** `OHLCVCandle[]` — 15-minute OHLCV candles for the last 24 hours

If the response contains no items, an error is thrown and `ohlcv = []` is used for subsequent metric calculations.

### 8b. Transaction Ingestion — Helius

**File:** [`lib/elevator/collectors/solana/helius.ts`](file:///d:/scanner/lib/elevator/collectors/solana/helius.ts), function [`fetchTransactions`](file:///d:/scanner/lib/elevator/collectors/solana/helius.ts#L139)

- **Endpoint:** `GET https://api.helius.xyz/v0/addresses/{address}/transactions`
- **Pagination:** Cursor-based using `before` parameter; 100 transactions per batch; up to `maxTransactions` total
- **Retry logic:** Up to 3 retries with 600ms delay on failure
- **Rate limiting:** 300ms sleep between batches

**Normalization** ([`normalizeTransaction`](file:///d:/scanner/lib/elevator/collectors/solana/helius.ts#L57)):
- Filters by `targetMint` — only `tokenTransfers` where `transfer.mint === targetMint` are included
- Extracts `fromUserAccount`, `toUserAccount`, `tokenAmount`, `mint` into typed `TokenTransfer` records
- Collects all unique wallet addresses (including `feePayer`) into a `wallets` set

**Swap / Trade Detection** ([`helius.ts:100–120`](file:///d:/scanner/lib/elevator/collectors/solana/helius.ts#L100)):

A transaction is flagged as a trade (`isTrade = true`) if:
- `tx.source` is one of: `JUPITER`, `RAYDIUM`, `ORCA`, `SERUM`, `METEORA`, `LIFINITY`, `ALDRIN`, `STEP_FINANCE`, `CREMA`, `PUMP`
- OR `tx.type` contains the substring `SWAP`
- OR any instruction's `programId` is in the `SOLANA_DEX_PROGRAMS` set

**Known DEX program IDs hardcoded in `SOLANA_DEX_PROGRAMS`:**

| Program | ID |
|---|---|
| Raydium V4 AMM | `675k1q2c2T6m779aoxxX48BudGXWv97Qr4BDG87paL18` |
| Raydium CLMM | `CAMMC7Jbi2gTYccZ4t1gnhsihjh29yb2y2wqShH6A1E3` |
| Jupiter v6 | `JUP6LkbZbjS1jKKbbRB67cjSsCc49GVvpjC285137LM` |
| Orca Whirlpool | `whirSpFb6fc49YrevjZgx7Ko6sD4iPr2Sm8DTrG7dVY` |
| Meteora | `24Uqj9J6jxYiGLNsgeW9msiw1xN24sa58CcG9w8AK3mG` |
| Meteora DLMM | `LBRaCz9coTvCR6yURJfKTY2yJE461Pk6ziw21XRs59r` |
| Serum V3 | `9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin` |
| Lifinity | `EewJydroVMLEnd8cJeLY2dBXQXkpcB6sok996g3jJifg` |
| Aldrin | `AMM55xQq7bVrrw67kE54ywHE695jmW1mP5K4px7ZC7tA` |
| Step Finance | `Dooar9JkhdND4o1Y5K15cxX4x8t8as51D76R1K4tFdQG` |
| Crema | `CTMAaa74M55EjnwAhd6FZEhxS4E1mF4Kdf1GfB87CD5D` |

**Important limitation:** The Helius collector (as of current code) cannot determine buy/sell direction on its own. All Helius-originated transfers are typed as `'transfer'` in `detectTransactionType()` ([`SolanaCollector.ts:109–116`](file:///d:/scanner/lib/elevator/collectors/solana/SolanaCollector.ts#L109)). Buy/sell direction is only resolved when a matching GeckoTerminal trade is found in the merge step below.

### 8c. DEX Trade Enrichment — GeckoTerminal

**File:** [`lib/elevator/collectors/shared/geckoTerminal.ts`](file:///d:/scanner/lib/elevator/collectors/shared/geckoTerminal.ts), function [`fetchGeckoTerminalTrades`](file:///d:/scanner/lib/elevator/collectors/shared/geckoTerminal.ts#L197)

- **Base URL:** `https://api.geckoterminal.com/api/v2`
- **No API key required** (free public tier)
- **Rate limit:** 1,200ms sleep between requests (~30 req/min)
- **Accept header:** `application/json;version=20230302`

**Step 1 — Pool Discovery:**

`GET /networks/solana/tokens/{address}/pools?page=1`

- Returns all liquidity pools for the token on the requested network
- Sorted by `volume_usd.h24` descending
- **Top 5 pools by 24h volume** are selected for trade fetching

**Step 2 — Trade Fetching Per Pool:**

`GET /networks/solana/pools/{poolAddress}/trades?page={n}&trade_volume_in_usd_greater_than=0`

- Paginated: 100 trades per page, continues until `maxTransactions` is reached or `batch.length < 100`
- Duplicate `tx_hash` entries across pools are deduplicated using a `processedHashes` Set
- Results from all pools are merged and sorted chronologically descending
- Truncated to `maxTransactions`

**GeckoTerminal trade fields used in normalization** ([`geckoTerminal.ts:152–190`](file:///d:/scanner/lib/elevator/collectors/shared/geckoTerminal.ts#L152)):

| GeckoTerminal Field | Mapped To |
|---|---|
| `attributes.block_timestamp` | `timestamp` (converted to Unix seconds) |
| `attributes.tx_hash` | `hash` |
| `attributes.tx_from_address` | `wallet` |
| `attributes.kind` (`'buy'` \| `'sell'`) | `type` |
| `attributes.to_token_amount` (for buy) | `amount` |
| `attributes.from_token_amount` (for sell) | `amount` |
| `attributes.price_to_in_usd` (for buy) | `priceUsd` |
| `attributes.price_from_in_usd` (for sell) | `priceUsd` |

Direction mapping:
- **Buy:** `from = 'pool'`, `to = wallet`
- **Sell:** `from = wallet`, `to = 'pool'`

All GeckoTerminal transactions are flagged with `isTrade: true`.

### 8d. Merge Strategy: Helius + GeckoTerminal

([`SolanaCollector.ts:219–251`](file:///d:/scanner/lib/elevator/collectors/solana/SolanaCollector.ts#L219))

After both sources return data:

1. GeckoTerminal trades are indexed by `tx_hash` into a Map.
2. Each Helius transaction is checked against this Map by its `signature`:
   - **Match found:** The Helius record inherits `isTrade = true`, `priceUsd`, and `type` (buy/sell) from GeckoTerminal. The GeckoTerminal entry is consumed (deleted from the Map).
   - **No match:** The Helius record is marked `isTrade = false`, `type = 'transfer'`.
3. Any remaining GeckoTerminal trades not matched by Helius are appended as standalone DEX trade records.
4. **Fallback:** If GeckoTerminal returned zero trades, all Helius transactions are used as-is with their original `isTrade` flags.

The merged list is then split into:
- `trades` — all entries with `isTrade === true`
- `transfers` — all entries with `isTrade === false`

### 8e. Trade Aggregation

**File:** [`lib/elevator/utils/aggregateTrades.ts`](file:///d:/scanner/lib/elevator/utils/aggregateTrades.ts), function [`aggregateTrades`](file:///d:/scanner/lib/elevator/utils/aggregateTrades.ts#L8)

Multi-hop / aggregator swaps that share the same `tx_hash` are collapsed into a single net trade:

1. Trades are grouped by `hash`.
2. For each group with multiple hops:
   - Net token flow per wallet is computed: inflows add, outflows subtract.
   - Groups with `|netTokenAmount| < 1e-9` are **discarded** (dust/wraps).
   - `type` = `'buy'` if `netTokenAmount > 0`, `'sell'` if `< 0`.
   - `priceUsd` = `totalUsdValue / |netTokenAmount|` (effective average price).
   - The single aggregated record is marked `aggregated: true`.
3. Single-hop trades and plain transfers are passed through unchanged.

The final list is recombined: `[...aggregatedTrades, ...transfers]`, sorted chronologically descending, then truncated to `maxTransactions`.

### 8f. Wallet Balance & Holder Derivation

[`SolanaCollector.buildWalletData()`](file:///d:/scanner/lib/elevator/collectors/solana/SolanaCollector.ts#L121) — operates on the merged `UniversalTransaction[]`:

- Initializes a `WalletBalance` record `{ total_in, total_out, tx_count }` per unique `from` and `to` address.
- For each transaction: `wallets[tx.from].total_out += tx.amount`, `wallets[tx.to].total_in += tx.amount`.
- **Holders** = wallets where `(total_in - total_out) > 0`, sorted by net balance descending.
- `WalletMetrics.total_wallets` = count of all wallets seen; `total_holders` = count of positive-balance wallets; `top_10_wallets` = top 10 holders by balance.

> **Note:** The `walletEngine.ts` module ([`lib/elevator/collectors/solana/walletEngine.ts`](file:///d:/scanner/lib/elevator/collectors/solana/walletEngine.ts)) is imported in `SolanaCollector` but the actual `buildWalletData` method on the class itself overrides it with a `UniversalTransaction[]`-based implementation (not the `NormalizedTransaction[]`-based walletEngine). The walletEngine is not called in the current `collect()` flow.

### 8g. Metric Calculation

**File:** [`lib/elevator/collectors/solana/metrics.ts`](file:///d:/scanner/lib/elevator/collectors/solana/metrics.ts), function [`calculateMetrics`](file:///d:/scanner/lib/elevator/collectors/solana/metrics.ts#L14)

Two risk indicators are computed from the OHLCV data:

| Metric | Formula | Interpretation |
|---|---|---|
| `RF17` (bool) | `totalVolume > avgVolume && |priceChange| < 0.02` | `true` indicates possible artificial volume — high trading activity with less than 2% net price movement |
| `W5` (number\|null) | `walletMetrics.total_holders` | Unique holder count derived from the scanned transaction batch |

If `ohlcv.length === 0`, returns `{ RF17: false, W5: null }`.

### 8h. Holder Spike Detection

**File:** [`lib/elevator/utils/holderSpike.ts`](file:///d:/scanner/lib/elevator/utils/holderSpike.ts), function [`detectHolderSpike`](file:///d:/scanner/lib/elevator/utils/holderSpike.ts#L6)

Called in-place on the `CollectorResult` after collection is complete.

**Algorithm:**
1. Find the latest `timestamp` across all transactions → `latestTxSec`.
2. `windowStart = latestTxSec - 86400` (24-hour lookback).
3. Collect two sets:
   - `recipientsBeforeWindow` — all `tx.to` addresses where `tx.timestamp < windowStart`
   - `recipientsInWindow` — all `tx.to` addresses where `tx.timestamp >= windowStart`
4. `newHolders` = addresses in `recipientsInWindow` that are **not** in `recipientsBeforeWindow`.
5. `new_holders_24h = newHolders.size`
6. `total_holders_before_24h = recipientsBeforeWindow.size`
7. **Spike condition:** `holder_spike = true` if:
   - `new_holders_24h >= 10` AND `new_holders_24h / total_holders_before_24h > 0.5` (>50% growth)
   - OR `total_holders_before_24h === 0` AND `new_holders_24h >= 10` (brand new token, 100% growth)
8. `spike_percentage = round(increaseRatio * 100, 2)`

Fields mutated on `result`:
- `result.holder_spike` (bool)
- `result.spike_percentage` (number, 2 decimal places)
- `result.new_holders_24h` (number)
- `result.total_holders_before_24h` (number)

### 8i. System Address Filtering

**File:** [`lib/elevator/utils/addressFilter.ts`](file:///d:/scanner/lib/elevator/utils/addressFilter.ts), function [`filterSystemAddresses`](file:///d:/scanner/lib/elevator/utils/addressFilter.ts#L41)

Removes DEX routers, protocol programs, null/burn addresses, and smart contracts from the top holders list.

**Process:**
1. Check addresses against a hardcoded `SYSTEM_ADDRESSES` allowlist specific to the chain:
   - **Solana:** System Program, Token Program, Associated Token Program, Raydium AMM, Raydium CLMM, Jupiter v6, Orca Whirlpool, Meteora, Meteora DLMM
   - **ETH:** Null, Dead, Uniswap V2 Router, Uniswap V3 Router, Uniswap V3 SwapRouter02
   - **BSC:** Null, Dead, PancakeSwap V2 Router, PancakeSwap V3 Router
2. Check the top 30 holders concurrently via on-chain RPC:
   - **Solana:** `solanaConnection.getAccountInfo(pubkey)` — filtered if `accountInfo.executable === true`
   - **EVM:** `evmProvider.getCode(address)` — filtered if code is not `'0x'` or `'0x00'` (i.e. it's a smart contract)
3. RPC URLs used:
   - Solana: `https://mainnet.helius-rpc.com/?api-key=<HELIUS_API_KEY>` (falls back to `https://api.mainnet-beta.solana.com`)
   - ETH: `https://cloudflare-eth.com`
   - BSC: `https://bsc-dataseed.binance.org/`

Output: `result.wallet_metrics.top_holders_filtered` and `result.wallet_metrics.top_10_wallets` are both set to `filtered.slice(0, 10)`.

---

## 9. BSC / ETH Data Collection Pipeline

`BscCollector` and `EthCollector` are structurally identical — both in [`lib/elevator/collectors/bsc/BscCollector.ts`](file:///d:/scanner/lib/elevator/collectors/bsc/BscCollector.ts) and [`lib/elevator/collectors/eth/EthCollector.ts`](file:///d:/scanner/lib/elevator/collectors/eth/EthCollector.ts). Differences are limited to the network slug passed to shared utilities.

### 9a. OHLCV — Birdeye

Same implementation as Solana's — calls `fetchOHLCV` from [`lib/elevator/collectors/solana/birdeye.ts`](file:///d:/scanner/lib/elevator/collectors/solana/birdeye.ts) (both BSC and ETH collectors share this import). The `x-chain` header is set to `'solana'` — **this is a current implementation limitation** (the shared Birdeye module is parameterised for Solana only; EVM chains may not return usable OHLCV from this endpoint).

### 9b. Swap Transactions — GeckoTerminal (Primary)

**File:** [`lib/elevator/collectors/shared/geckoTerminal.ts`](file:///d:/scanner/lib/elevator/collectors/shared/geckoTerminal.ts)

Same `fetchGeckoTerminalTrades()` function as used for Solana, with network slugs:
- BSC: `'bsc'`
- ETH: `'eth'`

The function discovery strategy (pool lookup → per-pool trade fetch → dedup → sort → truncate → normalize) is identical to Solana's GeckoTerminal flow.

After fetching, all trades are mapped to `isTrade: true` and passed through `aggregateTrades()` immediately ([`BscCollector.ts:59–60`](file:///d:/scanner/lib/elevator/collectors/bsc/BscCollector.ts#L59)).

### 9c. Fallback — Birdeye Trades

**File:** [`lib/elevator/collectors/shared/birdeyeTrades.ts`](file:///d:/scanner/lib/elevator/collectors/shared/birdeyeTrades.ts), function [`fetchBirdeyeTrades`](file:///d:/scanner/lib/elevator/collectors/shared/birdeyeTrades.ts#L31)

Used **only** when GeckoTerminal returns zero trades.

- **Endpoint:** `GET https://public-api.birdeye.so/defi/txs/token`
- **Auth:** `X-API-KEY: <BIRDEYE_API_KEY>`, `x-chain: bsc|ethereum`
- **Params:** `address`, `tx_type=swap`, `offset`, `limit=100`
- **Pagination:** Offset-based; 500ms delay between pages; stops when fewer items than requested are returned
- **Rate limit:** Returns `null` if the API key check returns non-400 HTTP errors (401/403/etc.)

**Field mapping from Birdeye response:**

| Birdeye Field | Mapped To |
|---|---|
| `item.txHash \|\| item.tx_hash` | `hash` |
| `item.blockUnixTime \|\| item.timestamp` | `timestamp` |
| `item.side === 'buy'` | `type: 'buy'`, `from: 'pool'`, `to: wallet` |
| `item.side !== 'buy'` | `type: 'sell'`, `from: wallet`, `to: 'pool'` |
| `item.volumeBase \|\| item.amount` | `amount` |
| `item.priceUsd \|\| item.price` | `priceUsd` |
| `item.owner` | `wallet` |

After fetching, all trades are flagged `isTrade: true` and passed through `aggregateTrades()`.

### 9d. Wallet Balance & Holder Derivation

The BSC and ETH collectors implement `buildWalletData()` inline — functionally identical to the Solana collector's implementation: balance accumulation from `UniversalTransaction[]`, derivation of `HolderInfo[]` (positive net balance), descending sort, and `WalletMetrics` summary.

### 9e. GoldRush On-Chain Holder List (Conditional)

**Files:** [`lib/providers/goldrush/client.ts`](file:///d:/scanner/lib/providers/goldrush/client.ts), [`lib/providers/goldrush/adapter.ts`](file:///d:/scanner/lib/providers/goldrush/adapter.ts)

For BSC and ETH collectors **only** (not Solana), the system attempts to fetch a real on-chain holder list from the Covalent GoldRush API — but **only if** `GOLDRUSH_API_KEY` is configured in the environment.

```typescript
if (isGoldrushConfigured()) {
  const raw = await fetchGoldrushTokenHolders('eth' | 'bsc', address, 100);
  const dataset = adaptGoldrushHolders(raw, { chain, tokenAddress, tokenDecimals, snapshotAt });
  holders = dataset.holders;
  holdersStatus = dataset.status;
}
```

**GoldRush endpoint used:**
- ETH: `GET https://api.covalenthq.com/v1/eth-mainnet/tokens/{address}/token_holders/?page-size=100`
- BSC: `GET https://api.covalenthq.com/v1/bsc-mainnet/tokens/{address}/token_holders/?page-size=100`
- **Auth:** HTTP Basic — API key as username, blank password

**Adapter normalization** ([`adaptGoldrushHolders`](file:///d:/scanner/lib/providers/goldrush/adapter.ts#L157)):
- Balances are raw `uint256` decimal strings — divided by `10^decimals` (defaults to 18)
- Zero address (`0x000...000`) and dead address (`0x000...dead`) are excluded
- Items with non-parseable or non-positive balances are skipped
- All `HolderInfo.tx_count` values are set to `0` (GoldRush token_holders endpoint does not return per-wallet tx counts — this is an explicit design decision documented in the adapter header)
- Sorted descending by balance

**`holdersStatus`** values: `'available'` | `'unavailable'` | `'insufficient_data'`

If `GOLDRUSH_API_KEY` is absent: `holders = []`, `holdersStatus = 'unavailable'`.

### 9f. Metric Calculation

BSC and ETH collectors compute `calculateMetrics()` inline — identical formula to Solana's `metrics.ts`:

```typescript
RF17 = totalVolume > avgVolume && Math.abs(priceChange) < 0.02
W5   = walletMetrics.total_holders
```

### 9g. Holder Spike Detection & System Address Filtering

Same functions as Solana:
- [`detectHolderSpike`](file:///d:/scanner/lib/elevator/utils/holderSpike.ts#L6) — mutates result in-place
- [`filterSystemAddresses`](file:///d:/scanner/lib/elevator/utils/addressFilter.ts#L41) — uses EVM RPC (`cloudflare-eth.com` / `bsc-dataseed.binance.org`) for bytecode checks

---

## 10. Post-Collection Pipeline (All Chains)

After the chain-specific `collector.collect()` returns, the route applies four more processing steps regardless of chain. All steps modify `rawData.transactions` in-place.

### 10a. Wash Trading Detection

**File:** [`lib/elevator/washTradingDetector.ts`](file:///d:/scanner/lib/elevator/washTradingDetector.ts), function [`detectWashTrading`](file:///d:/scanner/lib/elevator/washTradingDetector.ts#L16)

Applied at [`route.ts:224`](file:///d:/scanner/app/api/scan/elevator/route.ts#L224).

**Algorithm:**
1. Group all transactions by `tx.wallet` address.
2. For each wallet group, check if it has at least one `type === 'buy' && isTrade === true` AND at least one `type === 'sell' && isTrade === true`.
3. If both are present, the wallet is a **wash trader candidate**:
   - Buys and sells are sorted chronologically.
   - Round-trips are counted: a round-trip is defined as a sell that occurs **after** a buy (matched greedily in chronological order).
   - All transactions for this wallet are flagged: `tx.isWashTrader = true`, `tx.roundTrips = N`.
4. Wallets without both sides are set `tx.isWashTrader = false`, `tx.roundTrips = 0`.

**Output written to `rawData`:**
```typescript
rawData.wash_trading = {
  detected:           totalWashWallets > 0,
  total_wash_wallets: N,
  total_round_trips:  M,
  wash_wallets:       ['0xabc...', ...]
}
```

> **Limitation:** Detection is based solely on same-wallet buy+sell presence within the scanned transaction batch. It does not detect cross-wallet wash trading, off-chain coordination, or wash trades spread across multiple scan sessions.

### 10b. CEX Exchange Tagging & Flow Calculation

**File:** [`route.ts:441–491`](file:///d:/scanner/app/api/scan/elevator/route.ts#L441), function `tagAndComputeExchangeFlow`
**Data file:** `data/cex-addresses.json` (loaded at module initialization via `fs.readFileSync`)

Chain key mapping: `solana` → `'solana'`, `bsc` → `'bsc'`, `eth` → `'ethereum'`

For each transaction:
- If `tx.to` matches a known CEX address: `tx.toExchange = true`, `tx.exchangeName = label`, `totalTokensToExchanges += tx.amount`
- If `tx.from` matches a known CEX address: `tx.fromExchange = true`, `tx.exchangeName = label`, `totalTokensFromExchanges += tx.amount`

**Exchange flow metrics returned:**
```typescript
exchange_flow: {
  totalTokensToExchanges:   N,   // sum of tokens moved TO exchanges
  totalTokensFromExchanges: M,   // sum of tokens moved FROM exchanges
  netExchangeFlow:          N-M  // positive = net outflow to exchanges (selling pressure)
}
```

`rawData.transactions` is also enriched with `tx.toExchange`, `tx.fromExchange`, and `tx.exchangeName` for per-transaction display.

The count of unique exchange names encountered is reported as `exchanges_scanned` in the response.

### 10c. Gas & DEX Fee Estimation

**File:** [`lib/fees/feeEstimator.ts`](file:///d:/scanner/lib/fees/feeEstimator.ts), function [`estimateTransactionFees`](file:///d:/scanner/lib/fees/feeEstimator.ts#L45)

Applied at [`route.ts:247`](file:///d:/scanner/app/api/scan/elevator/route.ts#L247).

**Scope:** Only transactions where `tx.isTrade === true && tx.hash` are eligible.

**Concurrency:** The **first 15 eligible trades** are processed concurrently via `Promise.all`. Remaining trades use static fallback estimates.

#### Live RPC Fee Estimation (first 15 trades):

**Solana:**
- Fetches actual fee via Helius parsed transactions API: `POST https://api.helius.xyz/v0/transactions/?api-key=<key>`
- Body: `{ transactions: [txHash] }`
- Extracts `txData.fee` (in lamports), converts to SOL, then USD using live SOL price from DexScreener
- Fallback if no Helius key or fee not found: `gasCostUsd = 0.00001 * solPrice`

**EVM (BSC/ETH):**
- Fetches receipt: `eth_getTransactionReceipt` from public RPC
  - BSC: `https://bsc-dataseed.binance.org`
  - ETH: `https://eth.llamarpc.com`
- Extracts `gasUsed` and `effectiveGasPrice` (falls back to `eth_getTransactionByHash.gasPrice` if `effectiveGasPrice` is 0)
- `gasCostUsd = (gasUsed * gasPrice / 1e18) * nativePrice`
- Fallback if receipt lookup fails: `150,000 gas * (3 Gwei BSC | 20 Gwei ETH) * nativePrice`

**Native price fetching** ([`feeEstimator.ts:8`](file:///d:/scanner/lib/fees/feeEstimator.ts#L8)):
- Source: `GET https://api.dexscreener.com/latest/dex/tokens/{nativeTokenAddress}`
- Caches price per coin for **5 minutes** (`300,000ms`)
- Initial / fallback prices: SOL = $200, ETH = $3,000, BNB = $600

**DEX fee (all trades):**
- `dexFeeUsd = amount * priceUsd * 0.003` (standard 0.3% LP fee approximation — not fetched from actual pool)

#### Static Fallback Estimates (trades 16+):

| Chain | Estimated Gas | Rate | Native Price |
|---|---|---|---|
| Solana | 0.00001 SOL | — | $200 |
| BSC | 150,000 gas | 3 Gwei | $600 |
| ETH | 150,000 gas | 20 Gwei | $3,000 |

Fields written per transaction: `tx.gasCostUsd`, `tx.dexFeeUsd`.

### 10d. On-Chain Transaction Verification

**File:** [`lib/verification/verifyTransactions.ts`](file:///d:/scanner/lib/verification/verifyTransactions.ts), function [`verifyTransactions`](file:///d:/scanner/lib/verification/verifyTransactions.ts#L19)

Applied at [`route.ts:277`](file:///d:/scanner/app/api/scan/elevator/route.ts#L277).

**Scope:** Randomly samples **up to 3** trades with valid hashes (`isTrade === true && hash`).

**Solana verification:**
- Fetches parsed transaction from Helius: `POST https://api.helius.xyz/v0/transactions/?api-key=<key>`, body: `{ transactions: [txHash] }`
- Searches `txData.tokenTransfers` for an entry matching `mint === tokenAddress` AND `fromUserAccount` or `toUserAccount` matching the expected wallet
- If found, checks amount within 1% tolerance: `|matchAmount - expectedAmount| / expectedAmount > 0.01` → discrepancy
- If Helius key is absent, all sampled trades are marked verified (pass-through)

**EVM verification (BSC/ETH):**
- Fetches receipt via `eth_getTransactionReceipt` from public RPC
- Scans `receipt.logs` for a standard ERC-20 Transfer event: topic `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` AND `l.address === tokenAddress`
- Checks that the trader wallet address appears in `topics[1]` (from) or `topics[2]` (to)
- On timeout/rate-limit error: trade is counted as verified (pass-through)

**Output:**
```typescript
trust_score: {
  verifiedCount: N,
  totalChecked:  M,
  score:         Math.round((N / M) * 100),  // 0–100; defaults to 100 if M === 0
  discrepancies: [{ hash, field, expected, actual, reason }, ...]
}
```

### 10e. Network Health Probe

Applied at [`route.ts:283`](file:///d:/scanner/app/api/scan/elevator/route.ts#L283). Non-critical — defaults are used on failure.

| Chain | Method | Default |
|---|---|---|
| Solana | `conn.getSlot()` via Helius RPC | `'Deep Scan Active'` |
| BSC | `eth_blockNumber` → `https://bsc-dataseed.binance.org/` | `'BSC Network Active'` |
| ETH | `eth_blockNumber` → `https://eth.llamarpc.com` | `'ETH Network Active'` |

Output: `networkHealth.lastBlock` (formatted with `toLocaleString()`), `networkHealth.blockReward` (static network label string).

---

## 11. Response Schema

On success (`HTTP 200`):

```typescript
{
  success: true,
  remainingCredits: number,
  rawData: {
    transactions: UniversalTransaction[],   // With isTrade, isWashTrader, roundTrips, gasCostUsd, dexFeeUsd, toExchange, fromExchange, exchangeName
    holders: HolderInfo[],                  // From GoldRush (EVM) or empty (Solana)
    ohlcv: OHLCVCandle[],                   // 15-minute Birdeye candles
    blockchain: 'solana' | 'bsc' | 'eth',
    token: { symbol: 'TOKEN', address: string },
    holder_spike: boolean,
    spike_percentage: number,
    new_holders_24h: number,
    total_holders_before_24h: number,
    top_10_wallets: HolderInfo[],           // After system address filtering
    top_holders_filtered: HolderInfo[],
    networkHealth: { lastBlock: string, blockReward: string },
    exchanges_scanned: number,
    exchange_flow: {
      totalTokensToExchanges: number,
      totalTokensFromExchanges: number,
      netExchangeFlow: number
    },
    trust_score: {
      verifiedCount: number,
      totalChecked: number,
      score: number,
      discrepancies: Array<{ hash, field, expected, actual, reason }>
    },
    wash_trading: {
      detected: boolean,
      total_wash_wallets: number,
      total_round_trips: number,
      wash_wallets: string[]
    },
    washTrading: {                          // Duplicate field for legacy client compatibility
      totalWashWallets: number,
      totalRoundTrips: number,
      washWallets: string[]
    }
  },
  metadata: {
    blockchain: string,
    detectedChain: string,
    creditsSpent: number,
    tier: string,
    transactionCount: number,
    holderCount: number,
    walletCount: number,
    timestamp: string,     // ISO 8601
    metrics: { RF17: boolean, W5: number | null }
  }
}
```

> **Note:** `token.symbol` is hardcoded as `'TOKEN'` in the current implementation. Token metadata fetching is not yet implemented in the Elevator Scan route ([`route.ts:329`](file:///d:/scanner/app/api/scan/elevator/route.ts#L329)).

---

## 12. Error Handling & Credit Refund

| Condition | HTTP Status | Code |
|---|---|---|
| Missing Authorization header | `401` | — |
| Invalid/expired JWT | `401` | — |
| Missing `address` field | `400` | — |
| Address format + chain mismatch | `400` | `WRONG_CHAIN` |
| EVM address, no chain selected | `400` | `AMBIGUOUS_CHAIN` |
| Unknown address format | `400` | — |
| Unsupported chain | `400` | — |
| `creditsSpent` not in `[5, 10, 20, 30]` | `400` | — |
| Insufficient credits | `402` | `INSUFFICIENT_CREDITS` |
| Missing `BIRDEYE_API_KEY` | `500` | — |
| Missing `HELIUS_API_KEY` (Solana) | `500` | — |
| Collector runtime error | `500` + auto-refund | — |

All runtime errors after credit deduction trigger the auto-refund via `refund_credits_for_scan` RPC with idempotency guard.

---

## 13. Runtime Configuration

| Environment Variable | Required For | Notes |
|---|---|---|
| `BIRDEYE_API_KEY` | All chains | OHLCV and EVM fallback trades |
| `HELIUS_API_KEY` | Solana only | Transaction history, fee lookup, address filtering RPC, verification |
| `GOLDRUSH_API_KEY` | BSC/ETH (optional) | On-chain holder list; feature is silently disabled if absent |
| Supabase env vars | All | Auth and credit deduction (`supabase` client is imported from `@/lib/supabase`) |

---

## 14. External APIs & Providers Summary

| Provider | Purpose | Auth | Key Required |
|---|---|---|---|
| **Birdeye** (`public-api.birdeye.so`) | OHLCV candles (all chains); fallback trades (EVM) | `X-API-KEY` header | Yes (`BIRDEYE_API_KEY`) |
| **Helius** (`api.helius.xyz`) | Solana transaction history, fee estimation, on-chain verification, address filtering RPC | `api-key` query param | Yes (`HELIUS_API_KEY`) |
| **GeckoTerminal** (`api.geckoterminal.com/api/v2`) | DEX swap trades — all chains (primary) | None (public free tier) | No |
| **Covalent GoldRush** (`api.covalenthq.com/v1`) | EVM on-chain token holder list (BSC/ETH) | HTTP Basic (key as username) | Optional (`GOLDRUSH_API_KEY`) |
| **DexScreener** (`api.dexscreener.com`) | Live native coin prices (SOL, ETH, BNB) for fee estimation | None | No |
| **Cloudflare ETH RPC** (`cloudflare-eth.com`) | ETH: address bytecode check (contract filter), gas fee estimation | None | No |
| **BSC Public RPC** (`bsc-dataseed.binance.org`) | BSC: address bytecode check, block number, gas fee estimation | None | No |
| **Llamarpc ETH** (`eth.llamarpc.com`) | ETH: tx receipt lookup, block number | None | No |
| **Supabase** | Auth, credit deduction/refund (RPC), user profile | Bearer JWT + service key | Yes |

---

## 15. Source Code Map

| File | Role |
|---|---|
| [`app/api/scan/elevator/route.ts`](file:///d:/scanner/app/api/scan/elevator/route.ts) | Main POST handler — auth, validation, orchestration, post-processing, response |
| [`lib/elevator/collectors/config.ts`](file:///d:/scanner/lib/elevator/collectors/config.ts) | Credit tier → `maxTransactions` + tier label mapping |
| [`lib/elevator/collectors/CollectorFactory.ts`](file:///d:/scanner/lib/elevator/collectors/CollectorFactory.ts) | Factory pattern — instantiates correct collector for detected chain |
| [`lib/elevator/collectors/types.ts`](file:///d:/scanner/lib/elevator/collectors/types.ts) | `UniversalTransaction`, `CollectorResult`, `WalletMetrics`, `IBlockchainCollector` interface |
| [`lib/elevator/collectors/solana/SolanaCollector.ts`](file:///d:/scanner/lib/elevator/collectors/solana/SolanaCollector.ts) | Full Solana collection: OHLCV, Helius+GeckoTerminal merge, wallet derivation, metrics |
| [`lib/elevator/collectors/solana/helius.ts`](file:///d:/scanner/lib/elevator/collectors/solana/helius.ts) | Helius paginated transaction fetcher, normalizer, DEX program detection |
| [`lib/elevator/collectors/solana/birdeye.ts`](file:///d:/scanner/lib/elevator/collectors/solana/birdeye.ts) | Birdeye OHLCV fetcher (15m candles, 24h window) |
| [`lib/elevator/collectors/solana/metrics.ts`](file:///d:/scanner/lib/elevator/collectors/solana/metrics.ts) | RF17 and W5 metric computation from OHLCV + wallet data |
| [`lib/elevator/collectors/solana/walletEngine.ts`](file:///d:/scanner/lib/elevator/collectors/solana/walletEngine.ts) | Wallet balance engine for `NormalizedTransaction[]` (imported but not called in current `collect()` flow) |
| [`lib/elevator/collectors/bsc/BscCollector.ts`](file:///d:/scanner/lib/elevator/collectors/bsc/BscCollector.ts) | Full BSC collection: OHLCV, GeckoTerminal→Birdeye, GoldRush holders, wallet derivation, metrics |
| [`lib/elevator/collectors/eth/EthCollector.ts`](file:///d:/scanner/lib/elevator/collectors/eth/EthCollector.ts) | Full ETH collection: same structure as BSC |
| [`lib/elevator/collectors/shared/geckoTerminal.ts`](file:///d:/scanner/lib/elevator/collectors/shared/geckoTerminal.ts) | GeckoTerminal multi-pool trade fetcher — pool discovery, per-pool pagination, dedup, normalize |
| [`lib/elevator/collectors/shared/birdeyeTrades.ts`](file:///d:/scanner/lib/elevator/collectors/shared/birdeyeTrades.ts) | Birdeye fallback trade fetcher for EVM (`/defi/txs/token`) |
| [`lib/elevator/washTradingDetector.ts`](file:///d:/scanner/lib/elevator/washTradingDetector.ts) | Wash trading detection — same-wallet buy+sell round-trip analysis |
| [`lib/elevator/utils/aggregateTrades.ts`](file:///d:/scanner/lib/elevator/utils/aggregateTrades.ts) | Multi-hop swap aggregation by `tx_hash` → single net trade |
| [`lib/elevator/utils/holderSpike.ts`](file:///d:/scanner/lib/elevator/utils/holderSpike.ts) | Holder spike detection — 24h new-recipient growth analysis |
| [`lib/elevator/utils/addressFilter.ts`](file:///d:/scanner/lib/elevator/utils/addressFilter.ts) | System address + smart contract filtering from top holders |
| [`lib/elevator/utils/chainDetector.ts`](file:///d:/scanner/lib/elevator/utils/chainDetector.ts) | Static address format detection (EVM vs Solana) |
| [`lib/blockchain/evmScanner.ts`](file:///d:/scanner/lib/blockchain/evmScanner.ts) | `autoDetectChainId` — parallel EVM bytecode probe for ambiguous addresses |
| [`lib/fees/feeEstimator.ts`](file:///d:/scanner/lib/fees/feeEstimator.ts) | Live gas + DEX fee estimation with DexScreener price cache and RPC fallbacks |
| [`lib/verification/verifyTransactions.ts`](file:///d:/scanner/lib/verification/verifyTransactions.ts) | On-chain trade verification — Helius (Solana) and ERC-20 Transfer log (EVM) cross-check |
| [`lib/providers/goldrush/client.ts`](file:///d:/scanner/lib/providers/goldrush/client.ts) | GoldRush REST client — token holders and wallet transactions endpoints |
| [`lib/providers/goldrush/adapter.ts`](file:///d:/scanner/lib/providers/goldrush/adapter.ts) | GoldRush response → canonical `EvmHolderDataset` + `WalletQualityProfile` transformation |
| [`lib/providers/config.ts`](file:///d:/scanner/lib/providers/config.ts) | Provider feature flags — checks env vars for `GOLDRUSH_API_KEY`, `ALCHEMY_API_KEY`, etc. |
| [`data/cex-addresses.json`](file:///d:/scanner/data/cex-addresses.json) | Static CEX address lookup table keyed by chain (`solana`, `bsc`, `ethereum`) |
| [`components/ElevatorResultCard.tsx`](file:///d:/scanner/components/ElevatorResultCard.tsx) | Frontend result display — renders market behavior stats, wash trading card, momentum heatmap, top buyers/sellers |

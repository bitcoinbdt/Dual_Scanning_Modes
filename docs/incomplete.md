# Incomplete Tasks & System Deficits

This document details the incomplete features, unimplemented algorithms, broken UI integrations, and known limitations across the three scanning systems, including specific pending verifications, database validation tasks, and database-level deployment statuses.

---

## 1. Basic Scan Incomplete Tasks & Deficits

### Empty Transaction Ingestions (0% Implemented)
* **Description:** The transaction list is hardcoded to return an empty array.
* **Code Reference:** [`lib/blockchain/evmScanner.ts:L255`](file:///d:/scanner/lib/blockchain/evmScanner.ts#L255) and [`lib/blockchain/solanaScanner.ts:L148`](file:///d:/scanner/lib/blockchain/solanaScanner.ts#L148).
* **Impact:** Public RPC endpoints are not queried for historical token transfers.
* **Downstream Deficit:** The frontend `AdvancedRiskMetricsCard` calculates and renders `0` or `0.0%` for holder concentration, transaction velocity, and overall transaction frequency.

### Broken UI Integration
* **Description:** The `AdvancedRiskMetricsCard` component is visually broken or shows empty data because it expects a populated transaction array that is hardcoded as empty.
* **Downstream Deficit:** The user is presented with a non-functional metrics section on the Basic Scan UI page.

### Missing Risk Scoring Engine (0% Implemented)
* **Description:** There is no backend mathematical risk scoring or category aggregation logic.
* **Impact:** No overall risk score or risk classification is calculated in the backend.
* **Downstream Deficit:** The frontend must calculate and render generic warnings solely based on boolean threat flags returned by third-party APIs.

### Missing Downstream Refund Logic
* **Description:** The Basic Scan route handler does not call `refund_credits_for_scan` in its main error-handling catch block.
* **Code Reference:** [`app/api/scan/basic/route.ts:L88-L96`](file:///d:/scanner/app/api/scan/basic/route.ts#L88-L96).
* **Impact:** If downstream RPC timeouts or API exceptions occur after credits are deducted, the credits are lost and cannot be recovered by the user.

### Hardcoded Wash Trading Metric
* **Description:** The wash trading percentage is hardcoded to `0` inside the EVM scanner.
* **Code Reference:** [`lib/blockchain/evmScanner.ts:L190`](file:///d:/scanner/lib/blockchain/evmScanner.ts#L190).
* **Impact:** The scanner does not evaluate wash trading patterns for the token.

### Missing EVM Contract Verification Sourcing
* **Description:** The EVM scanner does not query verification status from block explorers (Etherscan, BscScan). Instead, it defaults `contractVerified` to `false` for all EVM scans.
* **Code Reference:** [`lib/blockchain/evmScanner.ts:L187`](file:///d:/scanner/lib/blockchain/evmScanner.ts#L187).
* **Impact:** Deployed EVM tokens display "Unverified Threat" in the UI even if their source code is verified on-chain.

### Missing Solana Holder Count Sourcing
* **Description:** Solana public RPCs do not expose aggregate holder count endpoints.
* **Code Reference:** [`lib/blockchain/solanaScanner.ts:L110`](file:///d:/scanner/lib/blockchain/solanaScanner.ts#L110).
* **Impact:** The `holderCount` property is defaulted to `0` in the Solana scan output payload.

---

## 2. Elevator Scan Incomplete Tasks & Deficits

### Inability to Resolve Helius Buy/Sell Direction
* **Description:** The Helius transaction collector is unable to resolve trade direction (buy vs. sell) independently.
* **Code Reference:** [`lib/elevator/collectors/solana/SolanaCollector.ts:L109–116`](file:///d:/scanner/lib/elevator/collectors/solana/SolanaCollector.ts#L109).
* **Impact:** All Helius-originated transfers are hardcoded as type `'transfer'`. They can only be resolved if a matching GeckoTerminal trade event is successfully parsed and merged.
* **Downstream Deficit:** If the GeckoTerminal match fails, transactions are classified as generic transfers instead of swaps.

### Broken EVM OHLCV shared Import Configuration
* **Description:** Both the BSC and Ethereum collectors import the Solana-specific Birdeye OHLCV collection helper. The `x-chain` header is hardcoded to `'solana'`.
* **Code Reference:** [`lib/elevator/collectors/solana/birdeye.ts`](file:///d:/scanner/lib/elevator/collectors/solana/birdeye.ts).
* **Impact:** Calls from the BSC and Ethereum collectors to Birdeye for candles will pass a `'solana'` header instead of the correct chain identifier.
* **Downstream Deficit:** EVM tokens fail to retrieve usable OHLCV data from this endpoint in production.

### Limited Wash Trading Scope
* **Description:** Wash trading detection only checks if the same wallet address bought and sold tokens within the local transaction batch.
* **Impact:** Coordinated multi-wallet wash trading rings, cross-wallet transfers, or wash trades occurring across separate scan sessions are not analyzed.

---

## 3. Deep Scan Incomplete Tasks & Deficits

### Unused Smart Money PnL FIFO Engine
* **Description:** The `SmartMoneyPnlEngine.ts` file implements a FIFO cost-basis matcher to compute realized PnL, ROI, and win rates for cohort wallets. However, it is not imported, instantiated, or invoked anywhere in the primary `DeepScanService.ts` coordinator.
* **Code Reference:** [`lib/deep_scan/engines/SmartMoneyPnlEngine.ts`](file:///d:/scanner/lib/deep_scan/engines/SmartMoneyPnlEngine.ts).
* **Impact:** Realized PnL and ROI statistics are not computed during Deep Scan execution.

### Unconnected Live Risk Monitoring (Module 10)
* **Description:** There is no implementation for real-time mempool watching, block event streaming, or live websocket feeds.
* **Impact:** The engine is limited to static session lookups. Real-time updates cannot be processed within the 60-second execution limit of Next.js serverless route handlers.

### Unconnected Historical Behavior Cycles (Module 13)
* **Description:** The engine lacks any analysis files to detect historical pump-and-dump cycle shapes, average historical drawdowns, or token distribution speeds.
* **Impact:** Historical behavioral patterns are not included in the generated report or risk scoring.

### Missing Solana Wallet History & Funding Sourcing
* **Description:** The Covalent GoldRush client only supports EVM chains in this repository. Solana wallet age, transaction history profiling, and creator-funding source lookups are unavailable.
* **Impact:** Deep scans on Solana return `insufficient_data` or `unknown` for wallet freshness and funding sources.

### Bitquery Whale History Lookback Window Constraint
* **Description:** Whale history checks are strictly bounded by a 90-day GraphQL lookback window.
* **Impact:** The `firstSeenTimestamp` returned represents the earliest activity *within this 90-day lookback window*, not the absolute genesis of the wallet.

### Hardcoded Token Symbol in Route
* **Description:** The output token symbol is hardcoded as `'TOKEN'` in the route response.
* **Code Reference:** [`app/api/scan/deep/route.ts:L310`](file:///d:/scanner/app/api/scan/deep/route.ts#L310).
* **Impact:** The returned scan report shows the generic `'TOKEN'` symbol instead of the actual token name or symbol.

### Missing Concentrated Liquidity (CLMM) Simulations
* **Description:** Constant-product simulations are only run on V2 pools. 
* **Impact:** The system returns `insufficient_data` for concentrated-liquidity (CLMM/Uniswap V3) pools. Slippage curves cannot be simulated for these pools.

---

## 4. Phase 5D-6 — Decimal + Token Slot Fix

### Current Issue
* **Risk of assuming historical `reserve0` as scanned token:** There is a risk that historical snapshots of `reserve0` are incorrectly assumed to be the scanned base token, leading to erroneous calculations in multi-token pools.
* **Determining token0 vs. token1:** The engine must correctly resolve whether the scanned token is `token0` or `token1` in the selected Uniswap/BSC liquidity pool.
* **Decimal normalization:** Requires handling token pairs with mismatched decimals (e.g., 6 vs. 8 vs. 18 decimals) during reserve scaling.
* **Historical liquidity USD calculation:** Ensuring correct valuation calculations when computing the USD value of historical reserves.
* **Scenario F Slotting:** Placing the historical reserve values in the correct slots (0 and 1) for Scenario F simulations (historical minimum reserves shock tests) to prevent inverted swap outputs.

### Pending Tasks
* **[`LiquidityStressAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/LiquidityStressAnalyzer.ts):** Refactor the simulation steps to retrieve the pool's token layout and assign historical reserves based on verified addresses.
* **[`DeepScanService.ts`](file:///d:/scanner/lib/deep_scan/DeepScanService.ts):** Map decimals and layout details from token metadata into the stress analyzer inputs.
* **Historical reserve normalization:** Standardize reserve scaling using respective decimals.
* **Token-slot selection:** Verify slots before invoking simulations.
* **Scenario F correction:** Ensure historical reserve inputs match the simulation expected fields.
* **Adversarial token0/token1 + decimal tests:** Write tests covering cross-decimal pairs (e.g., USDT/WETH, WBTC/USDC) where the scanned token alternates between slot 0 and slot 1.
* **Historical liquidity metric validation:** Confirm computed reserves match actual on-chain states.

---

## 5. Phase 5D-6 — Independent Revalidation

### gate status (Gate I)
* **Gate I (Decimal Normalization):** 🔴 **Incomplete / Partial**  
* **Target:** Achieve a `PASS` rating across Gates A–Z.

### Verification Items
The validation checklist requires checking the following items:
* **Historical min liquidity:** Confirm index limits are parsed correctly.
* **Max liquidity:** Check threshold boundaries.
* **Average liquidity:** Verify calculated mean.
* **Scenario F:** Confirm simulations do not fail or return inverted results.
* **Exceeds pool:** Ensure sizes exceeding the pool reserves are correctly caught.
* **Price impact:** Verify impact scaling.
* **Token0 / Token1 equivalence:** Confirm results are identical regardless of whether the token is `token0` or `token1`.

---

## 6. Phase 5D-5 — Production pg_cron Deployment Verification

### Verification Item
* **Retention Function:** `cleanup_historical_pool_reserves()`
* **Function existence:** ✅ **Verified / Exists**
* **Function tested:** ✅ **Verified / Tested**
* **Cron deployed:** ❓ **Pending** (Needs verification of pg_cron scheduler registration in production/staging Supabase).

---

## 7. Phase 5D-5 — Real PostgreSQL / Supabase Validation

### Verification Item (Row Level Security - RLS)
Validate that RLS policies are active and enforced on a real staging/production-compatible Supabase instance:
* **Anonymous (anon) Role:**
  - `INSERT` ──► 🔴 **Rejected**
  - `UPDATE` ──► 🔴 **Rejected**
  - `DELETE` ──► 🔴 **Rejected**
* **Authenticated Role:**
  - `INSERT` ──► 🔴 **Rejected**
  - `UPDATE` ──► 🔴 **Rejected**
  - `DELETE` ──► 🔴 **Rejected**
* **Service Role:**
  - `INSERT` / `UPDATE` / `DELETE` ──► ✅ **Allowed**

---

## 8. Phase 5D-5 — pg_net Real Trigger Validation

### Verification Item
Confirm end-to-end Postgres trigger invocation and HTTP dispatch:
* **Happy Path:**
  1. `INSERT` pending job in database.
  2. `pg_net` trigger fires.
  3. HTTP dispatch triggers worker.
  4. Status transitions to `processing`.
  5. Job runs and transitions to `completed`.
* **Retry Path:**
  1. Worker executes and encounters failure.
  2. Status transitions from `processing` to `failure`.
  3. Recovery scheduler changes status back to `pending`.
  4. Retry triggers execution.

---

## 9. Queue End-to-End Production Validation

### Verification Item (Full Pipeline)
Validate the full background execution pipeline in the staging environment:
```text
Scheduler ──► DB Job ──► pg_net ──► Worker ──► CAS Claim ──► RPC ──► DB Write ──► Completed
```
Also validate the worker crash recovery path:
```text
processing ──► worker crash ──► >15 minutes elapsed ──► scheduler recovery ──► pending
```

---

## 10. Serverless Fire-and-Forget Risk

### Architectural Limitation
* **Description:** Within `DeepScanService`, when `schedulePoolReservesIndexing()` is dispatched, it runs as an asynchronous, non-awaited task ("fire-and-forget").
* **Impact:** In a serverless deployment (such as Next.js on Vercel), the execution container may spin down or freeze immediately after the response is sent. This can cause the indexing job schedule to be cut off before it reaches PostgreSQL.
* **Verdict:** 🟡 **Known architectural limitation** (Non-blocking for core functionality, but needs monitoring).

---

## 11. Full Regression Validation

### Status: 🟡 Pending Final Regression
Validate that the entire scanner suite builds, passes TypeScript check, and runs all test suites with 0 failures:
* **Deep Scan:** 500 / 500 tests pass.
* **Provider:** 7 / 7 providers pass.
* **TypeScript:** 0 compilation errors.
* **Regression Suites:** Run all tests for:
  - Basic Scan regression.
  - Elevator Scan regression.
  - Phase 5D-5 database regression.
  - Phase 5D-6 simulation regression.
  - New adversarial token layout and decimal checks.

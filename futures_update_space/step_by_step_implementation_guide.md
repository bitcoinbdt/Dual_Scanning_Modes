# Step-by-Step Implementation Guide

This document maps out a detailed, file-by-file implementation plan for the entire scan upgrades space. It is designed to act as a step-by-step checklist for developer execution, ensuring that changes to routing, data ingestion, database tables, and analytical engines are completed in the correct order.

---

## Phase 1: Database Setup & Schema Migrations
Before modifying any TypeScript logic, all caching and persistence tables must exist. Run these migrations in Supabase:

### Step 1.1 — Create `scan_snapshots` Table (Shareable Results)
- **Table**: `scan_snapshots`
- **Fields**: `id` (PK, string), `scan_type` (enum), `token_address` (text), `chain` (text), `token_symbol` (text), `token_name` (text), `result_json` (JSONB), `user_id` (FK, UUID), `scanned_at` (timestamptz), `expires_at` (timestamptz), `view_count` (int), `is_public` (boolean).
- **Index**: Create index on `(token_address, chain, scanned_at DESC)` and `(user_id, scanned_at DESC)`.

### Step 1.2 — Create `token_unlock_schedules` Table (Traceability)
- **Table**: `token_unlock_schedules`
- **Fields**: `id` (PK, UUID), `token_address` (text), `chain` (text), `total_locked_percentage` (decimal), `next_unlock_at` (timestamp), `next_unlock_percentage` (decimal), `next_unlock_usd_value` (decimal), `vesting_details` (JSONB), `last_updated_at` (timestamp).
- **Index**: Create unique constraint on `(token_address, chain)` and an index on `next_unlock_at ASC`.

### Step 1.3 — Create `token_social_cache` Table (Social Signals)
- **Table**: `token_social_cache`
- **Fields**: `id` (PK, UUID), `token_address` (text), `chain` (text), `website` (text), `twitter` (text), `telegram` (text), `discord` (text), `github` (text), `website_alive` (boolean), `twitter_account_age_days` (int), `website_domain_age_days` (int), `github_last_commit_days` (int), `social_consistent` (boolean), `social_conflicts` (JSONB), `source` (text), `cached_at` (timestamp).
- **Index**: Create unique constraint on `(token_address, chain)`.

### Step 1.4 — Create `known_ruggers` Table (Rug Pattern Matching)
- **Table**: `known_ruggers`
- **Fields**: `id` (PK, UUID), `deployer_address` (text), `chain` (text), `confirmed_rugs` (int), `total_tokens` (int), `rug_token_addresses` (text[]), `rug_confirmed_at` (timestamptz[]), `rug_methods` (text[]), `source` (text), `first_seen_at` (timestamptz), `last_updated_at` (timestamptz).
- **Index**: Create unique constraint on `(deployer_address, chain)`.

### Step 1.5 — Create `ai_scan_cache` Table (AI Intelligence)
- **Table**: `ai_scan_cache`
- **Fields**: `id` (PK, UUID), `token_address` (text), `chain` (text), `query_type` (text), `result_json` (JSONB), `provider_used` (text), `cached_at` (timestamptz), `expires_at` (timestamptz).
- **Index**: Create unique constraint on `(token_address, chain, query_type)`.

---

## Phase 2: Core Ingestion & Routing Upgrades
Modify the scanner entry points to support dual-path routing and dynamic transaction scaling.

### Step 2.1 — Update [`tokenScanner.ts`](file:///d:/scanner/lib/blockchain/tokenScanner.ts)
1. Edit `detectNetwork(address)` to add Solana launchpad detection.

   > ✅ **C-011 RESOLVED** — The previous draft said *"check for Pump.fun token addresses (which typically end in `pump`)"*. This was a direct contradiction with `implementation_resolutions.md §1` which explicitly warns against unreliable suffix matching. **The `pump` suffix check is removed entirely.**
   >
   > **Correct method**: Use the program ID verification approach defined in `implementation_resolutions.md §1`. Call `connection.getParsedAccountInfo(mintAddress)` and check whether `mintAuthority` or `freezeAuthority` matches `PUMP_FUN_PROGRAM_ID` (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) or `RAYDIUM_LAUNCHLAB_PROGRAM_ID` (`LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`).

2. Add a `isPreGraduation` flag to the returned `NetworkDetails`.
3. Update `scanToken()` to route pre-graduation tokens to a new `scanSolanaBondingCurveToken()` function instead of standard AMM paths.


### Step 2.2 — Update [`solanaScanner.ts`](file:///d:/scanner/lib/blockchain/solanaScanner.ts)
1. Add `scanSolanaBondingCurveToken()` helper.
2. In this function, bypass standard `fetchMarketDataWithFallback()` calls to prevent false 0-liquidity errors.
3. Instead, query bonding curve accounts using the Solana `@solana/web3.js` connection.
4. Calculate virtual LP reserves and map them into the `OnChainData` response structure.
5. In standard `scanSolanaToken()`, extract `mintAuthority` and `freezeAuthority` checks from the token supply account query and add them explicitly to the returned `OnChainData` metadata structure.

### Step 2.3 — Refactor [`DeepScanService.ts`](file:///d:/scanner/lib/deep_scan/DeepScanService.ts)
1. Update `maxTransactions` handling (line 272 / 573): If `maxTransactions` is omitted, set the cap dynamically. If the token is young (<7 days), set the limit to **10,000 transactions** (or fetch 100% of transactions if fewer exist).
2. Wire up the **Large-Cap vs. Micro-Cap Router Gate**:
   - Check if `marketCapUsd > 50,000,000` or if the token is listed on Tier-1 CEXs.
   - If `true`, invoke the Large-Cap engine path (bypass sniper flags, HHI concentration warnings, and whale exit simulator).
   - If `false`, run the full suite of micro-cap analyses (snipers, HHI, wash trading loops).
3. **Native Contract Similarity & Audit Scope**:
   - In basic scan route (`app/api/scan/basic/route.ts`), run the native static contract similarity check to return and display contract similarity score, proxy warnings, and failed audit checks in the Basic Scan UI.
   - In `DeepScanService.ts` backend, fetch/reuse the cached local contract audit result.
4. **Basic-to-Deep Scan Execution Pipeline**:
   - Refactor `DeepScanService.ts` to execute the complete Basic Scan pipeline synchronously as its first operation.
   - Capture critical Basic Scan outputs (`isHoneypot`, `isRugPull`, `totalLiquidityUsd`).
   - If a honeypot or rug pull is flagged, inject a `criticalBlocker` indicator into the Deep Scan result payload to trigger the UI Critical warning banner.

---

## Phase 3: Analytical Engine Enhancements
Update the deep scan scoring and calculation engines.

### Step 3.1 — Update [`RiskScoringEngine.ts`](file:///d:/scanner/lib/deep_scan/engines/RiskScoringEngine.ts)
1. **EVM Contract Risks**: Map the GoPlus fields (`is_proxy`, `transfer_pausable`, `is_blacklisted`, `owner_change_balance`, `can_take_back_ownership`, `is_mintable`) to explicit risk signals (`CTR-001` through `CTR-007`) and add their respective weights (+3 to +20 points) to the overall score calculation.
2. **Solana Authority Risks**: Ingest the Solana `mintAuthority` and `freezeAuthority` flags from the scanner data and map them to `SOL-CTR-001` and `SOL-CTR-002` signals (+10 to +12 points).
3. **Age-Specific Mitigators**: Add a rule to cancel the renounced ownership mitigator (`-10 points`) if `can_take_back_ownership` is true.
4. **Safety Score Overrides (Safety = 0 / Risk = 100)**:
   - Implement critical checks that override all weighting math.
   - Force the overall safety score to **0/100** (meaning maximum **Risk Score of 100/100**) if the token meets any of the following:
     - `isHoneypot === true`
     - `isRugPull === true`
     - `totalLiquidityUsd < 100` (excluding pre-graduation curve stage)
     - `deployerHoldingsPct > 50%` or deployer has sold $>90\%$ of their initial tokens.

### Step 3.2 — Update [`VolumeConcentrationAnalyzer.ts`](file:///d:/scanner/lib/deep_scan/engines/VolumeConcentrationAnalyzer.ts)
1. Add a helper function to calculate the **Gini Coefficient** over the array of `HolderInfo[]` collected from Elevator.
2. Output the `giniCoefficient` and classify the concentration level (e.g. 0.00–0.40 = Distributed, 0.86–1.00 = Extreme).

### Step 3.3 — Update [`AmmSlippageSimulator.ts`](file:///d:/scanner/lib/deep_scan/engines/AmmSlippageSimulator.ts)
1. Refactor from the basic 2 position sizes ($10,000 and $25,000) to a **5-tier slippage ladder** ($1,000, $5,000, $25,000, $100,000, $500,000).
2. Only run simulations where the size is less than 50% of total pool reserves. Otherwise, return `status: 'insufficient_data'`.

---

## Phase 4: Integration of New Intelligence Modules
Implement the new logic files and link them into `DeepScanService.ts`.

### Step 4.1 — Implement [`deployer_profiling.ts`](file:///d:/scanner/futures_update_space/deployer_profiling.md)
1. Create `lib/reputation/DeployerProfiler.ts`.
2. Extract the deployer address from the token scan data.
3. Query the deployer's list of previously created tokens.
4. Calculate the 4-factor scoring heuristic (Success Rate 30%, LP Management 25%, Dumping 25%, Wallet Clusters 20%) and output a reputation level.
   > ✅ **NEW-003 RESOLVED** — Canonical reputation levels (from `deployer_profiling.md §1`):
   > `trusted` | `neutral` | `caution` | `dangerous` | `known_rugger`
   > The previous draft listed `known/unknown/suspicious` — these are removed. Use only the five levels above as the TypeScript enum values.


### Step 4.2 — Implement [`token_unlock_airdrop_tracking.md`](file:///d:/scanner/futures_update_space/token_unlock_airdrop_tracking.md)
1. Create `lib/traceability/TokenUnlockTracker.ts`.
2. Query vesting contracts and APIs (Streamflow, Sablier, Team Finance, PinkLock) to extract total locked supply and the next scheduled unlock date/volume.
3. Compare the time remaining and unlock percentage to apply badges (`Vesting Active`, `⚠️ Emerging Unlock`, or `🚨 CRITICAL UNLOCK RISK`).

### Step 4.3 — Implement [`solana_liquidity_stress.md`](file:///d:/scanner/futures_update_space/solana_liquidity_stress.md)
1. Create `lib/solana/RaydiumPoolReader.ts` to parse the Borsh schema for Raydium V4 AMM and CPMM pool accounts.
2. In `LiquidityStressAnalyzer.ts`, remove the blanket Solana skip and accept `NormalizedPoolState` populated by the `RaydiumPoolReader`.

### Step 4.4 — Implement [`rug_pattern_matching.md`](file:///d:/scanner/futures_update_space/rug_pattern_matching.md)
1. Create `lib/reputation/RugPatternMatcher.ts`.
2. Integrate native checks to `ContractSimilarityEngine` (which loads bytecode and checks similarity against known rugs) and the GoPlus Address Security API (`/address_security/{address}`).
3. Match deployer address against the self-maintained `known_ruggers` database table.
4. Implement behavioral rules (mixer deposits, wallet age under 24 hours, rapid LP removal).

### Step 4.5 — Implement [`insider_accumulation.md`](file:///d:/scanner/futures_update_space/insider_accumulation.md)
1. Create `lib/deep_scan/engines/InsiderAccumulationDetector.ts`.
2. Parse OHLCV candle lists to locate volume Z-score spikes (>3.0x standard deviation).
3. Scan transaction timelines in the 300 seconds preceding the spike to group buys into 60-second buckets.
4. Filter out snipers and require ≥50% fresh wallets to flag clusters (`INS-001` through `INS-004`).

---

## Phase 5: AI Integration Layer
Set up the Gemini-primary and Groq-fallback engines for exchange announcement and news scraping.

### Step 5.1 — Create AI Clients
1. **Gemini Client**: Create `lib/ai/geminiClient.ts`. Wire it to use Google's `@google/genai` SDK, targeting `gemini-2.0-flash` with Google Search tool use enabled.
2. **Groq Client**: Create `lib/ai/groqClient.ts`. Target `llama-3.3-70b-versatile` using the `groq-sdk` library.
3. **Provider Wrapper**: Create `lib/ai/aiProvider.ts` to handle error try-catching, fallback routing, and non-blocking recovery.

### Step 5.2 — Implement Listings & News Agents
1. **ExchangeListingAgent**: In `lib/ai/ExchangeListingAgent.ts`, query Gemini/Groq using the exchange announcement list prompt. Support logo url extraction, opening day price, and upcoming listings.
2. **NewsAgent**: In `lib/ai/NewsAgent.ts`, execute news search query for the last 7 days and output direct URLs alongside a 3–5 sentence AI summary.

### Step 5.3 — Wire in AI to [`DeepScanService.ts`](file:///d:/scanner/lib/deep_scan/DeepScanService.ts)
1. Call both `ExchangeListingAgent.run()` and `NewsAgent.run()` in parallel with risk calculation routines using `Promise.allSettled`.
2. Append the structured results into the final `DeepScanResult` schema.

---

## Phase 6: Shareable Results & Public Routing
Expose public URLs for permalinks and social previews.

### Step 6.1 — Implement Snapshot Service
1. Create `lib/snapshots/snapshotService.ts` containing:
   - `saveSnapshot(scan_type, result)`: generates short Nanoids (`bs-`, `ev-`, `ds-`) and writes to the DB table.
   - `getSnapshot(id)`: retrieves and increment view count.
2. Call `saveSnapshot()` inside scan API routes (`app/api/scan/basic/route.ts`, etc.) immediately after successful scanner execution.

### Step 6.2 — Implement Page SSR
1. Create `app/scan/[id]/page.tsx`.
2. Fetch the snapshot server-side (SSR) using the GET snapshot endpoint.
3. Inject the snapshot payload directly into the standard frontend result components.
4. Add the public snapshot banner at the top showing the UTC date of execution.
5. Check for a `ref` parameter in the request query. If present and valid, set a 30-day `ref_code` cookie in the response to track the referrer.


### Step 6.3 — Add Open Graph API
1. Create `app/api/og/scan/[id]/route.ts`.
2. Use `@vercel/og` to generate an SVG image reflecting the token name, chain, execution date, and overall risk score dynamically.

---

## Phase 7: UI & Presentation Upgrades
Update the user interface to render new indicators safely.

### Step 7.1 — Standardize UI Metric Displays
1. **Social Links & Consistency**: Add the presence checker and conflict indicators to the Deep Scan "Project Presence" section.
2. **5-Tier Slippage Table**: Display slippage values in a clean tabular ladder. Mark overly deep trades as "N/A" rather than guessing.
3. **CEX Listings**: Render the listing tables including exchange logos, dates, and Day High/Low prices.
4. **Vesting Countdowns**: Render active countdown banners for tokens with locks, showing yellow warnings if an unlock is <3 days away, and red warnings if <24 hours.
5. **No Speculative Sentiment Tags**: Do not include "Bullish", "Bearish", or "Trustworthy" badges in the UI. Show raw percentages and counts (e.g. `Buy Volume: $12k`, `Gini: 0.73 [High]`, `Age: 12 days`).
6. **Share Button**: Place the "Copy Share Link" clipboard copy button in the result card headers.

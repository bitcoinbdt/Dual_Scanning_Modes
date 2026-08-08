# Elevator Scan Audit

## 1. Executive Summary
This document presents a deep technical audit of the **Elevator Scan** system. 
Elevator Scan is a Deep Blockchain Data collection system that retrieves transaction histories (ranging from 50 to 500 records depending on the credit tier) and computes on-chain transaction flows. It validates transactions against RPC nodes, calculates localized wallet balances, identifies centralized exchange (CEX) transfers, and identifies wash trading round-trips.

**Key Findings:**
1. **No AI Involvement**: Despite references in product designs to "AI Analysis," the codebase contains zero AI API integrations, prompts, or LLM wrappers. The entire analysis is 100% rule-based and deterministic.
2. **Batch Ledger Limitation**: Holder balances and wallet histories are constructed *locally* using only the small window of loaded transactions (50 to 500 swaps/transfers). These are not real, active on-chain balances and can be easily skewed if wallets hold or sell tokens outside the scanned transaction window.
3. **Hybrid Event Collection**: For EVM networks, Elevator Scan retrieves strictly DEX swap transactions (trades) via GeckoTerminal/Birdeye. For Solana, it pulls raw transaction logs via Helius, filters for token transfers, and merges them with GeckoTerminal swap trades.

---

## 2. Actual Purpose
Elevator Scan's primary purpose is to reconstruct trade flows for a token, identify centralized exchange deposits/withdrawals, detect wash-trading round-trips, and verify the cryptographic authenticity of trades against RPC nodes. It provides a deeper look into the transaction level than the static contract warnings of Basic Scan.

---

## 3. Complete Execution Flow
The execution flow operates as follows:

```text
[User selects token and scans]
        ↓ (app/page.tsx)
[POST /api/scan/elevator]
        ↓ (app/api/scan/elevator/route.ts)
[User Session Auth via Supabase Token]
        ↓ (supabase.auth.getUser)
[Atomic Credit Deduction (5 - 30 credits)]
        ↓ (supabase.rpc('deduct_credits_for_scan'))
[Load Collector Configuration]
        ↓ (lib/elevator/collectors/config.ts)
[Instantiate Chain-specific Collector]
        ↓ (CollectorFactory.ts)
[Load Transactions and Prices in parallel]
        ↓ (EthCollector.ts / SolanaCollector.ts)
[Tag CEX Addresses & Net Exchange Flows]
        ↓ (cex-addresses.json)
[Verify 3 Random Transaction Receipts]
        ↓ (verifyTransactions.ts)
[Estimate Gas and LP Fees via RPC]
        ↓ (feeEstimator.ts)
[Detect Wash Trading Round-Trips]
        ↓ (washTradingDetector.ts)
[Check Network Epoch/Block heights]
        ↓ (RPC node eth_blockNumber / conn.getSlot)
[JSON Response Return]
        ↓ (NextResponse.json)
[UI Transaction Table Render]
        ↓ (RawTransactionTable.tsx)
```

---

## 4. File Inventory

| File | Function | Role | Dependency |
| :--- | :--- | :--- | :--- |
| `app/api/scan/elevator/route.ts` | `POST` | Core handler. Triggers authentication, credit checks, collector engines, fee estimators, and transaction verifiers. | `config.ts`, `CollectorFactory.ts`, `cex-addresses.json`, `washTradingDetector.ts`, `feeEstimator.ts`, `verifyTransactions.ts` |
| `lib/elevator/collectors/config.ts` | `getCollectorConfig` | Maps the credit input (5, 10, 20, 30) to maximum transactions (50, 100, 200, 500). | None |
| `lib/elevator/collectors/CollectorFactory.ts` | `create` | Spawns collector instances (`SolanaCollector`, `BscCollector`, `EthCollector`) using API keys. | `SolanaCollector.ts`, `BscCollector.ts`, `EthCollector.ts` |
| `lib/elevator/collectors/types.ts` | Interfaces | Declares types (`UniversalTransaction`, `CollectorResult`, `IBlockchainCollector`). | None |
| `lib/elevator/collectors/eth/EthCollector.ts` | `collect`, `fetchTransactions`, `buildWalletData` | Fetches ETH swap trades from GeckoTerminal/Birdeye and builds local wallet balances. | `geckoTerminal.ts`, `birdeyeTrades.ts`, `holderSpike.ts`, `addressFilter.ts`, `aggregateTrades.ts` |
| `lib/elevator/collectors/solana/SolanaCollector.ts`| `collect`, `fetchTransactions` | Fetches slot logs from Helius, merges with GeckoTerminal trades, and aggregates. | `birdeye.ts`, `helius.ts`, `walletEngine.ts`, `metrics.ts`, `addressFilter.ts` |
| `lib/elevator/collectors/solana/helius.ts` | `fetchTransactions` | Triggers Helius `/v0/addresses/...` transactions with cursor pagination (`before` signature). Retry logic: 3 retries, 300ms delay. | `types.ts` |
| `lib/elevator/collectors/shared/geckoTerminal.ts` | `fetchGeckoTerminalTrades` | Discovers top 5 pools by 24h volume, fetches swap events page-by-page (up to 300/request). Deduplicates by tx hash. | `types.ts` |
| `lib/elevator/collectors/shared/birdeyeTrades.ts` | `fetchBirdeyeTrades` | Fallback trades client. Paginates Birdeye `/defi/txs/token` endpoint in batches of 100. | `types.ts` |
| `lib/elevator/utils/aggregateTrades.ts` | `aggregateTrades` | Collapses multi-hop/aggregator swaps into a single net `buy` or `sell` per tx hash. | `types.ts` |
| `lib/elevator/utils/holderSpike.ts` | `detectHolderSpike` | Counts new unique recipients in the 24h window vs. before. Flags spike if ≥10 new holders and >50% growth. | `types.ts` |
| `lib/elevator/utils/addressFilter.ts` | `filterSystemAddresses` | Checks top 30 wallets against hardcoded system/router/DEX lists and live RPC `getCode`/`getAccountInfo` bytecode checks. | `ethers`, `@solana/web3.js` |
| `lib/elevator/washTradingDetector.ts` | `detectWashTrading` | Local calculator checking buy-sell pairs per wallet address in the batch. | `types.ts` |
| `lib/fees/feeEstimator.ts` | `estimateTransactionFees` | Queries public RPCs or Helius to extract gas spent. Estimates LP fees at 0.3%. Native prices cached 5 minutes via DexScreener. | None |
| `lib/verification/verifyTransactions.ts` | `verifyTransactions` | Cross-checks 3 random transactions against on-chain logs to compute a trust score. | None |
| `components/elevator/RawTransactionTable.tsx` | Component | Displays transaction lists, CEX tags, verification badges, wash trader flags, top 10 filtered wallets, holder spike banners. | `pnlCalculator.ts` |

---

## 5. Input Model
* **Required Parameters**:
  * `address` (String): Sanitized token contract address.
  * `creditsSpent` (Number): Must be `5`, `10`, `20`, or `30`.
* **Optional Parameters**:
  * `preferredChain` (String): `'solana'`, `'bsc'`, or `'eth'` (overrides auto-detection).
* **Limits & Defaults**:
  * Default `creditsSpent` is `10` (standard tier: 100 transactions).
  * Auto-detection resolves EVM chain ID by probing deployed bytecode using `autoDetectChainId()`.

---

## 6. Transaction Retrieval Architecture

### EVM Networks (ETH / BSC)
1. **Pool Discovery**: GeckoTerminal `/networks/{network}/tokens/{address}/pools` fetches all liquidity pools for the token, sorted by 24h volume. The top **5 pools** are selected for scanning.
2. **Trade Fetch**: For each pool, GeckoTerminal `/networks/{network}/pools/{pool}/trades` is queried with cursor pagination (1200ms delay per request). Duplicate tx hashes are deduplicated using a `Set<string>`.
3. **Fallback**: If GeckoTerminal returns no data, Birdeye `/defi/txs/token` is queried with `tx_type=swap` offset pagination (100 per page, 500ms delay).
4. **Aggregation**: `aggregateTrades()` collapses multi-hop router swaps into one net trade per tx hash.

### Solana Network
1. **Helius Parse**: Queries Helius `/v0/addresses/${address}/transactions` (before-cursor pagination, 100 per page, 300ms delay, 3 retries). Decodes `tokenTransfers` filtered by the target mint address. Classifies as trade if source is a known DEX (`JUPITER`, `RAYDIUM`, `ORCA`, etc.) or instructions include a known DEX program ID.
2. **GeckoTerminal Merge**: Simultaneously fetches GeckoTerminal Solana trades for the token. Merges with Helius: if a Helius signature matches a GeckoTerminal tx hash, the Helius record is enriched with `priceUsd` and `type: 'buy'/'sell'`.
3. **Aggregation**: `aggregateTrades()` collapses multi-hop aggregator (e.g. Jupiter) swaps.
4. **Final Sort & Slice**: Combined list sorted descending by timestamp, then trimmed to `maxTransactions`.

---

## 7. Raw Transaction Data
The following raw fields are collected and mapped to the standard format (`UniversalTransaction` in `types.ts`):
* `hash` (signature)
* `timestamp`
* `from`
* `to`
* `amount` (token value)
* `type` (`buy`, `sell`, `transfer`)
* `blockchain`
* `gasUsed` / `gasFee`
* `priceUsd`
* `wallet` (executing address)

---

## 8. Event / Log Decoding
* **EVM Networks**: The collector relies on pre-decoded DEX swap endpoints from GeckoTerminal. On-chain validation (`verifyTransactions.ts`) decodes EVM transaction receipts specifically searching for the standard ERC-20 `Transfer` topic hash:
  `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
* **Solana Network**: Decodes Helius transaction structures to extract `tokenTransfers` objects (mapping `fromUserAccount`, `toUserAccount`, `tokenAmount`, and `mint`).

---

## 9. Transaction Classification
Transactions are categorized as:
* **`buy`**: Decoded DEX swaps where stable/native coin is exchanged for target token.
* **`sell`**: Decoded DEX swaps where target token is exchanged for stable/native coin.
* **`transfer`**: Generic token moves between non-pool addresses.
* **Detection Logic**: Maps GeckoTerminal swap metadata. If GeckoTerminal fails, Helius logs classification applies.

---

## 10. Wallet Analysis

### 10.1 Directly Observed
* Wallet address executing transactions (`from` and `to` properties).
* Total transaction count for each wallet in the batch.

### 10.2 Derived
* **Local Balance**: Net change computed as `total_in - total_out` inside the batch window.
* **Wash Trader Status**: Flagged if a wallet executes both a buy and a sell trade in the batch.
* **Round-Trips Count**: Calculated by pairing buys and sells chronologically.
* **CEX Association**: Tagged using `data/cex-addresses.json` exchange maps.
* **Top 10 Filtered Wallets**: After computing net balances, the top 30 wallets are checked against hardcoded DEX/router addresses and on-chain bytecode (EVM: `eth_getCode`; Solana: `getAccountInfo.executable`). Wallets identified as contracts or system programs are excluded. The remaining list is truncated to 10.
* **Holder Spike Detection**: Counts unique `to` addresses in the last 24h of the batch vs. prior. Flags a spike if ≥10 new holders and the 24h growth rate exceeds 50%.

### 10.3 Not Available
* Real on-chain balance (not queried from the node; local ledger only).
* Wallet age or first-transaction date.
* Cross-token trading history or ROI reputation.
* Funding source / creation chain.

---

## 11. Token Flow Analysis
Elevator Scan analyzes individual transaction steps. It does **not** trace multi-hop transfers (e.g. Wallet A -> Wallet B -> Wallet C) to find intermediary nodes. It only reconstructs direct transfers to/from centralized exchanges and lists filtered top holder balances derived from the transaction list.

---

## 12. DEX / Market Analysis
* **DEX / Router Tagging**: Identifies DEX platform name (e.g. Uniswap V2/V3, Raydium, Orca) from GeckoTerminal and Helius programs.
* **Prices**: Tracks price per token in USD (`priceUsd`) for individual swaps.
* **Current Spot Price**: In the UI, fetches current price from DexScreener to compute nominal USD valuations.

---

## 13. Existing Intelligence
* **Wash Trading (RF17 Indicator)**: Returns `true` if `totalVolume > avgVolume` while `Math.abs(priceChange) < 0.02`.
* **CEX Flow Metrics**: Tracks net exchange flows (`netExchangeFlow`) for WETH/USDT/BNB/SOL equivalents.
* **Trust Verification Badges**: Matches RPC logs against GeckoTerminal/Helius data on 3 random trades.

---

## 14. AI Analysis
* **AI Usage**: None. Elevator Scan has **NO AI implementations** in the codebase. All logic is rule-based and mathematical.

---

## 15. UI Output

| UI Element | Backend Source | Calculation | Purpose |
| :--- | :--- | :--- | :--- |
| **VerificationBadge** | `rawData.trust_score` | $\frac{\text{Verified}}{\text{Checked}} \cdot 100$ | Displays transaction authenticity. |
| **ExchangeFlowCard** | `rawData.exchange_flow` | Sums `toExchange` vs. `fromExchange` | Displays token inflows/outflows to exchanges. |
| **Wash Trading Banner**| `rawData.wash_trading` | Aggregates round-trips per flagged wallet | Warns users of potential wash trading. |
| **Top 10 Wallets** | `rawData.top_holders_filtered` | `total_in - total_out` in batch | Shows top holders derived from the transactions. |
| **Transaction Table** | `rawData.transactions` | Sorts, filters by Buy/Sell/Transfer | Detailed audit log of recent transactions. |

---

## 16. Data Model
```text
Raw API Payload (GeckoTerminal / Helius)
         ↓
UniversalTransaction Mapping
         ↓ (washTradingDetector)
Wash Trader & Round-Trip tags
         ↓ (feeEstimator / verifyTransactions)
Gas Estimates & Trust badge flags
         ↓ (tagAndComputeExchangeFlow)
CEX Labels (cex-addresses.json)
         ↓ (buildWalletData)
Local Wallet Balances & Metrics
         ↓
Consolidated Response (CollectorResult)
```

---

## 17. Deep Scan Module Overlap

| Deep Scan Module | Elevator Coverage | Evidence | Recommendation |
| :--- | :--- | :--- | :--- |
| **1. Wallet Quality** | NONE | No wallet age or co-funding graph analysis. | DEEP SCAN ONLY |
| **2. Organic Price** | PARTIAL | Basic wash trading checker exists (`washTradingDetector`). | SHARE WITH DEEP SCAN |
| **3. Liquidity Stress** | NONE | No price impact calculations. | DEEP SCAN ONLY |
| **4. Whale Behavior** | NONE | No dynamic whale tracking. | DEEP SCAN ONLY |
| **5. Smart Money** | NONE | No historical ROI profiles. | DEEP SCAN ONLY |
| **6. Buyer Quality** | NONE | No buyer profile scoring. | DEEP SCAN ONLY |
| **7. Exit Risk** | NONE | No exit stress testing. | DEEP SCAN ONLY |
| **8. Market Regime** | NONE | No regime detection. | DEEP SCAN ONLY |
| **9. Top Risks** | NONE | No ranked risk summaries. | DEEP SCAN ONLY |
| **10. Live Monitor** | NONE | No block webhook streams. | DEEP SCAN ONLY |
| **11. Multi-DEX Map** | PARTIAL | Lists DEX source names per transaction. | DEEP SCAN ONLY |
| **12. Cap Efficiency**| NONE | No MC/Liquidity ratios. | DEEP SCAN ONLY |
| **13. Historical Stats**| NONE | No cycle drawdown calculations. | DEEP SCAN ONLY |
| **14. Risk Scoring** | NONE | No explainable scoring. | DEEP SCAN ONLY |
| **15. Trader Intel** | NONE | No AI synthesis reports. | DEEP SCAN ONLY |

---

## 18. Reusable Elevator Data
* **Normalized Transaction Format**: `UniversalTransaction` is a clean, multi-chain type structure that Deep Scan's ingestion engines should adopt.
* **CEX Addresses JSON**: `data/cex-addresses.json` can be reused by Deep Scan to identify exchange transfers.
* **Gas Estimator**: `estimateTransactionFees` can be reused to compute average transaction costs.

---

## 19. Elevator Core Capabilities
* Chronological raw transaction tables (detailed audit logs).
* CEX net exchange flows tracking.
* Gas cost estimation per transaction.
* 3-transaction random audit trail checks.

---

## 20. Deep Scan Expansion Opportunities
* **Wash Trading**: Elevator Scan flags wash trading based *only* on a single buy and sell within the brief scanned window. Deep Scan should expand this by analyzing wallet clustering and funding networks to detect multi-wallet wash rings.
* **Holder Ledger**: Elevator Scan calculates holder lists by parsing transaction history inputs. Deep Scan must expand this by querying real, active balances from the node (or using indexing APIs) to generate true holder metrics.
* **Pool Liquidity**: GeckoTerminal already resolves pool addresses and volume figures (`reserve_in_usd`, `volume_usd.h24`). Deep Scan can consume these pool addresses directly to run constant-product liquidity stress simulations without re-discovering pools.
* **Multi-Hop Trade Graph**: `aggregateTrades()` already collapses Jupiter/1inch router hops into a single net trade per tx hash. Deep Scan can extend this to trace the full intermediate hop path, revealing whether large buys are split across pools to minimize price impact.

---

## 21. Duplication Risks
* **Transaction Ingestion**: Both systems must avoid query collision. If the user runs a Deep Scan, it should check the cache for transaction files loaded by Elevator Scan, extending the transaction logs instead of fetching the same block heights again.

---

## 22. Current Limitations
* **Imprecise Balances**: Wallet balances are computed strictly by adding/subtracting values from the retrieved transactions. It has no awareness of wallet balances held prior to the transaction window.
* **Strictly Local Heuristics**: The wash trading detector is limited to the current transaction batch (max 500 logs) and misses historical activity.
* **No AI Reasoning**: No prompt processing or synthesis of trader advisories.

---

## 23. Cost & Performance

| Component | Cost | Notes |
| :--- | :--- | :--- |
| GeckoTerminal pool discovery | LOW | Free tier, no key required. Rate-limited at ~30 req/min with 1200ms delay. |
| GeckoTerminal trade fetch (up to 5 pools) | MEDIUM | Each pool requires up to several paginated calls, each with a 1200ms sleep. Can take 3–8s for full 500-tx batch. |
| Birdeye OHLCV | LOW | Single request per scan. |
| Birdeye trades fallback | MEDIUM | Paginated 100/request. Uses API key (credit-based). |
| Helius transaction fetch | MEDIUM | Cursor pagination, 300ms sleep per batch, 3 retries. Consumes Helius compute credits at scale. |
| RPC address filter (top 30) | HIGH | Fires 30 concurrent `eth_getCode` or Solana `getAccountInfo` calls. On public RPCs, can hit rate limits. |
| RPC gas estimation (up to 15 trades) | HIGH | Each trade calls `eth_getTransactionReceipt` + sometimes `eth_getTransactionByHash`. 3s timeout each. |
| RPC verification (3 random) | MEDIUM | 3 additional Helius/RPC calls. |
| Total typical time | — | 3–12 seconds depending on chain, tier, and RPC conditions. |

---

## 24. Historical Depth
* **Analysis Limits**: Limited strictly to the requested N transactions (max 500).
* **No Memory**: Does not maintain historic wallet reputations or track cross-token histories.

---

## 25. Evidence Quality
* Every transaction in the table links directly to a transaction hash and network type, allowing manual validation by clicking through to block explorers (Etherscan/Solscan).

---

## 26. Security Findings
* **No sanitization on chain parameter (Severity: Low)**: `preferredChain` is passed directly from the API request to `detectChain`, which can lead to unverified inputs. However, `detectChain` safely checks matching strings (`solana`, `eth`, `bsc`), mitigating major security concerns.

---

## 27. Recommended Boundaries

### Basic Scan
* Owns basic token specifications, creator metadata, and contract audits.

### Elevator Scan
* Owns raw transaction tables, individual transaction fee audits, and CEX flow metrics.

### Deep Scan
* Owns execution stress tests (price impact simulations), whale tracking, smart money profiles, multi-pool market regimes, and evidence-first AI summaries.

---

## 28. Unknown / Unverified
* **Birdeye API Rate limits**: The exact rate limit configuration for the configured `BIRDEYE_API_KEY` is handled by the provider and could not be verified from the codebase.

---

## 29. Key Findings
* The local holder ledger calculation is a major structural limit: if a wallet holds tokens acquired prior to the scanned transactions, its balance is incorrectly computed.
* The system is technically robust, featuring a structured architecture for parallel multi-chain collection (Solana/BSC/ETH).
* There is no AI model usage in the Elevator Scan.

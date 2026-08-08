# Basic Scan Audit

## 1. Executive Summary
This document presents a technical audit of the existing **Basic Scan** system currently active in production.
Basic Scan acts as a fast, light-weight, entry-level token contract scan costing the user 2 credits. It focuses on validating contract metadata, checking basic ERC-20 configurations (like decimals, supply, and creator), calling GoPlus Labs APIs for standard security flags, and querying DEX aggregators (DexScreener, GeckoTerminal, DefiLlama) to establish pool pricing and liquidity.

**Key Findings:**
1. **Broken UI Dependencies**: The UI renders an "Advanced Risk Metrics" card displaying Top 10 Concentration, Token Velocity, and Transaction Frequency. However, all of these calculations depend on `recentTransactions`, which is hardcoded as an empty array `[]` in the backend code due to RPC limitations. Consequently, these metrics display as `0` or `0.0/min` in every scan.
2. **DEX Aggregator Fallback Path**: The market data layer uses a well-structured three-provider fallback chain (DexScreener -> GeckoTerminal -> DefiLlama) with automated retries and exponential backoff, which is highly robust.
3. **Decoupled Architecture**: Basic Scan is completely separate from raw transaction queries, serving as a rapid code-verification utility.

---

## 2. Actual Purpose
Basic Scan is designed to quickly verify whether a token contract is structurally valid, check standard security parameters (such as whether it is a honeypot, mintable, or freezable), and check if it has executable liquidity pools on decentralized exchanges. It does not perform historical analysis, trace wallet relationships, or simulate trade execution outcomes.

---

## 3. Execution Flow

The request flows sequentially through the following pipeline:

```text
[User input address] 
        ↓ (app/page.tsx)
[validateAddress Check]
        ↓ (lib/blockchain/tokenScanner.ts)
[POST /api/scan/basic]
        ↓ (app/api/scan/basic/route.ts)
[Supabase Session Token Auth]
        ↓ (supabase.auth.getUser)
[Atomic Credit Deduction (2 credits)]
        ↓ (supabase.rpc('deduct_credits_for_scan'))
[scanToken Coordinator Selection]
        ↓ (lib/blockchain/tokenScanner.ts)
[EVM / Solana Scanner execution]
        ↓ (evmScanner.ts / solanaScanner.ts)
[API Fallback Ingestion (GoPlus / DexScreener)]
        ↓ (goPlusSecurity.ts / marketDataFallback.ts)
[State Cache check & update]
        ↓ (cache.ts)
[JSON Response Return]
        ↓ (NextResponse.json)
[UI Cards State Populate & Render]
        ↓ (TokenOverviewCard / AdvancedRiskMetricsCard / TokenAuditCard / MarketIntelligenceCard)
```

---

## 4. File Inventory

| File | Function | Role |
| :--- | :--- | :--- |
| `app/page.tsx` | `handleScan` | Entry point UI triggering Basic Scan or Elevator Deep Scan. Displays loading state and renders cards. |
| `app/api/scan/basic/route.ts` | `POST` | Route handler. Authenticates sessions, deducts credits, triggers `scanToken`, and formats response. |
| `services/scannerApi.ts` | `getBasicScan` | Frontend API client requesting `POST /api/scan/basic` with session header. |
| `lib/blockchain/tokenScanner.ts` | `scanToken`, `validateAddress`, `detectNetwork` | Selection coordinator. Validates format and routes to EVM or Solana module. |
| `lib/blockchain/evmScanner.ts` | `scanEVMToken`, `autoDetectChainId` | Fetches on-chain supply/metadata and orchestrates API calls for EVM tokens. |
| `lib/blockchain/solanaScanner.ts` | `scanSolanaToken` | Ingests supply, mint/freeze authorities, and Token-2022 extensions for Solana. |
| `lib/blockchain/goPlusSecurity.ts` | `fetchGoPlusSecurity`, `getFallbackSecurityData` | Queries GoPlus Labs for contract threat profiles with Honeypot.is fallback. |
| `lib/blockchain/marketDataFallback.ts`| `fetchMarketDataWithFallback` | 3-tier fallback loader (DexScreener -> GeckoTerminal -> DefiLlama) for prices and pools. |
| `lib/blockchain/cache.ts` | `cacheStaticData`, `getStaticData` | Reads/writes cache storage to prevent duplicate static node calls. |
| `components/TokenOverviewCard.tsx` | Component function | Renders name, symbol, supply, verification, lock status, and taxes. |
| `components/AdvancedRiskMetricsCard.tsx`| Component function | Computes concentration and frequency metrics (relies on empty transactions array). |
| `components/TokenAuditCard.tsx` | Component function | Displays mintable and freezable indicator lights. |
| `components/MarketIntelligenceCard.tsx`| Component function | Renders total liquidity aggregates and pool-by-pair tables. |

---

## 5. Input
* **Required Parameters**:
  * `address` (String): Sanitized and trimmed token contract address.
  * `chain` (String): ID indicating EVM chain (defaults to `"1"`/Ethereum if auto-detection fails).
* **Validation Rules**:
  * EVM format checked via regex: `/^0x[a-fA-F0-9]{40}$/`.
  * Solana format checked via regex: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`.
  * Any format violation blocks execution, returning `400 Bad Request` with an descriptive error string.

---

## 6. Data Sources

| Source | Purpose | Endpoint/API | Data Retrieved | Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Public RPC Nodes** | Token metadata & state | Multiple public endpoints (Ankr, LlamaRPC) | DECIMALS, SUPPLY, bytecode | Free |
| **GoPlus Labs API** | Security audits | `api.gopluslabs.io/api/v1` | Taxes, Proxy flags, pause states | Free |
| **Honeypot.is API** | Tax simulation fallback | `api.honeypot.is/v2/IsHoneypot` | Buy/Sell tax percentages | Free |
| **DexScreener API** | Primary market data | `api.dexscreener.com/latest/` | Pools, prices, volumes, overrides | Free |
| **GeckoTerminal API**| Secondary market fallback| `api.geckoterminal.com/api/v2/`| Pools, reserves, prices | Free |
| **DefiLlama API** | Tertiary price fallback | `coins.llama.fi` | Price feeds | Free |

---

## 7. Blockchain Interaction
* **EVM Nodes**: Direct read-only connection to public RPC endpoints via `ethers.JsonRpcProvider`. Calls `name()`, `symbol()`, `decimals()`, and `totalSupply()`. Uses `provider.getCode(address)` to verify bytecode deployment across chains in parallel (Chain Auto-Detection).
* **Solana Nodes**: Connection via `@solana/web3.js`. Calls `connection.getTokenSupply()` to parse supply and decimals. Calls `connection.getParsedAccountInfo()` to inspect token authorities (mint authority, freeze authority) and read newer Token-2022 extensions (`transferFeeConfig`).

---

## 8. Processing & Calculations
* **EVM Decimals Fallback**: If standard RPC query fails, defaults to `18`.
* **Solana Fee Conversion**: Extracts Token-2022 transfer fee configuration and divides basis points by 100 to yield a percentage string:
  $$\text{Percentage} = \frac{\text{transferFeeBasisPoints}}{100}$$
* **Supply Fallback Calculation**: If the node fails to yield a supply, infers it from market parameters:
  $$\text{Total Supply} = \frac{\text{FDV}}{\text{Spot Price}}$$
* **Confidence Rating**: Evaluates sources successfully completed vs. failed sources:
  $$\text{Confidence} = \frac{\text{Completed Sources}}{\text{Completed Sources} + \text{Failed Sources}}$$

---

## 9. API Output
Structure returned under `NextResponse.json`:
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "tokenName": "TokenName",
    "symbol": "SYM",
    "decimals": 18,
    "totalSupply": 1000000,
    "contractVerified": true,
    "network": "ethereum",
    "recentTransactions": [],
    "networkHealth": { "lastBlock": "21049281", "blockReward": "0" },
    "recentVolume": "Unknown",
    "holderConcentration": "Medium",
    "securityInfo": { ... },
    "liquidityInfo": { "totalLiquidityUsd": 240000, "mainPools": [...] },
    "washTradingPercentage": 0,
    "taxBuy": "0.0%",
    "taxSell": "0.0%",
    "mintFunction": "Disabled",
    "freezable": "No",
    "liquidityLocked": false,
    "cacheStatus": "hit",
    "cachedAt": "2026-08-07T15:20:00.000Z",
    "meta": {
      "confidence": 1.0,
      "failed_sources": [],
      "completed_sources": ["static_data", "security_data", "market_data", "dynamic_data"],
      "partial_data": false
    }
  },
  "timestamp": "2026-08-07T16:32:00.000Z",
  "remainingCredits": 48
}
```

---

## 10. UI Output

### 10.1 UI Sections & Cards
1. **`TokenOverviewCard`**: Renders basic token properties, verified contract status, and buy/sell tax.
2. **`AdvancedRiskMetricsCard`**: Displays Top 10 Concentration, Token Velocity, and Transaction Frequency. **Note: These values are visually broken as they depend on the empty transaction array and default to zero.**
3. **`TokenAuditCard`**: Renders binary green/red checkboxes for Mintable and Freezable status.
4. **`MarketIntelligenceCard`**: Displays the aggregated USD liquidity and lists individual DEX pools.

---

## 11. Existing Features
* **Multi-Chain Detection**: Parallel RPC checks to verify bytecode presence on active networks.
* **Taxes Fallback**: Honeypot.is simulation execution when GoPlus fails to calculate taxes.
* **Token-2022 Parsing**: Parses Solana Token-2022 extensions for transfer fees.
* **Cached Reads**: Avoids hitting public nodes repeatedly for static values.

---

## 12. Existing Limitations
* **Empty Transfers Array**: `recentTransactions` is hardcoded as `[]` inside EVM and Solana scanners, making all transaction velocity and frequency metrics useless.
* **No Wallet Profiling**: Does not track wallet ages, funding origins, or coordinate clusters.
* **No Smart Money**: Has no historical profiling engines for smart money tracking.
* **Static Liquidity**: Does not simulate order size effects or slippage impact.

---

## 13. Deep Scan Overlap

| Deep Scan Module | Overlap | Evidence |
| :--- | :--- | :--- |
| **Module 1: Wallet Quality** | NONE | No wallet age or co-funding scans. |
| **Module 2: Organic Price** | NONE | Wash trading metric is hardcoded to `0` in `evmScanner.ts`. |
| **Module 3: Liquidity Stress** | NONE | No order simulations or constant product calculations. |
| **Module 4: Whale Behavior** | NONE | No balance snaps or dynamic whale monitoring. |
| **Module 5: Smart Money** | NONE | No historical win rate or PnL tracking. |
| **Module 6: Buyer Quality** | NONE | No cohort age or funding checks. |
| **Module 7: Exit Risk** | NONE | No scenario testing. |
| **Module 8: Market Regime** | NONE | Market regime is not calculated. |
| **Module 9: Top Risks** | PARTIAL OVERLAP | Basic `TokenAuditCard` shows issues (mintable/freezable). |
| **Module 10: Live Monitor** | NONE | No Websocket listeners. |
| **Module 11: Multi-DEX Map** | SUBSTANTIAL OVERLAP| Aggregator APIs query main pools list. Deep Scan will expand this. |
| **Module 12: Cap Efficiency** | NONE | Capital efficiency sensitivity is not computed. |
| **Module 13: Historical Behavior**| NONE | Price history drawdowns are not mapped. |
| **Module 14: Risk Scoring** | NONE | Scoring algorithms are missing. |
| **Module 15: Trader Intel** | NONE | No consolidated AI report or narrative generation. |

---

## 14. Reusable Data
* **Auto-Detect Chain Logic**: The parallel code-check algorithm `autoDetectChainId()` can be reused by Deep Scan to assign the correct EVM chain ID before querying.
* **GoPlus Labs Parser**: The normalization parameters for GoPlus metadata (`goPlusSecurity.ts`) are fully reusable as baseline indicators.
* **Market Fallback chain**: The DexScreener/GeckoTerminal fallback routines can provide the spot WETH/USDC prices needed to convert AMM reserves to USD.

---

## 15. Duplicate Risk
* **DEX Pool Discovery**: Deep Scan's Multi-DEX mapping should not fetch DexScreener API results from scratch if Basic Scan has already loaded the pool array. The cache database should store these pools as shared entities.

---

## 16. Recommended Boundary

### Basic Scan should own:
* Core metadata validation (token name, symbol, decimals, verified status).
* Simple smart contract audits (mintable, freezable, proxy indicators).
* Simple USD market valuations (spot price, nominal market capitalization, nominal total liquidity).

### Basic Scan should not own:
* Order execution simulations and slippage models.
* Real-time block event streaming or webhooks.
* Wallet relationship tracking or buyer quality analysis.
* Historical pump/dump drawdown analysis.

---

## 17. Key Findings
* **Broken Advanced UI Card**: The card `AdvancedRiskMetricsCard.tsx` displays Top 10 Concentration, Velocity, and Transaction Frequency. Since `recentTransactions` is hardcoded as an empty array `[]` in the backend, these fields calculate to `0` or `0.00%` on every scan. The UI card should be hidden or disabled during Basic Scan, and only rendered if Elevator or Deep Scan is executed.
* **GoPlus Limits**: GoPlus APIs are completely free but suffer rate limits and lag during high traffic.

---

## 18. Unknown / Could Not Verify
* **Atomic Credit Deduction Performance**: The atomic credit deduction is handled by a database RPC `deduct_credits_for_scan`. The internal database tables and function code for `deduct_credits_for_scan` are inside Supabase metadata and could not be audited via the filesystem.

# Basic Scan

## 1. Purpose

Basic Scan functions as a lightweight, low-latency, entry-level token security and contract metadata scanner. Its core objective is to execute rapid token contract checks, check security parameters, retrieve nominal spot prices, and aggregate active decentralized exchange (DEX) liquidity pools, charging the user a low cost of 2 credits.

Basic Scan solves the problem of immediate token authentication and threat validation before a user interacts with a token. It provides:
1. Structural check of EVM or Solana addresses.
2. Direct-from-node static property lookups (decimals, total supply, token name, token symbol) to bypass explorer API down times.
3. Rapid contract audit lookups via free third-party REST services (GoPlus Labs, Honeypot.is) to inspect basic threat variables (honeypots, buy/sell taxes, mint privileges, pausing).
4. Pool aggregation using dex aggregators (DexScreener, GeckoTerminal, DefiLlama) to establish nominal spot valuation and overall liquidity depth.

### Functional Boundaries
* **Basic Scan**: Focuses on static properties, threat flags, and current market aggregates. It does not perform historical transaction profiling, exits, drawdowns, or wallet clustering.
* **Elevator Scan**: Expands on Basic Scan by collecting OHLCV candles, parsing transaction arrays, calculating wallet balances, and computing basic metrics like Top 10 Concentration and Wash Trading.
* **Deep Scan**: The premium 15-credit report that performs full on-chain token intelligence. It maps transaction sequences, tracks smart money histories, wallet cohort age distributions, capital efficiencies, and runs advanced risk models.

---

## 2. Current Implementation Status

### Scope Definition
Basic Scan is designed as a low-cost (2 credits), low-latency static health check. Its primary purpose is to verify address formats, retrieve basic ERC-20/Solana metadata from node RPCs, map GoPlus/Honeypot.is threat flags, and fetch nominal market summaries.
Transaction history parsing, wallet concentration analyses, and mathematical risk scoring are **intentionally excluded** from its scope and deferred to the higher-tier Elevator (5–30 credits) and Deep (15 credits) scans to ensure Basic Scan completes within a 30-second target window and avoids excessive RPC API rate limits.

### Implementation Coverage
* **Intended Functional Scope:** **100% Complete** (all features defined for static token authentication and basic threats are fully implemented).
* **Comprehensive Feature Matrix:** **70% Complete** (due to the deliberate exclusion of transaction ingestion and risk scoring modules).

The breakdown by component is as follows:

| Component / Capability | Status | Notes |
| :--- | :--- | :--- |
| **Address Validation** | 100% | Validates address structures via regex formats in [`lib/blockchain/tokenScanner.ts:validateAddress`](file:///d:/scanner/lib/blockchain/tokenScanner.ts#L87). |
| **Multi-Chain Detection** | 100% | Resolves chains through concurrent RPC checks in [`lib/blockchain/evmScanner.ts:autoDetectChainId`](file:///d:/scanner/lib/blockchain/evmScanner.ts#L88). |
| **Credits Deduction** | 100% | Deducts 2 credits atomically using `deduct_credits_for_scan` in [`app/api/scan/basic/route.ts:L50`](file:///d:/scanner/app/api/scan/basic/route.ts#L50). |
| **Static Node Reads** | 100% | Fetches ERC-20 symbol, decimals, name, and caches them in [`lib/blockchain/cache.ts`](file:///d:/scanner/lib/blockchain/cache.ts). |
| **Security Flags** | 100% | Fetches security flags for EVM via GoPlus API, falling back to parsed token account authorities on Solana. |
| **Tax Simulation Fallback** | 100% | Automatically falls back to Honeypot.is when GoPlus tax values are missing. |
| **Market Data Fallback** | 100% | Uses the 3-provider fallback chain (DexScreener → GeckoTerminal → DefiLlama) in [`lib/blockchain/marketDataFallback.ts`](file:///d:/scanner/lib/blockchain/marketDataFallback.ts). |
| **Transactions Ingestion** | Intentionally Excluded | Unconditionally returns `[]` to prevent public RPC timeout/indexing limits. |
| **Risk Scoring Engine** | Intentionally Excluded | Risk levels and warnings are calculated client-side from raw security flags. |
| **UI Integration** | 100% | Successfully displays token metadata, security flags, and market data cards. The `AdvancedRiskMetricsCard` is rendered but displays default zero values. |

---

## 3. High-Level Execution Flow

The sequence diagram below displays how data travels through the system during a Basic Scan execution:

```text
User Input
    │
    ▼
Frontend Page [app/page.tsx]
    │
    ▼  (POST /api/scan/basic)
API Route Handler [app/api/scan/basic/route.ts]
    │
    ├─► Supabase Session Auth (supabase.auth.getUser)
    │
    ├─► Database RPC Credit Deduction (deduct_credits_for_scan)
    │
    ▼
Main Token Scanner Coordinator [lib/blockchain/tokenScanner.ts:scanToken]
    │
    ├─► Network Type detection (detectNetwork)
    │
    ├─► EVM Scanner [lib/blockchain/evmScanner.ts:scanEVMToken]
    │     │
    │     ├─► Probe & select public RPC node round-robin
    │     ├─► Probe bytecode on supported chains (autoDetectChainId)
    │     ├─► Check static cache [lib/blockchain/cache.ts:getStaticData]
    │     ├─► Query RPC (name, symbol, decimals, supply)
    │     ├─► GoPlus Labs API (buy/sell taxes, contract flags)
    │     │     └─► (Fallback: Honeypot.is simulation)
    │     └─► Market Data Fallback Chain [lib/blockchain/marketDataFallback.ts]
    │
    └─► Solana Scanner [lib/blockchain/solanaScanner.ts:scanSolanaToken]
          │
          ├─► Select active Solana RPC connection
          ├─► Check static cache
          ├─► Parse decimals (getTokenSupply)
          ├─► Read mint/freeze authority & Token-2022 extension (getParsedAccountInfo)
          └─► Market Data Fallback Chain [lib/blockchain/marketDataFallback.ts]
                │
                ├─► 1. DexScreener
                ├─► 2. GeckoTerminal
                └─► 3. DefiLlama
```

---

## 4. Entry Point

### API Route
`app/api/scan/basic/route.ts`

### Method
`POST`

### Code Reference
[app/api/scan/basic/route.ts:L7-L97](file:///d:/scanner/app/api/scan/basic/route.ts#L7-L97)

### Logic Execution Steps
1. **Authentication**: Extracts the `Authorization` header bearer token (lines 10-12). Validates the session token using `supabase.auth.getUser(token)` (lines 21-27). Returns `401 Unauthorized` if invalid.
2. **Payload Parsing**: Extracts `address` and `chain` from the request JSON body (line 29).
3. **Address Check**: Calls `validateAddress` from `lib/blockchain/tokenScanner.ts` (lines 39-45). Rejects with `400 Bad Request` if address format is invalid.
4. **Credit Check & Deduction**: Triggers the Supabase RPC function `deduct_credits_for_scan` passing the parameter `p_amount: 2` and `p_scan_type: 'BASIC'` (lines 47-59).
   * Row level database lock is acquired on `public.user_profiles` for update.
   * If balance is insufficient, returns `402 Payment Required` with code `INSUFFICIENT_CREDITS` (lines 65-70).
5. **Scanner Delegation**: Executes `scanToken(validation.address!, chain || '1')` (line 79).
6. **Response Generation**: Returns `NextResponse.json` containing:
   * `success: true`
   * `data`: Normalized `OnChainData` (excluding `recentTransactions`).
   * `metadata`: Duration, cache status, chain.
   * `timestamp`: ISO timestamp.
   * `remainingCredits`: Numeric balance updated after scan deduction.

---

## 5. Input

Basic Scan expects and parses these payload parameters:

| Input | Type | Required | Source | Purpose / Rules |
| :--- | :--- | :--- | :--- | :--- |
| `address` | `string` | **Yes** | Request Body | The contract address or Solana token mint. Checked by regex format validation. |
| `chain` | `string` | No | Request Body | EVM Chain ID (e.g. `"1"` = Eth, `"56"` = BSC). Defaults to `"1"` if omitted or auto-detection fails. |
| `Authorization` | `string` | **Yes** | Request Header | Header string formatted as `Bearer <supabase_access_token>`. |

---

## 6. Chain / Network Support

Network routing is handled in `lib/blockchain/tokenScanner.ts` under the function `detectNetwork` (lines 69-82).

```typescript
export function detectNetwork(address: string): boolean {
  const cleaned = address.trim().toLowerCase();
  if (cleaned.startsWith('0x') && cleaned.length === 42) {
    return false; // EVM Network
  }
  if (!cleaned.startsWith('0x') && cleaned.length >= 32 && cleaned.length <= 44) {
    return true; // Solana Network
  }
  throw new Error('Invalid address format - must be EVM (0x...) or Solana address');
}
```

### EVM Chains Configuration
Defined in `lib/blockchain/evmScanner.ts` under `PUBLIC_RPCS` (lines 15-42):

* **Ethereum (Chain ID: `1`)**: Probed via `https://eth.llamarpc.com`, `https://rpc.ankr.com/eth`, `https://cloudflare-eth.com`
* **BSC (Chain ID: `56`)**: Probed via `https://bsc-dataseed.binance.org/`, `https://rpc.ankr.com/bsc`, `https://binance.llamarpc.com`
* **Polygon (Chain ID: `137`)**: Probed via `https://polygon-rpc.com/`, `https://rpc.ankr.com/polygon`
* **Arbitrum (Chain ID: `42161`)**: Probed via `https://arb1.arbitrum.io/rpc`, `https://rpc.ankr.com/arbitrum`
* **Base (Chain ID: `8453`)**: Probed via `https://mainnet.base.org`, `https://base.llamarpc.com`
* **Optimism (Chain ID: `10`)**: Probed via `https://mainnet.optimism.io`, `https://optimism.llamarpc.com`

### EVM Auto-Detection Logic
If the user executes a scan passing a generic network indicator like `'evm'`, `autoDetectChainId(address)` is executed. It performs concurrent lightweight queries using `provider.getCode(address)` against all configured networks to verify which chain returns deployed bytecode. If none returns bytecode, it defaults to chain ID `'1'` (Ethereum).
* Code Reference: [lib/blockchain/evmScanner.ts:L88-L111](file:///d:/scanner/lib/blockchain/evmScanner.ts#L88-L111)

### Solana Configuration
* **Solana Network**: Probed via public nodes: `https://api.mainnet-beta.solana.com`, `https://rpc.ankr.com/solana`, `https://solana-rpc.publicnode.com`.
* Code Reference: [lib/blockchain/solanaScanner.ts:L13-L34](file:///d:/scanner/lib/blockchain/solanaScanner.ts#L13-L34)

---

## 7. External Data Sources / APIs

Basic Scan uses these third-party REST APIs:

### 1. GoPlus Labs API
* **Purpose**: Security audits (taxes, mintability, proxy, pausing).
* **Request Location**: `lib/blockchain/goPlusSecurity.ts`
* **Function**: `fetchGoPlusSecurity(address, chainId)`
* **Data Retrieved**: `is_honeypot`, `buy_tax`, `sell_tax`, `is_mintable`, `is_proxy`, `transfer_pausable`, `is_blacklisted`, `trading_cooldown`, `owner_change_balance`, `owner_address`, `creator_address`, `holder_count`, `total_supply`.
* **Failure Behavior**: Catches error, retries with backoff up to 5 times (status codes 429, 503, 504), and falls back to `getFallbackSecurityData()` (which yields 0% tax, no honeypot, and returns dummy values).
* Code Reference: [lib/blockchain/goPlusSecurity.ts:L73-L187](file:///d:/scanner/lib/blockchain/goPlusSecurity.ts#L73-L187)

### 2. Honeypot.is API
* **Purpose**: Tax simulation fallback for EVM tokens on Ethereum/BSC if GoPlus returns empty fields.
* **Request Location**: `lib/blockchain/goPlusSecurity.ts`
* **Function**: `fetchGoPlusSecurity` (within the fallback check block)
* **Data Retrieved**: `simulationResult.buyTax`, `simulationResult.sellTax`, `honeypotResult.isHoneypot`.
* **Failure Behavior**: If execution fails or times out, logs warning and retains defaults.
* Code Reference: [lib/blockchain/goPlusSecurity.ts:L144-L169](file:///d:/scanner/lib/blockchain/goPlusSecurity.ts#L144-L169)

### 3. DexScreener API
* **Purpose**: Primary pool data and pricing scraper.
* **Request Location**: `lib/blockchain/marketDataFallback.ts`
* **Function**: `fetchDexScreener(address)`
* **Data Retrieved**: Pair identifiers, DEX source, base/quote token names & symbols, spot prices (`priceUsd`), aggregate liquidity USD, 24h volume, FDV.
* **Failure Behavior**: Automatically triggers GeckoTerminal fallback.
* Code Reference: [lib/blockchain/marketDataFallback.ts:L109-L155](file:///d:/scanner/lib/blockchain/marketDataFallback.ts#L109-L155)

### 4. GeckoTerminal API
* **Purpose**: Secondary market data and pricing fallback.
* **Request Location**: `lib/blockchain/marketDataFallback.ts`
* **Function**: `fetchGeckoTerminal(address, chainId)`
* **Data Retrieved**: Active pool contract addresses, aggregate reserves in USD, spot prices, 24h volume.
* **Failure Behavior**: Automatically triggers DefiLlama fallback.
* Code Reference: [lib/blockchain/marketDataFallback.ts:L160-L219](file:///d:/scanner/lib/blockchain/marketDataFallback.ts#L160-L219)

### 5. DefiLlama API
* **Purpose**: Tertiary price index fallback.
* **Request Location**: `lib/blockchain/marketDataFallback.ts`
* **Function**: `fetchDefiLlama(address, chainId)`
* **Data Retrieved**: Current spot token price.
* **Failure Behavior**: Returns empty structure (`totalLiquidityUsd: 0, mainPools: [], source: 'fallback'`).
* Code Reference: [lib/blockchain/marketDataFallback.ts:L224-L276](file:///d:/scanner/lib/blockchain/marketDataFallback.ts#L224-L276)

---

## 8. Provider Architecture

The market data architecture uses a 3-provider fallback chain implementation with exponential backoff and jitter.

### 1. Market Data Fallback Chain
Controlled in `lib/blockchain/marketDataFallback.ts:fetchMarketDataWithFallback` (lines 19-60). The sequential priority is:
$$\text{DexScreener} \longrightarrow \text{GeckoTerminal} \longrightarrow \text{DefiLlama} \longrightarrow \text{Empty Fallback}$$

### 2. Retry Logic & Backoff
API calls to GoPlus and DEX aggregators are wrapped by `retryWithBackoff` found in `lib/blockchain/retryUtils.ts:retryWithBackoff` (lines 89-148).
* **Base attempts**: Default max is 3 retries (5 for GoPlus API).
* **Exponential Backoff Formula**:
  $$\text{Delay} = \min\left(\text{initialDelay} \times \text{backoffMultiplier}^{\text{attempt}}, \text{maxDelay}\right) + \text{Random Jitter (0 to 500ms)}$$
* **Filtered Failures**: Skips retrying permanent request errors (e.g. 404, 400, 401) and applies retries strictly on network timeouts, resets, or rate limit headers (codes 429, 503, 504).

---

## 9. Token Metadata Pipeline

Token metadata details are extracted and structured using the following path:

```text
Contract Address
       │
       ▼
Auto-Detect / Public RPC Probe
       │
       ▼
Check Cache [getStaticData]
       │
       ├─► (Cache Hit) ──► Load static token data from Cache
       │
       └─► (Cache Miss) ─► Query node directly (Batched Promise.all)
                             │
                             ├─► EVM: contract.name(), contract.symbol(), contract.decimals()
                             ├─► Solana: connection.getTokenSupply()
                             │
                             ▼
                           Normalize properties & save to cache [cacheStaticData]
```

### Metadata Fields Sourced & Populated

| Internal Property | Type | EVM Sourcing | Solana Sourcing |
| :--- | :--- | :--- | :--- |
| `tokenName` | `string` | Direct contract `name()` call. Fallback to DexScreener name override. | DexScreener name override. Fallback to `"Unknown Solana Token"`. |
| `symbol` | `string` | Direct contract `symbol()` call. Fallback to DexScreener symbol override. | DexScreener symbol override. Fallback to `"???"`. |
| `decimals` | `number` | Direct contract `decimals()` call. Fallback to `18`. | RPC `connection.getTokenSupply()` return. Fallback to `9`. |
| `totalSupply` | `number` | Direct contract `totalSupply()` call. Fallback to `FDV / basePriceUsd`. | RPC `connection.getTokenSupply().uiAmount` return. |
| `contractVerified` | `boolean` | Sourced as `false` by default (due to absence of explorer API integrations). | Sourced as `true` by default for Solana. |
| `network` | `string` | Resolved network chain name string (lowercase). | Sourced as `"solana"`. |

---

## 10. Contract / Security Analysis

Security analysis checks threat parameters using GoPlus on EVM and connection account parses on Solana.

### EVM Security Logic
Handled in `lib/blockchain/goPlusSecurity.ts:fetchGoPlusSecurity` (lines 73-187):

* **Honeypot Check**: GoPlus field `is_honeypot` mapped to boolean. If missing, simulates execution using Honeypot.is API.
* **Buy Tax & Sell Tax**: Parses decimal fractions from GoPlus (`buy_tax`, `sell_tax`) and multiplies by 100 to yield percentage numbers. Falls back to Honeypot.is simulation values.
* **Mint Check**: Maps `is_mintable === "1"` to evaluate mint authorization.
* **Pause Check**: Maps `transfer_pausable === "1"` to check if transfers can be blocked.
* **Proxy Check**: Maps `is_proxy === "1"` to check if it's a proxy contract.
* **Blacklist Check**: Maps `is_blacklisted === "1"` to identify wallet restrictions.
* **Trading Cooldown**: Maps `trading_cooldown === "1"` to find transfer speed restrictions.
* **Balance Alter Privilege**: Maps `owner_change_balance === "1"` to see if owner can modify balances.

### Solana Security Logic
Handled in `lib/blockchain/solanaScanner.ts:scanSolanaToken` (lines 121-142):
* Queries RPC `connection.getParsedAccountInfo(pubkey)` to inspect authorities.
* **Mint Check**: Evaluates if `info.mintAuthority` is present (`'Enabled'`) or null (`'Disabled'`).
* **Pause / Freeze Check**: Evaluates if `info.freezeAuthority` is present (`'Yes'`) or null (`'No'`).
* **Buy/Sell Tax**: Reads Token-2022 extensions. Checks if `extension === 'transferFeeConfig'` exists and reads basis points.

---

## 11. Liquidity / DEX Analysis

### 1. Pool Discovery & DEX Support
Aggregate pool lists are resolved using third-party market APIs (DexScreener / GeckoTerminal) inside `lib/blockchain/marketDataFallback.ts`.
Basic Scan lists the top 5 liquidity pools sorted by descending USD depth (lines 125-132).
Supported DEX platforms include Uniswap (V2 & V3), PancakeSwap (V2 & V3), SushiSwap, ApeSwap, Raydium, Orca, Meteora, Velodrome, and Aerodrome.

### 2. AMM Classification (V2 vs V3)
In order to prevent erroneous constant-product slippage modeling downstream, the helper function `inferPoolType` in `lib/blockchain/marketDataFallback.ts:inferPoolType` (lines 76-104) uses string pattern matching on the provider's DEX name to classify pools:
* **`concentrated-liquidity`**: Uniswap V3, PancakeSwap V3, Raydium CLMM, Orca Whirlpools, Meteora, DLMM, Algebra, Kyber, Thena V3, Camelot V3, QuickSwap V3, Aerodrome CL, Velodrome CL, and Slipstream.
* **`constant-product`**: Uniswap V2, PancakeSwap V2, SushiSwap, ApeSwap, Raydium Legacy, Orca Legacy, BiSwap, Mdex, BabySwap, SpookySwap, and Raydium/Orca defaults.
* **`unknown`**: Returned when the DEX name matches neither category.

### 3. Decimals & Sourcing
Nominal reserve quantities (raw base/quote balances) are not provided by public market APIs. Basic Scan does not fetch raw pool reserves. Decimals are retrieved only for the core token and are not mapped for pair counter-tokens.

---

## 12. Price / Market Data

The following table summarizes how price and market aggregates are resolved:

| Metric | Source | File | Function | Calculation |
| :--- | :--- | :--- | :--- | :--- |
| **Spot Token Price** | DexScreener / GeckoTerminal / DefiLlama | `lib/blockchain/marketDataFallback.ts` | `fetchMarketDataWithFallback` | Parses raw provider USD value (`priceUsd` or `token_price_usd`). |
| **Total Liquidity USD** | DexScreener / GeckoTerminal | `lib/blockchain/marketDataFallback.ts` | `fetchMarketDataWithFallback` | Sums USD liquidity across all detected trading pairs. |
| **Fully Diluted Valuation (FDV)** | DexScreener | `lib/blockchain/marketDataFallback.ts` | `fetchMarketDataWithFallback` | Returns raw `fdv` or `marketCap` metadata fields. |
| **24h Volume USD** | DexScreener / GeckoTerminal | `lib/blockchain/marketDataFallback.ts` | `fetchMarketDataWithFallback` | Extracts 24h rolling volume metric (`volume.h24`). |

---

## 13. Holder / Ownership Analysis

Basic Scan holder metrics are restricted to basic statistics returned by GoPlus:

* **Holder Count**: Read from GoPlus API field `holder_count` in `lib/blockchain/goPlusSecurity.ts` (line 130). Mapped to `0` if GoPlus is unavailable or fails. Mapped to `0` for Solana tokens (line 110) because public Solana RPC nodes do not return total holder aggregates.
* **Creator / Deployer Addresses**: Parsed from GoPlus fields `creator_address` and `owner_address` in `lib/blockchain/goPlusSecurity.ts` (lines 137-138).
* **LP Ownership & Whale Concentration**: Sourced as `0` or `'Medium'` by default. No historical calculations are done in Basic Scan.

---

## 14. Risk / Scoring

> [!WARNING]
> **No Backend Scoring Logic**: Basic Scan contains no numerical risk scoring calculation or weight classification logic in the backend. 
> Risk evaluation is delegated to frontend components showing warning badges on specific flags (e.g., contract verified = false, honeypot = true, mint = Enabled).

---

## 15. Output Contract

The JSON payload structure returned by `POST /api/scan/basic` matches the NextJS API route schema.

### TypeScript Interface
Defined in `lib/blockchain/types.ts` as `ScanResult` (lines 295-308):

```typescript
export interface ScanResult {
  success: boolean;
  data: {
    onChainData: OnChainData;
    metadata: {
      network: 'solana' | 'evm';
      chainId: string | null;
      cacheStatus: 'hit' | 'miss';
      scanDuration: number;
    };
  };
  timestamp: string;
}
```

### Schema Properties

```json
{
  "success": true,
  "data": {
    "address": "string (hex format for EVM, base58 for Solana)",
    "tokenName": "string",
    "symbol": "string",
    "decimals": "number",
    "totalSupply": "number",
    "contractVerified": "boolean",
    "network": "string (lowercase chain name)",
    "recentTransactions": [],
    "networkHealth": {
      "lastBlock": "string (latest block height height)",
      "blockReward": "string"
    },
    "recentVolume": "string ('High' | 'Medium' | 'Low' | 'Unknown')",
    "holderConcentration": "string ('High' | 'Medium' | 'Low')",
    "securityInfo": {
      "buyTax": "number",
      "sellTax": "number",
      "hasMintFunction": "boolean",
      "canBePaused": "boolean",
      "isHoneypot": "boolean",
      "holderCount": "number",
      "lpHolderCount": "number",
      "creatorAddress": "string (optional)",
      "ownerAddress": "string (optional)"
    },
    "liquidityInfo": {
      "totalLiquidityUsd": "number",
      "mainPools": [
        {
          "pair": "string (e.g. 'WETH/USDT')",
          "poolAddress": "string (optional)",
          "dex": "string",
          "liquidityUsd": "number",
          "priceUsd": "number (optional)",
          "type": "string ('constant-product' | 'concentrated-liquidity' | 'unknown')"
        }
      ],
      "tokenNameOverride": "string (optional)",
      "symbolOverride": "string (optional)",
      "fdv": "number (optional)",
      "basePriceUsd": "number",
      "volume24hUsd": "number (optional)",
      "source": "string ('dexscreener' | 'geckoterminal' | 'defillama' | 'fallback')"
    },
    "washTradingPercentage": "number",
    "taxBuy": "string (formatted percentage, e.g. '1.5%')",
    "taxSell": "string (formatted percentage, e.g. '1.5%')",
    "mintFunction": "string ('Enabled' | 'Disabled')",
    "freezable": "string ('Yes' | 'No')",
    "liquidityLocked": "boolean (defaults to false)",
    "cacheStatus": "string ('hit' | 'miss')",
    "cachedAt": "string (ISO timestamp)",
    "meta": {
      "confidence": "number",
      "failed_sources": "array of strings",
      "completed_sources": "array of strings",
      "partial_data": "boolean"
    }
  },
  "timestamp": "string (ISO format)",
  "remainingCredits": "number (credits balance)"
}
```

---

## 16. UI Consumption

Basic Scan results are requested by `app/page.tsx` and mapped to React components.

### 1. Components & Sourced Data

* **`TokenOverviewCard.tsx`**: Renders basic token properties, verified contract status, and buy/sell tax.
  * *Properties*: `tokenName`, `address`, `symbol`, `totalSupply`, `contractVerified`, `taxBuy`, `taxSell`, `washTradingPercentage`.
* **`TokenAuditCard.tsx`**: Renders binary green/red indicator lights for Mintable and Freezable status.
  * *Properties*: `mintFunction`, `freezable`.
* **`MarketIntelligenceCard.tsx`**: Displays the aggregated USD liquidity and lists individual DEX pools.
  * *Properties*: `liquidityInfo.totalLiquidityUsd`, `liquidityInfo.mainPools` array mapping `pair`, `dex`, `liquidityUsd`, `priceUsd`.
* **`AdvancedRiskMetricsCard.tsx`**: Renders Top 10 Concentration, Velocity, and Transaction Frequency.
  * *Properties*: `recentTransactions` array.

### 2. Broken UI Integration
`AdvancedRiskMetricsCard` calculates Top 10 Concentration, Velocity, and Transaction Frequency by iterating over `token.recentTransactions`. Because the EVM and Solana scanners return an empty transaction array (`[]`) for Basic Scan, all of these advanced calculations evaluate to `0` or default to `0.0%` in the UI for every scan.

---

## 17. Data Normalization

Basic Scan normalizes raw values into consistent formats:

* **Address Normalization**: EVM address strings are trimmed and forced to lowercase in `validateAddress` ([lib/blockchain/tokenScanner.ts:L103](file:///d:/scanner/lib/blockchain/tokenScanner.ts#L103)).
* **GoPlus Tax Parsing**: GoPlus returns tax values as float strings (e.g. `0.05` for 5%). The GoPlus client normalizes these by multiplying by 100 to yield floats (e.g. `5.0` for 5%) ([lib/blockchain/goPlusSecurity.ts:L126-L127](file:///d:/scanner/lib/blockchain/goPlusSecurity.ts#L126-L127)).
* **Solana Token-2022 Tax**: Solana transfer fee basis points (e.g. `150`) are divided by 100 to yield standard percentage strings (e.g. `"1.5%"`) ([lib/blockchain/solanaScanner.ts:L133-L135](file:///d:/scanner/lib/blockchain/solanaScanner.ts#L133-L135)).
* **EVM Decimals Conversion**: Converts BigInt token total supply values into readable numbers using `ethers.formatUnits` and decimals information ([lib/blockchain/evmScanner.ts:L244](file:///d:/scanner/lib/blockchain/evmScanner.ts#L244)).

---

## 18. Error Handling / Degraded States

If errors occur during a scan, Basic Scan degrades rather than failing completely:

* **RPC Node Failure**: Both EVM and Solana modules use round-robin RPC lists. If an RPC fails, it catches the error and probes the next node in line ([lib/blockchain/evmScanner.ts:L139-L152](file:///d:/scanner/lib/blockchain/evmScanner.ts#L139-L152)). If all nodes fail, it throws an error.
* **GoPlus API Failures**: If GoPlus fails or times out, it uses fallback security defaults (0% tax, false flags, 0 holders) to return a degraded result ([lib/blockchain/goPlusSecurity.ts:L192-L213](file:///d:/scanner/lib/blockchain/goPlusSecurity.ts#L192-L213)).
* **Market Data Failures**: If DexScreener is offline, the search falls back to GeckoTerminal, then to DefiLlama. If all three fail, it returns a nominal empty structure (`totalLiquidityUsd: 0, mainPools: [], source: 'fallback'`) ([lib/blockchain/marketDataFallback.ts:L54-L60](file:///d:/scanner/lib/blockchain/marketDataFallback.ts#L54-L60)).
* **Token Metadata Failures**: If RPC supply queries fail, the scanner infers token supply from market metrics:
  $$\text{Total Supply} = \frac{\text{FDV}}{\text{Spot Price}}$$
  Code Reference: [lib/blockchain/evmScanner.ts:L268-L272](file:///d:/scanner/lib/blockchain/evmScanner.ts#L268-L272)

---

## 19. Caching

Basic Scan uses a local, in-memory cache to prevent duplicate external requests.

### Implementation
Defined in `lib/blockchain/cache.ts`. It stores entries using two Map structures: `staticCache` (for token properties) and `securityCache` (for threat flags).

### Invalidation & Expiry
* **Static Data Cache**: Name, symbol, decimals, network name, and verified flag are cached permanently. Expiry is set to `Infinity` ([lib/blockchain/cache.ts:L20](file:///d:/scanner/lib/blockchain/cache.ts#L20)).
* **Security Data Cache**: Tax configuration and security indicators are cached with a Time-To-Live (TTL) of **7 days** ($7 \times 24 \times 60 \times 60 \times 1000$ milliseconds) ([lib/blockchain/cache.ts:L21](file:///d:/scanner/lib/blockchain/cache.ts#L21)).
* **Market Data**: Not cached due to rapid volatility ([lib/blockchain/cache.ts:L10](file:///d:/scanner/lib/blockchain/cache.ts#L10)).
* **Cleanup Cron**: Runs every hour to delete expired entries ([lib/blockchain/cache.ts:L33-L45](file:///d:/scanner/lib/blockchain/cache.ts#L33-L45)):
  ```typescript
  if (typeof setInterval !== 'undefined') {
    setInterval(cleanupExpiredEntries, 60 * 60 * 1000);
  }
  ```

---

## 20. Database Usage

Basic Scan database actions are focused on user credits authentication and transaction ledger recordings.

### Database Tables Accessed
* **`public.user_profiles`**: Reads the user balance (`credits_balance`). Subtracts 2 credits during validation.
* **`public.credit_transactions`**: Writes deduction records to the credit transaction ledger.

### Database Operations
All credits adjustments are processed using a PostgreSQL database function `deduct_credits_for_scan`.
1. Locks the row in `public.user_profiles` using `SELECT FOR UPDATE` to avoid race conditions ([database/deduct_credits_for_scan.sql:L55-L60](file:///d:/scanner/database/deduct_credits_for_scan.sql#L55-L60)).
2. Verifies `credits_balance >= 2`. Throws exception if balance is insufficient ([database/deduct_credits_for_scan.sql:L67-L69](file:///d:/scanner/database/deduct_credits_for_scan.sql#L67-L69)).
3. Deducts 2 credits and inserts a transaction log with `type = 'scan_deduction'` and `amount = -2` ([database/deduct_credits_for_scan.sql:L80-L106](file:///d:/scanner/database/deduct_credits_for_scan.sql#L80-L106)).
4. Uses the `scan_id` parameter to prevent duplicate charges and ensure transaction-level idempotency ([database/deduct_credits_for_scan.sql:L43-L53](file:///d:/scanner/database/deduct_credits_for_scan.sql#L43-L53)).

---

## 21. Credit / Cost Model

* **Cost**: A Basic Scan transaction costs **2 credits** ([app/api/scan/basic/route.ts:L48](file:///d:/scanner/app/api/scan/basic/route.ts#L48)).
* **Enforcement**: Processed in `app/api/scan/basic/route.ts` using `supabase.rpc('deduct_credits_for_scan')` prior to token scanning execution (lines 50-76).
* **Failure Refund**: If the downstream scanning execution throws an exception, the current implementation *does not execute* `refund_credits_for_scan` in the catch block of the API handler (lines 88-96). Consequently, credits are deducted even if the scan fails downstream.

---

## 22. Tests

There are no automated unit or integration tests for Basic Scan modules (`tokenScanner.ts`, `evmScanner.ts`, `solanaScanner.ts`, `marketDataFallback.ts`, `goPlusSecurity.ts`) in the current repository.

* **Empty Test Folder**: The folder `lib/blockchain/__tests__` contains no files.
* **Diagnostic Collectors**: The root level tests (`test_elevator_scan.ts`, `audit_accuracy.ts`) test the Solana, Eth, and BSC collectors developed for the 10-credit Elevator Scan module. They do not run assertions against the Basic Scan pipeline.

---

## 23. Known Limitations

The following limitations exist in the current Basic Scan implementation:

1. **Empty Transaction List**:
   * *Detail*: `recentTransactions` is unconditionally set to `[]` inside both scanners.
   * *Reason*: Public RPC endpoints lack transaction indexing for fast history retrieval, and fetching history would exceed the 30-second target duration and credit budget (2 credits). This is an acceptable architectural trade-off to keep the scan rapid and low-cost.
   * *Code location*: [`lib/blockchain/evmScanner.ts:L255`](file:///d:/scanner/lib/blockchain/evmScanner.ts#L255) and [`lib/blockchain/solanaScanner.ts:L148`](file:///d:/scanner/lib/blockchain/solanaScanner.ts#L148).
   * *Downstream impact*: Causes the `AdvancedRiskMetricsCard` to calculate and render `0` or `0.0%` for concentration, velocity, and transaction frequency in the frontend.
2. **Missing EVM Contract Verification Sourcing**:
   * *Detail*: `contractVerified` is defaulted to `false` for all EVM scans.
   * *Reason*: The EVM scanner does not integrate with Etherscan/BscScan verification APIs.
   * *Code location*: [`lib/blockchain/evmScanner.ts:L299`](file:///d:/scanner/lib/blockchain/evmScanner.ts#L299) (defaults to `staticData?.contractVerified || false`).
   * *Downstream impact*: EVM tokens always show "Unverified Threat" in the UI even if they are verified.
3. **No Solana Holder Count Sourcing**:
   * *Detail*: `holderCount` returns `0` for Solana tokens.
   * *Reason*: Public Solana RPCs do not expose aggregate holder count endpoints.
   * *Code location*: [`lib/blockchain/solanaScanner.ts:L110`](file:///d:/scanner/lib/blockchain/solanaScanner.ts#L110).
   * *Downstream impact*: Sourced as `0` in UI payload.
4. **No Exit/Scoring Logic**:
   * *Detail*: No backend mathematical risk rating is calculated.
   * *Reason*: The risk rating engines are missing from the backend Basic Scan services and are intentionally deferred to higher scan tiers.
   * *Downstream impact*: Frontend must calculate basic warnings using raw threat flags.
5. **No Downstream Refund Logic**:
   * *Detail*: Credits are not refunded if the scanner fails downstream.
   * *Reason*: The route handler does not call `refund_credits_for_scan` in its catch block.
   * *Code location*: [`app/api/scan/basic/route.ts:L88-L96`](file:///d:/scanner/app/api/scan/basic/route.ts#L88-L96).
   * *Downstream impact*: Users lose credits if RPC timeouts trigger an API exception.

---

## 24. Capability Matrix

| Capability | Status | Evidence | Source |
| :--- | :--- | :--- | :--- |
| **Address Validation** | 🟢 Implemented | Rejects incorrect formats immediately with `400`. | [`lib/blockchain/tokenScanner.ts:validateAddress`](file:///d:/scanner/lib/blockchain/tokenScanner.ts#L87) |
| **Multi-Chain Detection** | 🟢 Implemented | Probes EVM chains concurrently for bytecode. | [`lib/blockchain/evmScanner.ts:autoDetectChainId`](file:///d:/scanner/lib/blockchain/evmScanner.ts#L88) |
| **Static Metadata Reads** | 🟢 Implemented | Fetches name, symbol, decimals directly via RPC. | [`lib/blockchain/evmScanner.ts:scanEVMToken`](file:///d:/scanner/lib/blockchain/evmScanner.ts) |
| **Threat Audit Flags** | 🟢 Implemented | GoPlus API maps standard contract flags. | [`lib/blockchain/goPlusSecurity.ts`](file:///d:/scanner/lib/blockchain/goPlusSecurity.ts) |
| **Tax Simulation** | 🟢 Implemented | Falls back to Honeypot.is when GoPlus fails. | [`lib/blockchain/goPlusSecurity.ts`](file:///d:/scanner/lib/blockchain/goPlusSecurity.ts) |
| **Market Data Fallback** | 🟢 Implemented | Succeeds through DexScreener/GeckoTerminal/DefiLlama. | [`lib/blockchain/marketDataFallback.ts`](file:///d:/scanner/lib/blockchain/marketDataFallback.ts) |
| **Solana Token-2022 Tax** | 🟢 Implemented | Parses Solana transfer fee configs. | [`lib/blockchain/solanaScanner.ts`](file:///d:/scanner/lib/blockchain/solanaScanner.ts) |
| **EVM Verified Status** | 🔴 Excluded / Unresolved | Sourced as `false` due to lack of explorer API key support. | [`lib/blockchain/evmScanner.ts`](file:///d:/scanner/lib/blockchain/evmScanner.ts) |
| **Transactions Ingestion** | 🔴 Excluded / Unresolved | Hardcoded as `[]` inside EVM & Solana scanners. | [`lib/blockchain/evmScanner.ts`](file:///d:/scanner/lib/blockchain/evmScanner.ts) |
| **Backend Risk Score** | 🔴 Excluded / Unresolved | Not implemented in backend scan objects. | [`lib/blockchain/types.ts`](file:///d:/scanner/lib/blockchain/types.ts) |
| **Refund on Timeout** | 🔴 Excluded / Unresolved | Not handled in the catch block of NextJS API route. | [`app/api/scan/basic/route.ts`](file:///d:/scanner/app/api/scan/basic/route.ts) |
| **Solana Holder Aggregates**| 🔴 Excluded / Unresolved | Solana RPC limits make it return `0` holders. | [`lib/blockchain/solanaScanner.ts`](file:///d:/scanner/lib/blockchain/solanaScanner.ts) |
| **Smart Money Tracking** | 🔴 Excluded / Unresolved | No buyer cohort logic. | [`lib/blockchain/tokenScanner.ts`](file:///d:/scanner/lib/blockchain/tokenScanner.ts) |

---

## 25. Source Code Map

```text
Basic Scan System
│
├── API Route Handler
│   └── app/api/scan/basic/route.ts
│
├── Orchestration Coordinator
│   └── lib/blockchain/tokenScanner.ts
│
├── Execution Scanner Modules
│   ├── lib/blockchain/evmScanner.ts
│   └── lib/blockchain/solanaScanner.ts
│
├── Third-Party Ingestors
│   ├── lib/blockchain/goPlusSecurity.ts
│   └── lib/blockchain/marketDataFallback.ts
│
├── Utilities & Caching
│   ├── lib/blockchain/cache.ts
│   └── lib/blockchain/retryUtils.ts
│
├── Database Ledger Functionality
│   └── database/deduct_credits_for_scan.sql
│
└── Frontend Interface Cards
    ├── components/TokenOverviewCard.tsx
    ├── components/TokenAuditCard.tsx
    ├── components/MarketIntelligenceCard.tsx
    └── components/AdvancedRiskMetricsCard.tsx
```

---

## 26. Scope Completion Statement

The Basic Scan is considered complete and operational for its intended functional scope. It successfully operates as a low-cost, low-latency entry-point scan providing basic ERC-20/Solana metadata, security threat audits, and pool market summaries. The transaction ingestion deficit (`recentTransactions: []`) and related metric deficits (e.g. `AdvancedRiskMetricsCard` displaying zero values) are documented as known architectural limitations. They represent intentional design trade-offs made to optimize scan execution speed and restrict public RPC usage, with advanced transactional analysis deferred to higher-tier scans (Elevator Scan and Deep Scan).


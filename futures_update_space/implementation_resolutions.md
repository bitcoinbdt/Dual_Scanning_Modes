# Technical Friction Resolutions Guide

This document specifies the exact code-level resolutions for the six potential areas of confusion identified during technical review. These designs must be followed strictly during the implementation phase.

---

## 1. Solana Launchpad Detection Program Verification
To avoid unreliable string matching (like checking for the `pump` suffix), the router must check the **Mint Authority** and **Freeze Authority** programs.

### TypeScript Resolution
```typescript
import { Connection, PublicKey } from '@solana/web3.js';

const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
// ✅ C-001 RESOLVED: Correct Raydium LaunchLab program ID confirmed from official Raydium docs
// Source: https://docs.raydium.io/raydium/protocol/developers/addresses
const RAYDIUM_LAUNCHLAB_PROGRAM_ID = 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj';

export async function detectSolanaLaunchpad(
  connection: Connection,
  mintAddress: string
): Promise<{ isLaunchpad: boolean; platform: 'pump' | 'launchlab' | 'none' }> {
  const mintPubKey = new PublicKey(mintAddress);
  const accountInfo = await connection.getParsedAccountInfo(mintPubKey);
  
  const parsedData = (accountInfo.value?.data as any)?.parsed?.info;
  if (!parsedData) {
    return { isLaunchpad: false, platform: 'none' };
  }

  const mintAuthority = parsedData.mintAuthority;
  const freezeAuthority = parsedData.freezeAuthority;

  // Pump.fun sets mint authority to null after graduation, but freeze authority remains null
  // Pre-graduation: Mint authority is the Pump.fun bonding curve PDA
  if (mintAuthority === PUMP_FUN_PROGRAM_ID || freezeAuthority === PUMP_FUN_PROGRAM_ID) {
    return { isLaunchpad: true, platform: 'pump' };
  }

  // Same check for Raydium LaunchLab
  if (mintAuthority === RAYDIUM_LAUNCHLAB_PROGRAM_ID) {
    return { isLaunchpad: true, platform: 'launchlab' };
  }

  return { isLaunchpad: false, platform: 'none' };
}
```

---

## 2. Resilient Non-Blocking Ingestion Loop (10k Transaction Bounds)
To prevent API timeouts from breaking the deep scan execution, the transaction fetching loop must use a page-by-page aggregator with a hard timeout and error fallback.

### TypeScript Resolution
```typescript
export async function fetchTransactionsResilient(
  tokenAddress: string,
  fetchPageFn: (address: string, page: number) => Promise<any[]>,
  targetCount: number = 10000
): Promise<{ transactions: any[]; status: 'ok' | 'partial' }> {
  const allTx: any[] = [];
  let page = 1;
  let hasMore = true;

  while (allTx.length < targetCount && hasMore) {
    try {
      // Fetch page with a strict 2-second timeout per page request
      const pageTx = await Promise.race([
        fetchPageFn(tokenAddress, page),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Page Timeout')), 2000))
      ]);

      if (!pageTx || pageTx.length === 0) {
        hasMore = false;
        break;
      }

      allTx.push(...pageTx);
      page++;
    } catch (error) {
      console.warn(`[INGEST] Ingestion interrupted on page ${page}:`, error);
      // Immediately stop loop and return what we have so far as a partial payload
      return { 
        transactions: allTx.slice(0, targetCount), 
        status: 'partial' 
      };
    }
  }

  return { 
    transactions: allTx.slice(0, targetCount), 
    status: 'ok' 
  };
}
```

---

## 7. C-002 Resolution — Virtual Reserve Fetch: Primary vs Fallback Path

**Resolution**: The two approaches mentioned across spec files are now unified into a single priority chain:

1. **Primary — Native on-chain RPC** (always attempted first):
   - For Pump.fun: call `connection.getAccountInfo(bondingCurvePda)` and deserialize using the known Pump.fun bonding curve account layout (see `bonding_curve_funnel.md §5B`).
   - For Raydium LaunchLab: call `connection.getAccountInfo(launchLabPoolPda)` to read virtual reserves.
   - **Why primary**: $0 cost, no rate limits, most accurate (directly on-chain).

2. **Fallback — Codex API or PumpPortal** (used only if RPC fails or returns no data):
   - Query `PumpPortal` WebSocket/REST for Pump.fun bonding curve metadata.
   - Query `Codex API` for LaunchLab pool metadata.
   - Cache Codex/PumpPortal responses for **60 seconds** to stay within free-tier limits.
   - **Why fallback**: Third-party APIs may have better parsing for new pool types but add cost and rate-limit risk.

```typescript
export async function fetchVirtualReserves(
  connection: Connection,
  platform: 'pump' | 'launchlab',
  mintAddress: string
): Promise<VirtualReserves | null> {
  try {
    // Primary: native RPC
    return await fetchReservesFromRPC(connection, platform, mintAddress);
  } catch {
    // Fallback: third-party API
    return await fetchReservesFromAPI(platform, mintAddress);
  }
}
```

---

## 8. C-009 Resolution — EVM Pre-Graduation Detection

**Scope Decision**: EVM pre-graduation detection is scoped **only to PinkSale and DXSale** — the two dominant EVM presale platforms. Other custom presale contracts are treated as unknown and skipped.

### Detection Logic
```typescript
// Static registry of known EVM presale platform factory addresses
const EVM_PRESALE_FACTORIES: Record<string, string[]> = {
  '56': [ // BSC
    '0x7ee9139ad4cd4efb26c6d03d36e2d1945f0d98ac', // PinkSale BSC
    '0xd99d1c33f9fc3444f8101754abc46c52416550d1', // DXSale BSC
  ],
  '1': [ // Ethereum
    '0x7ee9139ad4cd4efb26c6d03d36e2d1945f0d98ac', // PinkSale ETH
  ],
};

// Detection: check if token's largest holder is a known presale factory
export async function detectEVMPresale(
  tokenAddress: string,
  chainId: string,
  provider: ethers.Provider
): Promise<{ isPresale: boolean; presaleContract: string | null }> {
  const factories = EVM_PRESALE_FACTORIES[chainId] ?? [];
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  for (const factory of factories) {
    const balance: bigint = await tokenContract.balanceOf(factory);
    const totalSupply: bigint = await tokenContract.totalSupply();
    // If factory holds > 10% of total supply, presale is active
    if (totalSupply > 0n && (balance * 100n) / totalSupply > 10n) {
      return { isPresale: true, presaleContract: factory };
    }
  }
  return { isPresale: false, presaleContract: null };
}
```

**Fallback**: If no known presale factory holds tokens, the EVM token is treated as post-launch (standard AMM path). No false positives — unrecognized presale contracts are not misclassified.

---

## 3. First-Hop CEX Exit Filtering
To avoid nested $O(N)$ RPC requests to resolve multi-hop transactions, we only inspect the **first hop** of the token's transfer history.

### Verification Logic
1. Load the flat list of `UniversalTransaction` records for the token.
2. Filter transactions where the `type` is `transfer` or `sell`.
3. Check if the `to` address matches a known exchange deposit wallet (loaded from a static list of verified CEX hot wallets and sweep addresses).
4. If a match is found, count the volume as an **Implied Sale** (CEX Exit).
5. **No recursive lookups**: Do not attempt to query where those funds were sent afterward. The trace stops at the first exchange deposit boundary.

---

## 4. Normalizing the Insider Accumulation Volume Baseline
To prevent temporary transaction waves from distorting the "event spike" logic, we formulate the baseline hourly mean volume using the verified 24-hour total.

### Calculation Sequence
```typescript
// 1. Get 24-hour volume from basic scan metadata
const total24hVolumeUsd = basicScan.volume24hUsd;

// 2. Define hourly mean volume
const meanHourlyVolumeUsd = total24hVolumeUsd / 24;

// 3. Define the standard deviation (use a standard coefficient of variation of 0.5 as baseline if historical stddev is null)
const volumeStdDev = meanHourlyVolumeUsd * 0.5;

// 4. Flag candle as event if:
//    candleVolume > meanHourlyVolumeUsd + (3.0 * volumeStdDev)
```

---

## 5. Standardized EVM Locker Registry Checks
Instead of attempting to scan random custom vesting contracts, the tracker uses a static registry containing the top locking protocols.

### EVM Locker Registry
```typescript
export const EVM_LOCKER_REGISTRY: Record<string, string[]> = {
  '1': [ // Ethereum
    '0x6630fca68652136e053d2d0b556b69b0fa5cd9ec', // PinkLock
    '0x207acc34645ad68686e088a8d11c793ff8ffc0b3', // Sablier V1
    '0x092b740aa88383e7105e4e7e60b299e5251648bc', // Team Finance
  ],
  '56': [ // BSC
    '0x40799fdd58a4d7d6f51be8c281df6815fc65c8ec', // PinkLock BSC
    '0x7ee9139ad4cd4efb26c6d03d36e2d1945f0d98ac', // Unicrypt
  ]
};

// Execution: Query balanceOf(lockerAddress) for the scanned token.
// The sum of these balances represents the verifiable locked supply.
// Any other locks (custom contracts) are treated as standard whale distributions.
```

---

## 6. Groq Fallback Web Scraping Pipeline
For the Llama 3.3 fallback model (which lacks search engines), the backend must fetch and clean the announcement HTML page.

### Text Stripping Utility
```typescript
import axios from 'axios';

export async function fetchAndCleanHTML(url: string): Promise<string> {
  const { data } = await axios.get(url, { 
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    timeout: 5000 
  });
  
  // 1. Remove scripts, styles, and iframe tags
  let text = data
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<iframe[^>]*>([\s\S]*?)<\/iframe>/gi, '');
    
  // 2. Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // 3. Normalize whitespace and trim
  text = text.replace(/\s+/g, ' ').trim();
  
  // 4. Return the first 10,000 characters to fit Groq context limits
  return text.substring(0, 10000);
}
```
Groq then extracts the token name, dates, and prices from this cleaned text block.

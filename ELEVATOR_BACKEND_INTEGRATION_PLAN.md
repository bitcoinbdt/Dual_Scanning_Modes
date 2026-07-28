# Elevator Backend Integration Plan
## Connecting UI to Data Collector Engine

**Status:** Implementation Planning  
**Created:** 2026-07-28  
**Goal:** Connect the completed UI to the working data_collector engine

---

## 📊 Current Situation Analysis

### ✅ What We Have

**1. Complete UI (Phase 1 - DONE)**
- `RawTransactionTable.tsx` - Displays raw transaction data
- `pnlCalculator.ts` - Calculates P&L from raw data
- All sub-components working
- Expects data format:
  ```typescript
  {
    rawData: {
      transactions: RawTransaction[];
      holders: HolderInfo[];
      ohlcv: OHLCVCandle[];
    }
  }
  ```

**2. Working Data Collector Engine**
- Location: `d:\scanner\data_collector\`
- Language: JavaScript (ES modules)
- Structure:
  ```
  data_collector/
  ├── services/
  │   ├── birdeye.js      # Fetches OHLCV from Birdeye API
  │   └── helius.js       # Fetches transactions from Helius API
  ├── utils/
  │   ├── normalize.js    # Data normalization
  │   ├── wallet-engine.js # Balance calculation
  │   └── metrics.js      # RF17, W5 calculation
  └── collect.js          # Main orchestrator (CLI)
  ```

**3. Dependencies Already Installed**
- Main app has: `axios`, `@solana/web3.js`
- Data collector needs: `axios`, `dotenv`
- ✅ axios already in main package.json
- ❌ dotenv not in main package.json (but not needed in Next.js)

**4. API Keys**
- ✅ Located in: `data_collector/.env`
- ❌ NOT in main `.env.local`
- Need to copy to main project

### ❌ What's Missing

1. **API Route:** `app/api/scan/elevator/route.ts` doesn't exist
2. **TypeScript Port:** Data collector is JavaScript, needs TS version
3. **Environment Variables:** API keys not in main `.env.local`
4. **Service Integration:** `scannerApi.ts` still falls back to basic scan

---

## 🎯 Implementation Strategy

### Option A: Direct Import (Quick & Dirty) ❌
Import JavaScript files directly into TypeScript API route.
- **Pros:** Fast, minimal code changes
- **Cons:** Type safety issues, module resolution problems, not maintainable

### Option B: TypeScript Port (Recommended) ✅
Port data_collector to TypeScript in `lib/elevator/collectors/`
- **Pros:** Type safety, better integration, maintainable
- **Cons:** More work upfront
- **Decision:** This is the right approach

### Option C: Separate Service (Overkill) ❌
Run data_collector as separate microservice
- **Pros:** Complete isolation
- **Cons:** Deployment complexity, extra infrastructure
- **Decision:** Not needed for now

**CHOSEN: Option B - TypeScript Port**

---

## 📋 Detailed Implementation Plan

### Phase 1: Environment Setup (15 minutes)

#### Task 1.1: Copy API Keys
```bash
# Copy from data_collector/.env to main .env.local
```

**Add to `.env.local`:**
```bash
# Birdeye API (for Elevator Scan OHLCV data)
BIRDEYE_API_KEY=cd1a205cea234cf4ae8dcbf58b15088c

# Helius API (for Elevator Scan transaction data)
HELIUS_API_KEY=e203a6a1-045d-4662-bc9a-1569ed5b6f61
```

#### Task 1.2: Verify Dependencies
Check if axios is available (it is ✅)

---

### Phase 2: Port Data Collector to TypeScript (2-3 hours)

#### Task 2.1: Create Directory Structure
```
lib/
  elevator/
    collectors/
      types.ts              # TypeScript interfaces
      birdeye.ts           # Port of services/birdeye.js
      helius.ts            # Port of services/helius.js
      normalize.ts         # Port of utils/normalize.js
      walletEngine.ts      # Port of utils/wallet-engine.js
      metrics.ts           # Port of utils/metrics.js
      dataCollector.ts     # Port of collect.js (main orchestrator)
      config.ts            # Credit tier configuration
```

#### Task 2.2: Port Each File

**File 1: `lib/elevator/collectors/types.ts`**
```typescript
// Define all interfaces matching data_collector output
export interface OHLCVCandle {
  timestamp: number;
  open: number;
  close: number;
  volume: number;
}

export interface TokenTransfer {
  from: string;
  to: string;
  amount: number;
  type: 'token';
  mint: string;
}

export interface NormalizedTransaction {
  timestamp: number;
  wallets: string[];
  transfers: TokenTransfer[];
}

export interface WalletBalance {
  total_in: number;
  total_out: number;
  tx_count: number;
}

export interface HolderInfo {
  wallet: string;
  balance: number;
  tx_count: number;
}

export interface WalletMetrics {
  total_wallets: number;
  total_holders: number;
  top_10_wallets: HolderInfo[];
}

export interface CalculatedMetrics {
  RF17: boolean;
  W5: number | null;
}

export interface CollectorResult {
  ohlcv: OHLCVCandle[];
  transactions: NormalizedTransaction[];
  wallets: Record<string, WalletBalance>;
  holders: HolderInfo[];
  wallet_metrics: WalletMetrics;
  metrics: CalculatedMetrics;
}
```

**File 2: `lib/elevator/collectors/birdeye.ts`**
```typescript
// Port of services/birdeye.js
import axios from 'axios';
import { OHLCVCandle } from './types';

export async function fetchOHLCV(
  address: string,
  apiKey: string
): Promise<OHLCVCandle[]> {
  const url = 'https://public-api.birdeye.so/defi/ohlcv';
  
  const response = await axios.get(url, {
    headers: {
      'X-API-KEY': apiKey,
      'x-chain': 'solana'
    },
    params: {
      address: address,
      type: '15m',
      time_from: Math.floor(Date.now() / 1000) - 86400,
      time_to: Math.floor(Date.now() / 1000)
    }
  });
  
  if (!response.data?.data?.items) {
    throw new Error('Invalid OHLCV response from Birdeye');
  }
  
  const items = response.data.data.items;
  
  if (items.length === 0) {
    throw new Error('No OHLCV data returned');
  }
  
  // Normalize data
  return items.map((item: any) => ({
    timestamp: item.unixTime || item.timestamp,
    open: item.o || item.open,
    close: item.c || item.close,
    volume: item.v || item.volume
  }));
}
```

**File 3: `lib/elevator/collectors/helius.ts`**
```typescript
// Port of services/helius.js
import axios from 'axios';
import { NormalizedTransaction, TokenTransfer } from './types';

const DELAY_MS = 300;
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  params: Record<string, any>,
  retries = 0
): Promise<any> {
  try {
    return await axios.get(url, { params });
  } catch (error: any) {
    if (retries < MAX_RETRIES) {
      console.log(`Retry ${retries + 1}/${MAX_RETRIES} after error: ${error.message}`);
      await sleep(DELAY_MS * 2);
      return fetchWithRetry(url, params, retries + 1);
    }
    throw error;
  }
}

function normalizeTransaction(tx: any, targetMint: string): NormalizedTransaction | null {
  if (!tx.timestamp) return null;
  
  const wallets = new Set<string>();
  const transfers: TokenTransfer[] = [];
  
  if (tx.feePayer) wallets.add(tx.feePayer);
  
  if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
    tx.tokenTransfers.forEach((transfer: any) => {
      if (targetMint && transfer.mint !== targetMint) return;
      
      if (transfer.fromUserAccount) {
        wallets.add(transfer.fromUserAccount);
        transfers.push({
          from: transfer.fromUserAccount,
          to: transfer.toUserAccount,
          amount: transfer.tokenAmount,
          type: 'token',
          mint: transfer.mint
        });
      }
      if (transfer.toUserAccount) {
        wallets.add(transfer.toUserAccount);
      }
    });
  }
  
  if (transfers.length === 0) return null;
  
  return {
    timestamp: tx.timestamp,
    wallets: Array.from(wallets),
    transfers
  };
}

export async function fetchTransactions(
  address: string,
  apiKey: string,
  targetMint: string,
  maxTransactions: number = 5000
): Promise<NormalizedTransaction[]> {
  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions`;
  const allTransactions: NormalizedTransaction[] = [];
  let before: string | null = null;
  let hasMore = true;
  
  console.log(`[Helius] Fetching transactions for ${address}...`);
  console.log(`[Helius] Target mint: ${targetMint}`);
  console.log(`[Helius] Max transactions: ${maxTransactions}`);
  
  while (hasMore && allTransactions.length < maxTransactions) {
    const params: Record<string, any> = {
      'api-key': apiKey,
      limit: 100
    };
    
    if (before) params.before = before;
    
    console.log(`[Helius] Fetching batch (total: ${allTransactions.length})...`);
    
    const response = await fetchWithRetry(url, params);
    
    if (!response.data) {
      throw new Error('Invalid transaction response from Helius');
    }
    
    const transactions = Array.isArray(response.data) ? response.data : [];
    
    if (transactions.length === 0) {
      console.log('[Helius] No more transactions available');
      break;
    }
    
    const normalized = transactions
      .map(tx => normalizeTransaction(tx, targetMint))
      .filter((tx): tx is NormalizedTransaction => tx !== null);
    
    allTransactions.push(...normalized);
    
    before = transactions[transactions.length - 1].signature;
    
    if (transactions.length < 100) hasMore = false;
    
    await sleep(DELAY_MS);
  }
  
  console.log(`[Helius] Total transactions: ${allTransactions.length}`);
  
  return allTransactions;
}
```

**File 4: `lib/elevator/collectors/walletEngine.ts`**
```typescript
// Port of utils/wallet-engine.js
import { NormalizedTransaction, WalletBalance, HolderInfo, WalletMetrics } from './types';

export function buildWalletData(transactions: NormalizedTransaction[]): {
  wallets: Record<string, WalletBalance>;
  holders: HolderInfo[];
  metrics: WalletMetrics;
} {
  const wallets: Record<string, WalletBalance> = {};
  
  transactions.forEach(tx => {
    if (!tx.wallets || !tx.transfers) return;
    
    // Track wallet activity
    tx.wallets.forEach(wallet => {
      if (!wallets[wallet]) {
        wallets[wallet] = {
          total_in: 0,
          total_out: 0,
          tx_count: 0
        };
      }
      wallets[wallet].tx_count++;
    });
    
    // Track transfers
    tx.transfers.forEach(transfer => {
      if (transfer.from && wallets[transfer.from]) {
        wallets[transfer.from].total_out += transfer.amount;
      }
      if (transfer.to && wallets[transfer.to]) {
        wallets[transfer.to].total_in += transfer.amount;
      }
    });
  });
  
  // Calculate holders (positive balance)
  const holders: HolderInfo[] = [];
  Object.keys(wallets).forEach(wallet => {
    const balance = wallets[wallet].total_in - wallets[wallet].total_out;
    if (balance > 0) {
      holders.push({
        wallet,
        balance,
        tx_count: wallets[wallet].tx_count
      });
    }
  });
  
  // Sort by balance descending
  holders.sort((a, b) => b.balance - a.balance);
  
  const metrics: WalletMetrics = {
    total_wallets: Object.keys(wallets).length,
    total_holders: holders.length,
    top_10_wallets: holders.slice(0, 10)
  };
  
  return { wallets, holders, metrics };
}
```

**File 5: `lib/elevator/collectors/metrics.ts`**
```typescript
// Port of utils/metrics.js
import { OHLCVCandle, WalletMetrics, CalculatedMetrics } from './types';

export function calculateMetrics(
  ohlcv: OHLCVCandle[],
  walletMetrics: WalletMetrics
): CalculatedMetrics {
  if (ohlcv.length === 0) {
    return {
      RF17: false,
      W5: null
    };
  }
  
  const firstOpen = ohlcv[0].open;
  const lastClose = ohlcv[ohlcv.length - 1].close;
  
  // Calculate price change percentage
  const priceChange = (lastClose - firstOpen) / firstOpen;
  
  // Calculate volume metrics
  const totalVolume = ohlcv.reduce((sum, candle) => sum + candle.volume, 0);
  const avgVolume = totalVolume / ohlcv.length;
  
  // RF17: Wash trading indicator
  // High volume but minimal price movement suggests artificial trading
  const RF17 = (totalVolume > avgVolume) && (Math.abs(priceChange) < 0.02);
  
  // W5: Total holder count
  const W5 = walletMetrics.total_holders;
  
  return { RF17, W5 };
}
```

**File 6: `lib/elevator/collectors/dataCollector.ts`**
```typescript
// Port of collect.js (main orchestrator)
import { fetchOHLCV } from './birdeye';
import { fetchTransactions } from './helius';
import { buildWalletData } from './walletEngine';
import { calculateMetrics } from './metrics';
import { CollectorResult } from './types';

export class DataCollector {
  private birdeyeApiKey: string;
  private heliusApiKey: string;
  
  constructor(birdeyeApiKey: string, heliusApiKey: string) {
    this.birdeyeApiKey = birdeyeApiKey;
    this.heliusApiKey = heliusApiKey;
  }
  
  async collect(
    tokenAddress: string,
    maxTransactions: number = 1000,
    onProgress?: (step: string, progress: number) => void
  ): Promise<CollectorResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[COLLECTOR] Starting collection for ${tokenAddress}`);
    console.log(`[COLLECTOR] Max transactions: ${maxTransactions}`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      // Step 1: Fetch OHLCV data
      if (onProgress) onProgress('Fetching OHLCV data...', 10);
      console.log('[STEP 1/4] Fetching OHLCV from Birdeye...');
      const ohlcv = await fetchOHLCV(tokenAddress, this.birdeyeApiKey);
      console.log(`✅ Fetched ${ohlcv.length} OHLCV candles`);
      
      // Step 2: Fetch transactions
      if (onProgress) onProgress('Fetching transactions...', 30);
      console.log('[STEP 2/4] Fetching transactions from Helius...');
      const transactions = await fetchTransactions(
        tokenAddress,
        this.heliusApiKey,
        tokenAddress, // Use token address as mint
        maxTransactions
      );
      console.log(`✅ Fetched ${transactions.length} transactions`);
      
      if (transactions.length === 0) {
        throw new Error('No transactions found for this token');
      }
      
      // Step 3: Build wallet data
      if (onProgress) onProgress('Building wallet data...', 70);
      console.log('[STEP 3/4] Building wallet balances...');
      const walletData = buildWalletData(transactions);
      console.log(`✅ Processed ${walletData.metrics.total_wallets} wallets, ${walletData.metrics.total_holders} holders`);
      
      // Step 4: Calculate metrics
      if (onProgress) onProgress('Calculating metrics...', 90);
      console.log('[STEP 4/4] Calculating metrics...');
      const metrics = calculateMetrics(ohlcv, walletData.metrics);
      console.log(`✅ Metrics: RF17=${metrics.RF17}, W5=${metrics.W5}`);
      
      if (onProgress) onProgress('Complete!', 100);
      
      const result: CollectorResult = {
        ohlcv,
        transactions,
        wallets: walletData.wallets,
        holders: walletData.holders,
        wallet_metrics: walletData.metrics,
        metrics
      };
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[COLLECTOR] Collection complete!`);
      console.log(`${'='.repeat(60)}\n`);
      
      return result;
    } catch (error) {
      console.error('[COLLECTOR] Error:', error);
      throw error;
    }
  }
}
```

**File 7: `lib/elevator/collectors/config.ts`**
```typescript
// Credit tier configuration
export interface CollectorConfig {
  maxTransactions: number;
  tier: 'quick_peek' | 'standard' | 'professional' | 'institutional';
}

export function getCollectorConfig(creditsSpent: number): CollectorConfig {
  if (creditsSpent <= 10) {
    return {
      maxTransactions: 50,
      tier: 'quick_peek'
    };
  } else if (creditsSpent <= 25) {
    return {
      maxTransactions: 200,
      tier: 'standard'
    };
  } else if (creditsSpent <= 50) {
    return {
      maxTransactions: 1000,
      tier: 'professional'
    };
  } else {
    return {
      maxTransactions: 5000,
      tier: 'institutional'
    };
  }
}
```

---

### Phase 3: Create API Route (30 minutes)

#### Task 3.1: Create Elevator API Route

**File: `app/api/scan/elevator/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { DataCollector } from '@/lib/elevator/collectors/dataCollector';
import { getCollectorConfig } from '@/lib/elevator/collectors/config';

export async function POST(request: NextRequest) {
  try {
    const { address, creditsSpent = 10 } = await request.json();
    
    // Validate input
    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }
    
    // Validate API keys
    const birdeyeKey = process.env.BIRDEYE_API_KEY;
    const heliusKey = process.env.HELIUS_API_KEY;
    
    if (!birdeyeKey || !heliusKey) {
      return NextResponse.json(
        { error: 'API keys not configured' },
        { status: 500 }
      );
    }
    
    // Get config based on credits
    const config = getCollectorConfig(creditsSpent);
    
    console.log(`[API] Starting elevator scan for ${address}`);
    console.log(`[API] Credits: ${creditsSpent}, Tier: ${config.tier}`);
    
    // Create collector and fetch data
    const collector = new DataCollector(birdeyeKey, heliusKey);
    const rawData = await collector.collect(
      address,
      config.maxTransactions
    );
    
    // Return data in format expected by UI
    return NextResponse.json({
      success: true,
      rawData: {
        transactions: rawData.transactions,
        holders: rawData.holders,
        ohlcv: rawData.ohlcv,
        token: {
          symbol: 'TOKEN', // TODO: Get from token metadata
          address: address
        }
      },
      metadata: {
        creditsSpent,
        tier: config.tier,
        transactionCount: rawData.transactions.length,
        holderCount: rawData.holders.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('[API] Elevator scan error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Scan failed',
        details: error.stack 
      },
      { status: 500 }
    );
  }
}

// Use Node.js runtime for API calls
export const runtime = 'nodejs';

// Set maximum execution time to 60 seconds
export const maxDuration = 60;
```

---

### Phase 4: Update Frontend Service (15 minutes)

#### Task 4.1: Update scannerApi.ts

**File: `services/scannerApi.ts`**
```typescript
/**
 * Elevator scan - NOW IMPLEMENTED
 */
export async function startElevatorScan(
  address: string, 
  creditsSpent: number = 10
): Promise<{ jobId: string, status: string, rawData?: any }> {
  try {
    const res = await fetch('/api/scan/elevator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, creditsSpent })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Elevator scan failed');
    }
    
    return {
      jobId: 'immediate',
      status: 'completed',
      rawData: data.rawData
    };
  } catch (error: any) {
    console.error('[Scanner API] Elevator scan error:', error);
    throw error;
  }
}
```

#### Task 4.2: Update page.tsx to pass credits

**File: `app/page.tsx`**
```typescript
// Add state for credit amount
const [elevatorCredits, setElevatorCredits] = useState(10);

// Update handleScan for ELEVATOR
if (type === 'ELEVATOR') {
  const res = await startElevatorScan(addr, elevatorCredits);
  setElevatorData(res);
  setIsElevatorMode(true);
  setLoading(false);
}
```

---

## 🧪 Testing Plan

### Phase 5: Testing (1 hour)

#### Test 1: Environment Variables
```bash
# Verify API keys are set
echo $BIRDEYE_API_KEY
echo $HELIUS_API_KEY
```

#### Test 2: API Route
```bash
# Test elevator API endpoint
curl -X POST http://localhost:5176/api/scan/elevator \
  -H "Content-Type: application/json" \
  -d '{"address":"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263","creditsSpent":10}'
```

#### Test 3: End-to-End
1. Start dev server: `npm run dev`
2. Login to app
3. Enter Solana token address: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`
4. Select "Elevator Deep Scan"
5. Verify data loads in table
6. Check P&L calculations
7. Test sorting and filtering
8. Test pagination

#### Test 4: Error Handling
- Invalid token address
- API key missing
- Network timeout
- No transactions found

---

## 📊 Data Flow Diagram

```
User clicks "Elevator Deep Scan"
         ↓
app/page.tsx → startElevatorScan(address, 10)
         ↓
services/scannerApi.ts → POST /api/scan/elevator
         ↓
app/api/scan/elevator/route.ts
  ├─ Validates input
  ├─ Gets API keys from env
  ├─ Determines config (10 credits = 50 txs)
  └─ Creates DataCollector
         ↓
lib/elevator/collectors/dataCollector.ts
  ├─ [Step 1] fetchOHLCV(address) → Birdeye API
  ├─ [Step 2] fetchTransactions(address, 50) → Helius API
  ├─ [Step 3] buildWalletData(transactions)
  └─ [Step 4] calculateMetrics(ohlcv, wallets)
         ↓
Returns CollectorResult
         ↓
API wraps as: { rawData: { transactions, holders, ohlcv } }
         ↓
services/scannerApi.ts returns to page.tsx
         ↓
page.tsx passes to RawTransactionTable
         ↓
RawTransactionTable displays data
  ├─ Fetches current price from DexScreener
  ├─ Calculates P&L for all wallets
  ├─ Renders table with sorting/filtering
  └─ Shows P&L indicators
```

---

## ✅ Implementation Checklist

### Phase 1: Environment Setup
- [ ] Copy BIRDEYE_API_KEY to .env.local
- [ ] Copy HELIUS_API_KEY to .env.local
- [ ] Verify axios is installed (it is ✅)

### Phase 2: Port Data Collector (7 files)
- [ ] Create `lib/elevator/collectors/` directory
- [ ] Create `types.ts` - All interfaces
- [ ] Create `birdeye.ts` - OHLCV fetching
- [ ] Create `helius.ts` - Transaction fetching
- [ ] Create `walletEngine.ts` - Balance calculation
- [ ] Create `metrics.ts` - RF17, W5 calculation
- [ ] Create `dataCollector.ts` - Main orchestrator
- [ ] Create `config.ts` - Credit tier mapping

### Phase 3: API Route
- [ ] Create `app/api/scan/elevator/route.ts`
- [ ] Implement POST handler
- [ ] Add input validation
- [ ] Add error handling

### Phase 4: Frontend Updates
- [ ] Update `services/scannerApi.ts` startElevatorScan()
- [ ] Update `app/page.tsx` to pass creditsSpent
- [ ] Test integration

### Phase 5: Testing
- [ ] Test API route directly
- [ ] Test end-to-end flow
- [ ] Verify P&L calculations
- [ ] Test error scenarios

---

## 📦 Summary

**Files to Create:** 8
1. types.ts
2. birdeye.ts
3. helius.ts
4. walletEngine.ts
5. metrics.ts
6. dataCollector.ts
7. config.ts
8. route.ts (API)

**Files to Modify:** 2
1. services/scannerApi.ts
2. app/page.tsx (optional - credit slider)

**Environment Variables:** 2
1. BIRDEYE_API_KEY
2. HELIUS_API_KEY

**Time Estimate:** 3-4 hours total

---

## 🚀 Next Steps

1. **Review this plan** - Confirm approach
2. **Start Phase 1** - Add environment variables
3. **Execute Phase 2** - Port data collector files
4. **Create Phase 3** - Build API route
5. **Test Phase 5** - Verify everything works

**Ready to begin implementation!**

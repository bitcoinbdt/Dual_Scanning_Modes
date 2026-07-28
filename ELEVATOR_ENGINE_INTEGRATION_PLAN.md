# Elevator Engine Integration Plan
## Integrating External Blockchain Data Collection Engine

**Status:** Integration Phase  
**Created:** 2026-07-28  
**Engine Location:** `d:\scanner\data_collector`

---

## 🎯 Overview

Integrating an existing **working Node.js engine** that collects raw blockchain data using **Birdeye API** (OHLCV/market data) and **Helius API** (Solana transactions) into the Elevator Scan system. This engine will serve as the **data collection layer** that feeds into the analysis pipeline.

### Current Engine Capabilities

✅ **Birdeye Integration**
- OHLCV data collection (15-minute intervals, 24-hour window)
- Price data (open, close)
- Volume data
- Solana chain support

✅ **Helius Integration**  
- Transaction history fetching (up to 5,000 transactions)
- Pagination with cursor-based "before" parameter
- Token transfer filtering by mint address
- Retry logic with exponential backoff

✅ **Wallet Analysis**
- Balance calculation (total_in - total_out)
- Holder identification (balance > 0)
- Transaction count per wallet
- Top holder ranking

✅ **Metrics Calculation**
- RF17: Wash trading detection (volume vs price movement)
- W5: Total holder count
- Whale classification (accumulation, trading, market maker)

---

## 🏗️ Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ELEVATOR SCAN SYSTEM                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Next.js)                                          │
│    ├─ Credit Selection UI                                    │
│    ├─ Progress Tracking                                      │
│    └─ Results Display                                        │
│                                                               │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  API Layer (/api/scan/elevator/*)                            │
│    ├─ POST /start  → Initiates scan                          │
│    ├─ GET /status  → Progress updates                        │
│    └─ GET /result  → Final results                           │
│                                                               │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  Orchestrator (lib/elevator/engine.ts)                       │
│    ├─ Job management                                         │
│    ├─ Credit tier handling                                   │
│    └─ Step coordination                                      │
│                                                               │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  🆕 DATA COLLECTION LAYER (Existing Engine - TypeScript Port)│
│    ├─ Birdeye: OHLCV + Market Data (15min intervals)        │
│    ├─ Helius: Transaction History (up to 5k txs)            │
│    ├─ Wallet Engine: Balance Calculation                     │
│    ├─ Metrics: RF17 (wash trading) + W5 (holder count)      │
│    └─ Output: Structured JSON with wallets, holders, txs    │
│                                                               │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  Analysis Pipeline (lib/elevator/steps/*)                    │
│    ├─ Transaction Analyzer   ← Uses transactions[]           │
│    ├─ Trader Profiler       ← Uses holders[], wallets{}     │
│    ├─ Wash Trading Detector ← Uses RF17 + volume data       │
│    ├─ Threat Analyzer       ← Uses top_10_wallets + txs     │
│    └─ Risk Scorer           ← Uses all metrics              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Engine Output Structure (Actual Format)

```json
{
  "ohlcv": [
    {
      "timestamp": 1777273200,
      "open": 0.0000062113542338679875,
      "close": 0.000006196936568473519,
      "volume": 2618365795.878298
    }
  ],
  "transactions": [
    {
      "timestamp": 1777359251,
      "wallets": ["wallet1", "wallet2"],
      "transfers": [
        {
          "from": "wallet1",
          "to": "wallet2",
          "amount": 13585.70044,
          "type": "token",
          "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
        }
      ]
    }
  ],
  "wallets": {
    "wallet_address": {
      "total_in": 1000000,
      "total_out": 200000,
      "tx_count": 5
    }
  },
  "holders": [
    {
      "wallet": "4TYF8iW8bXET9C8aFgJoiUHhNtpBg5bqRsxSptCExvz7",
      "balance": 17944937828.35,
      "tx_count": 1
    }
  ],
  "wallet_metrics": {
    "total_wallets": 1294,
    "total_holders": 394,
    "top_10_wallets": [
      {
        "wallet": "address...",
        "balance": 30537436,
        "tx_count": 1
      }
    ]
  },
  "metrics": {
    "RF17": false,
    "W5": 394
  }
}

---

## 📦 Engine Integration Structure

### Directory Structure (TypeScript Port)

```
lib/
  elevator/
    engine.ts                    # Main orchestrator
    tiers.ts                     # Credit tier configs
    
    collectors/                  # 🆕 DATA COLLECTION (Port from data_collector/)
      dataCollector.ts          # Main collector orchestrator
      birdeye.ts                # Birdeye API (port of services/birdeye.js)
      helius.ts                 # Helius API (port of services/helius.js)
      walletEngine.ts           # Wallet balance calc (port of utils/wallet-engine.js)
      metrics.ts                # RF17, W5 calc (port of utils/metrics.js)
      normalize.ts              # Data normalization (port of utils/normalize.js)
      types.ts                  # TypeScript interfaces for all data structures
      config.ts                 # API keys, rate limits, tier mappings
    
    steps/                       # ANALYSIS PIPELINE (New - uses collected data)
      txAnalyzer.ts             # Analyzes transactions[] for patterns
      traderProfiler.ts         # Classifies holders[] as whales/bots/etc
      washTrading.ts            # Enhances RF17 detection
      threatDetector.ts         # Insider threat from top_10_wallets
      momentumAnalyzer.ts       # Time-series from ohlcv[]
      riskScoring.ts            # Final risk assessment
    
    queue/
      jobManager.ts             # Job queue
      worker.ts                 # Background processor
```

---

## 🔌 Integration Implementation

### 1. TypeScript Type Definitions (`lib/elevator/collectors/types.ts`)

```typescript
/**
 * Core data structures from the existing engine
 * Ported from JavaScript to TypeScript with proper typing
 */

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
  RF17: boolean;  // Wash trading indicator
  W5: number | null;  // Total holder count
}

export interface CollectorResult {
  ohlcv: OHLCVCandle[];
  transactions: NormalizedTransaction[];
  wallets: Record<string, WalletBalance>;
  holders: HolderInfo[];
  wallet_metrics: WalletMetrics;
  metrics: CalculatedMetrics;
}

export interface CollectorConfig {
  maxTransactions: number;
  maxHolders: number;
  historicalDepth: number; // in hours
  tier: 'quick_peek' | 'standard' | 'professional' | 'institutional';
}
```

### 2. Birdeye Service (`lib/elevator/collectors/birdeye.ts`)

```typescript
/**
 * Birdeye API Integration (TypeScript port)
 * Port of: data_collector/services/birdeye.js
 */

import axios from 'axios';
import { OHLCVCandle } from './types';

interface BirdeyeOHLCVResponse {
  data: {
    items: Array<{
      unixTime: number;
      o: number;
      c: number;
      v: number;
    }>;
  };
}

export class BirdeyeService {
  private apiKey: string;
  private baseUrl = 'https://public-api.birdeye.so';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchOHLCV(
    address: string,
    timeFrom?: number,
    timeTo?: number
  ): Promise<OHLCVCandle[]> {
    const url = `${this.baseUrl}/defi/ohlcv`;
    
    const response = await axios.get<BirdeyeOHLCVResponse>(url, {
      headers: {
        'X-API-KEY': this.apiKey,
        'x-chain': 'solana'
      },
      params: {
        address: address,
        type: '15m',
        time_from: timeFrom || Math.floor(Date.now() / 1000) - 86400,
        time_to: timeTo || Math.floor(Date.now() / 1000)
      }
    });

    if (!response.data?.data?.items) {
      throw new Error('Invalid OHLCV response from Birdeye');
    }

    const items = response.data.data.items;

    if (items.length === 0) {
      throw new Error('No OHLCV data returned from Birdeye');
    }

    // Normalize to standard format
    return items.map(item => ({
      timestamp: item.unixTime,
      open: item.o,
      close: item.c,
      volume: item.v
    }));
  }
}
```

### 3. Helius Service (`lib/elevator/collectors/helius.ts`)

```typescript
/**
 * Helius API Integration (TypeScript port)
 * Port of: data_collector/services/helius.js
 */

import axios from 'axios';
import { NormalizedTransaction, TokenTransfer } from './types';

const DELAY_MS = 300;
const MAX_RETRIES = 3;

interface HeliusTransaction {
  timestamp: number;
  signature: string;
  feePayer?: string;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
}

export class HeliusService {
  private apiKey: string;
  private baseUrl = 'https://api.helius.xyz/v0';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithRetry(
    url: string,
    params: Record<string, any>,
    retries = 0
  ): Promise<any> {
    try {
      const response = await axios.get(url, { params });
      return response;
    } catch (error: any) {
      if (retries < MAX_RETRIES) {
        console.log(`Retry ${retries + 1}/${MAX_RETRIES} after error: ${error.message}`);
        await this.sleep(DELAY_MS * 2);
        return this.fetchWithRetry(url, params, retries + 1);
      }
      throw error;
    }
  }

  private normalizeTransaction(
    tx: HeliusTransaction,
    targetMint: string
  ): NormalizedTransaction | null {
    if (!tx.timestamp) {
      return null;
    }

    const wallets = new Set<string>();
    const transfers: TokenTransfer[] = [];

    if (tx.feePayer) {
      wallets.add(tx.feePayer);
    }

    if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
      tx.tokenTransfers.forEach(transfer => {
        // Filter by target mint
        if (targetMint && transfer.mint !== targetMint) {
          return;
        }

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

    if (transfers.length === 0) {
      return null;
    }

    return {
      timestamp: tx.timestamp,
      wallets: Array.from(wallets),
      transfers: transfers
    };
  }

  async fetchTransactions(
    address: string,
    targetMint: string,
    maxTransactions: number,
    onProgress?: (current: number, total: number) => void
  ): Promise<NormalizedTransaction[]> {
    const url = `${this.baseUrl}/addresses/${address}/transactions`;
    const allTransactions: NormalizedTransaction[] = [];
    let before: string | null = null;
    let hasMore = true;

    console.log(`Fetching transactions for ${address}...`);
    console.log(`Target mint filter: ${targetMint}`);
    console.log(`Max transactions: ${maxTransactions}`);

    while (hasMore && allTransactions.length < maxTransactions) {
      const params: Record<string, any> = {
        'api-key': this.apiKey,
        limit: 100
      };

      if (before) {
        params.before = before;
      }

      console.log(`Fetching batch (total so far: ${allTransactions.length})...`);

      const response = await this.fetchWithRetry(url, params);

      if (!response.data) {
        throw new Error('Invalid transaction response from Helius');
      }

      const transactions: HeliusTransaction[] = Array.isArray(response.data) 
        ? response.data 
        : [];

      if (transactions.length === 0) {
        console.log('No more transactions available');
        break;
      }

      const normalized = transactions
        .map(tx => this.normalizeTransaction(tx, targetMint))
        .filter((tx): tx is NormalizedTransaction => tx !== null);

      allTransactions.push(...normalized);

      if (onProgress) {
        onProgress(allTransactions.length, maxTransactions);
      }

      before = transactions[transactions.length - 1].signature;

      if (transactions.length < 100) {
        hasMore = false;
      }

      await this.sleep(DELAY_MS);
    }

    console.log(`Total transactions fetched: ${allTransactions.length}`);

    return allTransactions;
  }
}
```

### 4. Wallet Engine (`lib/elevator/collectors/walletEngine.ts`)

```typescript
/**
 * Wallet Balance Calculation Engine (TypeScript port)
 * Port of: data_collector/utils/wallet-engine.js
 */

import { 
  NormalizedTransaction, 
  WalletBalance, 
  HolderInfo, 
  WalletMetrics 
} from './types';

export class WalletEngine {
  buildWalletData(transactions: NormalizedTransaction[]): {
    wallets: Record<string, WalletBalance>;
    holders: HolderInfo[];
    metrics: WalletMetrics;
  } {
    const wallets: Record<string, WalletBalance> = {};

    // Build wallet balances from transactions
    transactions.forEach(tx => {
      if (!tx.wallets || !tx.transfers) {
        return;
      }

      // Track all wallet activity
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
          wallet: wallet,
          balance: balance,
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

    return {
      wallets,
      holders,
      metrics
    };
  }

  /**
   * Classify whale types based on behavior
   */
  classifyWhale(holder: HolderInfo): 'MARKET_MAKER' | 'ACCUMULATION_WHALE' | 'TRADING_WHALE' | 'REGULAR_HOLDER' {
    if (holder.tx_count >= 1000) {
      return 'MARKET_MAKER';
    } else if (holder.tx_count <= 5) {
      return 'ACCUMULATION_WHALE';
    } else if (holder.tx_count >= 15) {
      return 'TRADING_WHALE';
    }
    return 'REGULAR_HOLDER';
  }
}
```

### 5. Metrics Calculator (`lib/elevator/collectors/metrics.ts`)

```typescript
/**
 * Metrics Calculation (TypeScript port)
 * Port of: data_collector/utils/metrics.js
 */

import { OHLCVCandle, WalletMetrics, CalculatedMetrics } from './types';

export class MetricsCalculator {
  calculateMetrics(
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

    return {
      RF17,
      W5
    };
  }

  /**
   * Calculate holder concentration (what % of supply do top holders control)
   */
  calculateConcentration(
    topHolders: HolderInfo[],
    totalSupply: number
  ): {
    top1Percent: number;
    top10Percent: number;
    top50Percent: number;
  } {
    const top1Balance = topHolders[0]?.balance || 0;
    const top10Balance = topHolders.slice(0, 10).reduce((sum, h) => sum + h.balance, 0);
    const top50Balance = topHolders.slice(0, 50).reduce((sum, h) => sum + h.balance, 0);

    return {
      top1Percent: (top1Balance / totalSupply) * 100,
      top10Percent: (top10Balance / totalSupply) * 100,
      top50Percent: (top50Balance / totalSupply) * 100
    };
  }
}
```

### 6. Main Data Collector (`lib/elevator/collectors/dataCollector.ts`)

```typescript
/**
 * Main Data Collector - Orchestrates all collection services
 * Port of: data_collector/collect.js
 */

import { BirdeyeService } from './birdeye';
import { HeliusService } from './helius';
import { WalletEngine } from './walletEngine';
import { MetricsCalculator } from './metrics';
import { CollectorConfig, CollectorResult } from './types';

export class DataCollector {
  private birdeyeService: BirdeyeService;
  private heliusService: HeliusService;
  private walletEngine: WalletEngine;
  private metricsCalculator: MetricsCalculator;

  constructor(birdeyeApiKey: string, heliusApiKey: string) {
    this.birdeyeService = new BirdeyeService(birdeyeApiKey);
    this.heliusService = new HeliusService(heliusApiKey);
    this.walletEngine = new WalletEngine();
    this.metricsCalculator = new MetricsCalculator();
  }

  async collect(
    tokenAddress: string,
    config: CollectorConfig,
    onProgress?: (step: string, progress: number) => void
  ): Promise<CollectorResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[DATA COLLECTOR] Starting collection for ${tokenAddress}`);
    console.log(`[DATA COLLECTOR] Tier: ${config.tier}`);
    console.log(`[DATA COLLECTOR] Max Transactions: ${config.maxTransactions}`);
    console.log(`${'='.repeat(60)}\n`);

    // Step 1: Fetch OHLCV data
    if (onProgress) onProgress('Fetching market data (OHLCV)...', 10);
    console.log('[STEP 1/4] Fetching OHLCV data from Birdeye...');
    
    const ohlcv = await this.birdeyeService.fetchOHLCV(tokenAddress);
    console.log(`✅ Fetched ${ohlcv.length} OHLCV records`);

    // Step 2: Fetch transactions
    if (onProgress) onProgress('Fetching transaction history...', 30);
    console.log('[STEP 2/4] Fetching transactions from Helius...');
    
    const transactions = await this.heliusService.fetchTransactions(
      tokenAddress,
      tokenAddress, // Using token address as mint
      config.maxTransactions,
      (current, total) => {
        const progress = 30 + (current / total) * 40; // 30-70%
        if (onProgress) onProgress(`Fetching transactions... ${current}/${total}`, progress);
      }
    );
    console.log(`✅ Fetched ${transactions.length} transactions`);

    if (transactions.length === 0) {
      throw new Error('No transactions found for this token');
    }

    // Step 3: Build wallet data
    if (onProgress) onProgress('Analyzing wallet balances...', 75);
    console.log('[STEP 3/4] Building wallet data...');
    
    const walletData = this.walletEngine.buildWalletData(transactions);
    console.log(`✅ Extracted ${walletData.metrics.total_wallets} wallets, ${walletData.metrics.total_holders} holders`);

    // Step 4: Calculate metrics
    if (onProgress) onProgress('Calculating metrics...', 90);
    console.log('[STEP 4/4] Calculating metrics...');
    
    const metrics = this.metricsCalculator.calculateMetrics(
      ohlcv,
      walletData.metrics
    );
    console.log(`✅ Metrics calculated: RF17=${metrics.RF17}, W5=${metrics.W5}`);

    if (onProgress) onProgress('Collection complete!', 100);

    const result: CollectorResult = {
      ohlcv,
      transactions,
      wallets: walletData.wallets,
      holders: walletData.holders,
      wallet_metrics: walletData.metrics,
      metrics
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[DATA COLLECTOR] Collection complete!`);
    console.log(`[DATA COLLECTOR] Total wallets: ${result.wallet_metrics.total_wallets}`);
    console.log(`[DATA COLLECTOR] Total holders: ${result.wallet_metrics.total_holders}`);
    console.log(`[DATA COLLECTOR] Top holder balance: ${result.wallet_metrics.top_10_wallets[0]?.balance.toFixed(2) || 'N/A'}`);
    console.log(`${'='.repeat(60)}\n`);

    return result;
  }
}
```

### 7. Configuration (`lib/elevator/collectors/config.ts`)

```typescript
/**
 * Collector Configuration
 * Maps credit tiers to collection limits
 */

import { CollectorConfig } from './types';

export const COLLECTOR_CONFIG = {
  apiKeys: {
    birdeye: process.env.BIRDEYE_API_KEY || '',
    helius: process.env.HELIUS_API_KEY || ''
  },
  
  rateLimits: {
    birdeye: {
      requestsPerSecond: 10,
      requestsPerMinute: 300
    },
    helius: {
      requestsPerSecond: 3,
      delayBetweenRequests: 300 // ms
    }
  }
};

/**
 * Map credit amount to collector configuration
 */
export function getCollectorConfig(creditsSpent: number): CollectorConfig {
  if (creditsSpent <= 10) {
    return {
      maxTransactions: 50,
      maxHolders: 10,
      historicalDepth: 6, // hours
      tier: 'quick_peek'
    };
  } else if (creditsSpent <= 25) {
    return {
      maxTransactions: 200,
      maxHolders: 50,
      historicalDepth: 24,
      tier: 'standard'
    };
  } else if (creditsSpent <= 50) {
    return {
      maxTransactions: 1000,
      maxHolders: 100,
      historicalDepth: 168, // 7 days
      tier: 'professional'
    };
  } else {
    return {
      maxTransactions: 5000,
      maxHolders: 500,
      historicalDepth: 720, // 30 days
      tier: 'institutional'
    };
  }
}

export function validateCollectorConfig() {
  if (!COLLECTOR_CONFIG.apiKeys.birdeye) {
    throw new Error('BIRDEYE_API_KEY environment variable is required');
  }
  if (!COLLECTOR_CONFIG.apiKeys.helius) {
    throw new Error('HELIUS_API_KEY environment variable is required');
  }
}
```

---

## 🔄 Integration Flow (Complete)

### Step-by-Step Execution

```
1. User initiates Elevator Scan
   - Selects 25 credits
   - Token: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 (Solana)
   ↓
2. POST /api/scan/elevator/start
   - Creates job in database
   - Deducts 25 credits
   - Returns jobId
   ↓
3. Job Queue picks up the job
   ↓
4. Main Orchestrator determines config
   - 25 credits = "Professional" tier
   - maxTransactions: 1000
   - maxHolders: 100
   - historicalDepth: 168 hours
   ↓
5. 🆕 DATA COLLECTION PHASE
   |
   ├─→ [10%] Birdeye.fetchOHLCV()
   |    Result: 96 candles (15-min intervals, 24h window)
   |    Data: timestamp, open, close, volume
   |
   ├─→ [30-70%] Helius.fetchTransactions()
   |    Pagination: 10 batches × 100 txs
   |    Result: 1000 transactions
   |    Filter: Only token transfers matching mint address
   |    Data: timestamp, wallets[], transfers[]
   |
   ├─→ [75%] WalletEngine.buildWalletData()
   |    Process: Calculate balances (total_in - total_out)
   |    Result: 1294 wallets, 394 holders
   |    Data: wallets{}, holders[], top_10_wallets
   |
   └─→ [90%] MetricsCalculator.calculateMetrics()
        Process: Analyze OHLCV + wallet data
        Result: RF17=false, W5=394
   ↓
6. ANALYSIS PHASE (Uses collected data)
   |
   ├─→ TransactionAnalyzer
   |    Input: transactions[] (1000 items)
   |    Output: Buy/sell volumes, net flow, patterns
   |
   ├─→ TraderProfiler
   |    Input: holders[], top_10_wallets
   |    Output: Whale classification (accumulation/trading/market_maker)
   |
   ├─→ WashTradingDetector
   |    Input: RF17, ohlcv[], transactions[]
   |    Output: Artificial volume percentage
   |
   ├─→ ThreatDetector
   |    Input: top_10_wallets, transactions[]
   |    Output: Insider threat score, sniper detection
   |
   └─→ RiskScorer
        Input: All analysis results
        Output: Final risk score (0-100)
   ↓
7. Results compiled into ElevatorScanResult
   ↓
8. Stored in database with job status = 'completed'
   ↓
9. Frontend polls GET /api/scan/elevator/status/:jobId
   - Returns 100% progress
   ↓
10. Frontend fetches GET /api/scan/elevator/result/:jobId
   - Displays ElevatorResultCard with all data
```
## 🔑 Environment Variables

Add to `.env.local`:

```bash
# Birdeye API (OHLCV and market data)
BIRDEYE_API_KEY=your_birdeye_api_key_here

# Helius API (Solana transaction history)
HELIUS_API_KEY=your_helius_api_key_here

# Optional: Rate limiting overrides
BIRDEYE_RATE_LIMIT_PER_SECOND=10
HELIUS_REQUEST_DELAY_MS=300
```

---

## 📝 Implementation Checklist

### Phase 1: Port Engine to TypeScript ✅
- [x] Create `lib/elevator/collectors/` directory structure
- [ ] Port `types.ts` with all interfaces
- [ ] Port `birdeye.ts` from `services/birdeye.js`
- [ ] Port `helius.ts` from `services/helius.js`
- [ ] Port `walletEngine.ts` from `utils/wallet-engine.js`
- [ ] Port `metrics.ts` from `utils/metrics.js`
- [ ] Create `dataCollector.ts` main orchestrator
- [ ] Create `config.ts` with tier mappings
- [ ] Add API keys to `.env.local`

### Phase 2: Test Data Collection
- [ ] Create test script to run collector independently
- [ ] Test with real Solana token address
- [ ] Verify OHLCV data fetch (should get ~96 candles)

---

## 🚨 Important Considerations

### Rate Limiting
- Birdeye has strict rate limits
- Implement request queuing
- Add exponential backoff for 429 errors
- Consider caching raw data aggressively

### Cost Management
- Each Birdeye API call has a cost (check your plan)
- Map credit tiers to API call budgets
- Don't make unnecessary calls
- Use cached data when possible

### Data Quality
- Not all tokens have complete data on Birdeye
- Handle missing fields gracefully
- Show data quality score to users
- Partial results better than complete failure

### Error Handling
- API timeouts
- Invalid token addresses
- Missing data fields
- Rate limit exceeded
- Network issues

---

## 🎯 Next Steps

1. **Share your engine code** - So I can see the exact structure
2. **Provide sample output** - Show me the JSON format
3. **Clarify Birdeye usage** - Which endpoints, what data fields
4. **API key setup** - Where is it stored, what tier/plan

Once I see your engine, I can:
- Create exact wrapper implementation
- Define proper type interfaces
- Build the integration layer
- Test with real data

---

**Ready to proceed once you share the engine details!**
- [ ] Verify transaction fetch with pagination (should get up to 1000 txs)
- [ ] Verify wallet balance calculations (holders vs total wallets)
- [ ] Verify metrics (RF17, W5)
- [ ] Test with multiple tokens to ensure consistency

### Phase 3: Integrate with Main Elevator Engine
- [ ] Create `lib/elevator/engine.ts` main orchestrator
- [ ] Wire DataCollector as first step in pipeline
- [ ] Pass CollectorResult to analysis steps
- [ ] Add job progress updates during collection
- [ ] Implement error handling and fallbacks

### Phase 4: Build Analysis Steps (Uses Collected Data)
- [ ] `txAnalyzer.ts` - Analyze transactions[] for buy/sell patterns
- [ ] `traderProfiler.ts` - Classify holders[] using tx_count heuristics
- [ ] `washTrading.ts` - Enhance RF17 detection with deeper analysis
- [ ] `threatDetector.ts` - Identify insider threats from top_10_wallets
- [ ] `momentumAnalyzer.ts` - Build heatmap from ohlcv[]
- [ ] `riskScoring.ts` - Aggregate all metrics into final score

### Phase 5: API Routes
- [ ] `POST /api/scan/elevator/start` - Create job, start collection
- [ ] `GET /api/scan/elevator/status/:jobId` - Return progress
- [ ] `GET /api/scan/elevator/result/:jobId` - Return final results
- [ ] Add proper error responses and validation

### Phase 6: Frontend Integration
- [ ] Credit slider component (5-100 credits)
- [ ] Configuration modal with tier preview
- [ ] Progress tracking during collection
- [ ] Results display using existing ElevatorResultCard
- [ ] History page for past scans

---

## 🎯 Key Integration Benefits

### From Existing Engine:
✅ **Proven data collection** - Already working with real APIs  
✅ **Accurate wallet tracking** - Tested balance calculation logic  
✅ **Smart transaction filtering** - Handles multi-token Solana txs  
✅ **Pagination logic** - Can fetch up to 5k transactions  
✅ **Rate limiting** - Built-in delays and retry logic  

### New Capabilities:
🆕 **Variable depth** - Credits control how much data collected  
🆕 **TypeScript** - Type safety and better IDE support  
🆕 **Progress tracking** - Real-time updates to frontend  
🆕 **Async processing** - Runs in background queue  
🆕 **Advanced analysis** - Deep insights from collected data  

---

## 🚨 Important Considerations

### API Rate Limits
**Birdeye:**
- Free tier: ~300 requests/min
- Monitor usage carefully
- Implement request queuing

**Helius:**
- 300ms delay between requests (already implemented)
- Max 5000 transactions per scan
- Pagination cursor-based

### Cost Management
- Birdeye calls consume API quota
- Higher credits = more API calls
- Cache raw data aggressively (24h TTL)
- Consider Birdeye paid plan for production

### Data Quality
- Not all tokens have complete data
- Helius may return fewer transactions than requested
- Birdeye OHLCV limited to 24 hours
- Handle partial results gracefully

### Performance
- Transaction fetching is slowest step (pagination)
- 1000 transactions = ~10 API calls × 300ms = ~3 seconds
- Wallet balance calculation is fast (in-memory)
- Total collection time: 5-15 seconds depending on tier

---

## 📊 Expected Data Volumes by Tier

| Tier | Credits | Transactions | Holders | OHLCV Points | Collection Time |
|------|---------|--------------|---------|--------------|-----------------|
| Quick Peek | 5-10 | 50 | 10 | 96 (24h) | ~2-3 sec |
| Standard | 11-25 | 200 | 50 | 96 (24h) | ~3-5 sec |
| Professional | 26-50 | 1,000 | 100 | 96 (24h) | ~5-10 sec |
| Institutional | 51-100+ | 5,000 | 500 | 96 (24h) | ~15-30 sec |

---

## 🧪 Testing Strategy

### 1. Unit Tests
```typescript
// Test wallet engine
describe('WalletEngine', () => {
  it('should calculate balances correctly', () => {
    const txs = mockTransactions();
    const result = engine.buildWalletData(txs);
    expect(result.holders.length).toBeGreaterThan(0);
  });
});

// Test metrics calculator
describe('MetricsCalculator', () => {
  it('should detect wash trading (RF17)', () => {
    const ohlcv = mockHighVolumeNoMovement();
    const result = calculator.calculateMetrics(ohlcv, mockWallets());
    expect(result.RF17).toBe(true);
  });
});
```

### 2. Integration Tests
```typescript
// Test full collection flow
describe('DataCollector', () => {
  it('should collect data for real token', async () => {
    const collector = new DataCollector(BIRDEYE_KEY, HELIUS_KEY);
    const config = getCollectorConfig(25); // Professional tier
    
    const result = await collector.collect(
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      config
    );
    
    expect(result.transactions.length).toBeGreaterThan(0);
    expect(result.holders.length).toBeGreaterThan(0);
    expect(result.metrics.W5).toBeDefined();
  });
});
```

### 3. Manual Testing
```bash
# Create test script: test-collector.ts
import { DataCollector } from './lib/elevator/collectors/dataCollector';
import { getCollectorConfig } from './lib/elevator/collectors/config';

const collector = new DataCollector(
  process.env.BIRDEYE_API_KEY!,
  process.env.HELIUS_API_KEY!
);

const config = getCollectorConfig(25);

collector.collect(
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  config,
  (step, progress) => console.log(`[${progress}%] ${step}`)
).then(result => {
  console.log('Collection complete!');
  console.log(`Transactions: ${result.transactions.length}`);
  console.log(`Holders: ${result.holders.length}`);
  console.log(`RF17: ${result.metrics.RF17}`);
  console.log(`W5: ${result.metrics.W5}`);
});

# Run: npx tsx test-collector.ts
```

---

## 🎯 Success Criteria

**Data Collection:**
- ✅ Successfully port all JS code to TypeScript
- ✅ Maintain same data output format
- ✅ Support variable transaction limits (50-5000)
- ✅ Progress callbacks work correctly
- ✅ Rate limiting prevents API throttling

**Integration:**
- ✅ Seamless integration with elevator orchestrator
- ✅ Credit tiers map to collection configs
- ✅ Error handling doesn't crash jobs
- ✅ Caching reduces duplicate API calls

**Performance:**
- ✅ Professional tier (1000 txs) completes in <10 seconds
- ✅ Institutional tier (5000 txs) completes in <30 seconds
- ✅ No memory leaks with large datasets
- ✅ Concurrent scans don't interfere

---

## 🔜 Next Steps

1. **Review this plan** - Confirm the TypeScript port approach
2. **Start Phase 1** - Begin porting the engine files
3. **Test independently** - Verify data collection works standalone
4. **Build orchestrator** - Wire into main elevator system
5. **Create analysis steps** - Build insights from collected data

---

**Ready to start Phase 1 implementation!**

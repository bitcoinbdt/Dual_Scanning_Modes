# Elevator Scan - Goal V1
## Raw Transaction Data Display with Visual Profit/Loss

**Status:** Goal Definition  
**Version:** 1.0  
**Created:** 2026-07-28  
**Priority:** MVP Implementation

---

## 🎯 Core Objective

**Display all raw transaction data in a comprehensive table, with an additional visual feature showing real-time profit/loss for each wallet.**

When a user scans a token contract address with Elevator Scan, we will:
1. Collect raw transaction data from blockchain (using existing engine)
2. Display ALL raw data in a table (wallet, timestamp, amount, type, etc.)
3. As an EXTRA FEATURE: Show visual profit/loss indicator next to each wallet
4. Fetch current token price from DexScreener API (for P&L calculation only)
5. Calculate and display profit/loss visually in real-time in the browser

---

## 📊 How It Works

### Data Flow

```
User enters token address (e.g., Solana token)
         ↓
Elevator Scan initiated (costs credits)
         ↓
Data Collector Engine runs:
  ├─ Helius API: Fetch transactions (50-5000 depending on credits)
  ├─ Birdeye API: Fetch OHLCV data (for price context)
  └─ Process: Build wallet balances from transactions
         ↓
Return raw data to frontend:
  - Every transaction with full details
  - Wallet addresses, timestamps, amounts
  - Transfer directions (buy/sell)
  - Current holder balances
  - OHLCV price history
         ↓
Frontend displays RAW DATA in table:
  📊 PRIMARY: Show ALL transaction data as-is
  - Transaction hash/signature
  - Timestamp
  - Wallet address (from/to)
  - Amount transferred
  - Type (buy/sell/transfer)
  - Raw blockchain data
         ↓
Frontend adds EXTRA FEATURE (visual P&L):
  💰 SECONDARY: Calculate and show profit/loss
  - Fetch current price from DexScreener
  - Calculate P&L for each wallet in browser
  - Display visual indicator (🟢 profit / 🔴 loss)
  - Show real-time profit/loss amount next to wallet
         ↓
User sees complete picture:
  - Full raw transaction history (main data)
  - Plus: Real-time profit/loss status (bonus feature)
```

---

## 📐 Data Structure

### From Data Collector (Backend) - Raw Data

```typescript
// Raw data returned to frontend - NO PROCESSING
interface ElevatorScanRawData {
  // Token basic info
  token: {
    address: string;
    name: string;
    symbol: string;
  };
  
  // RAW TRANSACTIONS - This is the main data
  transactions: Array<{
    timestamp: number;           // Unix timestamp
    signature?: string;          // Transaction hash (if available)
    wallets: string[];           // All wallet addresses involved
    transfers: Array<{
      from: string;              // Sender wallet
      to: string;                // Receiver wallet  
      amount: number;            // Token amount transferred
      type: 'token';
      mint: string;              // Token mint address
    }>;
  }>;
  
  // Current holder balances (calculated from transactions)
  holders: Array<{
    wallet: string;              // Wallet address
    balance: number;             // Current token balance
    tx_count: number;            // Number of transactions
  }>;
  
  // OHLCV data (for EXTRA FEATURE - price estimation)
  ohlcv: Array<{
    timestamp: number;
    open: number;                // Price in USD
    close: number;               // Price in USD
    volume: number;
  }>;
  
  // Metadata
  wallet_metrics: {
    total_wallets: number;
    total_holders: number;
    top_10_wallets: Array<{
      wallet: string;
      balance: number;
      tx_count: number;
    }>;
  };
  
  metrics: {
    RF17: boolean;               // Wash trading indicator
    W5: number;                  // Total holder count
  };
}
```

### EXTRA FEATURE: Calculated in Browser (Frontend)

```typescript
// This is ADDITIONAL - calculated client-side for visual enhancement
interface WalletProfitLoss {
  wallet: string;
  
  // Quick P&L summary (shown as visual indicator)
  totalPnL: number;              // Total profit/loss in USD
  pnlPercentage: number;         // Percentage
  status: 'profit' | 'loss' | 'breakeven';
  
  // Detailed breakdown (optional, for tooltip/expand)
  tokensBought?: number;
  tokensSold?: number;
  currentHoldings?: number;
  currentValue?: number;
}
```

---

## 🧮 Calculation Logic

### Step 1: Extract Wallet Activity

```typescript
// For each wallet, extract all their buy/sell transactions
function extractWalletActivity(wallet: string, transactions: Transaction[]): {
  buys: Array<{ amount: number; timestamp: number }>;
  sells: Array<{ amount: number; timestamp: number }>;
} {
  const buys = [];
  const sells = [];
  
  transactions.forEach(tx => {
    tx.transfers.forEach(transfer => {
      if (transfer.to === wallet) {
        buys.push({ amount: transfer.amount, timestamp: tx.timestamp });
      }
      if (transfer.from === wallet) {
        sells.push({ amount: transfer.amount, timestamp: tx.timestamp });
      }
    });
  });
  
  return { buys, sells };
}
```

### Step 2: Estimate Average Buy Price

```typescript
// Use OHLCV data to estimate price at time of purchase
function estimateAvgBuyPrice(
  buys: Array<{ amount: number; timestamp: number }>,
  ohlcv: OHLCVCandle[]
): number {
  let totalValue = 0;
  let totalTokens = 0;
  
  buys.forEach(buy => {
    // Find closest OHLCV candle to transaction timestamp
    const closestCandle = findClosestCandle(buy.timestamp, ohlcv);
    const priceAtTime = closestCandle ? closestCandle.close : 0;
    
    totalValue += buy.amount * priceAtTime;
    totalTokens += buy.amount;
  });
  
  return totalTokens > 0 ? totalValue / totalTokens : 0;
}
```

### Step 3: Calculate Profit/Loss

```typescript
function calculateProfitLoss(
  wallet: string,
  transactions: Transaction[],
  holders: HolderInfo[],
  ohlcv: OHLCVCandle[],
  currentPrice: number
): WalletProfitLoss {
  
  // Extract buy/sell activity
  const { buys, sells } = extractWalletActivity(wallet, transactions);
  
  // Calculate totals
  const tokensBought = buys.reduce((sum, b) => sum + b.amount, 0);
  const tokensSold = sells.reduce((sum, s) => sum + s.amount, 0);
  
  // Get current holdings
  const holder = holders.find(h => h.wallet === wallet);
  const currentHoldings = holder ? holder.balance : 0;
  
  // Estimate average buy price
  const avgBuyPrice = estimateAvgBuyPrice(buys, ohlcv);
  
  // Calculate investment
  const totalInvested = tokensBought * avgBuyPrice;
  
  // Calculate current value
  const currentValue = currentHoldings * currentPrice;
  
  // Calculate realized P&L (from sells)
  const avgSellPrice = estimateAvgSellPrice(sells, ohlcv);
  const realizedPnL = (avgSellPrice - avgBuyPrice) * tokensSold;
  
  // Calculate unrealized P&L (from holdings)
  const unrealizedPnL = (currentPrice - avgBuyPrice) * currentHoldings;
  
  // Total P&L
  const totalPnL = realizedPnL + unrealizedPnL;
  const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  
  return {
    wallet,
    tokensBought,
    tokensSold,
    currentHoldings,
    totalTransactions: buys.length + sells.length,
    avgBuyPrice,
    currentPrice,
    totalInvested,
    currentValue,
    realizedPnL,
    unrealizedPnL,
    totalPnL,
    pnlPercentage,
    status: totalPnL > 0 ? 'profit' : totalPnL < 0 ? 'loss' : 'breakeven',
    traderType: classifyTrader(buys.length + sells.length, currentHoldings),
    firstTrade: buys[0]?.timestamp || 0,
    lastTrade: Math.max(
      buys[buys.length - 1]?.timestamp || 0,
      sells[sells.length - 1]?.timestamp || 0
    ),
    holdingDuration: calculateHoldingDuration(buys, sells)
  };
}
```

### Step 4: Fetch Current Price (DexScreener)

```typescript
// Fetch current token price from DexScreener API
async function fetchCurrentPrice(tokenAddress: string): Promise<number> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      // Get price from most liquid pair
      const mainPair = data.pairs.sort((a, b) => 
        b.liquidity.usd - a.liquidity.usd
      )[0];
      
      return parseFloat(mainPair.priceUsd) || 0;
    }
    
    return 0;
  } catch (error) {
    console.error('Failed to fetch price from DexScreener:', error);
    return 0;
  }
}
```

---

## 🎨 UI Display

### Raw Transaction Data Table (PRIMARY FEATURE)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  � RAW TRANSACTION DATA                                                       │
│  Token: BONK | Total Transactions: 1,247 | Total Wallets: 394                 │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Filters: [All Types ▼] [Sort: Time (Latest) ▼] [Search Wallet...]           │
│                                                                                 │
│  ┌──────────┬───────────────┬────────┬─────────────┬────────────┬──────────┐  │
│  │ Time     │ Wallet        │ Action │ Amount      │ Tx Hash    │ P&L      │  │
│  ├──────────┼───────────────┼────────┼─────────────┼────────────┼──────────┤  │
│  │ 2m ago   │ 4TYF8iW...z7  │ BUY    │ 17.9B BONK  │ 5xK2m...  │ 🟢 +$102K│  │
│  │          │               │        │             │            │ (+1140%) │  │
│  ├──────────┼───────────────┼────────┼─────────────┼────────────┼──────────┤  │
│  │ 5m ago   │ MfDuWeq...Wa  │ SELL   │ 700M BONK   │ 8nP4x...  │ 🟢 +$1.4K│  │
│  │          │               │        │             │            │ (+27.4%) │  │
│  ├──────────┼───────────────┼────────┼─────────────┼────────────┼──────────┤  │
│  │ 8m ago   │ 6oFWm7K...sp  │ BUY    │ 2.1B BONK   │ 9mQ7k...  │ 🟢 +$3.2K│  │
│  │          │               │        │             │            │ (+17.2%) │  │
│  ├──────────┼───────────────┼────────┼─────────────┼────────────┼──────────┤  │
│  │ 12m ago  │ 8xKhN2p...4d  │ SELL   │ 900M BONK   │ 2vX8n...  │ 🔴 -$318 │  │
│  │          │               │        │             │            │ (-15.0%) │  │
│  ├──────────┼───────────────┼────────┼─────────────┼────────────┼──────────┤  │
│  │ 18m ago  │ 3mZvT9a...pL  │ BUY    │ 420M BONK   │ 7kR5m...  │ 🔴 -$127 │  │
│  │          │               │        │             │            │ (-7.6%)  │  │
│  ├──────────┼───────────────┼────────┼─────────────┼────────────┼──────────┤  │
│  │ 25m ago  │ 9pLmK3x...2n  │ BUY    │ 1.2B BONK   │ 4jM9p...  │ ⚪ $0     │  │
│  │          │               │        │             │            │ (±0%)    │  │
│  └──────────┴───────────────┴────────┴─────────────┴────────────┴──────────┘  │
│                                                                                 │
│  💰 P&L Visual Feature (Extra):                                                │
│  • Shows real-time profit/loss next to each wallet                             │
│  • Calculated in browser using current token price                             │
│  • 🟢 Green = Profit | 🔴 Red = Loss | ⚪ Gray = Breakeven                     │
│  • Updates automatically when price changes                                    │
│                                                                                 │
│  [Export CSV] [Load More Transactions] [Refresh P&L]                           │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Table Columns (Explained)

#### PRIMARY COLUMNS (Raw Data):
1. **Time** - When the transaction occurred
2. **Wallet** - The wallet address (abbreviated)
3. **Action** - BUY (received tokens) / SELL (sent tokens)
4. **Amount** - How many tokens transferred
5. **Tx Hash** - Transaction signature/hash (abbreviated)

#### EXTRA COLUMN (Visual Feature):
6. **P&L** - Real-time profit/loss indicator
   - Calculated in browser
   - Shows total P&L for this wallet
   - Visual color coding
   - Percentage in parentheses

### Interaction Features

**Click on Wallet Address:**
- Copy to clipboard
- Show all transactions for this wallet
- Show detailed P&L breakdown (tooltip)

**Click on Tx Hash:**
- Open transaction on blockchain explorer
- Show full transaction details

**P&L Indicator:**
- Hover to see detailed breakdown:
  ```
  Wallet: 4TYF8iW...z7
  ├─ Tokens Bought: 17.9B BONK
  ├─ Tokens Sold: 0 BONK
  ├─ Current Holdings: 17.9B BONK
  ├─ Avg Buy Price: $0.0000005
  ├─ Current Price: $0.00000621
  ├─ Invested: $8,950
  ├─ Current Value: $111,159
  └─ Total P&L: +$102,209 (+1140%)
  ```

---

## � Current State & Replacement Strategy

### What Currently Exists

**Frontend (app/page.tsx):**
- Button to select "BASIC" or "ELEVATOR" scan
- `startElevatorScan()` function that currently falls back to basic scan
- `ElevatorResultCard` component already built (shows advanced analytics UI)
- Credit system: ELEVATOR scan costs 10 credits (vs 2 for BASIC)

**Backend (services/scannerApi.ts):**
```typescript
// Current implementation - PLACEHOLDER
export async function startElevatorScan(address, chain, mood) {
  // TODO: Implement deep analysis
  // For now, just do a basic scan and return immediately
  const data = await getBasicScan(address, chain);
  return {
    jobId: 'immediate',
    status: 'completed',
    data
  };
}
```

**API Routes:**
- ✅ `/api/scan/basic` - Exists (uses evmScanner/solanaScanner)
- ❌ `/api/scan/elevator` - Does NOT exist yet (needs to be created)

**UI Components:**
- ✅ `ElevatorResultCard.tsx` - Already built, expects specific data structure
- ✅ Displays: Threat intelligence, wash trading, Gini coefficient, momentum heatmap
- ✅ Shows top buyers/sellers with tags and win rates
- ✅ Advanced analytics sections

**Data Types (types/scanner.ts):**
- ✅ `ElevatorData` interface defined with:
  - `marketBehavior` (buy/sell volumes, net flow)
  - `advancedAnalytics` (insider threats, wash trading, etc.)
  - `topBuyers` and `topSellers` arrays
  - `momentumHeatmap` data

### What Needs to Be Replaced/Built

#### 1. Create New API Route
**Path:** `app/api/scan/elevator/route.ts`

Replace: Nothing (new file)
Action: Create endpoint that uses data collector engine

```typescript
// NEW FILE: app/api/scan/elevator/route.ts
export async function POST(request: NextRequest) {
  const { address, chain, creditsSpent } = await request.json();
  
  // Use data collector engine
  const collector = new DataCollector(BIRDEYE_KEY, HELIUS_KEY);
  const config = getCollectorConfig(creditsSpent);
  
  const rawData = await collector.collect(address, config);
  
  // Return raw data to frontend
  return NextResponse.json({
    success: true,
    rawData: rawData, // Full transaction data
    metadata: {
      creditsSpent,
      tier: config.tier,
      collectionTime: Date.now()
    }
  });
}
```

#### 2. Update Frontend Service
**File:** `services/scannerApi.ts`

Replace: `startElevatorScan()` function
Action: Call new elevator API endpoint

```typescript
// REPLACE THIS FUNCTION
export async function startElevatorScan(
  address: string,
  chain: string,
  creditsSpent: number  // NEW PARAMETER
) {
  const res = await fetch('/api/scan/elevator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chain, creditsSpent })
  });
  
  const data = await res.json();
  return {
    jobId: 'immediate',
    status: 'completed',
    rawData: data.rawData  // Raw transaction data
  };
}
```

#### 3. Create New Component for Raw Data
**File:** `components/elevator/RawTransactionTable.tsx` (NEW)

Replace: Nothing (new component)
Action: Display raw transaction data in table

This will be the PRIMARY feature showing all raw transactions.

#### 4. Update Page to Handle Credits
**File:** `app/page.tsx`

Replace: Fixed credit amount (10 credits)
Action: Add credit slider to let users choose amount

```typescript
const [elevatorCredits, setElevatorCredits] = useState(10); // Default 10

// When initiating scan
const result = await startElevatorScan(address, chain, elevatorCredits);
```

#### 5. Keep ElevatorResultCard (Optional)
**File:** `components/ElevatorResultCard.tsx`

Replace: Nothing (keep as-is for advanced analytics)
Action: Show this ONLY if advanced analytics are calculated

This component already exists and displays advanced features like:
- Insider threat detection
- Wash trading analysis  
- Top buyers/sellers with tags
- Momentum heatmap

We can keep this as a "premium" view that shows AFTER raw data table.

### Integration Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (app/page.tsx)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User selects: ELEVATOR SCAN                                 │
│  User chooses: Credits to spend (slider: 5-100)             │
│  ↓                                                            │
│  startElevatorScan(address, chain, creditsSpent)            │
│  ↓                                                            │
├─────────────────────────────────────────────────────────────┤
│ API ROUTE (/api/scan/elevator/route.ts) - NEW               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Import data collector from data_collector/                  │
│  ↓                                                            │
│  DataCollector.collect(address, config)                     │
│    ├─ Fetch OHLCV from Birdeye                              │
│    ├─ Fetch transactions from Helius (50-5000 based on $$) │
│    ├─ Build wallet balances                                  │
│    └─ Calculate metrics (RF17, W5)                          │
│  ↓                                                            │
│  Return: {                                                    │
│    rawData: {                                                 │
│      transactions[], holders[], ohlcv[], metrics            │
│    }                                                          │
│  }                                                            │
│  ↓                                                            │
├─────────────────────────────────────────────────────────────┤
│ FRONTEND (components/elevator/RawTransactionTable.tsx) - NEW│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Display raw data in table:                                  │
│  ┌──────────┬────────┬──────┬────────┬───────┬──────┐      │
│  │ Time     │ Wallet │ Type │ Amount │ TxHash│ P&L  │      │
│  └──────────┴────────┴──────┴────────┴───────┴──────┘      │
│                                                               │
│  EXTRA: Calculate P&L visual indicator in browser           │
│  ↓                                                            │
│  Fetch current price from DexScreener                        │
│  Calculate profit/loss for each wallet                       │
│  Show 🟢/🔴 indicator next to wallet                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### File Changes Summary

**NEW FILES:**
1. `lib/elevator/collectors/` (TypeScript port of data_collector/)
   - `types.ts`
   - `birdeye.ts`
   - `helius.ts`
   - `walletEngine.ts`
   - `metrics.ts`
   - `dataCollector.ts`
   - `config.ts`

2. `app/api/scan/elevator/route.ts` - New API endpoint

3. `components/elevator/RawTransactionTable.tsx` - Raw data display

**MODIFIED FILES:**
1. `services/scannerApi.ts` - Update `startElevatorScan()` function
2. `app/page.tsx` - Add credit slider for elevator scan
3. `.env.local` - Add BIRDEYE_API_KEY and HELIUS_API_KEY

**KEEP AS-IS:**
1. `components/ElevatorResultCard.tsx` - Already perfect for advanced view
2. `types/scanner.ts` - ElevatorData interface already defined
3. Credit system - Already working (10 credits minimum)

### Phase 1: Backend - Return Raw Data
1. ✅ Use existing data collector engine
2. ✅ Return ALL transactions with full details:
   - Timestamp
   - Wallet addresses (from/to)
   - Transfer amounts
   - Transaction signatures
3. ✅ Include holder balances
4. ✅ Include OHLCV data (for P&L calculation)
5. ✅ Return as-is, no processing

### Phase 2: Frontend - Display Raw Data Table
1. Create `RawTransactionTable.tsx` component
2. Display columns:
   - Time (formatted timestamp)
   - Wallet (abbreviated with copy button)
   - Action (BUY/SELL based on transfer direction)
   - Amount (formatted token amount)
   - Tx Hash (abbreviated with explorer link)
3. Add sorting and filtering
4. Add pagination (if many transactions)
5. Make responsive for mobile

### Phase 3: Frontend - Add P&L Visual Feature (EXTRA)
1. Create calculation utilities:
   - `fetchCurrentPrice()` - Get price from DexScreener
   - `calculateWalletPnL()` - Calculate P&L for a wallet
   - `estimateAvgBuyPrice()` - Estimate from OHLCV

2. Add P&L column to table:
   - Calculate P&L for each unique wallet
   - Show visual indicator (🟢/🔴/⚪)
   - Display percentage
   - Update in real-time

3. Add tooltip on hover:
   - Detailed P&L breakdown
   - Tokens bought/sold/held
   - Investment vs current value

### Phase 4: Polish
1. Add loading states
2. Add error handling (if price fetch fails)
3. Add refresh button for P&L
4. Add export functionality (CSV with all data)
5. Add "Load More" for pagination
6. Optimize performance for large datasets

---

## 📊 Success Metrics

**Functional:**
- ✅ Displays ALL raw transaction data correctly
- ✅ Shows timestamp, wallet, action, amount, tx hash
- ✅ Sorting and filtering works on raw data
- ✅ P&L visual indicator calculates correctly (extra feature)
- ✅ Handles missing data gracefully

**Performance:**
- ✅ Table loads instantly with raw data
- ✅ P&L calculations complete in <2 seconds for 1000+ wallets
- ✅ Smooth scrolling and pagination
- ✅ Price fetch completes within 3 seconds

**User Experience:**
- ✅ Raw data is primary and always visible
- ✅ P&L visual adds value without cluttering
- ✅ Clear visual distinction between profit/loss
- ✅ Export functionality includes all raw data
- ✅ Mobile responsive

---

## 🚧 Limitations & Assumptions

### Current Limitations

1. **Price Estimation Accuracy**
   - Uses OHLCV 15-min candles (not exact transaction prices)
   - May have gaps if token is new or low volume
   - Assumes closest candle represents transaction price

2. **Missing Data Handling**
   - If OHLCV data unavailable, P&L cannot be calculated
   - If DexScreener API fails, current price = 0
   - Partial data still shown with warnings

3. **Transaction Types**
   - Assumes all transfers are buys/sells
   - Cannot distinguish transfers vs trades
   - No support for swap routes (only direct transfers)

### Assumptions

1. **Wallet Activity**
   - Token received = Buy
   - Token sent = Sell
   - Current balance from wallet engine is accurate

2. **Price Data**
   - OHLCV close price represents fair market price
   - DexScreener provides accurate current price
   - Price volatility during 15-min window is negligible

3. **Investment Calculation**
   - Average buy price * tokens bought = total invested
   - Does not account for transaction fees
   - Does not account for slippage

---

## 🔮 Future Enhancements (Not in V1)

After V1 is working, we can add:

1. **Real-Time Updates**
   - WebSocket connection for live price updates
   - Auto-refresh P&L calculations

2. **Detailed Wallet View**
   - Click wallet to see transaction history
   - Timeline of all buys/sells
   - Individual trade P&L

3. **Advanced Analytics**
   - Win rate calculation
   - Average hold time
   - Best/worst trade identification
   - Trading pattern detection

4. **Wallet Tracking**
   - Save favorite wallets
   - Set alerts for P&L thresholds
   - Historical P&L tracking

5. **Comparative Analysis**
   - Compare wallet performance
   - Identify "smart money" wallets
   - Copy trading suggestions

---

## ✅ Definition of Done

V1 is complete when:

- [x] Goal document reviewed and approved
- [ ] Backend returns raw transaction data (all fields)
- [ ] Frontend displays raw data in table
- [ ] Table shows: Time, Wallet, Action, Amount, Tx Hash
- [ ] Sorting and filtering works on raw data
- [ ] EXTRA: P&L visual indicator shown next to each wallet
- [ ] EXTRA: Current price fetched from DexScreener
- [ ] EXTRA: P&L calculated in browser
- [ ] Handles errors gracefully (missing price, incomplete data)
- [ ] Works with 5-credit scan (50 transactions)
- [ ] Works with 100-credit scan (5000 transactions)
- [ ] Mobile responsive
- [ ] Export includes all raw data
- [ ] Tested with 3+ different tokens

---

**Priority:**
1. **MUST HAVE:** Raw transaction data display
2. **NICE TO HAVE:** P&L visual feature (can be added after core works)

---

**Next Steps:**
1. Review and approve this updated goal
2. Begin implementation: Backend returns raw data
3. Build raw data table component
4. Add P&L visual feature as enhancement
5. Test with real tokens
6. Polish and deploy

---

**Let's build this! 🚀**


---

## 🔧 Implementation Steps (Updated)

### Phase 1: Port Data Collector to TypeScript
Location: `lib/elevator/collectors/`

1. Create directory structure
2. Port all 6 files from `data_collector/` to TypeScript:
   - ✅ `types.ts` - Interface definitions
   - ✅ `birdeye.ts` - OHLCV fetching
   - ✅ `helius.ts` - Transaction pagination
   - ✅ `walletEngine.ts` - Balance calculation
   - ✅ `metrics.ts` - RF17, W5 calculation
   - ✅ `dataCollector.ts` - Main orchestrator
   - ✅ `config.ts` - Credit tier mapping
3. Add API keys to `.env.local`
4. Test independently with sample token

### Phase 2: Create Elevator API Route
Location: `app/api/scan/elevator/route.ts`

1. Create new API route file
2. Import data collector
3. Handle POST request with address, chain, creditsSpent
4. Call collector.collect()
5. Return raw data to frontend
6. Add error handling

### Phase 3: Update Frontend Service
Location: `services/scannerApi.ts`

1. Replace `startElevatorScan()` to call new endpoint
2. Add creditsSpent parameter
3. Return rawData structure
4. Remove fallback to basic scan

### Phase 4: Create Raw Transaction Table Component
Location: `components/elevator/RawTransactionTable.tsx`

1. Create new component
2. Display columns:
   - Time (formatted from timestamp)
   - Wallet (abbreviated, clickable)
   - Action (BUY/SELL from transfer direction)
   - Amount (formatted token amount)
   - Tx Hash (abbreviated, links to explorer)
3. Add sorting and filtering
4. Make responsive

### Phase 5: Add P&L Visual Feature (EXTRA)
Location: Same component with calculation utilities

1. Create `utils/pnlCalculator.ts`:
   - `fetchCurrentPrice()` from DexScreener
   - `calculateWalletPnL()` for each wallet
   - `estimateAvgBuyPrice()` from OHLCV

2. Add P&L column to table:
   - Calculate for each unique wallet
   - Show 🟢/🔴 indicator
   - Display percentage
   - Add tooltip with breakdown

### Phase 6: Update Main Page
Location: `app/page.tsx`

1. Add credit slider for elevator scan (5-100)
2. Pass creditsSpent to startElevatorScan()
3. Display RawTransactionTable component
4. Keep ElevatorResultCard for advanced view (optional)

### Phase 7: Polish
1. Add loading states during collection
2. Add error handling (API failures)
3. Add export functionality (CSV)
4. Add pagination for large datasets
5. Test with multiple tokens

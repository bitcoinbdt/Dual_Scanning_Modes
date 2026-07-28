# Elevator Scan UI Implementation Plan
## Transform Current UI to Match Goal V1

**Status:** Implementation Planning  
**Created:** 2026-07-28  
**Goal:** Display raw transaction data with visual P&L indicators

---

## 📊 Current UI vs Goal UI

### Current UI (ElevatorResultCard.tsx)
Shows ADVANCED analytics (future features):
- ❌ Threat Intelligence (insider threats, creator funding)
- ❌ Advanced Analytics (wash trading, Gini, holding velocity)
- ❌ Momentum Heatmap
- ❌ Top Buyers/Sellers with tags and win rates
- ✅ RecentTransactionsCard (basic transaction list)

### Goal UI (From ELEVATOR_SCAN_GOAL_V1.md)
Shows RAW transaction data with P&L:
- ✅ **PRIMARY**: All transactions in detailed table
- ✅ **EXTRA**: P&L indicator next to each wallet
- ✅ Columns: Time, Wallet, Action, Amount, Tx Hash, P&L
- ✅ Sortable and filterable
- ✅ Clean, data-focused display

---

## 🔍 Analysis of Current Components

### 1. ElevatorResultCard.tsx (204 lines)
**Current Structure:**
```typescript
- Threat Intelligence Bar (insider threat, creator funding)
- Advanced Analytics Grid (wash trading, Gini, velocity)
- Heatmap & Macro Overview (buy/sell volumes, momentum chart)
- Top Traders Lists (accumulators and distributors)
- RecentTransactionsCard (embedded at bottom)
```

**Data Expected:**
```typescript
data.marketBehavior: { totalBuyVolume, totalSellVolume, netFlow, transactionCount }
data.advancedAnalytics: { insiderThreat, creatorFunding, washTrading, giniCoefficient, holdingVelocity, momentumHeatmap }
data.topBuyers: [{ wallet, amount, percentage, tag, winRate }]
data.topSellers: [{ wallet, amount, percentage, tag, winRate }]
data.recentTransactions: Transaction[]
```

**Problem:** This expects heavily processed, advanced analytics that we won't have in Goal V1.

### 2. RecentTransactionsCard.tsx (146 lines)
**Current Structure:**
```typescript
- Filter tabs (ALL, BUY, SELL, TRANSFER)
- Table with columns: TX Hash, Type, Origin, Destination, Amount/Size
- Shows 10 transactions, has pagination indicator
- Mock data generation if no real transactions
```

**Data Expected:**
```typescript
token.recentTransactions: [{
  hash, fullHash, from, to, amount, rawAmount, rawTimestamp,
  tokenSymbol, timestamp, type
}]
```

**Good Parts:**
- ✅ Table structure is close to what we need
- ✅ Has filtering capability
- ✅ Shows transaction data clearly

**Missing:**
- ❌ No P&L column
- ❌ No wallet-centric view (shows per-transaction, not per-wallet)
- ❌ No sorting options
- ❌ Limited to 10 transactions

---

## 🎯 Implementation Strategy

### Option 1: Repurpose RecentTransactionsCard ✅ RECOMMENDED
**Pros:**
- Already has table structure
- Has filtering logic
- Styling matches app theme
- Less code to write

**Cons:**
- Need to add P&L calculation
- Need to expand beyond 10 transactions
- Need to add more columns

### Option 2: Build New Component from Scratch
**Pros:**
- Clean slate, exact to spec
- No legacy code baggage

**Cons:**
- More work
- Duplicate styling effort
- May diverge from app theme

**Decision: Option 1** - Enhance RecentTransactionsCard

---

## 🔨 Detailed Implementation Plan

### Phase 1: Create Enhanced Transaction Table Component

#### File: `components/elevator/RawTransactionTable.tsx`
**Purpose:** NEW component based on RecentTransactionsCard but enhanced for Goal V1

**Changes from RecentTransactionsCard:**

1. **New Props Interface:**
```typescript
interface RawTransactionTableProps {
  rawData: {
    transactions: Array<{
      timestamp: number;
      signature?: string;
      wallets: string[];
      transfers: Array<{
        from: string;
        to: string;
        amount: number;
        mint: string;
      }>;
    }>;
    holders: Array<{
      wallet: string;
      balance: number;
      tx_count: number;
    }>;
    ohlcv: Array<{
      timestamp: number;
      open: number;
      close: number;
      volume: number;
    }>;
  };
  tokenSymbol: string;
  tokenAddress: string;
}
```

2. **New Columns:**
```
OLD: TX Hash | Type | Origin | Destination | Amount/Size
NEW: Time | Wallet | Action | Amount | Tx Hash | P&L
```

3. **Flatten Transactions:**
```typescript
// Convert nested transfers to flat transaction rows
const flatTransactions = rawData.transactions.flatMap(tx =>
  tx.transfers.map(transfer => ({
    timestamp: tx.timestamp,
    signature: tx.signature,
    wallet: transfer.to, // or transfer.from depending on direction
    action: determineAction(transfer), // 'BUY' or 'SELL'
    amount: transfer.amount,
    from: transfer.from,
    to: transfer.to
  }))
);
```

4. **Add P&L Calculation:**
```typescript
// Calculate P&L for each unique wallet
const walletPnL = useMemo(() => {
  const pnlMap = new Map<string, WalletPnL>();
  
  // For each unique wallet
  uniqueWallets.forEach(wallet => {
    const pnl = calculateWalletPnL(
      wallet,
      rawData.transactions,
      rawData.holders,
      rawData.ohlcv,
      currentPrice
    );
    pnlMap.set(wallet, pnl);
  });
  
  return pnlMap;
}, [rawData, currentPrice]);
```

5. **Enhanced Filtering:**
```
OLD: ALL | BUY | SELL | TRANSFER
NEW: ALL | BUY | SELL | PROFIT | LOSS
```

6. **Enhanced Sorting:**
```typescript
const [sortBy, setSortBy] = useState<'time' | 'amount' | 'pnl'>('time');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
```

7. **Pagination:**
```typescript
const [page, setPage] = useState(1);
const itemsPerPage = 50; // Show 50 at a time
const totalPages = Math.ceil(flatTransactions.length / itemsPerPage);
```

#### Component Structure:
```tsx
export function RawTransactionTable({ rawData, tokenSymbol, tokenAddress }: Props) {
  // State
  const [currentPrice, setCurrentPrice] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'PROFIT' | 'LOSS'>('ALL');
  const [sortBy, setSortBy] = useState<'time' | 'amount' | 'pnl'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  
  // Fetch current price on mount
  useEffect(() => {
    fetchCurrentPriceFromDexScreener(tokenAddress).then(setCurrentPrice);
  }, [tokenAddress]);
  
  // Flatten transactions
  const flatTransactions = useMemo(() => {
    return flattenTransactions(rawData.transactions);
  }, [rawData.transactions]);
  
  // Calculate P&L for all wallets
  const walletPnL = useMemo(() => {
    return calculateAllWalletPnL(
      rawData.transactions,
      rawData.holders,
      rawData.ohlcv,
      currentPrice
    );
  }, [rawData, currentPrice]);
  
  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return applyFilters(flatTransactions, filter, walletPnL);
  }, [flatTransactions, filter, walletPnL]);
  
  // Sort transactions
  const sortedTransactions = useMemo(() => {
    return applySorting(filteredTransactions, sortBy, sortOrder, walletPnL);
  }, [filteredTransactions, sortBy, sortOrder, walletPnL]);
  
  // Paginate
  const paginatedTransactions = sortedTransactions.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  
  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <h3>Raw Transaction Data</h3>
        <div className="flex gap-4 text-sm">
          <span>Total TXs: {flatTransactions.length}</span>
          <span>Unique Wallets: {walletPnL.size}</span>
          <span>Current Price: ${currentPrice.toFixed(8)}</span>
        </div>
      </div>
      
      {/* Filters and Sorting */}
      <div className="flex flex-wrap gap-4">
        {/* Filter buttons */}
        {/* Sort dropdown */}
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Wallet</th>
              <th>Action</th>
              <th>Amount</th>
              <th>Tx Hash</th>
              <th>P&L</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map((tx, idx) => {
              const pnl = walletPnL.get(tx.wallet);
              return (
                <tr key={idx}>
                  <td>{formatTime(tx.timestamp)}</td>
                  <td>
                    <WalletCell wallet={tx.wallet} pnl={pnl} />
                  </td>
                  <td>
                    <ActionBadge action={tx.action} />
                  </td>
                  <td>{formatAmount(tx.amount, tokenSymbol)}</td>
                  <td>
                    <TxHashLink hash={tx.signature} />
                  </td>
                  <td>
                    <PnLIndicator pnl={pnl} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <Pagination 
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
```

---

### Phase 2: Create P&L Calculation Utilities

#### File: `utils/pnlCalculator.ts`

```typescript
/**
 * Fetch current token price from DexScreener
 */
export async function fetchCurrentPriceFromDexScreener(
  tokenAddress: string
): Promise<number> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      // Get most liquid pair
      const mainPair = data.pairs.sort((a: any, b: any) => 
        b.liquidity.usd - a.liquidity.usd
      )[0];
      
      return parseFloat(mainPair.priceUsd) || 0;
    }
    
    return 0;
  } catch (error) {
    console.error('Failed to fetch price:', error);
    return 0;
  }
}

/**
 * Extract buy/sell activity for a wallet
 */
export function extractWalletActivity(
  wallet: string,
  transactions: RawTransaction[]
): {
  buys: Array<{ amount: number; timestamp: number }>;
  sells: Array<{ amount: number; timestamp: number }>;
} {
  const buys: Array<{ amount: number; timestamp: number }> = [];
  const sells: Array<{ amount: number; timestamp: number }> = [];
  
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

/**
 * Estimate average buy price from OHLCV data
 */
export function estimateAvgBuyPrice(
  buys: Array<{ amount: number; timestamp: number }>,
  ohlcv: OHLCVCandle[]
): number {
  if (buys.length === 0 || ohlcv.length === 0) return 0;
  
  let totalValue = 0;
  let totalTokens = 0;
  
  buys.forEach(buy => {
    // Find closest OHLCV candle
    const closestCandle = ohlcv.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.timestamp - buy.timestamp);
      const currDiff = Math.abs(curr.timestamp - buy.timestamp);
      return currDiff < prevDiff ? curr : prev;
    });
    
    const priceAtTime = closestCandle.close;
    totalValue += buy.amount * priceAtTime;
    totalTokens += buy.amount;
  });
  
  return totalTokens > 0 ? totalValue / totalTokens : 0;
}

/**
 * Calculate P&L for a specific wallet
 */
export function calculateWalletPnL(
  wallet: string,
  transactions: RawTransaction[],
  holders: HolderInfo[],
  ohlcv: OHLCVCandle[],
  currentPrice: number
): WalletPnL {
  // Extract activity
  const { buys, sells } = extractWalletActivity(wallet, transactions);
  
  // Calculate totals
  const tokensBought = buys.reduce((sum, b) => sum + b.amount, 0);
  const tokensSold = sells.reduce((sum, s) => sum + s.amount, 0);
  
  // Get current holdings
  const holder = holders.find(h => h.wallet === wallet);
  const currentHoldings = holder ? holder.balance : 0;
  
  // Estimate prices
  const avgBuyPrice = estimateAvgBuyPrice(buys, ohlcv);
  const avgSellPrice = estimateAvgBuyPrice(sells, ohlcv);
  
  // Calculate P&L
  const totalInvested = tokensBought * avgBuyPrice;
  const currentValue = currentHoldings * currentPrice;
  const realizedPnL = (avgSellPrice - avgBuyPrice) * tokensSold;
  const unrealizedPnL = (currentPrice - avgBuyPrice) * currentHoldings;
  const totalPnL = realizedPnL + unrealizedPnL;
  const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  
  return {
    wallet,
    tokensBought,
    tokensSold,
    currentHoldings,
    avgBuyPrice,
    currentPrice,
    totalInvested,
    currentValue,
    realizedPnL,
    unrealizedPnL,
    totalPnL,
    pnlPercentage,
    status: totalPnL > 0 ? 'profit' : totalPnL < 0 ? 'loss' : 'breakeven'
  };
}

/**
 * Calculate P&L for all unique wallets
 */
export function calculateAllWalletPnL(
  transactions: RawTransaction[],
  holders: HolderInfo[],
  ohlcv: OHLCVCandle[],
  currentPrice: number
): Map<string, WalletPnL> {
  const pnlMap = new Map<string, WalletPnL>();
  
  // Get unique wallets
  const uniqueWallets = new Set<string>();
  transactions.forEach(tx => {
    tx.transfers.forEach(transfer => {
      uniqueWallets.add(transfer.from);
      uniqueWallets.add(transfer.to);
    });
  });
  
  // Calculate P&L for each wallet
  uniqueWallets.forEach(wallet => {
    const pnl = calculateWalletPnL(wallet, transactions, holders, ohlcv, currentPrice);
    pnlMap.set(wallet, pnl);
  });
  
  return pnlMap;
}
```

---

### Phase 3: Create Sub-Components

#### File: `components/elevator/WalletCell.tsx`
```tsx
export function WalletCell({ wallet, pnl }: { wallet: string; pnl?: WalletPnL }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="text-xs font-mono text-slate-300 hover:text-primary-400 transition"
        title={wallet}
      >
        {wallet.slice(0, 6)}...{wallet.slice(-4)}
      </button>
      {copied && <span className="text-xs text-green-400">✓</span>}
    </div>
  );
}
```

#### File: `components/elevator/PnLIndicator.tsx`
```tsx
export function PnLIndicator({ pnl }: { pnl?: WalletPnL }) {
  if (!pnl) {
    return <span className="text-xs text-slate-500">—</span>;
  }
  
  const isProfit = pnl.totalPnL > 0;
  const isLoss = pnl.totalPnL < 0;
  
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {isProfit && <span className="text-lg">🟢</span>}
        {isLoss && <span className="text-lg">🔴</span>}
        {!isProfit && !isLoss && <span className="text-lg">⚪</span>}
        <span className={`text-sm font-bold ${
          isProfit ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-slate-400'
        }`}>
          {isProfit && '+'}${Math.abs(pnl.totalPnL).toFixed(2)}
        </span>
      </div>
      <span className={`text-xs ${
        isProfit ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-slate-400'
      }`}>
        ({isProfit && '+'}{pnl.pnlPercentage.toFixed(1)}%)
      </span>
    </div>
  );
}
```

#### File: `components/elevator/PnLTooltip.tsx`
```tsx
export function PnLTooltip({ pnl }: { pnl: WalletPnL }) {
  return (
    <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-xl">
      <h5 className="text-xs font-bold text-slate-300 mb-3">P&L Breakdown</h5>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between gap-8">
          <span className="text-slate-400">Tokens Bought:</span>
          <span className="text-white font-mono">{pnl.tokensBought.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-slate-400">Tokens Sold:</span>
          <span className="text-white font-mono">{pnl.tokensSold.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-slate-400">Current Holdings:</span>
          <span className="text-white font-mono">{pnl.currentHoldings.toLocaleString()}</span>
        </div>
        <div className="h-px bg-slate-700 my-2" />
        <div className="flex justify-between gap-8">
          <span className="text-slate-400">Avg Buy Price:</span>
          <span className="text-white font-mono">${pnl.avgBuyPrice.toFixed(8)}</span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-slate-400">Current Price:</span>
          <span className="text-white font-mono">${pnl.currentPrice.toFixed(8)}</span>
        </div>
        <div className="h-px bg-slate-700 my-2" />
        <div className="flex justify-between gap-8">
          <span className="text-slate-400">Invested:</span>
          <span className="text-white font-mono">${pnl.totalInvested.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-slate-400">Current Value:</span>
          <span className="text-white font-mono">${pnl.currentValue.toFixed(2)}</span>
        </div>
        <div className="h-px bg-slate-700 my-2" />
        <div className="flex justify-between gap-8">
          <span className="text-slate-400 font-bold">Total P&L:</span>
          <span className={`font-bold font-mono ${
            pnl.totalPnL > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {pnl.totalPnL > 0 && '+'}${pnl.totalPnL.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

### Phase 4: Update Main Page

#### File: `app/page.tsx`

**Changes:**
1. Import new component:
```typescript
import { RawTransactionTable } from '@/components/elevator/RawTransactionTable';
```

2. Update elevator scan result display:
```typescript
{/* Elevator Scan Results */}
{elevatorData && isElevatorMode && (
  <div className="space-y-6">
    {/* NEW: Raw Transaction Table - PRIMARY FEATURE */}
    <RawTransactionTable
      rawData={elevatorData.rawData}
      tokenSymbol={elevatorData.token?.symbol || 'TOKEN'}
      tokenAddress={address}
    />
    
    {/* OPTIONAL: Keep old advanced analytics if we add them later */}
    {/* <ElevatorResultCard data={elevatorData} /> */}
  </div>
)}
```

---

### Phase 5: Handle Old ElevatorResultCard

**Options:**

#### Option A: Deprecate (Recommended for now)
- Comment out in page.tsx
- Keep file for future use
- Focus on new raw data table

#### Option B: Adapt for Future
- Rename to `AdvancedElevatorAnalytics.tsx`
- Show only when advanced analytics are available
- Make it optional/premium tier feature

#### Option C: Remove Entirely
- Delete file
- Clean up types
- Simplify codebase

**Recommendation:** Option A - Keep it commented out for now. We may want those advanced analytics later as a premium feature for higher credit tiers.

---

## 📋 File Changes Checklist

### NEW FILES:
- [ ] `components/elevator/RawTransactionTable.tsx` - Main table component
- [ ] `components/elevator/WalletCell.tsx` - Wallet display with copy
- [ ] `components/elevator/PnLIndicator.tsx` - P&L visual indicator
- [ ] `components/elevator/PnLTooltip.tsx` - Detailed P&L breakdown
- [ ] `components/elevator/ActionBadge.tsx` - BUY/SELL badge
- [ ] `components/elevator/TxHashLink.tsx` - Transaction hash with explorer link
- [ ] `utils/pnlCalculator.ts` - P&L calculation utilities

### MODIFIED FILES:
- [ ] `app/page.tsx` - Replace ElevatorResultCard with RawTransactionTable
- [ ] `services/scannerApi.ts` - Update to return rawData structure

### DEPRECATED (Keep but don't use):
- [ ] `components/ElevatorResultCard.tsx` - Comment out, keep for future
- [ ] `components/RecentTransactionsCard.tsx` - Keep as-is for basic scan

---

## 🎨 Styling Guidelines

**Match existing theme:**
- Use `glass-card` class for containers
- Use `bg-slate-950`, `bg-slate-900` for backgrounds
- Use `border-white/5`, `border-white/10` for borders
- Use `text-slate-300`, `text-slate-400` for text
- Use `text-green-400` for profit, `text-red-400` for loss
- Use `text-primary-400` for interactive elements
- Use `font-mono` for addresses and numbers
- Use `uppercase tracking-widest` for headers

---

## ✅ Testing Checklist

- [ ] Table displays with 50 transactions
- [ ] Table displays with 5000 transactions (pagination works)
- [ ] P&L calculation is accurate
- [ ] Current price fetches from DexScreener
- [ ] Sorting works (time, amount, P&L)
- [ ] Filtering works (ALL, BUY, SELL, PROFIT, LOSS)
- [ ] Wallet copy to clipboard works
- [ ] Tx hash links to explorer
- [ ] P&L tooltip shows on hover
- [ ] Mobile responsive (table scrolls horizontally)
- [ ] Loading states show properly
- [ ] Error handling (no price, no data, etc.)

---

## 🚀 Implementation Order

1. **Week 1:**
   - Create `pnlCalculator.ts` utilities
   - Test P&L calculation with mock data
   - Create sub-components (WalletCell, PnLIndicator, etc.)

2. **Week 2:**
   - Create `RawTransactionTable.tsx`
   - Implement table structure and display
   - Add filtering and sorting

3. **Week 3:**
   - Integrate P&L calculation into table
   - Add pagination
   - Polish styling

4. **Week 4:**
   - Update `app/page.tsx`
   - Integration testing
   - Bug fixes and optimization

---

**Ready to start implementation!**

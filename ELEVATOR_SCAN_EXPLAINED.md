# How Elevator Scan Works 🚀

## Overview

**Elevator Scan** is a multi-chain deep token analysis feature that collects extensive on-chain data to provide insights into token trading patterns, holder behavior, and potential wash trading indicators.

---

## 🏗️ Architecture

The system is built with a **factory pattern** to support multiple blockchains through a unified interface.

```
User Input (Token Address)
    ↓
Chain Detection (0x... vs base58)
    ↓
CollectorFactory.create(chain, apiKeys)
    ↓
IBlockchainCollector Implementation
    ├─ SolanaCollector
    ├─ BscCollector
    └─ EthCollector
    ↓
Universal Data Format
    ↓
Frontend Display (RawTransactionTable)
```

---

## 📊 Data Collection Flow

### Phase 1: Chain Detection
**File:** `lib/elevator/utils/chainDetector.ts`

```typescript
// Detect blockchain from address format
detectChain(address: string, preferredChain?: 'eth' | 'bsc')

// Supported patterns:
// - Solana: base58, 32-44 chars (e.g., DezXAZ8z7Pnrn...)
// - EVM (ETH/BSC): 0x + 40 hex chars (e.g., 0x55d398326f...)
```

**Logic:**
1. Check if address matches `0x[a-fA-F0-9]{40}` → EVM (ETH or BSC)
2. Check if address matches `[1-9A-HJ-NP-Za-km-z]{32,44}` → Solana
3. Otherwise → Unknown/Invalid

---

### Phase 2: Collector Creation
**File:** `lib/elevator/collectors/CollectorFactory.ts`

```typescript
CollectorFactory.create(blockchain: 'solana' | 'bsc' | 'eth', apiKeys)
```

**Returns:**
- `SolanaCollector` for Solana addresses
- `BscCollector` for BSC addresses  
- `EthCollector` for Ethereum addresses

**Validates Required API Keys:**
- All chains need: `BIRDEYE_API_KEY`
- Solana needs: `HELIUS_API_KEY`
- BSC needs: `BSCSCAN_API_KEY`
- ETH needs: `ETHERSCAN_API_KEY`

---

### Phase 3: Data Collection
**Files:** 
- `lib/elevator/collectors/solana/SolanaCollector.ts`
- `lib/elevator/collectors/bsc/BscCollector.ts`
- `lib/elevator/collectors/eth/EthCollector.ts`

Each collector implements the **IBlockchainCollector** interface:

```typescript
interface IBlockchainCollector {
  fetchOHLCV(address: string): Promise<OHLCVCandle[]>
  fetchTransactions(address: string, max: number): Promise<UniversalTransaction[]>
  buildWalletData(txs: UniversalTransaction[]): WalletData
  calculateMetrics(ohlcv: OHLCVCandle[], wallets: WalletMetrics): Metrics
  collect(address: string, maxTxs: number): Promise<CollectorResult>
}
```

---

## 🔍 Data Collection Steps (All Chains)

### Step 1: Fetch OHLCV Data
**Purpose:** Get price history (candlestick data)  
**Source:** Birdeye API  
**Data:** Open, High, Low, Close, Volume for each time period

**Example:**
```typescript
[
  { timestamp: 1704067200, open: 1.05, close: 1.08, volume: 50000 },
  { timestamp: 1704070800, open: 1.08, close: 1.12, volume: 75000 },
  ...
]
```

---

### Step 2: Fetch Transactions
**Purpose:** Get all token transfer events  
**Sources:**
- **Solana:** Helius API
- **BSC:** BscScan API  
- **Ethereum:** Etherscan API

**Data Collected:**
- Transaction hash/signature
- Timestamp (when it happened)
- From address (sender)
- To address (receiver)
- Amount (token quantity transferred)
- Type (buy/sell/transfer)
- Gas fees

**Buy/Sell Detection:**
Transactions are classified based on DEX router addresses:

#### Solana
- Raydium Router
- Orca Router
- Jupiter Aggregator

#### BSC
- PancakeSwap Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- Biswap Router: `0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8`

#### Ethereum
- Uniswap V2: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
- Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
- SushiSwap: `0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F`
- 0x Exchange: `0xDef1C0ded9bec7F1a1670819833240f027b25EfF`

**Classification Logic:**
```typescript
if (tx.to === DEX_ROUTER_ADDRESS) {
  return 'buy';  // Tokens going TO DEX = user buying
} else if (tx.from === DEX_ROUTER_ADDRESS) {
  return 'sell'; // Tokens coming FROM DEX = user selling
} else {
  return 'transfer'; // Direct wallet-to-wallet
}
```

---

### Step 3: Build Wallet Data
**Purpose:** Calculate holder balances and activity  
**Logic:**

```typescript
For each transaction:
  wallets[from].total_out += amount
  wallets[to].total_in += amount
  wallets[both].tx_count++

For each wallet:
  net_balance = total_in - total_out
  if (net_balance > 0) {
    → Add to holders list
  }
```

**Output:**
- Total unique wallets
- Total holders (positive balance)
- Top 10 holders by balance
- Transaction count per wallet

---

### Step 4: Calculate Metrics
**Purpose:** Detect potential wash trading and concentration  

#### RF17 Metric (Wash Trading Indicator)
```typescript
RF17 = (totalVolume > avgVolume) && (priceChange < 2%)

// True = Possible wash trading
// High volume but price barely moved → suspicious
```

#### W5 Metric (Holder Count)
```typescript
W5 = total_holders

// Low holder count = high concentration risk
// High holder count = better distribution
```

---

## 💾 Universal Data Format

All collectors return data in a **unified format** regardless of blockchain:

```typescript
interface CollectorResult {
  ohlcv: OHLCVCandle[];               // Price history
  transactions: UniversalTransaction[]; // All transfers
  wallets: Record<string, WalletBalance>; // Wallet activities
  holders: HolderInfo[];               // Current holders
  wallet_metrics: WalletMetrics;       // Aggregated stats
  metrics: CalculatedMetrics;          // RF17 & W5
  blockchain: 'solana' | 'bsc' | 'eth'; // Source chain
  collectionTime: number;              // Time taken (ms)
}
```

**UniversalTransaction Format:**
```typescript
{
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  amount: number;
  type: 'buy' | 'sell' | 'transfer';
  token: {
    address: string;
    symbol?: string;
    decimals?: number;
  };
  blockchain: 'solana' | 'bsc' | 'eth';
  gasUsed?: number;
  gasFee?: number;
}
```

---

## 🎨 Frontend Display

**File:** `components/elevator/RawTransactionTable.tsx`

The collected data is displayed in an interactive table with:

### Features
1. **Sortable Columns:**
   - Time (newest/oldest)
   - Amount (high/low)
   - P&L (profit/loss)

2. **Filters:**
   - ALL transactions
   - BUY only
   - SELL only
   - PROFIT only (positive P&L)
   - LOSS only (negative P&L)

3. **Real-Time P&L Calculation:**
```typescript
For each transaction:
  current_price = fetch from DexScreener
  if (type === 'buy') {
    pnl = (current_price - buy_price) * amount
  } else if (type === 'sell') {
    pnl = (sell_price - average_buy_price) * amount
  }
```

4. **Visual Indicators:**
   - 🟢 Green = Profit
   - 🔴 Red = Loss
   - ⚪ Gray = Breakeven

5. **Interactive Elements:**
   - Copy wallet address to clipboard
   - Click transaction hash → Open blockchain explorer
   - Hover P&L → Show detailed breakdown tooltip

---

## ⚙️ Configuration Tiers

**File:** `lib/elevator/collectors/config.ts`

Credits determine how many transactions to fetch:

| Credits | Tier | Max Transactions |
|---------|------|------------------|
| 5-10 | Quick Peek | 50 |
| 11-25 | Standard | 200 |
| 26-50 | Professional | 1,000 |
| 51-100 | Institutional | 5,000 |

**More transactions = Better data accuracy = Higher cost**

---

## 🔐 Security & Privacy

### API Keys (Server-Side Only)
All API keys are **never exposed** to the browser:

```typescript
// ✅ Safe - Server-side environment variables
BIRDEYE_API_KEY=abc123
HELIUS_API_KEY=def456
BSCSCAN_API_KEY=ghi789
ETHERSCAN_API_KEY=jkl012
```

These are only accessible in:
- `app/api/scan/elevator/route.ts` (API route)
- Never sent to client

### Rate Limiting
Built-in retry logic with exponential backoff:
```typescript
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 429) {
      // Wait and retry
      return retryRequest(error.config);
    }
  }
);
```

---

## 📡 API Route

**File:** `app/api/scan/elevator/route.ts`

```typescript
POST /api/scan/elevator
Body: { address: string, creditsSpent: number }

Flow:
1. Validate address format
2. Detect blockchain
3. Validate API keys
4. Get config from credits
5. Create collector
6. Collect data
7. Return result
```

**Response Format:**
```json
{
  "success": true,
  "rawData": {
    "transactions": [...],
    "holders": [...],
    "ohlcv": [...],
    "token": { "symbol": "TOKEN", "address": "..." }
  },
  "metadata": {
    "creditsSpent": 10,
    "tier": "quick_peek",
    "transactionCount": 50,
    "holderCount": 25,
    "walletCount": 40,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "metrics": {
      "RF17": false,
      "W5": 25
    }
  }
}
```

---

## 🧪 Testing

### Test with Real Tokens

**Solana:**
```bash
Address: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
Expected: Helius API call → Raydium DEX detection
```

**BSC:**
```bash
Address: 0x55d398326f99059fF775485246999027B3197955
Expected: BscScan API call → PancakeSwap DEX detection
```

**Ethereum:**
```bash
Address: 0xdAC17F958D2ee523a2206206994597C13D831ec7
Expected: Etherscan API call → Uniswap DEX detection
```

---

## 🐛 Error Handling

### Common Errors

1. **Invalid Address**
```
Error: "Invalid token address format"
Solution: Check address matches chain format
```

2. **Missing API Key**
```
Error: "BIRDEYE_API_KEY is required"
Solution: Add key to .env.local and restart
```

3. **No Transactions Found**
```
Error: "No transactions found for this token"
Solution: Token might be too new or inactive
```

4. **Rate Limit Exceeded**
```
Error: "429 Too Many Requests"
Solution: Wait 60 seconds or upgrade API plan
```

---

## 🎯 Key Advantages

### 1. Multi-Chain Support
- ✅ One codebase for all chains
- ✅ Unified data format
- ✅ Easy to add new chains

### 2. Scalable Architecture
```
Want to add Polygon?
1. Create PolygonCollector.ts (copy EthCollector)
2. Change API from Etherscan to Polygonscan
3. Add to CollectorFactory
4. Done!
```

### 3. Rich Data Collection
- Transaction history
- Holder distribution
- Price movements
- Wash trading detection
- Gas fee analysis

### 4. Real-Time P&L
- Fetches current price from DexScreener
- Calculates profit/loss for each wallet
- Shows unrealized gains/losses
- Helps identify smart money wallets

---

## 📚 File Structure

```
lib/elevator/
├── collectors/
│   ├── types.ts              # Universal interfaces
│   ├── config.ts             # Credit tier mapping
│   ├── CollectorFactory.ts  # Factory pattern
│   ├── solana/
│   │   ├── SolanaCollector.ts
│   │   ├── birdeye.ts
│   │   ├── helius.ts
│   │   ├── walletEngine.ts
│   │   └── metrics.ts
│   ├── bsc/
│   │   ├── BscCollector.ts
│   │   ├── birdeye.ts
│   │   └── bscscan.ts
│   └── eth/
│       ├── EthCollector.ts
│       ├── birdeye.ts
│       └── etherscan.ts
└── utils/
    └── chainDetector.ts

components/elevator/
├── RawTransactionTable.tsx   # Main table component
├── WalletCell.tsx            # Wallet display
├── PnLIndicator.tsx          # Profit/loss visual
├── PnLTooltip.tsx            # Detailed breakdown
├── ActionBadge.tsx           # BUY/SELL/TRANSFER badge
└── TxHashLink.tsx            # Explorer link

utils/
└── pnlCalculator.ts          # P&L calculation engine
```

---

## 🚀 Future Enhancements

### Planned Features
1. **Phase 5:** UI chain selector dropdown
2. **Phase 6:** Add Polygon support
3. **Phase 7:** Add Avalanche support
4. **Phase 8:** Historical P&L charting
5. **Phase 9:** Whale wallet alerts
6. **Phase 10:** Smart money tracking

### Possible Improvements
- WebSocket for real-time updates
- Export data as CSV/JSON
- Advanced filtering (date range, amount range)
- Wallet tagging/notes
- Portfolio tracking across multiple tokens

---

## 🎉 Summary

**Elevator Scan** is a powerful multi-chain token analysis tool that:

1. ✅ Detects blockchain automatically
2. ✅ Collects extensive on-chain data
3. ✅ Calculates wallet balances and P&L
4. ✅ Detects potential wash trading
5. ✅ Displays interactive results
6. ✅ Supports Solana, BSC, and Ethereum
7. ✅ Easy to extend to new chains

**The system is production-ready and fully implemented! 🚀**

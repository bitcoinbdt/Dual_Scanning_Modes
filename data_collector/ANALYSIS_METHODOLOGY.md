# Crypto Token Data Analysis Methodology

## Overview
This document explains how the crypto token data collection and whale analysis system works, from data collection to insight extraction.

---

## 1. Data Collection Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA COLLECTION PIPELINE                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Input: tokens.json                                          │
│    ↓                                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Birdeye API (OHLCV Data)                          │   │
│  │    - Price data (open, close)                        │   │
│  │    - Volume data                                     │   │
│  │    - 15-minute intervals                             │   │
│  │    - 24-hour window                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│    ↓                                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 2. Helius API (Transaction Data)                     │   │
│  │    - Pagination with "before" cursor                 │   │
│  │    - Token transfer filtering                        │   │
│  │    - Wallet address extraction                       │   │
│  │    - Up to 5,000 transactions                        │   │
│  └──────────────────────────────────────────────────────┘   │
│    ↓                                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 3. Wallet Engine (Balance Calculation)               │   │
│  │    - Track total_in per wallet                       │   │
│  │    - Track total_out per wallet                      │   │
│  │    - Calculate balance = total_in - total_out        │   │
│  │    - Identify holders (balance > 0)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│    ↓                                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 4. Metrics Calculator                                │   │
│  │    - RF17: Wash trading detection                    │   │
│  │    - W5: Whale/holder count                          │   │
│  └──────────────────────────────────────────────────────┘   │
│    ↓                                                          │
│  Output: result.json / bee_result.json                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Token Filtering Implementation

### Problem
Solana transactions often contain multiple token transfers. We need to isolate only the target token.

### Solution
```javascript
// In utils/normalize.js
export function normalizeTransaction(tx, targetMint) {
  // Only process transfers matching the target token mint address
  if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
    tx.tokenTransfers.forEach(transfer => {
      if (targetMint && transfer.mint !== targetMint) {
        return; // Skip non-matching tokens
      }
      // Process only matching transfers
    });
  }
}
```

**Why this matters:**
- Prevents contamination from other tokens in the same transaction
- Ensures accurate wallet balances for the target token only
- Critical for multi-token transactions (common on Solana)

---

## 3. Pagination Strategy

### Problem
High-volume tokens have millions of transactions. APIs return data in pages (100 per request).

### Solution
```javascript
// In services/helius.js
let before = null;
while (hasMore && allTransactions.length < MAX_TRANSACTIONS) {
  const params = { 'api-key': apiKey, limit: 100 };
  
  if (before) {
    params.before = before; // Use last transaction signature as cursor
  }
  
  const response = await fetchWithRetry(url, params);
  const transactions = response.data;
  
  allTransactions.push(...transactions);
  
  before = transactions[transactions.length - 1].signature; // Update cursor
  
  await sleep(300); // Rate limiting
}
```

**Key features:**
- Uses "before" cursor for pagination
- Fetches up to 5,000 transactions (configurable)
- 300ms delay between requests (rate limiting)
- Retry logic for failed requests

---

## 4. Wallet Balance Calculation

### Algorithm

```
For each transaction in chronological order:
  1. Extract all wallet addresses (from, to, feePayer)
  2. For each transfer:
     - Increment receiver's total_in
     - Increment sender's total_out
     - Increment both wallets' tx_count
  3. Calculate final balance:
     balance = total_in - total_out
  4. Identify holders:
     holder = wallet where balance > 0
```

### Implementation
```javascript
// In utils/wallet-engine.js
export function buildWalletData(transactions) {
  const wallets = {};
  
  transactions.forEach(tx => {
    tx.transfers.forEach(transfer => {
      if (transfer.from && wallets[transfer.from]) {
        wallets[transfer.from].total_out += transfer.amount;
      }
      if (transfer.to && wallets[transfer.to]) {
        wallets[transfer.to].total_in += transfer.amount;
      }
    });
  });
  
  const holders = [];
  Object.keys(wallets).forEach(wallet => {
    const balance = wallets[wallet].total_in - wallets[wallet].total_out;
    if (balance > 0) {
      holders.push({ wallet, balance, tx_count: wallets[wallet].tx_count });
    }
  });
  
  holders.sort((a, b) => b.balance - a.balance); // Sort by balance descending
  
  return { wallets, holders, metrics };
}
```

---

## 5. Whale Detection Methodology

### Identification Criteria

#### 1. **Accumulation Whales**
```
Characteristics:
- High balance (top 10 holders)
- Low transaction count (1-5 transactions)
- Pattern: Buy and hold

Example from BEE:
- GZs5pakbv... : 30,537,436 BEE, 1 tx → Pure accumulation
```

#### 2. **Trading Whales**
```
Characteristics:
- High balance (top 10 holders)
- High transaction count (15+ transactions)
- Pattern: Active trading

Example from BONK:
- MfDuWeqSH... : 1.4B BONK, 260 tx → Active trader
```

#### 3. **Market Makers**
```
Characteristics:
- Extremely high transaction count (1000+ transactions)
- Central hub in transaction network
- Appears in many large transfers

Example from BEE:
- 75gzec1Pg... : 118M BEE, 4,818 tx → Market maker/bot
```

### Detection Algorithm

```javascript
function classifyWhale(wallet) {
  const { balance, tx_count } = wallet;
  
  if (tx_count >= 1000) {
    return "MARKET_MAKER";
  } else if (tx_count <= 5 && balance > threshold) {
    return "ACCUMULATION_WHALE";
  } else if (tx_count >= 15 && balance > threshold) {
    return "TRADING_WHALE";
  }
  
  return "REGULAR_HOLDER";
}
```

---

## 6. Metrics Calculation

### RF17: Wash Trading Detection

**Formula:**
```
priceChange = (lastClose - firstOpen) / firstOpen
totalVolume = sum(all candle volumes)
avgVolume = totalVolume / number_of_candles

RF17 = (totalVolume > avgVolume) AND (abs(priceChange) < 0.02)
```

**Interpretation:**
- `true`: High volume with minimal price movement (suspicious)
- `false`: Volume proportional to price movement (natural)

**Example:**
- BONK: RF17 = true (high volume, <2% price change)
- BEE: RF17 = false (volume matches price movement)

### W5: Whale Count

**Formula:**
```
W5 = total number of holders with balance > 0
```

**Note:** Original definition uses circulating supply to identify whales (>1% of supply), but current implementation counts all holders.

---

## 7. Data Analysis Process

### Step 1: Load and Parse Data
```bash
# Read the JSON output file
cat output/bee_result.json | jq '.wallet_metrics'
```

### Step 2: Identify Top Holders
```javascript
// Top 10 holders are pre-sorted by balance
const topHolders = data.wallet_metrics.top_10_wallets;
```

### Step 3: Classify Whale Behavior
```
For each top holder:
  1. Check transaction count
  2. Check balance
  3. Classify as: Accumulation / Trading / Market Maker
```

### Step 4: Calculate Concentration
```
Top 1 holder percentage = (top1_balance / total_supply) * 100
Top 10 holder percentage = (sum(top10_balances) / total_supply) * 100
```

### Step 5: Identify Patterns
```
- Repeated large transfers → Market maker activity
- Single large transfer → Accumulation
- Many small transfers → Retail activity
```

---

## 8. Real-World Examples

### BONK Analysis

**Data Collected:**
- 5,041 transactions
- 1,294 wallets
- 394 holders (30.4% holder ratio)

**Key Findings:**

1. **Mega Whale Detected**
   ```
   Address: 4TYF8iW8bXET9C8aFgJoiUHhNtpBg5bqRsxSptCExvz7
   Balance: 17,944,937,828 BONK
   Transactions: 1
   Pattern: Single massive accumulation
   ```

2. **Market Maker Hub**
   ```
   Address: 6oFWm7KPLfxnwMb3z5xwBoXNSPP3JJyirAPqPSiVcnsp
   Role: Central routing for 100+ large transfers
   Pattern: Connects multiple whales
   ```

3. **Active Trader**
   ```
   Address: MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa
   Balance: 1.4B BONK
   Transactions: 260
   Pattern: High-frequency trading
   ```

### BEE Analysis

**Data Collected:**
- 2,373+ transactions
- 1,319 wallets
- 264 holders (20% holder ratio)

**Key Findings:**

1. **Dominant Market Maker**
   ```
   Address: 75gzec1Pg6RaHz9PNMFgUz8rPvSaCHrGQ4Lx2jmFapPt
   Balance: 118,187,885 BEE
   Transactions: 4,818
   Pattern: Extreme activity, likely bot/market maker
   ```

2. **Accumulation Whales**
   ```
   Multiple wallets with 1-2 transactions
   Balances: 10M - 30M BEE
   Pattern: Buy and hold strategy
   ```

3. **Lower Holder Ratio**
   ```
   20% vs BONK's 30%
   Interpretation: More speculative trading, less long-term holding
   ```

---

## 9. Insights Extraction Process

### Holder Ratio Analysis
```
Holder Ratio = (holders / total_wallets) * 100

High ratio (>30%): Strong holder base, less speculation
Low ratio (<20%): High trading activity, more speculation
```

### Whale Concentration
```
Concentration = (top_10_balance / estimated_supply) * 100

High concentration (>50%): Centralized control, manipulation risk
Low concentration (<20%): Distributed ownership, healthier
```

### Transaction Patterns
```
Avg tx per wallet = total_transactions / total_wallets

Low (<2): Mostly accumulation
Medium (2-5): Mixed trading
High (>5): Active trading/speculation
```

### Volume Analysis
```
Volume spike = candle_volume > (median_volume * 3)

Spikes indicate:
- Major whale movements
- News/events
- Pump attempts
```

---

## 10. Limitations and Considerations

### Data Limitations

1. **Sample Size**
   - Maximum 5,000 transactions
   - May miss older historical data
   - 24-hour OHLCV window only

2. **Missing Data**
   - No circulating supply data (affects whale % calculation)
   - No liquidity pool data
   - No mint/burn event tracking

3. **Snapshot Nature**
   - Single point in time
   - Cannot track growth over time
   - No historical comparison

### Analysis Limitations

1. **Whale Classification**
   - Based on transaction count heuristics
   - May misclassify complex strategies
   - Cannot detect off-chain coordination

2. **Wash Trading Detection**
   - Simple volume/price ratio
   - May miss sophisticated manipulation
   - No cross-exchange analysis

3. **Market Maker Identification**
   - Based on transaction frequency
   - Cannot distinguish from bots
   - May include legitimate traders

---

## 11. Future Enhancements

### Recommended Improvements

1. **Time Series Collection**
   ```
   - Collect data at regular intervals (hourly/daily)
   - Track wallet growth over time
   - Identify accumulation phases
   - Detect distribution patterns
   ```

2. **Enhanced Metrics**
   ```
   - Holder growth rate
   - Whale accumulation velocity
   - Liquidity depth tracking
   - Smart money flow analysis
   ```

3. **Pattern Recognition**
   ```
   - Pre-pump behavioral fingerprints
   - Pump-and-dump detection
   - Rug pull early warning signals
   - Organic growth vs manipulation
   ```

4. **Cross-Token Analysis**
   ```
   - Compare multiple tokens
   - Identify common whale wallets
   - Detect coordinated movements
   - Portfolio tracking
   ```

---

## 12. How to Use This System

### Basic Usage

1. **Prepare Token Input**
   ```json
   // tokens.json
   [
     {
       "name": "TOKEN_NAME",
       "address": "TOKEN_CONTRACT_ADDRESS",
       "mint": "TOKEN_CONTRACT_ADDRESS",
       "chain": "solana"
     }
   ]
   ```

2. **Set API Keys**
   ```bash
   # .env file
   BIRDEYE_API_KEY=your_birdeye_key
   HELIUS_API_KEY=your_helius_key
   ```

3. **Run Collection**
   ```bash
   node collect.js tokens.json
   ```

4. **Analyze Output**
   ```bash
   # View summary
   cat output/result.json | jq '.wallet_metrics'
   
   # Find top holders
   cat output/result.json | jq '.wallet_metrics.top_10_wallets'
   
   # Check metrics
   cat output/result.json | jq '.metrics'
   ```

### Advanced Analysis

1. **Find Largest Transactions**
   ```bash
   grep -o '"amount": [0-9]*' output/result.json | \
   sort -t: -k2 -n -r | head -10
   ```

2. **Identify Market Makers**
   ```bash
   cat output/result.json | jq '.wallet_metrics.top_10_wallets[] | 
   select(.tx_count > 100)'
   ```

3. **Calculate Concentration**
   ```bash
   # Sum top 10 balances
   cat output/result.json | jq '[.wallet_metrics.top_10_wallets[].balance] | 
   add'
   ```

---

## 13. Conclusion

This system provides a comprehensive framework for:
- ✅ Collecting real-time token data
- ✅ Identifying whale wallets
- ✅ Detecting trading patterns
- ✅ Analyzing holder distribution
- ✅ Spotting manipulation signals

**Key Strengths:**
- Real API integration (no mock data)
- Token-specific filtering
- Accurate balance calculation
- Whale classification
- Actionable insights

**Use Cases:**
- Token research and due diligence
- Whale tracking and monitoring
- Manipulation detection
- Investment decision support
- Market intelligence gathering

---

## Appendix: Technical Details

### API Endpoints

**Birdeye OHLCV:**
```
GET https://public-api.birdeye.so/defi/ohlcv
Headers:
  X-API-KEY: <key>
  x-chain: solana
Params:
  address: <token_address>
  type: 15m
  time_from: <unix_timestamp>
  time_to: <unix_timestamp>
```

**Helius Transactions:**
```
GET https://api.helius.xyz/v0/addresses/{address}/transactions
Params:
  api-key: <key>
  limit: 100
  before: <signature> (for pagination)
```

### Data Structures

**OHLCV Record:**
```json
{
  "timestamp": 1777273200,
  "open": 0.0000062113542338679875,
  "close": 0.000006196936568473519,
  "volume": 2618365795.878298
}
```

**Transaction Record:**
```json
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
```

**Wallet Record:**
```json
{
  "wallet_address": {
    "total_in": 1000000,
    "total_out": 200000,
    "tx_count": 5
  }
}
```

**Holder Record:**
```json
{
  "wallet": "4TYF8iW8bXET9C8aFgJoiUHhNtpBg5bqRsxSptCExvz7",
  "balance": 17944937828.35,
  "tx_count": 1
}
```

---

**Document Version:** 1.0  
**Last Updated:** April 30, 2026  
**Author:** Crypto Token Analysis System

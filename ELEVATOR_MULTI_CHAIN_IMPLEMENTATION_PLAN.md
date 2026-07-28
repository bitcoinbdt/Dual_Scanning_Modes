# Elevator Scan: Multi-Chain Implementation Plan

**Date:** 2026-07-28  
**Status:** Planning Phase  
**Goal:** Add BSC and ETH support to elevator scan  
**Current State:** Solana-only implementation

---

## 🎯 Problems Found During Testing

### Issue 1: Chain Limitation (Architecture)
**Current State:** Elevator scan only supports Solana
- Birdeye API hardcoded to Solana chain
- Helius API is Solana-exclusive
- Transaction structure matches SPL tokens only
- No EVM chain support

**Impact:** Users cannot scan BSC or ETH tokens

### Issue 2: No Chain Detection
**Current State:** API accepts any address format
- No validation for address format
- No chain detection from address
- Confusing error messages for non-Solana addresses

**Impact:** Poor UX when user enters BSC/ETH address

### Issue 3: Missing Error Messaging
**Current State:** Generic 500 errors for unsupported chains
- No clear indication of Solana-only limitation
- No helpful guidance for users

**Impact:** Users don't know elevator scan is Solana-only


---

## 📋 Implementation Strategy

### Phase 1: Add Chain Detection & Validation (High Priority)
**Goal:** Gracefully handle non-Solana addresses  
**Time:** 1-2 hours  
**Dependencies:** None

### Phase 2: Abstract Collector Interface (Medium Priority)
**Goal:** Create pluggable architecture for multiple chains  
**Time:** 2-3 hours  
**Dependencies:** Phase 1

### Phase 3: Add BSC Support (Medium Priority)
**Goal:** Implement BSC token scanning  
**Time:** 4-6 hours  
**Dependencies:** Phase 2

### Phase 4: Add ETH Support (Medium Priority)
**Goal:** Implement ETH token scanning  
**Time:** 4-6 hours  
**Dependencies:** Phase 2

### Phase 5: UI Chain Selector (Low Priority)
**Goal:** Let users choose chain explicitly  
**Time:** 1-2 hours  
**Dependencies:** Phase 3 or 4

---

## 🔧 Phase 1: Chain Detection & Validation

### Objective
Detect blockchain from address format and show helpful errors


### Task 1.1: Create Chain Detector Utility

**File:** `lib/elevator/utils/chainDetector.ts`

```typescript
export type SupportedChain = 'solana' | 'bsc' | 'eth' | 'unknown';

export interface ChainDetectionResult {
  chain: SupportedChain;
  isValid: boolean;
  format: string;
}

/**
 * Detect blockchain from address format
 */
export function detectChain(address: string): ChainDetectionResult {
  // Ethereum/BSC format (0x... + 40 hex chars)
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return {
      chain: 'eth', // Could be ETH or BSC
      isValid: true,
      format: 'EVM (Ethereum/BSC)'
    };
  }
  
  // Solana format (base58, 32-44 chars, no 0/O/I/l)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return {
      chain: 'solana',
      isValid: true,
      format: 'Solana'
    };
  }
  
  return {
    chain: 'unknown',
    isValid: false,
    format: 'Unknown'
  };
}
```


### Task 1.2: Update API Route with Validation

**File:** `app/api/scan/elevator/route.ts`

```typescript
import { detectChain } from '@/lib/elevator/utils/chainDetector';

export async function POST(request: NextRequest) {
  try {
    const { address, creditsSpent = 10 } = await request.json();
    
    // Detect chain from address
    const detection = detectChain(address);
    
    if (!detection.isValid) {
      return NextResponse.json({
        error: 'Invalid token address format',
        details: `Address does not match any known blockchain format`
      }, { status: 400 });
    }
    
    // Check if chain is supported
    if (detection.chain !== 'solana') {
      return NextResponse.json({
        error: `${detection.format} not yet supported`,
        details: `Elevator scan currently only supports Solana tokens. ${detection.format} support coming soon!`,
        chain: detection.chain,
        supported: false
      }, { status: 400 });
    }
    
    // Continue with Solana collection...
  }
}
```


### Task 1.3: Add UI Warning

**File:** `app/page.tsx`

```typescript
{scanType === 'ELEVATOR' && (
  <div className="flex items-center gap-2 p-3 bg-blue-900/20 border border-blue-400/30 rounded-lg mt-4">
    <Info className="w-4 h-4 text-blue-400" />
    <p className="text-xs text-blue-300">
      <strong>Note:</strong> Elevator Deep Scan currently supports Solana tokens only. 
      BSC and ETH support coming soon.
    </p>
  </div>
)}
```

**Checklist:**
- [ ] Create `chainDetector.ts` utility
- [ ] Add chain detection to API route
- [ ] Add validation and helpful errors
- [ ] Add UI warning message
- [ ] Test with Solana, BSC, ETH addresses

---

## 🏗️ Phase 2: Abstract Collector Interface

### Objective
Create flexible architecture for multiple blockchain collectors


### Task 2.1: Define Universal Interfaces

**File:** `lib/elevator/collectors/types.ts` (extend existing)

```typescript
// Universal transaction format (works for all chains)
export interface UniversalTransaction {
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
  gasUsed?: number;
  gasFee?: number;
}

// Collector interface that all chains must implement
export interface IBlockchainCollector {
  fetchOHLCV(address: string): Promise<OHLCVCandle[]>;
  fetchTransactions(address: string, maxTx: number): Promise<UniversalTransaction[]>;
  buildWalletData(transactions: UniversalTransaction[]): WalletData;
  calculateMetrics(ohlcv: OHLCVCandle[], wallets: WalletData): CalculatedMetrics;
  collect(address: string, maxTx: number): Promise<CollectorResult>;
}
```


### Task 2.2: Refactor Solana Collector

**File:** `lib/elevator/collectors/solana/SolanaCollector.ts`

```typescript
import { IBlockchainCollector } from '../types';

export class SolanaCollector implements IBlockchainCollector {
  private birdeyeKey: string;
  private heliusKey: string;
  
  constructor(birdeyeKey: string, heliusKey: string) {
    this.birdeyeKey = birdeyeKey;
    this.heliusKey = heliusKey;
  }
  
  async fetchOHLCV(address: string): Promise<OHLCVCandle[]> {
    // Use existing birdeye.ts logic
  }
  
  async fetchTransactions(address: string, maxTx: number): Promise<UniversalTransaction[]> {
    // Use existing helius.ts logic
    // Convert to UniversalTransaction format
  }
  
  async collect(address: string, maxTx: number): Promise<CollectorResult> {
    // Use existing dataCollector.ts logic
  }
}
```


### Task 2.3: Create Collector Factory

**File:** `lib/elevator/collectors/CollectorFactory.ts`

```typescript
export class CollectorFactory {
  static create(chain: SupportedChain, apiKeys: Record<string, string>): IBlockchainCollector {
    switch (chain) {
      case 'solana':
        return new SolanaCollector(
          apiKeys.BIRDEYE_API_KEY,
          apiKeys.HELIUS_API_KEY
        );
      
      case 'bsc':
        return new BscCollector(
          apiKeys.BSCSCAN_API_KEY,
          apiKeys.BIRDEYE_API_KEY
        );
      
      case 'eth':
        return new EthCollector(
          apiKeys.ETHERSCAN_API_KEY,
          apiKeys.BIRDEYE_API_KEY
        );
      
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }
}
```

**Checklist:**
- [ ] Define universal interfaces
- [ ] Refactor existing Solana code into SolanaCollector class
- [ ] Create CollectorFactory
- [ ] Update API route to use factory pattern
- [ ] Test Solana still works


---

## 🟡 Phase 3: BSC Support

### Objective
Implement Binance Smart Chain token scanning

### Task 3.1: Create BscScan API Client

**File:** `lib/elevator/collectors/bsc/bscscan.ts`

```typescript
import axios from 'axios';

export async function fetchBscTransactions(
  contractAddress: string,
  apiKey: string,
  maxTransactions: number = 1000
): Promise<any[]> {
  const url = 'https://api.bscscan.com/api';
  
  const response = await axios.get(url, {
    params: {
      module: 'account',
      action: 'tokentx',
      contractaddress: contractAddress,
      startblock: 0,
      endblock: 99999999,
      sort: 'desc',
      apikey: apiKey
    }
  });
  
  if (response.data.status !== '1') {
    throw new Error(response.data.message || 'BscScan API error');
  }
  
  return response.data.result.slice(0, maxTransactions);
}
```


### Task 3.2: Create BSC Collector

**File:** `lib/elevator/collectors/bsc/BscCollector.ts`

```typescript
export class BscCollector implements IBlockchainCollector {
  private bscscanKey: string;
  private birdeyeKey: string;
  
  constructor(bscscanKey: string, birdeyeKey: string) {
    this.bscscanKey = bscscanKey;
    this.birdeyeKey = birdeyeKey;
  }
  
  async fetchOHLCV(address: string): Promise<OHLCVCandle[]> {
    // Use Birdeye with chain: 'bsc'
    const response = await axios.get('https://public-api.birdeye.so/defi/ohlcv', {
      headers: {
        'X-API-KEY': this.birdeyeKey,
        'x-chain': 'bsc'  // ← BSC instead of Solana
      },
      params: {
        address,
        type: '15m',
        time_from: Math.floor(Date.now() / 1000) - 86400,
        time_to: Math.floor(Date.now() / 1000)
      }
    });
    
    return response.data.data.items.map(normalizeOHLCV);
  }
  
  async fetchTransactions(address: string, maxTx: number): Promise<UniversalTransaction[]> {
    const txs = await fetchBscTransactions(address, this.bscscanKey, maxTx);
    
    // Convert BscScan format to UniversalTransaction
    return txs.map(tx => ({
      hash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal)),
      type: this.detectType(tx),
      token: {
        address: tx.contractAddress,
        symbol: tx.tokenSymbol,
        decimals: parseInt(tx.tokenDecimal)
      },
      gasUsed: parseInt(tx.gasUsed),
      gasFee: (parseInt(tx.gasUsed) * parseInt(tx.gasPrice)) / 1e18
    }));
  }
  
  private detectType(tx: any): 'buy' | 'sell' | 'transfer' {
    // Logic to detect if it's a buy, sell, or transfer
    // Could check if 'from' or 'to' is a DEX contract
    return 'transfer';
  }
}
```


### Task 3.3: Add BSC Environment Variables

**File:** `.env.local`

```bash
# BSC Scanner API Key
BSCSCAN_API_KEY=<get_from_bscscan.com>
```

**Get API Key:**
1. Visit https://bscscan.com
2. Create account
3. Go to API-KEYs section
4. Generate new key (free tier: 5 requests/sec)

**Checklist:**
- [ ] Create BscScan API client
- [ ] Implement BscCollector class
- [ ] Add to CollectorFactory
- [ ] Add API key to environment
- [ ] Test with BSC token (e.g., BUSD)

---

## 🔵 Phase 4: ETH Support

### Objective
Implement Ethereum token scanning (similar to BSC)


### Task 4.1: Create Etherscan API Client

**File:** `lib/elevator/collectors/eth/etherscan.ts`

```typescript
export async function fetchEthTransactions(
  contractAddress: string,
  apiKey: string,
  maxTransactions: number = 1000
): Promise<any[]> {
  const url = 'https://api.etherscan.io/api';
  
  const response = await axios.get(url, {
    params: {
      module: 'account',
      action: 'tokentx',
      contractaddress: contractAddress,
      startblock: 0,
      endblock: 99999999,
      sort: 'desc',
      apikey: apiKey
    }
  });
  
  if (response.data.status !== '1') {
    throw new Error(response.data.message || 'Etherscan API error');
  }
  
  return response.data.result.slice(0, maxTransactions);
}
```

### Task 4.2: Create ETH Collector

**File:** `lib/elevator/collectors/eth/EthCollector.ts`

```typescript
// Similar to BscCollector but with:
// - Etherscan API instead of BscScan
// - 'ethereum' chain in Birdeye
// - ETH gas calculations
```

**Checklist:**
- [ ] Create Etherscan API client
- [ ] Implement EthCollector class
- [ ] Add to CollectorFactory
- [ ] Add ETHERSCAN_API_KEY to .env
- [ ] Test with ETH token (e.g., USDC)


---

## 🎨 Phase 5: UI Chain Selector

### Objective
Let users explicitly choose blockchain for scanning

### Task 5.1: Add Chain Selector Component

**File:** `components/ChainSelector.tsx`

```typescript
interface ChainSelectorProps {
  selected: 'solana' | 'bsc' | 'eth';
  onChange: (chain: 'solana' | 'bsc' | 'eth') => void;
}

export function ChainSelector({ selected, onChange }: ChainSelectorProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange('solana')}
        className={`px-4 py-2 rounded-lg ${
          selected === 'solana' 
            ? 'bg-purple-600 text-white' 
            : 'bg-slate-800 text-slate-400'
        }`}
      >
        Solana
      </button>
      <button
        onClick={() => onChange('bsc')}
        className={`px-4 py-2 rounded-lg ${
          selected === 'bsc' 
            ? 'bg-yellow-600 text-white' 
            : 'bg-slate-800 text-slate-400'
        }`}
      >
        BSC
      </button>
      <button
        onClick={() => onChange('eth')}
        className={`px-4 py-2 rounded-lg ${
          selected === 'eth' 
            ? 'bg-blue-600 text-white' 
            : 'bg-slate-800 text-slate-400'
        }`}
      >
        Ethereum
      </button>
    </div>
  );
}
```


### Task 5.2: Integrate into Main Page

**File:** `app/page.tsx`

```typescript
const [selectedChain, setSelectedChain] = useState<'solana' | 'bsc' | 'eth'>('solana');

// In the scan terminal section:
{scanType === 'ELEVATOR' && (
  <div className="mt-4">
    <label className="text-xs text-slate-400 mb-2 block">Select Blockchain</label>
    <ChainSelector selected={selectedChain} onChange={setSelectedChain} />
  </div>
)}

// Pass chain to API:
const res = await startElevatorScan(addr, required, selectedChain);
```

### Task 5.3: Update API to Accept Chain

**File:** `services/scannerApi.ts`

```typescript
export async function startElevatorScan(
  address: string,
  creditsSpent: number = 10,
  chain: 'solana' | 'bsc' | 'eth' = 'solana'
): Promise<{ jobId: string, status: string, rawData?: any, metadata?: any }> {
  const res = await fetch('/api/scan/elevator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, creditsSpent, chain })
  });
  // ...
}
```

**Checklist:**
- [ ] Create ChainSelector component
- [ ] Add to page.tsx
- [ ] Update API to accept chain parameter
- [ ] Update API route to use specified chain
- [ ] Test switching between chains


---

## 📂 New File Structure

```
lib/elevator/
├── collectors/
│   ├── types.ts                    # Universal interfaces
│   ├── CollectorFactory.ts         # Factory pattern
│   │
│   ├── solana/
│   │   ├── SolanaCollector.ts      # Refactored
│   │   ├── birdeye.ts             # Existing
│   │   └── helius.ts              # Existing
│   │
│   ├── bsc/
│   │   ├── BscCollector.ts        # NEW
│   │   ├── bscscan.ts             # NEW
│   │   └── birdeye.ts             # NEW (BSC version)
│   │
│   ├── eth/
│   │   ├── EthCollector.ts        # NEW
│   │   ├── etherscan.ts           # NEW
│   │   └── birdeye.ts             # NEW (ETH version)
│   │
│   ├── walletEngine.ts            # Universal (works for all chains)
│   ├── metrics.ts                 # Universal (works for all chains)
│   └── config.ts                  # Existing
│
└── utils/
    └── chainDetector.ts            # NEW

components/
└── ChainSelector.tsx               # NEW
```


---

## 🧪 Testing Strategy

### Test 1: Chain Detection
```typescript
describe('Chain Detection', () => {
  test('Detects Solana address', () => {
    const result = detectChain('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
    expect(result.chain).toBe('solana');
    expect(result.isValid).toBe(true);
  });
  
  test('Detects EVM address', () => {
    const result = detectChain('0x55d398326f99059fF775485246999027B3197955');
    expect(result.chain).toBe('eth'); // or 'bsc'
    expect(result.isValid).toBe(true);
  });
  
  test('Rejects invalid address', () => {
    const result = detectChain('invalid-address-123');
    expect(result.isValid).toBe(false);
  });
});
```

### Test 2: Solana Collector (Regression)
```bash
# Ensure refactoring didn't break existing functionality
POST /api/scan/elevator
{
  "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  "creditsSpent": 10,
  "chain": "solana"
}

Expected: Same behavior as before
```


### Test 3: BSC Collector
```bash
POST /api/scan/elevator
{
  "address": "0x55d398326f99059fF775485246999027B3197955",
  "creditsSpent": 10,
  "chain": "bsc"
}

Expected:
- Fetches OHLCV from Birdeye (BSC chain)
- Fetches transactions from BscScan
- Returns transaction table data
```

### Test 4: ETH Collector
```bash
POST /api/scan/elevator
{
  "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "creditsSpent": 10,
  "chain": "eth"
}

Expected:
- Fetches OHLCV from Birdeye (ETH chain)
- Fetches transactions from Etherscan
- Returns transaction table data
```

### Test 5: Error Handling
```bash
# Test unsupported chain
POST /api/scan/elevator
{ "address": "...", "chain": "polygon" }
Expected: 400 error with helpful message

# Test invalid address
POST /api/scan/elevator
{ "address": "invalid123" }
Expected: 400 error with validation message
```


---

## 📊 Implementation Timeline

| Phase | Tasks | Time Estimate | Priority | Dependencies |
|-------|-------|---------------|----------|--------------|
| **Phase 1** | Chain Detection | 1-2 hours | 🔴 High | None |
| **Phase 2** | Abstract Interface | 2-3 hours | 🟡 Medium | Phase 1 |
| **Phase 3** | BSC Support | 4-6 hours | 🟡 Medium | Phase 2 |
| **Phase 4** | ETH Support | 4-6 hours | 🟡 Medium | Phase 2 |
| **Phase 5** | UI Selector | 1-2 hours | 🟢 Low | Phase 3 or 4 |

**Total Estimated Time:** 12-19 hours

**Recommended Order:**
1. Start with Phase 1 (quick win, immediate UX improvement)
2. Continue to Phase 2 (enables parallel work on Phases 3 & 4)
3. Implement Phase 3 OR Phase 4 (can be done in parallel)
4. Implement Phase 5 once at least 2 chains work

---

## 🎯 Success Criteria

### Phase 1 Success
- ✅ Invalid addresses show helpful error
- ✅ Non-Solana addresses show "not supported" message
- ✅ UI shows Solana-only warning

### Phase 2 Success
- ✅ Solana collector still works (no regression)
- ✅ Abstract interface defined
- ✅ Factory pattern implemented
- ✅ Easy to add new chains


### Phase 3 Success
- ✅ BSC tokens can be scanned
- ✅ OHLCV data fetched from Birdeye
- ✅ Transactions fetched from BscScan
- ✅ Table displays BSC transaction data
- ✅ P&L calculations work for BSC

### Phase 4 Success
- ✅ ETH tokens can be scanned
- ✅ OHLCV data fetched from Birdeye
- ✅ Transactions fetched from Etherscan
- ✅ Table displays ETH transaction data
- ✅ P&L calculations work for ETH

### Phase 5 Success
- ✅ Users can select chain in UI
- ✅ Chain selector shows all supported chains
- ✅ Selected chain is passed to API
- ✅ Switching chains works smoothly

---

## 💡 Alternative Approaches

### Option A: RPC-Based (Web3.js / Ethers.js)
Instead of using BscScan/Etherscan APIs, use direct RPC calls.

**Pros:**
- No API key limits
- More control over data
- Can query any EVM chain

**Cons:**
- More complex implementation
- Need to parse raw logs
- Slower than APIs


### Option B: Multi-Chain Aggregator (Covalent, Moralis)
Use a unified API that supports multiple chains.

**Pros:**
- Single API for all chains
- Simpler implementation
- Consistent data format

**Cons:**
- Additional cost (not free)
- Dependency on third-party
- Less control

**Recommendation:** Start with Option A (BscScan/Etherscan APIs) for simplicity, 
then consider aggregators for scaling to more chains.

---

## 🔐 API Keys Required

| Service | Purpose | Free Tier | Cost | URL |
|---------|---------|-----------|------|-----|
| **Helius** | Solana txs | Yes | $0 (limited) | helius.dev |
| **Birdeye** | OHLCV (all chains) | Yes | $0 (limited) | birdeye.so |
| **BscScan** | BSC txs | Yes | $0 (5 req/sec) | bscscan.com |
| **Etherscan** | ETH txs | Yes | $0 (5 req/sec) | etherscan.io |

**Total APIs:** 4 (all have free tiers)


---

## 📋 Complete Implementation Checklist

### Phase 1: Chain Detection (1-2 hours)
- [ ] Create `lib/elevator/utils/chainDetector.ts`
  - [ ] Implement `detectChain()` function
  - [ ] Add Solana regex pattern
  - [ ] Add EVM regex pattern
  - [ ] Add validation logic
- [ ] Update `app/api/scan/elevator/route.ts`
  - [ ] Import chain detector
  - [ ] Add address validation
  - [ ] Add chain detection
  - [ ] Return helpful errors for unsupported chains
- [ ] Update `app/page.tsx`
  - [ ] Add Solana-only warning message
  - [ ] Style warning appropriately
- [ ] Test with different addresses
  - [ ] Test Solana address
  - [ ] Test BSC/ETH address (expect helpful error)
  - [ ] Test invalid address (expect validation error)

### Phase 2: Abstract Interface (2-3 hours)
- [ ] Update `lib/elevator/collectors/types.ts`
  - [ ] Define `UniversalTransaction` interface
  - [ ] Define `IBlockchainCollector` interface
  - [ ] Keep existing types for backward compatibility
- [ ] Refactor Solana code
  - [ ] Create `lib/elevator/collectors/solana/` directory
  - [ ] Move `birdeye.ts` to solana folder
  - [ ] Move `helius.ts` to solana folder
  - [ ] Create `SolanaCollector.ts` class
  - [ ] Implement `IBlockchainCollector` interface
  - [ ] Convert transactions to `UniversalTransaction` format
- [ ] Create `lib/elevator/collectors/CollectorFactory.ts`
  - [ ] Implement factory pattern
  - [ ] Add Solana case
  - [ ] Add placeholder for BSC/ETH
- [ ] Update `app/api/scan/elevator/route.ts`
  - [ ] Use `CollectorFactory.create()`
  - [ ] Pass detected chain
- [ ] Test Solana (regression test)
  - [ ] Verify no functionality broken
  - [ ] Verify data format unchanged


### Phase 3: BSC Support (4-6 hours)
- [ ] Get BscScan API key
  - [ ] Sign up at bscscan.com
  - [ ] Generate API key
  - [ ] Add to `.env.local`
- [ ] Create `lib/elevator/collectors/bsc/` directory
- [ ] Create `lib/elevator/collectors/bsc/bscscan.ts`
  - [ ] Implement `fetchBscTransactions()`
  - [ ] Handle pagination
  - [ ] Add retry logic
  - [ ] Handle rate limits
- [ ] Create `lib/elevator/collectors/bsc/birdeye.ts`
  - [ ] Copy from Solana version
  - [ ] Change `x-chain` header to `bsc`
- [ ] Create `lib/elevator/collectors/bsc/BscCollector.ts`
  - [ ] Implement `IBlockchainCollector`
  - [ ] Implement `fetchOHLCV()`
  - [ ] Implement `fetchTransactions()`
  - [ ] Implement `buildWalletData()`
  - [ ] Implement `calculateMetrics()`
  - [ ] Convert BscScan data to `UniversalTransaction`
  - [ ] Add buy/sell/transfer detection logic
- [ ] Update `CollectorFactory.ts`
  - [ ] Add BSC case
  - [ ] Import `BscCollector`
- [ ] Test with BSC token
  - [ ] Test BUSD: `0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56`
  - [ ] Test USDT: `0x55d398326f99059fF775485246999027B3197955`
  - [ ] Verify OHLCV data
  - [ ] Verify transaction data
  - [ ] Verify table display
  - [ ] Verify P&L calculations


### Phase 4: ETH Support (4-6 hours)
- [ ] Get Etherscan API key
  - [ ] Sign up at etherscan.io
  - [ ] Generate API key
  - [ ] Add to `.env.local`
- [ ] Create `lib/elevator/collectors/eth/` directory
- [ ] Create `lib/elevator/collectors/eth/etherscan.ts`
  - [ ] Implement `fetchEthTransactions()`
  - [ ] Handle pagination
  - [ ] Add retry logic
  - [ ] Handle rate limits
- [ ] Create `lib/elevator/collectors/eth/birdeye.ts`
  - [ ] Copy from Solana version
  - [ ] Change `x-chain` header to `ethereum`
- [ ] Create `lib/elevator/collectors/eth/EthCollector.ts`
  - [ ] Implement `IBlockchainCollector`
  - [ ] Same structure as BscCollector
  - [ ] Adjust for ETH gas calculations
- [ ] Update `CollectorFactory.ts`
  - [ ] Add ETH case
  - [ ] Import `EthCollector`
- [ ] Test with ETH token
  - [ ] Test USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
  - [ ] Test USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
  - [ ] Verify OHLCV data
  - [ ] Verify transaction data
  - [ ] Verify table display
  - [ ] Verify P&L calculations


### Phase 5: UI Chain Selector (1-2 hours)
- [ ] Create `components/ChainSelector.tsx`
  - [ ] Add Solana button
  - [ ] Add BSC button
  - [ ] Add ETH button
  - [ ] Add active state styling
  - [ ] Add hover effects
- [ ] Update `app/page.tsx`
  - [ ] Add `selectedChain` state
  - [ ] Import `ChainSelector`
  - [ ] Add selector to UI (below scan type)
  - [ ] Pass chain to `startElevatorScan()`
- [ ] Update `services/scannerApi.ts`
  - [ ] Add `chain` parameter to `startElevatorScan()`
  - [ ] Pass chain in request body
- [ ] Update `app/api/scan/elevator/route.ts`
  - [ ] Accept `chain` from request body
  - [ ] Use provided chain instead of auto-detection
  - [ ] Validate chain is supported
- [ ] Test UI interactions
  - [ ] Click Solana button → Solana scan works
  - [ ] Click BSC button → BSC scan works
  - [ ] Click ETH button → ETH scan works
  - [ ] Verify visual feedback
- [ ] Add chain badges to results
  - [ ] Show selected chain in results header
  - [ ] Add chain icon/logo

---

## 🎉 Final Deliverables

After all phases complete:
- ✅ 3 blockchain networks supported (Solana, BSC, ETH)
- ✅ Unified data format across all chains
- ✅ Clean abstraction (easy to add more chains)
- ✅ User-friendly chain selection
- ✅ Helpful error messages
- ✅ Comprehensive documentation


---

## 📚 Resources

### Documentation
- **Helius API:** https://docs.helius.dev/
- **Birdeye API:** https://docs.birdeye.so/
- **BscScan API:** https://docs.bscscan.com/
- **Etherscan API:** https://docs.etherscan.io/

### Example Tokens for Testing

**Solana:**
- Token: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
- USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

**BSC:**
- BUSD: 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56
- USDT: 0x55d398326f99059fF775485246999027B3197955
- CAKE: 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82

**Ethereum:**
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- USDT: 0xdAC17F958D2ee523a2206206994597C13D831ec7
- DAI: 0x6B175474E89094C44Da98b954EedeAC495271d0F

---

## ⚠️ Important Notes

1. **API Rate Limits**
   - BscScan: 5 requests/sec (free tier)
   - Etherscan: 5 requests/sec (free tier)
   - Birdeye: Varies by plan
   - Helius: Varies by plan

2. **Gas Fees**
   - BSC transactions will show BNB gas fees
   - ETH transactions will show ETH gas fees
   - Solana transactions show SOL fees

3. **Transaction Types**
   - Auto-detecting buy/sell is complex
   - May need DEX router addresses
   - Consider starting with "transfer" type only


4. **Decimal Handling**
   - Each token has different decimals
   - Must divide by 10^decimals
   - Birdeye returns normalized prices

5. **Transaction History Depth**
   - Free API tiers may limit history depth
   - Consider implementing date ranges
   - May need pagination for large wallets

---

## 🚀 Getting Started

### Immediate Next Steps (Phase 1)

1. **Create chain detector:**
   ```bash
   # Create new file
   touch lib/elevator/utils/chainDetector.ts
   ```

2. **Implement detection logic:**
   - Copy regex patterns from plan
   - Add validation function
   - Export interface

3. **Update API route:**
   - Import detector
   - Add validation
   - Return helpful errors

4. **Test:**
   ```bash
   npm run dev
   # Try scanning with ETH address
   # Should see "EVM not yet supported" error
   ```

**Estimated Time:** 1 hour  
**Difficulty:** Easy  
**Impact:** Immediate UX improvement

---

**End of Implementation Plan**

**Total Pages:** This comprehensive plan  
**Total Phases:** 5 phases  
**Total Time:** 12-19 hours  
**Files to Create:** ~15 new files  
**Files to Modify:** ~5 existing files

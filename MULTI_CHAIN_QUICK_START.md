# Multi-Chain Support - Quick Start Guide

**Goal:** Add BSC and ETH support to Elevator Scan  
**Current:** Solana only  
**Timeline:** 12-19 hours total

---

## 🎯 Implementation Phases

### ⚡ Phase 1: Chain Detection (1-2 hours) - START HERE
**Priority:** 🔴 Critical  
**Impact:** Immediate UX improvement

**What to do:**
1. Create `lib/elevator/utils/chainDetector.ts`
2. Add address validation regex
3. Update API to reject non-Solana addresses with helpful message
4. Add UI warning: "Solana only for now"

**Result:** Users see clear error instead of 500 timeout

---

### 🏗️ Phase 2: Abstract Interface (2-3 hours)
**Priority:** 🟡 High  
**Impact:** Enables multi-chain support

**What to do:**
1. Define `IBlockchainCollector` interface
2. Refactor Solana code into `SolanaCollector` class
3. Create `CollectorFactory` pattern
4. Define `UniversalTransaction` format

**Result:** Clean architecture ready for BSC/ETH

---

### 🟡 Phase 3: Add BSC (4-6 hours)
**Priority:** 🟢 Medium

**What to do:**
1. Get BscScan API key (free)
2. Create `BscCollector` class
3. Implement BscScan transaction fetching
4. Test with BSC tokens

**Result:** BSC tokens can be scanned

---

### 🔵 Phase 4: Add ETH (4-6 hours)
**Priority:** 🟢 Medium

**What to do:**
1. Get Etherscan API key (free)
2. Create `EthCollector` class (similar to BSC)
3. Implement Etherscan transaction fetching
4. Test with ETH tokens

**Result:** ETH tokens can be scanned

---

### 🎨 Phase 5: UI Chain Selector (1-2 hours)
**Priority:** 🟢 Low

**What to do:**
1. Create chain selector buttons (SOL/BSC/ETH)
2. Add to main page
3. Pass selected chain to API

**Result:** Users can choose blockchain

---

## 🚦 Start With Phase 1 (Easy Win)

**File:** `lib/elevator/utils/chainDetector.ts`

```typescript
export function detectChain(address: string) {
  // EVM (BSC/ETH)
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { chain: 'eth', isValid: true };
  }
  
  // Solana
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { chain: 'solana', isValid: true };
  }
  
  return { chain: 'unknown', isValid: false };
}
```

**Update:** `app/api/scan/elevator/route.ts`

```typescript
const detection = detectChain(address);

if (detection.chain !== 'solana') {
  return NextResponse.json({
    error: 'Chain not supported yet',
    details: 'Elevator scan currently supports Solana only. BSC/ETH coming soon!'
  }, { status: 400 });
}
```

**Test:** Try scanning BSC address → See helpful error ✅

---

## 📊 Progress Tracking

- [ ] Phase 1: Chain Detection (1-2h)
- [ ] Phase 2: Abstract Interface (2-3h)
- [ ] Phase 3: BSC Support (4-6h)
- [ ] Phase 4: ETH Support (4-6h)
- [ ] Phase 5: UI Selector (1-2h)

**Total:** 12-19 hours

---

## 🔑 API Keys Needed

| Service | Purpose | Free? | URL |
|---------|---------|-------|-----|
| Helius | Solana txs | ✅ Yes | helius.dev |
| Birdeye | OHLCV | ✅ Yes | birdeye.so |
| BscScan | BSC txs | ✅ Yes | bscscan.com |
| Etherscan | ETH txs | ✅ Yes | etherscan.io |

All have free tiers!

---

**Full Details:** See `ELEVATOR_MULTI_CHAIN_IMPLEMENTATION_PLAN.md`

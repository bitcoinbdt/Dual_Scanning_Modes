# Environment Variables Setup Guide

**For:** Elevator Scan Multi-Chain Support  
**Updated:** Phase 4 Complete (Solana + BSC + Ethereum)

---

## 📋 Required API Keys

### 1. Birdeye API (Required for ALL chains)
**Purpose:** OHLCV (price candle) data  
**Used by:** Solana, BSC, ETH collectors  
**Free Tier:** Yes (with limits)

**How to get:**
1. Visit: https://birdeye.so
2. Sign up for account
3. Navigate to API section
4. Generate API key
5. Copy key

**Add to `.env.local`:**
```bash
BIRDEYE_API_KEY=your_birdeye_key_here
```

---

### 2. Helius API (Required for Solana)
**Purpose:** Solana transaction data  
**Used by:** SolanaCollector only  
**Free Tier:** Yes (with limits)

**How to get:**
1. Visit: https://helius.dev
2. Sign up for account
3. Create new project
4. Generate API key
5. Copy key

**Add to `.env.local`:**
```bash
HELIUS_API_KEY=your_helius_key_here
```

---

### 3. BscScan API (Required for BSC) ✨ NEW
**Purpose:** BSC (Binance Smart Chain) transaction data  
**Used by:** BscCollector only  
**Free Tier:** Yes (5 req/sec, 10k txs per request)

**How to get:**
1. Visit: https://bscscan.com
2. Sign up for free account
3. Go to: My Account → API-KEYs
4. Click "Add" to create new API key
5. Copy the generated key

**Add to `.env.local`:**
```bash
BSCSCAN_API_KEY=your_bscscan_key_here
```

---

### 4. Etherscan API (Required for ETH) ✅ NEW
**Purpose:** Ethereum transaction data  
**Used by:** EthCollector  
**Free Tier:** Yes (5 req/sec, 100k requests/day)

**How to get:**
1. Visit: https://etherscan.io
2. Sign up for free account
3. Go to: My Account → API-KEYs
4. Generate new API key
5. Copy key

**Add to `.env.local`:**
```bash
ETHERSCAN_API_KEY=your_etherscan_key_here
```

---

## 📝 Complete `.env.local` Template

```bash
# ===========================================
# Environment Variables for OnChain Scanner
# ===========================================

# Backend API URL
NEXT_PUBLIC_BACKEND_URL=https://dual-scanning-modes.onrender.com

# Solana Treasury Wallet Address
NEXT_PUBLIC_TREASURY_WALLET="49nAGueHXos8Ry2tn3NYLMAidgaQQQ4tHFUwAhZygYM5"

# ===========================================
# Supabase Configuration
# ===========================================
NEXT_PUBLIC_SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbnBpZm90eW96ZWluYXRweWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMDE5NDgsImV4cCI6MjEwMDY3Nzk0OH0.GOJnlmDicfUU-LKGSafjA-VDXi4UeJGhTKid3dzHTmM

# ===========================================
# Elevator Scan API Keys (Server-side only)
# ===========================================

# Birdeye API - For OHLCV (price candle) data (ALL CHAINS)
BIRDEYE_API_KEY=your_birdeye_key_here

# Helius API - For Solana transaction data
HELIUS_API_KEY=your_helius_key_here

# BscScan API - For BSC transaction data
BSCSCAN_API_KEY=your_bscscan_key_here

# Etherscan API - For Ethereum transaction data ✅ NEW
ETHERSCAN_API_KEY=your_etherscan_key_here

# ===========================================
# NOTES:
# ===========================================
# 1. All variables starting with NEXT_PUBLIC_ are exposed to the browser
# 2. NEVER expose sensitive keys like service_role_key in frontend
# 3. The anon key is safe - it has limited permissions (Row Level Security)
# 4. Elevator scan API keys are server-side only (not exposed)
# 5. Get Birdeye, Helius, BscScan keys from their respective websites
```

---

## 🔒 Security Notes

### Public vs Private Keys

**Public (NEXT_PUBLIC_*):**
- ✅ Safe to expose in browser
- Used for frontend API calls
- Has limited permissions

**Private (no prefix):**
- ❌ Never expose to browser
- Server-side only
- Full permissions

### Elevator Scan Keys
All Elevator scan API keys are **private**:
- `BIRDEYE_API_KEY` ❌ Private
- `HELIUS_API_KEY` ❌ Private
- `BSCSCAN_API_KEY` ❌ Private
- `ETHERSCAN_API_KEY` ❌ Private

These are only accessible in API routes, never in browser!

---

## ✅ Setup Checklist

### Phase 1: Basic Setup
- [ ] Copy `.env.local.template` to `.env.local`
- [ ] Update Supabase credentials
- [ ] Update Treasury wallet address

### Phase 2: Solana Support
- [ ] Get Birdeye API key
- [ ] Get Helius API key
- [ ] Add both to `.env.local`
- [ ] Test with Solana token

### Phase 3: BSC Support
- [ ] Get BscScan API key
- [ ] Add to `.env.local`
- [ ] Restart dev server
- [ ] Test with BSC token

### Phase 4: Ethereum Support ✅
- [ ] Get Etherscan API key
- [ ] Add to `.env.local`
- [ ] Restart dev server
- [ ] Test with ETH token

---

## 🧪 Verification

### Check if Keys are Working

**Start server:**
```bash
npm run dev
```

**Test each chain:**
1. **Solana:** Enter `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`
2. **BSC:** Enter `0x55d398326f99059fF775485246999027B3197955`
3. **ETH:** Enter `0xdAC17F958D2ee523a2206206994597C13D831ec7` (USDT)

**Expected:**
- ✅ Scan proceeds (may fail at data fetch if key invalid)
- ❌ "API keys not configured" = Key missing

**Console logs:**
```
[API] Missing API keys: { birdeye: true, helius: false }
```
This means Helius key is missing!

---

## ⚠️ Common Issues

### Issue 1: "API keys not configured"
**Solution:** Check `.env.local` has the key  
**Verify:** Key exists and no typos

### Issue 2: "401 Unauthorized"
**Solution:** API key is invalid  
**Action:** Generate new key from provider

### Issue 3: "Rate limit exceeded"
**Solution:** Free tier limit reached  
**Options:**
- Wait a few minutes
- Upgrade to paid tier
- Use different API key

### Issue 4: Keys not loading
**Solution:** Restart dev server  
**Command:** Stop and run `npm run dev` again

---

## 📊 API Rate Limits (Free Tiers)

| Service | Rate Limit | Max per Request |
|---------|------------|-----------------|
| **Birdeye** | Varies | N/A |
| **Helius** | Varies | 100 |
| **BscScan** | 5/sec | 10,000 |
| **Etherscan** | 5/sec | 10,000 |

**Tip:** Rate limits are per API key, not per user!

---

## 💡 Best Practices

1. **Never commit `.env.local`** to Git
   - Already in `.gitignore`
   - Keep keys secret

2. **Use separate keys for dev/prod**
   - Development keys for testing
   - Production keys for live site

3. **Rotate keys periodically**
   - Generate new keys every few months
   - Update `.env.local`

4. **Monitor usage**
   - Check API dashboards
   - Stay within free tier limits

5. **Keep backups**
   - Save keys securely
   - Use password manager

---

## 🎯 Current Status

### Implemented Chains
- ✅ **Solana** - Requires: Birdeye + Helius
- ✅ **BSC** - Requires: Birdeye + BscScan
- ✅ **Ethereum** - Requires: Birdeye + Etherscan

### Required Keys by Phase
- **Phase 1-2:** 2 keys (Birdeye, Helius)
- **Phase 3:** 3 keys (+ BscScan)
- **Phase 4:** 4 keys (+ Etherscan) ✅ COMPLETE

---

## 📞 Help & Support

### API Provider Support

**Birdeye:**
- Docs: https://docs.birdeye.so
- Discord: Check their website

**Helius:**
- Docs: https://docs.helius.dev
- Discord: Check their website

**BscScan:**
- Docs: https://docs.bscscan.com
- Support: support@bscscan.com

**Etherscan:**
- Docs: https://docs.etherscan.io
- Support: support@etherscan.io

---

**Last Updated:** Phase 4 Complete  
**Keys Required:** 4 (Birdeye, Helius, BscScan, Etherscan)  
**Chains Supported:** 3 (Solana, BSC, Ethereum)

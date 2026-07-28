# 🚀 Quick Start: Elevator Scan Testing

**Status:** ✅ Ready to Test  
**Time Required:** 5 minutes  
**Prerequisites:** Dev server running, logged-in user

---

## ✅ Pre-Flight Checklist

Before testing, verify:
- [x] All TypeScript files compiled without errors
- [x] API keys added to `.env.local`
- [x] 18 new files created + 2 modified
- [x] No console errors when loading page

---

## 🎯 3-Step Quick Test

### Step 1: Start Server
```bash
npm run dev
```

Expected: Server starts on `http://localhost:5176`

### Step 2: Access App
1. Open browser: `http://localhost:5176`
2. Login with your account
3. You should see the home page with scan terminal

### Step 3: Run Elevator Scan
1. Enter token address:
   ```
   DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
   ```
2. Click **"Elevator Deep Scan"** button (blue button with database icon)
3. Click **"Scan Token"**
4. Wait 15-30 seconds

---

## ✅ What to Expect

### Console Output
You should see logs like:
```
[COLLECTOR] Starting collection for DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
[COLLECTOR] Max transactions: 50
[STEP 1/4] Fetching OHLCV from Birdeye...
✅ Fetched 96 OHLCV candles
[STEP 2/4] Fetching transactions from Helius...
[Helius] Fetching transactions for DezXAZ8z7...
[Helius] Fetching batch (total: 0)...
✅ Fetched 50 transactions
[STEP 3/4] Building wallet balances...
✅ Processed 40 wallets, 25 holders
[STEP 4/4] Calculating metrics...
✅ Metrics: RF17=false, W5=25
[COLLECTOR] Collection complete!
```

### UI Output
You should see:
1. **Loading state** (15-30 seconds)
2. **Success toast**: "Loaded 50 transactions from 25 holders"
3. **Raw Transaction Table** with 6 columns:
   - Time
   - Wallet (with copy icon)
   - Action (BUY/SELL/TRANSFER badge)
   - Amount
   - Tx Hash (link to Solscan)
   - P&L (🟢/🔴/⚪ indicator)

---

## 🧪 What to Test

### Basic Functionality
- [ ] Table displays all transactions
- [ ] Time column shows readable dates
- [ ] Wallet addresses are shortened (8 chars)
- [ ] Click wallet to copy address
- [ ] Action badges show correct colors (green/red/purple)
- [ ] Amount shows decimal numbers
- [ ] Tx Hash links to Solscan
- [ ] P&L indicators show (🟢/🔴/⚪)

### Sorting
Click column headers to sort:
- [ ] Time (newest first / oldest first)
- [ ] Amount (highest first / lowest first)
- [ ] P&L (most profit / most loss)

### Filtering
Click filter buttons above table:
- [ ] ALL - Shows all transactions
- [ ] BUY - Shows only BUY transactions
- [ ] SELL - Shows only SELL transactions
- [ ] PROFIT - Shows only 🟢 profit wallets
- [ ] LOSS - Shows only 🔴 loss wallets

### Pagination
- [ ] If >50 transactions, pagination appears
- [ ] Click "Next" to go to page 2
- [ ] Click "Previous" to go back

### Hover Tooltips
- [ ] Hover over P&L indicator
- [ ] Tooltip shows:
  - Entry Price
  - Current Price
  - Total Invested
  - Current Value
  - Net P&L
  - P&L %

---

## 🐛 Troubleshooting

### Error: "API keys not configured"
**Fix:** Check `.env.local` has both keys:
```bash
BIRDEYE_API_KEY=cd1a205cea234cf4ae8dcbf58b15088c
HELIUS_API_KEY=e203a6a1-045d-4662-bc9a-1569ed5b6f61
```

### Error: "No transactions found"
**Fix:** Try a different token. The test token should work, but if not:
- Make sure it's a Solana token
- Make sure it has trading history
- Try: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (USDC - guaranteed to work)

### Error: "Request timeout"
**Fix:** Token has too many transactions. Wait longer or try with fewer credits.

### No console logs appearing
**Fix:** 
1. Open browser DevTools (F12)
2. Go to Console tab
3. Refresh page and try again

### Table not displaying
**Fix:**
1. Check browser console for errors
2. Verify `elevatorData` state is set
3. Check network tab for API response

---

## 🎯 Success Criteria

You've successfully tested if:
- ✅ Console shows all 4 steps completing
- ✅ Table displays with transaction data
- ✅ P&L indicators are visible (🟢/🔴/⚪)
- ✅ Sorting works for at least one column
- ✅ Filtering works for at least one filter
- ✅ Wallet copy works
- ✅ Tx Hash link works
- ✅ Hover tooltip shows P&L details

---

## 📊 Test Different Credit Amounts

To test different credit tiers, you can temporarily modify the credit cost:

**File:** `app/page.tsx`

Find this line (around line 20):
```typescript
const SCAN_COSTS = { BASIC: 1, ELEVATOR: 10 };
```

Change to test different tiers:
```typescript
// Test 50 transactions (10 credits)
const SCAN_COSTS = { BASIC: 1, ELEVATOR: 10 };

// Test 200 transactions (25 credits)
const SCAN_COSTS = { BASIC: 1, ELEVATOR: 25 };

// Test 1000 transactions (50 credits)
const SCAN_COSTS = { BASIC: 1, ELEVATOR: 50 };

// Test 5000 transactions (100 credits)
const SCAN_COSTS = { BASIC: 1, ELEVATOR: 100 };
```

**Note:** More transactions = longer wait time (up to 60 seconds)

---

## 📸 Expected Visual Result

```
┌─────────────────────────────────────────────────────────────┐
│              Raw Transaction Data & P&L Analysis             │
├─────────────────────────────────────────────────────────────┤
│ [ALL] [BUY] [SELL] [PROFIT] [LOSS]                          │
├──────┬──────────┬────────┬─────────┬──────────┬─────────────┤
│ Time │ Wallet   │ Action │ Amount  │ Tx Hash  │ P&L         │
├──────┼──────────┼────────┼─────────┼──────────┼─────────────┤
│ 2h   │ 8Kq3b... │  BUY   │ 1,234.5 │ FjKs2... │ 🟢 +$45.23  │
│ 3h   │ mNx7f... │  SELL  │   523.1 │ 9Lmp4... │ 🔴 -$12.50  │
│ 4h   │ pWe9v... │  BUY   │   892.7 │ kJh3n... │ ⚪  $0.00    │
└──────┴──────────┴────────┴─────────┴──────────┴─────────────┘
Page 1 of 1                                          [<] [>]
```

---

## 🔍 What Each Element Means

| Element | Meaning |
|---------|---------|
| 🟢 +$X | Wallet is in profit (current value > buy price) |
| 🔴 -$X | Wallet is at loss (current value < buy price) |
| ⚪ $0 | Wallet broke even (current value ≈ buy price) |
| BUY badge (green) | Wallet bought tokens |
| SELL badge (red) | Wallet sold tokens |
| TRANSFER badge (purple) | Token transfer between wallets |

---

## 📝 Test Checklist

### Before Testing
- [ ] Server running (`npm run dev`)
- [ ] Logged into app
- [ ] Console tab open in DevTools

### During Test
- [ ] Enter test token address
- [ ] Click "Elevator Deep Scan"
- [ ] Wait for collection to complete
- [ ] Observe console logs
- [ ] Check UI displays table

### After Test
- [ ] Verify transaction count matches console
- [ ] Test all sorting options
- [ ] Test all filter options
- [ ] Test wallet copy functionality
- [ ] Test Tx Hash links
- [ ] Hover over P&L to see tooltip
- [ ] Check responsive design (resize window)

---

## 🎉 Next Steps

If everything works:
1. ✅ Mark Phase 3 as complete
2. 📝 Document any issues found
3. 🚀 Deploy to production (optional)
4. 📊 Monitor real usage
5. 🔍 Gather user feedback

---

## 📞 Need Help?

**Check Documentation:**
- `ELEVATOR_SCAN_COMPLETE_SUMMARY.md` - Overview
- `ELEVATOR_BACKEND_COMPLETE.md` - Backend details
- `ELEVATOR_UI_IMPLEMENTATION_COMPLETE.md` - UI details
- `ELEVATOR_IMPLEMENTATION_CHECKLIST.md` - Full checklist

**Common Issues:**
1. No data showing → Check console for errors
2. P&L not calculated → Check DexScreener API response
3. Sorting not working → Check browser console
4. Slow loading → Token has many transactions

---

**🎯 Ready? Run `npm run dev` and start testing!**

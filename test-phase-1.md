# Phase 1 Testing Guide

**Quick test commands to verify Phase 1 implementation**

---

## 🚀 Start Server

```bash
npm run dev
```

Wait for: `✓ Ready in X.Xs`

---

## 🧪 Manual Tests

### Test 1: Solana Address (Should Pass Validation)
1. Open http://localhost:5176
2. Login
3. Select "Elevator Deep Scan"
4. **Verify:** Blue warning banner appears
5. Enter: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`
6. Click "Scan"
7. **Expected:** Proceeds to scan (may fail at Helius, that's OK)

### Test 2: BSC Address (Should Reject with Helpful Error)
1. Stay on same page
2. Enter: `0x55d398326f99059fF775485246999027B3197955`
3. Click "Scan"
4. **Expected:** 
   - Error appears quickly (<1 second)
   - Message says "Blockchain not supported"
   - Mentions EVM/BSC not yet supported

### Test 3: Invalid Address (Should Reject)
1. Enter: `invalid-address-123`
2. Click "Scan"
3. **Expected:**
   - Error appears quickly
   - Message says "Invalid token address"

### Test 4: UI Warning Banner
1. Select "Basic Scan"
2. **Expected:** Warning banner disappears
3. Select "Elevator Deep Scan"
4. **Expected:** Warning banner reappears

---

## ✅ Success Checklist

- [ ] Warning banner shows for Elevator scan
- [ ] Warning banner hides for Basic scan
- [ ] Solana address passes validation
- [ ] BSC address shows helpful error
- [ ] Invalid address shows helpful error
- [ ] Errors appear quickly (no timeout)
- [ ] Error messages are clear and helpful

---

## 🔍 Check Console Logs

Open browser DevTools (F12) → Console tab

**For Solana address:**
```
[API] Chain detection: {
  chain: 'solana',
  isValid: true,
  format: 'Solana',
  message: 'Solana address detected'
}
```

**For BSC address:**
```
[API] Chain detection: {
  chain: 'eth',
  isValid: true,
  format: 'EVM (Ethereum/BSC)',
  message: 'EVM address detected'
}
```

---

## 📊 Expected Results

| Test | Input | Expected | Time |
|------|-------|----------|------|
| Solana | `DezXAZ8...` | ✅ Pass | Instant |
| BSC | `0x55d39...` | ❌ Error | <1s |
| ETH | `0xdAC17...` | ❌ Error | <1s |
| Invalid | `invalid...` | ❌ Error | <1s |

---

## 🎉 If All Tests Pass

Phase 1 is **complete and working**! You've successfully:

✅ Added chain detection  
✅ Improved error messages  
✅ Added UI warnings  
✅ Validated addresses early  

**Ready for:** Phase 2 implementation (when ready)

---

**Report any issues in:** Issue tracker or documentation

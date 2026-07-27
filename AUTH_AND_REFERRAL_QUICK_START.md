# 🚀 Authentication & Referral System - Quick Start Guide

## What This Does

Connects your existing signup/login UI and referral system UI to Supabase and Render backend, making them fully functional with real data.

---

## ⏱️ Time Required

**Total:** 2-3 hours  
**Minimum Viable:** 1 hour (just database + basic API)

---

## 📋 Prerequisites

- ✅ Supabase project created
- ✅ Render backend deployed (NestJS)
- ✅ Frontend deployed on Vercel
- ✅ Environment variables configured

---

## 🎯 5-Step Implementation

### Step 1: Set Up Supabase Tables (30 min)

1. Open Supabase Dashboard → SQL Editor
2. Open `AUTH_AND_REFERRAL_BACKEND_PLAN.md`
3. Copy **Phase 1** SQL (all 4 tables)
4. Paste and execute in SQL Editor
5. Verify tables created in Table Editor

**Tables to create:**
- `user_profiles`
- `referral_codes`  
- `referrals`
- `referral_rewards`
- `credit_transactions`

### Step 2: Add Database Functions (20 min)

1. Still in SQL Editor
2. Copy **Phase 2** SQL (all 3 functions)
3. Execute:
   - `generate_referral_code()`
   - `handle_new_user()` trigger
   - `apply_referral_code()`
   - `award_referral_bonus()`

**Test:** Sign up a test user → Check if referral code generated

### Step 3: Update Backend API (40 min)

1. SSH/Connect to Render backend
2. Install Supabase: `npm install @supabase/supabase-js`
3. Create files from **Phase 3**:
   - `src/auth/auth.guard.ts`
   - `src/referral/referral.controller.ts`
   - `src/referral/referral.service.ts`
4. Update credit purchase endpoint
5. Add environment variables to Render
6. Deploy

**Test with curl:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://dual-scanning-modes.onrender.com/api/referral/code
```

### Step 4: Update Frontend (20 min)

1. Remove mock data from `services/referralApi.ts`
2. Update `contexts/AuthContext.tsx`:
   - Store JWT token in localStorage
   - Auto-apply referral code on signup
3. Deploy to Vercel

**Files to update:**
- `services/referralApi.ts` (remove try-catch mock fallback)
- `contexts/AuthContext.tsx` (add token storage)

### Step 5: Test End-to-End (30 min)

**Test Signup Flow:**
```
1. Go to app → Click Sign Up
2. Enter email, password, name → Submit
3. Check Supabase → user_profiles row created?
4. Check → referral_codes row created?
5. Go to /referrals → See your code?
```

**Test Referral Flow:**
```
1. Copy your referral link (e.g., /?ref=ABC-DEF-GH12)
2. Open incognito window → Paste link
3. Sign up new account
4. Go to /credits → Referral code auto-filled?
5. Click Apply → Success message?
```

**Test Purchase Flow:**
```
1. Stay logged in as referred user
2. Buy credits (any package)
3. Check Supabase referral_rewards table
4. Check referrer's credit_transactions
5. Check referrer's balance increased?
```

---

## 🔧 Environment Variables Checklist

### Backend (Render)

```env
✅ SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co
✅ SUPABASE_ANON_KEY=eyJhbGci...
✅ SUPABASE_SERVICE_ROLE_KEY=<get from Supabase>
✅ FRONTEND_URL=https://yourapp.vercel.app
✅ TREASURY_WALLET=49nAGueHXos8Ry2tn3NYLMAidgaQQQ4tHFUwAhZygYM5
```

### Frontend (Vercel)

```env
✅ NEXT_PUBLIC_BACKEND_URL=https://dual-scanning-modes.onrender.com
✅ NEXT_PUBLIC_TREASURY_WALLET=49nAGueHXos8Ry2tn3NYLMAidgaQQQ4tHFUwAhZygYM5
✅ NEXT_PUBLIC_SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 🧪 Quick Test Commands

### Test Database Function

```sql
-- In Supabase SQL Editor
SELECT * FROM referral_codes;

-- Generate a test code
SELECT generate_referral_code();

-- Test apply function
SELECT apply_referral_code(
  'YOUR_USER_ID'::uuid,
  'ABC-DEF-GH12'
);
```

### Test Backend API

```bash
# Get referral code
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://dual-scanning-modes.onrender.com/api/referral/code

# Apply referral code
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"ABC-DEF-GH12"}' \
  https://dual-scanning-modes.onrender.com/api/referral/apply
```

---

## 🐛 Common Issues & Fixes

### Issue: "Invalid or expired token"
**Fix:** Check if `localStorage.getItem('authToken')` exists

### Issue: "Referral code not generated"
**Fix:** Verify `handle_new_user()` trigger exists and is active

### Issue: "Bonus not awarded"
**Fix:** Check if purchase endpoint calls `awardReferralBonus()`

### Issue: "RLS policy error"
**Fix:** Verify all RLS policies are created (check SQL in Phase 1)

---

## ✅ Success Checklist

After implementation, verify:

- [ ] New users auto-generate referral codes
- [ ] Referral dashboard shows real code (not DEV-MOC-K123)
- [ ] URL parameter `?ref=CODE` captures code
- [ ] Referral code can be applied before first purchase
- [ ] First purchase awards bonus to referrer
- [ ] Referral history displays real data
- [ ] Stats update correctly (total referrals, earned credits)
- [ ] Error messages work (invalid code, self-referral, etc.)
- [ ] All API requests authenticated with JWT
- [ ] No console errors in browser

---

## 📂 Files to Create/Update

### Backend (Create New)
```
src/
├── auth/
│   └── auth.guard.ts          [CREATE]
├── referral/
│   ├── referral.controller.ts [CREATE]
│   ├── referral.service.ts    [CREATE]
│   └── referral.module.ts     [CREATE]
└── credits/
    └── credits.controller.ts  [UPDATE - add referral logic]
```

### Frontend (Update Existing)
```
services/
└── referralApi.ts             [UPDATE - remove mocks]

contexts/
└── AuthContext.tsx            [UPDATE - add token storage]
```

---

## 🎯 Priority Order

**If you have limited time, implement in this order:**

1. **Phase 1 (Critical):** Database tables
2. **Phase 2 (Critical):** Database functions (especially trigger)
3. **Phase 3 (High):** Backend API endpoints
4. **Phase 4 (Medium):** Frontend updates
5. **Phase 6 (Low):** Comprehensive testing
6. **Email notifications:** Optional (Phase 8)

**Minimum Viable Product:** Phases 1-4 only (1 hour)

---

## 🚀 Ready to Start?

1. Open `AUTH_AND_REFERRAL_BACKEND_PLAN.md`
2. Start with **Phase 1: Supabase Database Setup**
3. Follow each phase sequentially
4. Test after each phase
5. Deploy when all tests pass

**Need help?** All SQL and code samples are in the main plan document!

---

**Good luck! 🎉 You're about to bring your referral system to life!**

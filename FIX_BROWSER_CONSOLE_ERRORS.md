# Fix Browser Console Errors - Quick Guide

## 🔴 Errors You're Seeing:

1. ❌ CORS errors trying to reach `dual-scanning-modes.onrender.com`
2. ❌ Backend API not available messages
3. ❌ "No referral code found in database" error
4. ❌ 406 error from Supabase

## ✅ Solutions:

### Step 1: Update Vercel Environment Variables

Go to your Vercel dashboard:
1. Open your project: **dual-scanning-modes.vercel.app**
2. Go to **Settings** → **Environment Variables**
3. Find or add: `NEXT_PUBLIC_BACKEND_URL`
4. **Leave it EMPTY** (no value) or delete it
5. Click **Save**
6. **Redeploy** your site

This will stop the CORS errors because the app won't try to reach the backend.

### Step 2: Run Complete Database Setup

The referral code trigger is missing. You need to run the complete database setup:

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Run this file: `COMPLETE_DATABASE_SETUP.sql`
4. Wait for completion (takes ~30 seconds)

This will create:
- ✅ Referral codes table
- ✅ Referral trigger (auto-creates code on signup)
- ✅ User profiles table
- ✅ Credits system
- ✅ All necessary triggers and functions

### Step 3: Verify the Setup

After running the SQL, verify in Supabase:

**Check Tables Exist:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'user_profiles',
  'referral_codes',
  'referrals',
  'payment_methods',
  'credit_purchase_requests'
);
```

**Check Trigger Exists:**
```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

### Step 4: Test the System

1. **Sign up a new test user**
2. **Check if referral code was created:**
   ```sql
   SELECT * FROM referral_codes ORDER BY created_at DESC LIMIT 5;
   ```
3. **Go to `/referrals` page**
4. **Should see your referral code** (no more errors)

---

## 🎯 Why These Errors Happen:

### Backend API Errors (CORS):
- Your app is trying to reach `dual-scanning-modes.onrender.com`
- But the backend isn't deployed there
- Solution: Remove the backend URL from environment variables

### Referral Code Not Found:
- The database trigger `on_auth_user_created` isn't installed
- When users sign up, no referral code is auto-created
- Solution: Run `COMPLETE_DATABASE_SETUP.sql`

### 406 Error from Supabase:
- The `referral_codes` table might not exist
- Or the query format is wrong
- Solution: Run complete database setup to create all tables

---

## 📋 Quick Checklist:

- [ ] Remove `NEXT_PUBLIC_BACKEND_URL` from Vercel environment variables
- [ ] Redeploy the site on Vercel
- [ ] Run `COMPLETE_DATABASE_SETUP.sql` in Supabase SQL Editor
- [ ] Verify tables and triggers exist
- [ ] Sign up a test user
- [ ] Check `/referrals` page works without errors

---

## 🔍 Expected Console Output (After Fix):

```
✅ [SSE] Backend not deployed. Event bus disabled.
✅ 💡 Backend API not available. Using Supabase and local data.
✅ 💡 Referral API using Supabase fallback.
```

No CORS errors, no 406 errors, no "referral code not found" errors!

---

## 🚨 Common Mistakes:

1. **Not redeploying after changing environment variables**
   - Always redeploy after changing Vercel env vars

2. **Running only MANUAL_CREDIT_SYSTEM.sql**
   - You need COMPLETE_DATABASE_SETUP.sql for full functionality
   - Or run both files

3. **Forgetting to verify triggers**
   - Always check if triggers are installed and enabled

---

## 💡 Pro Tips:

**For Development:**
- Use `.env.local` for local testing
- Keep `NEXT_PUBLIC_BACKEND_URL` empty

**For Production:**
- Set environment variables in Vercel dashboard
- Never commit `.env.local` to git (already in .gitignore)

**For Database:**
- Run `COMPLETE_DATABASE_SETUP.sql` once
- Then run `MANUAL_CREDIT_SYSTEM.sql` if you want manual credit verification
- Or just run COMPLETE_DATABASE_SETUP.sql (it has everything)

---

## 📞 If Errors Persist:

1. **Clear browser cache** (Ctrl + Shift + Delete)
2. **Hard refresh** (Ctrl + F5)
3. **Check Vercel deployment logs** for build errors
4. **Check Supabase logs** for database errors
5. **Verify RLS policies** are enabled

---

## ✅ Success Indicators:

After applying all fixes, you should see:

- ✅ No CORS errors in console
- ✅ Referral page loads without errors
- ✅ Referral code displays correctly
- ✅ Credit packages load successfully
- ✅ Admin panel accessible (if logged in as admin@anamul.com)

---

**All Done! 🎉**

Your app should now work perfectly without any console errors.

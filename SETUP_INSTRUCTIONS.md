# 🚀 Setup Instructions - Do This Now!

## ✅ Phase 1 & 2: Supabase Database (5 minutes)

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: **sanpifotyozeinatpyki**
3. Click **SQL Editor** in left sidebar

### Step 2: Run Database Tables

1. Open file: `supabase-setup/00-RUN-ALL-TABLES.sql`
2. Copy ALL contents
3. Paste in Supabase SQL Editor
4. Click **Run** button
5. Wait ~5 seconds
6. You should see success message and verification queries

**Expected Result:**
```
✅ 5 tables created
✅ Row Level Security enabled
✅ Multiple policies created
```

### Step 3: Run Database Functions

1. Open file: `supabase-setup/10-RUN-ALL-FUNCTIONS.sql`
2. Copy ALL contents
3. Paste in Supabase SQL Editor
4. Click **Run** button
5. Wait ~3 seconds
6. You should see functions created and sample referral code generated

**Expected Result:**
```
✅ 4 functions created
✅ 1 trigger created
✅ Sample code: ABC-DEF-GH12 (or similar)
```

### Step 4: Test the Setup

Create a test user to verify everything works:

1. Go to **Authentication → Users** in Supabase Dashboard
2. Click **Add User**
3. Email: `test@example.com`
4. Password: `test123456`
5. Click **Create User**

Then run this query in SQL Editor:

```sql
-- Check if profile and referral code were auto-created
SELECT 
  up.email,
  up.display_name,
  rc.code as referral_code,
  rc.total_referrals,
  rc.total_earned_credits
FROM public.user_profiles up
JOIN public.referral_codes rc ON rc.user_id = up.id
WHERE up.email = 'test@example.com';
```

**Expected Result:**
```
✅ 1 row with email and a referral code like ABC-DEF-GH12
```

---

## ✅ What Was Just Created

### 5 Database Tables:
- ✅ `user_profiles` - Extended user data
- ✅ `referral_codes` - Unique codes per user
- ✅ `referrals` - Referral relationships
- ✅ `referral_rewards` - Bonus history
- ✅ `credit_transactions` - Credit ledger

### 4 Database Functions:
- ✅ `generate_referral_code()` - Auto-generate ABC-DEF-GH12 codes
- ✅ `handle_new_user()` - Trigger on signup
- ✅ `apply_referral_code()` - Validate and link referrals
- ✅ `award_referral_bonus()` - Calculate and credit bonuses

### Security:
- ✅ Row Level Security on all tables
- ✅ Users can only see their own data
- ✅ Foreign key constraints
- ✅ Validation checks

---

## ⏭️ Next: Phase 3 - Backend API

Once database setup is verified, we'll implement:

1. Backend API endpoints (Render)
2. Referral controller & service
3. Credit purchase integration
4. JWT authentication

**Estimated time:** 40 minutes

---

## 🐛 Troubleshooting

### If tables already exist:

Run this first to clean up:
```sql
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.referral_rewards CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.referral_codes CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
```

Then re-run the setup scripts.

### If trigger doesn't fire:

Check trigger status:
```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

If disabled, enable it:
```sql
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
```

---

## 📞 Ready for Phase 3?

Once you've completed these steps and verified the test user has a referral code, let me know and I'll implement Phase 3 (Backend API) next!

Type: **"Phase 1 & 2 complete, move to phase 3"** when ready.

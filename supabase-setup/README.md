# 🗄️ Supabase Database Setup

This directory contains all SQL scripts to set up your authentication and referral system database.

---

## 📋 Quick Setup (5 minutes)

### Option 1: Run All at Once (Recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → Your Project
2. Go to **SQL Editor**
3. Copy contents of `00-RUN-ALL-TABLES.sql`
4. Paste and click **Run**
5. Copy contents of `10-RUN-ALL-FUNCTIONS.sql`
6. Paste and click **Run**
7. Done! ✅

### Option 2: Run Individual Files

If you prefer step-by-step:

**Phase 1: Tables (30 seconds)**
```
01-user-profiles-table.sql
02-referral-codes-table.sql
03-referrals-table.sql
04-referral-rewards-table.sql
05-credit-transactions-table.sql
```

**Phase 2: Functions (20 seconds)**
```
10-RUN-ALL-FUNCTIONS.sql
```

---

## 📁 Files Overview

| File | Description | Execution Time |
|------|-------------|----------------|
| `00-RUN-ALL-TABLES.sql` | All 5 tables + policies | ~5 seconds |
| `10-RUN-ALL-FUNCTIONS.sql` | All 4 functions + trigger | ~3 seconds |
| `01-user-profiles-table.sql` | User profile extension | ~1 second |
| `02-referral-codes-table.sql` | Referral codes | ~1 second |
| `03-referrals-table.sql` | Referral relationships | ~1 second |
| `04-referral-rewards-table.sql` | Bonus history | ~1 second |
| `05-credit-transactions-table.sql` | Credit ledger | ~1 second |

---

## 🧪 Verify Installation

After running the scripts, verify everything worked:

### Check Tables

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'user_profiles',
    'referral_codes',
    'referrals',
    'referral_rewards',
    'credit_transactions'
  )
ORDER BY table_name;
```

**Expected:** 5 rows

### Check Row Level Security

```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

**Expected:** All tables show `rowsecurity = true`

### Check Functions

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'generate_referral_code',
    'handle_new_user',
    'apply_referral_code',
    'award_referral_bonus'
  );
```

**Expected:** 4 functions

### Test Referral Code Generation

```sql
SELECT generate_referral_code() as test_code;
```

**Expected:** Returns code like `ABC-DEF-GH12`

---

## 🧑‍💻 Test the System

### 1. Create Test User

Go to **Supabase Dashboard → Authentication → Users → Add User**

- Email: `test@example.com`
- Password: `test123456`
- Confirm password: `test123456`
- Click **Create User**

### 2. Verify Auto-Creation

```sql
-- Check profile created
SELECT * FROM public.user_profiles 
WHERE email = 'test@example.com';

-- Check referral code generated
SELECT rc.code, rc.total_referrals, rc.total_earned_credits
FROM public.referral_codes rc
JOIN public.user_profiles up ON rc.user_id = up.id
WHERE up.email = 'test@example.com';
```

**Expected:** Both queries return data

### 3. Test Apply Referral Code

```sql
-- Get the referral code
SELECT code FROM public.referral_codes LIMIT 1;

-- Create another test user (via dashboard or API)
-- Then apply the code:
SELECT apply_referral_code(
  'NEW_USER_UUID'::uuid,
  'ABC-DEF-GH12'  -- Replace with actual code
);
```

**Expected:** JSON response with `"success": true`

### 4. Test Bonus Awarding

```sql
SELECT award_referral_bonus(
  'REFERRED_USER_UUID'::uuid,
  'pro',
  200,
  1.6
);
```

**Expected:** JSON response with `"awarded": true` and bonus amount

---

## 🔐 Security Features

✅ **Row Level Security (RLS)** enabled on all tables  
✅ Users can only view their own data  
✅ System operations use `SECURITY DEFINER`  
✅ Foreign key constraints prevent orphaned records  
✅ Check constraints validate data integrity  
✅ Unique constraints prevent duplicates  

---

## 🗂️ Database Schema

```
auth.users (Supabase built-in)
    ↓
user_profiles
    ├── id → auth.users.id
    ├── referred_by → auth.users.id
    └── referral_code_used

referral_codes
    ├── user_id → auth.users.id
    └── code (UNIQUE)

referrals
    ├── referrer_user_id → auth.users.id
    ├── referred_user_id → auth.users.id (UNIQUE)
    └── referral_code

referral_rewards
    ├── referral_id → referrals.id
    ├── referrer_user_id → auth.users.id
    └── referred_user_id → auth.users.id

credit_transactions
    └── user_id → auth.users.id
```

---

## 🐛 Troubleshooting

### Error: "relation already exists"

**Cause:** Table already created  
**Solution:** Either drop the table first or use `CREATE TABLE IF NOT EXISTS`

```sql
DROP TABLE IF EXISTS public.user_profiles CASCADE;
```

### Error: "permission denied for schema public"

**Cause:** Insufficient permissions  
**Solution:** Ensure you're using the Supabase SQL Editor (has superuser access)

### Error: "trigger does not exist"

**Cause:** Trigger not created or disabled  
**Solution:** Re-run `10-RUN-ALL-FUNCTIONS.sql`

### Referral code not generated on signup

**Cause:** Trigger not firing  
**Solution:** Check trigger status:

```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

If `tgenabled = 'D'` (disabled), enable it:

```sql
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
```

---

## 🔄 Reset Database (Development Only)

**⚠️ WARNING: This will delete ALL data!**

```sql
-- Drop all tables
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.referral_rewards CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.referral_codes CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS award_referral_bonus CASCADE;
DROP FUNCTION IF EXISTS apply_referral_code CASCADE;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS generate_referral_code CASCADE;

-- Drop trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

Then re-run setup scripts.

---

## 📊 Useful Queries

### Get User Balance

```sql
SELECT 
  u.email,
  COALESCE(SUM(
    CASE 
      WHEN ct.type IN ('purchase', 'bonus', 'refund') THEN ct.amount
      WHEN ct.type = 'scan_deduction' THEN -ct.amount
      ELSE 0
    END
  ), 0) as balance
FROM auth.users u
LEFT JOIN public.credit_transactions ct ON ct.user_id = u.id
WHERE u.email = 'test@example.com'
GROUP BY u.email;
```

### View Referral Stats

```sql
SELECT 
  up.email,
  rc.code,
  rc.total_referrals,
  rc.total_earned_credits,
  COUNT(r.id) as confirmed_referrals
FROM public.user_profiles up
JOIN public.referral_codes rc ON rc.user_id = up.id
LEFT JOIN public.referrals r ON r.referrer_user_id = up.id
WHERE up.email = 'test@example.com'
GROUP BY up.email, rc.code, rc.total_referrals, rc.total_earned_credits;
```

### View All Referrals for a User

```sql
SELECT 
  r.status,
  r.created_at,
  r.first_purchase_at,
  r.bonus_credits_awarded,
  referred.email as referred_user_email
FROM public.referrals r
JOIN auth.users referrer ON r.referrer_user_id = referrer.id
JOIN auth.users referred ON r.referred_user_id = referred.id
WHERE referrer.email = 'test@example.com'
ORDER BY r.created_at DESC;
```

---

## ✅ Next Steps

After database setup is complete:

1. ✅ **Phase 1 Done:** Database tables created
2. ✅ **Phase 2 Done:** Database functions created
3. ⏭️ **Phase 3:** Update backend API (Render)
4. ⏭️ **Phase 4:** Update frontend (remove mock data)
5. ⏭️ **Phase 5:** Test end-to-end

See `AUTH_AND_REFERRAL_BACKEND_PLAN.md` for Phase 3-5.

---

**Database setup complete! 🎉 Now proceed to backend implementation.**

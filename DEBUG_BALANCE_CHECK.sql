-- Debug: Check your actual credit balance
-- Replace YOUR_USER_ID with your actual user ID from auth.users table

-- Step 1: Find your user ID (run this first)
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Step 2: Check all your credit transactions (replace the UUID below)
SELECT 
    type,
    amount,
    balance_after,
    description,
    created_at
FROM public.credit_transactions
WHERE user_id = 'YOUR_USER_ID_HERE'
ORDER BY created_at DESC;

-- Step 3: Calculate your actual balance
SELECT 
    COALESCE(SUM(amount), 0) as current_balance,
    COUNT(*) as total_transactions
FROM public.credit_transactions
WHERE user_id = 'YOUR_USER_ID_HERE';

-- Step 4: Test the deduct_boost_credits function directly
SELECT deduct_boost_credits(
    'YOUR_USER_ID_HERE'::uuid,
    uuid_generate_v4(), -- dummy boost ID for testing
    50 -- test with 50 credits
);

-- =====================================================
-- ADD CREDITS_BALANCE COLUMN TO USER_PROFILES
-- =====================================================
-- This adds the missing credits_balance column that the
-- boost system needs to track user credit balances.
-- =====================================================

-- Add credits_balance column to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 0;

-- Add constraint to ensure balance is never negative
ALTER TABLE public.user_profiles
ADD CONSTRAINT IF NOT EXISTS valid_credits_balance 
CHECK (credits_balance >= 0);

-- Create index for quick balance lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_credits 
ON public.user_profiles(credits_balance);

-- Migrate existing users: Calculate their balance from credit_transactions
UPDATE public.user_profiles up
SET credits_balance = COALESCE((
  SELECT SUM(amount)
  FROM public.credit_transactions ct
  WHERE ct.user_id = up.id
), 0)
WHERE credits_balance = 0;

-- Verify migration
SELECT 
  'Credits Balance Column Added' as status,
  COUNT(*) as users_with_balance,
  SUM(credits_balance) as total_credits,
  AVG(credits_balance) as avg_credits_per_user
FROM public.user_profiles
WHERE credits_balance > 0;

-- =====================================================
-- SUCCESS!
-- =====================================================
-- The credits_balance column has been added and all
-- existing users have had their balances calculated
-- from their transaction history.
-- =====================================================

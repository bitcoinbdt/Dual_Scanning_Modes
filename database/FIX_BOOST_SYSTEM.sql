-- =====================================================
-- BOOST SYSTEM CRITICAL FIX
-- =====================================================
-- Run this in Supabase SQL Editor → Run
--
-- Fixes:
-- 1. Adds 'boost_purchase' to credit_transactions type constraint
-- 2. Recreates deduct_boost_credits with correct type value
-- 3. Recreates refund_boost_credits with correct type value
-- 4. Ensures credits_balance column exists on user_profiles
-- 5. Ensures all boost tables and functions exist
-- =====================================================


-- =====================================================
-- FIX 1: Add 'boost_purchase' to credit_transactions constraint
-- (The existing constraint only allows 'purchase','bonus',
--  'scan_deduction','refund','adjustment' - missing 'boost_purchase')
-- =====================================================

ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS valid_type;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT valid_type CHECK (
    type IN (
      'purchase',
      'bonus',
      'scan_deduction',
      'refund',
      'adjustment',
      'boost_purchase'   -- ← THIS WAS MISSING
    )
  );


-- =====================================================
-- FIX 2: Ensure credits_balance column exists
-- =====================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_credits_balance'
    AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT valid_credits_balance CHECK (credits_balance >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_credits
  ON public.user_profiles(credits_balance);


-- =====================================================
-- FIX 3: Recreate deduct_boost_credits with correct type
-- =====================================================

CREATE OR REPLACE FUNCTION deduct_boost_credits(
  p_user_id UUID,
  p_boost_id UUID,
  p_credits INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get current balance with row lock to prevent race conditions
  SELECT credits_balance INTO v_current_balance
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User profile not found'
    );
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient credits'
    );
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance - p_credits;

  -- Update user_profiles balance
  UPDATE public.user_profiles
  SET credits_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Create transaction record using 'boost_purchase' type
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'boost_purchase',       -- now allowed by constraint
    -p_credits,
    v_new_balance,
    'Token boost advertising fee',
    jsonb_build_object('boost_id', p_boost_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'newBalance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- FIX 4: Recreate refund_boost_credits with correct type
-- =====================================================

CREATE OR REPLACE FUNCTION refund_boost_credits(
  p_boost_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_boost RECORD;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get boost details
  SELECT * INTO v_boost
  FROM public.token_boost_requests
  WHERE id = p_boost_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Boost not found');
  END IF;

  -- Get current balance with row lock
  SELECT credits_balance INTO v_current_balance
  FROM public.user_profiles
  WHERE id = v_boost.user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance + v_boost.credits_cost;

  -- Update balance
  UPDATE public.user_profiles
  SET credits_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_boost.user_id;

  -- Create refund transaction using 'refund' type (already in constraint)
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    v_boost.user_id,
    'refund',
    v_boost.credits_cost,
    v_new_balance,
    'Token boost rejected - credits refunded',
    jsonb_build_object(
      'boost_id', p_boost_id,
      'reason', v_boost.rejection_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'refundedCredits', v_boost.credits_cost,
    'newBalance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- FIX 5: Ensure token_boost_requests table exists
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.token_boost_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_logo_url TEXT NOT NULL,
  token_contract_address TEXT NOT NULL,
  blockchain VARCHAR(20) NOT NULL,
  website TEXT,
  description TEXT,
  coingecko_id TEXT,
  current_price_usd DECIMAL(20, 10),
  price_change_24h DECIMAL(10, 2),
  last_price_update TIMESTAMP WITH TIME ZONE,
  duration_hours INTEGER NOT NULL,
  credits_cost INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  admin_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_boost_status CHECK (status IN ('pending','approved','rejected','active','expired')),
  CONSTRAINT valid_boost_duration CHECK (duration_hours IN (6,12,24,36)),
  CONSTRAINT valid_boost_blockchain CHECK (blockchain IN ('solana','ethereum','bsc')),
  CONSTRAINT valid_boost_credits CHECK (credits_cost > 0),
  CONSTRAINT valid_boost_token_name CHECK (char_length(token_name) BETWEEN 1 AND 50),
  CONSTRAINT valid_boost_token_symbol CHECK (char_length(token_symbol) BETWEEN 1 AND 10)
);

ALTER TABLE public.token_boost_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own boost requests" ON public.token_boost_requests;
CREATE POLICY "Users can view own boost requests" ON public.token_boost_requests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert boost requests" ON public.token_boost_requests;
CREATE POLICY "Users can insert boost requests" ON public.token_boost_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can view all boost requests" ON public.token_boost_requests;
CREATE POLICY "System can view all boost requests" ON public.token_boost_requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can update boost requests" ON public.token_boost_requests;
CREATE POLICY "System can update boost requests" ON public.token_boost_requests
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "System can delete boost requests" ON public.token_boost_requests;
CREATE POLICY "System can delete boost requests" ON public.token_boost_requests
  FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_boost_user_id ON public.token_boost_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_boost_status ON public.token_boost_requests(status);
CREATE INDEX IF NOT EXISTS idx_boost_active ON public.token_boost_requests(status, expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_boost_pending ON public.token_boost_requests(status, requested_at DESC) WHERE status = 'pending';


-- =====================================================
-- FIX 6: Ensure token_boost_analytics table exists
-- =====================================================

CREATE TABLE IF NOT EXISTS public.token_boost_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boost_request_id UUID NOT NULL REFERENCES public.token_boost_requests(id) ON DELETE CASCADE,
  total_scans INTEGER DEFAULT 0,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(boost_request_id)
);

ALTER TABLE public.token_boost_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can manage analytics" ON public.token_boost_analytics;
CREATE POLICY "System can manage analytics" ON public.token_boost_analytics
  FOR ALL USING (true) WITH CHECK (true);


-- =====================================================
-- FIX 7: Recreate activate_boost function
-- =====================================================

CREATE OR REPLACE FUNCTION activate_boost(p_boost_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_boost RECORD;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT * INTO v_boost FROM public.token_boost_requests WHERE id = p_boost_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Boost not found');
  END IF;

  IF v_boost.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Boost must be approved first');
  END IF;

  v_expires_at := NOW() + (v_boost.duration_hours || ' hours')::INTERVAL;

  UPDATE public.token_boost_requests
  SET status = 'active',
      starts_at = NOW(),
      expires_at = v_expires_at,
      updated_at = NOW()
  WHERE id = p_boost_id;

  RETURN jsonb_build_object(
    'success', true,
    'startsAt', NOW(),
    'expiresAt', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- FIX 8: Backfill credits_balance from transactions
-- for existing users who have balance=0 but transactions
-- =====================================================

UPDATE public.user_profiles up
SET credits_balance = COALESCE((
  SELECT SUM(amount)
  FROM public.credit_transactions ct
  WHERE ct.user_id = up.id
), 0)
WHERE credits_balance = 0;


-- =====================================================
-- VERIFICATION - Check everything is correct
-- =====================================================

-- Check constraint was updated
SELECT
  'credit_transactions type constraint' AS check_name,
  CASE WHEN pg_get_constraintdef(oid) LIKE '%boost_purchase%'
    THEN '✅ OK - boost_purchase included'
    ELSE '❌ MISSING - boost_purchase not in constraint'
  END AS status
FROM pg_constraint
WHERE conname = 'valid_type'
  AND conrelid = 'public.credit_transactions'::regclass

UNION ALL

SELECT
  'credits_balance column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'credits_balance'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL

SELECT
  'deduct_boost_credits function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'deduct_boost_credits'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL

SELECT
  'refund_boost_credits function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'refund_boost_credits'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL

SELECT
  'activate_boost function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'activate_boost'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL

SELECT
  'token_boost_requests table',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'token_boost_requests'
  ) THEN '✅ OK' ELSE '❌ MISSING' END;

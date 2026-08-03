-- =====================================================
-- FIX BOOST SYSTEM - Full Database Repair Script
-- =====================================================
-- Run this in your Supabase SQL Editor.
-- Safe to run multiple times (all statements are idempotent).
-- =====================================================


-- =====================================================
-- STEP 1: Ensure credits_balance column exists on user_profiles
-- =====================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 0;

-- Add non-negative constraint (idempotent)
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
-- STEP 2: Backfill balances for existing users who have none
-- =====================================================

UPDATE public.user_profiles up
SET credits_balance = COALESCE((
  SELECT SUM(amount)
  FROM public.credit_transactions ct
  WHERE ct.user_id = up.id
), 0)
WHERE credits_balance = 0;


-- =====================================================
-- STEP 3: Fix handle_credit_approval trigger function
-- (Original script used user_id column but table PK is `id`)
-- =====================================================

CREATE OR REPLACE FUNCTION handle_credit_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes from pending to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Add credits to user_profiles table (PK is `id`, not `user_id`)
    INSERT INTO public.user_profiles (id, credits_balance)
    VALUES (NEW.user_id, NEW.credits_amount)
    ON CONFLICT (id)
    DO UPDATE SET
      credits_balance = public.user_profiles.credits_balance + NEW.credits_amount,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply the trigger
DROP TRIGGER IF EXISTS trigger_credit_approval ON credit_purchase_requests;
CREATE TRIGGER trigger_credit_approval
  AFTER UPDATE ON credit_purchase_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_credit_approval();


-- =====================================================
-- STEP 4: Ensure RLS is enabled on all relevant tables
-- =====================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_boost_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_boost_analytics ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- STEP 5: RLS policies for user_profiles
-- (Users should be able to read their own profile)
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);


-- =====================================================
-- STEP 6: Fix deduct_boost_credits function
-- Ensure it returns newBalance correctly
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

  -- Create transaction record
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'boost_purchase',
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
-- STEP 7: Fix refund_boost_credits function
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

  -- Update user_profiles balance
  UPDATE public.user_profiles
  SET credits_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_boost.user_id;

  -- Create refund transaction record
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
    'Boost request rejected - credits refunded',
    jsonb_build_object('boost_id', p_boost_id, 'reason', v_boost.rejection_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'refundedCredits', v_boost.credits_cost,
    'newBalance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- STEP 8: Ensure token_boost_requests table exists
-- =====================================================

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
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'expired')),
  CONSTRAINT valid_duration CHECK (duration_hours IN (6, 12, 24, 36)),
  CONSTRAINT valid_blockchain CHECK (blockchain IN ('solana', 'ethereum', 'bsc')),
  CONSTRAINT valid_credits CHECK (credits_cost > 0),
  CONSTRAINT valid_token_name CHECK (char_length(token_name) BETWEEN 1 AND 50),
  CONSTRAINT valid_token_symbol CHECK (char_length(token_symbol) BETWEEN 1 AND 10)
);

CREATE INDEX IF NOT EXISTS idx_boost_user_id ON public.token_boost_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_boost_status ON public.token_boost_requests(status);
CREATE INDEX IF NOT EXISTS idx_boost_blockchain ON public.token_boost_requests(blockchain);
CREATE INDEX IF NOT EXISTS idx_boost_requested_at ON public.token_boost_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_boost_active ON public.token_boost_requests(status, expires_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_boost_pending ON public.token_boost_requests(status, requested_at DESC)
  WHERE status = 'pending';


-- =====================================================
-- STEP 9: Ensure token_boost_analytics table exists
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

CREATE INDEX IF NOT EXISTS idx_boost_analytics_boost_id ON public.token_boost_analytics(boost_request_id);


-- =====================================================
-- STEP 10: RLS policies for boost tables
-- =====================================================

-- token_boost_requests
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

-- token_boost_analytics
DROP POLICY IF EXISTS "Users can view own boost analytics" ON public.token_boost_analytics;
CREATE POLICY "Users can view own boost analytics" ON public.token_boost_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.token_boost_requests
      WHERE id = boost_request_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can manage analytics" ON public.token_boost_analytics;
CREATE POLICY "System can manage analytics" ON public.token_boost_analytics
  FOR ALL USING (true) WITH CHECK (true);


-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'credits_balance column' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'credits_balance'
  ) THEN 'OK' ELSE 'MISSING' END as status

UNION ALL

SELECT 'token_boost_requests table',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'token_boost_requests'
  ) THEN 'OK' ELSE 'MISSING' END

UNION ALL

SELECT 'token_boost_analytics table',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'token_boost_analytics'
  ) THEN 'OK' ELSE 'MISSING' END

UNION ALL

SELECT 'deduct_boost_credits function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'deduct_boost_credits'
  ) THEN 'OK' ELSE 'MISSING' END

UNION ALL

SELECT 'refund_boost_credits function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'refund_boost_credits'
  ) THEN 'OK' ELSE 'MISSING' END

UNION ALL

SELECT 'handle_credit_approval function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'handle_credit_approval'
  ) THEN 'OK' ELSE 'MISSING' END;

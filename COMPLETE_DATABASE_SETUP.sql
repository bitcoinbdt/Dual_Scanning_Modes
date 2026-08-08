-- =====================================================
-- COMPLETE DATABASE SETUP FOR SIGNUP/LOGIN & REFERRALS
-- =====================================================
-- Copy this entire file and paste into Supabase SQL Editor
-- Then click "Run" to execute everything at once
-- 
-- This will:
-- 1. Create all required tables
-- 2. Set up Row Level Security policies
-- 3. Create database functions
-- 4. Set up triggers for auto-profile creation
-- 
-- Execution time: ~10 seconds
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 1: CREATE TABLES
-- =====================================================

-- 1. USER PROFILES TABLE
-- IMPORTANT: credits_balance is required by the handle_new_user trigger (below)
-- and by deduct_credits_for_scan / refund_credits_for_scan RPCs.
-- After running this file you MUST also run: database/deduct_credits_for_scan.sql
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  credits_balance INTEGER DEFAULT 20 NOT NULL,  -- Starting credits awarded on signup
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_scans INTEGER DEFAULT 0,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  referred_by UUID REFERENCES auth.users(id),
  referral_code_used TEXT,
  UNIQUE(id)
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON public.user_profiles;

CREATE POLICY "Users can view own profile" ON public.user_profiles 
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles 
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "System can insert profiles" ON public.user_profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_by ON public.user_profiles(referred_by);

-- 2. REFERRAL CODES TABLE (UPDATED: 8 characters without dashes)
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  total_referrals INTEGER DEFAULT 0,
  total_earned_credits INTEGER DEFAULT 0,
  CONSTRAINT unique_user_code UNIQUE(user_id),
  CONSTRAINT unique_code UNIQUE(code),
  CONSTRAINT valid_code_format CHECK (char_length(code) = 8)
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "Anyone can read referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "System can insert referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "System can update referral codes" ON public.referral_codes;

CREATE POLICY "Users can view own referral code" ON public.referral_codes 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read referral codes" ON public.referral_codes 
  FOR SELECT USING (true);
CREATE POLICY "System can insert referral codes" ON public.referral_codes 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update referral codes" ON public.referral_codes 
  FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_referral_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_user_id ON public.referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_active ON public.referral_codes(is_active) WHERE is_active = true;

-- 3. REFERRALS TABLE
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(8) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_purchase_at TIMESTAMP WITH TIME ZONE,
  first_purchase_amount DECIMAL(10,2),
  bonus_credits_awarded INTEGER DEFAULT 0,
  CONSTRAINT unique_referred_user UNIQUE(referred_user_id),
  CONSTRAINT no_self_referral CHECK (referrer_user_id != referred_user_id),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'rewarded')),
  CONSTRAINT valid_bonus CHECK (bonus_credits_awarded >= 0)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "System can manage referrals" ON public.referrals;

CREATE POLICY "Users can view own referrals" ON public.referrals 
  FOR SELECT USING (auth.uid() = referrer_user_id);
CREATE POLICY "System can manage referrals" ON public.referrals 
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON public.referrals(created_at DESC);

-- 4. REFERRAL REWARDS TABLE
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id),
  referred_user_id UUID NOT NULL REFERENCES auth.users(id),
  purchase_package_id VARCHAR(50) NOT NULL,
  credits_purchased INTEGER NOT NULL,
  bonus_credits INTEGER NOT NULL,
  bonus_percentage DECIMAL(5,2) NOT NULL,
  credited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_bonus CHECK (bonus_credits >= 0),
  CONSTRAINT valid_percentage CHECK (bonus_percentage >= 0 AND bonus_percentage <= 100),
  CONSTRAINT valid_credits_purchased CHECK (credits_purchased > 0)
);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rewards" ON public.referral_rewards;
DROP POLICY IF EXISTS "System can insert rewards" ON public.referral_rewards;

CREATE POLICY "Users can view own rewards" ON public.referral_rewards 
  FOR SELECT USING (auth.uid() = referrer_user_id);
CREATE POLICY "System can insert rewards" ON public.referral_rewards 
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rewards_referrer ON public.referral_rewards(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_referral ON public.referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_rewards_credited ON public.referral_rewards(credited_at DESC);

-- 5. CREDIT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB,
  scan_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_type CHECK (type IN ('purchase', 'bonus', 'scan_deduction', 'refund', 'adjustment')),
  CONSTRAINT valid_amount CHECK (amount != 0),
  CONSTRAINT valid_balance CHECK (balance_after >= 0),
  CONSTRAINT unique_scan_action UNIQUE (scan_id, type)
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Upgrade existing credit_transactions table if it already exists from previous phases
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS scan_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
     WHERE conname = 'unique_scan_action' 
       AND conrelid = 'public.credit_transactions'::regclass
  ) THEN
    ALTER TABLE public.credit_transactions ADD CONSTRAINT unique_scan_action UNIQUE (scan_id, type);
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.credit_transactions;

CREATE POLICY "Users can view own transactions" ON public.credit_transactions 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert transactions" ON public.credit_transactions 
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON public.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_scan_id ON public.credit_transactions(scan_id);

-- =====================================================
-- STEP 2: CREATE FUNCTIONS
-- =====================================================

-- 1. GENERATE REFERRAL CODE (8 characters, no dashes)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate 8 random characters
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. AUTO-CREATE PROFILE & CODE ON SIGNUP
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Create user profile with 20 starting credits
  INSERT INTO public.user_profiles (id, email, display_name, credits_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    20
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Generate unique referral code
  LOOP
    new_code := generate_referral_code();
    attempts := attempts + 1;
    
    -- Try to insert, exit loop if successful
    BEGIN
      INSERT INTO public.referral_codes (user_id, code)
      VALUES (NEW.id, new_code)
      ON CONFLICT (user_id) DO NOTHING;
      EXIT; -- Success, exit loop
    EXCEPTION WHEN unique_violation THEN
      IF attempts >= max_attempts THEN
        RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', max_attempts;
      END IF;
      -- Try again with new code
    END;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREATE/REPLACE TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 4. APPLY REFERRAL CODE FUNCTION
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_name TEXT;
BEGIN
  -- Normalize code (uppercase, trim)
  p_code := UPPER(TRIM(p_code));
  
  -- Check if code exists
  SELECT user_id INTO v_referrer_id
  FROM public.referral_codes
  WHERE code = p_code AND is_active = true;
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid or inactive referral code'
    );
  END IF;
  
  -- Check if user is trying to use their own code
  IF v_referrer_id = p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You cannot use your own referral code'
    );
  END IF;
  
  -- Check if user already has a referrer
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You have already used a referral code'
    );
  END IF;
  
  -- Check if user already purchased (too late to apply)
  IF EXISTS (
    SELECT 1 FROM public.credit_transactions 
    WHERE user_id = p_user_id AND type = 'purchase'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Referral codes must be applied before your first purchase'
    );
  END IF;
  
  -- Get referrer name
  SELECT display_name INTO v_referrer_name
  FROM public.user_profiles
  WHERE id = v_referrer_id;
  
  -- Create referral record
  INSERT INTO public.referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status
  ) VALUES (
    v_referrer_id,
    p_user_id,
    p_code,
    'confirmed'
  );
  
  -- Update user profile
  UPDATE public.user_profiles
  SET referred_by = v_referrer_id,
      referral_code_used = p_code
  WHERE id = p_user_id;
  
  -- Increment referrer's count
  UPDATE public.referral_codes
  SET total_referrals = total_referrals + 1
  WHERE user_id = v_referrer_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Referral code applied successfully',
    'referrerUsername', v_referrer_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. AWARD REFERRAL BONUS FUNCTION
CREATE OR REPLACE FUNCTION award_referral_bonus(
  p_buyer_user_id UUID,
  p_package_id TEXT,
  p_credits_purchased INTEGER,
  p_amount_paid DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_bonus_credits INTEGER;
  v_bonus_percentage DECIMAL;
  v_current_balance INTEGER;
BEGIN
  -- Check if this is a referred user's first purchase
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referred_user_id = p_buyer_user_id
    AND status = 'confirmed'
    AND first_purchase_at IS NULL;
  
  IF v_referral IS NULL THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'reason', 'No eligible referral found'
    );
  END IF;
  
  -- Calculate bonus based on package
  CASE p_package_id
    WHEN 'starter' THEN
      v_bonus_percentage := 10;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.10);
    WHEN 'basic' THEN
      v_bonus_percentage := 15;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.15);
    WHEN 'pro' THEN
      v_bonus_percentage := 20;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.20);
    WHEN 'premium' THEN
      v_bonus_percentage := 25;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.25);
    ELSE
      v_bonus_percentage := 10;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.10);
  END CASE;
  
  -- Update referral record
  UPDATE public.referrals
  SET status = 'rewarded',
      first_purchase_at = NOW(),
      first_purchase_amount = p_amount_paid,
      bonus_credits_awarded = v_bonus_credits
  WHERE id = v_referral.id;
  
  -- Create reward record
  INSERT INTO public.referral_rewards (
    referral_id,
    referrer_user_id,
    referred_user_id,
    purchase_package_id,
    credits_purchased,
    bonus_credits,
    bonus_percentage
  ) VALUES (
    v_referral.id,
    v_referral.referrer_user_id,
    p_buyer_user_id,
    p_package_id,
    p_credits_purchased,
    v_bonus_credits,
    v_bonus_percentage
  );
  
  -- Get current balance
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('purchase', 'bonus', 'refund', 'adjustment') THEN amount
      WHEN type = 'scan_deduction' THEN amount
      ELSE 0
    END
  ), 0) INTO v_current_balance
  FROM public.credit_transactions
  WHERE user_id = v_referral.referrer_user_id;
  
  -- Create bonus transaction
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    v_referral.referrer_user_id,
    'bonus',
    v_bonus_credits,
    v_current_balance + v_bonus_credits,
    format('Referral bonus from %s purchase', v_referrer_name),
    jsonb_build_object(
      'referral_id', v_referral.id,
      'referred_user_id', p_buyer_user_id,
      'package_id', p_package_id,
      'bonus_percentage', v_bonus_percentage
    )
  );
  
  -- Update referral code stats
  UPDATE public.referral_codes
  SET total_earned_credits = total_earned_credits + v_bonus_credits
  WHERE user_id = v_referral.referrer_user_id;
  
  RETURN jsonb_build_object(
    'awarded', true,
    'referrer_user_id', v_referral.referrer_user_id,
    'bonus_credits', v_bonus_credits,
    'bonus_percentage', v_bonus_percentage
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- deduct_credits_for_scan RPC Function
-- ===========================================
-- Drop old 4-parameter overload if it exists (Phase 3 migration leftover)
DROP FUNCTION IF EXISTS public.deduct_credits_for_scan(uuid, integer, text, text);
CREATE OR REPLACE FUNCTION deduct_credits_for_scan(
  p_user_id      UUID,
  p_amount       INTEGER,
  p_scan_type    TEXT,
  p_token_address TEXT,
  p_scan_id      UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  IF p_scan_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE scan_id = p_scan_id AND type = 'scan_deduction'
    ) THEN
      SELECT credits_balance INTO v_new_balance FROM public.user_profiles WHERE id = p_user_id;
      RETURN v_new_balance;
    END IF;
  END IF;

  SELECT credits_balance INTO v_current_balance FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for user %', p_user_id;
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credit balance. Required: %, Available: %', p_amount, v_current_balance;
  END IF;

  v_new_balance := v_current_balance - p_amount;
  UPDATE public.user_profiles SET credits_balance = v_new_balance, updated_at = NOW() WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id, type, amount, balance_after, description, metadata, scan_id
  ) VALUES (
    p_user_id, 'scan_deduction', -p_amount, v_new_balance,
    CASE p_scan_type
      WHEN 'BASIC'    THEN 'Basic Scan — ' || p_token_address
      WHEN 'ELEVATOR' THEN 'Elevator Deep Scan — ' || p_token_address
      WHEN 'DEEP'     THEN 'Deep Scan — ' || p_token_address
      WHEN 'AGENT'    THEN 'Crypto Hype Agent run'
      ELSE                 p_scan_type || ' — ' || p_token_address
    END,
    jsonb_build_object('scan_type', p_scan_type, 'token_address', p_token_address, 'credits_spent', p_amount),
    p_scan_id
  );

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_credits_for_scan(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;

-- ===========================================
-- refund_credits_for_scan RPC Function
-- ===========================================
-- Drop old 4-parameter overload if it exists (Phase 3 migration leftover)
DROP FUNCTION IF EXISTS public.refund_credits_for_scan(uuid, integer, text, text);
CREATE OR REPLACE FUNCTION refund_credits_for_scan(
  p_user_id       UUID,
  p_amount        INTEGER,
  p_scan_type     TEXT,
  p_token_address  TEXT,
  p_scan_id       UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  IF p_scan_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE scan_id = p_scan_id AND type = 'refund'
    ) THEN
      SELECT credits_balance INTO v_new_balance FROM public.user_profiles WHERE id = p_user_id;
      RETURN v_new_balance;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE scan_id = p_scan_id AND type = 'scan_deduction' AND user_id = p_user_id
    ) THEN
      SELECT credits_balance INTO v_new_balance FROM public.user_profiles WHERE id = p_user_id;
      RETURN v_new_balance;
    END IF;
  END IF;

  SELECT credits_balance INTO v_current_balance FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for user %', p_user_id;
  END IF;

  v_new_balance := v_current_balance + p_amount;
  UPDATE public.user_profiles SET credits_balance = v_new_balance, updated_at = NOW() WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id, type, amount, balance_after, description, metadata, scan_id
  ) VALUES (
    p_user_id, 'refund', p_amount, v_new_balance,
    CASE p_scan_type
      WHEN 'BASIC'    THEN 'Refund: Basic Scan — ' || p_token_address
      WHEN 'ELEVATOR' THEN 'Refund: Elevator Deep Scan — ' || p_token_address
      WHEN 'DEEP'     THEN 'Refund: Deep Scan — ' || p_token_address
      WHEN 'AGENT'    THEN 'Refund: Crypto Hype Agent run'
      ELSE                 'Refund: ' || p_scan_type || ' — ' || p_token_address
    END,
    jsonb_build_object('scan_type', p_scan_type, 'token_address', p_token_address, 'credits_refunded', p_amount),
    p_scan_id
  );

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION refund_credits_for_scan(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;

-- =====================================================
-- STEP 3: VERIFICATION
-- =====================================================

-- Check all tables exist
SELECT 
  'Tables Created' as status,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_profiles', 'referral_codes', 'referrals', 'referral_rewards', 'credit_transactions');

-- Check Row Level Security is enabled
SELECT 
  'RLS Enabled' as status,
  COUNT(*) as count
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'referral_codes', 'referrals', 'referral_rewards', 'credit_transactions')
  AND rowsecurity = true;

-- Check functions exist
SELECT 
  'Functions Created' as status,
  COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('generate_referral_code', 'handle_new_user', 'apply_referral_code', 'award_referral_bonus', 'deduct_credits_for_scan', 'refund_credits_for_scan');

-- Check trigger exists
SELECT 
  'Trigger Created' as status,
  COUNT(*) as count
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Test referral code generation
SELECT 
  'Sample Referral Code' as status,
  generate_referral_code() as code;

-- =====================================================
-- SUCCESS!
-- =====================================================
-- If all counts show expected numbers:
-- - Tables Created: 5
-- - RLS Enabled: 5
-- - Functions Created: 6
-- - Trigger Created: 1
-- - Sample Referral Code: 8-character code
--
-- Your database is fully ready for signup, logins, and credit-scoped scans!
-- =====================================================

-- ===========================================
-- COMPLETE DATABASE SETUP - PHASE 1
-- ===========================================
-- Run this file in Supabase SQL Editor to create all tables
-- 
-- Execution time: ~5 seconds
-- Creates: 5 tables with Row Level Security policies
--
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- 1. USER PROFILES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
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

CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "System can insert profiles" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_by ON public.user_profiles(referred_by);

-- ===========================================
-- 2. REFERRAL CODES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(12) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  total_referrals INTEGER DEFAULT 0,
  total_earned_credits INTEGER DEFAULT 0,
  CONSTRAINT unique_user_code UNIQUE(user_id),
  CONSTRAINT unique_code UNIQUE(code),
  CONSTRAINT valid_code_format CHECK (char_length(code) = 12)
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "System can insert referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "System can update referral codes" ON public.referral_codes;

CREATE POLICY "Users can view own referral code" ON public.referral_codes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert referral codes" ON public.referral_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update referral codes" ON public.referral_codes FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_referral_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_user_id ON public.referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_active ON public.referral_codes(is_active) WHERE is_active = true;

-- ===========================================
-- 3. REFERRALS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(12) NOT NULL,
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

CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_user_id);
CREATE POLICY "System can manage referrals" ON public.referrals FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON public.referrals(created_at DESC);

-- ===========================================
-- 4. REFERRAL REWARDS TABLE
-- ===========================================

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

CREATE POLICY "Users can view own rewards" ON public.referral_rewards FOR SELECT USING (auth.uid() = referrer_user_id);
CREATE POLICY "System can insert rewards" ON public.referral_rewards FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rewards_referrer ON public.referral_rewards(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_referral ON public.referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_rewards_credited ON public.referral_rewards(credited_at DESC);

-- ===========================================
-- 5. CREDIT TRANSACTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_type CHECK (type IN ('purchase', 'bonus', 'scan_deduction', 'refund', 'adjustment')),
  CONSTRAINT valid_amount CHECK (amount != 0),
  CONSTRAINT valid_balance CHECK (balance_after >= 0)
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.credit_transactions;

CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert transactions" ON public.credit_transactions FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON public.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON public.credit_transactions(created_at DESC);

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================
-- Run these to verify tables were created successfully

-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_profiles', 'referral_codes', 'referrals', 'referral_rewards', 'credit_transactions')
ORDER BY table_name;

-- Check Row Level Security is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'referral_codes', 'referrals', 'referral_rewards', 'credit_transactions');

-- Count policies for each table
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ===========================================
-- SUCCESS!
-- ===========================================
-- If you see 5 tables with rowsecurity=true, Phase 1 is complete!
-- Next: Run Phase 2 (database functions)

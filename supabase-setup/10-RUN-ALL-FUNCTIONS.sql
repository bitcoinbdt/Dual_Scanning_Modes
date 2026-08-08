-- ===========================================
-- COMPLETE DATABASE FUNCTIONS - PHASE 2
-- ===========================================
-- Run this file in Supabase SQL Editor after Phase 1
-- 
-- Execution time: ~3 seconds
-- Creates: 3 functions + 1 trigger
--
-- ===========================================

-- ===========================================
-- 1. GENERATE REFERRAL CODE FUNCTION
-- ===========================================
-- Generates unique ABC-DEF-GH12 format codes

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate ABC-DEF-GH12 format
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 2. AUTO-CREATE PROFILE & CODE ON SIGNUP
-- ===========================================
-- Trigger function that runs after user signs up

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
  );
  
  -- Generate unique referral code
  LOOP
    new_code := generate_referral_code();
    attempts := attempts + 1;
    
    -- Try to insert, exit loop if successful
    BEGIN
      INSERT INTO public.referral_codes (user_id, code)
      VALUES (NEW.id, new_code);
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

-- Create/replace trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ===========================================
-- 3. APPLY REFERRAL CODE FUNCTION
-- ===========================================
-- Validates and applies a referral code

CREATE OR REPLACE FUNCTION apply_referral_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_name TEXT;
BEGIN
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

-- ===========================================
-- 4. AWARD REFERRAL BONUS FUNCTION
-- ===========================================
-- Awards bonus credits on first purchase

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
    -- No referral or already rewarded
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
      WHEN type = 'scan_deduction' THEN -amount
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
    format('Referral bonus from user %s', p_buyer_user_id),
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
-- 5. DEDUCT CREDITS FOR SCAN FUNCTION
-- ===========================================
-- Drop old 4-parameter overloads if they exist (Phase 3 migration leftover)
DROP FUNCTION IF EXISTS public.deduct_credits_for_scan(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.refund_credits_for_scan(uuid, integer, text, text);
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
-- 6. REFUND CREDITS FOR SCAN FUNCTION
-- ===========================================
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

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Test generate_referral_code function
SELECT generate_referral_code() as sample_code;

-- Check if trigger exists
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- List all functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('generate_referral_code', 'handle_new_user', 'apply_referral_code', 'award_referral_bonus', 'deduct_credits_for_scan', 'refund_credits_for_scan');

-- ===========================================
-- SUCCESS!
-- ===========================================
-- If you see 6 functions, Phase 2 functions setup is complete!
-- Next: Test by creating a user and checking if profile + code are auto-created

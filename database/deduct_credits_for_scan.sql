-- ===========================================
-- deduct_credits_for_scan RPC Function
-- ===========================================
-- Called by /api/scan/basic, /api/scan/elevator, and /api/agent/run
-- Atomically deducts credits and records the transaction ledger entry.
--
-- Run this in your Supabase SQL Editor.
-- ===========================================

CREATE OR REPLACE FUNCTION deduct_credits_for_scan(
  p_user_id      UUID,
  p_amount       INTEGER,
  p_scan_type    TEXT,    -- 'BASIC', 'ELEVATOR', or 'AGENT'
  p_token_address TEXT
)
RETURNS INTEGER           -- Returns new balance after deduction
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  -- 1. Lock the user profile row for atomic update
  SELECT credits_balance
    INTO v_current_balance
    FROM public.user_profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for user %', p_user_id;
  END IF;

  -- 2. Check sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credit balance. Required: %, Available: %', p_amount, v_current_balance;
  END IF;

  -- 3. Deduct credits
  v_new_balance := v_current_balance - p_amount;

  UPDATE public.user_profiles
     SET credits_balance = v_new_balance,
         updated_at      = NOW()
   WHERE id = p_user_id;

  -- 4. Record transaction in ledger (stored as negative for deductions)
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'scan_deduction',
    -p_amount,
    v_new_balance,
    CASE p_scan_type
      WHEN 'BASIC'    THEN 'Basic Scan — ' || p_token_address
      WHEN 'ELEVATOR' THEN 'Elevator Deep Scan — ' || p_token_address
      WHEN 'AGENT'    THEN 'Crypto Hype Agent run'
      ELSE                 p_scan_type || ' — ' || p_token_address
    END,
    jsonb_build_object(
      'scan_type',     p_scan_type,
      'token_address', p_token_address,
      'credits_spent', p_amount
    )
  );

  RETURN v_new_balance;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION deduct_credits_for_scan(UUID, INTEGER, TEXT, TEXT) TO authenticated;


-- ===========================================
-- refund_credits_for_scan RPC Function
-- ===========================================
-- Atomically refunds scan/agent credits if a scan fails downstream.
-- ===========================================

CREATE OR REPLACE FUNCTION refund_credits_for_scan(
  p_user_id       UUID,
  p_amount        INTEGER,
  p_scan_type     TEXT,    -- 'BASIC', 'ELEVATOR', or 'AGENT'
  p_token_address  TEXT
)
RETURNS INTEGER            -- Returns new balance after refund
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  -- 1. Lock the user profile row for atomic update
  SELECT credits_balance
    INTO v_current_balance
    FROM public.user_profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for user %', p_user_id;
  END IF;

  -- 2. Add back credits
  v_new_balance := v_current_balance + p_amount;

  UPDATE public.user_profiles
     SET credits_balance = v_new_balance,
         updated_at      = NOW()
   WHERE id = p_user_id;

  -- 3. Record transaction in ledger (stored as positive for refunds)
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'refund',
    p_amount,
    v_new_balance,
    CASE p_scan_type
      WHEN 'BASIC'    THEN 'Refund: Basic Scan — ' || p_token_address
      WHEN 'ELEVATOR' THEN 'Refund: Elevator Deep Scan — ' || p_token_address
      WHEN 'AGENT'    THEN 'Refund: Crypto Hype Agent run'
      ELSE                 'Refund: ' || p_scan_type || ' — ' || p_token_address
    END,
    jsonb_build_object(
      'scan_type',     p_scan_type,
      'token_address', p_token_address,
      'credits_refunded', p_amount
    )
  );

  RETURN v_new_balance;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refund_credits_for_scan(UUID, INTEGER, TEXT, TEXT) TO authenticated;


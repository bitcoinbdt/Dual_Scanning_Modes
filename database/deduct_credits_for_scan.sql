-- ===========================================
-- deduct_credits_for_scan RPC Function
-- ===========================================
-- Atomically deducts credits and records the transaction ledger entry.
-- Supports durable idempotency via scan_id UUID.
-- ===========================================

-- Alter table to add scan_id column and constraint if not exists
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

CREATE INDEX IF NOT EXISTS idx_credit_tx_scan_id ON public.credit_transactions(scan_id);

-- Drop old 4-parameter overloads if they exist (Phase 3 migration leftover)
DROP FUNCTION IF EXISTS public.deduct_credits_for_scan(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.refund_credits_for_scan(uuid, integer, text, text);

CREATE OR REPLACE FUNCTION deduct_credits_for_scan(
  p_user_id      UUID,
  p_amount       INTEGER,
  p_scan_type    TEXT,    -- 'BASIC', 'ELEVATOR', 'DEEP', or 'AGENT'
  p_token_address TEXT,
  p_scan_id      UUID DEFAULT NULL
)
RETURNS INTEGER           -- Returns new balance after deduction
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  -- If p_scan_id is provided, check if a deduction already exists for this scan_id
  IF p_scan_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE scan_id = p_scan_id AND type = 'scan_deduction'
    ) THEN
      -- Already deducted, return current balance idempotently
      SELECT credits_balance INTO v_new_balance FROM public.user_profiles WHERE id = p_user_id;
      RETURN v_new_balance;
    END IF;
  END IF;

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
    metadata,
    scan_id
  ) VALUES (
    p_user_id,
    'scan_deduction',
    -p_amount,
    v_new_balance,
    CASE p_scan_type
      WHEN 'BASIC'    THEN 'Basic Scan — ' || p_token_address
      WHEN 'ELEVATOR' THEN 'Elevator Deep Scan — ' || p_token_address
      WHEN 'DEEP'     THEN 'Deep Scan — ' || p_token_address
      WHEN 'AGENT'    THEN 'Crypto Hype Agent run'
      ELSE                 p_scan_type || ' — ' || p_token_address
    END,
    jsonb_build_object(
      'scan_type',     p_scan_type,
      'token_address', p_token_address,
      'credits_spent', p_amount
    ),
    p_scan_id
  );

  RETURN v_new_balance;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION deduct_credits_for_scan(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;


-- ===========================================
-- refund_credits_for_scan RPC Function
-- ===========================================
-- Atomically refunds scan/agent credits if a scan fails downstream.
-- Supports database-level idempotency via scan_id UUID.
-- ===========================================

CREATE OR REPLACE FUNCTION refund_credits_for_scan(
  p_user_id       UUID,
  p_amount        INTEGER,
  p_scan_type     TEXT,    -- 'BASIC', 'ELEVATOR', 'DEEP', or 'AGENT'
  p_token_address  TEXT,
  p_scan_id       UUID DEFAULT NULL
)
RETURNS INTEGER            -- Returns new balance after refund
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  -- If p_scan_id is provided, check if a refund was already processed for this scan_id
  IF p_scan_id IS NOT NULL THEN
    -- Check if a refund already exists for this scan_id
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE scan_id = p_scan_id AND type = 'refund'
    ) THEN
      -- Refund already processed, return current balance idempotently
      SELECT credits_balance INTO v_new_balance FROM public.user_profiles WHERE id = p_user_id;
      RETURN v_new_balance;
    END IF;

    -- Crucial check: only refund if a corresponding deduction exists and belongs to the user.
    -- Prevents generating credits out of thin air or stealing another user's refund.
    IF NOT EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE scan_id = p_scan_id AND type = 'scan_deduction' AND user_id = p_user_id
    ) THEN
      SELECT credits_balance INTO v_new_balance FROM public.user_profiles WHERE id = p_user_id;
      RETURN v_new_balance;
    END IF;
  END IF;

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
    metadata,
    scan_id
  ) VALUES (
    p_user_id,
    'refund',
    p_amount,
    v_new_balance,
    CASE p_scan_type
      WHEN 'BASIC'    THEN 'Refund: Basic Scan — ' || p_token_address
      WHEN 'ELEVATOR' THEN 'Refund: Elevator Deep Scan — ' || p_token_address
      WHEN 'DEEP'     THEN 'Refund: Deep Scan — ' || p_token_address
      WHEN 'AGENT'    THEN 'Refund: Crypto Hype Agent run'
      ELSE                 'Refund: ' || p_scan_type || ' — ' || p_token_address
    END,
    jsonb_build_object(
      'scan_type',     p_scan_type,
      'token_address', p_token_address,
      'credits_refunded', p_amount
    ),
    p_scan_id
  );

  RETURN v_new_balance;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refund_credits_for_scan(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;

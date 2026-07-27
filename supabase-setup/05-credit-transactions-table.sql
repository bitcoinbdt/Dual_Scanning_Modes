-- ===========================================
-- Phase 1.5: Credit Transactions Table
-- ===========================================
-- Ledger of all credit operations (purchases, bonuses, scans)

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_type CHECK (type IN ('purchase', 'bonus', 'scan_deduction', 'refund', 'adjustment')),
  CONSTRAINT valid_amount CHECK (amount != 0),
  CONSTRAINT valid_balance CHECK (balance_after >= 0)
);

-- Enable Row Level Security
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.credit_transactions;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert transactions
CREATE POLICY "System can insert transactions"
  ON public.credit_transactions
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON public.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON public.credit_transactions(created_at DESC);

-- Add comments
COMMENT ON TABLE public.credit_transactions IS 'Complete ledger of all credit operations';
COMMENT ON COLUMN public.credit_transactions.type IS 'Transaction types: purchase, bonus, scan_deduction, refund, adjustment';
COMMENT ON COLUMN public.credit_transactions.metadata IS 'Additional data (package_id, referral_id, scan_type, etc.)';

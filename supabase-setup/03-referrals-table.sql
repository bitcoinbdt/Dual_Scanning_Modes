-- ===========================================
-- Phase 1.3: Referrals Table
-- ===========================================
-- Tracks referral relationships and bonus rewards

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
  
  -- Constraints
  CONSTRAINT unique_referred_user UNIQUE(referred_user_id),
  CONSTRAINT no_self_referral CHECK (referrer_user_id != referred_user_id),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'rewarded')),
  CONSTRAINT valid_bonus CHECK (bonus_credits_awarded >= 0)
);

-- Enable Row Level Security
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "System can manage referrals" ON public.referrals;

-- Policy: Users can view their referrals (as referrer)
CREATE POLICY "Users can view own referrals"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

-- Policy: System can manage all referral operations
CREATE POLICY "System can manage referrals"
  ON public.referrals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON public.referrals(created_at DESC);

-- Add comments
COMMENT ON TABLE public.referrals IS 'Referral relationships between users';
COMMENT ON COLUMN public.referrals.status IS 'Status: pending (signed up), confirmed (code applied), rewarded (bonus given)';

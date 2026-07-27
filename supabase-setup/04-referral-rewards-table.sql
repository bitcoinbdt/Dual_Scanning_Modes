-- ===========================================
-- Phase 1.4: Referral Rewards Table
-- ===========================================
-- Detailed log of all referral bonuses awarded

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
  
  -- Constraints
  CONSTRAINT valid_bonus CHECK (bonus_credits >= 0),
  CONSTRAINT valid_percentage CHECK (bonus_percentage >= 0 AND bonus_percentage <= 100),
  CONSTRAINT valid_credits_purchased CHECK (credits_purchased > 0)
);

-- Enable Row Level Security
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own rewards" ON public.referral_rewards;
DROP POLICY IF EXISTS "System can insert rewards" ON public.referral_rewards;

-- Policy: Users can view their rewards (as referrer)
CREATE POLICY "Users can view own rewards"
  ON public.referral_rewards
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

-- Policy: System can insert rewards
CREATE POLICY "System can insert rewards"
  ON public.referral_rewards
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rewards_referrer ON public.referral_rewards(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_referral ON public.referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_rewards_credited ON public.referral_rewards(credited_at DESC);

-- Add comments
COMMENT ON TABLE public.referral_rewards IS 'Historical log of all referral bonuses awarded';
COMMENT ON COLUMN public.referral_rewards.bonus_percentage IS 'Percentage of purchase that was awarded as bonus (10-25%)';

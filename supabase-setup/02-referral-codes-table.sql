-- ===========================================
-- Phase 1.2: Referral Codes Table
-- ===========================================
-- Stores unique referral codes for each user

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

-- Enable Row Level Security
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "System can insert referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "System can update referral codes" ON public.referral_codes;

-- Policy: Users can view their own code
CREATE POLICY "Users can view own referral code"
  ON public.referral_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert codes (via trigger)
CREATE POLICY "System can insert referral codes"
  ON public.referral_codes
  FOR INSERT
  WITH CHECK (true);

-- Policy: System can update codes (for stats)
CREATE POLICY "System can update referral codes"
  ON public.referral_codes
  FOR UPDATE
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_referral_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_user_id ON public.referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_active ON public.referral_codes(is_active) WHERE is_active = true;

-- Add comment
COMMENT ON TABLE public.referral_codes IS 'Unique referral codes for each user (format: ABC-DEF-GH12)';

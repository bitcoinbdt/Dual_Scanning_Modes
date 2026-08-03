-- =====================================================
-- TOKEN BOOST ADVERTISING SCHEMA
-- =====================================================
-- This schema supports the token boost/advertising feature
-- where users can pay credits to feature their tokens
-- across the platform with admin approval required.
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- MAIN TABLE: token_boost_requests
-- =====================================================

CREATE TABLE IF NOT EXISTS public.token_boost_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Token Information (User-provided)
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_logo_url TEXT NOT NULL,
  token_contract_address TEXT NOT NULL,
  blockchain VARCHAR(20) NOT NULL, -- 'solana', 'ethereum', 'bsc'
  
  -- Optional Information
  website TEXT,
  description TEXT,
  coingecko_id TEXT, -- For automatic price fetching
  
  -- Live Price Data (cached from CoinGecko)
  current_price_usd DECIMAL(20, 10),
  price_change_24h DECIMAL(10, 2),
  last_price_update TIMESTAMP WITH TIME ZONE,
  
  -- Boost Details
  duration_hours INTEGER NOT NULL, -- 6, 12, 24, 36
  credits_cost INTEGER NOT NULL,
  
  -- Status & Timestamps
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'active', 'expired'
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Admin Review
  rejection_reason TEXT,
  admin_notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'expired')),
  CONSTRAINT valid_duration CHECK (duration_hours IN (6, 12, 24, 36)),
  CONSTRAINT valid_blockchain CHECK (blockchain IN ('solana', 'ethereum', 'bsc')),
  CONSTRAINT valid_credits CHECK (credits_cost > 0),
  CONSTRAINT valid_token_name CHECK (char_length(token_name) BETWEEN 1 AND 50),
  CONSTRAINT valid_token_symbol CHECK (char_length(token_symbol) BETWEEN 1 AND 10)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_boost_user_id ON public.token_boost_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_boost_status ON public.token_boost_requests(status);
CREATE INDEX IF NOT EXISTS idx_boost_blockchain ON public.token_boost_requests(blockchain);
CREATE INDEX IF NOT EXISTS idx_boost_requested_at ON public.token_boost_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_boost_active ON public.token_boost_requests(status, expires_at) 
  WHERE status = 'active' AND expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_boost_pending ON public.token_boost_requests(status, requested_at DESC) 
  WHERE status = 'pending';

-- =====================================================
-- ANALYTICS TABLE: token_boost_analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS public.token_boost_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boost_request_id UUID NOT NULL REFERENCES public.token_boost_requests(id) ON DELETE CASCADE,
  
  -- Analytics Data (Simplified - only scan count)
  total_scans INTEGER DEFAULT 0,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(boost_request_id)
);

CREATE INDEX IF NOT EXISTS idx_boost_analytics_boost_id ON public.token_boost_analytics(boost_request_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.token_boost_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_boost_analytics ENABLE ROW LEVEL SECURITY;

-- Users can view their own boost requests
DROP POLICY IF EXISTS "Users can view own boost requests" ON public.token_boost_requests;
CREATE POLICY "Users can view own boost requests" ON public.token_boost_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own boost requests
DROP POLICY IF EXISTS "Users can insert boost requests" ON public.token_boost_requests;
CREATE POLICY "Users can insert boost requests" ON public.token_boost_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- System/Admin can view all boost requests
DROP POLICY IF EXISTS "System can view all boost requests" ON public.token_boost_requests;
CREATE POLICY "System can view all boost requests" ON public.token_boost_requests
  FOR SELECT USING (true);

-- System/Admin can update boost requests
DROP POLICY IF EXISTS "System can update boost requests" ON public.token_boost_requests;
CREATE POLICY "System can update boost requests" ON public.token_boost_requests
  FOR UPDATE USING (true);

-- Analytics policies
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
-- FUNCTIONS
-- =====================================================

-- Function: Deduct credits for boost purchase
CREATE OR REPLACE FUNCTION deduct_boost_credits(
  p_user_id UUID,
  p_boost_id UUID,
  p_credits INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  -- Calculate current balance
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('purchase', 'bonus', 'refund') THEN amount
      WHEN type IN ('scan_deduction', 'boost_purchase') THEN amount
      ELSE 0
    END
  ), 0) INTO v_current_balance
  FROM public.credit_transactions
  WHERE user_id = p_user_id;
  
  -- Check sufficient balance
  IF v_current_balance < p_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient credits'
    );
  END IF;
  
  -- Create deduction transaction
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
    v_current_balance - p_credits,
    'Token boost advertising fee',
    jsonb_build_object('boost_id', p_boost_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'newBalance', v_current_balance - p_credits
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Refund credits if boost rejected
CREATE OR REPLACE FUNCTION refund_boost_credits(
  p_boost_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_boost RECORD;
  v_current_balance INTEGER;
BEGIN
  -- Get boost details
  SELECT * INTO v_boost
  FROM public.token_boost_requests
  WHERE id = p_boost_id;
  
  IF v_boost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Boost not found');
  END IF;
  
  -- Calculate current balance
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('purchase', 'bonus', 'refund') THEN amount
      WHEN type IN ('scan_deduction', 'boost_purchase') THEN amount
      ELSE 0
    END
  ), 0) INTO v_current_balance
  FROM public.credit_transactions
  WHERE user_id = v_boost.user_id;
  
  -- Create refund transaction
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
    v_current_balance + v_boost.credits_cost,
    'Boost request rejected - credits refunded',
    jsonb_build_object('boost_id', p_boost_id, 'reason', v_boost.rejection_reason)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'refundedCredits', v_boost.credits_cost,
    'newBalance', v_current_balance + v_boost.credits_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Increment boost scan count
CREATE OR REPLACE FUNCTION increment_boost_scan_count(
  p_boost_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_current_count INTEGER;
BEGIN
  -- Check if boost is active
  IF NOT EXISTS (
    SELECT 1 FROM public.token_boost_requests
    WHERE id = p_boost_id 
      AND status = 'active'
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Boost is not active or has expired'
    );
  END IF;
  
  -- Insert or update analytics record
  INSERT INTO public.token_boost_analytics (
    boost_request_id,
    total_scans,
    last_scan_at
  ) VALUES (
    p_boost_id,
    1,
    NOW()
  )
  ON CONFLICT (boost_request_id) 
  DO UPDATE SET
    total_scans = token_boost_analytics.total_scans + 1,
    last_scan_at = NOW(),
    updated_at = NOW()
  RETURNING total_scans INTO v_current_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'totalScans', v_current_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Auto-expire old boosts (for cron job)
CREATE OR REPLACE FUNCTION expire_old_boosts()
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE public.token_boost_requests
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
    AND expires_at <= NOW();
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Activate approved boost
CREATE OR REPLACE FUNCTION activate_boost(
  p_boost_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_boost RECORD;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get boost details
  SELECT * INTO v_boost
  FROM public.token_boost_requests
  WHERE id = p_boost_id;
  
  IF v_boost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Boost not found');
  END IF;
  
  IF v_boost.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Boost must be approved first');
  END IF;
  
  -- Calculate expiration time
  v_expires_at := NOW() + (v_boost.duration_hours || ' hours')::INTERVAL;
  
  -- Update boost to active
  UPDATE public.token_boost_requests
  SET status = 'active',
      starts_at = NOW(),
      expires_at = v_expires_at,
      updated_at = NOW()
  WHERE id = p_boost_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'startsAt', NOW(),
    'expiresAt', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check tables created
SELECT 
  'Tables Created' as status,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('token_boost_requests', 'token_boost_analytics');

-- Check RLS enabled
SELECT 
  'RLS Enabled' as status,
  COUNT(*) as count
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('token_boost_requests', 'token_boost_analytics')
  AND rowsecurity = true;

-- Check functions created
SELECT 
  'Functions Created' as status,
  COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'deduct_boost_credits', 
    'refund_boost_credits', 
    'increment_boost_scan_count',
    'expire_old_boosts',
    'activate_boost'
  );

-- =====================================================
-- SUCCESS!
-- =====================================================
-- Expected counts:
-- - Tables Created: 2
-- - RLS Enabled: 2
-- - Functions Created: 5
-- =====================================================

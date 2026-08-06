-- ============================================
-- Manual Credit Purchase System - Database Schema
-- ============================================

-- 1. Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,              -- e.g., "Binance Pay", "USDT BEP-20"
  network VARCHAR(50),                      -- e.g., "BEP-20", "TRC-20", "SOL"
  address TEXT NOT NULL,                    -- Payment address/ID
  qr_code_url TEXT,                         -- Optional QR code image URL
  instructions TEXT,                        -- Payment instructions for users
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create credit_purchase_requests table
CREATE TABLE IF NOT EXISTS credit_purchase_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_package_id VARCHAR(50) NOT NULL,   -- e.g., "package_100", "package_500"
  credits_amount INTEGER NOT NULL,
  price_usd DECIMAL(10, 2) NOT NULL,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
  transaction_hash TEXT NOT NULL UNIQUE,    -- Unique to prevent duplicate submissions
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_credit_requests_status ON credit_purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_credit_requests_user ON credit_purchase_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_requests_created ON credit_purchase_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active, display_order);

-- 4. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Apply updated_at triggers
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_requests_updated_at ON credit_purchase_requests;
CREATE TRIGGER update_credit_requests_updated_at
  BEFORE UPDATE ON credit_purchase_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Create function to add credits on approval
CREATE OR REPLACE FUNCTION handle_credit_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Only process when status changes from pending to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Add credits to user_profiles table
    INSERT INTO public.user_profiles (id, email, display_name, credits_balance)
    VALUES (NEW.user_id, 'user@example.com', 'User', NEW.credits_amount)
    ON CONFLICT (id) 
    DO UPDATE SET 
      credits_balance = public.user_profiles.credits_balance + NEW.credits_amount,
      updated_at = NOW();

    -- Fetch the updated balance
    SELECT credits_balance INTO v_new_balance
    FROM public.user_profiles
    WHERE id = NEW.user_id;

    -- Record transaction in ledger
    INSERT INTO public.credit_transactions (
      user_id,
      type,
      amount,
      balance_after,
      description,
      metadata
    ) VALUES (
      NEW.user_id,
      'purchase',
      NEW.credits_amount,
      v_new_balance,
      'Credit purchase approved — ' || NEW.credit_package_id,
      jsonb_build_object(
        'request_id', NEW.id,
        'package_id', NEW.credit_package_id,
        'price_usd', NEW.price_usd,
        'tx_hash', NEW.transaction_hash
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Apply trigger for automatic credit addition
DROP TRIGGER IF EXISTS trigger_credit_approval ON credit_purchase_requests;
CREATE TRIGGER trigger_credit_approval
  AFTER UPDATE ON credit_purchase_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_credit_approval();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_purchase_requests ENABLE ROW LEVEL SECURITY;

-- Payment Methods Policies

-- Public can view active payment methods
DROP POLICY IF EXISTS "Anyone can view active payment methods" ON payment_methods;
CREATE POLICY "Anyone can view active payment methods"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can insert payment methods
DROP POLICY IF EXISTS "Admins can insert payment methods" ON payment_methods;
CREATE POLICY "Admins can insert payment methods"
  ON payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@anamul.com'
  );

-- Only admins can update payment methods
DROP POLICY IF EXISTS "Admins can update payment methods" ON payment_methods;
CREATE POLICY "Admins can update payment methods"
  ON payment_methods FOR UPDATE
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@anamul.com'
  );

-- Only admins can delete payment methods
DROP POLICY IF EXISTS "Admins can delete payment methods" ON payment_methods;
CREATE POLICY "Admins can delete payment methods"
  ON payment_methods FOR DELETE
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@anamul.com'
  );

-- Credit Purchase Requests Policies

-- Users can view their own requests
DROP POLICY IF EXISTS "Users can view own credit requests" ON credit_purchase_requests;
CREATE POLICY "Users can view own credit requests"
  ON credit_purchase_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all requests
DROP POLICY IF EXISTS "Admins can view all credit requests" ON credit_purchase_requests;
CREATE POLICY "Admins can view all credit requests"
  ON credit_purchase_requests FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@anamul.com'
  );

-- Users can insert their own requests
DROP POLICY IF EXISTS "Users can create credit requests" ON credit_purchase_requests;
CREATE POLICY "Users can create credit requests"
  ON credit_purchase_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only admins can update requests (approve/reject)
DROP POLICY IF EXISTS "Admins can update credit requests" ON credit_purchase_requests;
CREATE POLICY "Admins can update credit requests"
  ON credit_purchase_requests FOR UPDATE
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@anamul.com'
  );

-- ============================================
-- Seed Data - Sample Payment Methods
-- ============================================

-- Insert sample payment methods (admin should configure real ones)
INSERT INTO payment_methods (name, network, address, instructions, is_active, display_order)
VALUES 
  ('Binance Pay', 'Binance', 'REPLACE_WITH_BINANCE_ID', 'Send payment via Binance Pay to this ID', true, 1),
  ('USDT (BEP-20)', 'BEP-20', 'REPLACE_WITH_BEP20_ADDRESS', 'Send USDT on Binance Smart Chain (BEP-20)', true, 2),
  ('USDT (TRC-20)', 'TRC-20', 'REPLACE_WITH_TRC20_ADDRESS', 'Send USDT on TRON network (TRC-20)', true, 3)
ON CONFLICT DO NOTHING;

-- ============================================
-- Helper Functions for Admin
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@anamul.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Views for Admin Dashboard
-- ============================================

-- View for pending requests with user details
CREATE OR REPLACE VIEW pending_credit_requests AS
SELECT 
  cpr.*,
  u.email as user_email,
  pm.name as payment_method_name,
  pm.network as payment_network
FROM credit_purchase_requests cpr
JOIN auth.users u ON cpr.user_id = u.id
JOIN payment_methods pm ON cpr.payment_method_id = pm.id
WHERE cpr.status = 'pending'
ORDER BY cpr.created_at DESC;

-- Grant access to admin
GRANT SELECT ON pending_credit_requests TO authenticated;

-- ============================================
-- INSTALLATION COMPLETE
-- ============================================

-- Run this SQL in your Supabase SQL Editor
-- After running, configure real payment addresses in the admin panel

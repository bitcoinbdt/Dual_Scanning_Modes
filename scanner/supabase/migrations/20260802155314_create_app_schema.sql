/*
# OnChain Alpha Token Scanner - Core Schema

1. New Tables
- `profiles`: extends auth.users with credits, referral_code, referred_by, full_name. 20 free credits on signup.
- `payment_methods`: admin-managed crypto payment methods (Binance, KuCoin, USDT, USDC, TRX).
- `credit_requests`: user credit purchase requests with tx hash, status, admin notes.
- `referrals`: referral earnings history.
- `scan_history`: record of token scans.

2. Functions
- `is_admin()`: SECURITY DEFINER, returns true if current user's email is admin@anamul.com.
- `handle_new_user()`: trigger on auth.users INSERT — auto-creates profile with 20 free credits + unique referral code + applies referred_by.
- `approve_credit_request(uuid, text)`: SECURITY DEFINER — admin approves pending request, adds credits, awards referral bonus on first purchase.
- `reject_credit_request(uuid, text)`: SECURITY DEFINER — admin rejects pending request (notes required).

3. Security (RLS)
- profiles: users read/update own; admin reads all.
- payment_methods: public SELECT; admin-only INSERT/UPDATE/DELETE.
- credit_requests: users SELECT own + INSERT; admin SELECT all.
- referrals: users SELECT own (as referrer); admin SELECT all.
- scan_history: users SELECT/INSERT own.

4. Notes
- Admin identified by email admin@anamul.com via is_admin().
- Referral bonus only on referred user's FIRST approved purchase: Starter 10%, Basic 15%, Pro 20%, Premium 25%.
- 20 free credits granted on signup via trigger.
*/

-- ============================================================
-- IS_ADMIN helper (must exist before policies reference it)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'admin@anamul.com'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  credits integer NOT NULL DEFAULT 20,
  referral_code text UNIQUE NOT NULL DEFAULT '',
  referred_by text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- PAYMENT METHODS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  network text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  qr_code_url text DEFAULT NULL,
  instructions text DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_payment_methods" ON payment_methods;
CREATE POLICY "read_payment_methods" ON payment_methods FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_payment_methods" ON payment_methods;
CREATE POLICY "admin_insert_payment_methods" ON payment_methods FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_payment_methods" ON payment_methods;
CREATE POLICY "admin_update_payment_methods" ON payment_methods FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_payment_methods" ON payment_methods;
CREATE POLICY "admin_delete_payment_methods" ON payment_methods FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- CREDIT REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  user_email text NOT NULL DEFAULT '',
  package_name text NOT NULL DEFAULT '',
  credits integer NOT NULL DEFAULT 0,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  payment_method_id uuid DEFAULT NULL REFERENCES payment_methods(id) ON DELETE SET NULL,
  payment_method_name text NOT NULL DEFAULT '',
  payment_method_network text NOT NULL DEFAULT '',
  tx_hash text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text DEFAULT NULL,
  reviewed_at timestamptz DEFAULT NULL,
  reviewed_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_requests_status ON credit_requests(status);
CREATE INDEX IF NOT EXISTS idx_credit_requests_user ON credit_requests(user_id);

ALTER TABLE credit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_requests" ON credit_requests;
CREATE POLICY "select_own_requests" ON credit_requests FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_requests" ON credit_requests;
CREATE POLICY "insert_own_requests" ON credit_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_requests" ON credit_requests;
CREATE POLICY "update_own_requests" ON credit_requests FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- REFERRALS
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code text NOT NULL DEFAULT '',
  bonus_credits integer NOT NULL DEFAULT 0,
  package_name text NOT NULL DEFAULT '',
  purchase_credits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_referrals" ON referrals;
CREATE POLICY "select_own_referrals" ON referrals FOR SELECT
  TO authenticated USING (auth.uid() = referrer_id OR public.is_admin());

-- ============================================================
-- SCAN HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'basic',
  chain text NOT NULL DEFAULT 'auto',
  token_address text NOT NULL DEFAULT '',
  token_symbol text NOT NULL DEFAULT '',
  credits_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_history_user ON scan_history(user_id);

ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scans" ON scan_history;
CREATE POLICY "select_own_scans" ON scan_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_scans" ON scan_history;
CREATE POLICY "insert_own_scans" ON scan_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- handle_new_user trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_code text;
  new_code text;
  attempts integer := 0;
BEGIN
  base_code := upper(regexp_replace(split_part(NEW.email, '@', 1), '[^A-Za-z0-9]', '', 'g'));
  IF char_length(base_code) < 3 THEN
    base_code := 'USER';
  END IF;
  base_code := left(base_code, 4);

  LOOP
    new_code := base_code || lpad(floor(random() * 10000)::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = new_code);
    attempts := attempts + 1;
    IF attempts > 50 THEN
      new_code := upper(left(regexp_replace(md5(NEW.id::text || random()::text), '[^A-Za-z0-9]', '', 'g'), 8));
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO profiles (id, email, full_name, credits, referral_code, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    20,
    new_code,
    COALESCE(NEW.raw_user_meta_data->>'referred_by', NULL)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- approve_credit_request (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_credit_request(
  p_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req credit_requests%ROWTYPE;
  buyer_id uuid;
  buyer_referral text;
  referrer_row profiles%ROWTYPE;
  bonus_pct numeric;
  bonus_credits integer;
  pkg text;
  pkg_credits integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can approve credit requests';
  END IF;

  SELECT * INTO req FROM credit_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  buyer_id := req.user_id;
  pkg := req.package_name;
  pkg_credits := req.credits;

  UPDATE profiles SET credits = credits + pkg_credits WHERE id = buyer_id;

  bonus_pct := CASE pkg
    WHEN 'Starter' THEN 0.10
    WHEN 'Basic' THEN 0.15
    WHEN 'Pro' THEN 0.20
    WHEN 'Premium' THEN 0.25
    ELSE 0.10
  END;
  bonus_credits := floor(pkg_credits * bonus_pct)::integer;

  SELECT referred_by INTO buyer_referral FROM profiles WHERE id = buyer_id;
  IF buyer_referral IS NOT NULL AND bonus_credits > 0 THEN
    SELECT * INTO referrer_row FROM profiles WHERE referral_code = buyer_referral AND id <> buyer_id;
    IF FOUND AND NOT EXISTS (SELECT 1 FROM referrals WHERE referred_id = buyer_id) THEN
      UPDATE profiles SET credits = credits + bonus_credits WHERE id = referrer_row.id;
      INSERT INTO referrals (referrer_id, referred_id, referral_code, bonus_credits, package_name, purchase_credits)
      VALUES (referrer_row.id, buyer_id, buyer_referral, bonus_credits, pkg, pkg_credits);
    END IF;
  END IF;

  UPDATE credit_requests
  SET status = 'approved',
      admin_notes = p_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_credit_request(uuid, text) TO authenticated;

-- ============================================================
-- reject_credit_request (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_credit_request(
  p_request_id uuid,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req credit_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can reject credit requests';
  END IF;
  IF p_notes IS NULL OR trim(p_notes) = '' THEN
    RAISE EXCEPTION 'Rejection notes are required';
  END IF;

  SELECT * INTO req FROM credit_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  UPDATE credit_requests
  SET status = 'rejected',
      admin_notes = p_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_credit_request(uuid, text) TO authenticated;

-- ============================================================
-- Seed default payment methods
-- ============================================================
INSERT INTO payment_methods (name, network, address, is_active, display_order, instructions)
VALUES
  ('Binance Pay', 'BSC', '', true, 1, 'Send the exact USD equivalent to the Binance Pay ID below, then paste the transaction hash.'),
  ('KuCoin', 'TRC-20', '', true, 2, 'Transfer to the KuCoin deposit address below, then paste the transaction hash.'),
  ('USDT', 'TRC-20', '', true, 3, 'Send USDT (TRC-20) to the address below, then paste the transaction hash.'),
  ('USDC', 'TRC-20', '', true, 4, 'Send USDC (TRC-20) to the address below, then paste the transaction hash.'),
  ('TRX', 'TRC-20', '', true, 5, 'Send TRX to the address below, then paste the transaction hash.')
ON CONFLICT DO NOTHING;

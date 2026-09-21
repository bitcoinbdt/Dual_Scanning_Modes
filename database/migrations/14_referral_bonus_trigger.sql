-- FIX-1.2: Referral bonus trigger on credit approval
DROP TRIGGER IF EXISTS trigger_credit_approval ON credit_purchase_requests;

CREATE OR REPLACE FUNCTION handle_credit_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_new_balance INTEGER;
  v_referrer_id UUID;
  v_referral_id UUID;
  v_bonus_credits INTEGER;
  v_percentage NUMERIC;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- add credits to buyer
    INSERT INTO public.user_profiles (id, email, display_name, credits_balance)
    VALUES (
      NEW.user_id,
      COALESCE((SELECT email FROM auth.users WHERE id = NEW.user_id), 'user@example.com'),
      'User',
      NEW.credits_amount
    )
    ON CONFLICT (id) DO UPDATE
    SET credits_balance = public.user_profiles.credits_balance + NEW.credits_amount,
        updated_at = NOW();

    SELECT credits_balance INTO v_new_balance FROM public.user_profiles WHERE id = NEW.user_id;

    INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, metadata)
    VALUES (NEW.user_id, 'purchase', NEW.credits_amount, v_new_balance,
      'Credit purchase approved — ' || NEW.credit_package_id,
      jsonb_build_object('request_id', NEW.id, 'package_id', NEW.credit_package_id, 'price_usd', NEW.price_usd));

    -- referral bonus (first purchase only)
    SELECT referrer_user_id, id INTO v_referrer_id, v_referral_id
    FROM public.referrals
    WHERE referred_user_id = NEW.user_id
      AND status IN ('pending', 'confirmed')
    LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      v_percentage := CASE NEW.credit_package_id
        WHEN 'starter' THEN 0.20 WHEN 'basic' THEN 0.25
        WHEN 'pro' THEN 0.30 WHEN 'premium' THEN 0.35 ELSE 0 END;
      v_bonus_credits := FLOOR(NEW.credits_amount * v_percentage);

      IF v_bonus_credits > 0 THEN
        UPDATE public.user_profiles
        SET credits_balance = credits_balance + v_bonus_credits, updated_at = NOW()
        WHERE id = v_referrer_id;

        SELECT credits_balance INTO v_new_balance FROM public.user_profiles WHERE id = v_referrer_id;

        INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, metadata)
        VALUES (v_referrer_id, 'bonus', v_bonus_credits, v_new_balance,
          'Referral bonus — ' || NEW.credit_package_id,
          jsonb_build_object('referral_id', v_referral_id, 'package_id', NEW.credit_package_id));

        UPDATE public.referrals
        SET status = 'rewarded', bonus_credits_awarded = v_bonus_credits, first_purchase_at = NOW(), updated_at = NOW()
        WHERE id = v_referral_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_credit_approval
  AFTER UPDATE ON credit_purchase_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_credit_approval();

-- =====================================================
-- WALLET ENRICHMENT BG WORKER DISPATCH PATH (pg_net)
-- Migration 07 — Phase 5C-H Infrastructure Hardening
-- =====================================================
--
-- Enables pg_net extension and attaches a trigger to
-- wallet_enrichment_jobs to automatically POST new jobs
-- to the Next.js API worker endpoint.
--
-- Environment settings (URL and Secret) are retrieved
-- dynamically from GUC settings to prevent hardcoding.
-- =====================================================

-- 1. Enable pg_net extension if available
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- 2. Create the dispatch trigger function
CREATE OR REPLACE FUNCTION public.trg_wallet_enrichment_jobs_dispatch()
RETURNS TRIGGER AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_payload JSONB;
  v_headers JSONB;
BEGIN
  -- Only dispatch for pending jobs
  IF NEW.status = 'pending' THEN
    -- Retrieve configurations from GUC database settings (returns NULL if unset)
    v_url := current_setting('app.settings.wallet_worker_url', true);
    v_secret := current_setting('app.settings.worker_secret_key', true);

    -- If either is not set, log warning and exit (do not block transaction)
    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE WARNING 'Wallet enrichment background worker URL or secret key not configured in current_setting.';
      RETURN NEW;
    END IF;

    -- Construct minimal payload and request headers
    v_payload := jsonb_build_object(
      'address', NEW.address,
      'chain', NEW.chain
    );
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', v_secret
    );

    -- Dispatch request via pg_net asynchronously
    -- Wrap in exception block to prevent pg_net failures from aborting transaction
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        headers := v_headers,
        body := v_payload::text
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to dispatch pg_net HTTP request: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to wallet_enrichment_jobs
DROP TRIGGER IF EXISTS trg_wallet_enrichment_jobs_after_insert ON public.wallet_enrichment_jobs;
CREATE TRIGGER trg_wallet_enrichment_jobs_after_insert
  AFTER INSERT ON public.wallet_enrichment_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_wallet_enrichment_jobs_dispatch();

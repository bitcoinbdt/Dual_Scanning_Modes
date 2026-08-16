-- =====================================================
-- MIGRATION 10 — Register Scheduled Cron Jobs
-- Phase 5D-5 Production Scheduler Activation
-- =====================================================
--
-- Purpose:
--   Activate the pg_cron daily retention job for the
--   historical_pool_reserves and historical_pool_indexing_jobs
--   tables. The cleanup function was defined in migration 09
--   but the scheduler registration was intentionally deferred
--   until the pg_cron extension is confirmed enabled on the
--   target Supabase instance.
--
-- Prerequisites:
--   1. pg_cron extension must be enabled on the Supabase instance.
--      Enable via: Dashboard → Database → Extensions → pg_cron
--      Or manually: CREATE EXTENSION IF NOT EXISTS pg_cron;
--
--   2. Migration 09 must have been applied first.
--      (public.cleanup_historical_pool_reserves must exist.)
--
-- Schedule:
--   '0 3 * * *' — runs daily at 03:00 UTC.
--   Chosen to minimise contention during expected off-peak hours.
--
-- Idempotency:
--   cron.unschedule() is called first so re-running this migration
--   is safe and will not create duplicate cron.job entries.
--
-- Rollback:
--   SELECT cron.unschedule('cleanup-historical-reserves');
-- =====================================================

-- 1. Remove any prior registration to ensure idempotency.
--    This is a no-op when the job does not exist, safe on fresh instances.
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('cleanup-historical-reserves');
  EXCEPTION WHEN OTHERS THEN
    -- pg_cron not yet enabled or job not found — safe to continue.
    RAISE NOTICE 'cron.unschedule skipped (job not found or pg_cron not enabled): %', SQLERRM;
  END;
END;
$$;

-- 2. Register the daily retention cleanup job.
SELECT cron.schedule(
  'cleanup-historical-reserves',
  '0 3 * * *',
  $$SELECT public.cleanup_historical_pool_reserves()$$
);

-- 3. Confirm registration with a notice.
DO $$
DECLARE
  rec RECORD;
BEGIN
  SELECT jobname, schedule, command
    INTO rec
    FROM cron.job
   WHERE jobname = 'cleanup-historical-reserves';

  IF rec IS NULL THEN
    RAISE WARNING 'pg_cron job registration FAILED — cron.job row not found after INSERT.';
  ELSE
    RAISE NOTICE 'pg_cron job registered successfully: jobname=% schedule=% command=%',
      rec.jobname, rec.schedule, rec.command;
  END IF;
END;
$$;

-- =====================================================
-- VERIFICATION QUERY (run manually after migration):
-- =====================================================
--   SELECT jobname, schedule, command, active
--     FROM cron.job
--    WHERE jobname = 'cleanup-historical-reserves';
--   -- Expected: 1 row, active = true.
--
-- MANUAL DRY-RUN TEST:
--   SELECT public.cleanup_historical_pool_reserves();
--   -- Returns integer count of rows purged (0 when table is < 30 days old).
-- =====================================================

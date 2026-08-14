-- =====================================================
-- HISTORICAL POOL RESERVES INDEXER SCHEMA
-- Migration 09 — Phase 5D-5 HistoricalBehavior Infrastructure
-- =====================================================
--
-- Creates:
--   public.historical_pool_reserves        — time-series V2 pool reserve snapshots
--   public.historical_pool_indexing_jobs   — async queue for reserve indexing tasks
--
-- Uniqueness strategy:
--   UNIQUE(chain, pool_address, block_number) — one canonical record per block.
--   If a reorg changes the block_hash for a known block_number, the worker
--   performs an ON CONFLICT DO UPDATE that overwrites the orphaned record.
--   This guarantees exactly one canonical row per pool per block number.
--
-- Anti-fabrication:
--   block_hash and timestamp are NOT NULL — they must be explicitly proved
--   via eth_getBlockByNumber before a row is inserted as 'available'.
--   reserve0/reserve1 are NUMERIC to preserve full uint112 precision without
--   JavaScript Number coercion.
--
-- Retention:
--   Both tables are bounded to 30 days by a scheduled cleanup function.
--   pg_cron or equivalent scheduler must be configured separately in production.
-- =====================================================

-- 1. HISTORICAL POOL RESERVES TABLE
CREATE TABLE IF NOT EXISTS public.historical_pool_reserves (
  id            UUID                     DEFAULT gen_random_uuid() NOT NULL,
  chain         VARCHAR(20)              NOT NULL,
  pool_address  VARCHAR(64)              NOT NULL,
  pool_type     VARCHAR(20)              NOT NULL DEFAULT 'v2',
  token0        VARCHAR(64)              DEFAULT NULL,
  token1        VARCHAR(64)              DEFAULT NULL,
  block_number  BIGINT                   NOT NULL,
  block_hash    VARCHAR(66)              NOT NULL,
  timestamp     TIMESTAMP WITH TIME ZONE NOT NULL,
  reserve0      NUMERIC                  NOT NULL,
  reserve1      NUMERIC                  NOT NULL,
  provider      VARCHAR(20)              NOT NULL DEFAULT 'alchemy',
  indexed_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT unique_historical_reserves UNIQUE (chain, pool_address, block_number)
);

-- Index for time-series queries by pool (Phase 5D-6 consumers)
CREATE INDEX IF NOT EXISTS idx_historical_reserves_pool_time
  ON public.historical_pool_reserves (pool_address, chain, timestamp DESC);

-- Index for retention cleanup (DELETE WHERE timestamp < threshold)
CREATE INDEX IF NOT EXISTS idx_historical_reserves_timestamp
  ON public.historical_pool_reserves (timestamp);

-- 2. HISTORICAL POOL INDEXING JOBS QUEUE TABLE
--
-- Separate from indexing_jobs (wallet-oriented). This table is pool+block-oriented.
-- UNIQUE(chain, pool_address, block_number) prevents duplicate job scheduling.
CREATE TABLE IF NOT EXISTS public.historical_pool_indexing_jobs (
  id            UUID                     DEFAULT gen_random_uuid() NOT NULL,
  chain         VARCHAR(20)              NOT NULL,
  pool_address  VARCHAR(64)              NOT NULL,
  block_number  BIGINT                   NOT NULL,
  status        VARCHAR(20)              DEFAULT 'pending' NOT NULL,
  attempts      INTEGER                  DEFAULT 0 NOT NULL,
  last_error    TEXT                     DEFAULT NULL,
  enqueued_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  started_at    TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  completed_at  TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT unique_pool_indexing_job UNIQUE (chain, pool_address, block_number)
);

-- Index for status-based queue polling
CREATE INDEX IF NOT EXISTS idx_pool_indexing_jobs_status
  ON public.historical_pool_indexing_jobs (status, enqueued_at);

-- Index for retention cleanup
CREATE INDEX IF NOT EXISTS idx_pool_indexing_jobs_enqueued
  ON public.historical_pool_indexing_jobs (enqueued_at);

-- =====================================================
-- ROW LEVEL SECURITY (consistent with migrations 06, 07, 08)
-- =====================================================
-- Enabling RLS on both tables ensures that anonymous and authenticated users
-- can only read data (via the SELECT policies below) but cannot insert, update,
-- or delete records. The service_role client automatically bypasses RLS.
ALTER TABLE public.historical_pool_reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_pool_indexing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historical_pool_reserves_select" ON public.historical_pool_reserves;
CREATE POLICY "historical_pool_reserves_select"
  ON public.historical_pool_reserves FOR SELECT USING (true);

DROP POLICY IF EXISTS "historical_pool_indexing_jobs_select" ON public.historical_pool_indexing_jobs;
CREATE POLICY "historical_pool_indexing_jobs_select"
  ON public.historical_pool_indexing_jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "historical_pool_reserves_service_all" ON public.historical_pool_reserves;
DROP POLICY IF EXISTS "historical_pool_indexing_jobs_service_all" ON public.historical_pool_indexing_jobs;

-- =====================================================
-- PG_NET ASYNC WORKER DISPATCH TRIGGER
-- (consistent with migrations 07 and 08 pg_net conventions)
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_historical_pool_jobs_dispatch()
RETURNS TRIGGER AS $$
DECLARE
  v_url     TEXT;
  v_secret  TEXT;
  v_payload JSONB;
  v_headers JSONB;
BEGIN
  -- Trigger dispatch on INSERT or when status is updated back to 'pending'
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status)) THEN
    v_url    := current_setting('app.settings.historical_reserves_worker_url', true);
    v_secret := current_setting('app.settings.worker_secret_key', true);

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE WARNING 'Historical reserves worker URL or secret key not configured in current_setting.';
      RETURN NEW;
    END IF;

    v_payload := jsonb_build_object(
      'chain',        NEW.chain,
      'poolAddress',  NEW.pool_address,
      'blockNumber',  NEW.block_number,
      'poolType',     'v2'
    );
    v_headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-worker-secret', v_secret
    );

    BEGIN
      PERFORM net.http_post(
        url     := v_url,
        headers := v_headers,
        body    := v_payload::text
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to dispatch pg_net HTTP request for historical pool indexing: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_historical_pool_jobs_after_insert ON public.historical_pool_indexing_jobs;
DROP TRIGGER IF EXISTS trg_historical_pool_jobs_after_insert_or_update ON public.historical_pool_indexing_jobs;
CREATE TRIGGER trg_historical_pool_jobs_after_insert_or_update
  AFTER INSERT OR UPDATE OF status ON public.historical_pool_indexing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_historical_pool_jobs_dispatch();

-- =====================================================
-- RETENTION CLEANUP FUNCTION
-- =====================================================
-- Call via pg_cron: SELECT cron.schedule('cleanup-historical-reserves', '0 3 * * *',
--   $$SELECT public.cleanup_historical_pool_reserves()$$);
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_historical_pool_reserves()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH batch AS (
    SELECT id FROM public.historical_pool_reserves
    WHERE timestamp < NOW() - INTERVAL '30 days'
    LIMIT 5000
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.historical_pool_reserves
  WHERE id IN (SELECT id FROM batch);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  WITH job_batch AS (
    SELECT id FROM public.historical_pool_indexing_jobs
    WHERE enqueued_at < NOW() - INTERVAL '30 days'
      AND status IN ('completed', 'failed')
    LIMIT 5000
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.historical_pool_indexing_jobs
  WHERE id IN (SELECT id FROM job_batch);

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

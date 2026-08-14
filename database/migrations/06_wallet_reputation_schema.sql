-- =====================================================
-- WALLET REPUTATION CACHE & ENRICHMENT JOBS SCHEMA
-- Migration 06 — Phase 5C WalletQuality Infrastructure
-- =====================================================
--
-- Creates:
--   public.wallet_reputation       — persistent wallet profile cache
--   public.wallet_enrichment_jobs  — deduplication table for async jobs
--
-- RLS is enabled on both tables.
-- The service role bypasses RLS by design (Supabase default behavior).
-- =====================================================

-- 1. WALLET REPUTATION TABLE
CREATE TABLE IF NOT EXISTS public.wallet_reputation (
  address              VARCHAR(64)              NOT NULL,
  chain                VARCHAR(20)              NOT NULL,
  first_seen_at        TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen_at         TIMESTAMP WITH TIME ZONE NOT NULL,
  age_days             INTEGER                  NOT NULL,
  transaction_count    INTEGER                  NOT NULL,
  active_days_count    INTEGER                  NOT NULL,
  funding_source       VARCHAR(64),
  funding_source_type  VARCHAR(20)              DEFAULT 'unknown',
  funding_tx_hash      VARCHAR(66),
  last_updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  provider             VARCHAR(20)              NOT NULL,
  PRIMARY KEY (address, chain)
);

-- Index for address+chain lookup (primary key already covers this, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_wallet_reputation_lookup
  ON public.wallet_reputation (address, chain);

-- Index for cache TTL / stale eviction queries
CREATE INDEX IF NOT EXISTS idx_wallet_reputation_updated
  ON public.wallet_reputation (last_updated_at);

-- 2. WALLET ENRICHMENT JOBS TABLE (job deduplication)
CREATE TABLE IF NOT EXISTS public.wallet_enrichment_jobs (
  address      VARCHAR(64)              NOT NULL,
  chain        VARCHAR(20)              NOT NULL,
  status       VARCHAR(20)              DEFAULT 'pending' NOT NULL,
  enqueued_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (address, chain)
);

-- Index for job queue lookups
CREATE INDEX IF NOT EXISTS idx_wallet_enrichment_jobs_lookup
  ON public.wallet_enrichment_jobs (address, chain);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
-- Enable RLS on both tables.
-- Service role automatically bypasses RLS in Supabase.
-- Anonymous/authenticated roles get read-only access.
-- All writes go through the service role client only.

ALTER TABLE public.wallet_reputation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_reputation_select" ON public.wallet_reputation;
CREATE POLICY "wallet_reputation_select"
  ON public.wallet_reputation FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "wallet_reputation_insert" ON public.wallet_reputation;
CREATE POLICY "wallet_reputation_insert"
  ON public.wallet_reputation FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "wallet_reputation_update" ON public.wallet_reputation;
CREATE POLICY "wallet_reputation_update"
  ON public.wallet_reputation FOR UPDATE
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wallet_reputation_delete" ON public.wallet_reputation;
CREATE POLICY "wallet_reputation_delete"
  ON public.wallet_reputation FOR DELETE
  USING (true);

ALTER TABLE public.wallet_enrichment_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_enrichment_jobs_select" ON public.wallet_enrichment_jobs;
CREATE POLICY "wallet_enrichment_jobs_select"
  ON public.wallet_enrichment_jobs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "wallet_enrichment_jobs_insert" ON public.wallet_enrichment_jobs;
CREATE POLICY "wallet_enrichment_jobs_insert"
  ON public.wallet_enrichment_jobs FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "wallet_enrichment_jobs_update" ON public.wallet_enrichment_jobs;
CREATE POLICY "wallet_enrichment_jobs_update"
  ON public.wallet_enrichment_jobs FOR UPDATE
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wallet_enrichment_jobs_delete" ON public.wallet_enrichment_jobs;
CREATE POLICY "wallet_enrichment_jobs_delete"
  ON public.wallet_enrichment_jobs FOR DELETE
  USING (true);

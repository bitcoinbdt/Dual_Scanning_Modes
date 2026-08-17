-- =====================================================
-- SCANNER UPGRADES DATABASE SCHEMA
-- Migration 13 — Phase 1: Database Setup & Schema Migrations
-- =====================================================
--
-- Creates:
--   public.scan_snapshots         — scan results frozen point-in-time snapshots (nanoid based)
--   public.token_unlock_schedules — caches token lock agreements and vesting calendars
--   public.token_social_cache     — caches verified website, Twitter age, and consistency
--   public.known_ruggers          — registry of known deployer address bad actors
--   public.ai_scan_cache          — caches news summaries and exchange listing checks
--
-- RLS is enabled on all tables.
-- =====================================================

-- 1. SCAN SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS public.scan_snapshots (
  id              TEXT                     PRIMARY KEY, -- prefix-nanoid format e.g. "ds-R2vL5cNj"
  scan_type       TEXT                     NOT NULL,
  token_address   TEXT                     NOT NULL,
  chain           TEXT                     NOT NULL,
  token_symbol    TEXT,
  token_name      TEXT,
  result_json     JSONB                    NOT NULL,
  user_id         UUID                     REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  scanned_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at      TIMESTAMP WITH TIME ZONE,
  view_count      INTEGER                  DEFAULT 0 NOT NULL,
  is_public       BOOLEAN                  DEFAULT TRUE NOT NULL,
  CONSTRAINT valid_scan_type CHECK (scan_type IN ('basic', 'elevator', 'deep'))
);

CREATE INDEX IF NOT EXISTS idx_snapshot_token 
  ON public.scan_snapshots (token_address, chain, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshot_user 
  ON public.scan_snapshots (user_id, scanned_at DESC);


-- 2. TOKEN UNLOCK SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS public.token_unlock_schedules (
  id                      UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address           TEXT                     NOT NULL,
  chain                   TEXT                     NOT NULL,
  total_locked_percentage DECIMAL(5, 2)            NOT NULL,
  next_unlock_at          TIMESTAMP WITH TIME ZONE,
  next_unlock_percentage  DECIMAL(5, 2)            NOT NULL,
  next_unlock_usd_value   DECIMAL(18, 2),
  vesting_details         JSONB,
  last_updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(token_address, chain)
);

CREATE INDEX IF NOT EXISTS idx_unlock_imminent 
  ON public.token_unlock_schedules (next_unlock_at ASC) 
  WHERE next_unlock_at >= NOW();


-- 3. TOKEN SOCIAL CACHE TABLE
CREATE TABLE IF NOT EXISTS public.token_social_cache (
  id                       UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address            TEXT                     NOT NULL,
  chain                    TEXT                     NOT NULL,
  website                  TEXT,
  twitter                  TEXT,
  telegram                 TEXT,
  discord                  TEXT,
  github                   TEXT,
  website_alive            BOOLEAN,
  twitter_account_age_days INTEGER,
  website_domain_age_days  INTEGER,
  github_last_commit_days  INTEGER,
  social_consistent        BOOLEAN,
  social_conflicts         JSONB,
  source                   TEXT,
  cached_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(token_address, chain)
);

CREATE INDEX IF NOT EXISTS idx_social_cache_staleness 
  ON public.token_social_cache (cached_at ASC);


-- 4. KNOWN RUGGERS TABLE
CREATE TABLE IF NOT EXISTS public.known_ruggers (
  id                  UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  deployer_address    TEXT                     NOT NULL,
  chain               TEXT                     NOT NULL,
  confirmed_rugs      INTEGER                  DEFAULT 0 NOT NULL,
  total_tokens        INTEGER                  DEFAULT 0 NOT NULL,
  rug_token_addresses TEXT[]                   DEFAULT '{}' NOT NULL,
  rug_confirmed_at    TIMESTAMP WITH TIME ZONE[] DEFAULT '{}' NOT NULL,
  rug_methods         TEXT[]                   DEFAULT '{}' NOT NULL,
  source              TEXT,
  first_seen_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(deployer_address, chain)
);


-- 5. AI SCAN CACHE TABLE
CREATE TABLE IF NOT EXISTS public.ai_scan_cache (
  id            UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT                     NOT NULL,
  chain         TEXT                     NOT NULL,
  query_type    TEXT                     NOT NULL,
  result_json   JSONB                    NOT NULL,
  provider_used TEXT                     NOT NULL,
  cached_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at    TIMESTAMP WITH TIME ZONE,
  UNIQUE(token_address, chain, query_type)
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.scan_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_unlock_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_social_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.known_ruggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_scan_cache ENABLE ROW LEVEL SECURITY;

-- 1. scan_snapshots policies
DROP POLICY IF EXISTS "scan_snapshots_select" ON public.scan_snapshots;
CREATE POLICY "scan_snapshots_select" ON public.scan_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "scan_snapshots_insert" ON public.scan_snapshots;
CREATE POLICY "scan_snapshots_insert" ON public.scan_snapshots FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "scan_snapshots_update" ON public.scan_snapshots;
CREATE POLICY "scan_snapshots_update" ON public.scan_snapshots FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "scan_snapshots_delete" ON public.scan_snapshots;
CREATE POLICY "scan_snapshots_delete" ON public.scan_snapshots FOR DELETE USING (true);

-- 2. token_unlock_schedules policies
DROP POLICY IF EXISTS "token_unlock_schedules_select" ON public.token_unlock_schedules;
CREATE POLICY "token_unlock_schedules_select" ON public.token_unlock_schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "token_unlock_schedules_insert" ON public.token_unlock_schedules;
CREATE POLICY "token_unlock_schedules_insert" ON public.token_unlock_schedules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "token_unlock_schedules_update" ON public.token_unlock_schedules;
CREATE POLICY "token_unlock_schedules_update" ON public.token_unlock_schedules FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "token_unlock_schedules_delete" ON public.token_unlock_schedules;
CREATE POLICY "token_unlock_schedules_delete" ON public.token_unlock_schedules FOR DELETE USING (true);

-- 3. token_social_cache policies
DROP POLICY IF EXISTS "token_social_cache_select" ON public.token_social_cache;
CREATE POLICY "token_social_cache_select" ON public.token_social_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "token_social_cache_insert" ON public.token_social_cache;
CREATE POLICY "token_social_cache_insert" ON public.token_social_cache FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "token_social_cache_update" ON public.token_social_cache;
CREATE POLICY "token_social_cache_update" ON public.token_social_cache FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "token_social_cache_delete" ON public.token_social_cache;
CREATE POLICY "token_social_cache_delete" ON public.token_social_cache FOR DELETE USING (true);

-- 4. known_ruggers policies
DROP POLICY IF EXISTS "known_ruggers_select" ON public.known_ruggers;
CREATE POLICY "known_ruggers_select" ON public.known_ruggers FOR SELECT USING (true);

DROP POLICY IF EXISTS "known_ruggers_insert" ON public.known_ruggers;
CREATE POLICY "known_ruggers_insert" ON public.known_ruggers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "known_ruggers_update" ON public.known_ruggers;
CREATE POLICY "known_ruggers_update" ON public.known_ruggers FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "known_ruggers_delete" ON public.known_ruggers;
CREATE POLICY "known_ruggers_delete" ON public.known_ruggers FOR DELETE USING (true);

-- 5. ai_scan_cache policies
DROP POLICY IF EXISTS "ai_scan_cache_select" ON public.ai_scan_cache;
CREATE POLICY "ai_scan_cache_select" ON public.ai_scan_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "ai_scan_cache_insert" ON public.ai_scan_cache;
CREATE POLICY "ai_scan_cache_insert" ON public.ai_scan_cache FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ai_scan_cache_update" ON public.ai_scan_cache;
CREATE POLICY "ai_scan_cache_update" ON public.ai_scan_cache FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ai_scan_cache_delete" ON public.ai_scan_cache;
CREATE POLICY "ai_scan_cache_delete" ON public.ai_scan_cache FOR DELETE USING (true);

-- =====================================================
-- SMART MONEY INDEXER & REPUTATION CACHE SCHEMA
-- Migration 08 — Phase 5D-1 & 5D-2 SmartMoney Infrastructure
-- =====================================================

-- 1. WALLET TRADE HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.wallet_trade_history (
  wallet_address  VARCHAR(64)              NOT NULL,
  chain           VARCHAR(20)              NOT NULL,
  token_address   VARCHAR(64),
  tx_hash         VARCHAR(66)              NOT NULL,
  block_number    BIGINT                   NOT NULL,
  block_hash      VARCHAR(66),
  log_index       INTEGER                  NOT NULL DEFAULT -1,
  timestamp       TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type      VARCHAR(20)              DEFAULT 'unknown',
  token_amount    NUMERIC,
  quote_amount    NUMERIC,
  quote_token     VARCHAR(64),
  provider        VARCHAR(20)              NOT NULL,
  indexed_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (wallet_address, chain, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_wallet_trade_history_lookup
  ON public.wallet_trade_history (wallet_address, chain);

CREATE INDEX IF NOT EXISTS idx_wallet_trade_history_token
  ON public.wallet_trade_history (token_address);

-- 2. SMART MONEY REPUTATION CACHE TABLE
CREATE TABLE IF NOT EXISTS public.smart_money_reputation (
  wallet_address         VARCHAR(64)              NOT NULL,
  chain                  VARCHAR(20)              NOT NULL,
  trade_count            INTEGER                  DEFAULT NULL, -- Deprecated/kept for backwards compat
  profitable_trades      INTEGER                  DEFAULT NULL, -- Deprecated/kept for backwards compat
  realized_usd_pnl       NUMERIC                  DEFAULT NULL, -- Deprecated/kept for backwards compat
  distinct_tokens        INTEGER                  DEFAULT NULL, -- Deprecated/kept for backwards compat
  total_indexed_events   INTEGER                  DEFAULT NULL,
  recognized_swap_count  INTEGER                  DEFAULT NULL,
  closed_trade_count     INTEGER                  DEFAULT NULL,
  profitable_trade_count INTEGER                  DEFAULT NULL,
  losing_trade_count     INTEGER                  DEFAULT NULL,
  distinct_tokens_traded INTEGER                  DEFAULT NULL,
  realized_pnl           NUMERIC                  DEFAULT NULL,
  realized_cost_basis    NUMERIC                  DEFAULT NULL,
  roi                    NUMERIC                  DEFAULT NULL,
  win_rate               NUMERIC                  DEFAULT NULL,
  open_position_count    INTEGER                  DEFAULT NULL,
  coverage               VARCHAR(20)              DEFAULT NULL,
  pnl_status             VARCHAR(20)              DEFAULT NULL,
  confidence             NUMERIC                  DEFAULT NULL,
  status                 VARCHAR(20)              DEFAULT 'pending' NOT NULL,
  freshness              VARCHAR(20)              DEFAULT 'UNAVAILABLE' NOT NULL,
  last_updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  provider               VARCHAR(20)              NOT NULL,
  PRIMARY KEY (wallet_address, chain)
);

CREATE INDEX IF NOT EXISTS idx_smart_money_reputation_lookup
  ON public.smart_money_reputation (wallet_address, chain);

-- 3. INDEXING JOBS QUEUE TABLE
CREATE TABLE IF NOT EXISTS public.indexing_jobs (
  wallet_address  VARCHAR(64)              NOT NULL,
  chain           VARCHAR(20)              NOT NULL,
  status          VARCHAR(20)              DEFAULT 'pending' NOT NULL,
  attempts        INTEGER                  DEFAULT 0 NOT NULL,
  last_error      TEXT                     DEFAULT NULL,
  enqueued_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  started_at      TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  completed_at    TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (wallet_address, chain)
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE public.wallet_trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_money_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indexing_jobs ENABLE ROW LEVEL SECURITY;

-- Select policies (read-all)
DROP POLICY IF EXISTS "wallet_trade_history_select" ON public.wallet_trade_history;
CREATE POLICY "wallet_trade_history_select" ON public.wallet_trade_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "smart_money_reputation_select" ON public.smart_money_reputation;
CREATE POLICY "smart_money_reputation_select" ON public.smart_money_reputation FOR SELECT USING (true);

DROP POLICY IF EXISTS "indexing_jobs_select" ON public.indexing_jobs;
CREATE POLICY "indexing_jobs_select" ON public.indexing_jobs FOR SELECT USING (true);

-- Insert/Update/Delete restricted to service role only
DROP POLICY IF EXISTS "wallet_trade_history_service_all" ON public.wallet_trade_history;
CREATE POLICY "wallet_trade_history_service_all" ON public.wallet_trade_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "smart_money_reputation_service_all" ON public.smart_money_reputation;
CREATE POLICY "smart_money_reputation_service_all" ON public.smart_money_reputation FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "indexing_jobs_service_all" ON public.indexing_jobs;
CREATE POLICY "indexing_jobs_service_all" ON public.indexing_jobs FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PG_NET ASYNC WORKER DISPATCH TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_indexing_jobs_dispatch()
RETURNS TRIGGER AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_payload JSONB;
  v_headers JSONB;
BEGIN
  -- Only dispatch when status becomes 'pending'
  IF NEW.status = 'pending' THEN
    v_url := current_setting('app.settings.smart_money_worker_url', true);
    v_secret := current_setting('app.settings.worker_secret_key', true);

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE WARNING 'SmartMoney worker URL or secret key not configured in current_setting.';
      RETURN NEW;
    END IF;

    v_payload := jsonb_build_object(
      'address', NEW.wallet_address,
      'chain', NEW.chain
    );
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', v_secret
    );

    BEGIN
      PERFORM net.http_post(
        url := v_url,
        headers := v_headers,
        body := v_payload::text
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to dispatch pg_net HTTP request for SmartMoney indexing: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach pg_net dispatch trigger
DROP TRIGGER IF EXISTS trg_indexing_jobs_after_insert_or_update ON public.indexing_jobs;
CREATE TRIGGER trg_indexing_jobs_after_insert_or_update
  AFTER INSERT OR UPDATE ON public.indexing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_indexing_jobs_dispatch();

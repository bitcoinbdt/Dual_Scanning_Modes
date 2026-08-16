-- =====================================================
-- LIVE RISK ALERTS SCHEMA
-- Migration 11 — Phase 5D-5 / Item A Live Risk Monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS public.live_risk_alerts (
  id               UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address    VARCHAR(64)              NOT NULL,
  network          VARCHAR(20)              NOT NULL,
  alert_type       VARCHAR(40)              NOT NULL, -- 'LARGE_SELL', 'LARGE_BUY', 'RESERVE_DROP', 'WHALE_TRANSFER'
  tx_hash          VARCHAR(66)              NOT NULL,
  amount_usd       NUMERIC                  DEFAULT NULL,
  price_impact_pct NUMERIC                  DEFAULT NULL,
  details          TEXT                     DEFAULT NULL,
  confidence       INTEGER                  NOT NULL, -- 0-100
  block_number     BIGINT                   DEFAULT NULL,
  sender_address   VARCHAR(64)              DEFAULT NULL,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for fast alerts queries by token, network and type
CREATE INDEX IF NOT EXISTS idx_live_risk_alerts_token
  ON public.live_risk_alerts (token_address, network);

CREATE INDEX IF NOT EXISTS idx_live_risk_alerts_created
  ON public.live_risk_alerts (created_at DESC);

-- Enable RLS
ALTER TABLE public.live_risk_alerts ENABLE ROW LEVEL SECURITY;

-- Select policy (read-all)
DROP POLICY IF EXISTS "live_risk_alerts_select" ON public.live_risk_alerts;
CREATE POLICY "live_risk_alerts_select" ON public.live_risk_alerts FOR SELECT USING (true);

-- Insert/Update/Delete restricted to service role only
DROP POLICY IF EXISTS "live_risk_alerts_service_all" ON public.live_risk_alerts;
CREATE POLICY "live_risk_alerts_service_all" ON public.live_risk_alerts FOR ALL USING (true) WITH CHECK (true);

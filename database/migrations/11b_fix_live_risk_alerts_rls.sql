-- Fix RLS on live_risk_alerts: restrict writes to service_role only

-- Drop the permissive ALL policy
DROP POLICY IF EXISTS "live_risk_alerts_service_all" ON public.live_risk_alerts;

-- SELECT: allow anyone (anon, authenticated, service_role)
DROP POLICY IF EXISTS "live_risk_alerts_select" ON public.live_risk_alerts;
CREATE POLICY "live_risk_alerts_select" ON public.live_risk_alerts
  FOR SELECT USING (true);

-- INSERT: service_role only
DROP POLICY IF EXISTS "live_risk_alerts_insert_service" ON public.live_risk_alerts;
CREATE POLICY "live_risk_alerts_insert_service" ON public.live_risk_alerts
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- UPDATE: service_role only
DROP POLICY IF EXISTS "live_risk_alerts_update_service" ON public.live_risk_alerts;
CREATE POLICY "live_risk_alerts_update_service" ON public.live_risk_alerts
  FOR UPDATE USING (auth.role() = 'service_role');

-- DELETE: service_role only
DROP POLICY IF EXISTS "live_risk_alerts_delete_service" ON public.live_risk_alerts;
CREATE POLICY "live_risk_alerts_delete_service" ON public.live_risk_alerts
  FOR DELETE USING (auth.role() = 'service_role');

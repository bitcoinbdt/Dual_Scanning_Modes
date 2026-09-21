-- FIX-1.3: RLS policy hardening for 10 tables
-- Restrict INSERT, UPDATE, DELETE to service_role only

-- 1. wallet_reputation
DROP POLICY IF EXISTS "wallet_reputation_insert" ON public.wallet_reputation;
CREATE POLICY "wallet_reputation_insert" ON public.wallet_reputation
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wallet_reputation_update" ON public.wallet_reputation;
CREATE POLICY "wallet_reputation_update" ON public.wallet_reputation
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wallet_reputation_delete" ON public.wallet_reputation;
CREATE POLICY "wallet_reputation_delete" ON public.wallet_reputation
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wallet_reputation_service_all" ON public.wallet_reputation;
CREATE POLICY "wallet_reputation_service_all" ON public.wallet_reputation
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 2. wallet_enrichment_jobs
DROP POLICY IF EXISTS "wallet_enrichment_jobs_insert" ON public.wallet_enrichment_jobs;
CREATE POLICY "wallet_enrichment_jobs_insert" ON public.wallet_enrichment_jobs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wallet_enrichment_jobs_update" ON public.wallet_enrichment_jobs;
CREATE POLICY "wallet_enrichment_jobs_update" ON public.wallet_enrichment_jobs
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wallet_enrichment_jobs_delete" ON public.wallet_enrichment_jobs;
CREATE POLICY "wallet_enrichment_jobs_delete" ON public.wallet_enrichment_jobs
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wallet_enrichment_jobs_service_all" ON public.wallet_enrichment_jobs;
CREATE POLICY "wallet_enrichment_jobs_service_all" ON public.wallet_enrichment_jobs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 3. wallet_trade_history
DROP POLICY IF EXISTS "wallet_trade_history_insert" ON public.wallet_trade_history;
CREATE POLICY "wallet_trade_history_insert" ON public.wallet_trade_history
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wallet_trade_history_update" ON public.wallet_trade_history;
CREATE POLICY "wallet_trade_history_update" ON public.wallet_trade_history
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wallet_trade_history_delete" ON public.wallet_trade_history;
CREATE POLICY "wallet_trade_history_delete" ON public.wallet_trade_history
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wallet_trade_history_service_all" ON public.wallet_trade_history;
CREATE POLICY "wallet_trade_history_service_all" ON public.wallet_trade_history
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 4. smart_money_reputation
DROP POLICY IF EXISTS "smart_money_reputation_insert" ON public.smart_money_reputation;
CREATE POLICY "smart_money_reputation_insert" ON public.smart_money_reputation
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "smart_money_reputation_update" ON public.smart_money_reputation;
CREATE POLICY "smart_money_reputation_update" ON public.smart_money_reputation
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "smart_money_reputation_delete" ON public.smart_money_reputation;
CREATE POLICY "smart_money_reputation_delete" ON public.smart_money_reputation
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "smart_money_reputation_service_all" ON public.smart_money_reputation;
CREATE POLICY "smart_money_reputation_service_all" ON public.smart_money_reputation
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 5. indexing_jobs
DROP POLICY IF EXISTS "indexing_jobs_insert" ON public.indexing_jobs;
CREATE POLICY "indexing_jobs_insert" ON public.indexing_jobs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "indexing_jobs_update" ON public.indexing_jobs;
CREATE POLICY "indexing_jobs_update" ON public.indexing_jobs
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "indexing_jobs_delete" ON public.indexing_jobs;
CREATE POLICY "indexing_jobs_delete" ON public.indexing_jobs
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "indexing_jobs_service_all" ON public.indexing_jobs;
CREATE POLICY "indexing_jobs_service_all" ON public.indexing_jobs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 6. scan_snapshots
DROP POLICY IF EXISTS "scan_snapshots_insert" ON public.scan_snapshots;
CREATE POLICY "scan_snapshots_insert" ON public.scan_snapshots
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "scan_snapshots_update" ON public.scan_snapshots;
CREATE POLICY "scan_snapshots_update" ON public.scan_snapshots
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "scan_snapshots_delete" ON public.scan_snapshots;
CREATE POLICY "scan_snapshots_delete" ON public.scan_snapshots
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "scan_snapshots_service_all" ON public.scan_snapshots;
CREATE POLICY "scan_snapshots_service_all" ON public.scan_snapshots
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 7. token_unlock_schedules
DROP POLICY IF EXISTS "token_unlock_schedules_insert" ON public.token_unlock_schedules;
CREATE POLICY "token_unlock_schedules_insert" ON public.token_unlock_schedules
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "token_unlock_schedules_update" ON public.token_unlock_schedules;
CREATE POLICY "token_unlock_schedules_update" ON public.token_unlock_schedules
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "token_unlock_schedules_delete" ON public.token_unlock_schedules;
CREATE POLICY "token_unlock_schedules_delete" ON public.token_unlock_schedules
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "token_unlock_schedules_service_all" ON public.token_unlock_schedules;
CREATE POLICY "token_unlock_schedules_service_all" ON public.token_unlock_schedules
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 8. token_social_cache
DROP POLICY IF EXISTS "token_social_cache_insert" ON public.token_social_cache;
CREATE POLICY "token_social_cache_insert" ON public.token_social_cache
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "token_social_cache_update" ON public.token_social_cache;
CREATE POLICY "token_social_cache_update" ON public.token_social_cache
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "token_social_cache_delete" ON public.token_social_cache;
CREATE POLICY "token_social_cache_delete" ON public.token_social_cache
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "token_social_cache_service_all" ON public.token_social_cache;
CREATE POLICY "token_social_cache_service_all" ON public.token_social_cache
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 9. known_ruggers
DROP POLICY IF EXISTS "known_ruggers_insert" ON public.known_ruggers;
CREATE POLICY "known_ruggers_insert" ON public.known_ruggers
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "known_ruggers_update" ON public.known_ruggers;
CREATE POLICY "known_ruggers_update" ON public.known_ruggers
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "known_ruggers_delete" ON public.known_ruggers;
CREATE POLICY "known_ruggers_delete" ON public.known_ruggers
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "known_ruggers_service_all" ON public.known_ruggers;
CREATE POLICY "known_ruggers_service_all" ON public.known_ruggers
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 10. ai_scan_cache
DROP POLICY IF EXISTS "ai_scan_cache_insert" ON public.ai_scan_cache;
CREATE POLICY "ai_scan_cache_insert" ON public.ai_scan_cache
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "ai_scan_cache_update" ON public.ai_scan_cache;
CREATE POLICY "ai_scan_cache_update" ON public.ai_scan_cache
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "ai_scan_cache_delete" ON public.ai_scan_cache;
CREATE POLICY "ai_scan_cache_delete" ON public.ai_scan_cache
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "ai_scan_cache_service_all" ON public.ai_scan_cache;
CREATE POLICY "ai_scan_cache_service_all" ON public.ai_scan_cache
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

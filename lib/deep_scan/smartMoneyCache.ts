/**
 * SmartMoney Cache — Phase 5D-1
 *
 * Provides cache-first lookup and async job enqueue helpers for SmartMoney
 * reputation records, following the same cache-first pattern as walletQualityCache.ts.
 *
 * SERVER-SIDE ONLY.
 */

import { createClient } from '@supabase/supabase-js';
import type { SmartMoneyReputationRecord, SmartMoneyIndexingJob } from './types';

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('[SmartMoneyCache] Supabase credentials not configured.');
  }
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Look up an existing SmartMoney reputation record for a wallet.
 * Returns null if no record exists.
 */
export async function lookupSmartMoneyReputation(
  walletAddress: string,
  chain: string
): Promise<SmartMoneyReputationRecord | null> {
  const addr = walletAddress.toLowerCase().trim();
  const ch   = chain.toLowerCase().trim();
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('smart_money_reputation')
      .select('*')
      .eq('wallet_address', addr)
      .eq('chain', ch)
      .maybeSingle();

    if (error) {
      console.warn('[SmartMoneyCache] Lookup error:', error.message);
      return null;
    }
    if (!data) return null;

    return {
      walletAddress:        data.wallet_address,
      chain:                data.chain,
      tradeCount:           data.trade_count ?? null,
      profitableTrades:     data.profitable_trades ?? null,
      realizedUsdPnl:       data.realized_usd_pnl ?? null,
      distinctTokens:       data.distinct_tokens ?? null,
      totalIndexedEvents:   data.total_indexed_events ?? null,
      recognizedSwapCount:  data.recognized_swap_count ?? null,
      closedTradeCount:     data.closed_trade_count ?? null,
      profitableTradeCount: data.profitable_trade_count ?? null,
      losingTradeCount:     data.losing_trade_count ?? null,
      distinctTokensTraded: data.distinct_tokens_traded ?? null,
      realizedPnl:          data.realized_pnl ?? null,
      realizedCostBasis:    data.realized_cost_basis ?? null,
      roi:                  data.roi ?? null,
      winRate:              data.win_rate ?? null,
      openPositionCount:    data.open_position_count ?? null,
      coverage:             data.coverage ?? null,
      pnlStatus:            data.pnl_status ?? null,
      confidence:           data.confidence ?? null,
      status:               data.status,
      freshness:            data.freshness,
      lastUpdatedAt:        data.last_updated_at,
      provider:             data.provider,
    };
  } catch (err: any) {
    console.warn('[SmartMoneyCache] Lookup exception:', err?.message);
    return null;
  }
}

/**
 * Enqueue an async SmartMoney indexing job.
 * Idempotent — if job already exists, we ignore the conflict.
 */
export async function enqueueSmartMoneyIndexingJob(
  walletAddress: string,
  chain: string
): Promise<void> {
  const addr = walletAddress.toLowerCase().trim();
  const ch   = chain.toLowerCase().trim();
  try {
    const supabase = getServiceClient();
    // Insert pending job. If conflict, update to trigger pg_net dispatch.
    await supabase
      .from('indexing_jobs')
      .upsert(
        {
          wallet_address: addr,
          chain:          ch,
          status:         'pending',
          enqueued_at:    new Date().toISOString(),
          updated_at:     new Date().toISOString(),
        },
        { onConflict: 'wallet_address,chain', ignoreDuplicates: true }
      );
  } catch (err: any) {
    console.warn('[SmartMoneyCache] Enqueue exception:', err?.message);
  }
}

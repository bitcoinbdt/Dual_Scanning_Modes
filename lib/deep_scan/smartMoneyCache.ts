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
    // FIX-4.9: Two-step enqueue to prevent stuck 'processing' jobs when ignoreDuplicates is true
    // Step 1: try to INSERT fresh (fast path)
    const { error: insertErr } = await supabase
      .from('indexing_jobs')
      .insert({
        wallet_address: addr,
        chain:          ch,
        status:         'pending',
        enqueued_at:    new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      });

    // Step 2: on unique-violation (already exists), conditionally reset stale/pending
    if (insertErr && insertErr.code === '23505') {
      // Only reset jobs that are stuck (processing for >15 min) or already pending.
      const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      await supabase
        .from('indexing_jobs')
        .update({
          status: 'pending',
          enqueued_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('wallet_address', addr)
        .eq('chain', ch)
        .or(`status.eq.pending,and(status.eq.processing,updated_at.lt.${staleThreshold})`);
    } else if (insertErr) {
      console.warn('[SmartMoneyCache] Enqueue failed:', insertErr.message);
    }
  } catch (err: any) {
    console.warn('[SmartMoneyCache] Enqueue exception:', err?.message);
  }
}

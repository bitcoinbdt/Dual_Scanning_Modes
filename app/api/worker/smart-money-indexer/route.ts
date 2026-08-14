/**
 * SmartMoney Asynchronous Indexing Worker Endpoint — Phase 5D-2
 *
 * Invoked by pg_net trigger on indexing_jobs status = 'pending'.
 * Walks wallet transaction history, stores normalized transactions to
 * wallet_trade_history, updates cache record, and completes the queue job.
 *
 * SECURITY:
 *   Requires x-worker-secret matching WORKER_SECRET_KEY.
 *
 * IDEMPOTENCY:
 *   Uses ON CONFLICT DO UPDATE constraints to prevent duplications.
 *
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { indexWalletTrades } from '@/lib/providers/goldrush/smartMoneyIndexer';
import { calculateSmartMoneyPnl } from '@/lib/deep_scan/engines/SmartMoneyPnlEngine';
import { normalizeAddress } from '@/lib/deep_scan/types';

/** EVM address check. */
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Supported chain list. */
const SUPPORTED_CHAINS = new Set(['eth', 'bsc', 'base', 'solana']);

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('[SmartMoneyWorker] Supabase credentials not configured.');
  }
  return createClient(supabaseUrl, serviceKey);
}

export async function POST(request: NextRequest) {
  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const workerSecret = process.env.WORKER_SECRET_KEY;
  if (!workerSecret) {
    console.error('[SmartMoneyWorker] WORKER_SECRET_KEY is not set.');
    return NextResponse.json({ error: 'Worker not configured.' }, { status: 500 });
  }

  const incomingSecret = request.headers.get('x-worker-secret');
  if (!incomingSecret || incomingSecret !== workerSecret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Parse & Validate Body ─────────────────────────────────────────────
  let body: { address?: unknown; chain?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawAddress = body.address;
  const rawChain   = body.chain;

  if (typeof rawAddress !== 'string' || !rawAddress.trim()) {
    return NextResponse.json({ error: '"address" is required.' }, { status: 400 });
  }
  if (typeof rawChain !== 'string' || !rawChain.trim()) {
    return NextResponse.json({ error: '"chain" is required.' }, { status: 400 });
  }

  const normalizedChain = rawChain.trim().toLowerCase();
  if (!SUPPORTED_CHAINS.has(normalizedChain)) {
    return NextResponse.json(
      { error: `Unsupported chain "${normalizedChain}".` },
      { status: 400 }
    );
  }

  let normalizedAddr: string;
  if (normalizedChain === 'solana') {
    normalizedAddr = rawAddress.trim();
    if (!normalizedAddr || normalizedAddr.length < 32) {
      return NextResponse.json({ error: 'Invalid Solana address.' }, { status: 400 });
    }
  } else {
    if (!EVM_ADDRESS_RE.test(rawAddress.trim())) {
      return NextResponse.json({ error: 'Invalid EVM address format.' }, { status: 400 });
    }
    normalizedAddr = normalizeAddress(rawAddress.trim());
  }

  console.log(`[SmartMoneyWorker] Starting indexing job for ${normalizedAddr} on ${normalizedChain}...`);

  const supabase = getServiceClient();

  // ── 3. Set Job to Processing ──────────────────────────────────────────────
  try {
    const { error: startError } = await supabase
      .from('indexing_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', normalizedAddr)
      .eq('chain', normalizedChain);

    if (startError) {
      console.warn(`[SmartMoneyWorker] Failed to start job: ${startError.message}`);
    }
  } catch (err: any) {
    console.warn('[SmartMoneyWorker] Job start exception:', err?.message);
  }

  // ── 4. Walk, Parse, & Store ──────────────────────────────────────────────
  try {
    const indexResult = await indexWalletTrades(normalizedAddr, normalizedChain);
    const events = indexResult.events;
    const coverage = indexResult.coverage;

    if (events.length > 0) {
      // Idempotent bulk upsert (DO NOTHING on conflict)
      const { error: upsertError } = await supabase
        .from('wallet_trade_history')
        .upsert(
          events.map((ev) => ({
            wallet_address: ev.walletAddress,
            chain:          ev.chain,
            token_address:  ev.tokenAddress,
            tx_hash:        ev.txHash,
            block_number:   ev.blockNumber,
            block_hash:     ev.blockHash,
            log_index:      ev.logIndex,
            timestamp:      ev.timestamp,
            event_type:     ev.eventType,
            token_amount:   ev.tokenAmount,
            quote_amount:   ev.quoteAmount,
            quote_token:    ev.quoteToken,
            provider:       ev.provider,
            indexed_at:     ev.indexedAt,
          })),
          { onConflict: 'wallet_address,chain,tx_hash,log_index' }
        );

      if (upsertError) {
        throw new Error(`History upsert failed: ${upsertError.message}`);
      }
    }

    // ── 5. Calculate FIFO PnL Stats ──────────────────────────────────────────
    const pnlStats = calculateSmartMoneyPnl(events);

    // ── 6. Cache Reputation Record with Computed Metrics ─────────────────────
    const { error: repError } = await supabase
      .from('smart_money_reputation')
      .upsert(
        {
          wallet_address:         normalizedAddr,
          chain:                  normalizedChain,
          trade_count:            pnlStats.closedTradeCount,
          profitable_trades:      pnlStats.profitableTradeCount,
          realized_usd_pnl:       pnlStats.realizedPnl,
          distinct_tokens:        pnlStats.distinctTokensTraded,
          total_indexed_events:   pnlStats.totalIndexedEvents,
          recognized_swap_count:  pnlStats.recognizedSwapCount,
          closed_trade_count:     pnlStats.closedTradeCount,
          profitable_trade_count: pnlStats.profitableTradeCount,
          losing_trade_count:     pnlStats.losingTradeCount,
          distinct_tokens_traded: pnlStats.distinctTokensTraded,
          realized_pnl:           pnlStats.realizedPnl,
          realized_cost_basis:    pnlStats.realizedCostBasis,
          roi:                    pnlStats.roi,
          win_rate:               pnlStats.winRate,
          open_position_count:    pnlStats.openPositionCount,
          coverage:               coverage,
          pnl_status:             pnlStats.pnlStatus,
          status:                 'available',
          freshness:              'LIVE',
          last_updated_at:        new Date().toISOString(),
          provider:               'goldrush',
        },
        { onConflict: 'wallet_address,chain' }
      );

    if (repError) {
      console.warn(`[SmartMoneyWorker] Cache update failed: ${repError.message}`);
    }

    // ── 7. Complete Job ──────────────────────────────────────────────────────
    await supabase
      .from('indexing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', normalizedAddr)
      .eq('chain', normalizedChain);

    return NextResponse.json({
      success: true,
      address: normalizedAddr,
      chain:   normalizedChain,
      indexedCount: events.length,
      pnlStats,
    });

  } catch (err: any) {
    console.error(`[SmartMoneyWorker] Execution failure for ${normalizedAddr}:`, err?.message);

    // Fail the job gracefully
    try {
      await supabase
        .from('indexing_jobs')
        .update({
          status: 'failed',
          last_error: err?.message || 'Unknown processing error',
          updated_at: new Date().toISOString(),
        })
        .eq('wallet_address', normalizedAddr)
        .eq('chain', normalizedChain);
    } catch (dbErr: any) {
      console.error('[SmartMoneyWorker] Graceful fail update crashed:', dbErr?.message);
    }

    return NextResponse.json(
      { error: 'Worker processing failed.', reason: err?.message },
      { status: 502 }
    );
  }
}

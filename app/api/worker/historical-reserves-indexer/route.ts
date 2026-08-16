/**
 * Historical Pool Reserves Async Indexing Worker — Phase 5D-5
 *
 * Invoked by pg_net trigger on historical_pool_indexing_jobs INSERT with status = 'pending'.
 * Calls Phase 5D-4 getHistoricalV2Reserves(), stores the result, and completes the job.
 *
 * SECURITY:
 *   Requires x-worker-secret matching WORKER_SECRET_KEY env var.
 *
 * IDEMPOTENCY:
 *   Snapshot persistence uses ON CONFLICT (chain, pool_address, block_number) DO UPDATE
 *   to handle reorg-safe canonical record replacement.
 *
 * FAILURE CLASSIFICATION:
 *   Permanent (no retry): UNCONFIGURED, UNSUPPORTED_CHAIN, UNSUPPORTED_POOL_TYPE,
 *     INVALID_INPUT, ARCHIVE_UNAVAILABLE, MALFORMED_RESPONSE
 *   Retryable (up to maxAttempts): RPC_TIMEOUT, RPC_FAILURE, DB errors
 *
 * ANTI-FABRICATION:
 *   Never falls back to latest block state.
 *   Never writes a snapshot with null reserves.
 *   If historical state is unavailable, the job is marked failed — no record written.
 *
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalV2Reserves } from '@/lib/deep_scan/historical/HistoricalPoolState';
import { DEEP_SCAN_CONFIG } from '@/lib/deep_scan/config';
import { normalizeAddress } from '@/lib/deep_scan/types';
import { getServiceClient } from './supabaseClientFactory';

/** EVM address validation regex. */
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/i;

/** Supported chains by Phase 5D-4 Alchemy RPC. */
const SUPPORTED_CHAINS = new Set([
  'eth', 'ethereum', '1',
  'bsc', 'binance', '56',
  'polygon', '137',
  'arbitrum', '42161',
  'base', '8453',
  'optimism', '10',
]);

/**
 * Error codes that are permanent — no retry regardless of attempts remaining.
 * Retrying these would waste RPC budget and never succeed.
 */
const PERMANENT_ERROR_CODES = new Set([
  'UNCONFIGURED',
  'UNSUPPORTED_CHAIN',
  'UNSUPPORTED_POOL_TYPE',
  'INVALID_INPUT',
  'ARCHIVE_UNAVAILABLE',
  'MALFORMED_RESPONSE',
]);

const MAX_ATTEMPTS = DEEP_SCAN_CONFIG.historicalReserves.maxAttempts;


export async function POST(request: NextRequest) {
  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const workerSecret = process.env.WORKER_SECRET_KEY;
  if (!workerSecret) {
    console.error('[HistoricalReservesWorker] WORKER_SECRET_KEY is not set.');
    return NextResponse.json({ error: 'Worker not configured.' }, { status: 500 });
  }

  const incomingSecret = request.headers.get('x-worker-secret');
  if (!incomingSecret || incomingSecret !== workerSecret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Parse & Validate Body ─────────────────────────────────────────────
  let body: { chain?: unknown; poolAddress?: unknown; blockNumber?: unknown; poolType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawChain       = body.chain;
  const rawPoolAddress = body.poolAddress;
  const rawBlockNumber = body.blockNumber;
  const rawPoolType    = body.poolType;

  if (typeof rawChain !== 'string' || !rawChain.trim()) {
    return NextResponse.json({ error: '"chain" is required.' }, { status: 400 });
  }
  if (typeof rawPoolAddress !== 'string' || !rawPoolAddress.trim()) {
    return NextResponse.json({ error: '"poolAddress" is required.' }, { status: 400 });
  }
  if (typeof rawBlockNumber !== 'number' || !Number.isInteger(rawBlockNumber) || rawBlockNumber <= 0) {
    return NextResponse.json({ error: '"blockNumber" must be a positive integer.' }, { status: 400 });
  }

  const chain       = rawChain.trim().toLowerCase();
  const poolAddress = normalizeAddress(rawPoolAddress.trim());
  const blockNumber = rawBlockNumber;
  const poolType    = typeof rawPoolType === 'string' ? rawPoolType.trim().toLowerCase() : 'v2';

  // ── 3. Validate Chain ────────────────────────────────────────────────────
  if (!SUPPORTED_CHAINS.has(chain)) {
    return NextResponse.json(
      { error: `Unsupported chain: ${chain}`, code: 'UNSUPPORTED_CHAIN' },
      { status: 400 }
    );
  }

  // ── 4. Validate Pool Address ─────────────────────────────────────────────
  if (!EVM_ADDRESS_RE.test(poolAddress)) {
    return NextResponse.json(
      { error: `Invalid EVM pool address: ${poolAddress}`, code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  // ── 5. Validate Pool Type ────────────────────────────────────────────────
  if (poolType !== 'v2' && poolType !== 'uniswap_v2' && poolType !== 'pancakeswap_v2') {
    return NextResponse.json(
      { error: `Unsupported pool type: ${poolType}. Only V2 constant-product pools are indexed.`, code: 'UNSUPPORTED_POOL_TYPE' },
      { status: 400 }
    );
  }

  console.log(`[HistoricalReservesWorker] Starting job: pool=${poolAddress} chain=${chain} block=${blockNumber}`);

  const supabase = getServiceClient();

  // ── 6. Claim Job (set to processing) ─────────────────────────────────────
  // Only process if job is still pending and within attempt limit
  const { data: jobRows, error: fetchErr } = await supabase
    .from('historical_pool_indexing_jobs')
    .select('id, attempts, status')
    .eq('chain', chain)
    .eq('pool_address', poolAddress)
    .eq('block_number', blockNumber)
    .maybeSingle();

  if (fetchErr) {
    console.warn('[HistoricalReservesWorker] Failed to fetch job row:', fetchErr.message);
    return NextResponse.json({ error: 'DB error fetching job.' }, { status: 502 });
  }

  if (!jobRows) {
    // Job may have already been completed or removed
    return NextResponse.json({ skipped: true, reason: 'Job not found.' });
  }

  const currentAttempts = (jobRows.attempts as number) ?? 0;

  // Guard against processing already-completed jobs
  if (jobRows.status === 'completed') {
    return NextResponse.json({ skipped: true, reason: 'Job already completed.' });
  }

  // Guard against exceeded attempts
  if (currentAttempts >= MAX_ATTEMPTS && jobRows.status === 'failed') {
    return NextResponse.json({ skipped: true, reason: 'Job already permanently failed.' });
  }

  // Claim the job atomically using compare-and-swap status check
  const { data: claimRows, error: claimErr } = await supabase
    .from('historical_pool_indexing_jobs')
    .update({
      status:     'processing',
      started_at: new Date().toISOString(),
      attempts:   currentAttempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('chain', chain)
    .eq('pool_address', poolAddress)
    .eq('block_number', blockNumber)
    .eq('status', 'pending')
    .select('id');

  if (claimErr) {
    console.warn('[HistoricalReservesWorker] Failed to claim job atomically:', claimErr.message);
    return NextResponse.json({ error: 'DB error claiming job.' }, { status: 502 });
  }

  if (!claimRows || claimRows.length === 0) {
    // Job was already claimed by another worker, completed, or failed
    console.log(`[HistoricalReservesWorker] Job already claimed/processed: pool=${poolAddress} block=${blockNumber}`);
    return NextResponse.json({ skipped: true, reason: 'Job already claimed or not pending.' });
  }

  // ── 7. Query Historical Reserves (Phase 5D-4 boundary) ───────────────────
  let result;
  try {
    result = await getHistoricalV2Reserves(chain, poolAddress, blockNumber, poolType);
  } catch (err: any) {
    // Unexpected exception from Phase 5D-4 adapter (should not happen — it never throws)
    await markJobFailed(supabase, chain, poolAddress, blockNumber, err?.message ?? 'Unexpected RPC exception', currentAttempts + 1, false);
    return NextResponse.json({ error: 'RPC exception.', reason: err?.message }, { status: 502 });
  }

  // ── 8. Handle Result ─────────────────────────────────────────────────────
  if (result.status !== 'available') {
    const errorCode     = result.errorCode ?? 'RPC_ERROR';
    const isPermanent   = PERMANENT_ERROR_CODES.has(errorCode);
    const newAttempts   = currentAttempts + 1;
    const shouldRetry   = !isPermanent && newAttempts < MAX_ATTEMPTS;

    // Never write a snapshot with unavailable reserves — anti-fabrication guarantee
    await markJobFailed(supabase, chain, poolAddress, blockNumber, errorCode, newAttempts, !shouldRetry);
    return NextResponse.json({
      success: false,
      errorCode,
      permanent: isPermanent,
      retryable: shouldRetry,
      attemptsUsed: newAttempts,
    }, { status: isPermanent ? 422 : 502 });
  }

  // Sanity check: reserve0/reserve1 must be present and non-null
  // (getHistoricalV2Reserves guarantees this when status === 'available',
  // but we verify defensively to prevent accidental null writes)
  if (result.reserve0 === null || result.reserve1 === null) {
    await markJobFailed(supabase, chain, poolAddress, blockNumber, 'NULL_RESERVES_ANTI_FABRICATION', currentAttempts + 1, true);
    return NextResponse.json({ error: 'Reserve values null despite available status — anti-fabrication guard.' }, { status: 500 });
  }
  if (result.blockHash === null || result.timestamp === null) {
    await markJobFailed(supabase, chain, poolAddress, blockNumber, 'NULL_PROVENANCE_ANTI_FABRICATION', currentAttempts + 1, true);
    return NextResponse.json({ error: 'Block hash/timestamp null despite available status — anti-fabrication guard.' }, { status: 500 });
  }

  // ── 9. Persist Snapshot (canonical upsert — reorg safe) ──────────────────
  // ON CONFLICT (chain, pool_address, block_number) DO UPDATE replaces the
  // orphaned record if block_hash changed due to a chain reorganization.
  const { error: upsertError } = await supabase
    .from('historical_pool_reserves')
    .upsert(
      {
        chain:        chain,
        pool_address: poolAddress,
        pool_type:    'v2',
        token0:       null, // token0/token1 not yet available from getHistoricalV2Reserves
        token1:       null, // Future: populate when token metadata is available
        block_number: blockNumber,
        block_hash:   result.blockHash,
        timestamp:    result.timestamp,
        reserve0:     result.reserve0,
        reserve1:     result.reserve1,
        provider:     result.provider,
        indexed_at:   new Date().toISOString(),
      },
      { onConflict: 'chain,pool_address,block_number' }
    );

  if (upsertError) {
    console.error('[HistoricalReservesWorker] Snapshot upsert failed:', upsertError.message);
    const newAttempts = currentAttempts + 1;
    await markJobFailed(supabase, chain, poolAddress, blockNumber, `DB_ERROR: ${upsertError.message}`, newAttempts, newAttempts >= MAX_ATTEMPTS);
    return NextResponse.json({ error: 'DB upsert failed.', reason: upsertError.message }, { status: 502 });
  }

  // ── 10. Mark Job Complete ─────────────────────────────────────────────────
  await supabase
    .from('historical_pool_indexing_jobs')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq('chain', chain)
    .eq('pool_address', poolAddress)
    .eq('block_number', blockNumber);

  console.log(`[HistoricalReservesWorker] Completed: pool=${poolAddress} block=${blockNumber} reserve0=${result.reserve0}`);

  return NextResponse.json({
    success:     true,
    poolAddress,
    chain,
    blockNumber,
    blockHash:   result.blockHash,
    timestamp:   result.timestamp,
    reserve0:    result.reserve0,
    reserve1:    result.reserve1,
  });
}

// ─────────────────────────────────────────────
// Helper: mark job failed
// ─────────────────────────────────────────────

async function markJobFailed(
  supabase: any,
  chain: string,
  poolAddress: string,
  blockNumber: number,
  errorMessage: string,
  attempts: number,
  terminal: boolean
): Promise<void> {
  try {
    await supabase
      .from('historical_pool_indexing_jobs')
      .update({
        status:     terminal ? 'failed' : 'pending',
        last_error: errorMessage,
        attempts,
        updated_at: new Date().toISOString(),
      })
      .eq('chain', chain)
      .eq('pool_address', poolAddress)
      .eq('block_number', blockNumber);
  } catch (err: any) {
    console.error('[HistoricalReservesWorker] markJobFailed exception:', err?.message);
  }
}

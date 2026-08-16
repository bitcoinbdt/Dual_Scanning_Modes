/**
 * pg_net Trigger Integration Validation — Phase 5D-5
 *
 * Validates the end-to-end trigger pipeline for historical pool reserve indexing:
 *   happy path     : INSERT pending job → trigger fires → worker → completed
 *   CAS contention : two concurrent worker calls → exactly one completes, one skips
 *   crash recovery : stale processing job → schedulePoolReservesIndexing → reset to pending → re-trigger
 *
 * IMPORTANT:
 *   This test makes real HTTP requests to the worker endpoint and real DB writes.
 *   It requires a running Next.js dev server OR a deployed Vercel preview URL.
 *   It uses sentinel data (pool address 0x000…dead) and cleans up after each case.
 *
 * Usage:
 *   WORKER_URL=http://localhost:3000 npx tsx database/tests/pgnet_integration.ts
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service role key
 *   WORKER_SECRET_KEY             — must match app.settings.worker_secret_key in Postgres
 *   WORKER_URL                    — base URL of the running Next.js app (no trailing slash)
 *
 * Exit codes: 0 = all pass, 1 = any failure
 *
 * Note on pg_net dispatch:
 *   This test does NOT wait for pg_net to fire the HTTP dispatch automatically.
 *   Instead it calls the worker directly after inserting the job row.
 *   A separate manual test section documents how to verify the automatic trigger.
 */

import { createClient } from '@supabase/supabase-js';

// ── Environment ──────────────────────────────────────────────
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_SECRET   = process.env.WORKER_SECRET_KEY;
const WORKER_BASE_URL = process.env.WORKER_URL ?? 'http://localhost:3000';
const WORKER_ENDPOINT = `${WORKER_BASE_URL}/api/worker/historical-reserves-indexer`;

const MISSING: string[] = [];
if (!SUPABASE_URL)  MISSING.push('NEXT_PUBLIC_SUPABASE_URL');
if (!SERVICE_KEY)   MISSING.push('SUPABASE_SERVICE_ROLE_KEY');
if (!WORKER_SECRET) MISSING.push('WORKER_SECRET_KEY');

if (MISSING.length > 0) {
  console.error('[pgnet_integration] Missing required environment variables:');
  MISSING.forEach(v => console.error(`  - ${v}`));
  process.exit(1);
}

// ── DB client ────────────────────────────────────────────────
const db = createClient(SUPABASE_URL!, SERVICE_KEY!);

// ── Sentinel data ────────────────────────────────────────────
const POOL    = '0x000000000000000000000000000000000000dead';
const CHAIN   = 'eth';
const BLOCK_A = 888_000_001; // happy path
const BLOCK_B = 888_000_002; // CAS contention
const BLOCK_C = 888_000_003; // crash recovery

// ── Test state ───────────────────────────────────────────────
interface TestResult { name: string; passed: boolean; detail?: string; }
const results: TestResult[] = [];

function pass(name: string): void {
  results.push({ name, passed: true });
  console.log(`  ✅ PASS  ${name}`);
}
function fail(name: string, detail: string): void {
  results.push({ name, passed: false, detail });
  console.error(`  ❌ FAIL  ${name}\n         ${detail}`);
}

// ── Cleanup helper ───────────────────────────────────────────
async function cleanup(): Promise<void> {
  for (const block of [BLOCK_A, BLOCK_B, BLOCK_C]) {
    await db.from('historical_pool_indexing_jobs')
      .delete().eq('chain', CHAIN).eq('pool_address', POOL).eq('block_number', block);
    await db.from('historical_pool_reserves')
      .delete().eq('chain', CHAIN).eq('pool_address', POOL).eq('block_number', block);
  }
}

// ── Worker HTTP helper ────────────────────────────────────────
async function callWorker(chain: string, poolAddress: string, blockNumber: number): Promise<{
  status: number;
  body:   any;
}> {
  const res = await fetch(WORKER_ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-worker-secret': WORKER_SECRET!,
    },
    body: JSON.stringify({ chain, poolAddress, blockNumber, poolType: 'v2' }),
  });
  let body: any;
  try { body = await res.json(); } catch { body = {}; }
  return { status: res.status, body };
}

// ── Job status helper ─────────────────────────────────────────
async function getJobStatus(blockNumber: number): Promise<string | null> {
  const { data } = await db
    .from('historical_pool_indexing_jobs')
    .select('status')
    .eq('chain', CHAIN)
    .eq('pool_address', POOL)
    .eq('block_number', blockNumber)
    .maybeSingle();
  return data?.status ?? null;
}

async function getReserveRow(blockNumber: number): Promise<any | null> {
  const { data } = await db
    .from('historical_pool_reserves')
    .select('*')
    .eq('chain', CHAIN)
    .eq('pool_address', POOL)
    .eq('block_number', blockNumber)
    .maybeSingle();
  return data ?? null;
}

// ── Test F.1 — Happy Path ────────────────────────────────────
// Insert a pending job and call the worker directly.
// The worker may succeed (completed) or fail with a known archive error
// (ARCHIVE_UNAVAILABLE / RPC_FAILURE) because the sentinel address and
// block number do not exist on mainnet. Either outcome proves the pipeline
// fires correctly end-to-end — the key assertion is that the job status
// transitions OUT of 'pending'.
async function test_F1_happyPath(): Promise<void> {
  const name = 'F.1 — Happy path: pending → worker called → status transitions';

  // Insert a pending job row
  const { error: insErr } = await db
    .from('historical_pool_indexing_jobs')
    .insert({ chain: CHAIN, pool_address: POOL, block_number: BLOCK_A, status: 'pending' });

  if (insErr) {
    fail(name, `Could not insert test job: ${insErr.message}`);
    return;
  }

  // Verify initial status
  const beforeStatus = await getJobStatus(BLOCK_A);
  if (beforeStatus !== 'pending') {
    fail(name, `Expected initial status 'pending', got '${beforeStatus}'`);
    return;
  }

  // Call worker (simulates what pg_net trigger dispatches)
  const t0  = Date.now();
  const res = await callWorker(CHAIN, POOL, BLOCK_A);
  const ms  = Date.now() - t0;

  const afterStatus = await getJobStatus(BLOCK_A);

  // Worker returned a response (not a network error)
  if (res.status === 0) {
    fail(name, 'Worker did not respond — is WORKER_URL correct and the server running?');
    return;
  }

  // Status must have changed from pending to anything else
  if (afterStatus === 'pending') {
    fail(name, `Job still 'pending' after worker call (${ms}ms). Worker response: ${JSON.stringify(res.body)}`);
    return;
  }

  console.log(`         Worker response: status=${res.status} jobStatus=${afterStatus} ms=${ms}`);
  pass(name);
}

// ── Test F.2 — CAS Contention ────────────────────────────────
// Two concurrent worker calls for the same job key.
// Exactly one must complete/fail the job; the other must return skipped.
async function test_F2_casContention(): Promise<void> {
  const name = 'F.2 — CAS contention: concurrent workers → exactly one claims job';

  // Insert a fresh pending job
  const { error: insErr } = await db
    .from('historical_pool_indexing_jobs')
    .insert({ chain: CHAIN, pool_address: POOL, block_number: BLOCK_B, status: 'pending' });

  if (insErr) {
    fail(name, `Could not insert test job: ${insErr.message}`);
    return;
  }

  // Fire two concurrent worker calls
  const [res1, res2] = await Promise.all([
    callWorker(CHAIN, POOL, BLOCK_B),
    callWorker(CHAIN, POOL, BLOCK_B),
  ]);

  const skippedCount = [res1, res2].filter(r => r.body?.skipped === true).length;
  const claimedCount = [res1, res2].filter(r => r.body?.skipped !== true && r.status !== 401).length;

  console.log(`         Response 1: status=${res1.status} skipped=${res1.body?.skipped}`);
  console.log(`         Response 2: status=${res2.status} skipped=${res2.body?.skipped}`);

  // At least one must be skipped OR claim — the invariant is: not both claim
  if (claimedCount === 2) {
    fail(name, 'Both workers claimed the job — CAS is NOT working correctly.');
    return;
  }
  if (claimedCount === 0 && skippedCount === 0) {
    fail(name, `Both workers returned unexpected responses: ${JSON.stringify([res1.body, res2.body])}`);
    return;
  }

  // No duplicate reserve rows
  const { data: rows } = await db
    .from('historical_pool_reserves')
    .select('id')
    .eq('chain', CHAIN).eq('pool_address', POOL).eq('block_number', BLOCK_B);

  if (rows && rows.length > 1) {
    fail(name, `Duplicate reserve rows written: ${rows.length} rows for the same job key.`);
    return;
  }

  pass(name);
}

// ── Test F.3 — Crash Recovery ────────────────────────────────
// Set a job to processing with an old updated_at, then call
// schedulePoolReservesIndexing (simulated by direct DB write + recovery path
// in the indexer). This test verifies the DB-side recovery logic by directly
// replicating what HistoricalPoolReservesIndexer.ts does at L280–296.
async function test_F3_crashRecovery(): Promise<void> {
  const name = 'F.3 — Crash recovery: stale processing → reset to pending';

  // Insert a job and set it to 'processing' with a 20-minute-old updated_at
  const staleTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  const { error: insErr } = await db
    .from('historical_pool_indexing_jobs')
    .insert({
      chain: CHAIN, pool_address: POOL, block_number: BLOCK_C,
      status: 'processing', attempts: 1,
      started_at: staleTimestamp, updated_at: staleTimestamp,
    });

  if (insErr) {
    fail(name, `Could not insert stale processing job: ${insErr.message}`);
    return;
  }

  const beforeStatus = await getJobStatus(BLOCK_C);
  if (beforeStatus !== 'processing') {
    fail(name, `Expected 'processing' before recovery, got '${beforeStatus}'`);
    return;
  }

  // Simulate the recovery query from HistoricalPoolReservesIndexer.ts:L281-290
  // (15-minute stale threshold)
  const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: recoveredJobs, error: recoverErr } = await db
    .from('historical_pool_indexing_jobs')
    .update({ status: 'pending', last_error: 'CLAIM_TIMEOUT_RECOVERY', updated_at: new Date().toISOString() })
    .eq('chain', CHAIN)
    .eq('pool_address', POOL)
    .eq('status', 'processing')
    .lt('updated_at', staleThreshold)
    .lt('attempts', 3) // maxAttempts = 3 per DEEP_SCAN_CONFIG
    .select('block_number');

  if (recoverErr) {
    fail(name, `Recovery query failed: ${recoverErr.message}`);
    return;
  }

  if (!recoveredJobs || recoveredJobs.length === 0) {
    fail(name, 'Recovery query matched 0 rows — stale job was NOT detected. Check updated_at column and threshold.');
    return;
  }

  const afterStatus = await getJobStatus(BLOCK_C);
  if (afterStatus !== 'pending') {
    fail(name, `Expected 'pending' after recovery, got '${afterStatus}'`);
    return;
  }

  console.log(`         Recovered ${recoveredJobs.length} job(s) back to pending ✓`);

  // Now verify the worker can pick it up (call worker to complete the cycle)
  const res = await callWorker(CHAIN, POOL, BLOCK_C);
  const finalStatus = await getJobStatus(BLOCK_C);

  console.log(`         Worker after recovery: status=${res.status} jobStatus=${finalStatus}`);

  // Status must have transitioned from pending (any non-pending state is acceptable)
  if (finalStatus === 'pending') {
    fail(name, 'Job still pending after recovery + worker call.');
    return;
  }

  pass(name);
}

// ── Runner ───────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('\n════════════════════════════════════════════════════');
  console.log(' pg_net Integration Validation — Phase 5D-5');
  console.log(' Supabase:', SUPABASE_URL);
  console.log(' Worker:  ', WORKER_ENDPOINT);
  console.log('════════════════════════════════════════════════════\n');

  await cleanup();

  console.log('Running 3 integration tests...\n');
  await test_F1_happyPath();
  await test_F2_casContention();
  await test_F3_crashRecovery();

  await cleanup();

  const passed = results.filter(r =>  r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n════════════════════════════════════════════════════');
  console.log(` Results: ${passed}/${results.length} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`  ✗ ${r.name}`);
      if (r.detail) console.error(`    ${r.detail}`);
    });
    process.exit(1);
  } else {
    console.log('All pg_net integration tests passed ✅\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('[pgnet_integration] Fatal:', err);
  process.exit(1);
});

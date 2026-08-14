/**
 * Historical Pool Reserves Indexer — Phase 5D-5
 *
 * Transforms the Phase 5D-4 point-query primitive (getHistoricalV2Reserves)
 * into a bounded, asynchronous, persistent time-series indexing system.
 *
 * OWNERSHIP BOUNDARY:
 *   This module owns: snapshot scheduling, job enqueuing, deduplication,
 *   and structured query of stored snapshots.
 *
 *   It does NOT own: RPC calls, ABI decoding, block metadata retrieval.
 *   Those remain in Phase 5D-4: lib/deep_scan/historical/HistoricalPoolState.ts
 *
 * ANTI-FABRICATION:
 *   Only pools with a validated EVM address (poolIdentifierType = 'address')
 *   enter the indexing pipeline. Label-only pools are silently skipped.
 *   Only V2 constant-product pools are indexed.
 *
 * COST BOUNDS:
 *   Maximum 30 indexing jobs per scan.
 *   Backfill window: 30 days.
 *   Minimum scheduling gap: 6 hours (no duplicate jobs within same window).
 *
 * SERVER-SIDE ONLY.
 */

import { createClient } from '@supabase/supabase-js';
import { DEEP_SCAN_CONFIG } from '../config';
import { NormalizedPoolState } from '../../blockchain/types';

// ─────────────────────────────────────────────
// Constants (sourced exclusively from config)
// ─────────────────────────────────────────────

const CFG = DEEP_SCAN_CONFIG.historicalReserves;

/** Chains supported by Phase 5D-4 Alchemy historical RPC. */
const SUPPORTED_CHAINS = new Set([
  'eth', 'ethereum', '1',
  'bsc', 'binance', '56',
  'polygon', '137',
  'arbitrum', '42161',
  'base', '8453',
  'optimism', '10',
]);

/** EVM address validation regex. */
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/i;

// Approximate block times per chain (seconds per block).
// Used only to estimate which historical block corresponds to a target timestamp.
// NOT used to fabricate reserve values — reserves come from on-chain RPC only.
const BLOCK_TIME_SECONDS: Record<string, number> = {
  eth: 12,
  ethereum: 12,
  '1': 12,
  bsc: 3,
  binance: 3,
  '56': 3,
  polygon: 2,
  '137': 2,
  arbitrum: 1,
  '42161': 1,
  base: 2,
  '8453': 2,
  optimism: 2,
  '10': 2,
};

// ─────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────

let supabaseMock: any = null;

export function setSupabaseMock(mock: any) {
  supabaseMock = mock;
}

function getServiceClient() {
  if (supabaseMock) return supabaseMock;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('[HistoricalReservesIndexer] Supabase credentials not configured.');
  return createClient(url, key);
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ScheduleResult {
  poolAddress: string;
  chain: string;
  enqueuedBlocks: number[];
  skippedDuplicates: number;
  skippedV3: boolean;
  skippedLabelOnly: boolean;
  error?: string;
}

export interface HistoricalReservesRecord {
  id: string;
  chain: string;
  pool_address: string;
  pool_type: string;
  token0: string | null;
  token1: string | null;
  block_number: number;
  block_hash: string;
  timestamp: string;
  reserve0: string;
  reserve1: string;
  provider: string;
  indexed_at: string;
}

// ─────────────────────────────────────────────
// Block number calculation
// ─────────────────────────────────────────────

/**
 * Calculate historical snapshot block numbers for a pool.
 *
 * Strategy:
 *   - One snapshot per interval (default 12h) for the backfill window (default 30d).
 *   - All targets are at or before (latestBlock - finalityBuffer) for reorg safety.
 *   - Minimum gap enforcement: consecutive entries within minGapBlocks are dropped.
 *   - Result is bounded to maxJobsPerScan entries.
 *
 * IMPORTANT: Block numbers are ESTIMATED from block times.
 * Actual reserve values are fetched from those exact blocks via eth_call.
 * Reserve values are NEVER estimated or interpolated.
 */
export function calculateHistoricalSnapshotBlocks(
  chain: string,
  latestBlock: number,
  opts?: {
    backfillDays?: number;
    snapshotIntervalHours?: number;
    minSchedulingGapHours?: number;
    maxJobs?: number;
    finalityBuffer?: number;
  }
): number[] {
  const backfillDays   = opts?.backfillDays            ?? CFG.backfillDays;
  const intervalHours  = opts?.snapshotIntervalHours   ?? CFG.snapshotIntervalHours;
  const minGapHours    = opts?.minSchedulingGapHours   ?? CFG.minSchedulingGapHours;
  const maxJobs        = opts?.maxJobs                 ?? CFG.maxJobsPerScan;
  const finalityBuffer = opts?.finalityBuffer          ?? CFG.finalityBufferBlocks;

  const normalizedChain = chain.toLowerCase().trim();
  const blockTimeSec    = BLOCK_TIME_SECONDS[normalizedChain] ?? 12;

  const safeLatestBlock = latestBlock - finalityBuffer;
  if (safeLatestBlock <= 0) return [];

  const blocksPerHour  = Math.floor(3600 / blockTimeSec);
  const intervalBlocks = Math.max(1, Math.floor(intervalHours * blocksPerHour));
  const minGapBlocks   = Math.max(1, Math.floor(minGapHours * blocksPerHour));
  const backfillBlocks = backfillDays * 24 * blocksPerHour;
  const oldestBlock    = Math.max(0, safeLatestBlock - backfillBlocks);

  const blocks: number[] = [];
  let cursor = safeLatestBlock;

  while (cursor > oldestBlock && blocks.length < maxJobs) {
    if (cursor > 0) blocks.push(cursor);
    cursor -= intervalBlocks;
  }

  // Enforce minimum gap between consecutive entries
  const filtered: number[] = [];
  let lastAdded = -Infinity;
  for (const b of blocks) {
    if (lastAdded === -Infinity || (lastAdded - b) >= minGapBlocks) {
      filtered.push(b);
      lastAdded = b;
    }
  }

  // Deduplicate, filter out non-positive and post-safe blocks, cap
  return [...new Set(filtered)]
    .filter(b => b > 0 && b <= safeLatestBlock)
    .sort((a, b) => b - a)
    .slice(0, maxJobs);
}

// ─────────────────────────────────────────────
// Job Enqueue
// ─────────────────────────────────────────────

/**
 * Schedule historical reserve indexing for a single V2 pool.
 *
 * Validates the pool is:
 *   - A real EVM address (not a label)
 *   - A constant-product (V2) pool
 *   - On a supported chain
 *
 * Calculates bounded snapshot block numbers and inserts them into the
 * historical_pool_indexing_jobs queue. Duplicates are silently ignored
 * (ON CONFLICT DO NOTHING via ignoreDuplicates: true).
 */
export async function schedulePoolReservesIndexing(
  pool: NormalizedPoolState,
  chain: string,
  latestBlock: number,
  bypassCooldown = false
): Promise<ScheduleResult> {
  const poolAddress = pool.poolIdentifier;

  // Guard: only address-type pools enter indexing
  if (pool.poolIdentifierType !== 'address') {
    return { poolAddress, chain, enqueuedBlocks: [], skippedDuplicates: 0, skippedV3: false, skippedLabelOnly: true };
  }

  // Guard: validate EVM address format
  if (!EVM_ADDRESS_RE.test(poolAddress)) {
    return {
      poolAddress, chain, enqueuedBlocks: [], skippedDuplicates: 0, skippedV3: false, skippedLabelOnly: false,
      error: `Invalid EVM pool address: ${poolAddress}`,
    };
  }

  // Guard: only V2 constant-product pools
  if (pool.poolType !== 'constant-product') {
    return { poolAddress, chain, enqueuedBlocks: [], skippedDuplicates: 0, skippedV3: true, skippedLabelOnly: false };
  }

  // Guard: chain must be supported by Phase 5D-4 Alchemy RPC
  const normalizedChain = chain.toLowerCase().trim();
  if (!SUPPORTED_CHAINS.has(normalizedChain)) {
    return {
      poolAddress, chain, enqueuedBlocks: [], skippedDuplicates: 0, skippedV3: false, skippedLabelOnly: false,
      error: `Unsupported chain: ${chain}`,
    };
  }

  // Calculate bounded snapshot block numbers
  const blockNumbers = calculateHistoricalSnapshotBlocks(normalizedChain, latestBlock);
  if (blockNumbers.length === 0) {
    return { poolAddress, chain: normalizedChain, enqueuedBlocks: [], skippedDuplicates: 0, skippedV3: false, skippedLabelOnly: false };
  }

  const jobRows = blockNumbers.map(blockNumber => ({
    chain:        normalizedChain,
    pool_address: poolAddress.toLowerCase(),
    block_number: blockNumber,
    status:       'pending' as const,
    attempts:     0,
  }));

  const supabase = getServiceClient();

  // 1. Real 6-Hour Cooldown check per pool
  if (!bypassCooldown) {
    try {
      const cooldownThreshold = new Date(Date.now() - CFG.minSchedulingGapHours * 60 * 60 * 1000).toISOString();
      const { data: recentJobs, error: cooldownErr } = await supabase
        .from('historical_pool_indexing_jobs')
        .select('enqueued_at')
        .eq('chain', normalizedChain)
        .eq('pool_address', poolAddress.toLowerCase())
        .gt('enqueued_at', cooldownThreshold)
        .limit(1);

      if (cooldownErr) {
        console.warn('[HistoricalReservesIndexer] Cooldown check failed:', cooldownErr.message);
      } else if (recentJobs && recentJobs.length > 0) {
        console.log(`[HistoricalReservesIndexer] Scheduling skipped for ${poolAddress} on ${normalizedChain} (inside 6-hour cooldown).`);
        return { poolAddress, chain: normalizedChain, enqueuedBlocks: [], skippedDuplicates: 0, skippedV3: false, skippedLabelOnly: false };
      }
    } catch (err: any) {
      console.warn('[HistoricalReservesIndexer] Cooldown check exception:', err?.message);
    }
  }

  // 2. Stale processing job recovery (15 mins timeout)
  try {
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recoveredJobs, error: recoverErr } = await supabase
      .from('historical_pool_indexing_jobs')
      .update({ status: 'pending', last_error: 'CLAIM_TIMEOUT_RECOVERY', updated_at: new Date().toISOString() })
      .eq('chain', normalizedChain)
      .eq('pool_address', poolAddress.toLowerCase())
      .eq('status', 'processing')
      .lt('updated_at', staleThreshold)
      .lt('attempts', CFG.maxAttempts)
      .select('block_number');

    if (recoverErr) {
      console.warn('[HistoricalReservesIndexer] Stale recovery failed:', recoverErr.message);
    } else if (recoveredJobs && recoveredJobs.length > 0) {
      console.log(`[HistoricalReservesIndexer] Recovered ${recoveredJobs.length} stale processing job(s) back to pending for pool ${poolAddress}.`);
    }
  } catch (err: any) {
    console.warn('[HistoricalReservesIndexer] Stale recovery exception:', err?.message);
  }

  try {
    const { data, error } = await supabase
      .from('historical_pool_indexing_jobs')
      .upsert(jobRows, { onConflict: 'chain,pool_address,block_number', ignoreDuplicates: true })
      .select('block_number');

    if (error) {
      console.error('[HistoricalReservesIndexer] Job insert failed:', error.message);
      return {
        poolAddress, chain: normalizedChain, enqueuedBlocks: [], skippedDuplicates: 0, skippedV3: false, skippedLabelOnly: false,
        error: error.message,
      };
    }

    const enqueuedBlocks    = (data ?? []).map((r: any) => r.block_number as number);
    const skippedDuplicates = blockNumbers.length - enqueuedBlocks.length;

    console.log(
      `[HistoricalReservesIndexer] Enqueued ${enqueuedBlocks.length} jobs for pool ${poolAddress} ` +
      `on ${normalizedChain} (${skippedDuplicates} duplicate skips).`
    );

    return { poolAddress, chain: normalizedChain, enqueuedBlocks, skippedDuplicates, skippedV3: false, skippedLabelOnly: false };
  } catch (err: any) {
    console.error('[HistoricalReservesIndexer] Unexpected error:', err?.message);
    return {
      poolAddress, chain: normalizedChain, enqueuedBlocks: [], skippedDuplicates: 0, skippedV3: false, skippedLabelOnly: false,
      error: err?.message ?? 'Unknown error',
    };
  }
}

// ─────────────────────────────────────────────
// Query Stored Snapshots
// ─────────────────────────────────────────────

/**
 * Query stored historical reserve records for a pool.
 * Returns records ordered newest-first. Returns empty array if unavailable.
 * Never throws — returns [] on any error.
 */
export async function queryHistoricalReserves(
  chain: string,
  poolAddress: string,
  limit = 90
): Promise<HistoricalReservesRecord[]> {
  if (!EVM_ADDRESS_RE.test(poolAddress)) return [];

  const supabase = getServiceClient();

  try {
    const { data, error } = await supabase
      .from('historical_pool_reserves')
      .select('*')
      .eq('chain', chain.toLowerCase().trim())
      .eq('pool_address', poolAddress.toLowerCase())
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[HistoricalReservesIndexer] Query failed:', error.message);
      return [];
    }

    return (data ?? []) as HistoricalReservesRecord[];
  } catch (err: any) {
    console.warn('[HistoricalReservesIndexer] Query exception:', err?.message);
    return [];
  }
}

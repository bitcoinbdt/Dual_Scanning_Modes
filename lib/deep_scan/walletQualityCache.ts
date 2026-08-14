/**
 * Wallet Quality Cache — Phase 5C
 *
 * Provides cache-first wallet quality profile lookup backed by the
 * Supabase wallet_reputation PostgreSQL table.
 *
 * CACHE TTL SEMANTICS:
 *   < 12 days  → FRESH_CACHE  (no revalidation)
 *   12–15 days → FRESH_CACHE  + async SWR revalidation enqueued
 *   >= 15 days → STALE_CACHE
 *   missing    → MISS
 *
 * NEVER FABRICATE:
 *   Missing profiles return status='miss'. Database errors return status='unavailable'.
 *   No synthetic ages or transaction counts are ever generated.
 *
 * SERVER-SIDE ONLY.
 */

import { createClient } from '@supabase/supabase-js';
import type {
  WalletQualityProfile,
  WalletCacheLookupResult,
} from '../providers/adapter-types';

// ── Cache TTL constants (in days) ──
export const WALLET_CACHE_FRESH_DAYS = 12;  // Below this: FRESH_CACHE, no revalidation
export const WALLET_CACHE_SWR_DAYS   = 15;  // 12–15: FRESH_CACHE + SWR revalidation
export const WALLET_CACHE_STALE_DAYS = 15;  // >= 15: STALE_CACHE

/**
 * Classify cache freshness from age in days (pure function — testable).
 */
export function classifyWalletCacheAge(ageDays: number): WalletCacheLookupResult['status'] {
  if (ageDays < WALLET_CACHE_FRESH_DAYS) return 'fresh';
  if (ageDays < WALLET_CACHE_SWR_DAYS)   return 'swr';
  return 'stale';
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('[WalletCache] Supabase service credentials not configured.');
  }
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Look up a wallet quality profile from the Supabase cache.
 *
 * Returns FRESH_CACHE, SWR (FRESH + async revalidation needed), STALE_CACHE, MISS.
 * Never throws — returns UNAVAILABLE on database error.
 */
export async function lookupWalletProfile(
  walletAddress: string,
  chain: string
): Promise<WalletCacheLookupResult> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('wallet_reputation')
      .select('*')
      .eq('address', walletAddress)
      .eq('chain', chain)
      .maybeSingle();

    if (error) {
      console.warn('[WalletCache] Lookup error:', error.message);
      return { status: 'unavailable', freshness: 'UNAVAILABLE', profile: null, reason: error.message };
    }

    if (!data) {
      return { status: 'miss', freshness: 'UNAVAILABLE', profile: null };
    }

    const lastUpdatedMs = new Date(data.last_updated_at).getTime();
    const ageDays = (Date.now() - lastUpdatedMs) / (1000 * 86400);
    const cacheStatus = classifyWalletCacheAge(ageDays);
    const freshness = (cacheStatus === 'stale') ? 'STALE_CACHE' : 'FRESH_CACHE';

    const profile: WalletQualityProfile = {
      walletAddress: data.address,
      chain:         data.chain,
      firstSeenAt:   data.first_seen_at,
      walletAgeDays: data.age_days,
      transactionCount: data.transaction_count,
      activeDaysCount:  data.active_days_count,
      lastUpdated:   Math.floor(lastUpdatedMs / 1000),
      coverage:      'complete',  // persisted profiles are considered complete
      provenance:    'goldrush',
      fundingSource:      data.funding_source ?? null,
      fundingSourceType:  (data.funding_source_type ?? null) as WalletQualityProfile['fundingSourceType'],
      fundingTxHash:      data.funding_tx_hash ?? null,
    };

    return { status: cacheStatus, freshness, profile, cacheAgeDays: ageDays };

  } catch (err: any) {
    console.warn('[WalletCache] Lookup exception:', err?.message);
    return { status: 'unavailable', freshness: 'UNAVAILABLE', profile: null, reason: err?.message };
  }
}

/**
 * Upsert a wallet quality profile into the Supabase cache.
 * Uses ON CONFLICT (address, chain) DO UPDATE to prevent duplicate records.
 * Never throws — logs warning and returns false on error.
 */
export async function upsertWalletProfile(
  profile: WalletQualityProfile
): Promise<boolean> {
  try {
    const supabase = getServiceClient();
    const lastSeenDate = new Date(profile.lastUpdated * 1000);

    const { error } = await supabase
      .from('wallet_reputation')
      .upsert({
        address:             profile.walletAddress,
        chain:               profile.chain,
        first_seen_at:       profile.firstSeenAt,
        last_seen_at:        lastSeenDate.toISOString(),
        age_days:            profile.walletAgeDays,
        transaction_count:   profile.transactionCount,
        active_days_count:   profile.activeDaysCount,
        funding_source:      profile.fundingSource ?? null,
        funding_source_type: profile.fundingSourceType ?? 'unknown',
        funding_tx_hash:     profile.fundingTxHash ?? null,
        last_updated_at:     lastSeenDate.toISOString(),
        provider:            profile.provenance,
      }, {
        onConflict: 'address,chain',
      });

    if (error) {
      console.warn('[WalletCache] Upsert failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[WalletCache] Upsert exception:', err?.message);
    return false;
  }
}

/**
 * Enqueue a wallet enrichment job in wallet_enrichment_jobs.
 * Uses ON CONFLICT (address, chain) DO NOTHING for deduplication.
 * Never throws.
 */
export async function enqueueWalletEnrichmentJob(
  walletAddress: string,
  chain: string
): Promise<boolean> {
  try {
    const supabase = getServiceClient();

    // Stuck job protection: clean up jobs older than 1 hour to prevent indefinite blocks
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    await supabase
      .from('wallet_enrichment_jobs')
      .delete()
      .lt('enqueued_at', oneHourAgo);

    const { error } = await supabase
      .from('wallet_enrichment_jobs')
      .insert({ address: walletAddress, chain, status: 'pending' });

    if (error) {
      // Unique constraint violation (23505) = already enqueued — treat as success
      if (error.code === '23505') return true;
      console.warn('[WalletCache] Enqueue failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[WalletCache] Enqueue exception:', err?.message);
    return false;
  }
}

/**
 * Mark an enrichment job as complete by removing it from the queue.
 * Never throws.
 */
export async function completeEnrichmentJob(
  walletAddress: string,
  chain: string
): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase
      .from('wallet_enrichment_jobs')
      .delete()
      .eq('address', walletAddress)
      .eq('chain', chain);
  } catch (err: any) {
    console.warn('[WalletCache] Job completion failed:', err?.message);
  }
}

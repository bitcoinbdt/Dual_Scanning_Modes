/**
 * Wallet Enrichment — Phase 5C
 *
 * Performs bounded GoldRush transactions_v3 page-walk (max 5 pages)
 * to derive a WalletQualityProfile for a single wallet address.
 *
 * BOUNDED WALK CONTRACT:
 *   Max pages: GOLDRUSH_MAX_WALLET_PAGES (5)
 *   Max transactions scanned: 500
 *
 *   If the walk ends before page 5 (has_more=false):
 *     → coverage = 'complete', firstSeenAt is as accurate as provider allows.
 *
 *   If page 5 is reached with has_more=true:
 *     → coverage = 'capped', firstSeenAt reflects oldest tx in those 5 pages.
 *     → walletAgeDays is a lower bound (wallet is at least this old).
 *
 * NEVER FABRICATE:
 *   Provider failure returns null — never a synthetic profile.
 *   Only numeric zero returned when provider explicitly confirms zero txs.
 *
 * SERVER-SIDE ONLY.
 */

import {
  isGoldrushConfigured,
  fetchGoldrushWalletTransactions,
} from '../providers/goldrush/client';
import {
  adaptGoldrushWalletHistory,
  GOLDRUSH_MAX_WALLET_PAGES,
  GOLDRUSH_WALLET_PAGE_SIZE,
  type GoldrushWalletPageAccumulator,
} from '../providers/goldrush/adapter';
import type { WalletQualityProfile } from '../providers/adapter-types';

/** Timeout (ms) for each individual page fetch during synchronous enrichment. */
const PAGE_FETCH_TIMEOUT_MS = 3000;

/** Timeout (ms) for the entire synchronous top-N enrichment batch. */
export const SYNC_ENRICHMENT_TIMEOUT_MS = 1500;

/**
 * Walk up to GOLDRUSH_MAX_WALLET_PAGES pages of transactions_v3 for one wallet.
 * Returns a WalletQualityProfile or null when no history is found / provider fails.
 * Never throws.
 */
export async function enrichSingleWallet(
  walletAddress: string,
  chain: string
): Promise<WalletQualityProfile | null> {
  if (!isGoldrushConfigured()) {
    console.log('[WalletEnrichment] GoldRush not configured — skipping enrichment.');
    return null;
  }

  const acc: GoldrushWalletPageAccumulator = {
    items: [],
    wasCapped: false,
    providerTotalCount: undefined,
  };

  const fetchedAt = Math.floor(Date.now() / 1000);

  for (let page = 0; page < GOLDRUSH_MAX_WALLET_PAGES; page++) {
    let data: any;
    try {
      data = await fetchGoldrushWalletTransactions(
        chain,
        walletAddress,
        page,
        GOLDRUSH_WALLET_PAGE_SIZE
      );
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('429')) {
        console.warn(`[WalletEnrichment] Rate limited (429) on ${walletAddress} page ${page}`);
      } else {
        console.warn(`[WalletEnrichment] Error fetching ${walletAddress} page ${page}:`, msg);
      }
      break; // Stop walk on error — partial data is still usable
    }

    if (!data || !Array.isArray(data.items)) {
      console.log(`[WalletEnrichment] ${walletAddress} page ${page}: no items in response`);
      break;
    }

    acc.items.push(...data.items);

    // Capture total count from first page pagination metadata
    if (page === 0 && data.pagination?.total_count != null) {
      acc.providerTotalCount = data.pagination.total_count;
    }

    const hasMore = data.pagination?.has_more === true;

    if (!hasMore) {
      console.log(
        `[WalletEnrichment] ${walletAddress}: complete walk (${acc.items.length} txs, ${page + 1} page(s))`
      );
      break;
    }

    if (page === GOLDRUSH_MAX_WALLET_PAGES - 1) {
      // Reached the cap — mark capped, stop
      acc.wasCapped = true;
      console.log(
        `[WalletEnrichment] ${walletAddress}: CAPPED at page ${GOLDRUSH_MAX_WALLET_PAGES} (${acc.items.length} txs)`
      );
    }
  }

  const profile = adaptGoldrushWalletHistory(acc, { chain, walletAddress, fetchedAt });

  if (!profile) {
    console.log(`[WalletEnrichment] ${walletAddress}: no usable history found.`);
  } else {
    console.log(
      `[WalletEnrichment] ${walletAddress}: age=${profile.walletAgeDays}d ` +
      `txs=${profile.transactionCount} coverage=${profile.coverage}`
    );
  }

  return profile;
}

/**
 * Enrich the top N wallets synchronously (parallel), bounded by SYNC_ENRICHMENT_TIMEOUT_MS.
 *
 * Wallets whose enrichment times out or fails remain absent from the returned Map.
 * Absence is NOT converted to a zero-value profile.
 *
 * @param wallets   - Normalized wallet addresses (EVM lowercase)
 * @param chain     - Chain slug ('eth', 'bsc', 'solana')
 * @param syncLimit - Maximum number of wallets to enrich synchronously
 */
export async function enrichTopWalletsSync(
  wallets: string[],
  chain: string,
  syncLimit: number
): Promise<Map<string, WalletQualityProfile>> {
  const profiles = new Map<string, WalletQualityProfile>();
  const toEnrich = wallets.slice(0, Math.max(0, syncLimit));

  if (toEnrich.length === 0) return profiles;

  const settled = await Promise.allSettled(
    toEnrich.map(async (addr) => {
      const timeoutRace = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('sync_enrichment_timeout')), SYNC_ENRICHMENT_TIMEOUT_MS)
      );
      const profile = await Promise.race([enrichSingleWallet(addr, chain), timeoutRace]);
      return { addr, profile };
    })
  );

  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.profile) {
      profiles.set(result.value.addr.toLowerCase(), result.value.profile);
    } else if (result.status === 'rejected') {
      const reason = (result.reason as Error)?.message ?? 'unknown';
      console.warn(`[WalletEnrichment] Sync enrichment failed (${reason}) — wallet marked unavailable`);
    }
  }

  return profiles;
}

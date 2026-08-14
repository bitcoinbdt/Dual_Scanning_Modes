/**
 * GoldRush SmartMoney Indexer Adapter — Phase 5D-2
 *
 * Walks transaction history for a wallet using the GoldRush client,
 * fetches complete event logs, and normalizes them into SmartMoneyTradeEvent structures.
 *
 * BOUNDED WALK POLICY:
 *   Max pages: DEEP_SCAN_CONFIG.smartMoney.indexing.maxPages (5)
 *   Page size: DEEP_SCAN_CONFIG.smartMoney.indexing.pageSize (100)
 *
 * SERVER-SIDE ONLY.
 */

import { fetchGoldrushWalletTransactions, isGoldrushConfigured } from './client';
import type { SmartMoneyTradeEvent } from '../../deep_scan/types';
import { DEEP_SCAN_CONFIG } from '../../deep_scan/config';
import { parseTransactionToSwaps } from '../../deep_scan/parsers/SmartMoneySwapParser';

export interface IndexResult {
  events: SmartMoneyTradeEvent[];
  coverage: 'COMPLETE' | 'CAPPED' | 'UNAVAILABLE';
}

/**
 * Perform a bounded walk of wallet history, parse event logs, and return normalized trade events.
 */
export async function indexWalletTrades(
  walletAddress: string,
  chain: string
): Promise<IndexResult> {
  if (!isGoldrushConfigured()) {
    console.warn('[SmartMoneyIndexer] GoldRush is not configured.');
    return { events: [], coverage: 'UNAVAILABLE' };
  }

  const events: SmartMoneyTradeEvent[] = [];
  const maxPages = DEEP_SCAN_CONFIG.smartMoney.indexing.maxPages ?? 5;
  const pageSize = DEEP_SCAN_CONFIG.smartMoney.indexing.pageSize ?? 100;
  const walletNorm = walletAddress.toLowerCase().trim();
  let coverage: 'COMPLETE' | 'CAPPED' | 'UNAVAILABLE' = 'COMPLETE';

  for (let page = 0; page < maxPages; page++) {
    try {
      console.log(`[SmartMoneyIndexer] Fetching ${walletNorm} on ${chain} with logs (page ${page})...`);
      // Pass noLogs = false to fetch transaction events/logs
      const response = await fetchGoldrushWalletTransactions(chain, walletNorm, page, pageSize, false);

      if (!response || !Array.isArray(response.items)) {
        break;
      }

      const items = response.items;
      for (const item of items) {
        const parsed = parseTransactionToSwaps(item, walletNorm, chain);
        events.push(...parsed);
      }

      const hasMore = response.pagination?.has_more === true;
      if (!hasMore) {
        coverage = 'COMPLETE';
        break;
      }

      // If we reached the last page but more remain
      if (page === maxPages - 1) {
        coverage = 'CAPPED';
      }
    } catch (err: any) {
      console.warn(`[SmartMoneyIndexer] Page ${page} failed for ${walletNorm}:`, err?.message);
      coverage = 'UNAVAILABLE';
      break;
    }
  }

  return { events, coverage };
}

import { WalletIntelligenceSummary } from './types';
import { isBitqueryConfigured, queryBitquery } from '../providers/bitquery/client';
import { buildWalletHistoryQuery, adaptBitqueryWalletHistory } from '../providers/bitquery/adapter';

/** Lookback constant for wallet intelligence queries (90 days) */
export const WALLET_INTELLIGENCE_LOOKBACK_DAYS = 90;

/** Maximum number of wallets to query per scan to bound requests */
const WALLET_INTELLIGENCE_MAX = 10;

/**
 * Enrich a set of whale wallets with first-seen historical data from Bitquery.
 * Bounded to at most WALLET_INTELLIGENCE_MAX wallets, queried sequentially.
 *
 * NOTE ON WINDOW SCOPE:
 *   The firstSeenTimestamp and firstSeenBlock returned in records represent the
 *   earliest activity OBSERVED within the configured lookback window (90 days).
 *   They do NOT guarantee that this is the wallet's absolute first on-chain activity
 *   since deployment.
 */
export async function enrichWhaleWallets(
  wallets: string[],
  sinceIso: string
): Promise<WalletIntelligenceSummary> {
  const summary: WalletIntelligenceSummary = {
    recordCount: 0,
    available: 0,
    unavailable: 0,
    records: [],
  };

  if (!isBitqueryConfigured() || !wallets || wallets.length === 0) {
    return summary;
  }

  // ── Normalize and deduplicate addresses ──
  const uniqueWallets: string[] = [];
  const seen = new Set<string>();

  for (const w of wallets) {
    if (!w) continue;
    const norm = w.toLowerCase().trim();
    if (seen.has(norm)) continue;
    // Basic EVM address validation for safety before query
    if (/^0x[a-fA-F0-9]{40}$/.test(norm)) {
      seen.add(norm);
      uniqueWallets.push(norm);
    }
  }

  if (uniqueWallets.length === 0) {
    return summary;
  }

  const query = buildWalletHistoryQuery(100);
  const walletsToQuery = uniqueWallets.slice(0, WALLET_INTELLIGENCE_MAX);

  for (const wallet of walletsToQuery) {
    summary.recordCount++;
    try {
      console.log(`[Bitquery Wallet Intelligence] Querying history for ${wallet} (since ${sinceIso})...`);
      const response = await queryBitquery(query, {
        wallet,
        since: sinceIso,
      });
      const record = adaptBitqueryWalletHistory(response, wallet);
      summary.records.push(record);

      if (record.availability === 'available') {
        summary.available++;
      } else {
        summary.unavailable++;
      }
    } catch (err: any) {
      console.warn(`[Bitquery Wallet Intelligence] Failed to query history for ${wallet}:`, err.message);
      summary.unavailable++;
      summary.records.push({
        wallet: wallet.toLowerCase().trim(),
        availability: 'unavailable',
        failureKind: 'query_failure',
        reason: `Request error: ${err.message}`,
        provenance: 'bitquery',
      });
    }
  }

  return summary;
}

import { WalletIntelligenceSummary } from './types';
import { isBitqueryConfigured, queryBitquery } from '../providers/bitquery/client';
import { buildWalletHistoryQuery, adaptBitqueryWalletHistory } from '../providers/bitquery/adapter';
import { enrichSolanaWallet } from './walletEnrichment';

/** Lookback constant for wallet intelligence queries (90 days) */
export const WALLET_INTELLIGENCE_LOOKBACK_DAYS = 90;

/** Maximum number of wallets to query per scan to bound requests */
const WALLET_INTELLIGENCE_MAX = 10;

/**
 * Enrich a set of whale wallets with first-seen historical data.
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
  sinceIso: string,
  network?: string
): Promise<WalletIntelligenceSummary> {
  const summary: WalletIntelligenceSummary = {
    recordCount: 0,
    available: 0,
    unavailable: 0,
    records: [],
  };

  if (!wallets || wallets.length === 0) {
    return summary;
  }

  const isSolana = network?.toLowerCase() === 'solana';

  // ── Normalize and deduplicate addresses ──
  const uniqueWallets: string[] = [];
  const seen = new Set<string>();

  for (const w of wallets) {
    if (!w) continue;
    const norm = isSolana ? w.trim() : w.toLowerCase().trim();
    if (seen.has(norm)) continue;
    
    // Network-specific address validation
    const isValid = isSolana
      ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(norm)
      : /^0x[a-fA-F0-9]{40}$/.test(norm);

    if (isValid) {
      seen.add(norm);
      uniqueWallets.push(norm);
    }
  }

  if (uniqueWallets.length === 0) {
    return summary;
  }

  const walletsToQuery = uniqueWallets.slice(0, WALLET_INTELLIGENCE_MAX);

  // Solana path: enrich using Helius
  if (isSolana) {
    for (const wallet of walletsToQuery) {
      summary.recordCount++;
      try {
        console.log(`[Helius Wallet Intelligence] Querying history for ${wallet}...`);
        const profile = await enrichSolanaWallet(wallet);
        if (profile) {
          const firstSeenTimestamp = profile.firstSeenAt
            ? Math.floor(Date.parse(profile.firstSeenAt) / 1000)
            : undefined;
          summary.records.push({
            wallet,
            availability: 'available',
            firstSeenTimestamp,
            provenance: 'helius',
          });
          summary.available++;
        } else {
          summary.records.push({
            wallet,
            availability: 'unavailable',
            failureKind: 'no_history_found',
            reason: 'Helius returned no history for this wallet',
            provenance: 'helius',
          });
          summary.unavailable++;
        }
      } catch (err: any) {
        console.warn(`[Helius Wallet Intelligence] Failed to query history for ${wallet}:`, err.message);
        summary.unavailable++;
        summary.records.push({
          wallet,
          availability: 'unavailable',
          failureKind: 'query_failure',
          reason: `Request error: ${err.message}`,
          provenance: 'helius',
        });
      }
    }
    return summary;
  }

  // EVM path: enrich using Bitquery
  if (!isBitqueryConfigured()) {
    return summary;
  }

  const query = buildWalletHistoryQuery(100);

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

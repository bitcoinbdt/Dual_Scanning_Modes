/**
 * Bitquery → Canonical Wallet History Adapter
 *
 * Transforms raw Bitquery GraphQL EVM.Transfers query responses into the
 * canonical WalletHistoryRecord shape, providing wallet first-seen data
 * for Deep Scan wallet intelligence.
 *
 * PURE TRANSFORMATION — no HTTP calls, no OAuth token management.
 * All network I/O and authentication is handled by:
 *   lib/providers/bitquery/auth.ts   — OAuth token lifecycle
 *   lib/providers/bitquery/client.ts — GraphQL execution
 * This adapter only parses and normalizes already-fetched GraphQL data.
 *
 * SERVER-SIDE ONLY.
 * Must never be imported by React components or client-side modules.
 * OAuth tokens must never be logged or returned to clients.
 *
 * QUERY SCOPE:
 *   This adapter is designed for the following Bitquery query pattern:
 *
 *   query WalletFirstSeen($wallet: String!, $token: String!, $since: ISO8601DateTime!) {
 *     EVM(network: eth) {
 *       Transfers(
 *         where: {
 *           any: [
 *             { Transfer: { Sender: { is: $wallet } } }
 *             { Transfer: { Receiver: { is: $wallet } } }
 *           ]
 *           Block: { Time: { since: $since } }
 *         }
 *         orderBy: { ascendingByField: "Block_Time" }
 *         limit: { count: 100 }
 *       ) {
 *         Block {
 *           Time
 *           Number
 *         }
 *       }
 *     }
 *   }
 *
 * NEVER FABRICATE:
 *   firstSeenTimestamp and firstSeenBlock must only be set if the provider
 *   explicitly returned them.  If timestamp parsing fails, they remain
 *   undefined rather than defaulting to 0 or epoch.
 */

import type { WalletHistoryRecord } from '../adapter-types';

// ─────────────────────────────────────────────────────────────────────────────
// Raw Bitquery response types (internal — not exported)
// ─────────────────────────────────────────────────────────────────────────────

interface BitqueryBlock {
  Time?: string | null;
  Number?: number | string | null;
}

interface BitqueryTransfer {
  Block?: BitqueryBlock;
  [key: string]: unknown;
}

interface BitqueryEvmTransfers {
  Transfers?: BitqueryTransfer[] | null;
  [key: string]: unknown;
}

interface BitqueryEvmResponse {
  EVM?: BitqueryEvmTransfers | null;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an ISO 8601 timestamp string to Unix seconds.
 * Returns undefined if the string is falsy or unparseable.
 *
 * NEVER returns 0 or epoch as a fallback — unparseable input → undefined.
 */
function parseIsoToUnixSeconds(iso: string | null | undefined): number | undefined {
  if (!iso || typeof iso !== 'string' || iso.trim() === '') return undefined;
  const ms = Date.parse(iso.trim());
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return Math.floor(ms / 1000);
}

/**
 * Parse a block number from the Bitquery response.
 * Bitquery may return Number as a number or a string.
 * Returns undefined if not parseable as a positive integer.
 */
function parseBlockNumber(raw: number | string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform a raw Bitquery EVM.Transfers query response into a canonical
 * WalletHistoryRecord.
 *
 * @param raw    - The `data` object returned by queryBitquery().
 *                 The Bitquery client returns response.data.data, so the
 *                 expected shape is: { EVM: { Transfers: [...] } }.
 *                 Pass null/undefined to produce availability='unavailable'.
 * @param wallet - The wallet address this query was made for (for record identity).
 * @returns      Canonical WalletHistoryRecord — never throws.
 *
 * CALLER CONTRACT:
 *   1. Build the query string targeting EVM.Transfers for the wallet.
 *   2. Execute via queryBitquery(query, variables) from client.ts.
 *   3. Pass the returned data object to this function.
 *   4. The wallet parameter must match the address used in the query variables.
 *
 * AVAILABILITY SEMANTICS:
 *   'available'   — at least one transfer found; firstSeenTimestamp/Block populated.
 *   'partial'     — transfers found but Block.Time or Block.Number could not be parsed.
 *   'unavailable' — null input, empty transfers, or malformed response.
 */
export function adaptBitqueryWalletHistory(
  raw: unknown,
  wallet: string
): WalletHistoryRecord {
  const walletNorm = (wallet ?? '').toLowerCase().trim();

  // ── Guard: null / undefined ──
  if (raw === null || raw === undefined) {
    return {
      wallet: walletNorm,
      availability: 'unavailable',
      failureKind: 'query_failure',
      reason: 'Bitquery response was null or undefined (query not executed or failed).',
      provenance: 'bitquery',
    };
  }

  // ── Guard: unexpected root shape ──
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      wallet: walletNorm,
      availability: 'unavailable',
      failureKind: 'malformed_response',
      reason: 'Bitquery response root is not an object.',
      provenance: 'bitquery',
    };
  }

  const root = raw as BitqueryEvmResponse;

  // ── Guard: EVM key missing ──
  if (!root.EVM || typeof root.EVM !== 'object') {
    return {
      wallet: walletNorm,
      availability: 'unavailable',
      failureKind: 'malformed_response',
      reason: 'Bitquery response missing expected EVM key.',
      provenance: 'bitquery',
    };
  }

  const evm = root.EVM as BitqueryEvmTransfers;

  // ── Guard: Transfers key missing or not an array ──
  if (!Array.isArray(evm.Transfers)) {
    return {
      wallet: walletNorm,
      availability: 'unavailable',
      failureKind: 'malformed_response',
      reason: 'Bitquery EVM.Transfers is missing or not an array.',
      provenance: 'bitquery',
    };
  }

  const transfers = evm.Transfers as BitqueryTransfer[];

  // ── Guard: no transfers found ──
  if (transfers.length === 0) {
    return {
      wallet: walletNorm,
      availability: 'unavailable',
      failureKind: 'no_history_found',
      reason: 'Bitquery returned zero transfers for this wallet in the query window.',
      provenance: 'bitquery',
    };
  }

  // ── Sort ascending by Block.Time (earliest first) ──
  // The query requests orderBy ascending, but we re-sort defensively.
  const sorted = [...transfers].sort((a, b) => {
    const ta = parseIsoToUnixSeconds(a.Block?.Time) ?? 0;
    const tb = parseIsoToUnixSeconds(b.Block?.Time) ?? 0;
    return ta - tb;
  });

  const earliest = sorted[0];
  const firstSeenTimestamp = parseIsoToUnixSeconds(earliest.Block?.Time);
  const firstSeenBlock = parseBlockNumber(earliest.Block?.Number);
  const txCountObserved = transfers.length;

  // ── Determine availability based on field completeness ──
  if (firstSeenTimestamp === undefined && firstSeenBlock === undefined) {
    // Transfers exist but no usable Block metadata
    return {
      wallet: walletNorm,
      availability: 'partial',
      txCountObserved,
      reason: 'Bitquery returned transfers but Block.Time and Block.Number could not be parsed.',
      provenance: 'bitquery',
    };
  }

  if (firstSeenTimestamp === undefined || firstSeenBlock === undefined) {
    // One of timestamp or block number is missing — partial result
    return {
      wallet: walletNorm,
      availability: 'partial',
      firstSeenTimestamp,
      firstSeenBlock,
      txCountObserved,
      reason: firstSeenTimestamp === undefined
        ? 'Bitquery Block.Time could not be parsed for earliest transfer.'
        : 'Bitquery Block.Number could not be parsed for earliest transfer.',
      provenance: 'bitquery',
    };
  }

  // ── Full success ──
  return {
    wallet: walletNorm,
    availability: 'available',
    firstSeenTimestamp,
    firstSeenBlock,
    txCountObserved,
    provenance: 'bitquery',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL query builder (helper for callers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the Bitquery EVM.Transfers GraphQL query string for wallet first-seen.
 *
 * This query retrieves the first up to `limit` transfers (send or receive)
 * involving the wallet since `sinceIso`.  The result should be passed to
 * adaptBitqueryWalletHistory() after execution.
 *
 * @param limit - Max transfers to return (default 100; higher = more complete
 *                but slower).  Keep low for per-wallet latency budgets.
 */
export function buildWalletHistoryQuery(limit = 100): string {
  return `
    query WalletFirstSeen(
      $wallet: String!
      $since: ISO8601DateTime!
    ) {
      EVM(network: eth) {
        Transfers(
          where: {
            any: [
              { Transfer: { Sender: { is: $wallet } } }
              { Transfer: { Receiver: { is: $wallet } } }
            ]
            Block: { Time: { since: $since } }
          }
          orderBy: { ascendingByField: "Block_Time" }
          limit: { count: ${limit} }
        ) {
          Block {
            Time
            Number
          }
        }
      }
    }
  `.trim();
}

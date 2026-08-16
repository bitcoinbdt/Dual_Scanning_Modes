/**
 * GoldRush (Covalent) → Canonical EVM Holder Adapter
 *
 * Transforms raw GoldRush /token_holders/ API responses into the canonical
 * EvmHolderDataset shape consumed by Deep Scan engines.
 *
 * PURE TRANSFORMATION — no HTTP calls.
 * All network I/O is handled by lib/providers/goldrush/client.ts.
 * This adapter only parses and normalizes already-fetched provider JSON.
 *
 * SERVER-SIDE ONLY.
 * Must never be imported by React components or client-side modules.
 *
 * TX_COUNT DECISION:
 *   GoldRush /token_holders/ does NOT return per-wallet transaction counts.
 *   HolderInfo.tx_count is set to 0 for schema compatibility.
 *   This is an explicit design decision — it must not be interpreted as
 *   an observed zero-transaction count.
 *
 * ZERO ADDRESS FILTER:
 *   The canonical zero address (0x000...000) is excluded from the holder list
 *   as it represents burned/locked tokens, not an actual holder.
 *   The dead address (0x000...dead) is also excluded.
 */

import type { HolderInfo } from '../../elevator/collectors/types';
import type { EvmHolderDataset, WalletQualityProfile } from '../adapter-types';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Addresses that must be filtered out from on-chain holder lists.
 * These represent protocol-internal or burn addresses, not real holders.
 */
const EXCLUDED_ADDRESSES = new Set<string>([
  '0x0000000000000000000000000000000000000000', // Zero / null address
  '0x000000000000000000000000000000000000dead', // Dead / burn address
]);

/** Default ERC-20 decimal places used when opts.tokenDecimals is not supplied. */
const DEFAULT_DECIMALS = 18;

// ─────────────────────────────────────────────────────────────────────────────
// Raw GoldRush response types (internal — not exported)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single item from the GoldRush /token_holders/ items array.
 * GoldRush returns balance as a decimal string (not hex).
 */
interface GoldrushHolderItem {
  address?: string;
  balance?: string | number;
  [key: string]: unknown;
}

/**
 * Pagination metadata from the GoldRush /token_holders/ response.
 */
interface GoldrushPagination {
  total_count?: number | null;
  [key: string]: unknown;
}

/**
 * Root shape of the GoldRush /token_holders/ data object.
 * (The client already unwraps the outer { data: ... } envelope.)
 */
interface GoldrushHoldersData {
  items?: GoldrushHolderItem[] | null;
  pagination?: GoldrushPagination | null;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a balance string/number into a human-readable token unit number.
 *
 * GoldRush returns balances as decimal strings representing raw token units
 * (i.e. not yet divided by 10^decimals).  For example, a balance of
 * "1000000000000000000" with decimals=18 represents 1.0 token.
 *
 * Returns NaN if the input cannot be parsed — callers must handle NaN.
 */
function parseBalance(raw: string | number | undefined, decimals: number): number {
  if (raw === undefined || raw === null || raw === '') return NaN;
  const str = String(raw).trim();
  if (!/^-?\d+$/.test(str)) return NaN; // Reject non-integer strings
  try {
    const divisor = Math.pow(10, decimals);
    // Use BigInt for precision on large uint256 values
    return Number(BigInt(str)) / divisor;
  } catch {
    return NaN;
  }
}

/**
 * Normalise an EVM address to lowercase for consistent comparison.
 * Returns null if the address is falsy or whitespace-only.
 */
function normalizeAddress(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for the GoldRush holder adapter.
 */
export interface AdaptGoldrushHoldersOpts {
  /** EVM chain slug passed to the API call (e.g. 'eth-mainnet', 'bsc-mainnet'). */
  chain: string;
  /** Token contract address (will be lowercased for normalisation). */
  tokenAddress: string;
  /**
   * Number of decimal places for the token.
   * Defaults to 18 if not supplied.
   * Must be provided for non-standard tokens (e.g. USDC = 6).
   */
  tokenDecimals?: number;
  /** Unix timestamp (seconds) when the data was fetched — set by caller. */
  snapshotAt?: number;
}

/**
 * Transform a raw GoldRush token-holder API response into a canonical
 * EvmHolderDataset.
 *
 * @param raw     - The unwrapped `data` object returned by queryGoldrush().
 *                  Pass null/undefined to produce status='unavailable'.
 * @param opts    - Chain, token address, decimals, and snapshot timestamp.
 * @returns       Canonical EvmHolderDataset — never throws.
 *
 * CALLER CONTRACT:
 *   The caller is responsible for:
 *   1. Fetching the raw response via lib/providers/goldrush/client.ts.
 *   2. Passing the unwrapped data object (client already unwraps the envelope).
 *   3. Providing the correct tokenDecimals for balance normalisation.
 *   4. Setting snapshotAt to Math.floor(Date.now() / 1000) at fetch time.
 *
 * TX_COUNT NOTE:
 *   All returned HolderInfo.tx_count values are 0.
 *   GoldRush does not provide per-wallet tx counts from this endpoint.
 *   Do not interpret 0 as an observed zero-transaction count.
 */
export function adaptGoldrushHolders(
  raw: unknown,
  opts: AdaptGoldrushHoldersOpts
): EvmHolderDataset {
  const decimals =
    typeof opts.tokenDecimals === 'number' && Number.isFinite(opts.tokenDecimals) && opts.tokenDecimals >= 0
      ? opts.tokenDecimals
      : DEFAULT_DECIMALS;

  const tokenAddressNorm = normalizeAddress(opts.tokenAddress) ?? opts.tokenAddress;

  // ── Guard: null/undefined raw ──
  if (raw === null || raw === undefined) {
    return {
      status: 'unavailable',
      holders: [],
      chain: opts.chain,
      tokenAddress: tokenAddressNorm,
      snapshotAt: opts.snapshotAt,
      reason: 'GoldRush response was null or undefined.',
      provenance: 'goldrush',
    };
  }

  // ── Guard: unexpected shape ──
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      status: 'unavailable',
      holders: [],
      chain: opts.chain,
      tokenAddress: tokenAddressNorm,
      snapshotAt: opts.snapshotAt,
      reason: 'GoldRush response has unexpected shape (not an object).',
      provenance: 'goldrush',
    };
  }

  const data = raw as GoldrushHoldersData;
  const items = data.items;

  // ── Guard: items missing or not an array ──
  if (!Array.isArray(items)) {
    return {
      status: 'unavailable',
      holders: [],
      chain: opts.chain,
      tokenAddress: tokenAddressNorm,
      snapshotAt: opts.snapshotAt,
      reason: 'GoldRush response missing items array.',
      provenance: 'goldrush',
    };
  }

  // ── Guard: empty items ──
  if (items.length === 0) {
    return {
      status: 'insufficient_data',
      holders: [],
      totalHolderCount: data.pagination?.total_count ?? undefined,
      chain: opts.chain,
      tokenAddress: tokenAddressNorm,
      snapshotAt: opts.snapshotAt,
      reason: 'GoldRush returned zero holder items for this token.',
      provenance: 'goldrush',
    };
  }

  // ── Map and filter items ──
  const holders: HolderInfo[] = [];

  for (const item of items) {
    const address = normalizeAddress(item.address);

    // Skip items with no address
    if (!address) continue;

    // Skip burn/null/excluded addresses
    if (EXCLUDED_ADDRESSES.has(address)) continue;

    const balance = parseBalance(item.balance as string | number | undefined, decimals);

    // Skip items with unparseable or non-positive balances
    if (!Number.isFinite(balance) || balance <= 0) continue;

    holders.push({
      wallet: address,
      balance,
      // tx_count is intentionally 0 — GoldRush does not provide this field.
      // See TX_COUNT NOTE in this file's header and in adapter-types.ts.
      tx_count: 0,
    });
  }

  // Sort descending by balance (largest holder first)
  holders.sort((a, b) => b.balance - a.balance);

  // ── Extract pagination total ──
  const totalHolderCount =
    typeof data.pagination?.total_count === 'number' && data.pagination.total_count >= 0
      ? data.pagination.total_count
      : undefined;

  // If all items were filtered (all excluded/zero-balance), treat as insufficient
  if (holders.length === 0) {
    return {
      status: 'insufficient_data',
      holders: [],
      totalHolderCount,
      chain: opts.chain,
      tokenAddress: tokenAddressNorm,
      snapshotAt: opts.snapshotAt,
      reason: 'All GoldRush holder items were filtered (excluded addresses or zero balance).',
      provenance: 'goldrush',
    };
  }

  return {
    status: 'available',
    holders,
    totalHolderCount,
    chain: opts.chain,
    tokenAddress: tokenAddressNorm,
    snapshotAt: opts.snapshotAt,
    provenance: 'goldrush',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GoldRush — Wallet Transaction History Adapter (Phase 5C)
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum pages to walk during bounded transaction-history scan. */
export const GOLDRUSH_MAX_WALLET_PAGES = 5;

/** Transactions per page sent to fetchGoldrushWalletTransactions. */
export const GOLDRUSH_WALLET_PAGE_SIZE = 100;

/**
 * A single item from the GoldRush /transactions_v3/ items array.
 * Only the fields required for WalletQualityProfile are typed.
 */
interface GoldrushTxItem {
  block_signed_at?: string | null;
  tx_hash?: string | null;
  [key: string]: unknown;
}

/**
 * Accumulated data from walking multiple pages of transactions_v3.
 * Built incrementally by the caller (walletEnrichment.ts).
 */
export interface GoldrushWalletPageAccumulator {
  /** All transaction items collected across scanned pages. */
  items: GoldrushTxItem[];
  /** true when the walk was stopped by the page cap, not by has_more=false. */
  wasCapped: boolean;
  /** Provider-reported total_count from the first page (if available). */
  providerTotalCount?: number;
}

/**
 * Options for the GoldRush wallet history adapter.
 */
export interface AdaptGoldrushWalletHistoryOpts {
  chain: string;
  walletAddress: string;
  /** Unix timestamp (seconds) at which the last page was fetched. */
  fetchedAt: number;
}

/**
 * Transform a GoldrushWalletPageAccumulator into a WalletQualityProfile.
 *
 * Returns null when:
 *   - acc.items is empty (no transaction history found)
 *   - no valid block_signed_at timestamps can be parsed from items
 *
 * CALLER CONTRACT:
 *   Walk up to GOLDRUSH_MAX_WALLET_PAGES pages using fetchGoldrushWalletTransactions,
 *   accumulating all items. Set opts.fetchedAt = Math.floor(Date.now() / 1000).
 *
 * NEVER FABRICATE:
 *   Undefined / null timestamps in items are skipped — never substituted.
 *   Returns null rather than inventing a profile from empty data.
 */
function getCexAddresses(): Record<string, string[]> {
  try {
    const cexAddressesPath = path.join(process.cwd(), 'data', 'cex-addresses.json');
    if (fs.existsSync(cexAddressesPath)) {
      const fileContent = fs.readFileSync(cexAddressesPath, 'utf8');
      const data = JSON.parse(fileContent);
      const res: Record<string, string[]> = {};
      for (const [ch, list] of Object.entries(data)) {
        if (Array.isArray(list)) {
          res[ch] = list.map((item: any) => String(item.address).toLowerCase());
        }
      }
      return res;
    }
  } catch (err) {
    console.error('[classifyFundingSource] Failed to load cex-addresses.json:', err);
  }
  return {};
}

function classifyFundingSource(address: string, chain: string): 'cex' | 'bridge' | 'wallet' | 'contract' | 'unknown' {
  const addrLower = address.toLowerCase();
  
  // 1. Check CEX
  const cexList = getCexAddresses();
  const chainCex = cexList[chain] || cexList[chain === 'eth' ? 'ethereum' : chain] || [];
  if (chainCex.includes(addrLower)) {
    return 'cex';
  }

  // 2. Check known system/contract addresses
  const knownContracts = new Set([
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
    '0xe592427a0ece92de3edee1f18e0157c05861564', // Uniswap V3 Router
    '0x68b3465833fb72a70ecdf485e0e4c7bD8665Fc45', // Uniswap V3 SwapRouter02
    '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap V2 Router
    '0x13f4ea83d0bd40e75c8222255bc855a974568dd4', // PancakeSwap V3 Router
  ]);

  if (knownContracts.has(addrLower)) {
    return 'contract';
  }

  // 3. Known bridges
  const knownBridges = new Set([
    '0x40ec5db5351afba853b691b4edf49196ea0e99a2' // Polygon bridge etc.
  ]);
  if (knownBridges.has(addrLower)) {
    return 'bridge';
  }

  return 'wallet';
}

export function adaptGoldrushWalletHistory(
  acc: GoldrushWalletPageAccumulator,
  opts: AdaptGoldrushWalletHistoryOpts
): WalletQualityProfile | null {
  if (!acc || !Array.isArray(acc.items) || acc.items.length === 0) return null;

  const timestamps: number[] = [];
  const activeDays = new Set<string>();

  for (const item of acc.items) {
    if (!item.block_signed_at) continue;
    const ms = new Date(item.block_signed_at as string).getTime();
    if (!Number.isFinite(ms) || ms <= 0) continue;
    const sec = Math.floor(ms / 1000);
    timestamps.push(sec);
    // Track unique UTC calendar days for activeDaysCount
    activeDays.add(new Date(ms).toISOString().slice(0, 10));
  }

  if (timestamps.length === 0) return null;

  const minTs = Math.min(...timestamps);
  const firstSeenAt = new Date(minTs * 1000).toISOString();
  const ageSeconds = Math.max(0, opts.fetchedAt - minTs);
  const walletAgeDays = Math.floor(ageSeconds / 86400);

  // Trace funding source
  const walletNorm = opts.walletAddress.toLowerCase();
  let resolvedFundingAddress: string | null = null;
  let resolvedFundingTxHash: string | null = null;

  for (let i = acc.items.length - 1; i >= 0; i--) {
    const tx = acc.items[i];
    const txTo = tx.to_address ? String(tx.to_address).toLowerCase() : '';
    const txFrom = tx.from_address ? String(tx.from_address).toLowerCase() : '';
    const txValue = tx.value ? Number(tx.value) : 0;

    // A. Native asset transfer to the wallet
    if (txTo === walletNorm && txFrom !== walletNorm && txValue > 0) {
      resolvedFundingAddress = txFrom;
      resolvedFundingTxHash = tx.tx_hash ? String(tx.tx_hash).toLowerCase() : null;
      break;
    }

    // B. Token transfer to the wallet
    let tokenFunder: string | null = null;
    if (Array.isArray(tx.log_events)) {
      for (const log of tx.log_events) {
        if (log.decoded?.name === 'Transfer') {
          const params = log.decoded.params || [];
          const fromParam = params.find((p: any) => p.name === 'from')?.value;
          const toParam = params.find((p: any) => p.name === 'to')?.value;
          if (fromParam && toParam) {
            const from = String(fromParam).toLowerCase();
            const to = String(toParam).toLowerCase();
            if (to === walletNorm && from !== walletNorm) {
              tokenFunder = from;
              break;
            }
          }
        }
      }
    }

    if (tokenFunder) {
      resolvedFundingAddress = tokenFunder;
      resolvedFundingTxHash = tx.tx_hash ? String(tx.tx_hash).toLowerCase() : null;
      break;
    }
  }

  const fundingSourceType = resolvedFundingAddress
    ? classifyFundingSource(resolvedFundingAddress, opts.chain)
    : null;

  return {
    walletAddress: opts.walletAddress,
    chain:         opts.chain,
    firstSeenAt,
    walletAgeDays,
    transactionCount: acc.items.length,
    activeDaysCount:  activeDays.size,
    lastUpdated:      opts.fetchedAt,
    coverage:         acc.wasCapped ? 'capped' : 'complete',
    provenance:       'goldrush',
    fundingSource:     resolvedFundingAddress,
    fundingSourceType,
    fundingTxHash:     resolvedFundingTxHash,
  };
}

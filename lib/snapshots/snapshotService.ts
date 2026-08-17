/**
 * Snapshot Service — Phase 6
 *
 * Saves and retrieves scan results as permanent, shareable point-in-time records.
 * Each snapshot gets a short human-readable ID: bs-XXXXXXXX / ev-XXXXXXXX / ds-XXXXXXXX
 *
 * Storage: Supabase `scan_snapshots` table (schema already migrated in Migration 13).
 */

import { supabase } from '../supabase';
import { customAlphabet } from 'nanoid';

// URL-safe nanoid alphabet — avoids visually ambiguous characters (0, O, l, I, 1)
const nanoid = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 8);

/** Accepted scan types and their prefix codes */
const SCAN_TYPE_PREFIXES: Record<ScanType, string> = {
  basic: 'bs',
  elevator: 'ev',
  deep: 'ds',
};

export type ScanType = 'basic' | 'elevator' | 'deep';

export interface SnapshotRecord {
  id: string;
  scanType: ScanType;
  tokenAddress: string;
  chain: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  resultJson: unknown;
  userId: string | null;
  scannedAt: string;
  expiresAt: string | null;
  viewCount: number;
  isPublic: boolean;
}

/**
 * Save a scan result snapshot and return the generated short ID.
 *
 * @param scanType      - 'basic' | 'elevator' | 'deep'
 * @param tokenAddress  - On-chain token/contract address
 * @param chain         - Network identifier (e.g. 'solana', 'eth')
 * @param tokenSymbol   - Token symbol for the snapshot record
 * @param tokenName     - Token name for the snapshot record
 * @param resultJson    - The complete scan result payload (any JSON-serializable object)
 * @param userId        - Optional user ID for ownership tracking
 * @returns             - The generated snapshot ID (e.g. 'ds-K9mX2pQr')
 */
export async function saveSnapshot(
  scanType: ScanType,
  tokenAddress: string,
  chain: string,
  tokenSymbol: string | null,
  tokenName: string | null,
  resultJson: unknown,
  userId?: string | null
): Promise<string> {
  const prefix = SCAN_TYPE_PREFIXES[scanType];
  const id = `${prefix}-${nanoid()}`;

  const { error } = await supabase.from('scan_snapshots').insert({
    id,
    scan_type: scanType,
    token_address: tokenAddress,
    chain,
    token_symbol: tokenSymbol,
    token_name: tokenName,
    result_json: resultJson,
    user_id: userId ?? null,
    scanned_at: new Date().toISOString(),
    expires_at: null, // Never expires by default
    view_count: 0,
    is_public: true,
  });

  if (error) {
    throw new Error(`[SNAPSHOT SERVICE] Failed to save snapshot: ${error.message}`);
  }

  console.log(`[SNAPSHOT SERVICE] ✅ Saved snapshot ${id} for ${tokenSymbol ?? tokenAddress} on ${chain}`);
  return id;
}

/**
 * Retrieve a snapshot by its short ID and increment its view counter.
 *
 * @param id - The snapshot short ID (e.g. 'ds-K9mX2pQr')
 * @returns  - The snapshot record, or null if not found / expired
 */
export async function getSnapshot(id: string): Promise<SnapshotRecord | null> {
  const { data, error } = await supabase
    .from('scan_snapshots')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle();

  if (error) {
    console.warn(`[SNAPSHOT SERVICE] Lookup error for ${id}:`, error.message);
    return null;
  }

  if (!data) return null;

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.log(`[SNAPSHOT SERVICE] Snapshot ${id} has expired.`);
    return null;
  }

  // Increment view counter (non-blocking)
  // Increment view counter (non-blocking)
  (async () => {
    try {
      await supabase
        .from('scan_snapshots')
        .update({ view_count: (data.view_count ?? 0) + 1 })
        .eq('id', id);
    } catch (err) {
      // Non-fatal error, ignore
    }
  })();

  return {
    id: data.id,
    scanType: data.scan_type as ScanType,
    tokenAddress: data.token_address,
    chain: data.chain,
    tokenSymbol: data.token_symbol,
    tokenName: data.token_name,
    resultJson: data.result_json,
    userId: data.user_id,
    scannedAt: data.scanned_at,
    expiresAt: data.expires_at,
    viewCount: data.view_count,
    isPublic: data.is_public,
  };
}

/**
 * List the most recent snapshots for a given token address + chain.
 * Useful for "recent scans" feed.
 */
export async function listRecentSnapshots(
  tokenAddress: string,
  chain: string,
  limit = 5
): Promise<SnapshotRecord[]> {
  const { data, error } = await supabase
    .from('scan_snapshots')
    .select('*')
    .eq('token_address', tokenAddress)
    .eq('chain', chain)
    .eq('is_public', true)
    .order('scanned_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(d => ({
    id: d.id,
    scanType: d.scan_type as ScanType,
    tokenAddress: d.token_address,
    chain: d.chain,
    tokenSymbol: d.token_symbol,
    tokenName: d.token_name,
    resultJson: d.result_json,
    userId: d.user_id,
    scannedAt: d.scanned_at,
    expiresAt: d.expires_at,
    viewCount: d.view_count,
    isPublic: d.is_public,
  }));
}

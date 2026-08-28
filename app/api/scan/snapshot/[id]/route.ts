/**
 * GET /api/scan/snapshot/[id]
 *
 * Public endpoint -- no authentication required.
 * Retrieves a stored snapshot by its short ID (e.g. "ds-K9mX2pQr").
 * View counter is incremented non-blocking on each successful retrieval.
 *
 * Returns 404 if the snapshot does not exist, has expired, or is not public.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/snapshots/snapshotService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return NextResponse.json({ error: 'Snapshot ID is required' }, { status: 400 });
  }

  try {
    const snapshot = await getSnapshot(id.trim());

    if (!snapshot) {
      return NextResponse.json(
        { error: 'This scan result does not exist or has expired.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      snapshot_id: snapshot.id,
      scan_type: snapshot.scanType,
      token_address: snapshot.tokenAddress,
      token_symbol: snapshot.tokenSymbol,
      token_name: snapshot.tokenName,
      chain: snapshot.chain,
      scanned_at: snapshot.scannedAt,
      expires_at: snapshot.expiresAt,
      view_count: snapshot.viewCount,
      result: snapshot.resultJson,
    });
  } catch (err: any) {
    console.error(`[SNAPSHOT API] Error fetching snapshot ${id}:`, err?.message);
    return NextResponse.json({ error: 'Failed to retrieve snapshot.' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
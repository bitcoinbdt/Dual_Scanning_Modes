/**
 * POST /api/scan/snapshot
 *
 * Saves a completed scan result as a permanent, shareable snapshot.
 * Returns a short snapshot ID (e.g. "ds-K9mX2pQr") and the public share URL.
 *
 * Auth: Bearer token required (same as other scan routes).
 * Cost: No credits deducted -- snapshots are free to save.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';
import { saveSnapshot, ScanType } from '@/lib/snapshots/snapshotService';

const VALID_SCAN_TYPES: ScanType[] = ['basic', 'elevator', 'deep'];

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid session. Please sign in again.' },
        { status: 401 }
      );
    }

    // 2. Parse and validate body
    const body = await request.json().catch(() => ({}));
    const { scan_type, token_address, chain, token_symbol, token_name, result } = body;

    if (!scan_type || !VALID_SCAN_TYPES.includes(scan_type)) {
      return NextResponse.json(
        { error: `scan_type must be one of: ${VALID_SCAN_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!token_address || typeof token_address !== 'string') {
      return NextResponse.json({ error: 'token_address is required' }, { status: 400 });
    }
    if (!chain || typeof chain !== 'string') {
      return NextResponse.json({ error: 'chain is required' }, { status: 400 });
    }
    if (!result || typeof result !== 'object') {
      return NextResponse.json({ error: 'result payload is required' }, { status: 400 });
    }

    // 3. Save snapshot
    const snapshotId = await saveSnapshot(
      scan_type,
      token_address,
      chain,
      token_symbol ?? null,
      token_name ?? null,
      result,
      user.id
    );

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://scanner.app';
    const shareUrl = `${baseUrl}/scan/${snapshotId}`;

    return NextResponse.json({ snapshot_id: snapshotId, share_url: shareUrl });
  } catch (err: any) {
    console.error('[SNAPSHOT API] Failed to save snapshot:', err?.message);
    return NextResponse.json(
      { error: 'Failed to save snapshot. Please try again.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;

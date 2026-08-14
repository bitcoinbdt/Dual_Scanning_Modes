/**
 * Wallet Enrichment Worker Endpoint — Phase 5C
 *
 * Processes a single wallet enrichment job dispatched by pg_net or
 * equivalent async caller. Performs a bounded 5-page GoldRush
 * transactions_v3 walk and persists the result to wallet_reputation.
 *
 * SECURITY:
 *   All requests must supply the x-worker-secret header matching
 *   WORKER_SECRET_KEY. Requests without a valid secret are rejected
 *   with 401 before any provider call is made.
 *
 * IDEMPOTENCY:
 *   The upsertWalletProfile call uses ON CONFLICT (address, chain) DO UPDATE,
 *   so duplicate delivery of the same job produces the same outcome.
 *
 * NEVER FABRICATE:
 *   If GoldRush returns no history, no profile is persisted.
 *   The wallet remains a cache miss for subsequent scans.
 *
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enrichSingleWallet } from '@/lib/deep_scan/walletEnrichment';
import { upsertWalletProfile, completeEnrichmentJob } from '@/lib/deep_scan/walletQualityCache';
import { normalizeAddress } from '@/lib/deep_scan/types';

/** EVM address pattern (0x-prefixed, 40 hex chars). */
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Chain slugs accepted by this worker. Expand as infrastructure grows. */
const SUPPORTED_CHAINS = new Set(['eth', 'bsc', 'base', 'solana']);

export async function POST(request: NextRequest) {
  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const workerSecret = process.env.WORKER_SECRET_KEY;
  if (!workerSecret) {
    console.error('[WalletWorker] WORKER_SECRET_KEY not configured — rejecting all requests.');
    return NextResponse.json(
      { error: 'Worker not configured.' },
      { status: 500 }
    );
  }

  const incomingSecret = request.headers.get('x-worker-secret');
  if (!incomingSecret || incomingSecret !== workerSecret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Parse + validate body ─────────────────────────────────────────────
  let body: { address?: unknown; chain?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawAddress = body.address;
  const rawChain   = body.chain;

  if (typeof rawAddress !== 'string' || !rawAddress.trim()) {
    return NextResponse.json({ error: '"address" is required (string).' }, { status: 400 });
  }
  if (typeof rawChain !== 'string' || !rawChain.trim()) {
    return NextResponse.json({ error: '"chain" is required (string).' }, { status: 400 });
  }

  const normalizedChain = rawChain.trim().toLowerCase();
  if (!SUPPORTED_CHAINS.has(normalizedChain)) {
    return NextResponse.json(
      { error: `Unsupported chain "${normalizedChain}". Supported: ${[...SUPPORTED_CHAINS].join(', ')}` },
      { status: 400 }
    );
  }

  // ── 3. Validate + normalize address ──────────────────────────────────────
  let normalizedAddr: string;
  if (normalizedChain === 'solana') {
    // Solana addresses are base58 — preserve case, just trim
    normalizedAddr = rawAddress.trim();
    if (!normalizedAddr || normalizedAddr.length < 32) {
      return NextResponse.json({ error: 'Invalid Solana address.' }, { status: 400 });
    }
  } else {
    if (!EVM_ADDRESS_RE.test(rawAddress.trim())) {
      return NextResponse.json(
        { error: 'Invalid EVM address format (expected 0x + 40 hex chars).' },
        { status: 400 }
      );
    }
    normalizedAddr = normalizeAddress(rawAddress.trim());
  }

  console.log(`[WalletWorker] Enriching ${normalizedAddr} on ${normalizedChain}...`);

  // ── 4. Bounded enrichment ─────────────────────────────────────────────────
  let profile;
  try {
    profile = await enrichSingleWallet(normalizedAddr, normalizedChain);
  } catch (err: any) {
    console.error(`[WalletWorker] Enrichment exception for ${normalizedAddr}:`, err?.message);
    await completeEnrichmentJob(normalizedAddr, normalizedChain);
    return NextResponse.json(
      { error: 'Provider enrichment failed.', code: 'PROVIDER_FAILURE' },
      { status: 502 }
    );
  }

  // ── 5. Persist profile ────────────────────────────────────────────────────
  if (profile) {
    const saved = await upsertWalletProfile(profile);
    console.log(
      `[WalletWorker] ${normalizedAddr}: age=${profile.walletAgeDays}d ` +
      `txs=${profile.transactionCount} coverage=${profile.coverage} saved=${saved}`
    );
  } else {
    console.log(`[WalletWorker] ${normalizedAddr}: no history found — not persisted.`);
  }

  // ── 6. Mark job complete ──────────────────────────────────────────────────
  await completeEnrichmentJob(normalizedAddr, normalizedChain);

  return NextResponse.json({
    success: true,
    address: normalizedAddr,
    chain:   normalizedChain,
    enriched: !!profile,
    walletAgeDays: profile?.walletAgeDays,
    coverage: profile?.coverage,
  });
}

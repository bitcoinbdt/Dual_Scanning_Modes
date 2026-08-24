/**
 * Deep Scan API Route
 *
 * Coordinates execution of the Deep Scan intelligence suite.
 * Supports Scenario A (direct reuse of session Elevator collector data)
 * and Scenario B (dynamic transaction crawling on the fly).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';
import { DeepScanService } from '@/lib/deep_scan/DeepScanService';
import { detectChain, isChainSupported } from '@/lib/elevator/utils/chainDetector';
import { autoDetectChainId } from '@/lib/blockchain/evmScanner';
import { saveSnapshot } from '@/lib/snapshots/snapshotService';
import crypto from 'crypto';

const DEFAULT_DEEP_SCAN_COST = 15; // 15 credits standard cost

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let creditsDeducted = false;
  let scanCompleted = false;  // F-9: only refund if scan itself failed, not response-building
  let refundIssued = false;   // P1-3: prevents double-refund if catch block executes more than once
  let creditsSpentVal = DEFAULT_DEEP_SCAN_COST;
  let tokenAddr = '';
  const scanId = crypto.randomUUID(); // Unique scan ID for database and session cache

  try {
    // 1. Authenticate user
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required to run Deep Scan' },
        { status: 401 }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid session. Please sign in again.' },
        { status: 401 }
      );
    }

    userId = user.id;

    // 2. Parse request payload
    const body = await request.json().catch(() => ({}));
    const { address, preferredChain, chain, elevatorResult, tokenMetadata } = body;
    const resolvedChain = preferredChain || chain;
    tokenAddr = address;

    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // 3. Chain detection
    let detection = detectChain(address, resolvedChain);
    if (!detection.isValid && detection.reason === 'ambiguous_evm') {
      try {
        const chainId = await autoDetectChainId(address);
        const resolvedChain = chainId === '56' ? 'bsc' : 'eth';
        detection = {
          chain: resolvedChain,
          isValid: true,
          format: resolvedChain === 'bsc' ? 'EVM (BSC)' : 'EVM (Ethereum)',
        };
      } catch (err) {
        console.error('[DEEP API] Chain resolution failed:', err);
      }
    }

    if (!detection.isValid) {
      return NextResponse.json(
        { error: 'Invalid token address format or unsupported chain', code: 'INVALID_ADDRESS' },
        { status: 400 }
      );
    }

    if (!isChainSupported(detection.chain)) {
      return NextResponse.json(
        { error: 'Selected blockchain is not supported', code: 'UNSUPPORTED_CHAIN' },
        { status: 400 }
      );
    }

    // 4. Atomic credit deduction
    const { data: newBalance, error: rpcError } = await supabase.rpc(
      'deduct_credits_for_scan',
      {
        p_user_id: user.id,
        p_amount: creditsSpentVal,
        p_scan_type: 'DEEP',
        p_token_address: address,
        p_scan_id: scanId, // Pass scanId for database-level idempotency
      }
    );

    if (rpcError) {
      const isInsufficient = rpcError.message.includes('Insufficient');
      return NextResponse.json(
        {
          error: rpcError.message,
          code: isInsufficient ? 'INSUFFICIENT_CREDITS' : 'DATABASE_ERROR',
        },
        { status: isInsufficient ? 402 : 500 }
      );
    }

    creditsDeducted = true;

    // 5. Run Deep Scan
    const result = await DeepScanService.runScan({
      tokenAddress: address,
      network: detection.chain,
      elevatorResult,
      tokenMetadata,
      maxTransactions: 1000, // Cost-optimised: 1,000 tx fits in one Helius/Birdeye call and covers typical trading windows
      sessionId: scanId,    // Use same scanId as sessionId
      userId: user.id,  // P1-1: scope cache per authenticated user to prevent cross-user collisions
    });

    const isUnusable = result.outcome === 'INSUFFICIENT_DATA' || result.outcome === 'FAILED';

    if (isUnusable) {
      // Unusable scan -> refund credits
      if (userId && creditsDeducted && !refundIssued) {
        refundIssued = true;
        console.log(`[DEEP API] Scan produced unusable result (${result.outcome}). Refunding ${creditsSpentVal} credits to ${userId}...`);
        try {
          await supabase.rpc('refund_credits_for_scan', {
            p_user_id: userId,
            p_amount: creditsSpentVal,
            p_scan_type: 'DEEP',
            p_token_address: tokenAddr,
            p_scan_id: scanId, // Pass scanId for database-level idempotency
          });
        } catch (refundErr) {
          console.error('[DEEP API] Credit refund failed:', refundErr);
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: `The scan completed but could not obtain sufficient on-chain data (outcome: ${result.outcome}). Your credits have been refunded.`,
          code: 'INSUFFICIENT_DATA',
          result,
        },
        { status: 422 }
      );
    }

    // F-9: Mark scan as completed BEFORE building the response.
    scanCompleted = true;

    // Phase 6: Save shareable snapshot (non-blocking — never fails the scan)
    let snapshotId: string | undefined;
    try {
      snapshotId = await saveSnapshot(
        'deep',
        address,
        detection.chain,
        result.tokenMetadata?.symbol ?? null,
        result.tokenMetadata?.name ?? null,
        result,
        user.id
      );
    } catch (snapErr: any) {
      console.warn('[DEEP API] Snapshot save failed (non-fatal):', snapErr.message);
    }

    if (snapshotId) {
      result.snapshotId = snapshotId;
    }

    return NextResponse.json({
      success: true,
      remainingCredits: newBalance,
      snapshotId,
      result,
    });
  } catch (error: any) {
    console.error('[DEEP API] Fatal Scan Error:', error);

    // Refund credits ONLY if deduction succeeded but the scan crashed before completion.
    // If scanCompleted=true, the result was produced and the client should retry fetching it.
    // P1-3: refundIssued prevents a double-refund if this catch block somehow executes twice.
    if (userId && creditsDeducted && !scanCompleted && !refundIssued) {
      refundIssued = true;
      console.log(`[DEEP API] Scan failed before completion. Refunding ${creditsSpentVal} credits to ${userId}...`);
      try {
        await supabase.rpc('refund_credits_for_scan', {
          p_user_id: userId,
          p_amount: creditsSpentVal,
          p_scan_type: 'DEEP',
          p_token_address: tokenAddr,
          p_scan_id: scanId, // Pass scanId for database-level idempotency
        });
      } catch (refundErr) {
        console.error('[DEEP API] Credit refund failed:', refundErr);
      }
    }

    return NextResponse.json(
      { error: 'An error occurred during Deep Scan. Please try again.' },
      { status: 500 }
    );
  }
}

function scanIdFromRequest(req: NextRequest): string | undefined {
  const searchParams = req.nextUrl.searchParams;
  return searchParams.get('sessionId') || undefined;
}

// Deep Scan is a long-running operation — increase Vercel function timeout.
// Without this, the default 10s limit causes a 504 on every request.
// Requires Vercel Pro or higher; hobby plan caps at 60s.
export const maxDuration = 300;

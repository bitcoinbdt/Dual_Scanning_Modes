import { NextRequest, NextResponse } from 'next/server';
import { scanToken, validateAddress } from '@/lib/blockchain/tokenScanner';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { getStaticData } from '@/lib/blockchain/cache';
import { RugPatternMatcher } from '@/lib/reputation/RugPatternMatcher';

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Use service role for credit operations (bypasses RLS safely)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey ?? supabaseAnonKey);

  try {
    // 1. Authenticate user from Authorization header
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required to scan tokens' },
        { status: 401 }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid session. Please log in again.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { address, chain } = body;

    // 2. Validate address
    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const validation = validateAddress(address);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 3. Deduct credits first (2 for basic scan)
    const scanCost = 2;
    const scanId = crypto.randomUUID();
    const { data: newBalance, error: rpcError } = await supabaseAdmin.rpc(
      'deduct_credits_for_scan',
      {
        p_user_id: user.id,
        p_amount: scanCost,
        p_scan_type: 'BASIC',
        p_token_address: address,
        p_scan_id: scanId,
      }
    );

    if (rpcError) {
      console.error('[Basic Scan API] Credit deduction error:', rpcError.message);
      if (rpcError.message?.toLowerCase().includes('insufficient')) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits.', code: 'INSUFFICIENT_CREDITS' },
          { status: 402 }
        );
      }
      return NextResponse.json(
        { error: `Credit deduction failed: ${rpcError.message}` },
        { status: 500 }
      );
    }

    // 4. Scan token — on failure, refund credits automatically
    try {
      const result = await scanToken(validation.address!, chain || '1');
      return NextResponse.json({
        success: true,
        data: result.data.onChainData,
        metadata: result.data.metadata,
        timestamp: result.timestamp,
        remainingCredits: newBalance,
      });
    } catch (scanError: any) {
      // Refund credits since the scan failed
      console.error('[Basic Scan API] Scan failed — refunding credits. Error:', scanError.message);
      try {
        await supabaseAdmin.rpc('refund_credits_for_scan', {
          p_user_id: user.id,
          p_amount: scanCost,
          p_scan_type: 'BASIC',
          p_token_address: address,
          p_scan_id: scanId,
        });
        console.log('[Basic Scan API] Credits refunded successfully');
      } catch (refundErr: any) {
        console.error('[Basic Scan API] Credit refund also failed:', refundErr.message);
      }

      return NextResponse.json(
        {
          error: 'Scan failed. Credits have been refunded.',
          detail: scanError.message ?? 'Unknown scan error',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Basic Scan API] Unhandled error:', error?.message, error?.stack);
    return NextResponse.json(
      {
        error: 'Scan failed. Please try again.',
        detail: error?.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Use Node.js runtime for ethers.js and @solana/web3.js
export const runtime = 'nodejs';

// Set maximum execution time to 60 seconds
export const maxDuration = 60;


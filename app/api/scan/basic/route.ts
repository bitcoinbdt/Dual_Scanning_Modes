import { NextRequest, NextResponse } from 'next/server';
import { scanToken, validateAddress } from '@/lib/blockchain/tokenScanner';
import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
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

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid session. Please log in again.' },
        { status: 401 }
      );
    }

    const { address, chain } = await request.json();
    
    // Validate address
    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const validation = validateAddress(address);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 2. Deduct credits from user profile atomically (BASIC scan cost is 2 credits)
    const scanCost = 2;
    const { data: newBalance, error: rpcError } = await supabase.rpc(
      'deduct_credits_for_scan',
      {
        p_user_id: user.id,
        p_amount: scanCost,
        p_scan_type: 'BASIC',
        p_token_address: address,
      }
    );

    if (rpcError) {
      console.error('[Basic Scan API] Credit deduction error:', rpcError);
      
      // Handle insufficient credits explicitly
      if (rpcError.message?.includes('Insufficient credit balance')) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits.', code: 'INSUFFICIENT_CREDITS' },
          { status: 402 } // 402 Payment Required
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to process credit deduction. Please ensure database functions are set up.' },
        { status: 500 }
      );
    }
    
    // 3. Scan token
    const result = await scanToken(validation.address!, chain || '1');
    
    return NextResponse.json({
      success: true,
      data: result.data.onChainData,
      metadata: result.data.metadata,
      timestamp: result.timestamp,
      remainingCredits: newBalance
    });
  } catch (error: any) {
    console.error('[Basic Scan API] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Scan failed',
        details: error.stack 
      },
      { status: 500 }
    );
  }
}

// Use Node.js runtime for ethers.js and @solana/web3.js
export const runtime = 'nodejs';

// Set maximum execution time to 60 seconds
export const maxDuration = 60;

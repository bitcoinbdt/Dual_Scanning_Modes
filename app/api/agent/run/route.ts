import { NextRequest, NextResponse } from 'next/server';
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
        { error: 'Authentication required to run the agent' },
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

    // 2. Deduct 5 credits from user profile atomically
    const agentCost = 5;
    const { data: newBalance, error: rpcError } = await supabase.rpc(
      'deduct_credits_for_scan',
      {
        p_user_id: user.id,
        p_amount: agentCost,
        p_scan_type: 'AGENT',
        p_token_address: 'ALL',
      }
    );

    if (rpcError) {
      console.error('[Agent API] Credit deduction error:', rpcError);
      
      // Handle insufficient credits explicitly
      if (rpcError.message?.includes('Insufficient credit balance')) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits.', code: 'INSUFFICIENT_CREDITS' },
          { status: 402 } // 402 Payment Required
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to process credit deduction.' },
        { status: 500 }
      );
    }

    // 3. Call the Supabase Edge Function to get agent ranks
    const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/crypto-hype-agent`;
    const res = await fetch(fnUrl, {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Edge function failed with status ${res.status}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    return NextResponse.json({
      success: true,
      newBalance,
      tokens: data.tokens || [],
    });

  } catch (error: any) {
    console.error('[Agent API] Run error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run agent' },
      { status: 500 }
    );
  }
}

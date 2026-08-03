import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';

interface BoostedToken {
  chainId: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  description?: string;
}

interface PairData {
  chainId: string;
  dexId: string;
  baseToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  priceChange?: { h24?: number };
  info?: { imageUrl?: string };
}

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

    // 3. Directly fetch from DexScreener API and enrich (bypassing Supabase Edge function)
    const boostedRes = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      headers: { Accept: "application/json" },
    });
    if (!boostedRes.ok) {
      throw new Error(`DexScreener boosts API returned ${boostedRes.status}`);
    }
    const boosted: BoostedToken[] = await boostedRes.json();
    const top20 = (boosted || []).slice(0, 20);

    const enriched = await Promise.all(
      top20.map(async (token) => {
        try {
          const pairRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${token.tokenAddress}`,
            { headers: { Accept: "application/json" } }
          );
          if (!pairRes.ok) return null;
          const pairJson = await pairRes.json();
          const pairs: PairData[] = pairJson.pairs || [];
          const best = pairs[0] || null;
          if (!best) return null;
          return {
            chainId: token.chainId,
            tokenAddress: token.tokenAddress,
            name: token.name,
            symbol: token.symbol,
            description: token.description || "",
            imageUrl: best.info?.imageUrl || "",
            price: best.priceUsd || "0",
            priceChange24h: best.priceChange?.h24 ?? 0,
            marketCap: best.marketCap ?? best.fdv ?? 0,
            liquidity: best.liquidity?.usd ?? 0,
            dexId: best.dexId,
            baseTokenAddress: best.baseToken?.address || token.tokenAddress,
          };
        } catch {
          return null;
        }
      })
    );

    const valid = enriched.filter((e): e is NonNullable<typeof e> => e !== null);

    return NextResponse.json({
      success: true,
      newBalance,
      tokens: valid,
      total: valid.length,
    });

  } catch (error: any) {
    console.error('[Agent API] Run error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run agent' },
      { status: 500 }
    );
  }
}

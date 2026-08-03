import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { BoostedToken } from '@/types/boost';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch active boosts (no authentication required - public endpoint)
    const { data: boosts, error: boostsError } = await supabase
      .from('token_boost_requests')
      .select('*')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('starts_at', { ascending: false });

    if (boostsError) {
      console.error('Error fetching active boosts:', boostsError);
      return NextResponse.json(
        { success: false, message: 'Error fetching active boosts', error: boostsError.message },
        { status: 500 }
      );
    }

    // Transform to BoostedToken format
    const tokens: BoostedToken[] = boosts.map((boost: any) => ({
      id: boost.id,
      tokenName: boost.token_name,
      tokenSymbol: boost.token_symbol,
      tokenLogoUrl: boost.token_logo_url,
      tokenContractAddress: boost.token_contract_address,
      blockchain: boost.blockchain,
      currentPriceUsd: boost.current_price_usd,
      priceChange24h: boost.price_change_24h,
      expiresAt: boost.expires_at,
    }));

    return NextResponse.json({
      success: true,
      boosts: tokens,
      count: tokens.length,
    });
  } catch (error: any) {
    console.error('Unexpected error in active boosts:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

// Enable caching for 60 seconds
export const revalidate = 60;

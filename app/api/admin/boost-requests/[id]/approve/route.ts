import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { fetchTokenPrice } from '@/services/coingeckoService';
import type { Blockchain } from '@/types/boost';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json(
        { success: false, message: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const boostId = params.id;
    const body = await request.json();

    // Get boost details
    const { data: boost, error: boostError } = await supabase
      .from('token_boost_requests')
      .select('*')
      .eq('id', boostId)
      .single();

    if (boostError || !boost) {
      return NextResponse.json(
        { success: false, message: 'Boost request not found' },
        { status: 404 }
      );
    }

    if (boost.status !== 'pending') {
      return NextResponse.json(
        { success: false, message: 'Only pending requests can be approved' },
        { status: 400 }
      );
    }

    // Try to fetch price from CoinGecko
    let priceData = null;
    try {
      priceData = await fetchTokenPrice(
        boost.token_contract_address,
        boost.blockchain as Blockchain
      );
    } catch (error) {
      console.error('Error fetching price during approval:', error);
      // Continue without price - it's optional
    }

    // Update boost to approved status
    const { error: updateError } = await supabase
      .from('token_boost_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        admin_notes: body.adminNotes || null,
        current_price_usd: priceData?.priceUsd,
        price_change_24h: priceData?.priceChange24h,
        last_price_update: priceData?.lastUpdated.toISOString(),
      })
      .eq('id', boostId);

    if (updateError) {
      console.error('Error approving boost:', updateError);
      return NextResponse.json(
        { success: false, message: 'Error approving boost', error: updateError.message },
        { status: 500 }
      );
    }

    // Activate the boost immediately (set start and expiry times)
    const { data: activateResult, error: activateError } = await supabase.rpc('activate_boost', {
      p_boost_id: boostId,
    });

    if (activateError || !activateResult.success) {
      console.error('Error activating boost:', activateError || activateResult.message);
      return NextResponse.json(
        { success: false, message: 'Error activating boost' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      boostId,
      startsAt: activateResult.startsAt,
      expiresAt: activateResult.expiresAt,
      message: 'Boost approved and activated successfully',
    });
  } catch (error: any) {
    console.error('Unexpected error in approve boost:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

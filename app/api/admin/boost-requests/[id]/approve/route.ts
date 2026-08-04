import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/adminAuth';
import { fetchTokenPrice } from '@/services/coingeckoService';
import type { Blockchain } from '@/types/boost';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Use the same admin check as all other admin routes
    const adminUser = await requireAdmin();

    const params = await context.params;
    const boostId = params.id;
    const body = await request.json();
    const supabase = getServiceClient();

    // Fetch the boost request
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

    // Try to fetch current price from CoinGecko (optional)
    let priceData = null;
    try {
      priceData = await fetchTokenPrice(
        boost.token_contract_address,
        boost.blockchain as Blockchain
      );
    } catch (err) {
      console.error('Error fetching price during approval (non-fatal):', err);
    }

    // Mark as approved
    const { error: updateError } = await supabase
      .from('token_boost_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
        admin_notes: body.adminNotes || null,
        current_price_usd: priceData?.priceUsd ?? null,
        price_change_24h: priceData?.priceChange24h ?? null,
        last_price_update: priceData ? priceData.lastUpdated?.toISOString() : null,
      })
      .eq('id', boostId);

    if (updateError) {
      console.error('Error approving boost:', updateError);
      return NextResponse.json(
        { success: false, message: 'Error approving boost', error: updateError.message },
        { status: 500 }
      );
    }

    // Activate immediately (sets starts_at and expires_at)
    const { data: activateResult, error: activateError } = await supabase.rpc('activate_boost', {
      p_boost_id: boostId,
    });

    if (activateError || !activateResult?.success) {
      console.error('Error activating boost:', activateError || activateResult?.message);
      return NextResponse.json(
        { success: false, message: 'Boost approved but activation failed. Run the FIX_BOOST_SYSTEM.sql in Supabase.' },
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
    console.error('Error in approve boost POST:', error);
    const isAuth = error.message?.includes('Unauthorized');
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: isAuth ? 401 : 500 }
    );
  }
}

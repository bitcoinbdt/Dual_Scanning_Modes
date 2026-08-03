import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import type { TokenBoostRequest, BoostAnalytics } from '@/types/boost';

export async function GET(request: NextRequest) {
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

    // Fetch user's boost requests
    const { data: boosts, error: boostsError } = await supabase
      .from('token_boost_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false });

    if (boostsError) {
      console.error('Error fetching boost requests:', boostsError);
      return NextResponse.json(
        { success: false, message: 'Error fetching requests', error: boostsError.message },
        { status: 500 }
      );
    }

    // Fetch analytics for all boost requests
    const boostIds = boosts.map((b: any) => b.id);
    let analytics: BoostAnalytics[] = [];

    if (boostIds.length > 0) {
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('token_boost_analytics')
        .select('*')
        .in('boost_request_id', boostIds);

      if (!analyticsError && analyticsData) {
        analytics = analyticsData;
      }
    }

    // Combine boosts with their analytics
    const requests = boosts.map((boost: any) => {
      const boostAnalytics = analytics.find((a) => a.boost_request_id === boost.id);

      return {
        id: boost.id,
        status: boost.status,
        durationHours: boost.duration_hours,
        creditsSpent: boost.credits_cost,
        requestedAt: boost.requested_at,
        expiresAt: boost.expires_at,
        rejectionReason: boost.rejection_reason,
        tokenInfo: {
          name: boost.token_name,
          symbol: boost.token_symbol,
          logoUrl: boost.token_logo_url,
          contractAddress: boost.token_contract_address,
          blockchain: boost.blockchain,
          website: boost.website,
          description: boost.description,
          currentPriceUsd: boost.current_price_usd,
          priceChange24h: boost.price_change_24h,
        },
        analytics: boostAnalytics
          ? {
              totalScans: boostAnalytics.total_scans,
              lastScanAt: boostAnalytics.last_scan_at,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      requests,
    });
  } catch (error: any) {
    console.error('Unexpected error in my-requests:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

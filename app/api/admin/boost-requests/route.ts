import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/adminAuth';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    // Use the same admin check as all other admin routes
    await requireAdmin();

    const supabase = getServiceClient();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let query = supabase
      .from('token_boost_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: boosts, error: boostsError } = await query;

    if (boostsError) {
      console.error('Error fetching boost requests:', boostsError);
      return NextResponse.json(
        { success: false, message: 'Error fetching requests', error: boostsError.message },
        { status: 500 }
      );
    }

    // Fetch corresponding user profiles to avoid foreign key PostgREST join errors
    const userIds = Array.from(new Set((boosts || []).map((b: any) => b.user_id)));
    const userProfilesMap = new Map<string, { email: string; display_name: string }>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, email, display_name')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching user profiles for boosts:', profilesError);
      } else if (profiles) {
        profiles.forEach((p: any) => {
          userProfilesMap.set(p.id, {
            email: p.email || 'Unknown',
            display_name: p.display_name || 'Unknown'
          });
        });
      }
    }

    const requests = (boosts || []).map((boost: any) => {
      const user = userProfilesMap.get(boost.user_id);
      return {
        id: boost.id,
        userId: boost.user_id,
        userEmail: user?.email || 'Unknown',
        userName: user?.display_name || 'Unknown',
        status: boost.status,
        tokenInfo: {
          name: boost.token_name,
          symbol: boost.token_symbol,
          logoUrl: boost.token_logo_url,
          contractAddress: boost.token_contract_address,
          blockchain: boost.blockchain,
          website: boost.website,
          description: boost.description,
          coingeckoId: boost.coingecko_id,
        },
        durationHours: boost.duration_hours,
        creditsSpent: boost.credits_cost,
        requestedAt: boost.requested_at,
        reviewedAt: boost.reviewed_at,
        reviewedBy: boost.reviewed_by,
        startsAt: boost.starts_at,
        expiresAt: boost.expires_at,
        rejectionReason: boost.rejection_reason,
        adminNotes: boost.admin_notes,
      };
    });

    return NextResponse.json({ success: true, requests, count: requests.length });
  } catch (error: any) {
    console.error('Error in admin boost-requests GET:', error);
    const isAuth = error.message?.includes('Unauthorized');
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: isAuth ? 401 : 500 }
    );
  }
}

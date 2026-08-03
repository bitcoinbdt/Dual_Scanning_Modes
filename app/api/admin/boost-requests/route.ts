import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use anon client only for JWT verification
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    // Use service role client for all DB operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey ?? supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseAnon.auth.getUser(token);

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

    // Get status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // Build query
    let query = supabase
      .from('token_boost_requests')
      .select(`
        *,
        user:user_profiles!token_boost_requests_user_id_fkey(email, display_name)
      `)
      .order('requested_at', { ascending: false });

    // Apply status filter if provided
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

    // Transform data for admin view
    const requests = boosts.map((boost: any) => ({
      id: boost.id,
      userId: boost.user_id,
      userEmail: boost.user?.email || 'Unknown',
      userName: boost.user?.display_name || 'Unknown',
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
    }));

    return NextResponse.json({
      success: true,
      requests,
      count: requests.length,
    });
  } catch (error: any) {
    console.error('Unexpected error in admin boost-requests:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

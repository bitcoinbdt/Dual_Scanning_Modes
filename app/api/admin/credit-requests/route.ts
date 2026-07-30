import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/adminAuth';

/**
 * GET /api/admin/credit-requests
 * Get credit purchase requests (admin only)
 * Query params: ?status=pending|approved|rejected|all
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // Build query
    let query = supabase
      .from('credit_purchase_requests')
      .select(`
        *,
        user_email:user_id(email),
        payment_method:payment_methods(name, network)
      `)
      .order('created_at', { ascending: false });

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Error fetching credit requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch credit requests' },
        { status: 500 }
      );
    }

    // Transform data to flatten nested objects
    const transformedRequests = requests?.map((request: any) => ({
      ...request,
      user_email: request.user_email?.email || null,
      payment_method_name: request.payment_method?.name || null,
      payment_network: request.payment_method?.network || null,
      payment_method: undefined, // Remove nested object
    }));

    return NextResponse.json({ requests: transformedRequests || [] });
  } catch (error: any) {
    console.error('Admin credit requests GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: 401 }
    );
  }
}

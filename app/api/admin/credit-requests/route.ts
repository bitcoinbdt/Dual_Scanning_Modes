import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/adminAuth';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/admin/credit-requests
 * Get credit purchase requests (admin only)
 * Query params: ?status=pending|approved|rejected|all
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabaseAdmin = getAdminClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    let query = supabaseAdmin
      .from('credit_purchase_requests')
      .select(`
        *,
        payment_method:payment_methods(name, network)
      `)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('[Admin] Error fetching credit requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch credit requests: ' + error.message },
        { status: 500 }
      );
    }

    // Enrich with user emails via auth.users (service role only)
    const enriched = await Promise.all(
      (requests || []).map(async (req: any) => {
        let user_email = null;
        try {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(req.user_id);
          user_email = userData?.user?.email ?? null;
        } catch {}

        return {
          ...req,
          user_email,
          payment_method_name: req.payment_method?.name ?? null,
          payment_network: req.payment_method?.network ?? null,
          payment_method: undefined,
        };
      })
    );

    return NextResponse.json({ requests: enriched });
  } catch (error: any) {
    console.error('[Admin] Credit requests GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

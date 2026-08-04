import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/adminAuth';

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

    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Rejection reason is required' },
        { status: 400 }
      );
    }

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
        { success: false, message: 'Only pending requests can be rejected' },
        { status: 400 }
      );
    }

    // Mark as rejected
    const { error: updateError } = await supabase
      .from('token_boost_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
        rejection_reason: body.reason.trim(),
        admin_notes: body.adminNotes || null,
      })
      .eq('id', boostId);

    if (updateError) {
      console.error('Error rejecting boost:', updateError);
      return NextResponse.json(
        { success: false, message: 'Error rejecting boost', error: updateError.message },
        { status: 500 }
      );
    }

    // Refund credits via DB function
    const { data: refundResult, error: refundError } = await supabase.rpc('refund_boost_credits', {
      p_boost_id: boostId,
    });

    if (refundError || !refundResult?.success) {
      console.error('Error refunding credits:', refundError || refundResult?.message);
      // Boost is already rejected — return partial success with warning
      return NextResponse.json({
        success: true,
        boostId,
        creditsRefunded: 0,
        warning: 'Boost rejected but credit refund failed. Run FIX_BOOST_SYSTEM.sql in Supabase.',
        message: 'Boost rejected (credit refund may need manual processing)',
      });
    }

    return NextResponse.json({
      success: true,
      boostId,
      creditsRefunded: refundResult.refundedCredits,
      message: 'Boost rejected and credits refunded successfully',
    });
  } catch (error: any) {
    console.error('Error in reject boost POST:', error);
    const isAuth = error.message?.includes('Unauthorized');
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: isAuth ? 401 : 500 }
    );
  }
}

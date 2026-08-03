import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
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

    // Validate rejection reason
    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Rejection reason is required' },
        { status: 400 }
      );
    }

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
        { success: false, message: 'Only pending requests can be rejected' },
        { status: 400 }
      );
    }

    // Update boost to rejected status
    const { error: updateError } = await supabase
      .from('token_boost_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
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

    // Refund credits using database function
    const { data: refundResult, error: refundError } = await supabase.rpc('refund_boost_credits', {
      p_boost_id: boostId,
    });

    if (refundError || !refundResult.success) {
      console.error('Error refunding credits:', refundError || refundResult.message);
      return NextResponse.json(
        { success: false, message: 'Boost rejected but error refunding credits' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      boostId,
      creditsRefunded: refundResult.refundedCredits,
      message: 'Boost rejected and credits refunded successfully',
    });
  } catch (error: any) {
    console.error('Unexpected error in reject boost:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

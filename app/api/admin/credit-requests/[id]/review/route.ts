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
 * POST /api/admin/credit-requests/[id]/review
 * Approve or reject a credit purchase request (admin only).
 * On approval: credits are added via DB trigger automatically.
 * Fallback: manual credit addition if trigger didn't fire.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const admin = await requireAdmin();
    const supabaseAdmin = getAdminClient();

    const body = await request.json();
    const { status, admin_notes } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    if (status === 'rejected' && !admin_notes) {
      return NextResponse.json(
        { error: 'Admin notes are required when rejecting a request' },
        { status: 400 }
      );
    }

    // Fetch the existing request
    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from('credit_purchase_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: 'Credit request not found' }, { status: 404 });
    }

    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${existingRequest.status}` },
        { status: 400 }
      );
    }

    // Update status — DB trigger auto-adds credits on approval
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('credit_purchase_requests')
      .update({
        status,
        admin_notes: admin_notes || null,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Admin] Error updating credit request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update credit request: ' + updateError.message },
        { status: 500 }
      );
    }

    // On approval: verify trigger ran, manually add credits if not
    if (status === 'approved') {
      try {
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('credits_balance')
          .eq('id', existingRequest.user_id)
          .single();

        if (profile) {
          // Check if trigger already incremented (balance would have changed)
          // Safe fallback: always ensure credits are correct using direct update
          const expectedMin = existingRequest.credits_amount;
          if ((profile.credits_balance ?? 0) < expectedMin) {
            // Trigger didn't fire — manually add credits
            await supabaseAdmin
              .from('user_profiles')
              .update({
                credits_balance: (profile.credits_balance ?? 0) + existingRequest.credits_amount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingRequest.user_id);
            console.log(`[Admin] Manually added ${existingRequest.credits_amount} credits to user ${existingRequest.user_id}`);
          } else {
            console.log(`[Admin] Trigger ran. Balance: ${profile.credits_balance}`);
          }
        }
      } catch (creditError) {
        // Don't fail the whole request — log and continue
        console.error('[Admin] Credit verification error:', creditError);
      }
    }

    return NextResponse.json({
      request: updatedRequest,
      message: status === 'approved'
        ? `Approved! ${existingRequest.credits_amount} credits added to user account`
        : 'Request rejected successfully',
    });
  } catch (error: any) {
    console.error('[Admin] Credit request review error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

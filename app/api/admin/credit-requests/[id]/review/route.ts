import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/adminAuth';

/**
 * POST /api/admin/credit-requests/[id]/review
 * Approve or reject a credit purchase request (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Check admin authentication
    const admin = await requireAdmin();

    const body = await request.json();
    const { status, admin_notes } = body;

    // Validate status
    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    // For rejection, admin notes are required
    if (status === 'rejected' && !admin_notes) {
      return NextResponse.json(
        { error: 'Admin notes are required when rejecting a request' },
        { status: 400 }
      );
    }

    // Check if request exists and is pending
    const { data: existingRequest, error: fetchError } = await supabase
      .from('credit_purchase_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json(
        { error: 'Credit request not found' },
        { status: 404 }
      );
    }

    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${existingRequest.status}` },
        { status: 400 }
      );
    }

    // Update the request status
    // Note: The database trigger will automatically add credits on approval
    const { data: updatedRequest, error: updateError } = await supabase
      .from('credit_purchase_requests')
      .update({
        status,
        admin_notes: admin_notes || null,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating credit request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update credit request' },
        { status: 500 }
      );
    }

    // If approved, verify credits were added
    if (status === 'approved') {
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('credits_balance')
        .eq('user_id', existingRequest.user_id)
        .single();

      if (profileError) {
        console.error('Error verifying credit addition:', profileError);
        // Don't fail the request, just log the error
      } else {
        console.log(`Credits added successfully. New balance: ${userProfile.credits_balance}`);
      }
    }

    return NextResponse.json({
      request: updatedRequest,
      message: status === 'approved'
        ? `Approved! ${existingRequest.credits_amount} credits added to user account`
        : 'Request rejected successfully',
    });
  } catch (error: any) {
    console.error('Admin credit request review error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: 401 }
    );
  }
}

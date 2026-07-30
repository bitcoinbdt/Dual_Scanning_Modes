import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/adminAuth';

/**
 * PUT /api/admin/payment-methods/[id]
 * Update a payment method (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authentication
    await requireAdmin();

    const body = await request.json();
    const { name, network, address, qr_code_url, instructions, display_order, is_active } = body;

    // Build update object with only provided fields
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (network !== undefined) updates.network = network || null;
    if (address !== undefined) updates.address = address;
    if (qr_code_url !== undefined) updates.qr_code_url = qr_code_url || null;
    if (instructions !== undefined) updates.instructions = instructions || null;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;

    // Update payment method
    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment method:', error);
      return NextResponse.json(
        { error: 'Failed to update payment method' },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentMethod });
  } catch (error: any) {
    console.error('Admin payment method PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/admin/payment-methods/[id]
 * Delete a payment method (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authentication
    await requireAdmin();

    // Check if payment method is used in any requests
    const { data: requests, error: checkError } = await supabase
      .from('credit_purchase_requests')
      .select('id')
      .eq('payment_method_id', params.id)
      .limit(1);

    if (checkError) {
      console.error('Error checking payment method usage:', checkError);
      return NextResponse.json(
        { error: 'Failed to check payment method usage' },
        { status: 500 }
      );
    }

    if (requests && requests.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete payment method that has been used in credit requests. Disable it instead.' },
        { status: 400 }
      );
    }

    // Delete payment method
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting payment method:', error);
      return NextResponse.json(
        { error: 'Failed to delete payment method' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin payment method DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: 401 }
    );
  }
}

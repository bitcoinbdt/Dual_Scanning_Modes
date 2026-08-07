import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/adminAuth';

/**
 * PUT /api/admin/payment-methods/[id]
 * Update a payment method (admin only).
 * Uses service role client to bypass RLS.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Verify admin JWT first
    await requireAdmin();

    // Use service role to bypass RLS for write operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { name, network, address, instructions, display_order, is_active, icon, type } = body;

    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (network !== undefined) updates.network = network || null;
    if (address !== undefined) updates.address = address;
    if (instructions !== undefined) updates.instructions = instructions || null;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;
    if (icon !== undefined) updates.icon = icon;

    const { data: paymentMethod, error } = await supabaseAdmin
      .from('payment_methods')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Admin] Error updating payment method:', error);
      return NextResponse.json(
        { error: 'Failed to update payment method: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentMethod });
  } catch (error: any) {
    console.error('[Admin] Payment method PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * DELETE /api/admin/payment-methods/[id]
 * Delete a payment method (admin only).
 * Uses service role client to bypass RLS.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Verify admin JWT first
    await requireAdmin();

    // Use service role to bypass RLS for write operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if payment method is used in any requests
    const { data: requests, error: checkError } = await supabaseAdmin
      .from('credit_purchase_requests')
      .select('id')
      .eq('payment_method_id', id)
      .limit(1);

    if (checkError && !checkError.message.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Failed to check payment method usage' },
        { status: 500 }
      );
    }

    if (requests && requests.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a payment method used in credit requests. Disable it instead.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Admin] Error deleting payment method:', error);
      return NextResponse.json(
        { error: 'Failed to delete payment method: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin] Payment method DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

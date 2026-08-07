import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/adminAuth';

// Helper: service role client (bypasses RLS for all admin writes)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/admin/payment-methods
 * Get all payment methods (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabaseAdmin = getAdminClient();

    const { data: paymentMethods, error } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[Admin] Error fetching payment methods:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payment methods: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentMethods: paymentMethods || [] });
  } catch (error: any) {
    console.error('[Admin] Payment methods GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * POST /api/admin/payment-methods
 * Create a new payment method (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const supabaseAdmin = getAdminClient();

    const body = await request.json();
    const { name, type, network, address, instructions, display_order, is_active, icon } = body;

    if (!name || !address) {
      return NextResponse.json(
        { error: 'Name and address are required' },
        { status: 400 }
      );
    }

    const { data: paymentMethod, error } = await supabaseAdmin
      .from('payment_methods')
      .insert({
        name,
        type: type || 'crypto',
        network: network || null,
        address,
        instructions: instructions || null,
        display_order: display_order ?? 0,
        is_active: is_active ?? true,
        icon: icon || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Admin] Error creating payment method:', error);
      return NextResponse.json(
        { error: 'Failed to create payment method: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentMethod }, { status: 201 });
  } catch (error: any) {
    console.error('[Admin] Payment methods POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

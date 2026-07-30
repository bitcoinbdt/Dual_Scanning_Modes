import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/adminAuth';

/**
 * GET /api/admin/payment-methods
 * Get all payment methods (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    await requireAdmin();

    // Fetch all payment methods
    const { data: paymentMethods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching payment methods:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payment methods' },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentMethods });
  } catch (error: any) {
    console.error('Admin payment methods GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: 401 }
    );
  }
}

/**
 * POST /api/admin/payment-methods
 * Create a new payment method (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    await requireAdmin();

    const body = await request.json();
    const { name, network, address, qr_code_url, instructions, display_order, is_active } = body;

    // Validate required fields
    if (!name || !address) {
      return NextResponse.json(
        { error: 'Name and address are required' },
        { status: 400 }
      );
    }

    // Insert payment method
    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .insert({
        name,
        network: network || null,
        address,
        qr_code_url: qr_code_url || null,
        instructions: instructions || null,
        display_order: display_order ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment method:', error);
      return NextResponse.json(
        { error: 'Failed to create payment method' },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentMethod }, { status: 201 });
  } catch (error: any) {
    console.error('Admin payment methods POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: 401 }
    );
  }
}

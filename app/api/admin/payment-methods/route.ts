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
    let { data: paymentMethods, error } = await supabase
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

    // Default 5 payment methods
    const DEFAULT_METHODS = [
      { name: 'Binance Pay', network: 'Binance', address: 'Configure Binance Pay ID', instructions: 'Send payment via Binance Pay to this ID', display_order: 1, is_active: false },
      { name: 'KuCoin', network: 'KuCoin', address: 'Configure KuCoin ID/Email', instructions: 'Send payment via KuCoin Pay to this ID/email', display_order: 2, is_active: false },
      { name: 'USDT (BEP-20)', network: 'BEP-20', address: 'Configure BSC Wallet Address', instructions: 'Send USDT on BNB Smart Chain (BEP-20)', display_order: 3, is_active: false },
      { name: 'USDC (SOL)', network: 'Solana', address: 'Configure Solana Wallet Address', instructions: 'Send USDC on Solana network (SOL)', display_order: 4, is_active: false },
      { name: 'TRX (TRC-20)', network: 'TRC-20', address: 'Configure Tron Wallet Address', instructions: 'Send TRX on TRON network (TRC-20)', display_order: 5, is_active: false }
    ];

    let needsReload = false;
    for (const def of DEFAULT_METHODS) {
      const exists = paymentMethods?.some(m => m.name === def.name && m.network === def.network);
      if (!exists) {
        const { error: insertError } = await supabase
          .from('payment_methods')
          .insert(def);
        if (!insertError) {
          needsReload = true;
        } else {
          console.error(`Failed to seed payment method ${def.name}:`, insertError);
        }
      }
    }

    if (needsReload) {
      const { data: reloaded, error: reloadError } = await supabase
        .from('payment_methods')
        .select('*')
        .order('display_order', { ascending: true });
      if (!reloadError && reloaded) {
        paymentMethods = reloaded;
      }
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

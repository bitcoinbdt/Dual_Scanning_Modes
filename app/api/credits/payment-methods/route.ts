import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/credits/payment-methods
 * Get active payment methods for users.
 * Returns empty array gracefully if the table doesn't exist yet.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: paymentMethods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    // If table doesn't exist yet, return fallback data instead of crashing
    if (error) {
      console.warn('[Payment Methods] DB error (table may not exist yet):', error.message);
      return NextResponse.json({ paymentMethods: getFallbackPaymentMethods() });
    }

    return NextResponse.json({ paymentMethods: paymentMethods || [] });
  } catch (error: any) {
    console.error('[Payment Methods] Unhandled error:', error?.message);
    // Always return usable data — never crash the pricing page
    return NextResponse.json({ paymentMethods: getFallbackPaymentMethods() });
  }
}

/**
 * Fallback payment methods shown when DB table doesn't exist yet.
 * Admin can override these by adding rows to the payment_methods table.
 */
function getFallbackPaymentMethods() {
  return [
    {
      id: 'usdc-wallet',
      name: 'USDC',
      type: 'crypto',
      address: process.env.PAYMENT_WALLET_USDC || 'Configure USDC wallet in admin panel',
      instructions: 'Send USDC to the address above, then submit your transaction hash.',
      is_active: true,
      display_order: 1,
      icon: 'USDC',
    },
    {
      id: 'usdt-trc20',
      name: 'USDT (TRC-20)',
      type: 'crypto',
      address: process.env.PAYMENT_WALLET_USDT || 'Configure USDT wallet in admin panel',
      instructions: 'Send USDT via TRC-20 network, then submit your transaction hash.',
      is_active: true,
      display_order: 2,
      icon: 'USDT',
    },
  ];
}

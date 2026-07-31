import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/credits/submit-request
 * Submit a credit purchase request
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user via authorization header token
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      credit_package_id,
      credits_amount,
      price_usd,
      payment_method_id,
      transaction_hash,
    } = body;

    // Validate required fields
    if (!credit_package_id || !credits_amount || !price_usd || !payment_method_id || !transaction_hash) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate transaction hash is not empty
    if (!transaction_hash.trim()) {
      return NextResponse.json(
        { error: 'Transaction hash cannot be empty' },
        { status: 400 }
      );
    }

    // Check if transaction hash already exists
    const { data: existingRequest, error: checkError } = await supabase
      .from('credit_purchase_requests')
      .select('id')
      .eq('transaction_hash', transaction_hash.trim())
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: 'This transaction hash has already been submitted' },
        { status: 400 }
      );
    }

    // Verify payment method exists and is active
    const { data: paymentMethod, error: methodError } = await supabase
      .from('payment_methods')
      .select('id, is_active')
      .eq('id', payment_method_id)
      .single();

    if (methodError || !paymentMethod) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    if (!paymentMethod.is_active) {
      return NextResponse.json(
        { error: 'This payment method is no longer active' },
        { status: 400 }
      );
    }

    // Insert credit purchase request
    const { data: creditRequest, error: insertError } = await supabase
      .from('credit_purchase_requests')
      .insert({
        user_id: user.id,
        credit_package_id,
        credits_amount,
        price_usd,
        payment_method_id,
        transaction_hash: transaction_hash.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating credit request:', insertError);
      
      // Check if it's a duplicate key error
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This transaction hash has already been submitted' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to submit credit request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      request: creditRequest,
      message: 'Credit request submitted successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Submit credit request error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

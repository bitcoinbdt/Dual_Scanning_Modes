import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/credits/submit-request
 * Submit a credit purchase request.
 *
 * Auth: reads Bearer token from Authorization header.
 * The global fetch interceptor in AuthContext.tsx automatically attaches
 * the Supabase JWT to every /api/ request, so no manual token handling
 * is needed on the client side.
 *
 * Column fixes:
 *  - Uses "package_id" (actual DB column, not "credit_package_id")
 *  - Does NOT insert "price_usd" (column does not exist in DB)
 */
export async function POST(request: NextRequest) {
  try {
    // Read Bearer token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use anon key client — getUser(token) validates the JWT server-side
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('[submit-request] Auth error:', userError?.message);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      credit_package_id,  // sent from UI, stored as package_id in DB
      credits_amount,
      payment_method_id,
      transaction_hash,
    } = body;

    // Validate required fields
    if (!credits_amount || !payment_method_id || !transaction_hash) {
      return NextResponse.json(
        { error: 'credits_amount, payment_method_id and transaction_hash are required' },
        { status: 400 }
      );
    }

    if (!transaction_hash.trim()) {
      return NextResponse.json(
        { error: 'Transaction hash cannot be empty' },
        { status: 400 }
      );
    }

    // Check for duplicate transaction hash (use maybeSingle to avoid error when no row found)
    const { data: existingRequest } = await supabase
      .from('credit_purchase_requests')
      .select('id')
      .eq('transaction_hash', transaction_hash.trim())
      .maybeSingle();

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

    // Insert — column names match actual DB schema exactly
    const { data: creditRequest, error: insertError } = await supabase
      .from('credit_purchase_requests')
      .insert({
        user_id: user.id,
        package_id: credit_package_id ?? null,   // correct DB column: package_id
        credits_amount,
        payment_method_id,
        transaction_hash: transaction_hash.trim(),
        status: 'pending',
        // NOTE: price_usd does NOT exist in the DB schema — do not insert it
      })
      .select()
      .single();

    if (insertError) {
      console.error('[submit-request] Insert error:', insertError);

      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This transaction hash has already been submitted' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to submit credit request: ' + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      request: creditRequest,
      message: 'Credit request submitted successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('[submit-request] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

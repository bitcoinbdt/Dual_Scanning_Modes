import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/credits/submit-request
 * Submit a credit purchase request.
 *
 * Fixes applied:
 *  - Use @supabase/ssr createServerClient so session cookies are read server-side
 *    (no need for the client to manually send an Authorization header)
 *  - Insert uses "package_id" matching actual DB column name
 *  - Removed "price_usd" which does not exist in the DB schema
 */
export async function POST(request: NextRequest) {
  try {
    // Build a Supabase client that reads auth from cookies (set by Supabase Auth)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookies cannot be set from a Server Component — safe to ignore here
            }
          },
        },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      credit_package_id, // accepted from UI but stored as package_id
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

    // Check for duplicate transaction hash
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

    // Insert — columns match the actual DB schema exactly
    const { data: creditRequest, error: insertError } = await supabase
      .from('credit_purchase_requests')
      .insert({
        user_id: user.id,
        package_id: credit_package_id ?? null,  // correct column name
        credits_amount,
        payment_method_id,
        transaction_hash: transaction_hash.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating credit request:', insertError);

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
    console.error('Submit credit request error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

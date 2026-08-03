import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { BoostSubmitRequest, BoostSubmitResponse } from '@/types/boost';
import { BOOST_PRICING } from '@/types/boost';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<BoostSubmitResponse>(
        { success: false, message: 'Unauthorized', error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: BoostSubmitRequest = await request.json();

    // Validate required fields
    if (
      !body.tokenName ||
      !body.tokenSymbol ||
      !body.tokenLogoUrl ||
      !body.tokenContractAddress ||
      !body.blockchain ||
      !body.durationHours
    ) {
      return NextResponse.json<BoostSubmitResponse>(
        { success: false, message: 'Missing required fields', error: 'Validation failed' },
        { status: 400 }
      );
    }

    // Validate duration
    if (![6, 12, 24, 36].includes(body.durationHours)) {
      return NextResponse.json<BoostSubmitResponse>(
        { success: false, message: 'Invalid duration', error: 'Duration must be 6, 12, 24, or 36 hours' },
        { status: 400 }
      );
    }

    // Validate blockchain
    if (!['solana', 'ethereum', 'bsc'].includes(body.blockchain)) {
      return NextResponse.json<BoostSubmitResponse>(
        { success: false, message: 'Invalid blockchain', error: 'Blockchain must be solana, ethereum, or bsc' },
        { status: 400 }
      );
    }

    // Validate token name and symbol length
    if (body.tokenName.length < 1 || body.tokenName.length > 50) {
      return NextResponse.json<BoostSubmitResponse>(
        { success: false, message: 'Invalid token name', error: 'Token name must be 1-50 characters' },
        { status: 400 }
      );
    }

    if (body.tokenSymbol.length < 1 || body.tokenSymbol.length > 10) {
      return NextResponse.json<BoostSubmitResponse>(
        { success: false, message: 'Invalid token symbol', error: 'Token symbol must be 1-10 characters' },
        { status: 400 }
      );
    }

    // Calculate credit cost
    const creditsCost = BOOST_PRICING[body.durationHours];

    // Check if user has enough credits
    const { data: transactions, error: txError } = await supabase
      .from('credit_transactions')
      .select('amount, type')
      .eq('user_id', user.id);

    if (txError) {
      console.error('Error fetching credit balance:', txError);
      return NextResponse.json<BoostSubmitResponse>(
        { success: false, message: 'Error checking credit balance', error: txError.message },
        { status: 500 }
      );
    }

    const balance = transactions.reduce((sum, tx) => {
      if (['purchase', 'bonus', 'refund'].includes(tx.type)) {
        return sum + tx.amount;
      } else if (['scan_deduction', 'boost_purchase'].includes(tx.type)) {
        return sum + tx.amount; // amount is already negative
      }
      return sum;
    }, 0);

    if (balance < creditsCost) {
      return NextResponse.json<BoostSubmitResponse>(
        {
          success: false,
          message: 'Insufficient credits',
          error: `You need ${creditsCost} credits but have ${balance}`,
        },
        { status: 402 }
      );
    }

    // Create boost request
    const { data: boost, error: boostError } = await supabase
      .from('token_boost_requests')
      .insert({
        user_id: user.id,
        token_name: body.tokenName.trim(),
        token_symbol: body.tokenSymbol.trim().toUpperCase(),
        token_logo_url: body.tokenLogoUrl.trim(),
        token_contract_address: body.tokenContractAddress.trim(),
        blockchain: body.blockchain,
        duration_hours: body.durationHours,
        credits_cost: creditsCost,
        website: body.website?.trim() || null,
        description: body.description?.trim() || null,
        coingecko_id: body.coingeckoId?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (boostError) {
      console.error('Error creating boost request:', boostError);
      return NextResponse.json<BoostSubmitResponse>(
        { success: false, message: 'Error creating boost request', error: boostError.message },
        { status: 500 }
      );
    }

    // Deduct credits using database function
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_boost_credits', {
      p_user_id: user.id,
      p_boost_id: boost.id,
      p_credits: creditsCost,
    });

    if (deductError || !deductResult.success) {
      console.error('Error deducting credits:', deductError || deductResult.message);
      
      // Rollback boost request
      await supabase.from('token_boost_requests').delete().eq('id', boost.id);

      return NextResponse.json<BoostSubmitResponse>(
        {
          success: false,
          message: 'Error deducting credits',
          error: deductError?.message || deductResult.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json<BoostSubmitResponse>({
      success: true,
      boostId: boost.id,
      creditsDeducted: creditsCost,
      newBalance: deductResult.newBalance,
      message: 'Boost request submitted successfully. Awaiting admin approval.',
    });
  } catch (error: any) {
    console.error('Unexpected error in boost submit:', error);
    return NextResponse.json<BoostSubmitResponse>(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

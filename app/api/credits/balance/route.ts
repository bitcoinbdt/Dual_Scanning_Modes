import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

/**
 * GET /api/credits/balance
 * Returns the authenticated user's current credit balance from Supabase.
 * Auto-creates the profile with 20 credits if the trigger failed on signup.
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Credits Balance] Missing Supabase env vars');
    return NextResponse.json({ balance: 0, totalPurchased: 0, totalSpent: 0 });
  }

  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use anon client to verify the JWT
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Use service role if available (bypasses RLS), otherwise fall back to anon
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey ?? supabaseAnonKey
    );

    // Try to read the existing profile
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('credits_balance, total_scans')
      .eq('id', user.id)
      .single();

    // Helper to calculate ledger totals
    const getLedgerTotals = async (userId: string) => {
      const { data: txs } = await supabaseAdmin
        .from('credit_transactions')
        .select('type, amount')
        .eq('user_id', userId);

      let totalPurchased = 0;
      let totalSpent = 0;

      if (txs) {
        for (const tx of txs) {
          if (tx.type === 'purchase' || tx.type === 'bonus') {
            totalPurchased += (tx.amount ?? 0);
          } else if (tx.type === 'scan_deduction' || tx.type === 'boost_purchase') {
            totalSpent += Math.abs(tx.amount ?? 0);
          }
        }
      }
      return { totalPurchased, totalSpent };
    };

    // Profile exists — return it
    if (profile) {
      const { totalPurchased, totalSpent } = await getLedgerTotals(user.id);
      return NextResponse.json({
        balance: profile.credits_balance ?? 0,
        totalPurchased,
        totalSpent,
      });
    }

    // Profile missing — auto-create with 20 starter credits
    const displayName =
      (user.user_metadata?.name as string) ||
      (user.email?.split('@')[0] ?? 'User');

    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          email: user.email,
          display_name: displayName,
          credits_balance: 20,
        },
        { onConflict: 'id' }
      )
      .select('credits_balance, total_scans')
      .single();

    if (insertError || !newProfile) {
      console.error('[Credits Balance] Auto-create failed:', insertError?.message);
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
    }

    // Since it's a new profile, ledger totals are 0
    return NextResponse.json({
      balance: newProfile.credits_balance ?? 0,
      totalPurchased: 0,
      totalSpent: 0,
    });

  } catch (error: any) {
    console.error('[Credits Balance] Unhandled error:', error?.message);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve balance' },
      { status: 500 }
    );
  }
}

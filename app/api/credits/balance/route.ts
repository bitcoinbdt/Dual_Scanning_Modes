import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

/**
 * GET /api/credits/balance
 * Returns the authenticated user's current credit balance from Supabase.
 * If the user_profiles row is missing (e.g. trigger failed on signup),
 * it auto-creates it with 20 starter credits so the user is never locked out.
 */
export async function GET(request: NextRequest) {
  // Lazy init — only runs at request time so env vars are always available
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify the JWT and get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Try to read the profile
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('credits_balance, total_scans')
      .eq('id', user.id)
      .single();

    // Auto-create profile if it doesn't exist (trigger may have failed on signup)
    if (!profile || profileError) {
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
        console.error('[Credits Balance] Failed to auto-create profile:', insertError);
        // Return 0 rather than 404 so the UI still loads
        return NextResponse.json({ balance: 0, totalPurchased: 0, totalSpent: 0 });
      }

      profile = newProfile;
    }

    return NextResponse.json({
      balance: profile.credits_balance ?? 0,
      totalPurchased: profile.credits_balance ?? 0,
      totalSpent: profile.total_scans ?? 0,
    });
  } catch (error: any) {
    console.error('[Credits Balance] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

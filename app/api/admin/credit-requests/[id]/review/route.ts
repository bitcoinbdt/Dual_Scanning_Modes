import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/adminAuth';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/admin/credit-requests/[id]/review
 * Approve or reject a credit purchase request (admin only).
 * On approval: credits are added via DB trigger automatically.
 * Fallback: manual credit addition if trigger didn't fire.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const admin = await requireAdmin();
    const supabaseAdmin = getAdminClient();

    const body = await request.json();
    const { status, admin_notes } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    if (status === 'rejected' && !admin_notes) {
      return NextResponse.json(
        { error: 'Admin notes are required when rejecting a request' },
        { status: 400 }
      );
    }

    // Fetch the existing request
    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from('credit_purchase_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: 'Credit request not found' }, { status: 404 });
    }

    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${existingRequest.status}` },
        { status: 400 }
      );
    }

    // Update status — DB trigger auto-adds credits on approval
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('credit_purchase_requests')
      .update({
        status,
        admin_notes: admin_notes || null,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Admin] Error updating credit request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update credit request: ' + updateError.message },
        { status: 500 }
      );
    }

    // On approval: verify trigger ran, manually add credits if not
    if (status === 'approved') {
      try {
        // Query to see if the trigger already wrote the ledger transaction
        const { data: ledgerTx } = await supabaseAdmin
          .from('credit_transactions')
          .select('id')
          .eq('user_id', existingRequest.user_id)
          .eq('type', 'purchase')
          .filter('metadata->>request_id', 'eq', existingRequest.id)
          .maybeSingle();

        if (!ledgerTx) {
          console.warn(`[Admin] Trigger did not write transaction for request ${existingRequest.id}. Executing manual fallback...`);
          
          // Get current profile
          const { data: profile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('credits_balance')
            .eq('id', existingRequest.user_id)
            .single();

          if (profileError || !profile) {
            throw new Error(profileError?.message || 'User profile not found during credit fallback');
          }

          const currentBal = profile.credits_balance ?? 0;
          const newBal = currentBal + existingRequest.credits_amount;

          // Manually update balance
          const { error: balanceUpdateError } = await supabaseAdmin
            .from('user_profiles')
            .update({
              credits_balance: newBal,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingRequest.user_id);

          if (balanceUpdateError) {
            throw new Error('Failed to update balance during fallback: ' + balanceUpdateError.message);
          }

          // Manually insert transaction ledger record
          const { error: ledgerInsertError } = await supabaseAdmin
            .from('credit_transactions')
            .insert({
              user_id: existingRequest.user_id,
              type: 'purchase',
              amount: existingRequest.credits_amount,
              balance_after: newBal,
              description: 'Credit purchase approved (manual fallback) — ' + existingRequest.package_id,
              metadata: {
                request_id: existingRequest.id,
                package_id: existingRequest.package_id,
                price_usd: existingRequest.price_usd,
                tx_hash: existingRequest.transaction_hash,
                fallback: true,
              },
            });

          if (ledgerInsertError) {
            throw new Error('Failed to record ledger transaction during fallback: ' + ledgerInsertError.message);
          }

          console.log(`[Admin] Successfully completed manual credit fallback for user ${existingRequest.user_id}`);
        } else {
          console.log(`[Admin] Trigger executed successfully. Ledger ID: ${ledgerTx.id}`);
        }
      } catch (creditError: any) {
        console.error('[Admin] Credit verification or fallback error:', creditError);
        return NextResponse.json(
          { error: 'Credit request status updated, but credit allocation failed: ' + (creditError.message || creditError) },
          { status: 500 }
        );
      }

      // Award referral bonus to the REFERRER (not the buyer).
      // The bonus credits are added ONLY to the referrer's account by the DB function.
      // The buyer always receives their full purchased credits unchanged.
      try {
        const { data: referralResult, error: referralError } = await supabaseAdmin.rpc(
          'award_referral_bonus',
          {
            p_buyer_user_id: existingRequest.user_id,
            p_package_id: existingRequest.package_id || 'custom',
            p_credits_purchased: existingRequest.credits_amount,
            p_amount_paid: existingRequest.price_usd ?? 0,
          }
        );

        if (referralError) {
          // Non-fatal: log but don't fail the whole request
          console.warn('[Admin] Referral bonus RPC error (non-fatal):', referralError.message);
        } else if (referralResult?.awarded) {
          console.log(
            `[Admin] Referral bonus awarded: ${referralResult.bonus_credits} credits → referrer ${referralResult.referrer_user_id}`
          );
        } else {
          console.log('[Admin] No referral bonus awarded:', referralResult?.reason || 'No eligible referral');
        }
      } catch (referralErr: any) {
        // Non-fatal: referral bonus failure should not block credit approval
        console.warn('[Admin] Referral bonus exception (non-fatal):', referralErr.message);
      }
    }

    return NextResponse.json({
      request: updatedRequest,
      message: status === 'approved'
        ? `Approved! ${existingRequest.credits_amount} credits added to user account`
        : 'Request rejected successfully',
    });
  } catch (error: any) {
    console.error('[Admin] Credit request review error:', error);
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ReferralService {
  private supabase: SupabaseClient;

  constructor() {
    // Use service role key for admin operations
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Get user's referral code and stats
   */
  async getReferralCode(userId: string) {
    try {
      // Get user's referral code
      const { data: codeData, error: codeError } = await this.supabase
        .from('referral_codes')
        .select('code, total_referrals, total_earned_credits')
        .eq('user_id', userId)
        .single();

      if (codeError) {
        console.error('Error fetching referral code:', codeError);
        throw new InternalServerErrorException('Failed to fetch referral code');
      }

      // Get referral stats
      const { data: statsData, error: statsError } = await this.supabase
        .from('referrals')
        .select('status')
        .eq('referrer_user_id', userId);

      if (statsError) {
        console.error('Error fetching referral stats:', statsError);
      }

      const stats = {
        totalReferrals: codeData.total_referrals,
        totalEarned: codeData.total_earned_credits,
        pendingReferrals: statsData?.filter(r => r.status === 'confirmed').length || 0,
      };

      const shareUrl = `${process.env.FRONTEND_URL || 'https://scanner.coinxera.com'}/?ref=${codeData.code}`;

      return {
        code: codeData.code,
        shareUrl,
        stats,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Unexpected error in getReferralCode:', error);
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  /**
   * Get referral history with pagination
   */
  async getReferralHistory(userId: string, limit: number = 20, offset: number = 0) {
    try {
      const { data, error, count } = await this.supabase
        .from('referrals')
        .select(`
          id,
          referred_user_id,
          referral_code,
          status,
          created_at,
          first_purchase_at,
          first_purchase_amount,
          bonus_credits_awarded,
          user_profiles!referrals_referred_user_id_fkey(display_name, email)
        `, { count: 'exact' })
        .eq('referrer_user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching referral history:', error);
        throw new InternalServerErrorException('Failed to fetch referral history');
      }

      const referrals = data.map(ref => ({
        id: ref.id,
        referredUserId: ref.referred_user_id,
        referredUsername: ref.user_profiles?.display_name || ref.user_profiles?.email?.split('@')[0] || 'Anonymous',
        referralCode: ref.referral_code,
        status: ref.status,
        createdAt: ref.created_at,
        firstPurchaseAt: ref.first_purchase_at,
        firstPurchaseAmount: ref.first_purchase_amount,
        bonusCreditsAwarded: ref.bonus_credits_awarded,
      }));

      return {
        referrals,
        total: count || 0,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Unexpected error in getReferralHistory:', error);
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  /**
   * Apply a referral code
   */
  async applyReferralCode(userId: string, code: string) {
    try {
      const { data, error } = await this.supabase
        .rpc('apply_referral_code', {
          p_user_id: userId,
          p_code: code.toUpperCase().trim(),
        });

      if (error) {
        console.error('Error applying referral code:', error);
        throw new BadRequestException(error.message || 'Failed to apply referral code');
      }

      if (!data.success) {
        throw new BadRequestException(data.message || 'Failed to apply referral code');
      }

      return {
        success: true,
        message: data.message,
        referrerUsername: data.referrerUsername,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Unexpected error in applyReferralCode:', error);
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  /**
   * Award referral bonus (called after purchase)
   */
  async awardReferralBonus(
    buyerUserId: string,
    packageId: string,
    creditsPurchased: number,
    amountPaid: number
  ) {
    try {
      const { data, error } = await this.supabase
        .rpc('award_referral_bonus', {
          p_buyer_user_id: buyerUserId,
          p_package_id: packageId,
          p_credits_purchased: creditsPurchased,
          p_amount_paid: amountPaid,
        });

      if (error) {
        console.error('Error awarding referral bonus:', error);
        // Don't throw - bonus failure shouldn't fail purchase
        return { awarded: false, error: error.message };
      }

      return data || { awarded: false };
    } catch (error) {
      console.error('Unexpected error in awardReferralBonus:', error);
      // Don't throw - bonus failure shouldn't fail purchase
      return { awarded: false, error: 'Unexpected error' };
    }
  }
}

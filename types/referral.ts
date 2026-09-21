// Referral System Types

export interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  createdAt: string;
  isActive: boolean;
  totalReferrals: number;
  totalEarnedCredits: number;
}

export interface ReferralStats {
  totalReferrals: number;
  totalEarned: number;
  pendingReferrals: number;
}

export interface Referral {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referredUsername?: string;
  referralCode: string;
  status: 'pending' | 'confirmed' | 'rewarded';
  createdAt: string;
  firstPurchaseAt?: string;
  firstPurchaseAmount?: number;
  bonusCreditsAwarded: number;
}

export interface ReferralReward {
  id: string;
  packageName: string;
  creditsPurchased: number;
  bonusCredits: number;
  bonusPercentage: number;
  creditedAt: string;
}

export interface ApplyReferralRequest {
  code: string;
}

export interface ApplyReferralResponse {
  success: boolean;
  message: string;
  referrerUsername?: string;
}

export interface ReferralCodeResponse {
  code: string;
  shareUrl: string;
  stats: ReferralStats;
}

export interface ReferralHistoryResponse {
  referrals: Referral[];
  total: number;
}

// FIX-1.2: Referral bonus canonical source
export interface ReferralBonusTier {
  packageId: string;
  percentage: number;
}
export const REFERRAL_BONUS_TIERS: Record<string, ReferralBonusTier> = {
  starter: { packageId: 'starter', percentage: 0.20 },
  basic:   { packageId: 'basic',   percentage: 0.25 },
  pro:     { packageId: 'pro',     percentage: 0.30 },
  premium: { packageId: 'premium', percentage: 0.35 },
};
export function calculateReferralBonusFromTiers(packageId: string, credits: number): number {
  const tier = REFERRAL_BONUS_TIERS[packageId];
  if (!tier) return 0;
  return Math.floor(credits * tier.percentage);
}

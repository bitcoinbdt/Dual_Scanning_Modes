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

// Bonus tier mapping
export const REFERRAL_BONUS_TIERS: Record<string, { percentage: number; credits: number }> = {
  starter: { percentage: 10, credits: 5 },
  basic: { percentage: 15, credits: 15 },
  pro: { percentage: 20, credits: 40 },
  premium: { percentage: 25, credits: 125 },
};

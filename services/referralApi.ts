import axios from 'axios';
import type {
  ReferralCodeResponse,
  ReferralHistoryResponse,
  ApplyReferralRequest,
  ApplyReferralResponse,
} from '@/types/referral';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

// Create axios instance with default config
const referralApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
referralApiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Add response interceptor to handle network errors gracefully
referralApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      console.warn('Backend API not available. Using mock data for development.');
    }
    return Promise.reject(error);
  }
);

/**
 * Get current user's referral code and stats
 */
export async function getReferralCode(): Promise<ReferralCodeResponse> {
  try {
    const response = await referralApiClient.get<ReferralCodeResponse>('/api/referral/code');
    return response.data;
  } catch (error: any) {
    console.warn('Backend not available, using mock referral data for development');
    // Return mock data for development
    return {
      code: 'DEV-MOC-K123',
      shareUrl: `${window.location.origin}/?ref=DEV-MOC-K123`,
      stats: {
        totalReferrals: 5,
        totalEarned: 150,
        pendingReferrals: 2,
      },
    };
  }
}

/**
 * Get referral history
 */
export async function getReferralHistory(
  limit = 20,
  offset = 0
): Promise<ReferralHistoryResponse> {
  try {
    const response = await referralApiClient.get<ReferralHistoryResponse>('/api/referral/history', {
      params: { limit, offset },
    });
    return response.data;
  } catch (error: any) {
    console.warn('Backend not available, using mock referral history for development');
    return {
      referrals: [
        {
          id: '1',
          referrerUserId: 'user1',
          referredUserId: 'user2',
          referredUsername: 'alice_crypto',
          referralCode: 'DEV-MOC-K123',
          status: 'rewarded',
          createdAt: '2026-07-20T10:30:00Z',
          firstPurchaseAt: '2026-07-21T14:20:00Z',
          firstPurchaseAmount: 1.6,
          bonusCreditsAwarded: 40,
        },
        {
          id: '2',
          referrerUserId: 'user1',
          referredUserId: 'user3',
          referredUsername: 'bob_trader',
          referralCode: 'DEV-MOC-K123',
          status: 'rewarded',
          createdAt: '2026-07-18T08:15:00Z',
          firstPurchaseAt: '2026-07-19T11:45:00Z',
          firstPurchaseAmount: 0.9,
          bonusCreditsAwarded: 15,
        },
        {
          id: '3',
          referrerUserId: 'user1',
          referredUserId: 'user4',
          referredUsername: 'charlie_sol',
          referralCode: 'DEV-MOC-K123',
          status: 'pending',
          createdAt: '2026-07-25T16:00:00Z',
          bonusCreditsAwarded: 0,
        },
      ],
      total: 3,
    };
  }
}

/**
 * Apply a referral code
 */
export async function applyReferralCode(
  code: string
): Promise<ApplyReferralResponse> {
  try {
    const response = await referralApiClient.post<ApplyReferralResponse>(
      '/api/referral/apply',
      { code }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error applying referral code:', error);
    throw new Error(error.response?.data?.message || 'Failed to apply referral code');
  }
}

/**
 * Format referral URL for sharing
 */
export function formatReferralUrl(code: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${baseUrl}/?ref=${code}`;
}

/**
 * Calculate referral bonus based on package
 */
export function calculateReferralBonus(packageId: string, credits: number): number {
  const bonusMap: Record<string, number> = {
    starter: 0.10,  // 10%
    basic: 0.15,    // 15%
    pro: 0.20,      // 20%
    premium: 0.25,  // 25%
  };
  
  const bonusPercentage = bonusMap[packageId] || 0.10;
  return Math.floor(credits * bonusPercentage);
}

/**
 * Generate shareable text for social media
 */
export function generateShareText(code: string): string {
  return `Join me on OnChain Alpha Scanner and get credits for your first scan! Use my referral code: ${code}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

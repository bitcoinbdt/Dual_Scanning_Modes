import axios from 'axios';
import { supabase } from '@/lib/supabase';
import type {
  ReferralCodeResponse,
  ReferralHistoryResponse,
  ApplyReferralRequest,
  ApplyReferralResponse,
} from '@/types/referral';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

// Flag to track if backend is available
let backendAvailable = true;

// Create axios instance with default config
const referralApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Reduced timeout to fail faster
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
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
      console.warn('⚠️ Backend API not available. Using Supabase fallback.');
      backendAvailable = false;
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch referral code directly from Supabase when backend is unavailable.
 * This reads from the `referral_codes` table which is populated by the
 * `on_auth_user_created` database trigger on signup.
 */
async function getReferralCodeFromSupabase(): Promise<ReferralCodeResponse> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('referral_codes')
    .select('code, total_referrals, total_earned_credits')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error('No referral code found in database. Please ensure the database trigger is installed.');
  }

  // Fetch pending referrals count (applied code but no purchase yet)
  const { count: pendingCount } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_user_id', user.id)
    .eq('status', 'confirmed'); // 'confirmed' = code applied, waiting for first purchase

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return {
    code: data.code,
    shareUrl: `${baseUrl}/?ref=${data.code}`,
    stats: {
      totalReferrals: data.total_referrals ?? 0,
      totalEarned: data.total_earned_credits ?? 0,
      pendingReferrals: pendingCount ?? 0,
    },
  };
}

/**
 * Get current user's referral code and stats.
 * Tries the backend first, then falls back to reading directly from Supabase.
 */
export async function getReferralCode(): Promise<ReferralCodeResponse> {
  try {
    const response = await referralApiClient.get<ReferralCodeResponse>('/api/referral/code');
    backendAvailable = true;
    return response.data;
  } catch (error: any) {
    console.warn('⚠️ Referral backend unavailable. Falling back to Supabase direct read.');
    // Read from Supabase directly — the real code was created by the DB trigger on signup
    return getReferralCodeFromSupabase();
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
    backendAvailable = true;
    return response.data;
  } catch (error: any) {
    console.warn('⚠️ Referral backend unavailable. Using empty history.');
    return {
      referrals: [],
      total: 0,
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
    backendAvailable = true;
    return response.data;
  } catch (error: any) {
    console.warn('⚠️ Referral backend unavailable. Cannot apply referral codes until backend is deployed.');
    throw new Error('Referral system temporarily unavailable. Backend not deployed yet.');
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

import axios from 'axios';
import { supabase } from '@/lib/supabase';
import type {
  ReferralCodeResponse,
  ReferralHistoryResponse,
  ApplyReferralRequest,
  ApplyReferralResponse,
} from '@/types/referral';

// Use the Next.js proxy rewrite (/proxy/api/*) so the browser never makes a
// cross-origin request. Next.js forwards it server-side to the real backend.
const referralApiClient = axios.create({
  baseURL: '',
  timeout: 10000, // Reduced timeout to fail faster
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available (refreshes dynamically via Supabase)
referralApiClient.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

// Response interceptor — logs when the proxy/backend isn't reachable
let hasLoggedReferralBackendStatus = false;

referralApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
      if (!hasLoggedReferralBackendStatus) {
        console.log('💡 Referral API using Supabase fallback.');
        hasLoggedReferralBackendStatus = true;
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Generate a random 8-character alphanumeric referral code.
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusable chars (0/O, 1/I)
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Fetch referral code directly from Supabase when backend is unavailable.
 * If no code exists yet (e.g., trigger not installed), one is created on the fly.
 */
async function getReferralCodeFromSupabase(): Promise<ReferralCodeResponse> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  // Use maybeSingle() instead of single() to avoid 406 when no row exists
  const { data, error } = await supabase
    .from('referral_codes')
    .select('code, total_referrals, total_earned_credits')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase error fetching referral code: ${error.message}`);
  }

  // If no code exists yet, auto-create one (handles users who signed up
  // before the DB trigger was installed)
  let codeRow = data;
  if (!codeRow) {
    const newCode = generateReferralCode();
    const { data: inserted, error: insertError } = await supabase
      .from('referral_codes')
      .insert({
        user_id: user.id,
        code: newCode,
        is_active: true,
        total_referrals: 0,
        total_earned_credits: 0,
      })
      .select('code, total_referrals, total_earned_credits')
      .single();

    if (insertError) {
      // Might be a race condition — try fetching again
      const { data: retryData } = await supabase
        .from('referral_codes')
        .select('code, total_referrals, total_earned_credits')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!retryData) {
        throw new Error(`Could not create referral code: ${insertError.message}`);
      }
      codeRow = retryData;
    } else {
      codeRow = inserted;
    }
  }

  // Fetch pending referrals count
  const { count: pendingCount } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_user_id', user.id)
    .eq('status', 'confirmed');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return {
    code: codeRow.code,
    shareUrl: `${baseUrl}/?ref=${codeRow.code}`,
    stats: {
      totalReferrals: codeRow.total_referrals ?? 0,
      totalEarned: codeRow.total_earned_credits ?? 0,
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
    const response = await referralApiClient.get<ReferralCodeResponse>('/proxy/api/referral/code');
    return response.data;
  } catch (error: any) {
    // Silently fall back to Supabase
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
    const response = await referralApiClient.get<ReferralHistoryResponse>('/proxy/api/referral/history', {
      params: { limit, offset },
    });
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
      '/proxy/api/referral/apply',
      { code }
    );
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
  return `Join me on OnChain Crypto Scanner and get credits for your first scan! Use my referral code: ${code}`;
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

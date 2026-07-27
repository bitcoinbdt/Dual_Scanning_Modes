import axios from 'axios';
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
      console.warn('⚠️ Backend API not available. Using fallback mode.');
      backendAvailable = false;
    }
    return Promise.reject(error);
  }
);

// Mock data generator for when backend is unavailable
function generateMockReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getMockReferralData(): ReferralCodeResponse {
  // Try to get existing mock code from localStorage
  let mockCode = localStorage.getItem('mockReferralCode');
  if (!mockCode) {
    mockCode = generateMockReferralCode();
    localStorage.setItem('mockReferralCode', mockCode);
  }

  return {
    code: mockCode,
    userId: 'mock-user-id',
    totalReferrals: 0,
    totalEarned: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get current user's referral code and stats
 */
export async function getReferralCode(): Promise<ReferralCodeResponse> {
  try {
    const response = await referralApiClient.get<ReferralCodeResponse>('/api/referral/code');
    backendAvailable = true;
    return response.data;
  } catch (error: any) {
    console.warn('⚠️ Referral backend unavailable. Using mock data. Deploy backend to Render to enable real referrals.');
    return getMockReferralData();
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

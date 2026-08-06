import axios from 'axios';
import type {
  CreditBalance,
  CreditPackage,
  CreditHistoryQuery,
  CreditHistoryResponse,
} from '@/types/credits';

const creditApiClient = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
creditApiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Suppress noisy backend-unavailable errors
let hasLoggedBackendUnavailable = false;

creditApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      if (!hasLoggedBackendUnavailable) {
        console.log('💡 Backend API not available. Using Supabase and local data.');
        hasLoggedBackendUnavailable = true;
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Get current user's credit balance
 */
export async function getCreditBalance(): Promise<CreditBalance> {
  const response = await creditApiClient.get<CreditBalance>('/api/credits/balance');
  return response.data;
}

/**
 * Get available credit packages
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  try {
    const response = await creditApiClient.get<{ packages: CreditPackage[] }>('/api/credits/packages');
    return response.data.packages;
  } catch {
    return getMockPackages();
  }
}

/**
 * Get credit usage history
 */
export async function getCreditHistory(query?: CreditHistoryQuery): Promise<CreditHistoryResponse> {
  try {
    const response = await creditApiClient.get<CreditHistoryResponse>('/api/credits/history', {
      params: query,
    });
    return response.data;
  } catch {
    return { transactions: [], total: 0 };
  }
}

/**
 * Check if user has sufficient credits for a scan
 */
export async function checkSufficientCredits(scanType: 'BASIC' | 'ELEVATOR'): Promise<{
  sufficient: boolean;
  required: number;
  current: number;
  shortage: number;
}> {
  const SCAN_COSTS = { BASIC: 2, ELEVATOR: 10 };
  const balance = await getCreditBalance();
  const required = SCAN_COSTS[scanType];
  const sufficient = balance.balance >= required;

  return {
    sufficient,
    required,
    current: balance.balance,
    shortage: sufficient ? 0 : required - balance.balance,
  };
}

/**
 * Fallback packages (used when API is unavailable)
 */
function getMockPackages(): CreditPackage[] {
  return [
    { id: 'starter',  name: 'Starter',  credits: 100,  priceUsd: 4.99, bonusPercentage: 20, displayOrder: 1 },
    { id: 'basic',    name: 'Basic',    credits: 250,  priceUsd: 9,    bonusPercentage: 25, displayOrder: 2 },
    { id: 'pro',      name: 'Pro',      credits: 600,  priceUsd: 19,   bonusPercentage: 30, displayOrder: 3, isHot: true, isBestValue: true },
    { id: 'premium',  name: 'Premium',  credits: 1300, priceUsd: 39,   bonusPercentage: 35, displayOrder: 4 },
  ];
}

/**
 * Format USD amount for display
 */
export function formatUsdAmount(amount: number): string {
  return `$${amount.toFixed(0)}`;
}

/**
 * Calculate scan examples for a package
 */
export function calculateScanExamples(credits: number): {
  basicScans: number;
  elevatorScans: number;
} {
  return {
    basicScans: Math.floor(credits / 2),
    elevatorScans: Math.floor(credits / 10),
  };
}

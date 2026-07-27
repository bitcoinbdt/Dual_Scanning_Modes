import axios from 'axios';
import type {
  CreditBalance,
  CreditPackage,
  PurchaseCreditRequest,
  PurchaseCreditResponse,
  CreditHistoryQuery,
  CreditHistoryResponse,
} from '@/types/credits';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

// Create axios instance with default config
const creditApiClient = axios.create({
  baseURL: API_BASE_URL,
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

// Add response interceptor to handle network errors gracefully
creditApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      console.warn('Backend API not available. Using mock data for development.');
    }
    return Promise.reject(error);
  }
);

/**
 * Get current user's credit balance
 */
export async function getCreditBalance(): Promise<CreditBalance> {
  try {
    const response = await creditApiClient.get<CreditBalance>('/api/credits/balance');
    return response.data;
  } catch (error: any) {
    console.warn('Backend not available, using mock balance for development');
    // Return mock balance with some credits for testing
    return {
      balance: 100,
      totalPurchased: 100,
      totalSpent: 0,
    };
  }
}

/**
 * Get available credit packages
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  try {
    const response = await creditApiClient.get<{ packages: CreditPackage[] }>('/api/credits/packages');
    return response.data.packages;
  } catch (error: any) {
    console.warn('Backend not available, using mock credit packages for development');
    // Return mock packages for development
    return getMockPackages();
  }
}

/**
 * Purchase credits with Phantom wallet
 */
export async function purchaseCredits(data: PurchaseCreditRequest): Promise<PurchaseCreditResponse> {
  try {
    const response = await creditApiClient.post<PurchaseCreditResponse>('/api/credits/purchase', data);
    return response.data;
  } catch (error: any) {
    console.error('Error purchasing credits:', error);
    throw new Error(error.response?.data?.message || 'Failed to purchase credits');
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
  } catch (error: any) {
    console.error('Error fetching credit history:', error);
    return {
      transactions: [],
      total: 0,
    };
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
 * Mock packages for development (until backend is ready)
 */
function getMockPackages(): CreditPackage[] {
  return [
    {
      id: 'starter',
      name: 'Starter',
      credits: 50,
      priceSol: 0.5,
      priceUsd: 10,
      bonusPercentage: 0,
      displayOrder: 1,
    },
    {
      id: 'basic',
      name: 'Basic',
      credits: 100,
      priceSol: 0.9,
      priceUsd: 18,
      bonusPercentage: 10,
      displayOrder: 2,
    },
    {
      id: 'pro',
      name: 'Pro',
      credits: 200,
      priceSol: 1.6,
      priceUsd: 32,
      bonusPercentage: 20,
      displayOrder: 3,
      isHot: true,
    },
    {
      id: 'premium',
      name: 'Premium',
      credits: 500,
      priceSol: 3.5,
      priceUsd: 70,
      bonusPercentage: 30,
      displayOrder: 4,
      isBestValue: true,
    },
  ];
}

/**
 * Validate Solana transaction signature format
 */
export function isValidSolanaSignature(signature: string): boolean {
  // Solana signatures are base58 encoded and typically 87-88 characters
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature);
}

/**
 * Format SOL amount for display
 */
export function formatSolAmount(amount: number): string {
  return `${amount.toFixed(2)} SOL`;
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

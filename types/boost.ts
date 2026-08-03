// =====================================================
// TOKEN BOOST TYPES
// =====================================================

export type BoostStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'expired';
export type Blockchain = 'solana' | 'ethereum' | 'bsc';
export type BoostDuration = 6 | 12 | 24 | 36;

export interface TokenBoostRequest {
  id: string;
  userId: string;
  
  // Token Information
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl: string;
  tokenContractAddress: string;
  blockchain: Blockchain;
  
  // Optional Information
  website?: string;
  description?: string;
  coingeckoId?: string;
  
  // Live Price Data
  currentPriceUsd?: number;
  priceChange24h?: number;
  lastPriceUpdate?: string;
  
  // Boost Details
  durationHours: BoostDuration;
  creditsCost: number;
  
  // Status & Timestamps
  status: BoostStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  startsAt?: string;
  expiresAt?: string;
  
  // Admin Review
  rejectionReason?: string;
  adminNotes?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: string;
  updatedAt: string;
}

export interface BoostAnalytics {
  id: string;
  boostRequestId: string;
  totalScans: number;
  lastScanAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoostedToken {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl: string;
  tokenContractAddress: string;
  blockchain: Blockchain;
  currentPriceUsd?: number;
  priceChange24h?: number;
  expiresAt: string;
}

export interface BoostSubmitRequest {
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl: string;
  tokenContractAddress: string;
  blockchain: Blockchain;
  durationHours: BoostDuration;
  website?: string;
  description?: string;
  coingeckoId?: string;
}

export interface BoostSubmitResponse {
  success: boolean;
  boostId?: string;
  creditsDeducted?: number;
  newBalance?: number;
  message: string;
  error?: string;
}

export interface BoostApproveRequest {
  boostId: string;
  adminNotes?: string;
}

export interface BoostRejectRequest {
  boostId: string;
  reason: string;
  adminNotes?: string;
}

export interface BoostReviewResponse {
  success: boolean;
  boostId: string;
  creditsRefunded?: number;
  message: string;
}

export interface BoostTrackScanRequest {
  boostId: string;
  contractAddress: string;
  scanType: 'BASIC' | 'ELEVATOR';
}

export interface BoostTrackScanResponse {
  success: boolean;
  totalScans?: number;
  message?: string;
}

// Pricing structure
export const BOOST_PRICING: Record<BoostDuration, number> = {
  6: 50,
  12: 90,
  24: 160,
  36: 220,
};

// Helper to format time remaining
export function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  
  if (diff <= 0) return 'Expired';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

// Helper to format price
export function formatBoostPrice(price?: number): string {
  if (!price) return 'N/A';
  if (price < 0.000001) return `$${price.toExponential(2)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}

// Helper to get status badge color
export function getStatusColor(status: BoostStatus): {
  bg: string;
  text: string;
  label: string;
} {
  switch (status) {
    case 'pending':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending Review' };
    case 'approved':
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Approved' };
    case 'active':
      return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Active' };
    case 'rejected':
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' };
    case 'expired':
      return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Expired' };
  }
}

// Helper to get blockchain label
export function getBlockchainLabel(blockchain: Blockchain): string {
  switch (blockchain) {
    case 'solana':
      return 'Solana';
    case 'ethereum':
      return 'Ethereum';
    case 'bsc':
      return 'BSC';
  }
}

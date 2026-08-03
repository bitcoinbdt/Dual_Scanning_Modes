// Credit System Types

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  bonusPercentage: number;
  displayOrder: number;
  isBestValue?: boolean;
  isHot?: boolean;
}

export interface CreditBalance {
  balance: number;
  totalPurchased: number;
  totalSpent: number;
}

export interface CreditTransaction {
  id: string;
  type: 'purchase' | 'spend' | 'refund';
  amount: number;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export interface ScanCostInfo {
  scanType: 'BASIC' | 'ELEVATOR';
  cost: number;
}

export const SCAN_COSTS: Record<'BASIC' | 'ELEVATOR', number> = {
  BASIC: 2,
  ELEVATOR: 10,
};

export interface CreditHistoryQuery {
  limit?: number;
  offset?: number;
  type?: 'all' | 'purchase' | 'spend';
}

export interface CreditHistoryResponse {
  transactions: CreditTransaction[];
  total: number;
}

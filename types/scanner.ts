// FIX-5.12: types/scanner.ts is now a compatibility shim. The canonical
// definitions live in lib/blockchain/types.ts. This file re-exports the
// canonical OnChainData and provides legacy aliases for fields that were
// previously declared locally.

export type {
  Transaction,
  OnChainData,
  LiquidityPool,
  SecurityData,
  LiquidityInfo,
  CrossChainPoolInfo,
  NetworkHealth,
  ScanMetadata,
} from '@/lib/blockchain/types';

// Note: `ElevatorData` was declared locally as an extension of OnChainData.
// It is retained below for UI backward compatibility but is NOT the
// canonical shape. Consumers should migrate to reading from the flat
// Elevator route payload shape directly.

import type { OnChainData } from '@/lib/blockchain/types';

export interface ElevatorData extends OnChainData {
  marketBehavior?: {
    totalBuyVolume: number;
    totalSellVolume: number;
    netFlow: number;
    transactionCount: number;
  };
  advancedAnalytics?: {
    insiderThreat?: { activeSnipers: number; isDumping: boolean; warning: boolean };
    creatorFunding?: { fundedBy: string; pastRugCount: number; riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' };
    washTrading?: { artificialPercentage: number };
    giniCoefficient?: { score: number };
    holdingVelocity?: { classification: string; averageHoldTimeSeconds: number };
    momentumHeatmap?: Array<{ time: string; buy: number; sell: number; net: number }>;
  };
  topBuyers?: Array<{ wallet: string; amount: number; percentage: number; tag: string; winRate: number }>;
  topSellers?: Array<{ wallet: string; amount: number; percentage: number; tag: string; winRate: number }>;
}

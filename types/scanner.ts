export interface Transaction {
  hash: string;
  fullHash?: string;
  from: string;
  to: string;
  amount: string;
  rawAmount?: number;
  rawTimestamp?: number;
  tokenSymbol?: string;
  timestamp: string;
  type?: 'Buy' | 'Sell' | 'Transfer';
}

export interface LiquidityPool {
  pair: string;
  dex: string;
  liquidityUsd: number;
  priceUsd?: number;
}

export interface OnChainData {
  address: string;
  network?: string;
  tokenName: string;
  symbol: string;
  totalSupply: number;
  recentVolume?: 'High' | 'Medium' | 'Low';
  holderConcentration?: 'High' | 'Medium' | 'Low';
  liquidityLocked: boolean;
  contractVerified: boolean;
  mintFunction: string;
  freezable: string;
  taxBuy: string;
  taxSell: string;
  washTradingPercentage?: number;
  recentTransactions: Transaction[];
  networkHealth: {
    lastBlock: string;
    blockReward: string;
  };
  liquidityInfo?: {
    totalLiquidityUsd: number;
    totalCrossChainLiquidityUsd?: number;
    mainPools: LiquidityPool[];
    crossChainPools?: {
      chain: string;
      dex: string;
      pair: string;
      tokenAddress: string;
      poolAddress: string;
      liquidityUsd: number;
      priceUsd: number;
    }[];
  };
}

export interface ElevatorData extends OnChainData {
  marketBehavior?: {
    totalBuyVolume: number;
    totalSellVolume: number;
    netFlow: number;
    transactionCount: number;
  };
  advancedAnalytics?: {
    insiderThreat?: {
      activeSnipers: number;
      isDumping: boolean;
      warning: boolean;
    };
    creatorFunding?: {
      fundedBy: string;
      pastRugCount: number;
      riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    };
    washTrading?: {
      artificialPercentage: number;
    };
    giniCoefficient?: {
      score: number;
    };
    holdingVelocity?: {
      classification: string;
      averageHoldTimeSeconds: number;
    };
    momentumHeatmap?: Array<{
      time: string;
      buy: number;
      sell: number;
      net: number;
    }>;
  };
  topBuyers?: Array<{
    wallet: string;
    amount: number;
    percentage: number;
    tag: string;
    winRate: number;
  }>;
  topSellers?: Array<{
    wallet: string;
    amount: number;
    percentage: number;
    tag: string;
    winRate: number;
  }>;
}

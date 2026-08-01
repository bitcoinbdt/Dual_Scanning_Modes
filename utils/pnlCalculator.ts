/**
 * P&L Calculation Utilities for Elevator Scan
 * Calculates profit/loss for wallets based on raw transaction data
 */

// Types matching data collector output
export interface RawTransaction {
  timestamp: number;
  signature?: string;
  wallets: string[];
  isTrade?: boolean;
  priceUsd?: number;
  transfers: Array<{
    from: string;
    to: string;
    amount: number;
    type: 'token';
    mint: string;
  }>;
}

export interface HolderInfo {
  wallet: string;
  balance: number;
  tx_count: number;
}

export interface OHLCVCandle {
  timestamp: number;
  open: number;
  close: number;
  volume: number;
}

export interface WalletPnL {
  wallet: string;
  tokensBought: number;
  tokensSold: number;
  currentHoldings: number;
  avgBuyPrice: number;
  currentPrice: number;
  totalInvested: number;
  currentValue: number;
  realizedPnL?: number | null;
  unrealizedPnL?: number | null;
  totalPnL?: number | null;
  pnlPercentage?: number | null;
  status: 'profit' | 'loss' | 'breakeven' | 'unknown';
  hasIncompleteHistory?: boolean;
  gasFeesPaid?: number;
  dexFeesPaid?: number;
  netRealizedPnL?: number | null;
  netUnrealizedPnL?: number | null;
  netTotalPnL?: number | null;
  netPnLPercentage?: number | null;
  costBasisUnknown?: boolean;
  uncostedSellProceeds?: number;
}

/**
 * Fetch current token price from DexScreener API
 */
export async function fetchCurrentPriceFromDexScreener(
  tokenAddress: string
): Promise<number> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      // Sort by liquidity and get the most liquid pair
      const mainPair = data.pairs.sort((a: any, b: any) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];
      
      const price = parseFloat(mainPair.priceUsd);
      return isNaN(price) ? 0 : price;
    }
    
    return 0;
  } catch (error) {
    console.error('Failed to fetch price from DexScreener:', error);
    return 0;
  }
}

/**
 * Extract buy/sell activity for a specific wallet
 */
export function extractWalletActivity(
  wallet: string,
  transactions: RawTransaction[]
): {
  buys: Array<{ amount: number; timestamp: number; priceUsd?: number; gasCostUsd?: number; dexFeeUsd?: number }>;
  sells: Array<{ amount: number; timestamp: number; priceUsd?: number; gasCostUsd?: number; dexFeeUsd?: number }>;
} {
  const buys: Array<{ amount: number; timestamp: number; priceUsd?: number; gasCostUsd?: number; dexFeeUsd?: number }> = [];
  const sells: Array<{ amount: number; timestamp: number; priceUsd?: number; gasCostUsd?: number; dexFeeUsd?: number }> = [];
  
  const txList = transactions ?? [];
  txList.forEach(tx => {
    // Feature 3: Skip transfers/non-trades
    if (tx.isTrade === false) {
      return;
    }
    
    const transfers = tx?.transfers ?? [];
    transfers.forEach(transfer => {
      // Wallet received tokens (buy)
      if (transfer.to === wallet) {
        buys.push({ 
          amount: transfer.amount, 
          timestamp: tx.timestamp,
          priceUsd: tx.priceUsd,
          gasCostUsd: (tx as any).gasCostUsd,
          dexFeeUsd: (tx as any).dexFeeUsd
        } as any);
      }
      
      // Wallet sent tokens (sell)
      if (transfer.from === wallet) {
        sells.push({ 
          amount: transfer.amount, 
          timestamp: tx.timestamp,
          priceUsd: tx.priceUsd,
          gasCostUsd: (tx as any).gasCostUsd,
          dexFeeUsd: (tx as any).dexFeeUsd
        } as any);
      }
    });
  });
  
  return { buys, sells };
}

/**
 * Find the closest OHLCV candle to a given timestamp
 */
function findClosestCandle(
  timestamp: number,
  ohlcv: OHLCVCandle[]
): OHLCVCandle | null {
  if (ohlcv.length === 0) return null;
  
  return ohlcv.reduce((closest, current) => {
    const closestDiff = Math.abs(closest.timestamp - timestamp);
    const currentDiff = Math.abs(current.timestamp - timestamp);
    return currentDiff < closestDiff ? current : closest;
  });
}

/**
 * Estimate average buy price from OHLCV data
 */
export function estimateAvgBuyPrice(
  buys: Array<{ amount: number; timestamp: number; priceUsd?: number }>,
  ohlcv: OHLCVCandle[]
): number {
  if (buys.length === 0) {
    return 0;
  }
  
  let totalValue = 0;
  let totalTokens = 0;
  
  buys.forEach(buy => {
    let priceAtTime = buy.priceUsd || 0;
    
    // Fallback to OHLCV close if exact price is missing
    if (priceAtTime <= 0 && ohlcv.length > 0) {
      const closestCandle = findClosestCandle(buy.timestamp, ohlcv);
      priceAtTime = closestCandle ? closestCandle.close : 0;
    }
    
    totalValue += buy.amount * priceAtTime;
    totalTokens += buy.amount;
  });
  
  return totalTokens > 0 ? totalValue / totalTokens : 0;
}

/**
 * Estimate average sell price from OHLCV data
 */
export function estimateAvgSellPrice(
  sells: Array<{ amount: number; timestamp: number; priceUsd?: number }>,
  ohlcv: OHLCVCandle[]
): number {
  if (sells.length === 0) {
    return 0;
  }
  
  let totalValue = 0;
  let totalTokens = 0;
  
  sells.forEach(sell => {
    let priceAtTime = sell.priceUsd || 0;
    
    // Fallback to OHLCV close if exact price is missing
    if (priceAtTime <= 0 && ohlcv.length > 0) {
      const closestCandle = findClosestCandle(sell.timestamp, ohlcv);
      priceAtTime = closestCandle ? closestCandle.close : 0;
    }
    
    totalValue += sell.amount * priceAtTime;
    totalTokens += sell.amount;
  });
  
  return totalTokens > 0 ? totalValue / totalTokens : 0;
}

/**
 * Calculate P&L for a specific wallet
 */
export function calculateWalletPnL(
  wallet: string,
  transactions: RawTransaction[],
  holders: HolderInfo[],
  ohlcv: OHLCVCandle[],
  currentPrice: number
): WalletPnL {
  // Extract buy/sell activity
  const { buys, sells } = extractWalletActivity(wallet, transactions);
  
  // Calculate totals
  const tokensBought = buys.reduce((sum, b) => sum + b.amount, 0);
  const tokensSold = sells.reduce((sum, s) => sum + s.amount, 0);
  
  // Get current holdings
  const holder = holders.find(h => h.wallet === wallet);
  const currentHoldings = holder ? holder.balance : 0;
  
  // Estimate prices
  const avgBuyPrice = estimateAvgBuyPrice(buys, ohlcv);
  const avgSellPrice = estimateAvgSellPrice(sells, ohlcv);
  
  const costBasisUnknown = (avgBuyPrice === 0 && sells.length > 0);

  // Calculate investment and current value
  const totalInvested = tokensBought * avgBuyPrice;
  const currentValue = currentHoldings * currentPrice;
  
  // Calculate realized P&L (from tokens sold)
  const realizedPnL = costBasisUnknown ? null : (avgSellPrice - avgBuyPrice) * tokensSold;
  
  // Calculate unrealized P&L (from current holdings)
  const unrealizedPnL = costBasisUnknown ? null : (currentPrice - avgBuyPrice) * currentHoldings;
  
  // Total P&L
  const totalPnL = costBasisUnknown ? null : (realizedPnL! + unrealizedPnL!);
  const pnlPercentage = costBasisUnknown ? null : (totalInvested > 0 ? (totalPnL! / totalInvested) * 100 : 0);
  
  // Determine status
  let status: 'profit' | 'loss' | 'breakeven' | 'unknown';
  if (costBasisUnknown) {
    status = 'unknown';
  } else if (totalPnL! > 0.01) {
    status = 'profit';
  } else if (totalPnL! < -0.01) {
    status = 'loss';
  } else {
    status = 'breakeven';
  }

  // Calculate fees and net P&L
  const gasFeesPaid = buys.reduce((sum, b) => sum + ((b as any).gasCostUsd || 0), 0) + sells.reduce((sum, s) => sum + ((s as any).gasCostUsd || 0), 0);
  const dexFeesPaid = buys.reduce((sum, b) => sum + ((b as any).dexFeeUsd || 0), 0) + sells.reduce((sum, s) => sum + ((s as any).dexFeeUsd || 0), 0);
  
  const totalBuyFees = buys.reduce((sum, b) => sum + ((b as any).gasCostUsd || 0) + ((b as any).dexFeeUsd || 0), 0);
  const totalSellFees = sells.reduce((sum, s) => sum + ((s as any).gasCostUsd || 0) + ((s as any).dexFeeUsd || 0), 0);

  const fractionOfBuysSold = tokensBought > 0 ? (tokensSold / tokensBought) : 0;
  const fractionOfBuysHeld = tokensBought > 0 ? (currentHoldings / tokensBought) : 0;

  const realizedFees = totalSellFees + (fractionOfBuysSold * totalBuyFees);
  const unrealizedFees = fractionOfBuysHeld * totalBuyFees;

  const netRealizedPnL = costBasisUnknown ? null : realizedPnL! - realizedFees;
  const netUnrealizedPnL = costBasisUnknown ? null : unrealizedPnL! - unrealizedFees;
  const netTotalPnL = costBasisUnknown ? null : netRealizedPnL! + netUnrealizedPnL!;
  const netPnLPercentage = costBasisUnknown ? null : (totalInvested > 0 ? (netTotalPnL! / totalInvested) * 100 : 0);
  
  // Feature 4: Detect Incomplete History
  // Gather all transactions (trades and transfers) for this wallet and sort chronologically
  const walletTxs: Array<{ timestamp: number; from: string; to: string; isTrade: boolean }> = [];
  const txList = transactions ?? [];
  for (const tx of txList) {
    const transfers = tx?.transfers ?? [];
    for (const transfer of transfers) {
      if (transfer.from === wallet || transfer.to === wallet) {
        walletTxs.push({
          timestamp: tx.timestamp,
          from: transfer.from,
          to: transfer.to,
          isTrade: tx.isTrade !== false
        });
      }
    }
  }
  
  walletTxs.sort((a, b) => a.timestamp - b.timestamp);
  
  let hasIncompleteHistory = false;
  if (walletTxs.length > 0) {
    const firstTx = walletTxs[0];
    // If first transaction is an outflow (sell/transfer out) from this wallet
    if (firstTx.from === wallet) {
      hasIncompleteHistory = true;
    }
  }
  
  return {
    wallet,
    tokensBought,
    tokensSold,
    currentHoldings,
    avgBuyPrice,
    currentPrice,
    totalInvested,
    currentValue,
    realizedPnL,
    unrealizedPnL,
    totalPnL,
    pnlPercentage,
    status,
    gasFeesPaid,
    dexFeesPaid,
    netRealizedPnL,
    netUnrealizedPnL,
    netTotalPnL,
    netPnLPercentage,
    hasIncompleteHistory: costBasisUnknown ? true : hasIncompleteHistory,
    costBasisUnknown
  };
}

/**
 * Calculate P&L for all unique wallets in the transaction data
 */
export function calculateAllWalletPnL(
  transactions: RawTransaction[],
  holders: HolderInfo[],
  ohlcv: OHLCVCandle[],
  currentPrice: number
): Map<string, WalletPnL> {
  const pnlMap = new Map<string, WalletPnL>();
  
  // Get unique wallets from all transactions
  const uniqueWallets = new Set<string>();
  const txList = transactions ?? [];
  txList.forEach(tx => {
    const transfers = tx?.transfers ?? [];
    transfers.forEach(transfer => {
      if (transfer.from) uniqueWallets.add(transfer.from);
      if (transfer.to) uniqueWallets.add(transfer.to);
    });
  });
  
  // Calculate P&L for each unique wallet
  uniqueWallets.forEach(wallet => {
    const pnl = calculateWalletPnL(
      wallet,
      transactions,
      holders,
      ohlcv,
      currentPrice
    );
    pnlMap.set(wallet, pnl);
  });
  
  return pnlMap;
}

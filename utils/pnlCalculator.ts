/**
 * P&L Calculation Utilities for Elevator Scan
 * Calculates profit/loss for wallets based on raw transaction data
 */

// Types matching data collector output
export interface RawTransaction {
  timestamp: number;
  signature?: string;
  wallets: string[];
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
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  pnlPercentage: number;
  status: 'profit' | 'loss' | 'breakeven';
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
  buys: Array<{ amount: number; timestamp: number }>;
  sells: Array<{ amount: number; timestamp: number }>;
} {
  const buys: Array<{ amount: number; timestamp: number }> = [];
  const sells: Array<{ amount: number; timestamp: number }> = [];
  
  const txList = transactions ?? [];
  txList.forEach(tx => {
    const transfers = tx?.transfers ?? [];
    transfers.forEach(transfer => {
      // Wallet received tokens (buy)
      if (transfer.to === wallet) {
        buys.push({ 
          amount: transfer.amount, 
          timestamp: tx.timestamp 
        });
      }
      
      // Wallet sent tokens (sell)
      if (transfer.from === wallet) {
        sells.push({ 
          amount: transfer.amount, 
          timestamp: tx.timestamp 
        });
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
  buys: Array<{ amount: number; timestamp: number }>,
  ohlcv: OHLCVCandle[]
): number {
  if (buys.length === 0 || ohlcv.length === 0) {
    return 0;
  }
  
  let totalValue = 0;
  let totalTokens = 0;
  
  buys.forEach(buy => {
    // Find closest OHLCV candle to transaction timestamp
    const closestCandle = findClosestCandle(buy.timestamp, ohlcv);
    
    // Use close price as the transaction price estimate
    const priceAtTime = closestCandle ? closestCandle.close : 0;
    
    totalValue += buy.amount * priceAtTime;
    totalTokens += buy.amount;
  });
  
  return totalTokens > 0 ? totalValue / totalTokens : 0;
}

/**
 * Estimate average sell price from OHLCV data
 */
export function estimateAvgSellPrice(
  sells: Array<{ amount: number; timestamp: number }>,
  ohlcv: OHLCVCandle[]
): number {
  if (sells.length === 0 || ohlcv.length === 0) {
    return 0;
  }
  
  let totalValue = 0;
  let totalTokens = 0;
  
  sells.forEach(sell => {
    const closestCandle = findClosestCandle(sell.timestamp, ohlcv);
    const priceAtTime = closestCandle ? closestCandle.close : 0;
    
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
  
  // Calculate investment and current value
  const totalInvested = tokensBought * avgBuyPrice;
  const currentValue = currentHoldings * currentPrice;
  
  // Calculate realized P&L (from tokens sold)
  const realizedPnL = (avgSellPrice - avgBuyPrice) * tokensSold;
  
  // Calculate unrealized P&L (from current holdings)
  const unrealizedPnL = (currentPrice - avgBuyPrice) * currentHoldings;
  
  // Total P&L
  const totalPnL = realizedPnL + unrealizedPnL;
  const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  
  // Determine status
  let status: 'profit' | 'loss' | 'breakeven';
  if (totalPnL > 0.01) {
    status = 'profit';
  } else if (totalPnL < -0.01) {
    status = 'loss';
  } else {
    status = 'breakeven';
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
    status
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

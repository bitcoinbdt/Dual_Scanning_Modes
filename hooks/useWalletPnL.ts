import { useMemo } from 'react';
import { RawTransaction, HolderInfo, OHLCVCandle, WalletPnL, calculateWalletPnL } from '../utils/pnlCalculator';
import { calculateFIFOPnL } from '../lib/pnl/fifoCalculator';
import { calculateLIFOPnL } from '../lib/pnl/lifoCalculator';

export type CostMethod = 'average' | 'fifo' | 'lifo';

/**
 * React Hook to calculate P&L for all wallets using selected cost basis method
 */
export function useWalletPnL(
  transactions: RawTransaction[],
  holders: HolderInfo[],
  ohlcv: OHLCVCandle[],
  currentPrice: number,
  costMethod: CostMethod
): Map<string, WalletPnL> {
  return useMemo(() => {
    if (currentPrice === 0) return new Map();

    const map = new Map<string, WalletPnL>();
    
    // Find all unique wallets from transactions
    const uniqueWallets = new Set<string>();
    for (const tx of transactions) {
      if (tx.wallets) {
        tx.wallets.forEach(w => uniqueWallets.add(w));
      }
    }

    for (const wallet of uniqueWallets) {
      try {
        let pnl: WalletPnL;
        if (costMethod === 'fifo') {
          pnl = calculateFIFOPnL(wallet, transactions, holders, ohlcv, currentPrice);
        } else if (costMethod === 'lifo') {
          pnl = calculateLIFOPnL(wallet, transactions, holders, ohlcv, currentPrice);
        } else {
          pnl = calculateWalletPnL(wallet, transactions, holders, ohlcv, currentPrice);
        }
        map.set(wallet, pnl);
      } catch (err) {
        console.error(`Failed to calculate PnL for wallet ${wallet} using ${costMethod}:`, err);
      }
    }

    return map;
  }, [transactions, holders, ohlcv, currentPrice, costMethod]);
}

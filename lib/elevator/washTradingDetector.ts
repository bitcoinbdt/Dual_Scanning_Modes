import { UniversalTransaction } from './collectors/types';

export interface WashTradingResult {
  transactions: UniversalTransaction[];  // with isWashTrader flag added
  summary: {
    totalWashWallets: number;
    totalRoundTrips: number;
    washWallets: string[];  // list of wallet addresses flagged
  };
}

/**
 * Detects wash trading behavior inside the scanned transaction batch.
 * Flagged if a wallet has at least one BUY and one SELL trade.
 */
export function detectWashTrading(transactions: UniversalTransaction[]): WashTradingResult {
  // Group by wallet address
  const walletGroups = new Map<string, UniversalTransaction[]>();
  
  for (const tx of transactions) {
    const wallet = tx.wallet;
    if (!wallet) continue;
    if (!walletGroups.has(wallet)) walletGroups.set(wallet, []);
    walletGroups.get(wallet)!.push(tx);
  }
  
  const washWallets: string[] = [];
  
  for (const [wallet, txs] of walletGroups) {
    const hasBuy = txs.some(tx => tx.type === 'buy' && tx.isTrade === true);
    const hasSell = txs.some(tx => tx.type === 'sell' && tx.isTrade === true);
    
    if (hasBuy && hasSell) {
      washWallets.push(wallet);
      // Count round-trips: pair buys with sells chronologically
      const buys = txs.filter(tx => tx.type === 'buy' && tx.isTrade).sort((a, b) => a.timestamp - b.timestamp);
      const sells = txs.filter(tx => tx.type === 'sell' && tx.isTrade).sort((a, b) => a.timestamp - b.timestamp);
      let roundTrips = 0;
      let buyIdx = 0, sellIdx = 0;
      while (buyIdx < buys.length && sellIdx < sells.length) {
        if (sells[sellIdx].timestamp > buys[buyIdx].timestamp) {
          roundTrips++;
          buyIdx++;
          sellIdx++;
        } else {
          sellIdx++;
        }
      }
      
      // Tag all txs for this wallet
      for (const tx of txs) {
        tx.isWashTrader = true;
        tx.roundTrips = roundTrips;
      }
    } else {
      for (const tx of txs) {
        tx.isWashTrader = false;
        tx.roundTrips = 0;
      }
    }
  }
  
  return {
    transactions,
    summary: {
      totalWashWallets: washWallets.length,
      totalRoundTrips: washWallets.reduce((sum, w) => {
        const txs = walletGroups.get(w)!;
        return sum + (txs[0]?.roundTrips || 0);
      }, 0),
      washWallets,
    },
  };
}

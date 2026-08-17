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
 *
 * A wallet is flagged as a wash trader ONLY if it exhibits systematic
 * round-tripping (velocity-bound, size-symmetric swaps).
 */
export function detectWashTrading(transactions: UniversalTransaction[]): WashTradingResult {
  const WASH_TIME_WINDOW_SEC = 7200; // 2 hours window
  const WASH_SIZE_TOLERANCE = 0.15;   // 15% size tolerance
  const MIN_WASH_ROUND_TRIPS = 2;    // at least 2 completed cycles

  // Group by wallet address
  const walletGroups = new Map<string, UniversalTransaction[]>();
  
  for (const tx of transactions) {
    const wallet = tx.wallet;
    if (!wallet) continue;
    if (!walletGroups.has(wallet)) walletGroups.set(wallet, []);
    walletGroups.get(wallet)!.push(tx);
  }
  
  const washWallets: string[] = [];
  let totalRoundTrips = 0;
  
  for (const [wallet, txs] of walletGroups) {
    // Sort transactions chronologically
    const trades = txs
      .filter(tx => tx.isTrade === true && (tx.type === 'buy' || tx.type === 'sell'))
      .sort((a, b) => a.timestamp - b.timestamp);

    const matchedPairs: [UniversalTransaction, UniversalTransaction][] = [];
    const usedIndices = new Set<number>();

    // Greedy matching for wash trade cycles
    for (let i = 0; i < trades.length; i++) {
      if (usedIndices.has(i)) continue;
      const tx1 = trades[i];

      // Find the first chronological trade of the opposite type that matches our constraints
      for (let j = i + 1; j < trades.length; j++) {
        if (usedIndices.has(j)) continue;
        const tx2 = trades[j];

        // Must be opposite type (buy vs sell)
        if (tx1.type === tx2.type) continue;

        // Check time velocity
        const timeDiff = Math.abs(tx2.timestamp - tx1.timestamp);
        if (timeDiff > WASH_TIME_WINDOW_SEC) {
          // Since trades are sorted chronologically, j is only going to get further away
          break;
        }

        // Check size symmetry (within 15% tolerance)
        const sizeDiff = Math.abs(tx2.amount - tx1.amount);
        const maxSize = Math.max(tx1.amount, tx2.amount);
        const sizeDiffRatio = maxSize > 0 ? sizeDiff / maxSize : 0;

        if (sizeDiffRatio <= WASH_SIZE_TOLERANCE) {
          matchedPairs.push([tx1, tx2]);
          usedIndices.add(i);
          usedIndices.add(j);
          break;
        }
      }
    }

    const roundTripsCount = matchedPairs.length;
    const isWash = roundTripsCount >= MIN_WASH_ROUND_TRIPS;

    if (isWash) {
      washWallets.push(wallet);
      totalRoundTrips += roundTripsCount;

      // Build a set of matching transaction hashes
      const washHashes = new Set<string>();
      for (const [tx1, tx2] of matchedPairs) {
        washHashes.add(tx1.hash);
        washHashes.add(tx2.hash);
      }

      // Tag all transactions for this wallet
      for (const tx of txs) {
        const isMatchedWashTx = washHashes.has(tx.hash);
        tx.isWashTrader = isMatchedWashTx; // Only flag the actual wash trades, not other unrelated transactions
        tx.roundTrips = roundTripsCount;
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
      totalRoundTrips,
      washWallets,
    },
  };
}

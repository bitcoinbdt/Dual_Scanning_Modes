/**
 * SmartMoney PnL Engine — Phase 5D-2
 *
 * Implements a strict, deterministic FIFO cost-basis matcher to calculate
 * realized PnL, ROI, win rates, and trade statistics from normalized events.
 *
 * HARD ANTI-FABRICATION GUARANTEES:
 *   - Open positions never contribute to realized PnL.
 *   - ROI and win rates return NULL instead of fake 0 when no closed trades exist.
 *   - Missing USD quote values result in NULL PnL and 'incomplete' PnL status.
 *   - Unmatched sells result in 'incomplete' PnL status.
 */

import type { SmartMoneyTradeEvent } from '../types';

export interface TokenPositionSummary {
  tokenAddress: string;
  realizedPnl: number | null;
  realizedCostBasis: number | null;
  profitableTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  closedTrades: number;
  openAmount: number;
  pnlStatus: 'complete' | 'incomplete' | 'unavailable';
}

export interface PnlSummary {
  totalIndexedEvents: number;
  recognizedSwapCount: number;
  closedTradeCount: number;
  profitableTradeCount: number;
  losingTradeCount: number;
  distinctTokensTraded: number;
  realizedPnl: number | null;
  realizedCostBasis: number | null;
  roi: number | null;
  winRate: number | null;
  openPositionCount: number;
  pnlStatus: 'complete' | 'incomplete' | 'unavailable';
}

interface BuyLot {
  amount: number;
  price: number | null;
}

/**
 * Calculates FIFO PnL metrics for a collection of trade events.
 */
export function calculateSmartMoneyPnl(
  events: SmartMoneyTradeEvent[]
): PnlSummary {
  const summary: PnlSummary = {
    totalIndexedEvents:   events.length,
    recognizedSwapCount:  0,
    closedTradeCount:     0,
    profitableTradeCount: 0,
    losingTradeCount:     0,
    distinctTokensTraded: 0,
    realizedPnl:          null,
    realizedCostBasis:    null,
    roi:                  null,
    winRate:              null,
    openPositionCount:    0,
    pnlStatus:            'complete',
  };

  if (events.length === 0) {
    summary.pnlStatus = 'unavailable';
    return summary;
  }

  // Filter recognized buy/sell swaps
  const swaps = events.filter(
    (e) => (e.eventType === 'buy' || e.eventType === 'sell') && e.tokenAddress
  );
  summary.recognizedSwapCount = swaps.length;

  // Group events by base token
  const tokenGroups = new Map<string, SmartMoneyTradeEvent[]>();
  for (const s of swaps) {
    const tAddr = s.tokenAddress!;
    if (!tokenGroups.has(tAddr)) {
      tokenGroups.set(tAddr, []);
    }
    tokenGroups.get(tAddr)!.push(s);
  }

  summary.distinctTokensTraded = tokenGroups.size;

  let totalRealizedPnl = 0;
  let totalCostBasis = 0;
  let hasValidPnl = false;
  let globalPnlStatus: 'complete' | 'incomplete' | 'unavailable' = 'complete';

  for (const [tokenAddress, tokenEvents] of tokenGroups.entries()) {
    // Sort events ascending by timestamp, blockNumber
    const sorted = [...tokenEvents].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      if (ta !== tb) return ta - tb;
      return a.blockNumber - b.blockNumber;
    });

    const buyLots: BuyLot[] = [];
    let tokenRealizedPnl = 0;
    let tokenCostBasis = 0;
    let tokenProfitable = 0;
    let tokenLosing = 0;
    let tokenBreakEven = 0;
    let tokenClosed = 0;
    let tokenPnlStatus: 'complete' | 'incomplete' | 'unavailable' = 'complete';

    for (const e of sorted) {
      if (e.eventType === 'buy') {
        const amount = e.tokenAmount;
        const quote = e.quoteAmount;
        if (amount && amount > 0) {
          const price = quote && quote > 0 ? quote / amount : null;
          buyLots.push({ amount, price });
        }
      } else if (e.eventType === 'sell') {
        const amount = e.tokenAmount;
        const quote = e.quoteAmount;
        if (amount && amount > 0) {
          const price = quote && quote > 0 ? quote / amount : null;
          let remainingSell = amount;
          let matchedCost = 0;
          let matchedRevenue = 0;
          let hasNullPrice = false;

          while (remainingSell > 0 && buyLots.length > 0) {
            const lot = buyLots[0];
            const match = Math.min(remainingSell, lot.amount);

            if (lot.price !== null && price !== null) {
              matchedCost += match * lot.price;
              matchedRevenue += match * price;
            } else {
              hasNullPrice = true;
            }

            lot.amount -= match;
            remainingSell -= match;

            if (lot.amount <= 0) {
              buyLots.shift();
            }
          }

          if (remainingSell > 0) {
            // sold without buy lot matching -> incomplete history
            tokenPnlStatus = 'incomplete';
          }

          if (hasNullPrice || price === null) {
            tokenPnlStatus = 'unavailable';
          }

          const matchedAmount = amount - remainingSell;
          if (matchedAmount > 0 && !hasNullPrice && price !== null) {
            const pnl = matchedRevenue - matchedCost;
            tokenRealizedPnl += pnl;
            tokenCostBasis += matchedCost;
            tokenClosed++;

            if (pnl > 0) {
              tokenProfitable++;
            } else if (pnl < 0) {
              tokenLosing++;
            } else {
              tokenBreakEven++;
            }
            hasValidPnl = true;
          }
        }
      }
    }

    // Check open amount remaining
    const openAmount = buyLots.reduce((sum, l) => sum + l.amount, 0);
    if (openAmount > 0) {
      summary.openPositionCount++;
    }

    // Accumulate base stats
    summary.closedTradeCount += tokenClosed;
    summary.profitableTradeCount += tokenProfitable;
    summary.losingTradeCount += tokenLosing;

    if (tokenPnlStatus === 'incomplete') {
      globalPnlStatus = 'incomplete';
    } else if (tokenPnlStatus === 'unavailable' && globalPnlStatus !== 'incomplete') {
      globalPnlStatus = 'unavailable';
    }

    if (tokenCostBasis > 0) {
      totalRealizedPnl += tokenRealizedPnl;
      totalCostBasis += tokenCostBasis;
    }
  }

  if (hasValidPnl) {
    summary.realizedPnl = totalRealizedPnl;
    summary.realizedCostBasis = totalCostBasis;
    summary.roi = totalCostBasis > 0 ? totalRealizedPnl / totalCostBasis : null;
  }

  summary.winRate =
    summary.closedTradeCount > 0
      ? summary.profitableTradeCount / summary.closedTradeCount
      : null;

  summary.pnlStatus = globalPnlStatus;

  return summary;
}

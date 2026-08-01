import { RawTransaction, HolderInfo, OHLCVCandle, WalletPnL } from '../../utils/pnlCalculator';
import { extractWalletActivity } from '../../utils/pnlCalculator';

function findClosestCandle(timestamp: number, ohlcv: OHLCVCandle[]): OHLCVCandle | null {
  if (ohlcv.length === 0) return null;
  return ohlcv.reduce((closest, current) => {
    const closestDiff = Math.abs(closest.timestamp - timestamp);
    const currentDiff = Math.abs(current.timestamp - timestamp);
    return currentDiff < closestDiff ? current : closest;
  });
}

function getPriceFromOhlcv(timestamp: number, ohlcv: OHLCVCandle[]): number {
  if (ohlcv.length === 0) return 0;
  const closest = findClosestCandle(timestamp, ohlcv);
  return closest ? closest.close : 0;
}

function detectIncompleteHistory(wallet: string, transactions: RawTransaction[]): boolean {
  const walletTxs = [];
  const txList = transactions ?? [];
  for (const tx of txList) {
    const transfers = tx?.transfers ?? [];
    for (const transfer of transfers) {
      if (transfer.from === wallet || transfer.to === wallet) {
        walletTxs.push({
          timestamp: tx.timestamp,
          from: transfer.from,
          to: transfer.to
        });
      }
    }
  }
  walletTxs.sort((a, b) => a.timestamp - b.timestamp);
  if (walletTxs.length > 0) {
    return walletTxs[0].from === wallet;
  }
  return false;
}

/**
 * Calculate LIFO (Last-In-First-Out) cost basis P&L for a specific wallet
 */
export function calculateLIFOPnL(
  wallet: string,
  transactions: RawTransaction[],
  holders: HolderInfo[],
  ohlcv: OHLCVCandle[],
  currentPrice: number
): WalletPnL {
  const { buys, sells } = extractWalletActivity(wallet, transactions);

  const buyLots = buys.map(b => ({
    amount: b.amount,
    origAmount: b.amount,
    price: b.priceUsd && b.priceUsd > 0 ? b.priceUsd : getPriceFromOhlcv(b.timestamp, ohlcv),
    gasCostUsd: b.gasCostUsd || 0,
    dexFeeUsd: b.dexFeeUsd || 0,
    timestamp: b.timestamp
  })).sort((a, b) => a.timestamp - b.timestamp);

  const sellLots = sells.map(s => ({
    amount: s.amount,
    price: s.priceUsd && s.priceUsd > 0 ? s.priceUsd : getPriceFromOhlcv(s.timestamp, ohlcv),
    gasCostUsd: s.gasCostUsd || 0,
    dexFeeUsd: s.dexFeeUsd || 0,
    timestamp: s.timestamp
  })).sort((a, b) => a.timestamp - b.timestamp);

  const tokensBought = buys.reduce((sum, b) => sum + b.amount, 0);
  const tokensSold = sells.reduce((sum, s) => sum + s.amount, 0);

  const holder = holders.find(h => h.wallet === wallet);
  const currentHoldings = holder ? holder.balance : 0;

  const gasFeesPaid = buys.reduce((sum, b) => sum + (b.gasCostUsd || 0), 0) + sells.reduce((sum, s) => sum + (s.gasCostUsd || 0), 0);
  const dexFeesPaid = buys.reduce((sum, b) => sum + (b.dexFeeUsd || 0), 0) + sells.reduce((sum, s) => sum + (s.dexFeeUsd || 0), 0);

  let realizedPnL = 0;
  let realizedFees = 0;
  const activeLots = buyLots.map(l => ({ ...l }));
  let uncostedSellProceeds = 0;

  for (const sell of sellLots) {
    let sellAmount = sell.amount;
    const sellPrice = sell.price;
    const sellFees = sell.gasCostUsd + sell.dexFeeUsd;

    realizedFees += sellFees;

    while (sellAmount > 0 && activeLots.length > 0) {
      const newestLot = activeLots[activeLots.length - 1];
      const newestLotTotalFees = newestLot.gasCostUsd + newestLot.dexFeeUsd;

      if (newestLot.amount <= sellAmount) {
        realizedPnL += newestLot.amount * (sellPrice - newestLot.price);
        realizedFees += (newestLot.amount / newestLot.origAmount) * newestLotTotalFees;
        sellAmount -= newestLot.amount;
        activeLots.pop();
      } else {
        realizedPnL += sellAmount * (sellPrice - newestLot.price);
        realizedFees += (sellAmount / newestLot.origAmount) * newestLotTotalFees;
        newestLot.amount -= sellAmount;
        sellAmount = 0;
      }
    }

    if (sellAmount > 0) {
      uncostedSellProceeds += sellAmount * sellPrice;
    }
  }

  let unrealizedPnL = 0;
  let unrealizedFees = 0;
  for (const lot of activeLots) {
    unrealizedPnL += lot.amount * (currentPrice - lot.price);
    unrealizedFees += (lot.amount / lot.origAmount) * (lot.gasCostUsd + lot.dexFeeUsd);
  }

  const costOfAllBuys = buyLots.reduce((sum, b) => sum + b.amount * b.price, 0);
  const avgBuyPrice = tokensBought > 0 ? costOfAllBuys / tokensBought : 0;
  
  const costBasisUnknown = (uncostedSellProceeds > 0) || (avgBuyPrice === 0 && tokensSold > 0);

  const totalPnL = costBasisUnknown ? null : realizedPnL + unrealizedPnL;
  const pnlPercentage = costBasisUnknown ? null : (costOfAllBuys > 0 ? (totalPnL! / costOfAllBuys) * 100 : 0);

  const netRealizedPnL = costBasisUnknown ? null : realizedPnL - realizedFees;
  const netUnrealizedPnL = costBasisUnknown ? null : unrealizedPnL - unrealizedFees;
  const netTotalPnL = costBasisUnknown ? null : netRealizedPnL! + netUnrealizedPnL!;
  const netPnLPercentage = costBasisUnknown ? null : (costOfAllBuys > 0 ? (netTotalPnL! / costOfAllBuys) * 100 : 0);

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

  return {
    wallet,
    tokensBought,
    tokensSold,
    currentHoldings,
    avgBuyPrice,
    currentPrice,
    totalInvested: costOfAllBuys,
    currentValue: currentHoldings * currentPrice,
    realizedPnL: costBasisUnknown ? null : realizedPnL,
    unrealizedPnL: costBasisUnknown ? null : unrealizedPnL,
    totalPnL,
    pnlPercentage,
    status,
    gasFeesPaid,
    dexFeesPaid,
    netRealizedPnL,
    netUnrealizedPnL,
    netTotalPnL,
    netPnLPercentage,
    hasIncompleteHistory: costBasisUnknown ? true : detectIncompleteHistory(wallet, transactions),
    costBasisUnknown,
    uncostedSellProceeds
  };
}

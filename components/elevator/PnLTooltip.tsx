'use client';

import { WalletPnL } from '@/utils/pnlCalculator';

interface PnLTooltipProps {
  pnl: WalletPnL;
}

/**
 * P&L Tooltip Component
 * Shows detailed P&L breakdown on hover
 */
export function PnLTooltip({ pnl }: PnLTooltipProps) {
  const formatNumber = (value: number) => {
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    });
  };
  
  const formatPrice = (value: number) => {
    if (value < 0.000001) {
      return value.toExponential(2);
    }
    return value.toFixed(8);
  };
  
  const isProfit = pnl.totalPnL > 0;
  const isLoss = pnl.totalPnL < 0;
  
  return (
    <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-xl shadow-black/50 min-w-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-700">
        <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          P&L Breakdown
        </h5>
        <span className={`text-lg ${isProfit ? '🟢' : isLoss ? '🔴' : '⚪'}`}>
          {isProfit && '🟢'}
          {isLoss && '🔴'}
          {!isProfit && !isLoss && '⚪'}
        </span>
      </div>
      
      {/* Trading Activity */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between gap-8">
          <span className="text-xs text-slate-400">Tokens Bought:</span>
          <span className="text-xs text-white font-mono font-semibold">
            {formatNumber(pnl.tokensBought)}
          </span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-xs text-slate-400">Tokens Sold:</span>
          <span className="text-xs text-white font-mono font-semibold">
            {formatNumber(pnl.tokensSold)}
          </span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-xs text-slate-400">Current Holdings:</span>
          <span className="text-xs text-white font-mono font-semibold">
            {formatNumber(pnl.currentHoldings)}
          </span>
        </div>
      </div>
      
      {/* Divider */}
      <div className="h-px bg-slate-700 my-3" />
      
      {/* Price Information */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between gap-8">
          <span className="text-xs text-slate-400">Avg Buy Price:</span>
          <span className="text-xs text-white font-mono font-semibold">
            ${formatPrice(pnl.avgBuyPrice)}
          </span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-xs text-slate-400">Current Price:</span>
          <span className="text-xs text-white font-mono font-semibold">
            ${formatPrice(pnl.currentPrice)}
          </span>
        </div>
      </div>
      
      {/* Divider */}
      <div className="h-px bg-slate-700 my-3" />
      
      {/* Investment & Value */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between gap-8">
          <span className="text-xs text-slate-400">Total Invested:</span>
          <span className="text-xs text-white font-mono font-semibold">
            ${formatNumber(pnl.totalInvested)}
          </span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-xs text-slate-400">Current Value:</span>
          <span className="text-xs text-white font-mono font-semibold">
            ${formatNumber(pnl.currentValue)}
          </span>
        </div>
      </div>
      
      {/* Divider */}
      <div className="h-px bg-slate-700 my-3" />
      
      {/* P&L Details */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between gap-8">
          <span className="text-xs text-slate-400">Realized P&L:</span>
          <span className={`text-xs font-mono font-semibold ${
            pnl.realizedPnL > 0 ? 'text-green-400' : 
            pnl.realizedPnL < 0 ? 'text-red-400' : 'text-slate-400'
          }`}>
            {pnl.realizedPnL > 0 && '+'}${formatNumber(Math.abs(pnl.realizedPnL))}
          </span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-xs text-slate-400">Unrealized P&L:</span>
          <span className={`text-xs font-mono font-semibold ${
            pnl.unrealizedPnL > 0 ? 'text-green-400' : 
            pnl.unrealizedPnL < 0 ? 'text-red-400' : 'text-slate-400'
          }`}>
            {pnl.unrealizedPnL > 0 && '+'}${formatNumber(Math.abs(pnl.unrealizedPnL))}
          </span>
        </div>
      </div>
      
      {/* Divider */}
      <div className="h-px bg-slate-700 my-3" />
      
      {/* Total P&L */}
      <div className="flex justify-between gap-8 pt-2">
        <span className="text-xs text-slate-300 font-bold uppercase">Total P&L:</span>
        <div className="flex flex-col items-end">
          <span className={`text-sm font-black font-mono ${
            isProfit ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-slate-400'
          }`}>
            {isProfit && '+'}${formatNumber(Math.abs(pnl.totalPnL))}
          </span>
          <span className={`text-xs font-mono ${
            isProfit ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-slate-400'
          }`}>
            ({isProfit && '+'}{pnl.pnlPercentage.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

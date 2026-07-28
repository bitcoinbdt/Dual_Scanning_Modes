'use client';

import { WalletPnL } from '@/utils/pnlCalculator';

interface PnLIndicatorProps {
  pnl?: WalletPnL | null;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * P&L Indicator Component
 * Displays profit/loss with colored emoji indicators and percentage
 */
export function PnLIndicator({ 
  pnl, 
  showPercentage = true,
  size = 'md'
}: PnLIndicatorProps) {
  // If no P&L data, show neutral state
  if (!pnl) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-slate-500">—</span>
      </div>
    );
  }
  
  const isProfit = pnl.status === 'profit';
  const isLoss = pnl.status === 'loss';
  const isBreakeven = pnl.status === 'breakeven';
  
  // Size classes
  const sizeClasses = {
    sm: {
      emoji: 'text-base',
      amount: 'text-xs',
      percentage: 'text-[10px]'
    },
    md: {
      emoji: 'text-lg',
      amount: 'text-sm',
      percentage: 'text-xs'
    },
    lg: {
      emoji: 'text-xl',
      amount: 'text-base',
      percentage: 'text-sm'
    }
  };
  
  const classes = sizeClasses[size];
  
  // Color classes based on status
  const colorClass = isProfit 
    ? 'text-green-400' 
    : isLoss 
    ? 'text-red-400' 
    : 'text-slate-400';
  
  // Format the P&L amount
  const formatPnL = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `$${(absValue / 1000000).toFixed(2)}M`;
    } else if (absValue >= 1000) {
      return `$${(absValue / 1000).toFixed(2)}K`;
    } else {
      return `$${absValue.toFixed(2)}`;
    }
  };
  
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {/* Emoji indicator */}
        <span className={classes.emoji}>
          {isProfit && '🟢'}
          {isLoss && '🔴'}
          {isBreakeven && '⚪'}
        </span>
        
        {/* Amount */}
        <span className={`${classes.amount} font-bold font-mono ${colorClass}`}>
          {isProfit && '+'}
          {isLoss && '-'}
          {formatPnL(pnl.totalPnL)}
        </span>
      </div>
      
      {/* Percentage */}
      {showPercentage && (
        <span className={`${classes.percentage} font-mono ${colorClass}`}>
          ({isProfit && '+'}{pnl.pnlPercentage.toFixed(1)}%)
        </span>
      )}
    </div>
  );
}

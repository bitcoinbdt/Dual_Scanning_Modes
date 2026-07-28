'use client';

interface ActionBadgeProps {
  action: 'BUY' | 'SELL' | 'TRANSFER';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Action Badge Component
 * Displays BUY/SELL/TRANSFER badges with color coding
 */
export function ActionBadge({ action, size = 'md' }: ActionBadgeProps) {
  // Size classes
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[9px]',
    md: 'px-2 py-1 text-[10px]',
    lg: 'px-3 py-1.5 text-xs'
  };
  
  // Color classes based on action type
  const colorClasses = {
    BUY: 'bg-green-500/20 text-green-400 border-green-500/30',
    SELL: 'bg-red-500/20 text-red-400 border-red-500/30',
    TRANSFER: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  };
  
  return (
    <span
      className={`
        inline-block rounded border font-black uppercase tracking-wider
        ${sizeClasses[size]}
        ${colorClasses[action]}
      `}
    >
      {action}
    </span>
  );
}

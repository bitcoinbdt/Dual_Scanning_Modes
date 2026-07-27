'use client';

import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useCredits } from '@/contexts/CreditContext';

interface CreditBadgeProps {
  onClick?: () => void;
}

export function CreditBadge({ onClick }: CreditBadgeProps) {
  const { balance, getCreditColor, isLowBalance } = useCredits();

  return (
    <motion.button
      onClick={onClick}
      className={`
        glass-card px-4 py-2 rounded-full border border-white/10 
        flex items-center gap-2 transition-all
        hover:scale-105 hover:border-primary-500/50
        ${isLowBalance() ? 'animate-pulse' : ''}
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={`${balance.balance} credits remaining - Click to buy more`}
    >
      <Zap 
        className={`w-4 h-4 ${getCreditColor()}`} 
        fill="currentColor"
      />
      <span className={`text-sm font-black font-mono ${getCreditColor()}`}>
        {balance.balance}
      </span>
    </motion.button>
  );
}

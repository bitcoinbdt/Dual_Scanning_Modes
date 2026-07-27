'use client';

import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import type { OnChainData } from '@/types/scanner';
import { InfoTooltip } from './InfoTooltip';

export const AdvancedRiskMetricsCard = ({ token }: { token: OnChainData }) => {
  // Calculate advanced metrics
  const validTxs = token.recentTransactions?.filter(tx => tx.rawAmount && tx.rawAmount > 0).slice(0, 100) || [];
  
  let interactionFrequency = 0;
  let tokenVelocity = 0;
  let top10HoldersPercentage = 0;

  if (validTxs.length >= 2) {
    const txsWithTime = validTxs.filter(tx => tx.rawTimestamp != null).sort((a,b) => a.rawTimestamp! - b.rawTimestamp!);
    if (txsWithTime.length >= 2) {
       const firstTime = txsWithTime[0].rawTimestamp!;
       const lastTime = txsWithTime[txsWithTime.length - 1].rawTimestamp!;
       const spanSecs = lastTime - firstTime;
       if (spanSecs > 0) {
          interactionFrequency = (txsWithTime.length / spanSecs) * 60;
       }
    }
  }

  const sampleVolume = validTxs.reduce((sum, tx) => sum + (tx.rawAmount || 0), 0);
  if (token.totalSupply > 0) {
     tokenVelocity = (sampleVolume / token.totalSupply) * 100;
  }

  const netBalances: Record<string, number> = {};
  validTxs.forEach(tx => {
     if (tx.rawAmount) {
         netBalances[tx.to] = (netBalances[tx.to] || 0) + tx.rawAmount;
     }
  });
  const holderAmounts = Object.values(netBalances).filter(b => b > 0).sort((a,b) => b - a);
  const totalReceived = holderAmounts.reduce((a,b) => a + b, 0);
  if (totalReceived > 0) {
     const top10Sum = holderAmounts.slice(0, 10).reduce((a,b) => a + b, 0);
     top10HoldersPercentage = (top10Sum / totalReceived) * 100;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-4 md:p-6 rounded-2xl border border-white/10"
    >
      <div className="flex items-center gap-2 mb-4">
        <h4 className="text-xs sm:text-sm font-black uppercase text-slate-300 tracking-widest flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-orange-400"/> Advanced Risk Metrics
        </h4>
        <InfoTooltip text="Deep on-chain analysis to identify potential centralization, unusual trading patterns, and bot activity." />
      </div>
      <div className="grid grid-cols-3 gap-4">
          <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Top 10 Conc.</p>
              <span className={`text-lg md:text-xl font-black font-mono ${top10HoldersPercentage > 50 ? 'text-red-400' : 'text-slate-300'}`}>
                  {top10HoldersPercentage.toFixed(1)}%
              </span>
          </div>
          <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Velocity</p>
              <span className={`text-lg md:text-xl font-black font-mono ${tokenVelocity > 10 ? 'text-red-400' : 'text-slate-300'}`}>
                  {tokenVelocity.toFixed(2)}%
              </span>
          </div>
          <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Tx Frequency</p>
              <span className={`text-lg md:text-xl font-black font-mono ${interactionFrequency > 30 ? 'text-red-400' : 'text-slate-300'}`}>
                  {interactionFrequency.toFixed(1)} /min
              </span>
          </div>
      </div>
    </motion.div>
  );
};

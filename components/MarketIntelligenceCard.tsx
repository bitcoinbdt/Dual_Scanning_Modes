'use client';

import { motion } from 'framer-motion';
import { Database } from 'lucide-react';
import type { OnChainData } from '@/types/scanner';

export const MarketIntelligenceCard = ({ token }: { token: OnChainData }) => {
  if (!token.liquidityInfo) return null;

  const totalMultichainUsd = token.liquidityInfo.totalCrossChainLiquidityUsd ?? token.liquidityInfo.totalLiquidityUsd;
  const poolsToDisplay = (token.liquidityInfo.crossChainPools && token.liquidityInfo.crossChainPools.length > 0)
    ? token.liquidityInfo.crossChainPools
    : token.liquidityInfo.mainPools.map(p => ({ chain: token.network || '', ...p }));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card p-4 md:p-6 rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-900/10 to-slate-900/50"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h4 className="text-xs sm:text-sm font-black uppercase text-primary-400 tracking-widest flex items-center gap-2 mb-1">
            <Database className="w-4 h-4" /> Market Intelligence
          </h4>
          <p className="text-[10px] text-slate-500 font-mono">DEX Aggregation & Multichain Liquidity Probing</p>
        </div>
        
        <div className="bg-primary-500/10 border border-primary-500/20 rounded-lg px-4 py-3 min-w-[160px]">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Total Liquidity</p>
          <div className="flex items-center gap-2">
            <span className="text-lg md:text-xl font-black text-white font-mono">
              ${totalMultichainUsd.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      
      {poolsToDisplay.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {poolsToDisplay.map((pool, idx) => (
            <div key={idx} className="flex justify-between items-center p-4 bg-slate-950/50 rounded-lg border border-white/5 hover:border-primary-500/30 transition-colors group">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-200 font-bold text-sm group-hover:text-primary-400 transition-colors">{pool.pair}</span>
                  {('chain' in pool) && (pool as any).chain && (
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-300 border border-primary-500/20">
                      {(pool as any).chain}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider">{pool.dex}</span>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="text-primary-300 font-bold font-mono text-sm">${pool.liquidityUsd.toLocaleString()}</div>
                {pool.priceUsd ? (
                  <div className="text-[10px] text-slate-400 font-mono">
                    Price: {pool.priceUsd >= 1 
                      ? pool.priceUsd.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4}) 
                      : pool.priceUsd >= 0.0001 
                      ? pool.priceUsd.toFixed(6) 
                      : pool.priceUsd.toFixed(18).replace(/0+$/, '').replace(/\.$/, '')}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm font-mono text-slate-500">
          No active DEX liquidity pools detected.
        </div>
      )}
    </motion.div>
  );
};

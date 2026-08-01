'use client';

import { ArrowUpRight, ArrowDownLeft, Landmark } from 'lucide-react';

interface ExchangeFlowMetrics {
  totalTokensToExchanges: number;
  totalTokensFromExchanges: number;
  netExchangeFlow: number;
}

interface ExchangeFlowCardProps {
  metrics?: ExchangeFlowMetrics;
  tokenSymbol: string;
}

/**
 * Exchange Flow Card Component
 * Summarizes the tokens transferred to and from centralized exchanges (CEX)
 */
export function ExchangeFlowCard({ metrics, tokenSymbol }: ExchangeFlowCardProps) {
  if (!metrics) return null;

  const { totalTokensToExchanges, totalTokensFromExchanges, netExchangeFlow } = metrics;
  
  // Format numbers
  const format = (val: number) => val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  
  const isNetDeposit = netExchangeFlow > 0;

  return (
    <div className="glass-card p-6 rounded-xl border border-white/10 bg-slate-900/5 flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <Landmark className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-black italic uppercase text-slate-200">
          🏦 Centralized Exchange Flow (CEX)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Outflow / Sent to Exchange */}
        <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-950/40 border border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
            Sent to Exchanges (Deposits)
          </div>
          <div className="text-lg font-black text-white font-mono mt-1">
            {format(totalTokensToExchanges)}
          </div>
          <div className="text-[9px] text-slate-500">{tokenSymbol}</div>
        </div>

        {/* Inflow / Withdrawn from Exchange */}
        <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-950/40 border border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
            Withdrawn from Exchanges (Withdrawals)
          </div>
          <div className="text-lg font-black text-white font-mono mt-1">
            {format(totalTokensFromExchanges)}
          </div>
          <div className="text-[9px] text-slate-500">{tokenSymbol}</div>
        </div>

        {/* Net Flow */}
        <div className={`flex flex-col gap-1 p-3 rounded-lg bg-slate-950/40 border ${isNetDeposit ? 'border-rose-500/20' : 'border-green-500/20'}`}>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <Landmark className="w-3.5 h-3.5 text-blue-400" />
            Net Exchange Flow
          </div>
          <div className={`text-lg font-black font-mono mt-1 flex items-center gap-1.5 ${isNetDeposit ? 'text-rose-400' : 'text-green-400'}`}>
            {netExchangeFlow >= 0 ? '+' : ''}{format(netExchangeFlow)}
            {isNetDeposit ? (
              <span className="text-[9px] bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                Sell Pressure
              </span>
            ) : (
              <span className="text-[9px] bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                Buy Pressure
              </span>
            )}
          </div>
          <div className="text-[9px] text-slate-500">{tokenSymbol}</div>
        </div>
      </div>
      <p className="text-[9px] text-slate-500 italic mt-1 border-t border-white/5 pt-2">
        * Monitoring of known major exchange deposit, hot wallet, and intermediary accounts. Direct deposit addresses may not be fully detected.
      </p>
    </div>
  );
}

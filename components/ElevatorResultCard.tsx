'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Flame, Droplet, Users, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { RecentTransactionsCard } from './RecentTransactionsCard';

export const ElevatorResultCard = ({ data }: { data: any }) => {
  const mb = data.marketBehavior || { totalBuyVolume: 0, totalSellVolume: 0, netFlow: 0, transactionCount: 0 };
  const netFlowColor = mb.netFlow > 0 ? 'text-green-400' : mb.netFlow < 0 ? 'text-red-400' : 'text-slate-400';
  const adv = data.advancedAnalytics || {};

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'Smart Money': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'MEV Bot': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Whale': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Sniper': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Fresh Wallet': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const renderTraderList = (title: string, traders: any[], color: 'green' | 'red') => (
    <div className="bg-slate-950/60 rounded-xl p-5 border border-white/5 shadow-inner">
      <h4 className={`text-sm font-black uppercase mb-4 flex items-center gap-2 border-b border-white/5 pb-3 text-${color}-400`}>
        {title}
      </h4>
      <div className="space-y-4">
        {traders?.map((trader: any, idx: number) => (
          <div key={idx} className="relative group">
            <div className="flex flex-col gap-2 relative z-10 p-3 rounded-lg border border-white/5 bg-slate-900/50 hover:bg-slate-800/80 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-slate-300 font-mono tracking-wider">{trader.wallet}</code>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-bold ${getTagColor(trader.tag)}`}>
                      {trader.tag || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-slate-400">WR:</span>
                    <span className={trader.winRate > 60 ? 'text-green-400 font-bold' : trader.winRate < 50 ? 'text-red-400' : 'text-yellow-400'}>
                      {trader.winRate || '--'}%
                    </span>
                  </div>
                </div>
                <span className={`text-sm font-black text-${color}-400 font-mono`}>
                  {trader.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className={`h-full rounded-full bg-${color}-500 shadow-[0_0_10px_rgba(var(--color-${color}-500),0.5)]`} 
                  style={{ width: `${Math.min(100, Math.max(1, trader.percentage || 0))}%` }} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Threat Intelligence Bar */}
      {adv.insiderThreat && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border flex items-center gap-4 ${adv.insiderThreat.warning ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900 border-white/10'}`}>
             <div className={`p-3 rounded-full ${adv.insiderThreat.warning ? 'bg-red-500/20 text-red-500' : 'bg-slate-800 text-slate-400'}`}>
                <AlertTriangle className="w-6 h-6" />
             </div>
             <div>
               <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Block-0 Snipers</p>
               <h4 className={`text-lg font-black ${adv.insiderThreat.warning ? 'text-red-400' : 'text-slate-200'}`}>
                 {adv.insiderThreat.activeSnipers} Detected
               </h4>
               <p className="text-xs font-mono text-slate-500 mt-1">Status: {adv.insiderThreat.isDumping ? 'Actively Dumping' : 'Holding/Accumulating'}</p>
             </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center gap-4 ${adv.creatorFunding?.riskLevel === 'Critical' ? 'bg-red-500/10 border-red-500/30' : adv.creatorFunding?.riskLevel === 'High' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-slate-900 border-white/10'}`}>
             <div className={`p-3 rounded-full ${adv.creatorFunding?.riskLevel === 'Critical' ? 'bg-red-500/20 text-red-500' : 'bg-slate-800 text-slate-400'}`}>
                <Flame className="w-6 h-6" />
             </div>
             <div>
               <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Creator Funding Source</p>
               <h4 className="text-sm font-mono text-slate-300 truncate w-48">{adv.creatorFunding?.fundedBy}</h4>
               <p className={`text-xs font-bold mt-1 ${adv.creatorFunding?.pastRugCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                 Past Rugs: {adv.creatorFunding?.pastRugCount} ({adv.creatorFunding?.riskLevel} Risk)
               </p>
             </div>
          </div>
        </motion.div>
      )}

      {/* Advanced Analytics Grid */}
      {adv.washTrading && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 rounded-xl border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-2"><Droplet className="w-4 h-4"/> Wash Trading</span>
              <span className={`text-xs font-bold font-mono ${adv.washTrading.artificialPercentage > 20 ? 'text-red-400' : 'text-green-400'}`}>{adv.washTrading.artificialPercentage}% Artificial</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/5">
              <div className={`h-full rounded-full ${adv.washTrading.artificialPercentage > 20 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${adv.washTrading.artificialPercentage}%` }} />
            </div>
          </div>
          
          <div className="glass-card p-5 rounded-xl border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-2"><Users className="w-4 h-4"/> Gini (Inequality)</span>
              <span className="text-xs font-bold font-mono text-yellow-400">{adv.giniCoefficient?.score.toFixed(2)}</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/5 relative">
              <div className="absolute top-0 left-1/2 w-px h-full bg-slate-500 z-10" />
              <div className="h-full rounded-full bg-yellow-500" style={{ width: `${(adv.giniCoefficient?.score || 0) * 100}%` }} />
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-white/10 flex flex-col justify-center">
            <span className="text-xs font-black uppercase text-slate-400 mb-1">Holding Velocity</span>
            <span className="text-lg font-black text-blue-400 tracking-tight">{adv.holdingVelocity?.classification}</span>
            <span className="text-[10px] font-mono text-slate-500 mt-1">Avg Hold: {adv.holdingVelocity?.averageHoldTimeSeconds}s</span>
          </div>
        </motion.div>
      )}

      {/* Heatmap & Macro Overview */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-900/10 to-slate-900/50">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xl font-black italic uppercase text-blue-400 mb-6 flex items-center gap-2"><Activity className="w-5 h-5"/> Elevator Analysis</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Scanned TXs</p>
                <div className="text-xl font-black text-white font-mono">{mb.transactionCount}</div>
              </div>
              <div className={`bg-slate-950/50 p-4 rounded-xl border ${mb.netFlow > 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Net Flow</p>
                <div className={`text-xl font-black font-mono ${netFlowColor}`}>
                  {mb.netFlow > 0 ? '+' : ''}{mb.netFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Buy Volume</p>
                <div className="text-lg font-black text-green-400 font-mono">{mb.totalBuyVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Sell Volume</p>
                <div className="text-lg font-black text-red-400 font-mono">{mb.totalSellVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-black uppercase text-slate-400">Momentum Heatmap (Net Flow)</h4>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest border border-slate-700 px-2 py-1 rounded bg-slate-900">Recent 15 Intervals</span>
            </div>
            {adv.momentumHeatmap && (
              <div className="h-48 w-full bg-slate-950/30 rounded-xl p-4 border border-white/5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={adv.momentumHeatmap} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <RechartsTooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl shadow-black/50">
                              <p className="text-[10px] text-slate-400 font-mono mb-2">Time: {label}</p>
                              <p className="text-xs font-bold text-green-400 font-mono">Buy: {Math.floor(data.buy).toLocaleString()}</p>
                              <p className="text-xs font-bold text-red-400 font-mono">Sell: {Math.floor(Math.abs(data.sell)).toLocaleString()}</p>
                              <div className="h-px w-full bg-slate-700 my-2" />
                              <p className={`text-xs font-black font-mono ${data.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                Net: {data.net >= 0 ? '+' : ''}{Math.floor(data.net).toLocaleString()}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="net" radius={[4, 4, 4, 4]}>
                      {adv.momentumHeatmap.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderTraderList('Top 5 Accumulators', data.topBuyers, 'green')}
        {renderTraderList('Top 6 Distributors', data.topSellers, 'red')}
      </motion.div>

      <RecentTransactionsCard token={{ symbol: 'TOKEN', recentTransactions: data.recentTransactions } as any} />
    </div>
  );
};

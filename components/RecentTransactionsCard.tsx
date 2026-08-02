'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowUpRight } from 'lucide-react';
import type { OnChainData } from '@/types/scanner';

export const RecentTransactionsCard = ({ token }: { token: OnChainData }) => {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'TRANSFER'>('ALL');

  if (!token.recentTransactions || token.recentTransactions.length === 0) {
    return null;
  }

  const transactions = token.recentTransactions;

  const filteredTransactions = selectedFilter === 'ALL' 
    ? transactions 
    : transactions.filter(tx => tx.type?.toUpperCase() === selectedFilter);

  const filters = [
    { id: 'ALL', label: 'ALL' },
    { id: 'BUY', label: 'BUY' },
    { id: 'SELL', label: 'SELL' },
    { id: 'TRANSFER', label: 'TRANSFER' }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="w-full"
    >
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          <h4 className="text-sm font-black uppercase text-slate-300 tracking-widest italic">
            Recent Recon Packets
          </h4>
        </div>
        
        <div className="flex gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedFilter === filter.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-auto scrollbar-thin">
        <div className="min-w-[800px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider p-3 bg-slate-950">
                  TX Hash
                </th>
                <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider p-3 bg-slate-950 border-l border-white/10">
                  Type
                </th>
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider p-3 bg-slate-950 border-l border-white/10">
                  Origin
                </th>
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider p-3 bg-slate-950 border-l border-white/10">
                  Destination
                </th>
                <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider p-3 bg-slate-950 border-l border-white/10">
                  Amount/Size
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.slice(0, 10).map((tx, idx) => (
                <tr 
                  key={idx}
                  className="group border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="p-3 bg-slate-950 group-hover:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-primary-400 font-mono">{tx.hash}</code>
                      <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-primary-400 transition-colors" />
                    </div>
                  </td>
                  
                  <td className="p-3 bg-slate-950 group-hover:bg-slate-900 text-center border-l border-white/10">
                    <span className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase ${
                      tx.type === 'Buy' ? 'bg-green-500/20 text-green-400' :
                      tx.type === 'Sell' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {tx.type || 'TX'}
                    </span>
                  </td>
                  
                  <td className="p-3 bg-slate-950 group-hover:bg-slate-900 border-l border-white/10">
                    <code className="text-xs text-slate-400 font-mono">{tx.from}</code>
                  </td>
                  
                  <td className="p-3 bg-slate-950 group-hover:bg-slate-900 border-l border-white/10">
                    <code className="text-xs text-slate-400 font-mono">{tx.to}</code>
                  </td>
                  
                  <td className="p-3 bg-slate-950 group-hover:bg-slate-900 text-right border-l border-white/10">
                    <div>
                      <div className="text-sm font-bold text-white">
                        {parseFloat(tx.amount).toLocaleString()} {tx.tokenSymbol || token.symbol}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{tx.timestamp}</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      {filteredTransactions.length > 10 && (
        <div className="mt-4 text-center text-xs text-slate-500">
          Showing 10 of {filteredTransactions.length} transactions
        </div>
      )}
    </motion.div>
  );
};

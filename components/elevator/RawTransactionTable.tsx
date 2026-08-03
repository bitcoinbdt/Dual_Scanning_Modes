'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Database, RefreshCw } from 'lucide-react';
import { 
  fetchCurrentPriceFromDexScreener,
  RawTransaction,
  HolderInfo,
  OHLCVCandle
} from '@/utils/pnlCalculator';
import { WalletCell } from './WalletCell';
import { ActionBadge } from './ActionBadge';
import { TxHashLink } from './TxHashLink';
import { HolderGrowthChart } from './HolderGrowthChart';
import { ExchangeFlowCard } from './ExchangeFlowCard';
import { VerificationBadge } from './VerificationBadge';

interface RawTransactionTableProps {
  rawData: {
    transactions: any[];
    holders: HolderInfo[];
    ohlcv: OHLCVCandle[];
    blockchain?: 'solana' | 'bsc' | 'eth';
    holder_spike?: boolean;
    spike_percentage?: number;
    new_holders_24h?: number;
    total_holders_before_24h?: number;
    top_holders_filtered?: HolderInfo[];
    holder_growth?: Array<{ timestamp: number, holders: number }>;
    exchange_flow?: {
      totalTokensToExchanges: number;
      totalTokensFromExchanges: number;
      netExchangeFlow: number;
    };
    trust_score?: any;
    wash_trading?: {
      detected: boolean;
      total_wash_wallets: number;
      total_round_trips: number;
      wash_wallets: string[];
    };
  };
  tokenSymbol: string;
  tokenAddress: string;
  network?: 'solana' | 'ethereum' | 'bsc' | 'polygon';
}

// Flattened transaction for table display
interface FlatTransaction {
  timestamp: number;
  signature?: string;
  wallet: string;
  action: 'BUY' | 'SELL' | 'TRANSFER';
  amount: number;
  from: string;
  to: string;
  toExchange?: boolean;
  fromExchange?: boolean;
  exchangeName?: string;
  isWashTrader?: boolean;
  roundTrips?: number;
}

type FilterType = 'ALL' | 'BUY' | 'SELL';
type SortBy = 'time' | 'amount';
type SortOrder = 'asc' | 'desc';

/**
 * Raw Transaction Table Component
 * Displays all transactions with Current Price column instead of P&L
 */
export function RawTransactionTable({ 
  rawData, 
  tokenSymbol, 
  tokenAddress,
  network = 'solana'
}: RawTransactionTableProps) {
  // Detect actual blockchain from data
  const detectedChain = rawData.blockchain || network;
  
  const getChainInfo = (chain: string) => {
    switch(chain) {
      case 'solana':
        return { name: 'Solana', color: 'text-green-400', bgColor: 'bg-green-400/10', emoji: '🟢' };
      case 'bsc':
        return { name: 'BSC', color: 'text-yellow-400', bgColor: 'bg-yellow-400/10', emoji: '🟡' };
      case 'eth':
      case 'ethereum':
        return { name: 'Ethereum', color: 'text-blue-400', bgColor: 'bg-blue-400/10', emoji: '🔵' };
      default:
        return { name: 'Unknown', color: 'text-slate-400', bgColor: 'bg-slate-400/10', emoji: '⚪' };
    }
  };
  
  const chainInfo = getChainInfo(detectedChain);
  
  // State
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceLoading, setPriceLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  
  const itemsPerPage = 50;
  
  // Fetch current price on mount
  useEffect(() => {
    const fetchPrice = async () => {
      setPriceLoading(true);
      try {
        const price = await fetchCurrentPriceFromDexScreener(tokenAddress);
        setCurrentPrice(price);
      } catch (error) {
        console.error('Failed to fetch price:', error);
      } finally {
        setPriceLoading(false);
      }
    };
    
    fetchPrice();
  }, [tokenAddress]);
  
  // Normalize transactions
  const normalizedTransactions = useMemo<RawTransaction[]>(() => {
    const txList = rawData?.transactions ?? [];
    return txList.map(tx => {
      if (tx && 'transfers' in tx) {
        return tx as unknown as RawTransaction;
      }
      
      const utx = tx as any;
      return {
        timestamp: utx.timestamp,
        signature: utx.hash || utx.signature,
        wallets: [utx.from, utx.to].filter(Boolean),
        isTrade: utx.isTrade,
        priceUsd: utx.priceUsd,
        toExchange: utx.toExchange,
        fromExchange: utx.fromExchange,
        exchangeName: utx.exchangeName,
        transfers: [
          {
            from: utx.from,
            to: utx.to,
            amount: utx.amount,
            type: 'token',
            mint: utx.token?.address || ''
          }
        ]
      } as RawTransaction;
    });
  }, [rawData?.transactions]);
  
  // Flatten transactions into individual rows
  const flatTransactions = useMemo<FlatTransaction[]>(() => {
    const flat: FlatTransaction[] = [];
    const txList = normalizedTransactions;
    
    txList.forEach(tx => {
      const transfers = tx?.transfers ?? [];
      const isTrade = (tx as any).isTrade !== false;
      const toExchange = (tx as any).toExchange;
      const fromExchange = (tx as any).fromExchange;
      const exchangeName = (tx as any).exchangeName;
      const isWashTrader = (tx as any).isWashTrader;
      const roundTrips = (tx as any).roundTrips;
      
      transfers.forEach(transfer => {
        if (!isTrade) {
          if (transfer.to) {
            flat.push({
              timestamp: tx.timestamp,
              signature: tx.signature,
              wallet: transfer.to,
              action: 'TRANSFER',
              amount: transfer.amount,
              from: transfer.from,
              to: transfer.to,
              toExchange,
              fromExchange,
              exchangeName,
              isWashTrader,
              roundTrips
            });
          }
          if (transfer.from && transfer.from !== transfer.to) {
            flat.push({
              timestamp: tx.timestamp,
              signature: tx.signature,
              wallet: transfer.from,
              action: 'TRANSFER',
              amount: transfer.amount,
              from: transfer.from,
              to: transfer.to,
              toExchange,
              fromExchange,
              exchangeName,
              isWashTrader,
              roundTrips
            });
          }
        } else {
          // Add entry for receiver (BUY)
          if (transfer.to) {
            flat.push({
              timestamp: tx.timestamp,
              signature: tx.signature,
              wallet: transfer.to,
              action: 'BUY',
              amount: transfer.amount,
              from: transfer.from,
              to: transfer.to,
              toExchange,
              fromExchange,
              exchangeName,
              isWashTrader,
              roundTrips
            });
          }
          
          // Add entry for sender (SELL)
          if (transfer.from && transfer.from !== transfer.to) {
            flat.push({
              timestamp: tx.timestamp,
              signature: tx.signature,
              wallet: transfer.from,
              action: 'SELL',
              amount: transfer.amount,
              from: transfer.from,
              to: transfer.to,
              toExchange,
              fromExchange,
              exchangeName,
              isWashTrader,
              roundTrips
            });
          }
        }
      });
    });
    
    return flat;
  }, [normalizedTransactions]);
  
  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = flatTransactions;
    
    if (filter === 'BUY') {
      filtered = filtered.filter(tx => tx.action === 'BUY');
    } else if (filter === 'SELL') {
      filtered = filtered.filter(tx => tx.action === 'SELL');
    }
    
    return filtered;
  }, [flatTransactions, filter]);
  
  // Sort transactions
  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'time') {
        comparison = a.timestamp - b.timestamp;
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredTransactions, sortBy, sortOrder]);
  
  // Paginate
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedTransactions.slice(start, end);
  }, [sortedTransactions, page]);
  
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  
  // Format time
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - (timestamp * 1000);
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return new Date(timestamp * 1000).toLocaleDateString();
  };
  
  // Toggle sort
  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };
  
  // Get unique wallets count
  const uniqueWalletsCount = useMemo(() => {
    return new Set(flatTransactions.map(tx => tx.wallet)).size;
  }, [flatTransactions]);
  
  // Helper to format price values
  const formatPrice = (value: number) => {
    if (value === 0) return '$0.00';
    if (value < 0.000001) return `$${value.toExponential(2)}`;
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Network & Summary Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass-card rounded-xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-sm">{chainInfo.emoji}</span>
            <span className="text-xs font-bold text-slate-300">Chain:</span>
            <span className={`text-xs font-extrabold uppercase ${chainInfo.color}`}>
              {chainInfo.name}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-300">Scanned Batch:</span>
            <span className="text-xs font-extrabold text-white">
              {normalizedTransactions.length} Transactions
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-xs font-bold text-slate-300">Unique Wallets:</span>
            <span className="text-xs font-extrabold text-white">
              {uniqueWalletsCount}
            </span>
          </div>
        </div>
        
        {/* Verification System (Feature 12) */}
        <VerificationBadge trustScore={rawData.trust_score} />
      </div>

      {/* Exchange Flows (Feature 10) */}
      <ExchangeFlowCard metrics={rawData.exchange_flow} tokenSymbol={tokenSymbol} />

      {/* Wash Trading Banner (Feature 14) */}
      {rawData.wash_trading && rawData.wash_trading.detected && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 animate-pulse-glow">
          <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-400 uppercase tracking-wider">Wash Trading Behavior Flagged</h4>
            <p className="text-xs text-slate-300 mt-1">
              Elevator Scan flagged <span className="font-bold text-white font-mono bg-rose-500/20 px-1.5 py-0.5 rounded">{rawData.wash_trading.total_wash_wallets}</span> wash trading wallet{rawData.wash_trading.total_wash_wallets !== 1 ? 's' : ''} performing <span className="font-bold text-white font-mono bg-rose-500/20 px-1.5 py-0.5 rounded">{rawData.wash_trading.total_round_trips}</span> round-trips in this batch.
            </p>
          </div>
        </div>
      )}
      
      {/* Main layout grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Transaction list, filters, table, pagination (span 2) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters and Sorting */}
          <div className="glass-card p-4 rounded-xl border border-white/10">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                {(['ALL', 'BUY', 'SELL'] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setFilter(f);
                      setPage(1);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      filter === f
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              
              {/* Sort and controls */}
              <div className="flex gap-4 items-center flex-wrap">
                {/* Sort Dropdown */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => handleSort(e.target.value as SortBy)}
                    className="bg-slate-900 text-slate-300 text-xs px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  >
                    <option value="time">Time</option>
                    <option value="amount">Amount</option>
                  </select>
                </div>
                
                {/* Sort Order Toggle Button */}
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  {sortOrder === 'asc' ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Table */}
          <div className="glass-card rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-950">
                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider p-4">
                      Time
                    </th>
                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider p-4">
                      Wallet
                    </th>
                    <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider p-4">
                      Action
                    </th>
                    <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider p-4">
                      Amount
                    </th>
                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider p-4">
                      Tx Hash
                    </th>
                    <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider p-4">
                      Current Price
                    </th>
                  </tr>
                </thead>
                
                <tbody>
                  {paginatedTransactions.map((tx, idx) => {
                    return (
                      <tr
                        key={`${tx.signature}-${tx.wallet}-${idx}`}
                        className="group border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        {/* Time */}
                        <td className="p-4">
                          <span className="text-xs text-slate-400 font-mono">
                            {formatTime(tx.timestamp)}
                          </span>
                        </td>
                        
                        {/* Wallet */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <WalletCell wallet={tx.wallet} />
                            {tx.isWashTrader && (
                              <span 
                                title={`Wash Trader: ${tx.roundTrips} buy-sell round-trips within this batch.`}
                                className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20 flex items-center gap-1 cursor-help select-none"
                              >
                                Wash Trader 🔄
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* Action */}
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <ActionBadge action={tx.action} />
                            {tx.exchangeName && (
                              <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1 py-0.5 rounded font-black tracking-wider uppercase flex items-center gap-0.5 animate-pulse">
                                🏦 {tx.exchangeName}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* Amount */}
                        <td className="p-4 text-right">
                          <div>
                            <div className="text-sm font-bold text-white">
                              {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-slate-500">
                              {tokenSymbol}
                            </div>
                          </div>
                        </td>
                        
                        {/* Tx Hash */}
                        <td className="p-4">
                          <TxHashLink hash={tx.signature} network={detectedChain as 'solana' | 'ethereum' | 'bsc'} />
                        </td>
                        
                        {/* Current Price */}
                        <td className="p-4 text-right font-mono text-xs text-white font-bold">
                          {priceLoading ? (
                            <span className="text-slate-500">Loading...</span>
                          ) : (
                            formatPrice(currentPrice)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 glass-card rounded-xl border border-white/10">
              <div className="text-xs text-slate-400">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, sortedTransactions.length)} of {sortedTransactions.length} transactions
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-slate-900 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-lg">
                  <span className="text-xs text-slate-400">Page</span>
                  <span className="text-xs text-white font-bold">{page}</span>
                  <span className="text-xs text-slate-400">of {totalPages}</span>
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-slate-900 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          
          {/* Holder Growth Chart Component */}
          <HolderGrowthChart 
            growthData={rawData.holder_growth} 
            holderSpike={rawData.holder_spike} 
          />
        </div>

        {/* Right Column: Top Holders */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card p-6 rounded-xl border border-white/10 bg-slate-900/10 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
              <span className="text-sm font-black italic uppercase text-slate-200">
                👥 Top 10 Wallets (Filtered)
              </span>
            </div>
            
            <div className="space-y-3 flex-grow overflow-y-auto max-h-[600px] pr-1">
              {(!rawData.top_holders_filtered || rawData.top_holders_filtered.length === 0) ? (
                <p className="text-xs text-slate-500 italic">No holders data available or all filtered.</p>
              ) : (
                rawData.top_holders_filtered.slice(0, 10).map((holder, idx) => (
                  <div 
                    key={holder.wallet} 
                    className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-slate-950/40 hover:bg-white/5 transition-all"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-500 font-mono">#{idx + 1}</span>
                        <WalletCell wallet={holder.wallet} />
                        {rawData.wash_trading?.wash_wallets?.includes(holder.wallet) && (
                          <span 
                            title="Wash Trader: this wallet has both bought and sold within the scanned batch."
                            className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20 flex items-center gap-1 cursor-help select-none"
                          >
                            Wash Trader 🔄
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {holder.tx_count} transaction{holder.tx_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-white font-mono">
                        {holder.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {tokenSymbol}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

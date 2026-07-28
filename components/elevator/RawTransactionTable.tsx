'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Database, TrendingUp, TrendingDown } from 'lucide-react';
import { 
  fetchCurrentPriceFromDexScreener,
  calculateAllWalletPnL,
  RawTransaction,
  HolderInfo,
  OHLCVCandle,
  WalletPnL
} from '@/utils/pnlCalculator';
import { WalletCell } from './WalletCell';
import { PnLIndicator } from './PnLIndicator';
import { PnLTooltip } from './PnLTooltip';
import { ActionBadge } from './ActionBadge';
import { TxHashLink } from './TxHashLink';

interface RawTransactionTableProps {
  rawData: {
    transactions: RawTransaction[];
    holders: HolderInfo[];
    ohlcv: OHLCVCandle[];
    blockchain?: 'solana' | 'bsc' | 'eth';
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
}

type FilterType = 'ALL' | 'BUY' | 'SELL' | 'PROFIT' | 'LOSS';
type SortBy = 'time' | 'amount' | 'pnl';
type SortOrder = 'asc' | 'desc';

/**
 * Raw Transaction Table Component
 * Main table displaying all transactions with P&L indicators
 */
export function RawTransactionTable({ 
  rawData, 
  tokenSymbol, 
  tokenAddress,
  network = 'solana'
}: RawTransactionTableProps) {
  // Detect actual blockchain from data (prefer rawData.blockchain over network prop)
  const detectedChain = rawData.blockchain || network;
  
  // Chain display info
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
  const [hoveredWallet, setHoveredWallet] = useState<string | null>(null);
  
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
  
  // Flatten transactions into individual rows
  const flatTransactions = useMemo<FlatTransaction[]>(() => {
    const flat: FlatTransaction[] = [];
    
    rawData.transactions.forEach(tx => {
      tx.transfers.forEach(transfer => {
        // Determine action based on transfer direction
        // This is simplified - for BUY, the wallet receives tokens
        const action: 'BUY' | 'SELL' | 'TRANSFER' = 
          transfer.from && transfer.to ? 'TRANSFER' : 'TRANSFER';
        
        // Add entry for receiver (BUY)
        if (transfer.to) {
          flat.push({
            timestamp: tx.timestamp,
            signature: tx.signature,
            wallet: transfer.to,
            action: 'BUY',
            amount: transfer.amount,
            from: transfer.from,
            to: transfer.to
          });
        }
        
        // Add entry for sender (SELL) - only if different from receiver
        if (transfer.from && transfer.from !== transfer.to) {
          flat.push({
            timestamp: tx.timestamp,
            signature: tx.signature,
            wallet: transfer.from,
            action: 'SELL',
            amount: transfer.amount,
            from: transfer.from,
            to: transfer.to
          });
        }
      });
    });
    
    return flat;
  }, [rawData.transactions]);
  
  // Calculate P&L for all wallets
  const walletPnL = useMemo<Map<string, WalletPnL>>(() => {
    if (currentPrice === 0) return new Map();
    
    return calculateAllWalletPnL(
      rawData.transactions,
      rawData.holders,
      rawData.ohlcv,
      currentPrice
    );
  }, [rawData, currentPrice]);
  
  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = flatTransactions;
    
    if (filter === 'BUY') {
      filtered = filtered.filter(tx => tx.action === 'BUY');
    } else if (filter === 'SELL') {
      filtered = filtered.filter(tx => tx.action === 'SELL');
    } else if (filter === 'PROFIT') {
      filtered = filtered.filter(tx => {
        const pnl = walletPnL.get(tx.wallet);
        return pnl && pnl.status === 'profit';
      });
    } else if (filter === 'LOSS') {
      filtered = filtered.filter(tx => {
        const pnl = walletPnL.get(tx.wallet);
        return pnl && pnl.status === 'loss';
      });
    }
    
    return filtered;
  }, [flatTransactions, filter, walletPnL]);
  
  // Sort transactions
  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'time') {
        comparison = a.timestamp - b.timestamp;
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortBy === 'pnl') {
        const pnlA = walletPnL.get(a.wallet);
        const pnlB = walletPnL.get(b.wallet);
        comparison = (pnlA?.totalPnL || 0) - (pnlB?.totalPnL || 0);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredTransactions, sortBy, sortOrder, walletPnL]);
  
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
    const diff = now - (timestamp * 1000); // Convert to ms
    
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
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header with Stats */}
      <div className="glass-card p-6 rounded-2xl border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-primary-400" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black italic uppercase text-slate-200">
                  Raw Transaction Data
                </h3>
                {/* Chain Badge */}
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${chainInfo.bgColor} ${chainInfo.color} border border-current/20`}>
                  {chainInfo.emoji} {chainInfo.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Complete on-chain activity with real-time P&L
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">Total TXs</span>
              <span className="text-lg font-black text-white font-mono">
                {flatTransactions.length.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">Unique Wallets</span>
              <span className="text-lg font-black text-white font-mono">
                {uniqueWalletsCount.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">Current Price</span>
              <span className="text-lg font-black text-primary-400 font-mono">
                {priceLoading ? '...' : `$${currentPrice.toFixed(8)}`}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters and Sorting */}
      <div className="glass-card p-4 rounded-xl border border-white/10">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'BUY', 'SELL', 'PROFIT', 'LOSS'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setPage(1); // Reset to first page
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  filter === f
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {f === 'PROFIT' && <TrendingUp className="w-3 h-3 inline mr-1" />}
                {f === 'LOSS' && <TrendingDown className="w-3 h-3 inline mr-1" />}
                {f}
              </button>
            ))}
          </div>
          
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
              <option value="pnl">P&L</option>
            </select>
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
                  P&L
                </th>
              </tr>
            </thead>
            
            <tbody>
              {paginatedTransactions.map((tx, idx) => {
                const pnl = walletPnL.get(tx.wallet);
                const isHovered = hoveredWallet === tx.wallet;
                
                return (
                  <tr
                    key={`${tx.signature}-${tx.wallet}-${idx}`}
                    className="group border-b border-white/5 hover:bg-white/5 transition-colors"
                    onMouseEnter={() => setHoveredWallet(tx.wallet)}
                    onMouseLeave={() => setHoveredWallet(null)}
                  >
                    {/* Time */}
                    <td className="p-4">
                      <span className="text-xs text-slate-400 font-mono">
                        {formatTime(tx.timestamp)}
                      </span>
                    </td>
                    
                    {/* Wallet */}
                    <td className="p-4">
                      <WalletCell wallet={tx.wallet} />
                    </td>
                    
                    {/* Action */}
                    <td className="p-4 text-center">
                      <ActionBadge action={tx.action} />
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
                    
                    {/* P&L */}
                    <td className="p-4 text-right relative">
                      <div className="relative">
                        <PnLIndicator pnl={pnl} />
                        
                        {/* Tooltip on hover */}
                        {isHovered && pnl && (
                          <div className="absolute right-0 top-full mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <PnLTooltip pnl={pnl} />
                          </div>
                        )}
                      </div>
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
    </motion.div>
  );
}

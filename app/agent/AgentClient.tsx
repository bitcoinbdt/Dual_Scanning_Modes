'use client';

import { useState, useCallback } from 'react';
import Navigation from '@/components/layout/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditContext';
import AuthModal from '@/components/AuthModal';
import { InsufficientCreditsModal } from '@/components/credits/InsufficientCreditsModal';
import { CreditStoreModal } from '@/components/credits/CreditStoreModal';
import toast from 'react-hot-toast';
import {
  Rocket,
  Copy,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Loader2,
  Search,
  Lock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentToken {
  chainId: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  price: string;
  priceChange24h: number;
  marketCap: number;
  liquidity: number;
  dexId: string;
}

// ─── Chain helpers ────────────────────────────────────────────────────────────
const CHAIN_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ethereum:  { bg: 'bg-blue-500/20',   text: 'text-blue-400',   label: 'Ethereum'  },
  solana:    { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Solana'    },
  bsc:       { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'BSC'       },
  base:      { bg: 'bg-sky-500/20',    text: 'text-sky-400',    label: 'Base'      },
  arbitrum:  { bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   label: 'Arbitrum'  },
  polygon:   { bg: 'bg-violet-500/20', text: 'text-violet-400', label: 'Polygon'   },
  avalanche: { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'Avalanche' },
  tron:      { bg: 'bg-rose-500/20',   text: 'text-rose-400',   label: 'Tron'      },
  sui:       { bg: 'bg-teal-500/20',   text: 'text-teal-400',   label: 'Sui'       },
  optimism:  { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Optimism'  },
  fantom:    { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Fantom'    },
};

const getChain = (id: string) =>
  CHAIN_COLORS[id?.toLowerCase()] ?? {
    bg: 'bg-slate-500/20',
    text: 'text-slate-400',
    label: id ?? 'Unknown',
  };

// ─── Utils ────────────────────────────────────────────────────────────────────
function shortAddr(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}

function formatPrice(p: string): string {
  const n = parseFloat(p);
  if (isNaN(n)) return '—';
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  if (n < 1000) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function isLiqLocked(token: AgentToken): boolean {
  const hash = token.tokenAddress.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 3 !== 0;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AgentClient() {
  const { isAuthenticated, sessionLoading } = useAuth();
  const { deductCredits, refreshBalance, hasEnoughCredits, balance } = useCredits();
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const [showCreditStore, setShowCreditStore] = useState(false);

  const runAgent = useCallback(async () => {
    if (!hasEnoughCredits(5)) {
      setShowInsufficientCredits(true);
      return;
    }

    setScanning(true);
    setError('');
    setProgress(0);
    setTokens([]);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 1, 9));
    }, 180);

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      
      if (res.status === 402) {
        setShowInsufficientCredits(true);
        throw new Error('Insufficient credits');
      }
      
      if (!res.ok) throw new Error(`Agent failed (${res.status})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Deduct locally and refresh balance
      deductCredits(5);
      refreshBalance();
      
      clearInterval(interval);
      setProgress(10);
      setTokens(data.tokens || []);
      setLastScan(new Date().toLocaleTimeString());
      toast.success('Agent completed successfully! 5 credits deducted.');
    } catch (err: any) {
      clearInterval(interval);
      const msg = err instanceof Error ? err.message : 'Agent failed';
      if (msg !== 'Insufficient credits') {
        setError(msg);
      }
    } finally {
      setScanning(false);
    }
  }, [hasEnoughCredits, deductCredits, refreshBalance]);

  const copy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  };

  // Show loading spinner while auth state resolves
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-themed animate-spin" />
      </div>
    );
  }

  // Auth gate — block access if not logged in
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-grid">
        <Navigation onOpenCreditStore={() => {}} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-16 flex items-center justify-center min-h-[80vh]">
          <div className="glass-strong rounded-2xl p-10 text-center max-w-md w-full rgb-border animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full gradient-primary flex items-center justify-center glow-primary">
              <Lock className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-2xl font-bold gradient-text mb-2">Sign In Required</h2>
            <p className="text-muted-themed text-sm mb-6">
              The Crypto Hype Agent is available to registered users only. Sign in or create a free account to access real-time token discovery.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full gradient-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition glow-primary flex items-center justify-center gap-2"
            >
              <Rocket className="w-5 h-5" /> Sign In to Continue
            </button>
            <p className="text-xs text-muted-themed mt-4">
              No account?{' '}
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-primary-themed hover:underline font-semibold"
              >
                Create one for free
              </button>
            </p>
          </div>
        </div>
        {showAuthModal && (
          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} defaultMode="login" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <Navigation onOpenCreditStore={() => {}} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-8 sm:pb-16">
        {/* Control Panel */}
        <div className="glass-strong rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 rgb-border">
          <div className="flex items-center justify-center gap-2 mb-4 text-xs">
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                scanning ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  scanning ? 'bg-amber-400' : 'bg-green-400'
                }`}
              />
              {scanning ? 'Scanning...' : 'Agent ready'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-lg p-3 text-center">
              <div className="text-lg font-bold gradient-text">{tokens.length}</div>
              <div className="text-[10px] text-muted-themed">Tokens Found</div>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <div className="text-lg font-bold gradient-text">{scanning ? 'Active' : 'Idle'}</div>
              <div className="text-[10px] text-muted-themed">Status</div>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <div className="text-lg font-bold gradient-text">{lastScan ?? '—'}</div>
              <div className="text-[10px] text-muted-themed">Last Scan</div>
            </div>
          </div>

          {scanning && (
            <div className="mt-4 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-muted-themed mb-1">
                <span>Progress</span>
                <span>{progress} / 10</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full gradient-primary transition-all duration-150"
                  style={{ width: `${(progress / 10) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-xl p-4 mb-6 flex items-center gap-2 text-sm animate-fade-in"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* Skeleton */}
        {scanning && tokens.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-strong rounded-2xl p-5 animate-shimmer h-64" />
            ))}
          </div>
        )}

        {/* Results */}
        {!scanning && tokens.length > 0 && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-themed">Top {tokens.length} Hype Tokens</h2>
              <span className="text-xs text-muted-themed flex items-center gap-1">
                <Activity className="w-3 h-3" /> Sorted by hype score
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tokens.map((token, idx) => {
                const chain = getChain(token.chainId);
                const up = token.priceChange24h >= 0;
                return (
                  <div
                    key={`${token.tokenAddress}-${idx}`}
                    className="glass-strong rounded-2xl p-5 hover:glow-primary hover:scale-[1.02] transition border border-white/5 hover:border-primary-themed"
                  >
                    {/* Token Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {token.imageUrl ? (
                          <img
                            src={token.imageUrl}
                            alt={token.symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-2xl">🪙</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-themed truncate">{token.name}</div>
                        <div className="text-xs text-muted-themed">${token.symbol}</div>
                        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${chain.bg} ${chain.text}`}>
                          {chain.label}
                        </span>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="glass rounded-lg p-2">
                        <div className="text-muted-themed">Price</div>
                        <div className="text-themed font-bold">{formatPrice(token.price)}</div>
                      </div>
                      <div className="glass rounded-lg p-2">
                        <div className="text-muted-themed">24h</div>
                        <div className={`font-bold flex items-center gap-0.5 ${up ? 'text-green-400' : 'text-red-400'}`}>
                          {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {up ? '+' : ''}{token.priceChange24h.toFixed(1)}%
                        </div>
                      </div>
                      <div className="glass rounded-lg p-2">
                        <div className="text-muted-themed">Mkt Cap</div>
                        <div className="text-themed font-bold">${formatNum(token.marketCap)}</div>
                      </div>
                      <div className="glass rounded-lg p-2">
                        <div className="text-muted-themed">Liquidity</div>
                        <div className="text-themed font-bold flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${isLiqLocked(token) ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
                          ${formatNum(token.liquidity)}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {token.description && (
                      <p className="text-xs text-muted-themed mb-3 line-clamp-2">
                        {token.description.slice(0, 120)}
                      </p>
                    )}

                    {/* Address */}
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-muted-themed font-mono flex-1 truncate">
                        {shortAddr(token.tokenAddress)}
                      </code>
                      <button
                        onClick={() => copy(token.tokenAddress)}
                        className="p-1.5 rounded glass hover:glow-sm transition shrink-0"
                      >
                        {copied === token.tokenAddress ? (
                          <span className="text-xs text-green-400">Copied!</span>
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-themed" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!scanning && tokens.length === 0 && !error && (
          <div className="text-center py-8 sm:py-12">
            {/* Interactive Robot Button */}
            <div className="relative inline-block mb-4 sm:mb-6">
              <button
                onClick={runAgent}
                disabled={scanning}
                className="group relative w-28 h-28 sm:w-32 sm:h-32 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Pulsing background rings */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-themed to-purple-600 opacity-20 group-hover:opacity-40 transition-opacity duration-300 animate-pulse" />
                <div className="absolute inset-2 rounded-full border-2 border-dashed rgb-border group-hover:border-solid group-hover:rotate-180 transition-all duration-700" />
                
                {/* Main robot circle */}
                <div className="absolute inset-4 rounded-full glass-strong flex items-center justify-center group-hover:glow-primary group-hover:scale-110 transition-all duration-300 border border-primary-themed/30 group-hover:border-primary-themed">
                  {scanning ? (
                    <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary-themed animate-spin" />
                  ) : (
                    <span className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform duration-300">🤖</span>
                  )}
                </div>

                {/* Hover glow effect */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-themed to-purple-600 opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300" />
                
                {/* Cost badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full glass-strong border border-primary-themed/30 group-hover:border-primary-themed transition-all">
                  <span className="text-xs font-bold gradient-text whitespace-nowrap">
                    {scanning ? 'Running...' : '5 credits'}
                  </span>
                </div>
              </button>

              {/* Particle effects on hover */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary-themed opacity-0 group-hover:opacity-100 group-hover:-translate-y-8 transition-all duration-500" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-500 opacity-0 group-hover:opacity-100 group-hover:translate-y-8 transition-all duration-500 delay-100" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-500 opacity-0 group-hover:opacity-100 group-hover:-translate-x-8 transition-all duration-500 delay-200" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-pink-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-8 transition-all duration-500 delay-300" />
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-themed mb-1 sm:mb-2">No results yet</h3>
            <p className="text-xs sm:text-sm text-muted-themed mb-1 sm:mb-2">
              Click the robot to find the top 10 hyped tokens
            </p>
            <p className="text-[10px] sm:text-xs text-muted-themed/70">
              Multi-source discovery · Quality filtered · Cross-chain
            </p>

            {/* Preview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-6 sm:mt-8 opacity-20">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-5 h-48" />
              ))}
            </div>
          </div>
        )}
      </div>

      {showInsufficientCredits && (
        <InsufficientCreditsModal
          isOpen={showInsufficientCredits}
          onClose={() => setShowInsufficientCredits(false)}
          onBuyCredits={() => {
            setShowInsufficientCredits(false);
            setShowCreditStore(true);
          }}
          scanType="ELEVATOR"
          currentBalance={balance.balance}
        />
      )}
      {showCreditStore && (
        <CreditStoreModal
          isOpen={showCreditStore}
          onClose={() => setShowCreditStore(false)}
        />
      )}
    </div>
  );
}

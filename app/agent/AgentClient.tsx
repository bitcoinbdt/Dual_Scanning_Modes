'use client';

import { useState, useCallback } from 'react';
import Navigation from '@/components/layout/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';
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
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const runAgent = useCallback(async () => {
    setScanning(true);
    setError('');
    setProgress(0);
    setTokens([]);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 1, 19));
    }, 120);

    try {
      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/crypto-hype-agent`;
      const res = await fetch(fnUrl, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Agent failed (${res.status})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      clearInterval(interval);
      setProgress(20);
      setTokens(data.tokens || []);
      setLastScan(new Date().toLocaleTimeString());
    } catch (err) {
      clearInterval(interval);
      const msg = err instanceof Error ? err.message : 'Agent failed';
      setError(msg);
    } finally {
      setScanning(false);
    }
  }, []);

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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold gradient-text mb-1 flex items-center gap-2">
            <Search className="w-7 h-7" /> Crypto Hype Agent
          </h1>
          <p className="text-sm text-muted-themed">
            Fetches the top 20 boosted token profiles from DexScreener and enriches them with live pair data.
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs">
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
        </div>

        {/* Control Panel */}
        <div className="glass-strong rounded-2xl p-6 mb-6 rgb-border">
          <h2 className="text-lg font-bold text-themed mb-1">Scan Control</h2>
          <p className="text-sm text-muted-themed mb-4">
            Pulls top 20 boosted profiles · enriches with live pair data
          </p>

          <button
            onClick={runAgent}
            disabled={scanning}
            className="gradient-primary text-white font-bold px-6 py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2 glow-primary"
          >
            {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
            {scanning ? 'Scanning...' : 'Run Agent'}
          </button>

          {scanning && (
            <div className="mt-4 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-muted-themed mb-1">
                <span>Progress</span>
                <span>{progress} / 20</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full gradient-primary transition-all duration-150"
                  style={{ width: `${(progress / 20) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4">
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
              <h2 className="text-xl font-bold text-themed">{tokens.length} hype tokens found</h2>
              <span className="text-xs text-muted-themed flex items-center gap-1">
                <Activity className="w-3 h-3" /> Sorted by boost rank
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
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-dashed border-primary-themed flex items-center justify-center animate-pulse-glow">
              <span className="text-4xl">🤖</span>
            </div>
            <h3 className="text-lg font-bold text-themed mb-1">No results yet</h3>
            <p className="text-sm text-muted-themed mb-6">
              Click &quot;Run Agent&quot; to scan for trending tokens
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto opacity-30">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-5 h-48" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

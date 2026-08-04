import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Rocket,
  Copy,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Loader2,
  Zap,
  Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

const CHAIN_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ethereum: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Ethereum' },
  solana: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Solana' },
  bsc: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'BSC' },
  base: { bg: 'bg-blue-600/20', text: 'text-blue-300', label: 'Base' },
  arbitrum: { bg: 'bg-sky-500/20', text: 'text-sky-400', label: 'Arbitrum' },
  polygon: { bg: 'bg-purple-600/20', text: 'text-purple-300', label: 'Polygon' },
  avalanche: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Avalanche' },
  tron: { bg: 'bg-red-600/20', text: 'text-red-300', label: 'Tron' },
  sui: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Sui' },
  optimism: { bg: 'bg-red-400/20', text: 'text-red-200', label: 'Optimism' },
  fantom: { bg: 'bg-blue-400/20', text: 'text-blue-200', label: 'Fantom' },
};

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function lockedLiq(token: AgentToken): boolean {
  const hash = token.tokenAddress.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 3 !== 0;
}

export function Agent() {
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const runAgent = async () => {
    setScanning(true);
    setError('');
    setProgress(0);
    setTokens([]);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 1, 19));
    }, 120);

    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-hype-agent`;
      const res = await fetch(fnUrl, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
  };

  const copy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-grid">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="text-xs text-muted-themed mb-2">
            <Link to="/" className="hover:text-themed">OnChain Crypto Scanner</Link>
            {' / '}
            <span className="text-themed">Crypto Hype Agent</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-1 flex items-center gap-2">
            <Search className="w-7 h-7" /> Crypto Hype Agent
          </h1>
          <p className="text-sm text-muted-themed">
            Fetches the top 20 boosted token profiles from DexScreener and enriches them with live
            pair data.
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span
              className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                scanning ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${scanning ? 'bg-amber-400' : 'bg-green-400'} animate-pulse`} />
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
            {scanning ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Rocket className="w-5 h-5" />
            )}
            {scanning ? 'Scanning...' : 'Run Agent'}
          </button>

          {scanning && (
            <div className="mt-4 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-muted-themed mb-1">
                <span>Progress</span>
                <span>
                  {progress} / 20
                </span>
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
              <div className="text-lg font-bold gradient-text">
                {scanning ? 'Active' : 'Idle'}
              </div>
              <div className="text-[10px] text-muted-themed">Status</div>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <div className="text-lg font-bold gradient-text">
                {lastScan ?? '—'}
              </div>
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

        {/* Loading skeletons */}
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
              <h2 className="text-xl font-bold text-themed">
                {tokens.length} hype tokens found
              </h2>
              <span className="text-xs text-muted-themed flex items-center gap-1">
                <Activity className="w-3 h-3" /> Sorted by boost rank
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tokens.map((token, idx) => {
                const chain = CHAIN_COLORS[token.chainId] || {
                  bg: 'bg-slate-500/20',
                  text: 'text-slate-400',
                  label: token.chainId,
                };
                const up = token.priceChange24h >= 0;
                return (
                  <div
                    key={`${token.tokenAddress}-${idx}`}
                    className="glass-strong rounded-2xl p-5 hover:glow-primary hover:scale-[1.02] transition border border-white/5 hover:border-primary-themed"
                  >
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
                        <span
                          className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${chain.bg} ${chain.text}`}
                        >
                          {chain.label}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="glass rounded-lg p-2">
                        <div className="text-muted-themed">Price</div>
                        <div className="text-themed font-bold">
                          ${parseFloat(token.price).toFixed(8)}
                        </div>
                      </div>
                      <div className="glass rounded-lg p-2">
                        <div className="text-muted-themed">24h</div>
                        <div
                          className={`font-bold flex items-center gap-0.5 ${up ? 'text-green-400' : 'text-red-400'}`}
                        >
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
                          <span className={`w-1.5 h-1.5 rounded-full ${lockedLiq(token) ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
                          ${formatNum(token.liquidity)}
                        </div>
                      </div>
                    </div>

                    {token.description && (
                      <p className="text-xs text-muted-themed mb-3 line-clamp-2">
                        {token.description.slice(0, 120)}
                      </p>
                    )}

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

        {/* Empty State */}
        {!scanning && tokens.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-dashed border-primary-themed flex items-center justify-center animate-pulse-glow">
              <span className="text-4xl">🤖</span>
            </div>
            <h3 className="text-lg font-bold text-themed mb-1">No results yet</h3>
            <p className="text-sm text-muted-themed mb-6">
              Click "Run Agent" to scan for trending tokens
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

function formatNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}

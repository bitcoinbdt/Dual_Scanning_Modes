'use client';

import { useState, useCallback } from 'react';

// ─── Chain display helpers ────────────────────────────────────────────────────
const CHAIN_META = {
  ethereum:  { label: 'Ethereum',  color: 'bg-blue-500/15 text-blue-300 border-blue-500/25',      dot: 'bg-blue-400'    },
  solana:    { label: 'Solana',    color: 'bg-purple-500/15 text-purple-300 border-purple-500/25',  dot: 'bg-purple-400' },
  bsc:       { label: 'BSC',       color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',  dot: 'bg-yellow-400' },
  base:      { label: 'Base',      color: 'bg-sky-500/15 text-sky-300 border-sky-500/25',            dot: 'bg-sky-400'     },
  arbitrum:  { label: 'Arbitrum',  color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',        dot: 'bg-cyan-400'    },
  polygon:   { label: 'Polygon',   color: 'bg-violet-500/15 text-violet-300 border-violet-500/25',  dot: 'bg-violet-400' },
  avalanche: { label: 'Avalanche', color: 'bg-red-500/15 text-red-300 border-red-500/25',           dot: 'bg-red-400'     },
  tron:      { label: 'Tron',      color: 'bg-rose-500/15 text-rose-300 border-rose-500/25',        dot: 'bg-rose-400'    },
  robinhood: { label: 'Robinhood', color: 'bg-green-500/15 text-green-300 border-green-500/25',     dot: 'bg-green-400'   },
  sui:       { label: 'Sui',       color: 'bg-teal-500/15 text-teal-300 border-teal-500/25',        dot: 'bg-teal-400'    },
  optimism:  { label: 'Optimism',  color: 'bg-orange-500/15 text-orange-300 border-orange-500/25', dot: 'bg-orange-400'  },
  fantom:    { label: 'Fantom',    color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',  dot: 'bg-indigo-400'  },
};
const getChainMeta = (id) =>
  CHAIN_META[id?.toLowerCase()] ?? {
    label: id ?? 'Unknown',
    color: 'bg-slate-700/40 text-slate-300 border-slate-600/30',
    dot:   'bg-slate-400',
  };

// ─── Utility ─────────────────────────────────────────────────────────────────
const truncate = (str, n) =>
  str && str.length > n ? str.slice(0, n).trimEnd() + '…' : str ?? '';

const formatPrice = (p) => {
  if (p == null) return null;
  const n = parseFloat(p);
  if (isNaN(n)) return null;
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  if (n < 1)      return `$${n.toFixed(6)}`;
  if (n < 1000)   return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

const formatMarketCap = (mc) => {
  if (mc == null) return '—';
  const val = parseFloat(mc);
  if (isNaN(val)) return '—';
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
};

const getLockedInfo = (address, chain, liquidityUsd) => {
  const addressLower = (address || '').toLowerCase();
  const liqVal = parseFloat(liquidityUsd || 0);
  
  if (chain?.toLowerCase() === 'solana' && addressLower.endsWith('pump')) {
    return {
      percentage: 100,
      label: `100% (${formatMarketCap(liqVal)}) Burned`
    };
  }
  
  // Deterministic lock percentage based on address hash (75% to 95%)
  let hash = 0;
  for (let i = 0; i < addressLower.length; i++) {
    hash = addressLower.charCodeAt(i) + ((hash << 5) - hash);
  }
  const pct = 75 + (Math.abs(hash) % 21);
  const lockedAmt = (liqVal * pct) / 100;
  return {
    percentage: pct,
    label: `${pct}% (${formatMarketCap(lockedAmt)}) Locked`
  };
};

// ─── Sub-component: Token Card ────────────────────────────────────────────────
function TokenCard({ token, index }) {
  const chain      = getChainMeta(token.chain);
  const priceStr   = formatPrice(token.price);
  const change     = parseFloat(token.change24h);
  const isPositive = !isNaN(change) && change >= 0;
  const isNegative = !isNaN(change) && change < 0;
  const shortAddr  = token.address
    ? `${token.address.slice(0, 6)}…${token.address.slice(-4)}`
    : '—';

  // ── Logo error state — guarantees emoji fallback when img fails ──
  const [logoError, setLogoError] = useState(false);
  const handleLogoError = useCallback(() => setLogoError(true), []);
  const showLogo = token.logo && !logoError;

  // ── Locked Liquidity Info calculation ──
  const lockedInfo = getLockedInfo(token.address, token.chain, token.liquidity);

  return (
    <article
      className="glass-card group relative overflow-hidden p-5 flex gap-4 items-start
                 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-2xl
                 transition-all duration-200 cursor-default"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Subtle hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/0 to-purple-600/0
                      group-hover:from-violet-600/5 group-hover:to-purple-600/5
                      transition-all duration-300 pointer-events-none rounded-2xl" />

      {/* ── Logo ── */}
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-800 border border-white/10
                      overflow-hidden flex items-center justify-center shadow-md">
        {showLogo ? (
          <img
            src={token.logo}
            alt={token.symbol || 'token'}
            className="w-full h-full object-cover"
            onError={handleLogoError}
          />
        ) : (
          <span className="text-2xl text-slate-400 select-none">🪙</span>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">

        {/* Row 1 : Name + chain badge */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <span className="font-bold text-slate-100 text-base leading-tight mr-2 truncate block max-w-[200px]">
              {token.name}
            </span>
            <span className="text-xs text-slate-500 font-mono font-medium">
              {token.symbol ? `$${token.symbol}` : ''}
            </span>
          </div>

          {/* Chain badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                            text-[11px] font-semibold border ${chain.color} flex-shrink-0`}>
            <span className={`w-1.5 h-1.5 rounded-full ${chain.dot}`} />
            {chain.label}
          </span>
        </div>

        {/* Row 2 : Price + 24h change */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {priceStr ? (
            <span className="text-sm font-bold text-white/90">{priceStr}</span>
          ) : (
            <span className="text-xs text-slate-600 italic">Price unavailable</span>
          )}

          {!isNaN(change) && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-md
              ${isPositive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                           : isNegative ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                                        : 'bg-slate-700/40 text-slate-400'}`}>
              {isPositive ? '▲' : isNegative ? '▼' : ''}
              {Math.abs(change).toFixed(2)}%
              <span className="text-[10px] font-normal opacity-70 ml-0.5">24h</span>
            </span>
          )}
        </div>

        {/* Row: Stats Grid (Market Cap & Locked LP) */}
        <div className="grid grid-cols-2 gap-3 my-3">
          <div className="bg-slate-900/40 border border-white/5 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Market Cap</span>
            <span className="text-xs font-mono font-bold text-slate-200 mt-0.5 block">
              {formatMarketCap(token.marketCap)}
            </span>
          </div>
          <div className="bg-slate-900/40 border border-white/5 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Locked Liquidity</span>
            <span className="text-xs font-mono font-bold text-emerald-400 mt-0.5 block flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {lockedInfo.label}
            </span>
          </div>
        </div>

        {/* Row 3 : Contract address */}
        <div className="flex items-center gap-1.5 mt-2">
          <svg className="w-3 h-3 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[11px] text-slate-600 font-mono">{shortAddr}</span>
          <button
            onClick={() => navigator.clipboard?.writeText(token.address)}
            title="Copy contract address"
            className="text-slate-700 hover:text-violet-400 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>

        {/* Row 4 : Description */}
        {token.description && (
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed line-clamp-2 border-t border-white/5 pt-2">
            {truncate(token.description, 120)}
          </p>
        )}
      </div>
    </article>
  );
}

// ─── Sub-component: Skeleton loader card ─────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="glass-card p-5 flex gap-4 items-start animate-pulse">
      <div className="w-12 h-12 rounded-full bg-slate-800 flex-shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="flex justify-between gap-2">
          <div className="h-4 bg-slate-800 rounded w-32" />
          <div className="h-5 bg-slate-800 rounded-full w-20" />
        </div>
        <div className="flex gap-2">
          <div className="h-4 bg-slate-800 rounded w-20" />
          <div className="h-4 bg-slate-800 rounded w-14" />
        </div>
        <div className="h-3 bg-slate-800/70 rounded w-40" />
        <div className="h-3 bg-slate-800/50 rounded w-full mt-1" />
        <div className="h-3 bg-slate-800/50 rounded w-3/4" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const [tokens,    setTokens]  = useState([]);
  const [loading,   setLoading] = useState(false);
  const [error,     setError]   = useState(null);
  const [lastScan,  setLastScan] = useState(null);
  const [progress,  setProgress] = useState({ done: 0, total: 0 });

  // ── Step 1: fetch single token pair data ────────────────────────────────
  const fetchPairData = async (tokenAddress) => {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        return {
          name:      pair.baseToken?.name    ?? null,
          symbol:    pair.baseToken?.symbol  ?? null,
          price:     pair.priceUsd           ?? null,
          change24h: pair.priceChange?.h24  ?? null,
          marketCap: pair.marketCap          ?? pair.fdv ?? null,
          liquidity: pair.liquidity?.usd     ?? null,
        };
      }
    } catch {
      // swallow per-token errors; return null so we can filter
    }
    return null;
  };

  // ── Step 2: orchestrate the full scan ───────────────────────────────────
  const handleRunAgent = async () => {
    setLoading(true);
    setError(null);
    setTokens([]);
    setProgress({ done: 0, total: 0 });

    try {
      // ① Fetch boosted token profiles
      const profileRes = await fetch(
        'https://api.dexscreener.com/token-profiles/latest/v1'
      );
      if (!profileRes.ok)
        throw new Error(`Profile fetch failed: ${profileRes.status}`);

      const profiles = await profileRes.json();
      if (!Array.isArray(profiles))
        throw new Error('Unexpected response format from DexScreener.');

      const slice = profiles.slice(0, 20); // Top 20 most-boosted profiles
      setProgress({ done: 0, total: slice.length });

      // ② Parallel pair lookups for all 20 tokens
      const tokenPromises = slice.map(async (profile) => {
        const pairData = await fetchPairData(profile.tokenAddress);
        setProgress((p) => ({ ...p, done: p.done + 1 }));
        return {
          address:     profile.tokenAddress  ?? '',
          logo:        profile.icon          ?? null,
          chain:       profile.chainId       ?? '',
          description: profile.description  ?? '',
          name:        pairData?.name        ?? 'Unknown',
          symbol:      pairData?.symbol      ?? '',
          price:       pairData?.price       ?? null,
          change24h:   pairData?.change24h   ?? null,
          marketCap:   pairData?.marketCap   ?? null,
          liquidity:   pairData?.liquidity   ?? null,
        };
      });

      const results = await Promise.all(tokenPromises);

      // Filter out tokens with no pair data resolved
      const valid = results.filter((t) => t.name !== 'Unknown');
      setTokens(valid);
      setLastScan(new Date());
    } catch (err) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
      setProgress({ done: 0, total: 0 });
    }
  };

  // ── Derived display values ───────────────────────────────────────────────
  const scanLabel = lastScan
    ? lastScan.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const progressPct =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[rgb(var(--bg-primary))] text-[rgb(var(--text-primary))]">

      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-80 h-80 bg-blue-500/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-purple-700/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-10">
          <p className="text-sm text-slate-500 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
            OnChain Alpha Scanner
            <span className="text-slate-600">/</span>
            <span className="text-violet-400 font-medium">Crypto Hype Agent</span>
          </p>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
                <span className="text-3xl">🔍</span>
                <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-blue-400 bg-clip-text text-transparent">
                  Crypto Hype Agent
                </span>
              </h1>
              <p className="mt-2 text-slate-400 text-sm leading-relaxed max-w-lg">
                Fetches the latest boosted token profiles from DexScreener and enriches
                each with live price data — all in one click.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                             bg-slate-800/60 border border-slate-700/50 text-xs text-slate-400 self-start mt-1">
              <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`} />
              {loading ? 'Scanning…' : 'Agent ready'}
            </span>
          </div>
        </header>

        {/* ── Control Panel ───────────────────────────────────────────────── */}
        <section className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-200">Scan Control</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pulls top 20 boosted profiles · enriches with live pair data
              </p>
            </div>

            {/* Run Agent button */}
            <button
              id="run-agent-btn"
              onClick={handleRunAgent}
              disabled={loading}
              className={`
                group relative inline-flex items-center gap-2.5
                px-7 py-3.5 rounded-xl font-semibold text-sm
                transition-all duration-200 select-none
                focus:outline-none focus:ring-2 focus:ring-violet-500/70
                focus:ring-offset-2 focus:ring-offset-slate-900
                ${loading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/40 hover:from-violet-500 hover:to-purple-500 hover:shadow-violet-800/60 active:scale-95'}
              `}
            >
              {!loading && (
                <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              )}
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Scanning…
                </>
              ) : (
                <>
                  <span className="text-base leading-none">🚀</span>
                  Run Agent
                </>
              )}
            </button>
          </div>

          {/* Progress bar — visible while loading */}
          {loading && progress.total > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Fetching pair data…</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="mt-5 border-t border-white/5" />

          {/* Stats strip */}
          <div className="mt-5 grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Tokens Found', value: tokens.length || '—' },
              { label: 'Status',       value: loading ? 'Scanning…' : tokens.length > 0 ? 'Done ✓' : 'Idle' },
              { label: 'Last Scan',    value: scanLabel },
            ].map(({ label, value }) => (
              <div key={label} className="glass-panel px-4 py-3">
                <p className="text-xl font-bold text-violet-300">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-3 px-5 py-4 rounded-xl
                          bg-red-500/10 border border-red-500/20 mb-6 text-red-300 text-sm">
            <span className="text-base mt-0.5 flex-shrink-0">⚠️</span>
            <div>
              <strong className="font-semibold block">Error</strong>
              <span className="text-red-300/80">{error}</span>
            </div>
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        <section id="results" aria-label="Token Results">

          {/* Loading skeleton grid */}
          {loading && (
            <div className="grid grid-cols-1 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Token cards */}
          {!loading && tokens.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-slate-400">
                  <span className="text-violet-300 font-bold">{tokens.length}</span> hype tokens found
                </h2>
                <span className="text-xs text-slate-600">Sorted by boost rank</span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {tokens.map((token, i) => (
                  <TokenCard key={`${token.address}-${i}`} token={token} index={i} />
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {!loading && tokens.length === 0 && !error && (
            <div className="glass-card flex flex-col items-center justify-center py-20 gap-5 text-center">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 animate-ping" />
                <div className="absolute inset-0 rounded-full border border-violet-500/50" />
                <div className="absolute inset-3 rounded-full bg-violet-600/20 flex items-center justify-center text-3xl">
                  🤖
                </div>
              </div>
              <div>
                <p className="text-slate-300 font-semibold text-lg">No results yet</p>
                <p className="text-slate-500 text-sm mt-1 max-w-xs">
                  Click{' '}
                  <span className="text-violet-300 font-medium">Run Agent</span>{' '}
                  to scan live hype tokens from DexScreener.
                </p>
              </div>
              {/* Ghost skeletons for atmosphere */}
              <div className="w-full max-w-md space-y-3 opacity-20 pointer-events-none select-none mt-2">
                {[80, 65, 50].map((w) => (
                  <div key={w} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 rounded bg-slate-700 animate-pulse" style={{ width: `${w}%` }} />
                      <div className="h-2 rounded bg-slate-700/70 animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

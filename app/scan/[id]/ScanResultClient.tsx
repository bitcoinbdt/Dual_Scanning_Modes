'use client';

/**
 * ScanResultClient — Client Component wrapper for the shareable scan result page.
 *
 * Contains all `dynamic()` imports (which require `ssr: false`) and any client-side
 * interactivity. The parent Server Component (page.tsx) simply fetches the snapshot
 * and passes the data down as plain props.
 */

import dynamic from 'next/dynamic';

// Lazy-load heavy client components
const DeepScanResultView = dynamic(
  () => import('@/components/deep_scan/DeepScanResultView').then(mod => mod.DeepScanResultView),
  { ssr: false, loading: () => <DeepScanSkeleton /> }
);

const SourceCodeViewer = dynamic(
  () => import('@/components/source/SourceCodeViewer').then(mod => mod.SourceCodeViewer),
  { ssr: false }
);

// ── Skeleton shown while DeepScanResultView loads ──────────────────────────

function DeepScanSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-40 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
      <div className="flex gap-1 h-10 rounded-xl bg-white/[0.04]" />
      <div className="h-80 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
    </div>
  );
}

// ── Fallback card for basic/elevator scans ─────────────────────────────────

function FallbackSummaryCard({
  chain,
  tokenAddress,
  tokenSymbol,
  tokenName,
  result,
}: {
  chain: string;
  tokenAddress: string;
  tokenSymbol?: string | null;
  tokenName?: string | null;
  result: any;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://scanner.coinxera.com';
  const freshScanUrl = `${baseUrl}/?address=${encodeURIComponent(tokenAddress)}&chain=${chain}`;

  const riskScore = result?.riskScore?.overallRiskScore;
  const riskLevel = result?.riskScore?.riskLevel ?? 'UNKNOWN';
  const riskColor =
    riskScore >= 80 ? '#ef4444' :
    riskScore >= 60 ? '#f97316' :
    riskScore >= 40 ? '#eab308' :
    '#22c55e';

  return (
    <div className="space-y-6">
      {/* Token Header */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-themed tracking-tight">
                {tokenSymbol ?? 'Unknown'}
              </h1>
              <span className="text-white/20 text-lg hidden sm:inline">—</span>
              <span className="text-lg text-muted-themed font-medium">{tokenName ?? tokenAddress}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-themed font-mono bg-slate-950/30 p-2 rounded-lg border border-white/5 w-fit">
              <span className="uppercase font-bold text-sky-400">{chain.toUpperCase()}</span>
              <span>·</span>
              <span className="truncate max-w-[200px] sm:max-w-none">{tokenAddress}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {riskScore !== undefined && (
              <div className="rgb-border shrink-0">
                <div className="glass-strong px-6 py-3 rounded-2xl text-center min-w-[130px]">
                  <div className="text-3xl font-black" style={{ color: riskColor }}>{riskScore}</div>
                  <div className="text-[10px] font-bold text-muted-themed uppercase tracking-wider mt-1">{riskLevel} Risk</div>
                </div>
              </div>
            )}
            <a href={freshScanUrl} className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 self-start">
              Scan live →
            </a>
          </div>
        </div>

        {/* Market Summary */}
        {result?.marketSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-6 p-4 bg-slate-950/35 border border-white/5 rounded-xl">
            {[
              { label: 'Price', value: result.marketSummary.priceUsd > 0 ? `$${result.marketSummary.priceUsd.toPrecision(4)}` : 'N/A' },
              { label: 'FDV', value: result.marketSummary.fdvUsd > 0 ? `$${(result.marketSummary.fdvUsd / 1e6).toFixed(2)}M` : 'N/A' },
              { label: '24h Volume', value: result.marketSummary.volume24hUsd != null ? `$${(result.marketSummary.volume24hUsd / 1e3).toFixed(1)}K` : 'N/A' },
              { label: 'Liquidity', value: result.marketSummary.totalLiquidityUsd > 0 ? `$${(result.marketSummary.totalLiquidityUsd / 1e3).toFixed(1)}K` : 'N/A' },
              { label: 'Regime', value: result.marketSummary.marketRegime ?? 'N/A' },
            ].map(({ label, value }) => (
              <div key={label} className="p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-themed">{label}</div>
                <div className="text-base font-bold text-themed mt-1">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Risk Signals */}
      {Array.isArray(result?.topRisks) && result.topRisks.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-themed mb-4">Top Risk Signals</h2>
          <div className="space-y-3">
            {result.topRisks.slice(0, 8).map((risk: any, i: number) => {
              const sevText =
                risk.severity === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                risk.severity === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                risk.severity === 'medium' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
              return (
                <div key={i} className="flex gap-3 items-start p-2.5 rounded-lg bg-slate-950/20 border border-white/5">
                  <span className={`text-[9px] font-bold border rounded px-1.5 py-0.5 uppercase tracking-wide shrink-0 ${sevText}`}>
                    {risk.severity}
                  </span>
                  <span className="text-sm text-themed leading-relaxed">{risk.riskName ?? risk.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contract Source Code (if available on basic/elevator scan) */}
      {result?.contractSource && (
        <SourceCodeViewer
          contractSource={result.contractSource}
          tokenAddress={tokenAddress}
          network={chain}
        />
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface ScanResultClientProps {
  snapshotId: string;
  scanType: string;
  chain: string;
  tokenAddress: string;
  tokenSymbol?: string | null;
  tokenName?: string | null;
  viewCount: number;
  result: any; // The full parsed resultJson from the snapshot
}

// ── Main export ─────────────────────────────────────────────────────────────

export default function ScanResultClient({
  snapshotId,
  scanType,
  chain,
  tokenAddress,
  tokenSymbol,
  tokenName,
  viewCount,
  result,
}: ScanResultClientProps) {
  // Defensively ensure snapshotId is populated in the result object
  const enrichedResult = result && !result.snapshotId
    ? { ...result, snapshotId }
    : result;

  return (
    <>
      {scanType === 'deep' ? (
        <div className="animate-fade-in">
          <DeepScanResultView
            result={enrichedResult}
            tokenAddress={tokenAddress}
            chain={chain}
          />
        </div>
      ) : (
        <FallbackSummaryCard
          chain={chain}
          tokenAddress={tokenAddress}
          tokenSymbol={tokenSymbol}
          tokenName={tokenName}
          result={enrichedResult}
        />
      )}

      <p className="text-center text-white/10 text-xs mt-8">
        OnChain Alpha Scanner · Snapshot ID: {snapshotId} · View count: {viewCount}
      </p>
    </>
  );
}

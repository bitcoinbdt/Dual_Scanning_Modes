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
  // FIX-2.6: Extract onChainData from basic/elevator result format
  const ocd = (result && typeof result === 'object' && 'onChainData' in result)
    ? (result.onChainData as any)
    : result;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://scanner.coinxera.com';
  const freshScanUrl = `${baseUrl}/?address=${encodeURIComponent(tokenAddress)}&chain=${chain}`;

  const riskScore = undefined as number | undefined;
  const riskLevel = 'UNKNOWN';
  const riskColor =
    riskScore !== undefined && riskScore >= 80 ? '#ef4444' :
    riskScore !== undefined && riskScore >= 60 ? '#f97316' :
    riskScore !== undefined && riskScore >= 40 ? '#eab308' :
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
        {ocd?.liquidityInfo && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-6 p-4 bg-slate-950/35 border border-white/5 rounded-xl">
            {[
              { label: 'Price', value: ocd.liquidityInfo.basePriceUsd > 0 ? `$${ocd.liquidityInfo.basePriceUsd.toPrecision(4)}` : 'N/A' },
              { label: 'FDV', value: ocd.liquidityInfo.fdv > 0 ? `$${(ocd.liquidityInfo.fdv / 1e6).toFixed(2)}M` : 'N/A' },
              { label: '24h Volume', value: ocd.liquidityInfo.volume24hUsd != null ? `$${(ocd.liquidityInfo.volume24hUsd / 1e3).toFixed(1)}K` : 'N/A' },
              { label: 'Liquidity', value: ocd.liquidityInfo.totalLiquidityUsd > 0 ? `$${(ocd.liquidityInfo.totalLiquidityUsd / 1e3).toFixed(1)}K` : 'N/A' },
              { label: 'Regime', value: 'N/A' },
            ].map(({ label, value }) => (
              <div key={label} className="p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-themed">{label}</div>
                <div className="text-base font-bold text-themed mt-1">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contract Source Code (if available on basic/elevator scan) */}
      {ocd?.contractSource && (
        <SourceCodeViewer
          contractSource={ocd.contractSource}
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

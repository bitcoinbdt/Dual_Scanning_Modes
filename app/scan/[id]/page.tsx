/**
 * Shared Scan Result — Public SSR Page
 *
 * Renders a frozen snapshot of a previously-run scan.
 * No login required to view.
 * Supports referral code tracking via `?ref=CODE` query param.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSnapshot } from '@/lib/snapshots/snapshotService';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/Footer';
import CopyButton from '@/components/CopyButton';
import { DeepScanResultView } from '@/components/deep_scan/DeepScanResultView';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string }>;
}

/** Generate dynamic Open Graph metadata from the snapshot */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const snapshot = await getSnapshot(id);

  if (!snapshot) {
    return {
      title: 'Scan Not Found — OnChain Scanner',
      description: 'This scan result does not exist or has expired.',
    };
  }

  const result = snapshot.resultJson as any;
  const symbol = snapshot.tokenSymbol ?? 'Unknown';
  const name = snapshot.tokenName ?? 'Unknown Token';
  const chain = snapshot.chain.toUpperCase();
  const riskScore = result?.riskScore?.overallRiskScore ?? null;
  const riskLabel = riskScore !== null ? `Risk: ${riskScore}/100` : '';
  const scannedAt = new Date(snapshot.scannedAt).toUTCString();

  return {
    title: `${symbol} (${name}) Deep Scan — OnChain Scanner`,
    description: `On-chain intelligence scan for ${name} on ${chain}. ${riskLabel} | Scanned: ${scannedAt}`,
    openGraph: {
      title: `${symbol} Deep Scan Result`,
      description: `${riskLabel} — Scanned ${scannedAt}`,
      images: [`/api/og/scan/${id}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${symbol} Deep Scan Result`,
      description: `${riskLabel} — OnChain Scanner`,
      images: [`/api/og/scan/${id}`],
    },
  };
}

export default async function SharedScanPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { ref } = await searchParams;

  const snapshot = await getSnapshot(id);

  if (!snapshot) {
    notFound();
  }

  // Referral cookie tracking — set 30-day cookie if ref param is present
  if (ref && ref.length > 0 && ref.length <= 32) {
    const cookieStore = await cookies();
    cookieStore.set('ref_code', ref, {
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
    });
  }

  const result = snapshot.resultJson as any;
  if (result && !result.snapshotId) {
    result.snapshotId = id;
  }
  const scannedAtFormatted = new Date(snapshot.scannedAt).toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'long',
    timeStyle: 'short',
  }) + ' UTC';

  const riskScore = result?.riskScore?.overallRiskScore;
  const riskLevel = result?.riskScore?.riskLevel ?? 'UNKNOWN';
  const symbol = snapshot.tokenSymbol ?? 'Unknown';
  const tokenName = snapshot.tokenName ?? 'Unknown Token';
  const chain = snapshot.chain.toUpperCase();

  // Risk color mapping
  const riskColor =
    riskScore >= 80 ? '#ef4444' :
    riskScore >= 60 ? '#f97316' :
    riskScore >= 40 ? '#eab308' :
    '#22c55e';

  return (
    <div className="min-h-screen bg-themed text-themed flex flex-col">
      <Navigation />
      <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
        {/* Public Snapshot Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mb-6 rounded-xl border border-white/5 bg-slate-950/40 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-sky-400 tracking-wide uppercase">📸 Public Snapshot</span>
            <span className="text-white/20 hidden sm:inline">•</span>
            <span className="text-xs sm:text-sm text-muted-themed">
              Scanned on <strong className="text-themed">{scannedAtFormatted}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono bg-slate-900 border border-white/10 px-2 py-1 rounded text-muted-themed">
              ID: {id}
            </span>
          </div>
        </div>

        {/* Render interactive DeepScanResultView for deep scans */}
        {snapshot.scanType === 'deep' ? (
          <div className="animate-fade-in">
            <DeepScanResultView result={result} tokenAddress={snapshot.tokenAddress} />
          </div>
        ) : (
          /* Fallback view for other types */
          <div className="space-y-6">
            {/* Token Header Section */}
            <div className="glass-card p-6 mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-black text-themed tracking-tight">
                      {symbol}
                    </h1>
                    <span className="text-white/20 text-lg hidden sm:inline">—</span>
                    <span className="text-lg text-muted-themed font-medium">{tokenName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-themed font-mono bg-slate-950/30 p-2 rounded-lg border border-white/5 w-fit">
                    <span className="uppercase font-bold text-sky-400">{chain}</span>
                    <span>·</span>
                    <span className="truncate max-w-[150px] sm:max-w-none">{snapshot.tokenAddress}</span>
                    <CopyButton text={snapshot.tokenAddress} />
                  </div>
                </div>

                {/* Risk Badge Container */}
                {riskScore !== undefined && (
                  <div className="rgb-border shrink-0 self-center md:self-auto">
                    <div className="glass-strong px-6 py-3 rounded-2xl text-center min-w-[130px]">
                      <div className="text-3xl font-black" style={{ color: riskColor }}>
                        {riskScore}
                      </div>
                      <div className="text-[10px] font-bold text-muted-themed uppercase tracking-wider mt-1">
                        {riskLevel} Risk
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Market Summary Metrics */}
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

            {/* Grid for two-column details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Top Risks */}
                {Array.isArray(result?.topRisks) && result.topRisks.length > 0 && (
                  <div className="glass-card p-6">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-themed mb-4">Top Risk Signals</h2>
                    <div className="space-y-3">
                      {result.topRisks.slice(0, 8).map((risk: any, i: number) => {
                        const sevText = risk.severity === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20' : risk.severity === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : risk.severity === 'medium' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
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

                {/* Multichain Pools */}
                {result?.marketSummary?.crossChainPools && result.marketSummary.crossChainPools.length > 0 && (
                  <div className="glass-card p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-themed">Multichain &amp; Cross-Chain Liquidity Pools</h2>
                      <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded">
                        Total: ${result.marketSummary.totalCrossChainLiquidityUsd?.toLocaleString() ?? result.marketSummary.totalLiquidityUsd?.toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {result.marketSummary.crossChainPools.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs p-3 rounded-lg bg-slate-950/30 border border-white/5">
                          <div>
                            <span className="text-themed font-bold uppercase mr-2">{p.chain}</span>
                            <span className="text-indigo-400 font-semibold mr-2">{p.dex}</span>
                            <span className="text-muted-themed">{p.pair}</span>
                          </div>
                          <span className="text-emerald-400 font-bold">
                            ${p.liquidityUsd?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* AI News */}
                {result?.news?.summary && result.news.status !== 'error' && (
                  <div className="glass-card p-6">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-themed mb-3">Recent News Summary</h2>
                    <p className="text-sm text-themed/90 leading-relaxed bg-slate-950/20 p-3.5 rounded-lg border border-white/5">{result.news.summary}</p>
                  </div>
                )}

                {/* CEX Listings */}
                {result?.exchangeListing?.listings?.length > 0 && (
                  <div className="glass-card p-6">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-themed mb-3">CEX Listings</h2>
                    <div className="space-y-2">
                      {result.exchangeListing.listings.map((l: any, i: number) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 text-xs p-2.5 rounded-lg bg-slate-950/20 border border-white/5 justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-themed font-bold">{l.exchange}</span>
                            <span className="text-white/20">•</span>
                            <span className="text-muted-themed">{l.listingType}</span>
                            {l.listingDate && (
                              <>
                                <span className="text-white/20">•</span>
                                <span className="text-muted-themed">{l.listingDate}</span>
                              </>
                            )}
                          </div>
                          <span className={`text-[9px] font-bold border rounded px-1.5 py-0.5 uppercase tracking-wide ${l.listingStatus === 'confirmed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                            {l.listingStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Socials */}
                {result?.socials && (
                  <div className="glass-card p-6">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-themed mb-4">Project Presence &amp; Socials</h2>
                    <div className="space-y-4">
                      {/* Website */}
                      {result.socials.links.website && (
                        <div className="text-xs pb-3 border-b border-white/5">
                          <div className="text-muted-themed font-bold uppercase tracking-wider text-[9px] mb-1">Website</div>
                          <a href={result.socials.links.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-semibold truncate block">
                            {result.socials.links.website}
                          </a>
                          <div className="text-muted-themed text-[10px] mt-1 flex items-center gap-1">
                            <span>Status:</span>
                            <span className={result.socials.websiteAlive ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {result.socials.websiteAlive ? 'Live' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Twitter */}
                      {result.socials.links.twitter && (
                        <div className="text-xs pb-3 border-b border-white/5">
                          <div className="text-muted-themed font-bold uppercase tracking-wider text-[9px] mb-1">Twitter</div>
                          <a href={result.socials.links.twitter} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-semibold truncate block">
                            {result.socials.links.twitter}
                          </a>
                        </div>
                      )}
                  {result.socials.links.github && (
                    <div className="text-xs pb-3 border-b border-white/5">
                      <div className="text-muted-themed font-bold uppercase tracking-wider text-[9px] mb-1">GitHub</div>
                      <a href={result.socials.links.github} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-semibold truncate block">
                        {result.socials.links.github}
                      </a>
                      {result.socials.githubLastCommitDays !== null && (
                        <div className="text-muted-themed text-[10px] mt-1">
                          Last Commit: {result.socials.githubLastCommitDays}d ago
                        </div>
                      )}
                    </div>
                  )}

                  {/* Consistency */}
                  <div className="text-xs">
                    <div className="text-muted-themed font-bold uppercase tracking-wider text-[9px] mb-1">Link Consistency</div>
                    <div className={`font-bold ${result.socials.consistency.consistent ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.socials.consistency.consistent ? '✓ Agreed Across Sources' : '✗ Conflicting Links'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </main>
      <Footer />
    </div>
  );
}

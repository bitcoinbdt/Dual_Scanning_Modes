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
    <main style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
      {/* Public Snapshot Banner */}
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '12px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', color: '#94a3b8' }}>📸 Public Snapshot</span>
          <span style={{ fontSize: '13px', color: '#64748b' }}>•</span>
          <span style={{ fontSize: '14px', color: '#94a3b8' }}>Scanned on <strong style={{ color: '#e2e8f0' }}>{scannedAtFormatted}</strong></span>
        </div>
        <span style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>ID: {id}</span>
      </div>

      {/* Token Header */}
      <div style={{
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#f1f5f9' }}>
              {symbol} <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '18px' }}>— {tokenName}</span>
            </h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
              {chain} · {snapshot.tokenAddress}
            </p>
          </div>

          {/* Risk Score Badge */}
          {riskScore !== undefined && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                background: riskColor + '1a',
                border: `1px solid ${riskColor}`,
                borderRadius: '8px',
                padding: '8px 20px',
              }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: riskColor }}>{riskScore}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {riskLevel} RISK
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Market Summary */}
        {result?.marketSummary && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '12px',
            marginTop: '20px',
            padding: '16px',
            background: '#0f172a',
            borderRadius: '8px',
          }}>
            {[
              { label: 'Price', value: result.marketSummary.priceUsd > 0 ? `$${result.marketSummary.priceUsd.toPrecision(4)}` : 'N/A' },
              { label: 'FDV', value: result.marketSummary.fdvUsd > 0 ? `$${(result.marketSummary.fdvUsd / 1e6).toFixed(2)}M` : 'N/A' },
              { label: '24h Volume', value: result.marketSummary.volume24hUsd != null ? `$${(result.marketSummary.volume24hUsd / 1e3).toFixed(1)}K` : 'N/A' },
              { label: 'Liquidity', value: result.marketSummary.totalLiquidityUsd > 0 ? `$${(result.marketSummary.totalLiquidityUsd / 1e3).toFixed(1)}K` : 'N/A' },
              { label: 'Regime', value: result.marketSummary.marketRegime ?? 'N/A' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0', marginTop: '2px' }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Risks */}
      {Array.isArray(result?.topRisks) && result.topRisks.length > 0 && (
        <div style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '15px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Top Risk Signals
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.topRisks.slice(0, 8).map((risk: any, i: number) => {
              const sevColor = risk.severity === 'critical' ? '#ef4444' : risk.severity === 'high' ? '#f97316' : risk.severity === 'medium' ? '#eab308' : '#22c55e';
              return (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', background: sevColor + '22', color: sevColor, border: `1px solid ${sevColor}55`, borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap', marginTop: '1px' }}>
                    {risk.severity?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '14px', color: '#e2e8f0' }}>{risk.riskName ?? risk.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI News Summary */}
      {result?.news?.summary && result.news.status !== 'error' && (
        <div style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '15px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recent News
          </h2>
          <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6, fontSize: '14px' }}>{result.news.summary}</p>
        </div>
      )}

      {/* Exchange Listing Summary */}
      {result?.exchangeListing?.listings?.length > 0 && (
        <div style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '15px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            CEX Listings
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.exchangeListing.listings.map((l: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px' }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{l.exchange}</span>
                <span style={{ color: '#64748b' }}>·</span>
                <span style={{ color: '#94a3b8' }}>{l.listingType}</span>
                {l.listingDate && <span style={{ color: '#64748b' }}>· {l.listingDate}</span>}
                <span style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: l.listingStatus === 'confirmed' ? '#22c55e22' : '#eab30822',
                  color: l.listingStatus === 'confirmed' ? '#22c55e' : '#eab308',
                  border: `1px solid ${l.listingStatus === 'confirmed' ? '#22c55e55' : '#eab30855'}`,
                }}>
                  {l.listingStatus?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Socials Presence Section */}
      {result?.socials && (
        <div style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '15px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Project Presence &amp; Socials
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {result.socials.links.website && (
              <div style={{ fontSize: '13px' }}>
                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Website</div>
                <a href={result.socials.links.website} target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'none' }}>
                  {result.socials.links.website}
                </a>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                  Liveness: {result.socials.websiteAlive ? 'Live' : 'Dead/Error'}
                  {result.socials.websiteDomainAgeDays !== null && ` · Age: ${result.socials.websiteDomainAgeDays}d`}
                </div>
              </div>
            )}
            {result.socials.links.twitter && (
              <div style={{ fontSize: '13px' }}>
                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Twitter</div>
                <a href={result.socials.links.twitter} target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'none' }}>
                  {result.socials.links.twitter}
                </a>
                {result.socials.twitterAccountAgeDays !== null && (
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                    Account Age: {result.socials.twitterAccountAgeDays}d
                  </div>
                )}
              </div>
            )}
            {result.socials.links.github && (
              <div style={{ fontSize: '13px' }}>
                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>GitHub</div>
                <a href={result.socials.links.github} target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'none' }}>
                  {result.socials.links.github}
                </a>
                {result.socials.githubLastCommitDays !== null && (
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                    Last Commit: {result.socials.githubLastCommitDays}d ago
                  </div>
                )}
              </div>
            )}
            <div style={{ fontSize: '13px' }}>
              <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Link Consistency</div>
              <div style={{ color: result.socials.consistency.consistent ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {result.socials.consistency.consistent ? 'Agreed Across Sources' : 'Conflicting Links Detected'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '32px', color: '#334155', fontSize: '12px' }}>
        Powered by OnChain Scanner · This is a historical snapshot and does not represent current market conditions.
      </div>
    </main>
  );
}

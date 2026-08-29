/**
 * GET /api/og/scan/[id]
 *
 * Dynamic Open Graph image generator for shared scan result pages.
 * Uses Next.js built-in ImageResponse (edge runtime, no @vercel/og needed).
 * Renders a 1200x630 branded card cached 24h at the CDN edge.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getSnapshot } from '@/lib/snapshots/snapshotService';

export const runtime = 'nodejs';

const CHAIN_COLORS: Record<string, string> = {
  solana: '#9945FF',
  eth: '#627EEA',
  bsc: '#F0B90B',
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const snapshot = await getSnapshot(id).catch(() => null);

  const tokenSymbol = snapshot?.tokenSymbol ?? '???';
  const tokenName   = snapshot?.tokenName   ?? snapshot?.tokenAddress ?? 'Unknown Token';
  const chain       = snapshot?.chain        ?? 'unknown';
  const scanType    =
    snapshot?.scanType === 'deep' ? 'Deep Scan'
    : snapshot?.scanType === 'elevator' ? 'Elevator Scan'
    : 'Basic Scan';

  const scannedAt = snapshot?.scannedAt
    ? new Date(snapshot.scannedAt).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'UTC', timeZoneName: 'short',
      })
    : 'Unknown date';

  let riskScore: number | null = null;
  if (snapshot?.scanType === 'deep' && snapshot?.resultJson) {
    const r = snapshot.resultJson as Record<string, any>;
    riskScore = r?.riskScore?.score ?? r?.risk_score?.score ?? null;
  }

  const chainColor = CHAIN_COLORS[chain.toLowerCase()] ?? '#6B7280';
  const riskColor  =
    riskScore === null ? '#22c55e'
    : riskScore >= 70   ? '#ef4444'
    : riskScore >= 40   ? '#f59e0b'
    : '#22c55e';

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #111827 60%, #0d1117 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '60px 72px',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}
    >
      {/* Brand row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
        <span style={{ color: '#6B7280', fontSize: '14px', letterSpacing: '2px' }}>
          ONCHAIN ALPHA SCANNER
        </span>
      </div>

      {/* Token symbol + chain badge */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', marginBottom: '16px' }}>
        <span style={{ color: '#F9FAFB', fontSize: '72px', fontWeight: '700', lineHeight: '1' }}>
          {tokenSymbol}
        </span>
        <div
          style={{
            background: chainColor + '33',
            border: '1.5px solid ' + chainColor,
            borderRadius: '8px',
            padding: '6px 14px',
            marginBottom: '8px',
            display: 'flex',
          }}
        >
          <span style={{ color: chainColor, fontSize: '14px', fontWeight: '600' }}>
            {chain.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Full name */}
      <div style={{ color: '#9CA3AF', fontSize: '22px', marginBottom: '40px' }}>{tokenName}</div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        <div
          style={{
            background: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '10px',
            padding: '12px 24px',
            display: 'flex',
          }}
        >
          <span style={{ color: '#D1D5DB', fontSize: '16px', fontWeight: '500' }}>{scanType}</span>
        </div>

        {riskScore !== null && (
          <div
            style={{
              background: riskColor + '22',
              border: '1px solid ' + riskColor,
              borderRadius: '10px',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: '#9CA3AF', fontSize: '14px' }}>Risk Score</span>
            <span style={{ color: riskColor, fontSize: '18px', fontWeight: '700' }}>
              {riskScore}/100
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '52px',
          left: '72px',
          right: '72px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #1F2937',
          paddingTop: '20px',
        }}
      >
        <span style={{ color: '#4B5563', fontSize: '14px' }}>Scanned {scannedAt}</span>
        <span style={{ color: '#374151', fontSize: '13px' }}>{id}</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}
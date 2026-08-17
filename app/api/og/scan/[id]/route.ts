/**
 * Dynamic Open Graph Image API — Phase 6
 *
 * Generates a social-preview image for a shared scan snapshot.
 * Uses Next.js 15 built-in ImageResponse (next/og).
 * Written without JSX to stay in a .ts file.
 *
 * GET /api/og/scan/[id]
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getSnapshot } from '@/lib/snapshots/snapshotService';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // Fetch snapshot data
  const snapshot = await getSnapshot(id).catch(() => null);

  const symbol = snapshot?.tokenSymbol ?? '???';
  const name = snapshot?.tokenName ?? 'Unknown Token';
  const chain = snapshot?.chain?.toUpperCase() ?? 'UNKNOWN';
  const result = snapshot?.resultJson as Record<string, any> | undefined;

  const riskScore: number | null = result?.riskScore?.overallRiskScore ?? null;
  const riskLevel: string = result?.riskScore?.riskLevel ?? 'UNKNOWN';
  const priceUsd: number = result?.marketSummary?.priceUsd ?? 0;
  const scannedAt = snapshot?.scannedAt
    ? new Date(snapshot.scannedAt).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
    : 'Unknown date';

  const riskColor =
    riskScore === null ? '#94a3b8' :
    riskScore >= 80 ? '#ef4444' :
    riskScore >= 60 ? '#f97316' :
    riskScore >= 40 ? '#eab308' :
    '#22c55e';

  // Build element tree using React.createElement style objects
  // ImageResponse accepts a React element — we must use React.createElement or JSX.
  // Since this is a .ts file, we use dynamic import to avoid JSX parsing.
  const { createElement: h } = await import('react');

  const el = h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        padding: '64px',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative' as const,
      },
    },
    // Top accent bar
    h('div', {
      style: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: `linear-gradient(90deg, ${riskColor}, transparent)`,
      },
    }),
    // Chain label
    h('div', {
      style: { fontSize: '13px', color: '#64748b', letterSpacing: '0.1em', marginBottom: '40px', display: 'flex' },
    }, `OnChain Scanner · ${chain}`),
    // Token name
    h('div', {
      style: { fontSize: '60px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', display: 'flex', marginBottom: '8px' },
    }, symbol),
    h('div', {
      style: { fontSize: '24px', color: '#94a3b8', display: 'flex', marginBottom: '32px' },
    }, name),
    // Metrics row
    h('div', {
      style: { display: 'flex', gap: '32px', alignItems: 'flex-end' as const },
    },
      // Risk score block
      riskScore !== null ? h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column' as const,
          background: riskColor + '18',
          border: `1px solid ${riskColor}55`,
          borderRadius: '12px',
          padding: '16px 24px',
        },
      },
        h('div', { style: { fontSize: '13px', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'flex' } }, 'Risk Score'),
        h('div', { style: { fontSize: '48px', fontWeight: 900, color: riskColor, lineHeight: 1, display: 'flex' } }, String(riskScore)),
        h('div', { style: { fontSize: '13px', color: riskColor, letterSpacing: '0.08em', display: 'flex' } }, riskLevel)
      ) : null,
      // Price block
      priceUsd > 0 ? h('div', { style: { display: 'flex', flexDirection: 'column' as const } },
        h('div', { style: { fontSize: '13px', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'flex' } }, 'Price'),
        h('div', { style: { fontSize: '28px', fontWeight: 700, color: '#e2e8f0', display: 'flex' } }, `$${priceUsd.toPrecision(4)}`)
      ) : null,
      // Date block
      h('div', { style: { display: 'flex', flexDirection: 'column' as const } },
        h('div', { style: { fontSize: '13px', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'flex' } }, 'Scanned'),
        h('div', { style: { fontSize: '18px', color: '#94a3b8', display: 'flex' } }, scannedAt)
      )
    ),
    // Snapshot ID footer
    h('div', {
      style: { position: 'absolute' as const, bottom: '32px', right: '64px', fontSize: '12px', color: '#334155', fontFamily: 'monospace', display: 'flex' },
    }, id)
  );

  return new ImageResponse(el, { width: 1200, height: 630 });
}

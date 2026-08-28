/**
 * /scan/[id] -- Public Shareable Scan Result Page
 *
 * SSR page that loads a stored snapshot and renders the scan result with
 * a snapshot banner, Open Graph meta tags, and a "View live data" link.
 * Shows a clean 404 if the snapshot does not exist or has expired.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSnapshot, SnapshotRecord } from '@/lib/snapshots/snapshotService';

// --- Meta tag generator --------------------------------------------------

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const snapshot = await getSnapshot(id).catch(() => null);

  if (!snapshot) {
    return {
      title: 'Scan Not Found -- OnChain Alpha Scanner',
      description: 'This scan result does not exist or has expired.',
    };
  }

  const label = snapshot.tokenSymbol
    ? `${snapshot.tokenSymbol} (${snapshot.chain.toUpperCase()})`
    : snapshot.tokenAddress;

  const scanTypeLabel =
    snapshot.scanType === 'deep' ? 'Deep Scan'
    : snapshot.scanType === 'elevator' ? 'Elevator Scan'
    : 'Basic Scan';

  const scannedDate = new Date(snapshot.scannedAt).toUTCString();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://scanner.app';
  const ogImageUrl = `${baseUrl}/api/og/scan/${id}`;
  const pageUrl = `${baseUrl}/scan/${id}`;

  return {
    title: `${label} ${scanTypeLabel} -- OnChain Alpha Scanner`,
    description: `${scanTypeLabel} result for ${label}. Scanned on ${scannedDate} UTC.`,
    openGraph: {
      title: `${label} ${scanTypeLabel} -- OnChain Alpha`,
      description: `${scanTypeLabel} result for ${label}. Scanned ${scannedDate} UTC.`,
      url: pageUrl,
      siteName: 'OnChain Alpha Scanner',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${label} scan result` }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${label} ${scanTypeLabel} -- OnChain Alpha`,
      description: `${scanTypeLabel} result for ${label}. Scanned ${scannedDate} UTC.`,
      images: [ogImageUrl],
    },
  };
}

// --- Snapshot banner component -------------------------------------------

function SnapshotBanner({ snapshot }: { snapshot: SnapshotRecord }) {
  const formattedDate = new Date(snapshot.scannedAt).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', timeZoneName: 'short',
  });

  return (
    <div className="w-full bg-amber-950/30 border border-amber-700/40 rounded-lg px-4 py-3 mb-6 flex items-start gap-3">
      <span className="text-amber-400 text-lg mt-0.5">📸</span>
      <div className="flex-1 min-w-0">
        <p className="text-amber-300 font-medium text-sm">
          Snapshot · Scanned on {formattedDate}
        </p>
        <p className="text-amber-200/70 text-xs mt-0.5">
          This result reflects on-chain data at the time of scanning. It is a
          permanent, read-only record.
        </p>
      </div>
    </div>
  );
}

// --- Main page -----------------------------------------------------------

export default async function SharedScanPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const snapshot = await getSnapshot(id).catch(() => null);

  if (!snapshot) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://scanner.app';
  const tokenLabel = snapshot.tokenSymbol ?? snapshot.tokenAddress;
  const freshScanUrl = `${baseUrl}/?address=${encodeURIComponent(snapshot.tokenAddress)}&chain=${snapshot.chain}`;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 max-w-5xl mx-auto">
      <SnapshotBanner snapshot={snapshot} />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{tokenLabel}</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {snapshot.tokenName ?? snapshot.tokenAddress} ·{' '}
            <span className="uppercase text-gray-500">{snapshot.chain}</span>
          </p>
        </div>
        <a
          href={freshScanUrl}
          className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          View live data →
        </a>
      </div>

      {/* Result payload -- production builds swap this for real result components */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 overflow-auto">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 font-mono">
          {snapshot.scanType} scan result
        </p>
        <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all font-mono leading-relaxed">
          {JSON.stringify(snapshot.resultJson, null, 2)}
        </pre>
      </div>

      <p className="text-center text-gray-600 text-xs mt-8">
        OnChain Alpha Scanner · Snapshot ID: {snapshot.id} · View count: {snapshot.viewCount}
      </p>
    </main>
  );
}

// Revalidate on every request so view count and expiry are always fresh
export const revalidate = 0;
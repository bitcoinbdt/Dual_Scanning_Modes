/**
 * /scan/[id] -- Public Shareable Scan Result Page (Server Component)
 *
 * Fetches the snapshot from Supabase, generates OG meta tags, renders the
 * snapshot banner, and delegates all client-side rendering to ScanResultClient.
 * Shows a clean 404 if the snapshot does not exist or has expired.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSnapshot, SnapshotRecord } from '@/lib/snapshots/snapshotService';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/Footer';
import ScanResultClient from './ScanResultClient';

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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://scanner.coinxera.com';
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

// --- Snapshot banner (server-rendered, no JS needed) ----------------------

function SnapshotBanner({ snapshot }: { snapshot: SnapshotRecord }) {
  const formattedDate = new Date(snapshot.scannedAt).toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', timeZoneName: 'short',
  });

  return (
    <div className="w-full bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
      <span className="text-amber-400 text-lg mt-0.5 shrink-0">📸</span>
      <div className="flex-1 min-w-0">
        <p className="text-amber-300 font-semibold text-sm">
          Snapshot · Scanned on {formattedDate}
        </p>
        <p className="text-amber-200/70 text-xs mt-0.5">
          This result reflects on-chain data at the time of scanning. It is a permanent, read-only record.
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

  return (
    <div className="min-h-screen bg-themed text-themed flex flex-col">
      <Navigation />
      <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
        <SnapshotBanner snapshot={snapshot} />

        {/* All client rendering (DeepScanResultView, FallbackSummaryCard) lives here */}
        <ScanResultClient
          snapshotId={snapshot.id}
          scanType={snapshot.scanType}
          chain={snapshot.chain}
          tokenAddress={snapshot.tokenAddress}
          tokenSymbol={snapshot.tokenSymbol}
          tokenName={snapshot.tokenName}
          viewCount={snapshot.viewCount}
          result={snapshot.resultJson}
        />
      </main>
      <Footer />
    </div>
  );
}

// Revalidate on every request so view count and expiry are always fresh
export const revalidate = 0;
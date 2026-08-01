'use client';

import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

interface TrustScore {
  verifiedCount: number;
  totalChecked: number;
  score: number;
  discrepancies: Array<{
    hash: string;
    field: string;
    expected: any;
    actual: any;
    reason: string;
  }>;
}

interface VerificationBadgeProps {
  trustScore?: TrustScore;
}

/**
 * Verification Badge Component
 * Displays data trust status and verified score based on on-chain sample checks
 */
export function VerificationBadge({ trustScore }: VerificationBadgeProps) {
  if (!trustScore || trustScore.totalChecked === 0) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-slate-400 border border-white/10 flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5" />
        Verification Pending
      </span>
    );
  }

  const { score, verifiedCount, totalChecked, discrepancies } = trustScore;

  let badgeColor = 'bg-green-500/10 text-green-400 border-green-500/25';
  let badgeText = 'Data Verified';
  let Icon = ShieldCheck;

  if (score < 50) {
    badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/25 animate-pulse';
    badgeText = 'Unverified Data';
    Icon = ShieldAlert;
  } else if (score < 100) {
    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    badgeText = 'Partial Match';
    Icon = ShieldAlert;
  }

  const tooltipText = discrepancies.length > 0
    ? `Discrepancies: ${discrepancies.map(d => `${d.field} mismatch (${d.reason})`).join(', ')}`
    : `Cross-checked a random sample of ${verifiedCount}/${totalChecked} trades against on-chain receipt logs. All values match.`;

  return (
    <span 
      title={tooltipText}
      className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-help ${badgeColor}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {badgeText} ({score}%)
    </span>
  );
}

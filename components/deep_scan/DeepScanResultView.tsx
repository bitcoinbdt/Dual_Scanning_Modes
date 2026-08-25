'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Users,
  Droplets,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  Globe,
  Copy,
  Check,
} from 'lucide-react';
import { InfoTooltip } from '@/components/InfoTooltip';
import type {
  DeepScanResult,
  EvidenceNode,
  RiskLevel,
  SubScore,
  PositionSizeResult,
  WhaleExitScenario,
  WhaleEntry,
} from '@/lib/deep_scan/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return 'N/A';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null || !isFinite(v)) return 'N/A';
  return `${v.toFixed(decimals)}%`;
}

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null || !isFinite(v)) return 'N/A';
  return v.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/** Shorten a wallet/contract address to first-6 … last-4 chars. */
function fmtAddr(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const RISK_COLORS: Record<RiskLevel, { text: string; bg: string; border: string; hex: string }> = {
  low:      { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', hex: '#10b981' },
  medium:   { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   hex: '#f59e0b' },
  high:     { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/40',  hex: '#f97316' },
  critical: { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/40',     hex: '#ef4444' },
};

function riskColor(level: RiskLevel) {
  return RISK_COLORS[level] ?? RISK_COLORS.medium;
}

function riskGaugeColor(score: number): string {
  if (score < 30) return '#10b981';
  if (score < 55) return '#f59e0b';
  if (score < 75) return '#f97316';
  return '#ef4444';
}


interface TokenUnlockInfo {
  totalLockedPercentage: number;
  nextUnlockAt: string | null;
  nextUnlockPercentage: number;
  nextUnlockUsdValue: number | null;
  badge: string;
  vestingDetails: any;
  airdropPercentage: number;
}

function UnlockCountdownBanner({ schedule }: { schedule: TokenUnlockInfo }) {
  if (!schedule || !schedule.nextUnlockAt) return null;
  const nextUnlockDate = new Date(schedule.nextUnlockAt);
  const diffMs = nextUnlockDate.getTime() - Date.now();
  if (diffMs <= 0) return null;

  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  const isCritical = diffHours < 24;
  const isEmerging = diffHours < 72; // < 3 days

  const colorClass = isCritical
    ? 'bg-red-500/10 border-red-500/30 text-red-400'
    : isEmerging
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';

  const timeRemainingStr = diffDays >= 1
    ? `${Math.floor(diffDays)}d ${Math.floor(diffHours % 24)}h remaining`
    : `${Math.floor(diffHours)}h ${Math.floor((diffMs / (1000 * 60)) % 60)}m remaining`;

  return (
    <div className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${colorClass}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
          {isCritical ? '🚨 CRITICAL UNLOCK RISK' : isEmerging ? '⚠️ EMERGING UNLOCK RISK' : '🛡️ Vesting Lock Active'}
        </p>
        <p className="text-xs text-white/70 mt-1">
          {schedule.nextUnlockPercentage}% of supply ({schedule.nextUnlockUsdValue != null ? fmtUsd(schedule.nextUnlockUsdValue) : 'N/A'}) unlocks on{' '}
          <strong>{nextUnlockDate.toLocaleString()}</strong>.
        </p>
      </div>
      <div className="shrink-0 font-mono text-xs font-bold bg-white/5 border border-current px-2.5 py-1 rounded-lg">
        {timeRemainingStr}
      </div>
    </div>
  );
}

// ─── Copyable Deployer Address ─────────────────────────────────────────────────

function CopyableDeployer({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="text-xs flex items-center gap-1">
      <span className="text-white/40">Deployer</span>
      <span
        className="font-mono font-bold text-white/70"
        title={address}
      >
        {fmtAddr(address)}
      </span>
      <button
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy deployer address'}
        className="ml-0.5 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
      >
        {copied
          ? <Check className="w-3 h-3 text-emerald-400" />
          : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ─── Risk Score Gauge ──────────────────────────────────────────────────────────

function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const r = 54;
  const cx = 64;
  const cy = 64;
  const strokeWidth = 10;
  const circumference = Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  const color = riskGaugeColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg width="128" height="80" viewBox="0 0 128 80" className="overflow-visible">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" fontFamily="monospace">
          {score}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill={color} fontSize="9" fontWeight="600" letterSpacing="2">
          {level.toUpperCase()}
        </text>
      </svg>
      <div className="flex gap-2 mt-1">
        {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((l) => (
          <div
            key={l}
            className={`w-2 h-2 rounded-full transition-opacity ${l === level ? 'opacity-100' : 'opacity-20'}`}
            style={{ background: RISK_COLORS[l].hex }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'intel',     label: 'Intelligence',    icon: Shield    },
  { id: 'risk',      label: 'Risk Breakdown',  icon: BarChart2 },
  { id: 'whales',    label: 'Whale & Cohorts', icon: Users     },
  { id: 'liquidity', label: 'Liquidity',       icon: Droplets  },
  { id: 'evidence',  label: 'Evidence',        icon: FileText  },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Panel: Intelligence ───────────────────────────────────────────────────────

function IntelligencePanel({ data }: { data: DeepScanResult }) {
  const intel = data.traderIntelligence;
  if (!intel) return (
    <div className="text-center py-8 text-white/40 text-sm">Intelligence report unavailable for this scan.</div>
  );

  const sections = [
    { label: 'Market Regime',        text: intel.regimeNarrative },
    { label: 'Execution Conditions', text: intel.executionConditions },
    { label: 'Holder Risk',          text: intel.holderRisk },
    { label: 'Volume Quality',       text: intel.volumeQuality },
    { label: 'Buyer Quality',        text: intel.buyerQualityAssessment },
    { label: 'Capital Efficiency',   text: intel.capitalEfficiencyAssessment },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-4 border" style={{ background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.3)' }}>
        <p className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Executive Summary</p>
        <p className="text-sm text-white/90 leading-relaxed">{intel.executiveSummary || 'No summary available.'}</p>
      </div>

      {intel.topRisksSummary && intel.topRisksSummary.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3">⚠ Top Risk Signals</p>
          <ul className="space-y-2">
            {intel.topRisksSummary.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sections.map(({ label, text }) => (
          <div key={label} className="rounded-lg p-3 bg-white/5 border border-white/[0.08]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">{label}</p>
            <p className="text-xs text-white/75 leading-relaxed">{text || '—'}</p>
          </div>
        ))}
      </div>


      {intel.dataLimitations && intel.dataLimitations.length > 0 && (
        <div className="rounded-lg p-3 border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.06)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2">Data Limitations</p>
          <ul className="space-y-1">
            {intel.dataLimitations.map((l, i) => (
              <li key={i} className="text-xs text-amber-200/70">• {l}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Project Presence Section */}
      {data.socials && (
        <div className="rounded-xl p-4 bg-white/5 border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Project Presence & Off-Chain Trust</p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
              data.socials.consistency.consistent
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {data.socials.consistency.consistent ? 'Consistency: Agreed' : '⚠️ Link Conflicts'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Website info */}
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Website</p>
                {data.socials.links.website ? (
                  <a href={data.socials.links.website} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline font-mono mt-1 break-all block">
                    {data.socials.links.website}
                  </a>
                ) : (
                  <p className="text-white/30 font-mono mt-1">Not Found</p>
                )}
              </div>
              {data.socials.links.website && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 text-[10px] font-mono">
                  <span className={`px-1.5 py-0.5 rounded ${
                    data.socials.websiteAlive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {data.socials.websiteAlive ? 'Live (HEAD 200)' : 'Dead / Down'}
                  </span>
                  {data.socials.websiteDomainAgeDays !== null && (
                    <span className="text-white/40">Domain age: {data.socials.websiteDomainAgeDays}d</span>
                  )}
                </div>
              )}
            </div>

            {/* Twitter info */}
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Twitter</p>
                {data.socials.links.twitter ? (
                  <a href={data.socials.links.twitter} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline font-mono mt-1 break-all block">
                    {data.socials.links.twitter}
                  </a>
                ) : (
                  <p className="text-white/30 font-mono mt-1">Not Found</p>
                )}
              </div>
              {data.socials.links.twitter && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 text-[10px] font-mono">
                  <span className="text-white/40">
                    {data.socials.twitterAccountAgeDays !== null
                      ? `Account Age: ${data.socials.twitterAccountAgeDays}d`
                      : 'Age unknown (API key not configured)'}
                  </span>
                </div>
              )}
            </div>

            {/* Telegram & Discord */}
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide mb-1.5">Social Channels</p>
              <div className="space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-white/50">Telegram:</span>
                  {data.socials.links.telegram ? (
                    <a href={data.socials.links.telegram} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                      Joined ↗
                    </a>
                  ) : (
                    <span className="text-white/30">None</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Discord:</span>
                  {data.socials.links.discord ? (
                    <a href={data.socials.links.discord} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                      Joined ↗
                    </a>
                  ) : (
                    <span className="text-white/30">None</span>
                  )}
                </div>
              </div>
            </div>

            {/* GitHub Info */}
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide font-sans">GitHub Repository</p>
                {data.socials.links.github ? (
                  <a href={data.socials.links.github} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline font-mono mt-1 break-all block">
                    {data.socials.links.github}
                  </a>
                ) : (
                  <p className="text-white/30 font-mono mt-1">None</p>
                )}
              </div>
              {data.socials.links.github && data.socials.githubLastCommitDays !== null && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 text-[10px] font-mono">
                  <span className={`px-1.5 py-0.5 rounded ${
                    data.socials.githubLastCommitDays > 90 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {data.socials.githubLastCommitDays > 90 ? 'Stale' : 'Active'}
                  </span>
                  <span className="text-white/40">Last commit: {data.socials.githubLastCommitDays}d ago</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CEX Listings Section */}
      {data.exchangeListing && (
        <div className="rounded-xl p-4 bg-white/5 border border-white/[0.08] space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Centralized Exchange (CEX) Listings</p>
          {data.exchangeListing.status === 'error' ? (
            <p className="text-xs text-red-400/80">CEX listing verification failed.</p>
          ) : data.exchangeListing.listings.length === 0 ? (
            <p className="text-xs text-white/40 font-mono">No CEX listing announcements found in the last 30 days or scheduled in the next 30 days.</p>
          ) : (
            <div className="space-y-2">
              {data.exchangeListing.listings.map((l, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white/[0.02] border border-white/5 rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white/90">{l.exchange}</span>
                    <span className="text-white/20">•</span>
                    <span className="text-white/50 capitalize font-mono">{l.listingType}</span>
                    {l.sourceUrl && (
                      <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                        Announcement ↗
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    {l.priceAtListingUsd && (
                      <span className="text-white/70">Price: ${l.priceAtListingUsd.toFixed(4)}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      l.listingStatus === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      l.listingStatus === 'live' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {l.listingStatus.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.exchangeListing.summary && (
            <p className="text-xs text-white/60 leading-relaxed italic mt-2 border-t border-white/5 pt-2">
              &ldquo;{data.exchangeListing.summary}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* AI News Intelligence Section */}
      {data.news && (
        <div className="rounded-xl p-4 bg-white/5 border border-white/[0.08] space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Recent News & Protocol Intelligence</p>
          {data.news.status === 'error' ? (
            <p className="text-xs text-red-400/80">News intelligence retrieval failed.</p>
          ) : data.news.articles.length === 0 ? (
            <p className="text-xs text-white/40 font-mono">No significant news articles detected in the last 7 days.</p>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {data.news.articles.map((art, i) => (
                <div key={i} className="flex flex-col gap-1 p-2 bg-white/[0.02] border border-white/5 rounded-lg text-xs">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold text-white/80">{art.title}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 font-mono ${
                      art.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                      art.sentiment === 'negative' ? 'bg-red-500/10 text-red-400' :
                      'bg-white/5 text-white/40'
                    }`}>
                      {art.sentiment.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1 font-mono">
                    {art.sourceName && <span>{art.sourceName}</span>}
                    {art.publishedDate && <span>• {art.publishedDate}</span>}
                    {art.url && (
                      <a href={art.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                        Read More ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.news.summary && (
            <p className="text-xs text-white/70 leading-relaxed border-t border-white/5 pt-2">
              <strong>AI News Analysis:</strong> {data.news.summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Panel: Risk Breakdown ─────────────────────────────────────────────────────

function RiskBreakdownPanel({ data }: { data: DeepScanResult }) {
  const rs = data.riskScore;
  if (!rs) return (
    <div className="text-center py-8 text-white/40 text-sm">Risk score unavailable for this scan.</div>
  );
  // Sort: measured modules first (by contribution desc), then unavailable modules
  const sorted = [...(rs.subScores || [])].sort((a, b) => {
    if (a.dataAvailability === 'measured' && b.dataAvailability !== 'measured') return -1;
    if (a.dataAvailability !== 'measured' && b.dataAvailability === 'measured') return 1;
    return b.weightedContribution - a.weightedContribution;
  });

  return (
    <div className="space-y-4">
      {rs.scoreCompleteness === 'partial' && (
        <div className="rounded-lg px-3 py-2 border border-amber-500/30" style={{ background: 'rgba(245,158,11,0.06)' }}>
          <p className="text-[10px] text-amber-400/80">
            ⚠ Partial score — {rs.availableModuleCount}/{rs.totalModuleCount} modules measured.
            Unavailable modules are excluded from the weighted average.
          </p>
        </div>
      )}
      {rs.scoreCompleteness === 'insufficient_data' && (
        <div className="rounded-lg px-3 py-2 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-[10px] text-white/40">No module produced sufficient data to compute a risk score.</p>
        </div>
      )}

      {rs.mitigators && rs.mitigators.length > 0 && (
        <div className="rounded-xl p-4 border border-emerald-500/20" style={{ background: 'rgba(16,185,129,0.06)' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">✓ Mitigating Factors</p>
          <div className="space-y-2">
            {rs.mitigators.map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-white/75">{m.name}</span>
                <span className="text-xs font-mono text-emerald-400">−{m.reductionPoints} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((s: SubScore) => {
          const isMeasured = s.dataAvailability === 'measured';
          const barWidth = isMeasured ? Math.min(100, s.score) : 0;
          const barColor = s.score < 30 ? '#10b981' : s.score < 55 ? '#f59e0b' : s.score < 75 ? '#f97316' : '#ef4444';
          return (
            <div key={s.module} className="rounded-lg p-3 border border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white/80">{s.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-white/40">w={fmtPct(s.weight * 100, 0)}</span>
                  {isMeasured ? (
                    <span className="text-xs font-mono font-bold" style={{ color: barColor }}>{s.score.toFixed(0)}</span>
                  ) : (
                    <span className="text-[10px] text-white/30 italic">
                      {s.dataAvailability === 'unavailable' ? 'Unavailable' : 'Insufficient data'}
                    </span>
                  )}
                </div>
              </div>
              {isMeasured ? (
                <>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: barColor, boxShadow: `0 0 6px ${barColor}` }}
                    />
                  </div>
                  {s.confidence < 50 && (
                    <p className="text-[9px] text-amber-400/60 mt-1">Low confidence ({fmtPct(s.confidence, 0)})</p>
                  )}
                </>
              ) : (
                <div className="h-1.5 rounded-full bg-white/[0.04]" />
              )}
            </div>
          );
        })}
      </div>
      <div className="text-right">
        <span className="text-[10px] text-white/30">Overall model confidence: {fmtPct(rs.confidence, 0)}</span>
      </div>
    </div>
  );
}


// ─── Panel: Whale & Cohorts ────────────────────────────────────────────────────

function WhaleCohortPanel({ data }: { data: DeepScanResult }) {
  const [showWhaleDetail, setShowWhaleDetail] = useState(false);
  const wh = data.whaleBehavior;
  const vc = data.volumeConcentration;
  const bq = data.buyerQuality;

  if (!wh || !vc || !bq) return (
    <div className="text-center py-8 text-white/40 text-sm">Whale and cohort data unavailable for this scan.</div>
  );

  const isWhaleAvailable = wh.status === 'ok';
  const isVolumeAvailable = vc.status === 'ok';
  const isBuyerAvailable = bq.status === 'ok' || bq.status === 'partial';

  const phaseIcon =
    wh.phase === 'accumulation' ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> :
    wh.phase === 'distribution' ? <ArrowDownRight className="w-4 h-4 text-red-400" /> :
    <Minus className="w-4 h-4 text-white/40" />;

  return (
    <div className="space-y-4">
      {/* Whale Behavior Section */}
      <div className="rounded-xl border border-white/[0.08] p-4 bg-white/[0.015] space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Whale Behavior Analysis</p>
        
        {!isWhaleAvailable ? (
          <div className="rounded-lg p-3 border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.06)' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Whale Analysis Unavailable
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              {wh.reason || 'Whale behavior and exit analysis are unavailable due to insufficient data or lack of holder snapshot data for this network.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                { label: 'Active Whales',     value: wh.activeWhaleCount?.toString() ?? 'N/A' },
                { label: 'Supply Share',      value: fmtPct(wh.totalWhaleSupplySharePct) },
                { label: 'Phase',             value: wh.phase ?? '—', extra: phaseIcon },
                { label: 'Net Inflow',        value: fmtNum(wh.whaleNetInflow, 0), positive: true },
                { label: 'Net Outflow',       value: fmtNum(wh.whaleNetOutflow, 0), positive: false },
                { label: 'Distribution Risk', value: wh.isDistributionRisk ? 'YES' : 'NO', warn: wh.isDistributionRisk },
              ] as Array<{ label: string; value: string; extra?: React.ReactNode; positive?: boolean; warn?: boolean }>).map((item) => (
                <div key={item.label} className="rounded-lg p-3 bg-white/5 border border-white/[0.08] flex flex-col gap-1">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">{item.label}</span>
                  <span className={`text-sm font-bold font-mono flex items-center gap-1 ${
                    item.warn ? 'text-red-400' :
                    item.positive === true  ? 'text-emerald-400' :
                    item.positive === false ? 'text-red-400' : 'text-white/90'
                  }`}>
                    {item.extra}{item.value}
                  </span>
                </div>
              ))}
            </div>

            {wh.dataSemanticWarning && (
              <div className="rounded-lg p-2.5 border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.06)' }}>
                <p className="text-[10px] text-amber-300/70">{wh.dataSemanticWarning}</p>
              </div>
            )}

            {/* G-1: Individual whale wallet detail — collapsible */}
            {wh.whales && wh.whales.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <button
                  onClick={() => setShowWhaleDetail((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs text-white/40 hover:text-white/60 transition"
                >
                  <span className="font-bold uppercase tracking-widest">Whale Wallets ({wh.whales.length})</span>
                  {showWhaleDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <AnimatePresence>
                  {showWhaleDetail && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-1.5 border-t border-white/[0.06]">
                        {wh.whales.map((whale: WhaleEntry, i: number) => {
                          const flowColor = whale.netFlow > 0 ? 'text-emerald-400' : whale.netFlow < 0 ? 'text-red-400' : 'text-white/40';
                          const flowSign  = whale.netFlow > 0 ? '+' : '';
                          const holdingsUsd = whale.observedBatchBalance * data.marketSummary.priceUsd;
                          return (
                            <div
                              key={i}
                              className="rounded-lg p-2.5 border border-white/[0.06] mt-1.5"
                              style={{ background: 'rgba(255,255,255,0.015)' }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className="text-[10px] font-mono text-white/60 truncate flex-1 min-w-0"
                                  title={whale.wallet}
                                >
                                  {fmtAddr(whale.wallet)}
                                </p>
                                <span className="text-[10px] font-mono font-bold text-white/80 shrink-0">
                                  {fmtUsd(holdingsUsd)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[9px] text-white/30">
                                  {fmtNum(whale.observedBatchBalance, 0)} tokens
                                </span>
                                <span className="text-[9px] text-white/30">
                                  {fmtPct(whale.supplySharePct)} supply
                                </span>
                                <span className="text-[9px] text-white/20">
                                  {whale.txCount} txs
                                </span>
                                <span className={`text-[9px] font-medium ${flowColor}`}>
                                  {whale.netFlow === 0 ? 'dormant' : `${flowSign}${fmtNum(whale.netFlow, 0)} flow`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[9px] text-white/20 pt-1">Balances are local batch observations — not authoritative on-chain state.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      {/* Volume Concentration Section */}
      <div className="rounded-xl border border-white/[0.08] p-4 bg-white/[0.015] space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Volume Concentration Analysis</p>

        {!isVolumeAvailable ? (
          <div className="rounded-lg p-3 border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.06)' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Volume HHI Metrics Unavailable
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              {vc.reason || 'Volume concentration metrics are unavailable due to insufficient transaction data in this scanned window.'}
            </p>
          </div>
        ) : (
          <>
            {/* G-3: 3-column HHI grid — buyer / seller / combined */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                { label: 'Buyer HHI',    hhi: vc.buyerHHI },
                { label: 'Seller HHI',   hhi: vc.sellerHHI },
                { label: 'Combined HHI', hhi: vc.totalVolumeHHI },
              ] as Array<{ label: string; hhi: typeof vc.buyerHHI }>).map(({ label, hhi }) => (
                <div key={label} className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.08]">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">{label}</p>
                  <p className="text-2xl font-mono font-bold text-white">{hhi?.hhi?.toFixed(4) ?? 'N/A'}</p>
                  <p className={`text-xs mt-1 capitalize ${
                    hhi?.concentrationLevel === 'extreme'  ? 'text-red-400'    :
                    hhi?.concentrationLevel === 'high'     ? 'text-orange-400' :
                    hhi?.concentrationLevel === 'moderate' ? 'text-amber-400'  : 'text-emerald-400'
                  }`}>{hhi?.concentrationLevel ?? '—'}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.08] space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Volume Metrics Summary</p>
              {([
                { label: 'Buy Volume',          value: fmtUsd(vc.totalBuyVolumeUsd),                  color: 'text-emerald-400' },
                { label: 'Sell Volume',         value: fmtUsd(vc.totalSellVolumeUsd),                 color: 'text-red-400'     },
                { label: 'Buy/Sell Ratio',      value: vc.buySellRatio?.toFixed(2) ?? 'N/A',          color: 'text-white/90'    },
                { label: 'Organic Score',       value: fmtPct(vc.organicScore),                        color: 'text-purple-400' },
                { label: 'Wash Vol (Elevator)', value: fmtPct((vc.washVolumeRatio ?? 0) * 100),       color: 'text-amber-400'   },
              ] as Array<{ label: string; value: string; color: string }>).map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-white/60">{label}</span>
                  <span className={`font-mono ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Buyer Quality Section */}
      <div className="rounded-xl border border-white/[0.08] p-4 bg-white/[0.015] space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Buyer Quality Metrics</p>

        {!isBuyerAvailable ? (
          <div className="rounded-lg p-3 border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.06)' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Buyer Quality Unavailable
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              {bq.reason || 'Buyer quality and cohort metrics are unavailable due to insufficient buyer data.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.08] space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Buyer Cohort Summary</p>
            {([
              { label: 'Quality Score',    value: `${bq.buyerQualityScore?.toFixed(0) ?? 'N/A'} / 100`, color: 'text-purple-400' },
              { label: 'Unique Buyers',    value: bq.cohortMetrics?.totalBuyers?.toString() ?? 'N/A',      color: 'text-white/80'   },
              { label: 'Returning Buyers', value: fmtPct((bq.cohortMetrics?.returningBuyerRatio ?? 0) * 100), color: 'text-white/80' },
              { label: 'Avg Buy Size',     value: fmtUsd(bq.cohortMetrics?.avgBuyValueUsd),               color: 'text-white/80'   },
            ] as Array<{ label: string; value: string; color: string }>).map(({ label, value, color }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-white/60">{label}</span>
                <span className={`font-mono font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel: Liquidity ─────────────────────────────────────────────────────────

function LiquidityPanel({ data }: { data: DeepScanResult }) {
  const amm = data.ammSlippage;
  const cap = data.capitalEfficiency;
  const wx  = data.whaleExit;

  if (!cap) return (
    <div className="text-center py-8 text-white/40 text-sm">Liquidity data unavailable for this scan.</div>
  );

  const crossPools = data.marketSummary?.crossChainPools ?? [];
  const totalMultichainUsd = data.marketSummary?.totalCrossChainLiquidityUsd ?? cap.totalLiquidityUsd;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: 'Pool Liquidity', value: fmtUsd(totalMultichainUsd) },
          { label: 'FDV',            value: fmtUsd(cap.fdvUsd) },
          { label: 'FDV/Liq Ratio', value: cap.fdvToLiquidityRatio != null ? `${cap.fdvToLiquidityRatio.toFixed(1)}x` : 'N/A' },
          { label: 'Sensitivity',    value: cap.sensitivity ?? '—' },
        ] as Array<{ label: string; value: string }>).map(({ label, value }) => (
          <div key={label} className="rounded-lg p-3 bg-white/5 border border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
            <p className="text-sm font-bold font-mono text-white/90 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Multichain & Cross-Chain Liquidity Table */}
      {crossPools.length > 0 && (
        <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-purple-400" /> Multichain &amp; Cross-Chain Liquidity Pools
            </p>
            <span className="text-xs font-bold font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              Multichain Total: {fmtUsd(totalMultichainUsd)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium">Chain</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium">DEX</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium">Pair</th>
                  <th className="text-right py-2 px-3 text-white/40 font-medium">Liquidity</th>
                </tr>
              </thead>
              <tbody>
                {crossPools.map((pool, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 text-white/90 font-bold uppercase">{pool.chain}</td>
                    <td className="py-2 px-3 text-purple-300 font-semibold">{pool.dex}</td>
                    <td className="py-2 px-3 text-white/80">{pool.pair}</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-bold">{fmtUsd(pool.liquidityUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {amm.status !== 'insufficient_data' && amm.simulations && amm.simulations.length > 0 ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">AMM Constant-Product Simulation</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium">Position</th>
                  <th className="text-right py-2 px-3 text-white/40 font-medium">Price Impact</th>
                  <th className="text-right py-2 px-3 text-white/40 font-medium">Slippage</th>
                  <th className="text-right py-2 px-3 text-white/40 font-medium">Exec. Price</th>
                  <th className="text-right py-2 px-3 text-white/40 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {amm.simulations.map((s: PositionSizeResult, i) => {
                  const rc = riskColor(s.exitRiskLevel);
                  const isOk = s.status === 'ok' && s.slippagePct < 90;
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-3 text-white/80">{fmtUsd(s.positionSizeUsd)}</td>
                      <td className="py-2 px-3 text-right" style={{ color: isOk ? rc.hex : undefined }}>
                        {isOk ? fmtPct(s.priceImpactPct) : 'N/A'}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: isOk ? rc.hex : undefined }}>
                        {isOk ? fmtPct(s.slippagePct) : 'N/A'}
                      </td>
                      <td className="py-2 px-3 text-right text-white/70">
                        {isOk ? `$${s.executionPriceUsd?.toFixed(6)}` : 'N/A'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {isOk && s.exitRiskLevel ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${rc.bg} ${rc.text}`}>
                            {s.exitRiskLevel.toUpperCase()}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/40 font-mono">
                            N/A
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {amm.isThinLiquidity && (
            <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Thin liquidity detected — even small positions face significant slippage.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.08] space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">AMM Constant-Product Simulation</p>
          <div className="rounded-lg p-3 border border-amber-500/20 bg-amber-500/5">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> AMM Simulation Unavailable
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              {amm.reason || 'Slippage simulation is unavailable. This typically occurs when there is no constant-product pool or spot price data.'}
            </p>
          </div>
        </div>
      )}
      
      {/* Whale Exit Simulation */}
      {wx.status !== 'insufficient_data' && wx.scenarios && wx.scenarios.length > 0 ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">Whale Exit Impact Scenarios</p>
          <p className="text-[10px] text-white/30 mb-3">{wx.simulationDisclaimer}</p>
          <div className="space-y-2">
            {wx.scenarios.map((sc: WhaleExitScenario, i) => {
              const sev = riskColor(sc.severity as RiskLevel);
              return (
                <div key={i} className={`rounded-lg p-3 border flex items-center justify-between ${sev.bg} ${sev.border}`}>
                  <div>
                    <p className="text-xs font-bold text-white/80">Whale sells {sc.label} of position</p>
                    <p className="text-[10px] text-white/50">{fmtNum(sc.simulatedTokensSold, 0)} tokens · {fmtUsd(sc.simulatedUsdValueAtSpot)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-mono font-bold ${sev.text}`}>{fmtPct(sc.priceImpactPct)} impact</p>
                    <p className="text-[10px] text-white/40">{sc.severity.toUpperCase()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.08] space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">Whale Exit Impact Scenarios</p>
          <div className="rounded-lg p-3 border border-amber-500/20 bg-amber-500/5">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Exit Simulation Unavailable
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              {wx.reason || 'Whale liquidation scenarios cannot be simulated due to insufficient whale data or missing pools.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: Evidence ──────────────────────────────────────────────────────────

function EvidenceNodeCard({ node }: { node: EvidenceNode }) {
  const [open, setOpen] = useState(false);
  const confidenceColor =
    node.confidence >= 70 ? 'text-emerald-400' :
    node.confidence >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-0.5">{node.evidenceId}</p>
          <p className="text-xs text-white/80 leading-snug">{node.fact}</p>
          {node.signal && (
            <p className="text-[10px] text-cyan-400/80 mt-1">{node.signal}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono font-bold ${confidenceColor}`}>{node.confidence}%</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
              {node.metric && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Metric</p>
                  <p className="text-xs font-mono text-purple-300">{node.metric}</p>
                </div>
              )}
              {node.pattern && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Pattern vs Baseline</p>
                  <p className="text-xs text-white/70">{node.pattern}</p>
                </div>
              )}
              {node.traderImpact && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Trader Impact</p>
                  <p className="text-xs text-amber-200/80 leading-relaxed">{node.traderImpact}</p>
                </div>
              )}
              {node.sources && node.sources.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Sources ({node.sources.length})</p>
                  <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                    {node.sources.map((src, i) => (
                      <li key={i} className="text-[10px] font-mono text-white/40 truncate">• {src}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[9px] text-white/20">
                Generated {new Date(node.generatedAt * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EvidencePanel({ data }: { data: DeepScanResult }) {
  const nodes = data.evidence;

  if (!nodes || nodes.length === 0) {
    return (
      <div className="text-center py-10">
        <FileText className="w-8 h-8 text-white/10 mx-auto mb-3" />
        <p className="text-sm text-white/30">No evidence nodes collected for this scan.</p>
        <p className="text-[10px] text-white/20 mt-1">Evidence is generated when modules produce sufficient on-chain data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
          Evidence Nodes — {nodes.length} collected
        </p>
        <p className="text-[9px] text-white/20">Click any node to expand</p>
      </div>
      <div className="space-y-2">
        {nodes.map((node) => (
          <EvidenceNodeCard key={node.evidenceId} node={node} />
        ))}
      </div>
      <p className="text-[9px] text-white/20 leading-relaxed">
        Evidence nodes are structured observations generated by individual scan modules.
        They represent raw on-chain facts, derived metrics, and cross-module signals used to
        justify risk scores and trader intelligence conclusions.
      </p>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface DeepScanResultViewProps {
  result: DeepScanResult;
  tokenAddress: string;
}

export function DeepScanResultView({ result, tokenAddress }: DeepScanResultViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('intel');
  const [showLimitations, setShowLimitations] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const snapId = result.snapshotId;
    if (!snapId) return;

    const shareUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/scan/${snapId}`
      : `/scan/${snapId}`;

    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rs     = result.riskScore;
  const meta   = result.tokenMetadata;
  const market = result.marketSummary;
  // Defensive: riskScore may be absent on partial_failure scans
  const rc     = rs?.riskLevel ? riskColor(rs.riskLevel) : riskColor('medium' as RiskLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="glass-strong rounded-2xl p-6 border border-white/10 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 80% 50%, ${rc.hex}40, transparent 70%)` }}
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Deep Intelligence Report</span>
              </div>
              {result.snapshotId && (
                <button
                  onClick={handleCopyLink}
                  className="px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/30 text-[10px] font-bold tracking-wide uppercase transition-all shadow-md active:scale-95 flex items-center gap-1 ml-2"
                >
                  {copied ? '✓ Copied' : '🔗 Copy Share Link'}
                </button>
              )}
            </div>
            <h2 className="text-2xl font-black text-white">
              {meta?.name ?? '—'} <span className="text-white/40">/</span> <span className="font-mono text-lg text-white/70">{meta?.symbol ?? '—'}</span>
            </h2>
            <p className="text-xs font-mono text-white/30 mt-0.5 truncate max-w-xs">{tokenAddress}</p>
            <div className="flex flex-wrap gap-3 mt-3">
              <div className="text-xs">
                <span className="text-white/40">Price </span>
                <span className="font-mono font-bold text-white">${market?.priceUsd != null ? market.priceUsd.toFixed(8) : 'N/A'}</span>
              </div>
              <div className="text-xs">
                <span className="text-white/40">FDV </span>
                <span className="font-mono font-bold text-white">{fmtUsd(market?.fdvUsd)}</span>
              </div>
              {market?.volume24hUsd != null && (
                <div className="text-xs">
                  <span className="text-white/40">24h Vol </span>
                  <span className="font-mono font-bold text-white">{fmtUsd(market.volume24hUsd)}</span>
                </div>
              )}
              <div className="text-xs">
                <span className="text-white/40">Regime </span>
                <span className="font-mono font-bold text-cyan-400">{market?.marketRegime ?? 'N/A'}</span>
              </div>
              {/* G-2: Creator / deployer address with copy button */}
              {meta?.creatorAddress && (
                <CopyableDeployer address={meta.creatorAddress} />
              )}
            </div>
          </div>
          <div className="sm:shrink-0">
            {rs && rs.sufficientData ? (
              <div className="flex flex-col items-center gap-1">
                <RiskGauge score={rs.overallRiskScore} level={rs.riskLevel} />
                {rs.scoreCompleteness === 'partial' ? (
                  <span className="text-[9px] text-amber-400/70 mt-0.5 font-semibold" title="Not all modules could be measured. Unavailable modules are excluded from the score calculation.">
                    Partial ({rs.availableModuleCount}/{rs.totalModuleCount} modules)
                  </span>
                ) : (
                  <span className="text-[9px] text-emerald-400/70 mt-0.5 font-semibold">
                    Complete ({rs.availableModuleCount}/{rs.totalModuleCount} modules)
                  </span>
                )}
              </div>
            ) : (
              <div className="text-center p-4 border border-white/5 bg-white/[0.02] rounded-xl min-w-[128px] flex flex-col items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500/80 mb-1" />
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Insufficient Data</p>
                <p className="text-[9px] text-white/30 mt-0.5">Risk Score N/A</p>
              </div>
            )}
          </div>
        </div>
        <div className="relative mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-4 text-[10px] text-white/30">
          <span className="flex items-center gap-0.5">
            Txns: <span className="text-white/60">{result.dataQuality?.transactionCount ?? 'N/A'}</span>
            <InfoTooltip text="Total number of on-chain swap transactions ingested and analysed during this scan. A higher count improves pattern accuracy." />
          </span>
          <span className="flex items-center gap-0.5">
            Candles: <span className="text-white/60">{result.dataQuality?.ohlcvCandleCount ?? 'N/A'}</span>
            <InfoTooltip text="Number of OHLCV (Open / High / Low / Close / Volume) price candles fetched. Used for market-regime classification and trend detection." />
          </span>
          <span className="flex items-center gap-0.5">
            Confidence: <span className="text-white/60">{fmtPct(result.overallConfidence ?? 0, 0)}</span>
            <InfoTooltip text="Overall confidence score of the risk assessment — the percentage of analytical modules that returned sufficient data. Higher is more reliable." />
          </span>
          <span className="flex items-center gap-0.5">
            Duration: <span className="text-white/60">{result.scanDurationMs ? (result.scanDurationMs / 1000).toFixed(1) + 's' : 'N/A'}</span>
            <InfoTooltip text="Total wall-clock time taken to complete the deep scan, including all data collection, analysis, and AI inference steps." />
          </span>
          {result.dataQuality?.elevatorDataReused && <span className="text-cyan-400/60">↺ Elevator data reused</span>}
          {result.dataQuality?.staleDataWarning   && <span className="text-amber-400/70" title="Multiple data sources are stale">⚠ Stale data</span>}
          {!result.dataQuality?.staleDataWarning && result.dataQuality?.freshness?.isMarketDataStale && <span className="text-amber-400/50" title="Market price/liquidity data is older than threshold">⚠ Stale price</span>}
          {!result.dataQuality?.staleDataWarning && result.dataQuality?.freshness?.isOhlcvStale && <span className="text-amber-400/50" title="OHLCV candles are older than threshold">⚠ Stale candles</span>}
          {!result.dataQuality?.staleDataWarning && result.dataQuality?.freshness?.isTransactionStale && <span className="text-amber-400/50" title="Recent transactions are older than threshold">⚠ Stale txs</span>}
        </div>

      </div>

      {result.dataQuality?.staleDataWarning && (
        <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Stale Data Warning</p>
            <p className="text-xs text-white/70 leading-relaxed mt-0.5">
              Some of the scanned data sources are stale (older than the allowed freshness thresholds).
              Risk scores and simulations might be based on outdated information. Check data freshness indicators in the footer.
            </p>
          </div>
        </div>
      )}

      {result.tokenUnlockSchedule && (
        <UnlockCountdownBanner schedule={result.tokenUnlockSchedule} />
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 glass rounded-xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === id ? 'gradient-primary text-white shadow-lg' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="glass-strong rounded-2xl p-5 border border-white/10"
        >
          {activeTab === 'intel'     && <IntelligencePanel  data={result} />}
          {activeTab === 'risk'      && <RiskBreakdownPanel data={result} />}
          {activeTab === 'whales'    && <WhaleCohortPanel   data={result} />}
          {activeTab === 'liquidity' && <LiquidityPanel     data={result} />}
          {activeTab === 'evidence'  && <EvidencePanel      data={result} />}
        </motion.div>
      </AnimatePresence>

      {/* Limitations Accordion */}
      {result.limitations && result.limitations.length > 0 && (
        <div className="glass rounded-xl border border-white/[0.08] overflow-hidden">
          <button
            onClick={() => setShowLimitations(!showLimitations)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs text-white/40 hover:text-white/60 transition"
          >
            <span className="font-bold uppercase tracking-widest">Scan Limitations ({result.limitations.length})</span>
            {showLimitations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showLimitations && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-1">
                  {result.limitations.map((l, i) => (
                    <p key={i} className="text-[10px] text-white/40">• {l}</p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[9px] text-white/20 leading-relaxed">
        DISCLAIMER: Deep Intelligence Reports are generated from on-chain data analysis and are provided for informational purposes only.
        All whale balances are LOCAL BATCH OBSERVATIONS from the scanned transaction window, not authoritative on-chain state.
        Slippage and exit simulations are HYPOTHETICAL and do NOT represent actual transactions.
        This is not financial advice. Always perform your own research before making investment decisions.
      </p>
    </motion.div>
  );
}

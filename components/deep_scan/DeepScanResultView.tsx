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
} from 'lucide-react';
import type {
  DeepScanResult,
  RiskLevel,
  SubScore,
  PositionSizeResult,
  WhaleExitScenario,
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
    </div>
  );
}

// ─── Panel: Risk Breakdown ─────────────────────────────────────────────────────

function RiskBreakdownPanel({ data }: { data: DeepScanResult }) {
  const rs = data.riskScore;
  if (!rs) return (
    <div className="text-center py-8 text-white/40 text-sm">Risk score unavailable for this scan.</div>
  );
  const sorted = [...(rs.subScores || [])].sort((a, b) => b.weightedContribution - a.weightedContribution);

  return (
    <div className="space-y-4">
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
          const barWidth = Math.min(100, s.score);
          const barColor = s.score < 30 ? '#10b981' : s.score < 55 ? '#f59e0b' : s.score < 75 ? '#f97316' : '#ef4444';
          return (
            <div key={s.module} className="rounded-lg p-3 border border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white/80">{s.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-white/40">w={fmtPct(s.weight * 100, 0)}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: barColor }}>{s.score.toFixed(0)}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: barColor, boxShadow: `0 0 6px ${barColor}` }}
                />
              </div>
              {s.confidence < 0.5 && (
                <p className="text-[9px] text-amber-400/60 mt-1">Low confidence ({fmtPct(s.confidence * 100, 0)})</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-right">
        <span className="text-[10px] text-white/30">Overall model confidence: {fmtPct(rs.confidence * 100, 0)}</span>
      </div>
    </div>
  );
}

// ─── Panel: Whale & Cohorts ────────────────────────────────────────────────────

function WhaleCohortPanel({ data }: { data: DeepScanResult }) {
  const wh = data.whaleBehavior;
  const vc = data.volumeConcentration;
  const bq = data.buyerQuality;

  if (!wh || !vc || !bq) return (
    <div className="text-center py-8 text-white/40 text-sm">Whale and cohort data unavailable for this scan.</div>
  );

  const phaseIcon =
    wh.phase === 'accumulation' ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> :
    wh.phase === 'distribution' ? <ArrowDownRight className="w-4 h-4 text-red-400" /> :
    <Minus className="w-4 h-4 text-white/40" />;

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-2 gap-3">
        {([
          { label: 'Buyer HHI', hhi: vc.buyerHHI },
          { label: 'Seller HHI', hhi: vc.sellerHHI },
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
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Volume Concentration</p>
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

      <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.08] space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Buyer Cohort Quality</p>
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: 'Pool Liquidity', value: fmtUsd(cap.totalLiquidityUsd) },
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

      {amm.status !== 'insufficient_data' && amm.simulations && amm.simulations.length > 0 && (
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
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-3 text-white/80">{fmtUsd(s.positionSizeUsd)}</td>
                      <td className="py-2 px-3 text-right" style={{ color: s.status === 'ok' ? rc.hex : undefined }}>
                        {s.status === 'ok' ? fmtPct(s.priceImpactPct) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: s.status === 'ok' ? rc.hex : undefined }}>
                        {s.status === 'ok' ? fmtPct(s.slippagePct) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-white/70">
                        {s.status === 'ok' ? `$${s.executionPriceUsd?.toFixed(6)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {s.exitRiskLevel && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${rc.bg} ${rc.text}`}>
                            {s.exitRiskLevel.toUpperCase()}
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
      )}

      {wx.status !== 'insufficient_data' && wx.scenarios && wx.scenarios.length > 0 && (
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
      )}
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
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Deep Intelligence Report</span>
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
            </div>
          </div>
          <div className="sm:shrink-0">
            {rs?.sufficientData ? (
              <RiskGauge score={rs.overallRiskScore} level={rs.riskLevel} />
            ) : (
              <div className="text-center p-4">
                <p className="text-xs text-amber-400">{rs ? 'Insufficient data' : 'Risk score unavailable'}</p>
                <p className="text-[10px] text-white/30 mt-1">Score unavailable</p>
              </div>
            )}
          </div>
        </div>
        <div className="relative mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-4 text-[10px] text-white/30">
          <span>Txns: <span className="text-white/60">{result.dataQuality?.transactionCount ?? 'N/A'}</span></span>
          <span>Candles: <span className="text-white/60">{result.dataQuality?.ohlcvCandleCount ?? 'N/A'}</span></span>
          <span>Confidence: <span className="text-white/60">{fmtPct((result.overallConfidence ?? 0) * 100, 0)}</span></span>
          <span>Duration: <span className="text-white/60">{result.scanDurationMs ? (result.scanDurationMs / 1000).toFixed(1) + 's' : 'N/A'}</span></span>
          {result.dataQuality?.elevatorDataReused && <span className="text-cyan-400/60">↺ Elevator data reused</span>}
          {result.dataQuality?.staleDataWarning   && <span className="text-amber-400/70">⚠ Stale data</span>}
        </div>
      </div>

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

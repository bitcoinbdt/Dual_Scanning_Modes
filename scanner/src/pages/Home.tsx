import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Cpu,
  Zap,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Lock,
  Unlock,
  Activity,
  Database,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { InsufficientCreditsModal } from '@/components/InsufficientCreditsModal';
import {
  BASIC_SCAN_COST,
  ELEVATOR_OPTIONS,
  CHAINS,
} from '@/lib/types';
import {
  performBasicScan,
  performElevatorScan,
  detectChainLabel,
  BasicScanResult,
  ElevatorScanResult,
} from '@/lib/scanEngine';

interface HomeProps {
  onOpenCreditStore: (pkg?: string) => void;
}

export function Home({ onOpenCreditStore }: HomeProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'basic' | 'elevator'>('basic');
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('auto');
  const [elevatorOption, setElevatorOption] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [basicResult, setBasicResult] = useState<BasicScanResult | null>(null);
  const [elevatorResult, setElevatorResult] = useState<ElevatorScanResult | null>(null);
  const [showInsufficient, setShowInsufficient] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref && !user) {
      localStorage.setItem('oca-referral', ref.toUpperCase());
    }
  }, [searchParams, user]);

  const currentCost = mode === 'basic' ? BASIC_SCAN_COST : ELEVATOR_OPTIONS[elevatorOption].credits;
  const balance = profile?.credits ?? 0;
  const ambiguousChain = mode === 'elevator' && chain === 'auto' && detectChainLabel(address) === 'evm-ambiguous';

  const handleScan = async () => {
    if (!user) {
      showToast('Please sign in to scan tokens', 'error');
      return;
    }
    if (!address.trim()) {
      showToast('Enter a token address', 'error');
      return;
    }
    if (balance < currentCost) {
      setShowInsufficient(true);
      return;
    }

    setScanning(true);
    setBasicResult(null);
    setElevatorResult(null);

    try {
      const { error: deductError } = await supabase
        .from('profiles')
        .update({ credits: profile!.credits - currentCost })
        .eq('id', user.id);
      if (deductError) throw deductError;

      await refreshProfile();

      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

      if (mode === 'basic') {
        const result = performBasicScan(address.trim());
        setBasicResult(result);
        await supabase.from('scan_history').insert({
          user_id: user.id,
          mode: 'basic',
          chain: detectChainLabel(address.trim()),
          token_address: address.trim(),
          token_symbol: result.symbol,
          credits_spent: currentCost,
        });
      } else {
        const txCount = ELEVATOR_OPTIONS[elevatorOption].transactions;
        const result = performElevatorScan(address.trim(), chain, txCount);
        setElevatorResult(result);
        await supabase.from('scan_history').insert({
          user_id: user.id,
          mode: 'elevator',
          chain,
          token_address: address.trim(),
          token_symbol: result.symbol,
          credits_spent: currentCost,
        });
      }
      await refreshProfile();
      showToast('Scan complete!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      showToast(msg, 'error');
      await refreshProfile();
    } finally {
      setScanning(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    showToast('Copied to clipboard', 'success');
  };

  const riskColor = (level: string) =>
    level === 'Low'
      ? 'text-green-400 bg-green-400/10 border-green-400/30'
      : level === 'Medium'
        ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
        : level === 'High'
          ? 'text-orange-400 bg-orange-400/10 border-orange-400/30'
          : 'text-red-400 bg-red-400/10 border-red-400/30';

  return (
    <div className="min-h-screen bg-grid">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Scan Terminal */}
        <div className="glass-strong rounded-2xl p-6 sm:p-8 rgb-border mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="w-5 h-5 text-primary-themed" />
            <h1 className="text-2xl font-bold gradient-text">Acquire Target</h1>
          </div>

          {/* Mode selector */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => {
                setMode('basic');
                setBasicResult(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                mode === 'basic'
                  ? 'gradient-primary text-white'
                  : 'glass text-muted-themed hover:text-themed'
              }`}
            >
              Basic Scan ({BASIC_SCAN_COST} credits)
            </button>
            <button
              onClick={() => {
                setMode('elevator');
                setElevatorResult(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                mode === 'elevator'
                  ? 'gradient-primary text-white'
                  : 'glass text-muted-themed hover:text-themed'
              }`}
            >
              Elevator Deep Scan
            </button>
          </div>

          {mode === 'elevator' && (
            <div className="mb-5 space-y-4 animate-fade-in">
              <div>
                <label className="text-xs text-muted-themed mb-2 block">Blockchain</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CHAINS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChain(c.id)}
                      className={`py-2 rounded-lg text-xs font-medium border transition ${
                        chain === c.id
                          ? 'border-primary-themed glow-sm text-primary-themed'
                          : 'border-white/10 text-muted-themed hover:border-white/20'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-themed mb-2 block">Scan Depth</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ELEVATOR_OPTIONS.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setElevatorOption(i)}
                      className={`py-2 rounded-lg text-xs font-medium border transition ${
                        elevatorOption === i
                          ? 'border-primary-themed glow-sm text-primary-themed'
                          : 'border-white/10 text-muted-themed hover:border-white/20'
                      }`}
                    >
                      <div className="font-bold">{opt.transactions} Tx</div>
                      <div className="text-[10px] opacity-70">{opt.credits} credits</div>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="rounded-lg p-3 text-xs flex items-center gap-2"
                style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <Activity className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-blue-200">
                  Multi-chain support: Solana, BSC, and Ethereum. Auto-detect analyzes the address
                  format.
                </span>
              </div>

              {ambiguousChain && (
                <div
                  className="rounded-lg p-3 text-xs flex items-center gap-2"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-amber-200">
                    EVM address detected — select BSC or Ethereum explicitly for accurate results.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Address input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-themed" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter token contract address..."
              className="w-full bg-themed border border-themed rounded-lg pl-10 pr-3 py-3 text-sm text-themed font-mono focus:outline-none focus:border-primary-themed transition"
              onKeyDown={(e) => e.key === 'Enter' && address.trim() && handleScan()}
            />
          </div>

          {address.trim() && (
            <div className="flex items-center justify-between mb-4 animate-fade-in">
              <div className="text-xs text-muted-themed">
                Cost: <span className="text-primary-themed font-bold">{currentCost} credits</span>
                {user && (
                  <>
                    {' '}
                    | Balance: <span className="text-themed font-bold">{balance}</span> credits
                  </>
                )}
              </div>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="gradient-primary text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {scanning ? (
                  <Cpu className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {scanning ? 'Scanning...' : 'Scan'}
              </button>
            </div>
          )}

          <p className="text-[11px] text-muted-themed">
            Disclaimer: Scan results are simulated for demonstration. Always do your own research
            before investing.
          </p>
        </div>

        {/* Loading State */}
        {scanning && (
          <div className="glass-strong rounded-2xl p-12 text-center animate-fade-in mb-6">
            <Cpu className="w-12 h-12 text-primary-themed animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold gradient-text">Scanning Blockchain...</p>
            <p className="text-xs text-muted-themed mt-2">
              {mode === 'elevator'
                ? `Analyzing ${ELEVATOR_OPTIONS[elevatorOption].transactions} transactions on ${chain === 'auto' ? 'auto-detect chain' : chain}`
                : 'Running security audits and risk analysis'}
            </p>
          </div>
        )}

        {/* Basic Scan Results */}
        {!scanning && basicResult && (
          <div className="space-y-4 animate-fade-in">
            {/* Token Overview */}
            <div className="glass-strong rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-themed">{basicResult.tokenName}</h2>
                  <p className="text-sm text-muted-themed">${basicResult.symbol}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${riskColor(basicResult.riskLevel)}`}>
                  {basicResult.riskLevel} Risk
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Price" value={`$${basicResult.price.toFixed(8)}`} icon={DollarSign} />
                <StatCard
                  label="24h Change"
                  value={`${basicResult.priceChange24h > 0 ? '+' : ''}${basicResult.priceChange24h.toFixed(1)}%`}
                  icon={basicResult.priceChange24h >= 0 ? TrendingUp : TrendingDown}
                  color={basicResult.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}
                />
                <StatCard label="Market Cap" value={`$${formatNum(basicResult.marketCap)}`} icon={DollarSign} />
                <StatCard label="24h Volume" value={`$${formatNum(basicResult.volume24h)}`} icon={Activity} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                <StatCard label="Holders" value={basicResult.holderCount.toLocaleString()} icon={Users} />
                <StatCard label="Contract Age" value={`${basicResult.contractAgeDays} days`} icon={Database} />
                <StatCard label="Audit Score" value={`${basicResult.auditScore}/100`} icon={ShieldCheck} color={basicResult.auditScore >= 70 ? 'text-green-400' : basicResult.auditScore >= 50 ? 'text-amber-400' : 'text-red-400'} />
              </div>
            </div>

            {/* Risk Metrics */}
            <div className="glass-strong rounded-2xl p-6">
              <h3 className="text-lg font-bold text-themed mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary-themed" />
                Advanced Risk Metrics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetricRow label="Is Honeypot" value={basicResult.isHoneypot} danger={basicResult.isHoneypot} />
                <MetricRow label="Is Mintable" value={basicResult.isMintable} danger={basicResult.isMintable} />
                <MetricRow label="Is Proxy" value={basicResult.isProxy} danger={basicResult.isProxy} />
                <MetricRow label="Can Pause" value={basicResult.canPause} danger={basicResult.canPause} />
                <MetricRow label="Liquidity Locked" value={basicResult.liquidityLocked} good={basicResult.liquidityLocked} />
                <MetricRow label="Buy Tax" value={`${basicResult.buyTax}%`} danger={basicResult.buyTax > 5} />
                <MetricRow label="Sell Tax" value={`${basicResult.sellTax}%`} danger={basicResult.sellTax > 8} />
                <MetricRow label="Top Holder %" value={`${basicResult.topHolderPct}%`} danger={basicResult.topHolderPct > 15} />
                <MetricRow label="Owner Balance" value={`${basicResult.ownerBalance}%`} danger={basicResult.ownerBalance > 10} />
                <MetricRow label="Liquidity %" value={`${basicResult.liquidityPct}%`} good={basicResult.liquidityPct > 70} />
              </div>
            </div>

            {/* Audit Card */}
            <div className="glass-strong rounded-2xl p-6">
              <h3 className="text-lg font-bold text-themed mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary-themed" />
                Token Audit
              </h3>
              <div className="space-y-3">
                {basicResult.positives.map((p, i) => (
                  <div key={`p${i}`} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-green-300">{p}</span>
                  </div>
                ))}
                {basicResult.warnings.map((w, i) => (
                  <div key={`w${i}`} className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-amber-300">{w}</span>
                  </div>
                ))}
                {basicResult.positives.length === 0 && basicResult.warnings.length === 0 && (
                  <p className="text-sm text-muted-themed">No audit data available.</p>
                )}
              </div>
            </div>

            {/* Market Intelligence */}
            <div className="glass-strong rounded-2xl p-6">
              <h3 className="text-lg font-bold text-themed mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-themed" />
                Market Intelligence
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoRow label="Total Supply" value={basicResult.totalSupply.toLocaleString()} />
                <InfoRow label="Liquidity Status" value={basicResult.liquidityLocked ? 'Locked' : 'Not Locked'} icon={basicResult.liquidityLocked ? Lock : Unlock} />
                <InfoRow label="Top Holder Share" value={`${basicResult.topHolderPct}%`} />
                <InfoRow label="Owner Holdings" value={`${basicResult.ownerBalance}%`} />
              </div>
            </div>
          </div>
        )}

        {/* Elevator Scan Results */}
        {!scanning && elevatorResult && (
          <div className="space-y-4 animate-fade-in">
            <div className="glass-strong rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-themed">{elevatorResult.name}</h2>
                  <p className="text-sm text-muted-themed">
                    ${elevatorResult.symbol} · {elevatorResult.chain} ·{' '}
                    <code className="font-mono text-xs">{elevatorResult.address}</code>
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="glass rounded-lg p-2">
                    <div className="text-lg font-bold gradient-text">{elevatorResult.totalTxs}</div>
                    <div className="text-[10px] text-muted-themed">Txs</div>
                  </div>
                  <div className="glass rounded-lg p-2">
                    <div className="text-lg font-bold gradient-text">{elevatorResult.uniqueWallets}</div>
                    <div className="text-[10px] text-muted-themed">Wallets</div>
                  </div>
                  <div className="glass rounded-lg p-2">
                    <div className="text-lg font-bold gradient-text">
                      ${formatNum(elevatorResult.totalVolume)}
                    </div>
                    <div className="text-[10px] text-muted-themed">Volume</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet breakdown */}
            <div className="glass-strong rounded-2xl p-6">
              <h3 className="text-lg font-bold text-themed mb-4">Wallet Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-themed border-b border-white/10">
                      <th className="text-left py-2 px-2">Wallet</th>
                      <th className="text-center py-2 px-2">Txs</th>
                      <th className="text-center py-2 px-2">Buys</th>
                      <th className="text-center py-2 px-2">Sells</th>
                      <th className="text-right py-2 px-2">Avg Buy</th>
                      <th className="text-right py-2 px-2">Avg Sell</th>
                      <th className="text-right py-2 px-2">Realized P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elevatorResult.wallets.slice(0, 15).map((w, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-2 font-mono text-xs text-themed">{w.address}</td>
                        <td className="text-center py-2 px-2 text-themed">{w.txCount}</td>
                        <td className="text-center py-2 px-2">
                          <span className="inline-flex items-center gap-0.5 text-green-400">
                            <ArrowUpRight className="w-3 h-3" />
                            {w.bought}
                          </span>
                        </td>
                        <td className="text-center py-2 px-2">
                          <span className="inline-flex items-center gap-0.5 text-red-400">
                            <ArrowDownRight className="w-3 h-3" />
                            {w.sold}
                          </span>
                        </td>
                        <td className="text-right py-2 px-2 text-muted-themed font-mono text-xs">
                          ${w.avgBuyPrice.toFixed(6)}
                        </td>
                        <td className="text-right py-2 px-2 text-muted-themed font-mono text-xs">
                          ${w.avgSellPrice.toFixed(6)}
                        </td>
                        <td className={`text-right py-2 px-2 font-bold ${w.status === 'profit' ? 'text-green-400' : w.status === 'loss' ? 'text-red-400' : 'text-muted-themed'}`}>
                          {w.realizedPnl > 0 ? '+' : ''}${w.realizedPnl.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Transaction table */}
            <div className="glass-strong rounded-2xl p-6">
              <h3 className="text-lg font-bold text-themed mb-4">Raw Transactions</h3>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-themed">
                    <tr className="text-xs text-muted-themed border-b border-white/10">
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-left py-2 px-2">Wallet</th>
                      <th className="text-right py-2 px-2">Amount (USD)</th>
                      <th className="text-right py-2 px-2">Tokens</th>
                      <th className="text-right py-2 px-2">Price</th>
                      <th className="text-right py-2 px-2">P&L</th>
                      <th className="text-right py-2 px-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elevatorResult.transactions.slice(0, 50).map((tx, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-2">
                          <span
                            className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${tx.type === 'buy' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}
                          >
                            {tx.type === 'buy' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs text-themed flex items-center gap-1">
                          {tx.wallet}
                          <button onClick={() => copyAddress(tx.wallet)} className="opacity-50 hover:opacity-100">
                            <Copy className="w-3 h-3" />
                          </button>
                        </td>
                        <td className="text-right py-2 px-2 text-themed">${tx.amountUsd.toFixed(2)}</td>
                        <td className="text-right py-2 px-2 text-muted-themed">{tx.tokenAmount.toLocaleString()}</td>
                        <td className="text-right py-2 px-2 text-muted-themed font-mono text-xs">${tx.price.toFixed(6)}</td>
                        <td className={`text-right py-2 px-2 font-semibold ${tx.pnlUsd === null ? 'text-muted-themed' : tx.pnlUsd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.pnlUsd === null ? '—' : `${tx.pnlUsd >= 0 ? '+' : ''}$${tx.pnlUsd.toFixed(2)}`}
                        </td>
                        <td className="text-right py-2 px-2 text-xs text-muted-themed">
                          {new Date(tx.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Network Health */}
        <div className="glass rounded-2xl p-4 mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-xs text-muted-themed">Network Epoch</div>
              <div className="text-sm font-bold text-themed">#{Math.floor(Date.now() / 1000 / 400)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-themed">Block Reward</div>
              <div className="text-sm font-bold text-themed">2.0 SOL</div>
            </div>
            <div>
              <div className="text-xs text-muted-themed">Exchanges Scanned</div>
              <div className="text-sm font-bold text-themed">14</div>
            </div>
            <div>
              <div className="text-xs text-muted-themed">Scan Status</div>
              <div className="text-sm font-bold text-green-400 flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Online
              </div>
            </div>
          </div>
        </div>
      </div>

      <InsufficientCreditsModal
        open={showInsufficient}
        onClose={() => setShowInsufficient(false)}
        onBuyCredits={() => onOpenCreditStore()}
        needed={currentCost}
        balance={balance}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-themed mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={`text-sm font-bold ${color || 'text-themed'}`}>{value}</div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  danger,
  good,
}: {
  label: string;
  value: boolean | string;
  danger?: boolean;
  good?: boolean;
}) {
  const isBool = typeof value === 'boolean';
  return (
    <div className="flex items-center justify-between glass rounded-lg px-3 py-2">
      <span className="text-sm text-muted-themed">{label}</span>
      {isBool ? (
        value ? (
          <span className={`flex items-center gap-1 text-sm font-semibold ${danger ? 'text-red-400' : good ? 'text-green-400' : 'text-themed'}`}>
            {danger ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            Yes
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm text-muted-themed">
            <XCircle className="w-4 h-4" />
            No
          </span>
        )
      ) : (
        <span className={`text-sm font-semibold ${danger ? 'text-red-400' : good ? 'text-green-400' : 'text-themed'}`}>
          {value}
        </span>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between glass rounded-lg px-3 py-2">
      <span className="text-sm text-muted-themed">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-themed">
        {Icon && <Icon className="w-4 h-4 text-muted-themed" />}
        {value}
      </span>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}

import { useNavigate } from 'react-router-dom';
import { Zap, Check, Flame } from 'lucide-react';
import { CREDIT_PACKAGES, ELEVATOR_OPTIONS, BASIC_SCAN_COST } from '@/lib/types';

interface PricingProps {
  onOpenCreditStore: (pkg?: string) => void;
}

export function Pricing({ onOpenCreditStore }: PricingProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-grid">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold gradient-text mb-3">Buy Credits, Scan Tokens</h1>
          <p className="text-muted-themed text-lg">
            No subscriptions, no hidden fees. Pay only for what you use.
          </p>
        </div>

        {/* Credit Packages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {CREDIT_PACKAGES.map((pkg) => (
            <button
              key={pkg.name}
              onClick={() => onOpenCreditStore(pkg.name)}
              className={`relative text-left rounded-2xl p-6 border transition hover:scale-[1.03] hover:-translate-y-1 ${
                pkg.hot
                  ? 'gradient-primary border-transparent text-white glow-primary'
                  : 'glass border-white/10 hover:border-primary-themed'
              }`}
            >
              {pkg.hot && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3" /> MOST POPULAR
                </div>
              )}
              <div className={`text-lg font-bold mb-1 ${pkg.hot ? 'text-white' : 'text-themed'}`}>
                {pkg.name}
              </div>
              <div className={`text-4xl font-extrabold mb-1 ${pkg.hot ? 'text-white' : 'gradient-text'}`}>
                {pkg.totalCredits}
              </div>
              <div className={`text-sm mb-3 ${pkg.hot ? 'text-white/80' : 'text-muted-themed'}`}>
                credits total
              </div>
              {pkg.bonusCredits > 0 && (
                <div className={`text-xs mb-2 inline-block px-2 py-0.5 rounded-full ${pkg.hot ? 'bg-white/20 text-white' : 'bg-green-400/10 text-green-400'}`}>
                  +{pkg.bonusCredits} bonus ({pkg.bonusPct}%)
                </div>
              )}
              <div className={`text-2xl font-bold ${pkg.hot ? 'text-white' : 'text-themed'}`}>
                ${pkg.priceUsd}
              </div>
              <div className={`text-xs ${pkg.hot ? 'text-white/60' : 'text-muted-themed'}`}>
                ~{pkg.priceSol} SOL
              </div>
              <div
                className={`mt-4 py-2 rounded-lg text-center text-sm font-semibold transition ${
                  pkg.hot
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'gradient-primary text-white hover:opacity-90'
                }`}
              >
                Buy Now
              </div>
            </button>
          ))}
        </div>

        {/* How Credits Work */}
        <div className="glass-strong rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold gradient-text mb-5">How Credits Work</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <CostCard
              title="Basic Scan"
              cost={BASIC_SCAN_COST}
              desc="Quick security audit, risk metrics, and market overview for any token."
            />
            {ELEVATOR_OPTIONS.map((opt) => (
              <CostCard
                key={opt.credits}
                title={`Elevator Deep Scan (${opt.transactions} Tx)`}
                cost={opt.credits}
                desc={`Full transaction analysis with P&L tracking across ${opt.transactions} transactions and wallet breakdown.`}
              />
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="glass-strong rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold gradient-text mb-5">Why Choose OnChain Crypto Scanner?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Credits never expire',
              'No monthly subscription',
              'Pay only for what you use',
              'Instant scan results',
              'Multi-chain support',
              'Advanced security metrics',
              'Real-time market data',
              'Priority support',
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 glass rounded-lg px-3 py-2.5">
                <Check className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-sm text-themed">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/signup')}
            className="gradient-primary text-white font-bold px-8 py-3 rounded-xl hover:opacity-90 transition glow-primary inline-flex items-center gap-2"
          >
            <Zap className="w-5 h-5" /> Get Started Now
          </button>
        </div>
      </div>
    </div>
  );
}

function CostCard({ title, cost, desc }: { title: string; cost: number; desc: string }) {
  return (
    <div className="glass rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-themed">{title}</span>
        <span className="flex items-center gap-1 text-primary-themed font-bold">
          <Zap className="w-4 h-4" fill="currentColor" />
          {cost}
        </span>
      </div>
      <p className="text-xs text-muted-themed">{desc}</p>
    </div>
  );
}

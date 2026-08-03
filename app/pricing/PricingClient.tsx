'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Flame } from 'lucide-react';
import Navigation from '@/components/layout/Navigation';
import { useCredits } from '@/contexts/CreditContext';
import { useAuth } from '@/contexts/AuthContext';
import { CreditStoreModal } from '@/components/credits/CreditStoreModal';

const ELEVATOR_COSTS = [
  { credits: 5, transactions: 50, label: '50 Transactions' },
  { credits: 10, transactions: 100, label: '100 Transactions' },
  { credits: 20, transactions: 200, label: '200 Transactions' },
  { credits: 30, transactions: 500, label: '500 Transactions' },
];

const BENEFITS = [
  'Credits never expire',
  'No monthly subscription',
  'Pay only for what you use',
  'Instant scan results',
  'Multi-chain support',
  'Advanced security metrics',
  'Real-time market data',
  'Priority support',
];

export default function PricingClient() {
  const { packages } = useCredits();
  const { isAuthenticated } = useAuth();
  const [showCreditStore, setShowCreditStore] = useState(false);
  const [initialPackageId, setInitialPackageId] = useState<string | undefined>(undefined);

  const handleBuyNow = (packageId?: string) => {
    setInitialPackageId(packageId);
    setShowCreditStore(true);
  };

  return (
    <div className="min-h-screen bg-grid">
      <Navigation onOpenCreditStore={() => setShowCreditStore(true)} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold gradient-text mb-3">
            Buy Credits, Scan Tokens
          </h1>
          <p className="text-muted-themed text-lg max-w-xl mx-auto">
            No subscriptions, no hidden fees. Pay only for what you use.
          </p>
        </motion.div>

        {/* Credit Packages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12"
        >
          {packages.map((pkg, index) => {
            const isHot = pkg.isHot;
            return (
              <motion.button
                key={pkg.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * index }}
                onClick={() => handleBuyNow(pkg.id)}
                className={`relative text-left rounded-2xl p-6 border transition hover:scale-[1.03] hover:-translate-y-1 ${
                  isHot
                    ? 'gradient-primary border-transparent text-white glow-primary'
                    : 'glass border-white/10 hover:border-primary-themed'
                }`}
              >
                {isHot && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center gap-1">
                    <Flame className="w-3 h-3" /> MOST POPULAR
                  </div>
                )}
                <div className={`text-lg font-bold mb-1 ${isHot ? 'text-white' : 'text-themed'}`}>
                  {pkg.name}
                </div>
                <div className={`text-4xl font-extrabold mb-1 ${isHot ? 'text-white' : 'gradient-text'}`}>
                  {pkg.credits + Math.floor(pkg.credits * pkg.bonusPercentage / 100)}
                </div>
                <div className={`text-sm mb-3 ${isHot ? 'text-white/80' : 'text-themed'}`}>
                  credits total
                </div>
                {pkg.bonusPercentage > 0 && (
                  <div className={`text-xs mb-2 inline-block px-2 py-0.5 rounded-full ${isHot ? 'bg-white/20 text-white' : 'bg-green-400/10 text-green-400'}`}>
                    +{Math.floor(pkg.credits * pkg.bonusPercentage / 100)} bonus ({pkg.bonusPercentage}%)
                  </div>
                )}
                <div className={`text-2xl font-bold ${isHot ? 'text-white' : 'text-themed'}`}>
                  ${pkg.priceUsd}
                </div>
                <div className={`text-xs mb-4 ${isHot ? 'text-white/60' : 'text-muted-themed'}`}>
                  ~{pkg.priceSol} SOL
                </div>
                <div
                  className={`py-2 rounded-lg text-center text-sm font-semibold transition ${
                    isHot
                      ? 'bg-white/20 text-white hover:bg-white/30'
                      : 'gradient-primary text-white hover:opacity-90'
                  }`}
                >
                  Buy Now
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* How Credits Work */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-6 mb-8"
        >
          <h2 className="text-xl font-bold gradient-text mb-5">How Credits Work</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <CostCard
              title="Basic Scan"
              cost={2}
              desc="Quick security audit, risk metrics, and market overview for any token."
            />
            {ELEVATOR_COSTS.map((opt) => (
              <CostCard
                key={opt.credits}
                title={`Elevator Deep Scan (${opt.transactions} Tx)`}
                cost={opt.credits}
                desc={`Full transaction analysis with P&L tracking across ${opt.transactions} transactions and wallet breakdown.`}
              />
            ))}
          </div>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-strong rounded-2xl p-6 mb-8"
        >
          <h2 className="text-xl font-bold gradient-text mb-5">Why Choose OnChain Alpha?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 glass rounded-lg px-3 py-2.5">
                <Check className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-sm text-themed">{benefit}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <button
            onClick={() => handleBuyNow()}
            className="gradient-primary text-white font-bold px-8 py-3 rounded-xl hover:opacity-90 transition glow-primary inline-flex items-center gap-2"
          >
            <Zap className="w-5 h-5" fill="currentColor" />
            {isAuthenticated ? 'Buy Credits Now' : 'Get Started Now'}
          </button>
        </motion.div>
      </div>

      <CreditStoreModal
        isOpen={showCreditStore}
        onClose={() => setShowCreditStore(false)}
        initialPackageId={initialPackageId}
      />
    </div>
  );
}

function CostCard({ title, cost, desc }: { title: string; cost: number; desc: string }) {
  return (
    <div className="glass rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-themed">{title}</span>
        <span className="flex items-center gap-1 text-primary-themed font-bold shrink-0">
          <Zap className="w-4 h-4" fill="currentColor" />
          {cost}
        </span>
      </div>
      <p className="text-xs text-muted-themed">{desc}</p>
    </div>
  );
}

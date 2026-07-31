'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/layout/Navigation';
import { useCredits } from '@/contexts/CreditContext';

export default function PricingPage() {
  const router = useRouter();
  const { packages } = useCredits();

  const handleBuyNow = (packageId?: string) => {
    if (packageId) {
      router.push(`/credits?package=${packageId}`);
    } else {
      router.push('/credits');
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <Navigation onOpenCreditStore={() => router.push('/credits')} />
      
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Buy Credits, Scan Tokens
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
              No subscriptions, no hidden fees. Pay only for what you use.
            </p>
          </motion.div>


          {/* Credit Packages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-black text-center mb-8 text-white">
              Choose Your Credit Package
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {packages.map((pkg, index) => (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * index }}
                  className={`relative bg-gradient-to-br ${
                    pkg.isHot
                      ? 'from-purple-900/50 to-pink-900/50 border-2 border-purple-500'
                      : 'from-slate-800/50 to-slate-900/50 border border-slate-700'
                  } rounded-2xl p-6 hover:scale-105 transition-transform`}
                >
                  {pkg.isHot && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-bold text-white">
                      🔥 MOST POPULAR
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-black text-white mb-2 uppercase">
                      {pkg.name}
                    </h3>
                    <div className="flex items-baseline justify-center gap-1 mb-2">
                      <span className="text-4xl font-black text-primary-400">
                        {pkg.credits}
                      </span>
                      <span className="text-lg text-slate-400">credits</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      ${pkg.priceUsd}
                    </div>
                    {pkg.bonusPercentage > 0 && (
                      <div className="text-sm text-green-400 font-bold mt-1">
                        +{pkg.bonusPercentage}% Bonus
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleBuyNow(pkg.id)}
                    className={`w-full py-3 rounded-xl font-bold transition-all ${
                      pkg.isHot
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    Buy Now
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Scan Costs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-2xl font-black text-center mb-6 text-white">
              How Credits Work
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                <div>
                  <h3 className="font-bold text-white">Basic Scan</h3>
                  <p className="text-sm text-slate-400">Security analysis + market data</p>
                </div>
                <div className="text-2xl font-black text-primary-400">2 ⚡</div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                <div>
                  <h3 className="font-bold text-white">Elevator Deep Scan (50 Tx)</h3>
                  <p className="text-sm text-slate-400">Deep wallet analysis up to 50 transactions</p>
                </div>
                <div className="text-2xl font-black text-primary-400">5 ⚡</div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                <div>
                  <h3 className="font-bold text-white">Elevator Deep Scan (100 Tx)</h3>
                  <p className="text-sm text-slate-400">Deep wallet analysis up to 100 transactions</p>
                </div>
                <div className="text-2xl font-black text-primary-400">10 ⚡</div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                <div>
                  <h3 className="font-bold text-white">Elevator Deep Scan (200 Tx)</h3>
                  <p className="text-sm text-slate-400">Deep wallet analysis up to 200 transactions</p>
                </div>
                <div className="text-2xl font-black text-primary-400">20 ⚡</div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                <div>
                  <h3 className="font-bold text-white">Elevator Deep Scan (500 Tx)</h3>
                  <p className="text-sm text-slate-400">Deep wallet analysis up to 500 transactions</p>
                </div>
                <div className="text-2xl font-black text-primary-400">30 ⚡</div>
              </div>
            </div>
          </motion.div>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-2xl p-8 max-w-3xl mx-auto"
          >
            <h2 className="text-2xl font-black text-center mb-6 text-white">
              Why Choose OnChain Alpha?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              {[
                'Credits never expire',
                'No monthly subscription',
                'Pay only for what you use',
                'Instant scan results',
                'Multi-chain support',
                'Advanced security metrics',
                'Real-time market data',
                'Priority support',
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span className="text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-16"
          >
            <button
              onClick={() => handleBuyNow()}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-xl transition-all inline-flex items-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Get Started Now
            </button>
          </motion.div>
        </div>
      </div>

      {/* Navigation and other elements */}
      <Navigation />
    </div>
  );
}

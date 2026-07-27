'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, History, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/layout/Navigation';
import ReferralDashboard from '@/components/referral/ReferralDashboard';
import ReferralHistoryModal from '@/components/referral/ReferralHistoryModal';
import { REFERRAL_BONUS_TIERS } from '@/types/referral';

export default function ReferralsPage() {
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation onOpenCreditStore={() => {}} />
      
      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-24">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Scanner</span>
        </button>

        {/* Page Header */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-black italic uppercase mb-4"
          >
            Referral Program
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-lg"
          >
            Earn bonus credits by inviting friends to OnChain Alpha Scanner
          </motion.p>
        </div>

        {/* Referral Dashboard */}
        <div className="mb-8">
          <ReferralDashboard />
        </div>

        {/* View History Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-12"
        >
          <button
            onClick={() => setShowHistory(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <History className="w-5 h-5" />
            View Referral History
          </button>
        </motion.div>

        {/* Bonus Tiers Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-8 border border-white/10"
        >
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Zap className="w-7 h-7 text-yellow-400" fill="currentColor" />
            Bonus Tier Structure
          </h2>
          
          <p className="text-slate-400 mb-6">
            The more credits your referrals purchase, the bigger bonus you receive!
          </p>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Package</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Credits Purchased</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Price (SOL)</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Your Bonus</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Bonus %</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <span className="font-medium text-white">Starter</span>
                  </td>
                  <td className="py-4 px-4 text-slate-300">50 credits</td>
                  <td className="py-4 px-4 text-slate-300">0.5 SOL</td>
                  <td className="py-4 px-4">
                    <span className="text-yellow-400 font-bold flex items-center gap-1">
                      <Zap className="w-4 h-4" fill="currentColor" />
                      5 credits
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-slate-700 rounded-full text-sm">10%</span>
                  </td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <span className="font-medium text-white">Basic</span>
                  </td>
                  <td className="py-4 px-4 text-slate-300">100 credits</td>
                  <td className="py-4 px-4 text-slate-300">0.9 SOL</td>
                  <td className="py-4 px-4">
                    <span className="text-yellow-400 font-bold flex items-center gap-1">
                      <Zap className="w-4 h-4" fill="currentColor" />
                      15 credits
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-blue-700 rounded-full text-sm">15%</span>
                  </td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <span className="font-medium text-white flex items-center gap-2">
                      Pro
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">HOT</span>
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-300">200 credits</td>
                  <td className="py-4 px-4 text-slate-300">1.6 SOL</td>
                  <td className="py-4 px-4">
                    <span className="text-yellow-400 font-bold flex items-center gap-1">
                      <Zap className="w-4 h-4" fill="currentColor" />
                      40 credits
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-purple-700 rounded-full text-sm">20%</span>
                  </td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <span className="font-medium text-white flex items-center gap-2">
                      Premium
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">BEST VALUE</span>
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-300">500 credits</td>
                  <td className="py-4 px-4 text-slate-300">3.5 SOL</td>
                  <td className="py-4 px-4">
                    <span className="text-yellow-400 font-bold flex items-center gap-1">
                      <Zap className="w-4 h-4" fill="currentColor" />
                      125 credits
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-green-700 rounded-full text-sm">25%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {[
              { name: 'Starter', credits: 50, price: 0.5, bonus: 5, percentage: 10, badge: null },
              { name: 'Basic', credits: 100, price: 0.9, bonus: 15, percentage: 15, badge: null },
              { name: 'Pro', credits: 200, price: 1.6, bonus: 40, percentage: 20, badge: 'HOT' },
              { name: 'Premium', credits: 500, price: 3.5, bonus: 125, percentage: 25, badge: 'BEST VALUE' },
            ].map((tier) => (
              <div key={tier.name} className="bg-slate-900/50 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-lg text-white">{tier.name}</span>
                  {tier.badge && (
                    <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs">
                      {tier.badge}
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Purchase:</span>
                    <span className="text-slate-200">{tier.credits} credits</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price:</span>
                    <span className="text-slate-200">{tier.price} SOL</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-slate-400">Your Bonus:</span>
                    <span className="text-yellow-400 font-bold flex items-center gap-1">
                      <Zap className="w-4 h-4" fill="currentColor" />
                      {tier.bonus} credits
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bonus Rate:</span>
                    <span className="px-2 py-1 bg-primary-700 rounded text-white text-xs">
                      {tier.percentage}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Terms & Conditions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 glass-card rounded-2xl p-6 border border-white/10"
        >
          <h3 className="text-lg font-bold mb-4">Terms & Conditions</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">•</span>
              <span>Referral bonuses are awarded only on the first purchase made by a referred user</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">•</span>
              <span>Bonus credits are added instantly after transaction confirmation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">•</span>
              <span>You cannot use your own referral code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">•</span>
              <span>Referral codes must be applied before the first purchase</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">•</span>
              <span>Fraudulent referrals or attempts to game the system will result in account suspension</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">•</span>
              <span>OnChain Alpha reserves the right to modify referral terms at any time</span>
            </li>
          </ul>
        </motion.div>
      </main>

      {/* Referral History Modal */}
      <ReferralHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );
}

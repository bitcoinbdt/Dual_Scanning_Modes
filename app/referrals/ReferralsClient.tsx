'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Gift,
  Copy,
  Check,
  Zap,
  History,
  ChevronDown,
  ChevronUp,
  Users,
  Share2,
  Flame,
  Star,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/layout/Navigation';
import ReferralHistoryModal from '@/components/referral/ReferralHistoryModal';
import { useAuth } from '@/contexts/AuthContext';
import { getReferralCode, copyToClipboard, generateShareText } from '@/services/referralApi';
import type { ReferralCodeResponse } from '@/types/referral';
import toast from 'react-hot-toast';

const REFERRAL_TIERS = [
  { name: 'Starter', credits: 100, priceUsd: '$4.99', bonus: 20, bonusPct: 20, hot: false, best: false },
  { name: 'Basic',   credits: 250, priceUsd: '$9.00', bonus: 50, bonusPct: 25, hot: false, best: false },
  { name: 'Pro',     credits: 600, priceUsd: '$19.00', bonus: 150, bonusPct: 30, hot: true, best: false },
  { name: 'Premium', credits: 1300, priceUsd: '$39.00', bonus: 400, bonusPct: 35, hot: false, best: true },
];

const TERMS = [
  "Referral bonus is only awarded on the referred user's first credit purchase.",
  'Bonus credits are added to your account instantly when the referral purchase is approved.',
  'You cannot use your own referral code.',
  "The referral code must be applied before the referred user's first purchase.",
  'Any fraudulent activity or self-referral attempts will result in forfeiture of bonus credits.',
  'OnChain Alpha reserves the right to modify these terms at any time.',
];

export default function ReferralsClient() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [referralData, setReferralData] = useState<ReferralCodeResponse | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadReferralData();
  }, [isAuthenticated, router]);

  const loadReferralData = async () => {
    try {
      const data = await getReferralCode();
      setReferralData(data);
    } catch (err) {
      console.error('Failed to load referral data:', err);
      toast.error('Failed to load referral data');
    } finally {
      setLoadingData(false);
    }
  };

  const copy = async (text: string, type: 'code' | 'link') => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
      toast.success('Copied to clipboard!');
    } else {
      toast.error('Failed to copy');
    }
  };

  const handleShare = (platform: 'twitter' | 'telegram') => {
    if (!referralData) return;
    const text = generateShareText(referralData.code);
    const url = referralData.shareUrl;
    if (platform === 'twitter') {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        '_blank'
      );
    } else {
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
        '_blank'
      );
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-themed">
        Please sign in to view referrals.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <Navigation onOpenCreditStore={() => {}} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold gradient-text mb-1">Referral Program</h1>
          <p className="text-muted-themed">
            Earn bonus credits by inviting friends to OnChain Crypto Scanner
          </p>
        </motion.div>

        {/* Dashboard Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl p-6 mb-6 rgb-border"
        >
          {loadingData ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-white/5 rounded w-1/3" />
              <div className="h-20 bg-white/5 rounded" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-16 bg-white/5 rounded" />
                <div className="h-16 bg-white/5 rounded" />
              </div>
            </div>
          ) : referralData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Code & Link */}
              <div>
                <label className="text-xs text-muted-themed mb-2 block">Your Referral Code</label>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 glass rounded-lg p-4 text-center">
                    <span className="text-3xl font-extrabold gradient-text font-mono tracking-wider">
                      {referralData.code}
                    </span>
                  </div>
                  <button
                    onClick={() => copy(referralData.code, 'code')}
                    className="p-4 rounded-lg glass hover:glow-sm transition"
                  >
                    {copied === 'code' ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-muted-themed" />
                    )}
                  </button>
                </div>

                <label className="text-xs text-muted-themed mb-2 block">Referral Link</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={referralData.shareUrl}
                    className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2.5 text-xs text-themed font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => copy(referralData.shareUrl, 'link')}
                    className="p-2.5 rounded-lg glass hover:glow-sm transition shrink-0"
                  >
                    {copied === 'link' ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-muted-themed" />
                    )}
                  </button>
                </div>

                {/* Share Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => copy(referralData.shareUrl, 'link')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 transition"
                  >
                    <Share2 className="w-4 h-4" /> Copy Link
                  </button>
                  <button
                    onClick={() => handleShare('twitter')}
                    className="px-3 py-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition text-sm font-bold"
                  >
                    𝕏
                  </button>
                  <button
                    onClick={() => handleShare('telegram')}
                    className="px-3 py-2 rounded-lg bg-sky-600/20 text-sky-400 hover:bg-sky-600/30 transition text-sm"
                  >
                    ✈️
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-4 text-center">
                  <Users className="w-6 h-6 text-primary-themed mx-auto mb-2" />
                  <div className="text-3xl font-bold gradient-text">
                    {referralData.stats.totalReferrals}
                  </div>
                  <div className="text-xs text-muted-themed">Total Referrals</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <Zap className="w-6 h-6 text-primary-themed mx-auto mb-2" fill="currentColor" />
                  <div className="text-3xl font-bold gradient-text">
                    {referralData.stats.totalEarned}
                  </div>
                  <div className="text-xs text-muted-themed">Credits Earned</div>
                </div>
                <div className="glass rounded-xl p-4 text-center col-span-2">
                  <Gift className="w-5 h-5 text-primary-themed mx-auto mb-1" />
                  <div className="text-2xl font-bold gradient-text">
                    {referralData.stats.pendingReferrals}
                  </div>
                  <div className="text-xs text-muted-themed">Pending (awaiting first purchase)</div>
                </div>
                <button
                  onClick={() => setShowHistory(true)}
                  className="col-span-2 glass rounded-xl p-3 text-sm font-semibold text-themed hover:glow-sm transition flex items-center justify-center gap-2"
                >
                  <History className="w-4 h-4" />
                  View Referral History
                </button>
              </div>
            </div>
          ) : (
            <p className="text-muted-themed text-center py-8">Failed to load referral data.</p>
          )}
        </motion.div>

        {/* Bonus Tier Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold gradient-text mb-1">Bonus Tier Structure</h2>
          <p className="text-sm text-muted-themed mb-5">
            When someone uses your referral code, you earn bonus credits on their first purchase:
          </p>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-themed border-b border-white/10">
                  <th className="text-left py-2 px-3">Package</th>
                  <th className="text-center py-2 px-3">Credits</th>
                  <th className="text-center py-2 px-3">Price (USD)</th>
                  <th className="text-center py-2 px-3">Your Bonus</th>
                  <th className="text-center py-2 px-3">Bonus %</th>
                </tr>
              </thead>
              <tbody>
                {REFERRAL_TIERS.map((tier) => (
                  <tr key={tier.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-semibold text-themed">
                      {tier.name}
                      {tier.hot && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                          <Flame className="w-2.5 h-2.5" /> HOT
                        </span>
                      )}
                      {tier.best && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                          <Star className="w-2.5 h-2.5" /> BEST VALUE
                        </span>
                      )}
                    </td>
                    <td className="text-center py-3 px-3 text-themed">{tier.credits}</td>
                    <td className="text-center py-3 px-3 text-muted-themed">{tier.priceUsd}</td>
                    <td className="text-center py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-primary-themed font-bold">
                        <Zap className="w-3.5 h-3.5" fill="currentColor" />
                        +{tier.bonus}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3 text-green-400 font-semibold">
                      {tier.bonusPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2">
            {REFERRAL_TIERS.map((tier) => (
              <div key={tier.name} className="glass rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-themed">{tier.name}</span>
                  <div className="flex items-center gap-1">
                    {tier.hot && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                        <Flame className="w-2.5 h-2.5" /> HOT
                      </span>
                    )}
                    {tier.best && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        <Star className="w-2.5 h-2.5" /> BEST
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-muted-themed">Credits</div>
                    <div className="text-themed font-bold">{tier.credits}</div>
                  </div>
                  <div>
                    <div className="text-muted-themed">Bonus</div>
                    <div className="text-primary-themed font-bold">+{tier.bonus}</div>
                  </div>
                  <div>
                    <div className="text-muted-themed">Rate</div>
                    <div className="text-green-400 font-bold">{tier.bonusPct}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-strong rounded-2xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold gradient-text mb-5">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { step: 1, title: 'Share Code', desc: 'Send your referral code to friends' },
              { step: 2, title: 'They Sign Up', desc: 'Friend uses your code during signup' },
              { step: 3, title: 'First Purchase', desc: 'They buy their first credits' },
              { step: 4, title: 'Get Bonus', desc: 'Earn 20–35% bonus credits instantly' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-themed text-sm mb-0.5">{title}</p>
                  <p className="text-xs text-muted-themed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Terms */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-strong rounded-2xl p-6"
        >
          <button
            onClick={() => setShowTerms(!showTerms)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-lg font-bold text-themed flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary-themed" />
              Terms &amp; Conditions
            </h2>
            {showTerms ? (
              <ChevronUp className="w-5 h-5 text-muted-themed" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-themed" />
            )}
          </button>
          {showTerms && (
            <div className="mt-4 space-y-2 animate-fade-in">
              {TERMS.map((term, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-themed">
                  <span className="text-primary-themed font-bold mt-0.5">{i + 1}.</span>
                  <span>{term}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <ReferralHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2, Zap, Users, Gift, CheckCircle2 } from 'lucide-react';
import { getReferralCode, copyToClipboard, formatReferralUrl, generateShareText } from '@/services/referralApi';
import type { ReferralCodeResponse } from '@/types/referral';
import toast from 'react-hot-toast';

export default function ReferralDashboard() {
  const [referralData, setReferralData] = useState<ReferralCodeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const data = await getReferralCode();
      setReferralData(data);
    } catch (error) {
      console.error('Failed to load referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!referralData) return;
    
    const success = await copyToClipboard(referralData.code);
    if (success) {
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy code');
    }
  };

  const handleCopyLink = async () => {
    if (!referralData) return;
    
    const success = await copyToClipboard(referralData.shareUrl);
    if (success) {
      toast.success('Referral link copied!');
    } else {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = (platform: 'twitter' | 'telegram' | 'email') => {
    if (!referralData) return;

    const text = generateShareText(referralData.code);
    const url = referralData.shareUrl;

    switch (platform) {
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
          '_blank'
        );
        break;
      case 'telegram':
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
          '_blank'
        );
        break;
      case 'email':
        window.location.href = `mailto:?subject=Join OnChain Alpha Scanner&body=${encodeURIComponent(text + '\n\n' + url)}`;
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-white/10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          <div className="h-24 bg-slate-700 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!referralData) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-white/10 text-center">
        <p className="text-slate-400">Failed to load referral data</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-8 border border-white/10"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Gift className="w-8 h-8 text-primary-400" />
        <h2 className="text-2xl font-bold">Your Referral Code</h2>
      </div>

      {/* Referral Code Display */}
      <div className="bg-slate-900/50 rounded-xl p-6 mb-6 border border-primary-500/30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm text-slate-400 mb-2">Share this code</p>
            <div className="flex items-center gap-3">
              <code className="text-3xl font-bold text-primary-400 tracking-wider">
                {referralData.code}
              </code>
              <button
                onClick={handleCopyCode}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-slate-300" />
                )}
              </button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Copy Link
            </button>
            <button
              onClick={() => handleShare('twitter')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              title="Share on Twitter"
            >
              𝕏
            </button>
            <button
              onClick={() => handleShare('telegram')}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
              title="Share on Telegram"
            >
              ✈️
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Referrals */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-6 border border-purple-500/30"
        >
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-purple-400" />
            <span className="text-sm text-slate-400">Total Referrals</span>
          </div>
          <div className="text-3xl font-bold text-white">
            {referralData.stats.totalReferrals}
          </div>
        </motion.div>

        {/* Credits Earned */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl p-6 border border-yellow-500/30"
        >
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-6 h-6 text-yellow-400" fill="currentColor" />
            <span className="text-sm text-slate-400">Credits Earned</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400">
            {referralData.stats.totalEarned}
          </div>
        </motion.div>

        {/* Pending Referrals */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl p-6 border border-orange-500/30"
        >
          <div className="flex items-center gap-3 mb-2">
            <Gift className="w-6 h-6 text-orange-400" />
            <span className="text-sm text-slate-400">Pending</span>
          </div>
          <div className="text-3xl font-bold text-orange-400">
            {referralData.stats.pendingReferrals}
          </div>
          <p className="text-xs text-slate-500 mt-2">Waiting for first purchase</p>
        </motion.div>
      </div>

      {/* How It Works */}
      <div className="mt-6 bg-slate-900/30 rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4 text-slate-200">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/50 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-primary-400">1</span>
            </div>
            <div>
              <p className="font-medium text-slate-300 mb-1">Share Code</p>
              <p className="text-slate-500">Send your referral code to friends</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/50 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-primary-400">2</span>
            </div>
            <div>
              <p className="font-medium text-slate-300 mb-1">They Sign Up</p>
              <p className="text-slate-500">Friend uses your code</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/50 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-primary-400">3</span>
            </div>
            <div>
              <p className="font-medium text-slate-300 mb-1">First Purchase</p>
              <p className="text-slate-500">They buy credits</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/50 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-primary-400">4</span>
            </div>
            <div>
              <p className="font-medium text-slate-300 mb-1">Get Bonus</p>
              <p className="text-slate-500">Earn 10-25% bonus</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

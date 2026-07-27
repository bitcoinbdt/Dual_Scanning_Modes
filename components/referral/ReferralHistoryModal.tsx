'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle2, Zap, Filter } from 'lucide-react';
import { getReferralHistory } from '@/services/referralApi';
import type { Referral } from '@/types/referral';
import { REFERRAL_BONUS_TIERS } from '@/types/referral';

interface ReferralHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterStatus = 'all' | 'pending' | 'rewarded';

export default function ReferralHistoryModal({ isOpen, onClose }: ReferralHistoryModalProps) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    if (isOpen) {
      loadReferralHistory();
    }
  }, [isOpen]);

  const loadReferralHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getReferralHistory(50, 0);
      setReferrals(data.referrals);
    } catch (error) {
      console.error('Failed to load referral history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReferrals = referrals.filter((ref) => {
    if (filter === 'all') return true;
    return ref.status === filter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rewarded':
        return (
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Rewarded
          </span>
        );
      case 'confirmed':
        return (
          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Confirmed
          </span>
        );
      case 'pending':
        return (
          <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl border border-white/10 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Zap className="w-7 h-7 text-yellow-400" fill="currentColor" />
                    Referral History
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Filter Buttons */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === 'all'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    All ({referrals.length})
                  </button>
                  <button
                    onClick={() => setFilter('rewarded')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === 'rewarded'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Rewarded ({referrals.filter(r => r.status === 'rewarded').length})
                  </button>
                  <button
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === 'pending'
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Pending ({referrals.filter(r => r.status === 'pending').length})
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl p-4 h-24" />
                    ))}
                  </div>
                ) : filteredReferrals.length === 0 ? (
                  <div className="text-center py-12">
                    <Filter className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No referrals found</p>
                    <p className="text-sm text-slate-500 mt-2">
                      Share your referral code to start earning bonuses!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredReferrals.map((referral, index) => (
                      <motion.div
                        key={referral.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-slate-900/50 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          {/* User Info */}
                          <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                {referral.referredUsername?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-white">
                                  {referral.referredUsername || 'Anonymous User'}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Joined {formatDate(referral.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Status & Bonus */}
                          <div className="flex items-center gap-4">
                            {referral.status === 'rewarded' && (
                              <div className="text-right">
                                <p className="text-xs text-slate-500 mb-1">Bonus Earned</p>
                                <p className="text-xl font-bold text-yellow-400 flex items-center gap-1">
                                  <Zap className="w-4 h-4" fill="currentColor" />
                                  {referral.bonusCreditsAwarded}
                                </p>
                                {referral.firstPurchaseAt && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    {formatDate(referral.firstPurchaseAt)}
                                  </p>
                                )}
                              </div>
                            )}
                            {getStatusBadge(referral.status)}
                          </div>
                        </div>

                        {/* Additional Info for Rewarded */}
                        {referral.status === 'rewarded' && referral.firstPurchaseAmount && (
                          <div className="mt-3 pt-3 border-t border-white/5 text-xs text-slate-500">
                            First purchase: {referral.firstPurchaseAmount} SOL
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/10 bg-slate-900/30">
                <div className="text-sm text-slate-400 text-center">
                  <p>💡 You earn bonus credits when referred users make their first purchase</p>
                  <p className="mt-2">
                    <span className="text-primary-400 font-medium">10-25% bonus</span> depending on package tier
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

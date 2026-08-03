'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Info, Check } from 'lucide-react';
import Navigation from '@/components/layout/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditContext';
import BoostRequestForm from '@/components/boost/BoostRequestForm';
import MyBoostRequests from '@/components/boost/MyBoostRequests';
import AuthModal from '@/components/AuthModal';
import { BOOST_PRICING, type BoostDuration } from '@/types/boost';

const PRICING_TIERS = [
  { hours: 6, credits: BOOST_PRICING[6], scansEstimate: '~50-100' },
  { hours: 12, credits: BOOST_PRICING[12], scansEstimate: '~100-200' },
  { hours: 24, credits: BOOST_PRICING[24], scansEstimate: '~200-400' },
  { hours: 36, credits: BOOST_PRICING[36], scansEstimate: '~400-800' },
];

const PLACEMENT_LOCATIONS = [
  'Home page - Above scanner (most visible)',
  'Agent page - Featured tokens',
  'Pricing page - Sponsored section',
];

const BENEFITS = [
  'Increased token visibility',
  'Live price display from CoinGecko',
  'Click-through to scanner',
  'Scan analytics dashboard',
  'No recurring fees',
  'Admin quality review',
];

export default function AdvertisingClient() {
  const { isAuthenticated } = useAuth();
  const { balance } = useCredits();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'submit' | 'my-requests'>('submit');

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-grid">
        <Navigation onOpenCreditStore={() => {}} />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-16">
          <div className="text-center glass-strong rounded-2xl p-12">
            <Rocket className="w-16 h-16 text-primary-themed mx-auto mb-4" />
            <h1 className="text-3xl font-bold gradient-text mb-3">Feature Your Token</h1>
            <p className="text-muted-themed mb-6">
              Please sign in to submit a token advertising request.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="gradient-primary text-white font-bold px-8 py-3 rounded-xl hover:opacity-90 transition"
            >
              Sign In to Continue
            </button>
          </div>
        </div>
        {showAuthModal && (
          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} defaultMode="login" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <Navigation onOpenCreditStore={() => {}} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <Rocket className="w-8 h-8 text-primary-themed" />
            <h1 className="text-4xl font-extrabold gradient-text">Token Advertising</h1>
          </div>
          <p className="text-muted-themed text-lg max-w-2xl mx-auto">
            Feature your token across OnChain Alpha Scanner. Get direct visibility to active traders and investors.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('submit')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition ${
              activeTab === 'submit'
                ? 'gradient-primary text-white'
                : 'glass text-muted-themed hover:text-themed'
            }`}
          >
            Submit Request
          </button>
          <button
            onClick={() => setActiveTab('my-requests')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition ${
              activeTab === 'my-requests'
                ? 'gradient-primary text-white'
                : 'glass text-muted-themed hover:text-themed'
            }`}
          >
            My Requests
          </button>
        </div>

        {/* Content */}
        {activeTab === 'submit' ? (
          <>
            {/* Pricing */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-strong rounded-2xl p-6 mb-6"
            >
              <h2 className="text-xl font-bold gradient-text mb-4">Pricing</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PRICING_TIERS.map((tier) => (
                  <div key={tier.hours} className="glass rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold gradient-text mb-1">{tier.hours}h</div>
                    <div className="text-sm text-muted-themed mb-2">Duration</div>
                    <div className="text-lg font-bold text-primary-themed">{tier.credits} credits</div>
                    <div className="text-xs text-muted-themed mt-1">{tier.scansEstimate} scans</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-strong rounded-2xl p-6 mb-6"
            >
              <h2 className="text-xl font-bold gradient-text mb-4">What You Get</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BENEFITS.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-sm text-themed">{benefit}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Placement Locations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl p-4 mb-6"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-blue-300 mb-2">Your Token Will Appear On:</div>
                  <ul className="text-sm text-blue-200 space-y-1">
                    {PLACEMENT_LOCATIONS.map((location) => (
                      <li key={location}>• {location}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <BoostRequestForm />
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <MyBoostRequests />
          </motion.div>
        )}
      </div>
    </div>
  );
}

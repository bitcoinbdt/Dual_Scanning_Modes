'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Lock, CheckCircle2, Loader2, ArrowLeft, Gift } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/layout/Navigation';
import { CreditPackageCard } from '@/components/credits/CreditPackageCard';
import { useCredits } from '@/contexts/CreditContext';
import type { CreditPackage } from '@/types/credits';
import { applyReferralCode } from '@/services/referralApi';
import toast from 'react-hot-toast';

type PurchaseState = 'selecting' | 'connecting' | 'confirming' | 'processing' | 'success' | 'error';

export default function CreditsPage() {
  const router = useRouter();
  const { packages, refreshBalance, addCredits } = useCredits();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>('selecting');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralApplied, setReferralApplied] = useState<boolean>(false);
  const [isApplyingReferral, setIsApplyingReferral] = useState<boolean>(false);

  // Auto-select Pro package as default
  useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      const proPackage = packages.find(pkg => pkg.isHot) || packages[2];
      setSelectedPackage(proPackage);
    }
  }, [packages, selectedPackage]);

  // Check for pending referral code from URL
  useEffect(() => {
    const pendingCode = localStorage.getItem('pendingReferralCode');
    if (pendingCode) {
      setReferralCode(pendingCode);
    }
  }, []);

  const handleApplyReferral = async () => {
    if (!referralCode.trim()) {
      toast.error('Please enter a referral code');
      return;
    }

    setIsApplyingReferral(true);
    try {
      const response = await applyReferralCode(referralCode.trim().toUpperCase());
      setReferralApplied(true);
      toast.success(`Referral code applied! ${response.referrerUsername ? `Referred by ${response.referrerUsername}` : ''}`);
      // Clear pending code
      localStorage.removeItem('pendingReferralCode');
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply referral code');
    } finally {
      setIsApplyingReferral(false);
    }
  };

  const handleConnectWallet = async () => {
    setPurchaseState('connecting');
    
    try {
      // Check if Phantom is installed
      if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Phantom wallet not detected. Please install Phantom from phantom.app');
      }

      // Connect to Phantom
      const resp = await window.solana.connect();
      setWalletAddress(resp.publicKey.toString());
      setPurchaseState('confirming');
      toast.success('Wallet connected successfully!');
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      setErrorMessage(error.message || 'Failed to connect wallet');
      setPurchaseState('error');
      toast.error(error.message || 'Failed to connect wallet');
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage || !walletAddress) return;

    setPurchaseState('processing');

    try {
      // Get treasury wallet from environment variable
      const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET;
      
      if (!TREASURY_WALLET) {
        throw new Error('Treasury wallet not configured. Please set NEXT_PUBLIC_TREASURY_WALLET in environment variables.');
      }

      // Create transaction
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      
      // Use devnet for testing, mainnet-beta for production
      const connection = new Connection(
        process.env.NODE_ENV === 'production' 
          ? 'https://api.mainnet-beta.solana.com' 
          : 'https://api.devnet.solana.com',
        'confirmed'
      );
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: new PublicKey(TREASURY_WALLET),
          lamports: Math.floor(selectedPackage.priceSol * LAMPORTS_PER_SOL),
        })
      );

      // Request transaction signature from Phantom
      if (!window.solana) throw new Error('Phantom wallet not found');
      const { signature } = await window.solana.signAndSendTransaction(transaction);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Call backend to credit user account
      // const response = await purchaseCredits({
      //   packageId: selectedPackage.id,
      //   walletAddress: walletAddress,
      //   txSignature: signature,
      // });

      // For now, simulate success and add credits locally
      addCredits(selectedPackage.credits);
      await refreshBalance();
      
      setPurchaseState('success');
      toast.success(`Successfully purchased ${selectedPackage.credits} credits!`);
    } catch (error: any) {
      console.error('Purchase error:', error);
      setErrorMessage(error.message || 'Transaction failed');
      setPurchaseState('error');
      toast.error(error.message || 'Transaction failed');
    }
  };

  const handleRetry = () => {
    setPurchaseState('selecting');
    setErrorMessage('');
  };

  const handleGoBack = () => {
    if (purchaseState === 'success') {
      router.push('/');
    } else {
      router.back();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation onOpenCreditStore={() => {}} />
      
      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-24">
        {/* Back Button */}
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Scanner</span>
        </button>

        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-3 mb-4"
            >
              <Zap className="w-12 h-12 text-yellow-400" fill="currentColor" />
              <h1 className="text-5xl font-black italic uppercase">Get Credits</h1>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-slate-400 text-lg"
            >
              Choose a package to power your on-chain intelligence scans
            </motion.p>
          </div>

          <div className="glass-card rounded-3xl border border-white/10 p-8">
            {/* Package Selection */}
            {purchaseState === 'selecting' && (
              <>
                {/* Referral Code Input */}
                {!referralApplied && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 bg-gradient-to-r from-primary-500/10 to-purple-500/10 rounded-xl p-6 border border-primary-500/30"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Gift className="w-5 h-5 text-primary-400" />
                      <label className="block text-sm font-medium text-slate-300">
                        Have a referral code? Enter it here:
                      </label>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <input
                        type="text"
                        placeholder="ABC-DEF-GH12"
                        maxLength={12}
                        className="flex-1 min-w-[200px] bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none transition-colors"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        disabled={isApplyingReferral}
                      />
                      <button
                        onClick={handleApplyReferral}
                        disabled={isApplyingReferral || !referralCode.trim()}
                        className="px-6 py-3 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                      >
                        {isApplyingReferral ? 'Applying...' : 'Apply'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                      💡 Your referrer will receive bonus credits when you make your first purchase
                    </p>
                  </motion.div>
                )}

                {/* Referral Applied Confirmation */}
                {referralApplied && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-8 bg-green-500/10 border border-green-500/30 rounded-xl p-6"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                      <div>
                        <p className="text-green-400 font-medium">✓ Referral code applied successfully!</p>
                        <p className="text-sm text-slate-400 mt-1">
                          Your referrer will receive bonus credits on your first purchase.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {packages.map((pkg, index) => (
                    <motion.div
                      key={pkg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <CreditPackageCard
                        package={pkg}
                        isSelected={selectedPackage?.id === pkg.id}
                        onSelect={setSelectedPackage}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Benefits */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-center mb-8 text-sm text-slate-400 flex flex-wrap items-center justify-center gap-6"
                >
                  <span className="flex items-center gap-2">
                    💡 Credits never expire
                  </span>
                  <span className="hidden md:inline">•</span>
                  <span className="flex items-center gap-2">
                    🚫 No subscription
                  </span>
                  <span className="hidden md:inline">•</span>
                  <span className="flex items-center gap-2">
                    ⚡ Instant delivery
                  </span>
                </motion.div>

                {/* Selected Package Summary */}
                {selectedPackage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900/50 rounded-xl p-6 mb-8"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-400">Selected Package:</span>
                      <span className="text-white font-bold text-lg">
                        {selectedPackage.name} Package
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-400">Credits:</span>
                      <span className="text-yellow-400 font-bold text-xl flex items-center gap-2">
                        <Zap className="w-5 h-5" fill="currentColor" />
                        {selectedPackage.credits}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Payment:</span>
                      <span className="text-primary-400 font-bold text-xl">
                        {selectedPackage.priceSol} SOL
                        <span className="text-slate-500 text-sm ml-2">
                          (~${selectedPackage.priceUsd})
                        </span>
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Connect Wallet Button */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  onClick={handleConnectWallet}
                  disabled={!selectedPackage}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-600 text-white font-bold py-5 rounded-xl flex items-center justify-center gap-3 transition-all disabled:cursor-not-allowed text-lg"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.5 2.5L9 11l1.5 1.5 8.5-8.5-1.5-1.5zm-11 11L15 5l1.5 1.5L8 15l-1.5-1.5zM12 21c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9-4.03 9-9 9z"/>
                  </svg>
                  Connect Phantom Wallet
                </motion.button>

                <div className="text-center mt-6 text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  Secure payment via Solana blockchain
                </div>
              </>
            )}

            {/* Connecting State */}
            {purchaseState === 'connecting' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <Loader2 className="w-16 h-16 text-primary-500 animate-spin mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-3">Connecting to Phantom...</h3>
                <p className="text-slate-400">Please approve the connection in your wallet</p>
              </motion.div>
            )}

            {/* Wallet Connected - Confirm Purchase */}
            {purchaseState === 'confirming' && selectedPackage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 mb-8">
                  <div className="flex items-center gap-3 text-green-400 mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="font-bold text-lg">Wallet Connected</span>
                  </div>
                  <div className="text-sm text-slate-300 font-mono truncate">
                    {walletAddress}
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-8 mb-8">
                  <h3 className="text-2xl font-bold mb-6">Purchase Summary</h3>
                  <div className="space-y-4 text-lg">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Package:</span>
                      <span className="text-white font-bold">{selectedPackage.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Credits:</span>
                      <span className="text-yellow-400 font-bold flex items-center gap-2">
                        {selectedPackage.credits}
                        <Zap className="w-5 h-5" fill="currentColor" />
                      </span>
                    </div>
                    <div className="border-t border-white/10 pt-4 flex justify-between">
                      <span className="text-slate-400">Total:</span>
                      <span className="text-primary-400 font-bold text-2xl">
                        {selectedPackage.priceSol} SOL
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handlePurchase}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-5 rounded-xl transition-all text-lg"
                >
                  Confirm & Pay {selectedPackage.priceSol} SOL
                </button>
              </motion.div>
            )}

            {/* Processing Transaction */}
            {purchaseState === 'processing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <Loader2 className="w-16 h-16 text-primary-500 animate-spin mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-4">Processing Transaction...</h3>
                <div className="w-full bg-slate-900 rounded-full h-3 mb-6 max-w-md mx-auto overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-blue-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, ease: 'easeInOut' }}
                  />
                </div>
                <p className="text-slate-400">Confirming on Solana blockchain...</p>
              </motion.div>
            )}

            {/* Success State */}
            {purchaseState === 'success' && selectedPackage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-24 h-24 bg-green-500/20 border-4 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </motion.div>
                <h3 className="text-3xl font-black mb-3">Purchase Successful!</h3>
                <p className="text-slate-400 mb-6 text-lg">
                  +{selectedPackage.credits} credits added to your account
                </p>
                <div className="text-5xl font-black text-primary-400 mb-8 flex items-center justify-center gap-3">
                  <Zap className="w-12 h-12" fill="currentColor" />
                  {selectedPackage.credits}
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-bold px-12 py-4 rounded-xl transition-all text-lg"
                >
                  Start Scanning
                </button>
              </motion.div>
            )}

            {/* Error State */}
            {purchaseState === 'error' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <div className="w-24 h-24 bg-red-500/20 border-4 border-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-3xl font-black mb-3 text-red-400">Purchase Failed</h3>
                <p className="text-slate-400 mb-8 max-w-md mx-auto">{errorMessage}</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleRetry}
                    className="bg-primary-600 hover:bg-primary-500 text-white font-bold px-8 py-4 rounded-xl transition-all"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleGoBack}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-8 py-4 rounded-xl transition-all"
                  >
                    Go Back
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Extend Window interface for Phantom
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      signAndSendTransaction: (transaction: any) => Promise<{ signature: string }>;
    };
  }
}

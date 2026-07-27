'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { CreditPackageCard } from './CreditPackageCard';
import { useCredits } from '@/contexts/CreditContext';
import type { CreditPackage } from '@/types/credits';
import toast from 'react-hot-toast';

interface CreditStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PurchaseState = 'selecting' | 'connecting' | 'confirming' | 'processing' | 'success' | 'error';

export function CreditStoreModal({ isOpen, onClose }: CreditStoreModalProps) {
  const { packages, refreshBalance, addCredits } = useCredits();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>('selecting');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPurchaseState('selecting');
      setSelectedPackage(null);
      setWalletAddress(null);
      setErrorMessage('');
    }
  }, [isOpen]);

  // Auto-select Pro package as default
  useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      const proPackage = packages.find(pkg => pkg.isHot) || packages[2];
      setSelectedPackage(proPackage);
    }
  }, [packages, selectedPackage]);

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
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose();
      }, 3000);
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative glass-card rounded-3xl border border-white/10 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="w-8 h-8 text-yellow-400" fill="currentColor" />
                <h2 className="text-3xl font-black italic uppercase">Get Credits</h2>
              </div>
              <p className="text-slate-400 text-sm">
                Choose a package to power your scans
              </p>
            </div>

            {/* Package Selection */}
            {purchaseState === 'selecting' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {packages.map((pkg) => (
                    <CreditPackageCard
                      key={pkg.id}
                      package={pkg}
                      isSelected={selectedPackage?.id === pkg.id}
                      onSelect={setSelectedPackage}
                    />
                  ))}
                </div>

                {/* Benefits */}
                <div className="text-center mb-6 text-sm text-slate-400 flex items-center justify-center gap-4">
                  <span>💡 Credits never expire</span>
                  <span>•</span>
                  <span>No subscription</span>
                  <span>•</span>
                  <span>Instant delivery</span>
                </div>

                {/* Selected Package Summary */}
                {selectedPackage && (
                  <div className="bg-slate-900/50 rounded-xl p-4 mb-6">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Selected:</span>
                      <span className="text-white font-bold">
                        {selectedPackage.name} Package ({selectedPackage.credits} credits)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-2">
                      <span className="text-slate-400">Payment:</span>
                      <span className="text-primary-400 font-bold">
                        {selectedPackage.priceSol} SOL (~${selectedPackage.priceUsd})
                      </span>
                    </div>
                  </div>
                )}

                {/* Connect Wallet Button */}
                <button
                  onClick={handleConnectWallet}
                  disabled={!selectedPackage}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.5 2.5L9 11l1.5 1.5 8.5-8.5-1.5-1.5zm-11 11L15 5l1.5 1.5L8 15l-1.5-1.5zM12 21c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9-4.03 9-9 9z"/>
                  </svg>
                  Connect Phantom Wallet
                </button>

                <div className="text-center mt-4 text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Lock className="w-3 h-3" />
                  Secure payment via Solana blockchain
                </div>
              </>
            )}

            {/* Connecting State */}
            {purchaseState === 'connecting' && (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Connecting to Phantom...</h3>
                <p className="text-slate-400 text-sm">Please approve the connection in your wallet</p>
              </div>
            )}

            {/* Wallet Connected - Confirm Purchase */}
            {purchaseState === 'confirming' && selectedPackage && (
              <div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-bold">Wallet Connected</span>
                  </div>
                  <div className="text-sm text-slate-300 font-mono truncate">
                    {walletAddress}
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-bold mb-4">Purchase Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Package:</span>
                      <span className="text-white font-bold">{selectedPackage.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Credits:</span>
                      <span className="text-white font-bold">{selectedPackage.credits} ⚡</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price:</span>
                      <span className="text-primary-400 font-bold">
                        {selectedPackage.priceSol} SOL
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handlePurchase}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl transition-all"
                >
                  Pay {selectedPackage.priceSol} SOL to Purchase {selectedPackage.credits} Credits
                </button>
              </div>
            )}

            {/* Processing Transaction */}
            {purchaseState === 'processing' && (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Processing Transaction...</h3>
                <div className="w-full bg-slate-900 rounded-full h-2 mb-4 max-w-md mx-auto overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-blue-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, ease: 'easeInOut' }}
                  />
                </div>
                <p className="text-slate-400 text-sm">Confirming on Solana blockchain...</p>
              </div>
            )}

            {/* Success State */}
            {purchaseState === 'success' && selectedPackage && (
              <div className="text-center py-12">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
                <h3 className="text-2xl font-black mb-2">Purchase Successful!</h3>
                <p className="text-slate-400 mb-4">
                  +{selectedPackage.credits} credits added to your account
                </p>
                <div className="text-4xl font-black text-primary-400 mb-6">
                  New Balance: {selectedPackage.credits} ⚡
                </div>
                <button
                  onClick={onClose}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-bold px-8 py-3 rounded-xl transition-all"
                >
                  Start Scanning
                </button>
              </div>
            )}

            {/* Error State */}
            {purchaseState === 'error' && (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-red-500/20 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-red-400">Purchase Failed</h3>
                <p className="text-slate-400 mb-6">{errorMessage}</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleRetry}
                    className="bg-primary-600 hover:bg-primary-500 text-white font-bold px-8 py-3 rounded-xl transition-all"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-8 py-3 rounded-xl transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
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

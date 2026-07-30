'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Lock, CheckCircle2, Loader2, Copy, ExternalLink } from 'lucide-react';
import { CreditPackageCard } from './CreditPackageCard';
import { useCredits } from '@/contexts/CreditContext';
import type { CreditPackage } from '@/types/credits';
import type { PaymentMethod } from '@/types/creditPurchase';
import toast from 'react-hot-toast';

interface CreditStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PurchaseState = 'selecting' | 'payment-method' | 'payment-details' | 'submitting' | 'success' | 'error';

export function CreditStoreModal({ isOpen, onClose }: CreditStoreModalProps) {
  const { packages, refreshBalance } = useCredits();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>('selecting');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load payment methods
  useEffect(() => {
    if (isOpen) {
      loadPaymentMethods();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPurchaseState('selecting');
      setSelectedPackage(null);
      setSelectedPaymentMethod(null);
      setTransactionHash('');
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

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch('/api/credits/payment-methods');
      if (!response.ok) throw new Error('Failed to load payment methods');
      const data = await response.json();
      setPaymentMethods(data.paymentMethods || []);
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      toast.error('Failed to load payment methods');
    }
  };

  const handleSelectPackage = () => {
    if (!selectedPackage) {
      toast.error('Please select a credit package');
      return;
    }
    setPurchaseState('payment-method');
  };

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setPurchaseState('payment-details');
  };

  const handleSubmitRequest = async () => {
    if (!selectedPackage || !selectedPaymentMethod || !transactionHash.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setPurchaseState('submitting');

    try {
      const response = await fetch('/api/credits/submit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credit_package_id: selectedPackage.id,
          credits_amount: selectedPackage.credits,
          price_usd: selectedPackage.priceUsd,
          payment_method_id: selectedPaymentMethod.id,
          transaction_hash: transactionHash.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit request');
      }

      setPurchaseState('success');
      toast.success('Request submitted! We will review it shortly.');
      
      // Auto-close after 4 seconds
      setTimeout(() => {
        onClose();
      }, 4000);
    } catch (error: any) {
      console.error('Submit request error:', error);
      setErrorMessage(error.message || 'Failed to submit request');
      setPurchaseState('error');
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setPurchaseState('selecting');
    setErrorMessage('');
    setTransactionHash('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
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
                  <span>Manual verification</span>
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
                      <span className="text-slate-400">Price:</span>
                      <span className="text-primary-400 font-bold">
                        ${selectedPackage.priceUsd} USD
                      </span>
                    </div>
                  </div>
                )}

                {/* Continue Button */}
                <button
                  onClick={handleSelectPackage}
                  disabled={!selectedPackage}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed"
                >
                  Continue to Payment
                </button>

                <div className="text-center mt-4 text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Lock className="w-3 h-3" />
                  Manual payment verification by admin
                </div>
              </>
            )}

            {/* Payment Method Selection */}
            {purchaseState === 'payment-method' && (
              <div>
                <button
                  onClick={() => setPurchaseState('selecting')}
                  className="text-slate-400 hover:text-white mb-6 text-sm flex items-center gap-1"
                >
                  ← Back to packages
                </button>

                <h3 className="text-xl font-bold mb-4">Select Payment Method</h3>
                
                {paymentMethods.length === 0 ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                    <p className="text-yellow-400">No payment methods available at the moment.</p>
                    <p className="text-slate-400 text-sm mt-2">Please contact support.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 mb-6">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => handleSelectPaymentMethod(method)}
                        className="bg-slate-900/50 hover:bg-slate-900 border border-slate-700 hover:border-purple-500 rounded-xl p-4 text-left transition-all group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                            {method.name}
                          </h4>
                          {method.network && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                              {method.network}
                            </span>
                          )}
                        </div>
                        {method.instructions && (
                          <p className="text-sm text-slate-400">{method.instructions}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Payment Details & Transaction Hash Submission */}
            {purchaseState === 'payment-details' && selectedPaymentMethod && selectedPackage && (
              <div>
                <button
                  onClick={() => setPurchaseState('payment-method')}
                  className="text-slate-400 hover:text-white mb-6 text-sm flex items-center gap-1"
                >
                  ← Back to payment methods
                </button>

                <h3 className="text-xl font-bold mb-6">Complete Payment</h3>

                {/* Payment Instructions */}
                <div className="bg-slate-900/50 rounded-xl p-6 mb-6">
                  <h4 className="font-bold text-white mb-3">Step 1: Send Payment</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Payment Method:</p>
                      <p className="text-white font-bold">{selectedPaymentMethod.name}</p>
                      {selectedPaymentMethod.network && (
                        <span className="text-sm text-slate-400">({selectedPaymentMethod.network})</span>
                      )}
                    </div>

                    <div>
                      <p className="text-sm text-slate-400 mb-1">Amount to Send:</p>
                      <p className="text-primary-400 font-bold text-lg">${selectedPackage.priceUsd} USD</p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-400 mb-2">Send to this address:</p>
                      <div className="flex items-center gap-2 bg-gray-900 p-3 rounded-lg">
                        <code className="text-white font-mono text-sm flex-1 break-all">
                          {selectedPaymentMethod.address}
                        </code>
                        <button
                          onClick={() => copyToClipboard(selectedPaymentMethod.address)}
                          className="p-2 hover:bg-gray-800 rounded transition-colors flex-shrink-0"
                          title="Copy address"
                        >
                          <Copy className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>

                    {selectedPaymentMethod.instructions && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <p className="text-sm text-blue-400">{selectedPaymentMethod.instructions}</p>
                      </div>
                    )}

                    {selectedPaymentMethod.qr_code_url && (
                      <div>
                        <p className="text-sm text-slate-400 mb-2">QR Code:</p>
                        <a
                          href={selectedPaymentMethod.qr_code_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                        >
                          View QR Code <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transaction Hash Input */}
                <div className="bg-slate-900/50 rounded-xl p-6 mb-6">
                  <h4 className="font-bold text-white mb-3">Step 2: Submit Transaction Hash</h4>
                  <p className="text-sm text-slate-400 mb-4">
                    After sending the payment, paste your transaction hash/ID below for verification.
                  </p>
                  <input
                    type="text"
                    value={transactionHash}
                    onChange={(e) => setTransactionHash(e.target.value)}
                    placeholder="Enter transaction hash or ID"
                    className="w-full px-4 py-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmitRequest}
                  disabled={!transactionHash.trim() || loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-600 text-white font-bold py-4 rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit for Verification'}
                </button>

                <div className="text-center mt-4 text-xs text-slate-400">
                  Your request will be reviewed by our team. Credits will be added after verification.
                </div>
              </div>
            )}

            {/* Submitting State */}
            {purchaseState === 'submitting' && (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Submitting Request...</h3>
                <p className="text-slate-400 text-sm">Please wait...</p>
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
                <h3 className="text-2xl font-black mb-2">Request Submitted!</h3>
                <p className="text-slate-400 mb-4">
                  Your credit purchase request has been submitted for verification
                </p>
                <div className="bg-slate-900/50 rounded-xl p-6 mb-6 max-w-md mx-auto text-left">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Credits:</span>
                      <span className="text-white font-bold">{selectedPackage.credits} ⚡</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Amount:</span>
                      <span className="text-white font-bold">${selectedPackage.priceUsd}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className="text-yellow-400 font-bold">Pending Review</span>
                    </div>
                  </div>
                </div>
                <p className="text-slate-500 text-sm mb-6">
                  Our team will verify your transaction and add credits to your account within 24 hours.
                </p>
                <button
                  onClick={onClose}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-bold px-8 py-3 rounded-xl transition-all"
                >
                  Close
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

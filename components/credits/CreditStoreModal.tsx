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

// Logo Renderer Component for Brands
function PaymentMethodLogo({ name, className = "w-10 h-10" }: { name: string; className?: string }) {
  const normalized = name.toLowerCase();
  
  if (normalized.includes('binance')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0L17.2 5.2L12 10.4L6.8 5.2L12 0Z" fill="#F0B90B" />
        <path d="M5.2 6.8L10.4 12L5.2 17.2L0 12L5.2 6.8Z" fill="#F0B90B" />
        <path d="M18.8 6.8L24 12L18.8 17.2L13.6 12L18.8 6.8Z" fill="#F0B90B" />
        <path d="M12 13.6L17.2 18.8L12 24L6.8 18.8L12 13.6Z" fill="#F0B90B" />
        <path d="M12 7.6L16.4 12L12 16.4L7.6 12L12 7.6Z" fill="#F0B90B" fillOpacity="0.4" />
      </svg>
    );
  }
  
  if (normalized.includes('kucoin')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="6" fill="#0093DD"/>
        <path d="M7 6H10V18H7V6ZM14 6H17V10H14V6ZM14 14H17V18H14V14ZM11 10H14V14H11V10Z" fill="white" />
      </svg>
    );
  }
  
  if (normalized.includes('usdt')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="#26A17B" />
        <path d="M12.75 6.75V8.5H16.5V11H12.75V17.5H11.25V11H7.5V8.5H11.25V6.75H12.75Z" fill="white" />
      </svg>
    );
  }
  
  if (normalized.includes('usdc')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="#2775CA" />
        <path d="M12 4.5C7.86 4.5 4.5 7.86 4.5 12C4.5 16.14 7.86 19.5 12 19.5C16.14 19.5 19.5 16.14 19.5 12C19.5 7.86 16.14 4.5 12 4.5ZM12.75 16.5H11.25V15H12.75V16.5ZM14.25 12.5C13.5 12.88 13.5 13.5 13.5 13.5H10.5V12C10.5 10.5 12 10.5 12 9.75C12 9 11.25 9 10.5 9.75V7.5C11.25 6.75 13.5 6.75 13.5 8.25C13.5 9.75 12 10.5 12 11.25C12 12 14.25 12 14.25 12.5Z" fill="white" />
      </svg>
    );
  }
  
  if (normalized.includes('trx')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="12,2 22,12 12,22 2,12" fill="#EC0623" />
        <polygon points="12,6 18,12 12,18 6,12" fill="white" />
      </svg>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500 flex items-center justify-center text-lg font-black text-purple-400">
      💳
    </div>
  );
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
      const data = await response.json();
      setPaymentMethods(data.paymentMethods || []);
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      // Don't show toast — page still renders with empty methods
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
                  className="text-slate-400 hover:text-white mb-6 text-sm flex items-center gap-1 transition-colors"
                >
                  ← Back to packages
                </button>

                <h3 className="text-2xl font-bold mb-6 text-white">Select Payment Method</h3>
                
                {paymentMethods.length === 0 ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 text-center">
                    <p className="text-yellow-400 font-bold">No payment methods configured by admin yet.</p>
                    <p className="text-slate-400 text-sm mt-2">Please try again later or contact support.</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {paymentMethods.map((method) => {
                      const getBrandColors = (name: string) => {
                        const normalized = name.toLowerCase();
                        if (normalized.includes('binance')) return { border: 'hover:border-yellow-500/50', hoverBg: 'hover:bg-yellow-500/5', bg: 'bg-yellow-500/10', text: 'text-yellow-400' };
                        if (normalized.includes('kucoin')) return { border: 'hover:border-sky-500/50', hoverBg: 'hover:bg-sky-500/5', bg: 'bg-sky-500/10', text: 'text-sky-400' };
                        if (normalized.includes('usdt')) return { border: 'hover:border-emerald-500/50', hoverBg: 'hover:bg-emerald-500/5', bg: 'bg-emerald-500/10', text: 'text-emerald-400' };
                        if (normalized.includes('usdc')) return { border: 'hover:border-blue-500/50', hoverBg: 'hover:bg-blue-500/5', bg: 'bg-blue-500/10', text: 'text-blue-400' };
                        if (normalized.includes('trx')) return { border: 'hover:border-red-500/50', hoverBg: 'hover:bg-red-500/5', bg: 'bg-red-500/10', text: 'text-red-400' };
                        return { border: 'hover:border-purple-500/50', hoverBg: 'hover:bg-purple-500/5', bg: 'bg-purple-500/10', text: 'text-purple-400' };
                      };
                      const brand = getBrandColors(method.name);

                      return (
                        <button
                          key={method.id}
                          onClick={() => handleSelectPaymentMethod(method)}
                          className={`bg-slate-900/40 hover:bg-slate-950 border border-slate-800 ${brand.border} ${brand.hoverBg} rounded-2xl p-5 text-left transition-all duration-300 flex items-center gap-4 group`}
                        >
                          <PaymentMethodLogo name={method.name} className="w-12 h-12 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                              {method.name}
                            </h4>
                            {method.network && (
                              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-bold ${brand.bg} ${brand.text}`}>
                                {method.network} Network
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Payment Details & Transaction Hash Submission */}
            {purchaseState === 'payment-details' && selectedPaymentMethod && selectedPackage && (
              <div>
                <button
                  onClick={() => setPurchaseState('payment-method')}
                  className="text-slate-400 hover:text-white mb-6 text-sm flex items-center gap-1 transition-colors"
                >
                  ← Back to payment methods
                </button>

                <h3 className="text-2xl font-bold mb-6 text-white">Complete Payment</h3>

                {/* Payment Instructions */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 mb-6">
                  <h4 className="font-bold text-white mb-4">Step 1: Send Payment</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-xl border border-white/5">
                      <PaymentMethodLogo name={selectedPaymentMethod.name} className="w-14 h-14 flex-shrink-0" />
                      <div>
                        <h5 className="font-bold text-white text-lg">{selectedPaymentMethod.name}</h5>
                        {selectedPaymentMethod.network && (
                          <span className="inline-block mt-1 px-2.5 py-0.5 bg-purple-500/10 text-purple-400 text-xs font-bold rounded">
                            {selectedPaymentMethod.network} Network
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-slate-400 mb-1">Amount to Send:</p>
                      <p className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-black text-2xl">${selectedPackage.priceUsd} USD</p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-400 mb-2">Send to this address:</p>
                      <div className="flex items-center gap-2 bg-slate-950 p-4 rounded-xl border border-white/5">
                        <code className="text-white font-mono text-sm flex-1 break-all select-all">
                          {selectedPaymentMethod.address}
                        </code>
                        <button
                          onClick={() => copyToClipboard(selectedPaymentMethod.address)}
                          className="p-2 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                          title="Copy address"
                        >
                          <Copy className="w-5 h-5 text-slate-400 hover:text-white" />
                        </button>
                      </div>
                    </div>

                    {selectedPaymentMethod.instructions && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                        <p className="text-sm text-purple-300 font-semibold">{selectedPaymentMethod.instructions}</p>
                      </div>
                    )}

                    {selectedPaymentMethod.qr_code_url && (
                      <div>
                        <p className="text-sm text-slate-400 mb-2">QR Code:</p>
                        <a
                          href={selectedPaymentMethod.qr_code_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors"
                        >
                          View QR Code <ExternalLink className="w-4 h-4" />
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

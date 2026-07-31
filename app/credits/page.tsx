'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Zap, Lock, CheckCircle2, Loader2, Copy } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navigation from '@/components/layout/Navigation';
import { useCredits } from '@/contexts/CreditContext';
import type { CreditPackage } from '@/types/credits';
import type { PaymentMethod } from '@/types/creditPurchase';
import toast from 'react-hot-toast';

// Logo Renderer Component for Brands
function PaymentMethodLogo({ name, className = "w-8 h-8" }: { name: string; className?: string }) {
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
    <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500 flex items-center justify-center text-md">
      💳
    </div>
  );
}

function CreditsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { packages } = useCredits();
  
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [transactionHash, setTransactionHash] = useState<string>('');
  

  const [loading, setLoading] = useState<boolean>(false);
  const [purchaseState, setPurchaseState] = useState<'payment' | 'submitting' | 'success'>('payment');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 1. Get package from query params
  useEffect(() => {
    if (packages.length > 0) {
      const pkgParam = searchParams.get('package');
      const found = packages.find(p => p.id === pkgParam) || packages.find(p => p.isHot) || packages[2];
      setSelectedPackage(found);
    }
  }, [packages, searchParams]);

  // 2. Fetch payment methods
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const res = await fetch('/api/credits/payment-methods');
        const data = await res.json();
        setPaymentMethods(data.paymentMethods || []);
        if (data.paymentMethods?.length > 0) {
          setSelectedPaymentMethod(data.paymentMethods[0]);
        }
      } catch (err) {
        console.error('Failed to load payment methods', err);
      }
    };
    fetchPaymentMethods();
  }, []);



  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleSubmitRequest = async () => {
    if (!selectedPackage || !selectedPaymentMethod || !transactionHash.trim()) {
      toast.error('Please enter the transaction hash');
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
      toast.success('Payment submitted successfully! Admin will verify soon.');
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'Failed to submit request');
      setPurchaseState('payment');
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  if (purchaseState === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="w-16 h-16 text-purple-500 animate-spin mb-4" />
        <h3 className="text-xl font-bold">Submitting transaction info...</h3>
        <p className="text-slate-400 text-sm">Please wait while we record your request.</p>
      </div>
    );
  }

  if (purchaseState === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 bg-green-500/10 border-2 border-green-500 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-3xl font-black mb-2">Request Submitted!</h2>
        <p className="text-slate-400 max-w-md mb-8 text-sm">
          We will review your transaction hash: <span className="font-mono text-white block mt-1 break-all bg-slate-900 p-2 rounded">{transactionHash}</span>
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Column 1: Order Details */}
      <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur-md border border-white/5 p-6 rounded-2xl flex flex-col justify-between">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4">Your Order</h3>
          {selectedPackage && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <span className="text-slate-400 text-sm">Package</span>
                <span className="text-white font-bold">{selectedPackage.name}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <span className="text-slate-400 text-sm">Credits</span>
                <span className="text-yellow-400 font-bold flex items-center gap-1.5">
                  <Zap className="w-4 h-4" fill="currentColor" />
                  {selectedPackage.credits} Credits
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Price</span>
                <span className="text-white font-black text-xl">${selectedPackage.priceUsd} USD</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Column 2 & 3: Payment Process */}
      <div className="lg:col-span-2 space-y-6">
        {/* Payment Methods */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
          <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4">1. Select Payment Method</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paymentMethods.map((method) => {
              const isSel = selectedPaymentMethod?.id === method.id;
              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedPaymentMethod(method)}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                    isSel 
                      ? 'border-purple-500 bg-purple-500/5' 
                      : 'border-white/5 bg-slate-950/40 hover:border-white/10'
                  }`}
                >
                  <PaymentMethodLogo name={method.name} />
                  <div>
                    <div className="text-sm font-bold text-white">{method.name}</div>
                    <div className="text-xs text-slate-500">{(method.network || 'Crypto').toUpperCase()}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Instructions & Action */}
        {selectedPaymentMethod && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold">2. Transfer Details</h3>
            
            <div className="bg-slate-950/80 p-4 rounded-xl border border-white/5 space-y-3">
              <div>
                <span className="text-xs text-slate-500 block mb-1">Send to this Address:</span>
                <div className="flex items-center justify-between gap-4 bg-slate-900/50 p-3 rounded-lg border border-white/5">
                  <span className="font-mono text-sm text-white select-all break-all">{selectedPaymentMethod.address}</span>
                  <button 
                    onClick={() => copyToClipboard(selectedPaymentMethod.address)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-all flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {selectedPaymentMethod.instructions && (
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Instructions:</span>
                  <p className="text-xs text-slate-400 leading-relaxed">{selectedPaymentMethod.instructions}</p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 font-bold block mb-2">3. Submit Transaction Hash</label>
              <input
                type="text"
                placeholder="Paste transaction signature / tx hash here"
                className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none transition-all"
                value={transactionHash}
                onChange={(e) => setTransactionHash(e.target.value)}
              />
            </div>

            <button
              onClick={handleSubmitRequest}
              disabled={loading || !transactionHash.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-800 disabled:to-slate-900 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Confirm Payment Info
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreditsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-28 pb-24">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Complete Payment
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Your credits will be added as soon as the transaction hash is verified by admin.
            </p>
          </div>

          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
            </div>
          }>
            <CreditsContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X, Zap, Copy, Check, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { BrandLogo } from './BrandLogo';
import { CREDIT_PACKAGES, CreditPackage, PaymentMethod } from '@/lib/types';

interface CreditStoreModalProps {
  open: boolean;
  onClose: () => void;
  preselectedPackage?: string | null;
  onNavigateCredits?: (pkg: string) => void;
}

export function CreditStoreModal({
  open,
  onClose,
  preselectedPackage,
  onNavigateCredits,
}: CreditStoreModalProps) {
  const { profile, user } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<'select' | 'methods'>('select');
  const [selectedPkg, setSelectedPkg] = useState<CreditPackage | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('select');
      setTxHash('');
      setSelectedMethod(null);
      if (preselectedPackage) {
        const pkg = CREDIT_PACKAGES.find((p) => p.name === preselectedPackage);
        if (pkg) {
          setSelectedPkg(pkg);
          setStep('methods');
          loadMethods();
          return;
        }
      }
      setSelectedPkg(null);
    }
  }, [open, preselectedPackage]);

  const loadMethods = async () => {
    setMethodsLoading(true);
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) {
      showToast('Failed to load payment methods', 'error');
    } else {
      setMethods((data || []) as PaymentMethod[]);
    }
    setMethodsLoading(false);
  };

  if (!open) return null;

  const handleSelectPackage = (pkg: CreditPackage) => {
    setSelectedPkg(pkg);
    setStep('methods');
    loadMethods();
  };

  const copyAddress = async () => {
    if (!selectedMethod?.address) return;
    try {
      await navigator.clipboard.writeText(selectedMethod.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Address copied', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!selectedPkg || !selectedMethod || !txHash.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    if (!user) {
      showToast('Please sign in first', 'error');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('credit_requests').insert({
        user_id: user.id,
        user_email: user.email,
        package_name: selectedPkg.name,
        credits: selectedPkg.credits,
        price_usd: selectedPkg.priceUsd,
        payment_method_id: selectedMethod.id,
        payment_method_name: selectedMethod.name,
        payment_method_network: selectedMethod.network,
        tx_hash: txHash.trim(),
        status: 'pending',
      });
      if (error) throw error;
      showToast('Payment submitted! Credits will be added after admin review.', 'success');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg glass-strong rounded-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'select' && (
          <>
            <h2 className="text-2xl font-bold gradient-text mb-1">Buy Credits</h2>
            <p className="text-sm text-muted-themed mb-5">Choose a credit package</p>
            <div className="grid grid-cols-2 gap-3">
              {CREDIT_PACKAGES.map((pkg) => (
                <button
                  key={pkg.name}
                  onClick={() => handleSelectPackage(pkg)}
                  className={`relative text-left rounded-xl p-4 border transition hover:scale-[1.02] ${
                    pkg.hot
                      ? 'gradient-primary border-transparent'
                      : 'glass border-white/10 hover:border-primary-themed'
                  }`}
                >
                  {pkg.hot && (
                    <span className="absolute top-2 right-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full text-white font-semibold">
                      HOT
                    </span>
                  )}
                  <div className={`text-lg font-bold ${pkg.hot ? 'text-white' : 'text-themed'}`}>
                    {pkg.name}
                  </div>
                  <div
                    className={`text-2xl font-extrabold ${pkg.hot ? 'text-white' : 'gradient-text'}`}
                  >
                    {pkg.totalCredits}
                  </div>
                  <div className={`text-xs ${pkg.hot ? 'text-white/80' : 'text-muted-themed'}`}>
                    credits
                  </div>
                  {pkg.bonusCredits > 0 && (
                    <div
                      className={`text-xs mt-1 ${pkg.hot ? 'text-white/90' : 'text-green-400'}`}
                    >
                      +{pkg.bonusCredits} bonus
                    </div>
                  )}
                  <div
                    className={`text-sm font-bold mt-2 ${pkg.hot ? 'text-white' : 'text-themed'}`}
                  >
                    ${pkg.priceUsd}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'methods' && selectedPkg && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setStep('select')}
                className="text-xs text-muted-themed hover:text-themed"
              >
                ← Packages
              </button>
            </div>
            <h2 className="text-2xl font-bold gradient-text mb-1">Complete Payment</h2>
            <div className="glass rounded-lg p-3 mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-themed">{selectedPkg.name} Package</div>
                <div className="text-lg font-bold gradient-text">
                  {selectedPkg.totalCredits} credits
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-themed">Price</div>
                <div className="text-lg font-bold text-themed">${selectedPkg.priceUsd}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-themed mb-2 block">
                  Step 1: Select Payment Method
                </label>
                {methodsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-themed" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMethod(m)}
                        className={`flex items-center gap-2 rounded-lg p-2.5 border transition text-left ${
                          selectedMethod?.id === m.id
                            ? 'border-primary-themed glow-sm'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <BrandLogo name={m.name} size={32} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-themed truncate">{m.name}</div>
                          <div className="text-[10px] text-muted-themed uppercase">{m.network}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedMethod && (
                <>
                  <div>
                    <label className="text-xs text-muted-themed mb-2 block">
                      Step 2: Transfer to Address
                    </label>
                    <div className="glass rounded-lg p-3">
                      <div className="text-xs text-muted-themed mb-1">Wallet Address</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs text-themed font-mono break-all">
                          {selectedMethod.address || 'Not configured yet'}
                        </code>
                        {selectedMethod.address && (
                          <button
                            onClick={copyAddress}
                            className="shrink-0 p-2 rounded-lg glass hover:glow-sm transition"
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-muted-themed" />
                            )}
                          </button>
                        )}
                      </div>
                      {selectedMethod.instructions && (
                        <p className="text-xs text-muted-themed mt-2">
                          {selectedMethod.instructions}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-themed mb-2 block">
                      Step 3: Submit Transaction Hash
                    </label>
                    <input
                      type="text"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="Paste transaction signature / tx hash here"
                      className="w-full bg-themed border border-themed rounded-lg px-3 py-2.5 text-sm text-themed font-mono focus:outline-none focus:border-primary-themed transition"
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={loading || !txHash.trim() || !selectedMethod.address}
                    className="w-full gradient-primary text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {loading ? 'Submitting...' : 'Confirm Payment Info'}
                  </button>

                  {onNavigateCredits && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateCredits(selectedPkg.name);
                      }}
                      className="w-full text-xs text-muted-themed hover:text-primary-themed flex items-center justify-center gap-1"
                    >
                      Open full payment page <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
            {profile && (
              <div className="mt-3 text-center text-xs text-muted-themed">
                Current balance: <span className="text-primary-themed font-bold">{profile.credits}</span>{' '}
                credits
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

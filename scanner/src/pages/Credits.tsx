import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Zap,
  Copy,
  Check,
  Loader2,
  Lock,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { BrandLogo } from '@/components/BrandLogo';
import { CREDIT_PACKAGES, CreditPackage, PaymentMethod } from '@/lib/types';

export function Credits() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedPkg, setSelectedPkg] = useState<CreditPackage | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    const pkgName = searchParams.get('package');
    const pkg = CREDIT_PACKAGES.find((p) => p.name === pkgName);
    setSelectedPkg(pkg ?? CREDIT_PACKAGES[0]);
    loadMethods();
  }, [user, navigate, searchParams]);

  const loadMethods = async () => {
    setMethodsLoading(true);
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    setMethods((data || []) as PaymentMethod[]);
    setMethodsLoading(false);
  };

  if (!user || !selectedPkg) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-themed">
        Please sign in.
      </div>
    );
  }

  const copyAddress = async () => {
    if (!selectedMethod?.address) return;
    await navigator.clipboard.writeText(selectedMethod.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Address copied', 'success');
  };

  const handleSubmit = async () => {
    if (!selectedMethod || !txHash.trim()) {
      showToast('Fill in all fields', 'error');
      return;
    }
    if (!selectedMethod.address) {
      showToast('This payment method is not configured yet', 'error');
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
      setSubmitted(true);
      showToast('Request submitted!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-8 text-center max-w-md animate-scale-in">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.15)' }}
          >
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold gradient-text mb-2">Request Submitted!</h2>
          <p className="text-sm text-muted-themed mb-4">
            Your credits will be added as soon as the transaction hash is verified by admin.
          </p>
          <div className="glass rounded-lg p-3 mb-4 text-left">
            <div className="text-xs text-muted-themed mb-1">Transaction Hash</div>
            <code className="text-xs text-themed font-mono break-all">{txHash}</code>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full gradient-primary text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-themed hover:text-themed mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold gradient-text mb-1">Complete Payment</h1>
          <p className="text-sm text-muted-themed">
            Your credits will be added as soon as the transaction hash is verified by admin.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Summary */}
          <div className="glass-strong rounded-2xl p-6 h-fit">
            <h2 className="text-sm font-bold text-muted-themed uppercase tracking-wider mb-4">
              Order Summary
            </h2>
            <div className="text-center py-4">
              <div className="text-lg font-semibold text-themed">{selectedPkg.name}</div>
              <div className="flex items-center justify-center gap-1 my-3">
                <Zap className="w-8 h-8 text-primary-themed" fill="currentColor" />
                <span className="text-4xl font-extrabold gradient-text">
                  {selectedPkg.totalCredits}
                </span>
              </div>
              <div className="text-xs text-muted-themed">credits total</div>
              {selectedPkg.bonusCredits > 0 && (
                <div className="text-xs text-green-400 mt-1">
                  +{selectedPkg.bonusCredits} bonus ({selectedPkg.bonusPct}%)
                </div>
              )}
            </div>
            <div className="border-t border-white/10 pt-4 flex items-center justify-between">
              <span className="text-sm text-muted-themed">Price</span>
              <span className="text-2xl font-bold text-themed">${selectedPkg.priceUsd}</span>
            </div>
          </div>

          {/* Payment Process */}
          <div className="lg:col-span-2 space-y-5">
            {/* Step 1 */}
            <div className="glass-strong rounded-2xl p-6">
              <label className="text-xs text-muted-themed mb-3 block">
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
                      className={`flex items-center gap-2 rounded-lg p-3 border transition text-left ${
                        selectedMethod?.id === m.id
                          ? 'border-primary-themed glow-sm'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <BrandLogo name={m.name} size={36} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-themed truncate">{m.name}</div>
                        <div className="text-[10px] text-muted-themed uppercase">{m.network}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2 */}
            {selectedMethod && (
              <div className="glass-strong rounded-2xl p-6 animate-fade-in">
                <label className="text-xs text-muted-themed mb-3 block">
                  Step 2: Transfer Details
                </label>
                <div className="glass rounded-lg p-4">
                  <div className="text-xs text-muted-themed mb-1">Payment Address</div>
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
                  {selectedMethod.qr_code_url && (
                    <div className="mt-3 flex justify-center">
                      <img
                        src={selectedMethod.qr_code_url}
                        alt="QR Code"
                        className="w-40 h-40 rounded-lg bg-white p-2"
                      />
                    </div>
                  )}
                  {selectedMethod.instructions && (
                    <p className="text-xs text-muted-themed mt-3">
                      {selectedMethod.instructions}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3 */}
            {selectedMethod && (
              <div className="glass-strong rounded-2xl p-6 animate-fade-in">
                <label className="text-xs text-muted-themed mb-3 block">
                  Step 3: Submit Transaction Hash
                </label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Paste transaction signature / tx hash here"
                  className="w-full bg-themed border border-themed rounded-lg px-3 py-3 text-sm text-themed font-mono focus:outline-none focus:border-primary-themed transition mb-4"
                />
                <button
                  onClick={handleSubmit}
                  disabled={loading || !txHash.trim() || !selectedMethod.address}
                  className="w-full gradient-primary text-white font-semibold py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {loading ? 'Submitting transaction info...' : 'Confirm Payment Info'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

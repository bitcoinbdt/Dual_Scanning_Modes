import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { BrandLogo } from '@/components/BrandLogo';
import { PaymentMethod } from '@/lib/types';

export function AdminPaymentMethods() {
  const { user, isAdmin, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
      return;
    }
    if (user && isAdmin) loadMethods();
  }, [user, isAdmin, loading, navigate]);

  const loadMethods = async () => {
    setDataLoading(true);
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) {
      showToast('Failed to load payment methods', 'error');
    } else {
      setMethods((data || []) as PaymentMethod[]);
    }
    setDataLoading(false);
  };

  const updateField = (id: string, field: keyof PaymentMethod, value: string | boolean) => {
    setMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  };

  const handleSave = async (method: PaymentMethod) => {
    setSaving(method.id);
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({
          address: method.address,
          qr_code_url: method.qr_code_url,
          instructions: method.instructions,
          is_active: method.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', method.id);
      if (error) throw error;
      showToast(`${method.name} saved`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      showToast(msg, 'error');
    } finally {
      setSaving(null);
    }
  };

  if (loading || (!user || !isAdmin)) {
    return <div className="min-h-screen flex items-center justify-center text-muted-themed">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-grid">
      <header
        className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: 'rgba(10,1,24,0.8)', backdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-themed">Admin Console</div>
          <Link to="/admin" className="flex items-center gap-1.5 text-sm text-muted-themed hover:text-themed transition">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold gradient-text mb-1">Configure Gateways</h1>
          <p className="text-sm text-muted-themed">
            Set addresses for the 5 default payment methods below
          </p>
        </div>

        {dataLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-themed" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {methods.map((method) => {
              const brandColor = getBrandColor(method.name);
              return (
                <div
                  key={method.id}
                  className={`glass-strong rounded-2xl p-6 border transition ${
                    method.is_active ? brandColor.border : 'opacity-60'
                  } hover:${brandColor.glow}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <BrandLogo name={method.name} size={44} />
                      <div>
                        <div className="font-bold text-themed">{method.name}</div>
                        <div className="text-xs text-muted-themed uppercase">{method.network} Network</div>
                      </div>
                    </div>
                    <button
                      onClick={() => updateField(method.id, 'is_active', !method.is_active)}
                      className={`relative w-12 h-6 rounded-full transition ${method.is_active ? 'bg-green-500' : 'bg-slate-600'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${method.is_active ? 'left-6' : 'left-0.5'}`}
                      />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-themed mb-1 block">Wallet Address / Pay ID</label>
                      <input
                        type="text"
                        value={method.address}
                        onChange={(e) => updateField(method.id, 'address', e.target.value)}
                        placeholder={`Enter ${method.name} identifier`}
                        className="w-full bg-themed border border-themed rounded-lg px-3 py-2 text-sm text-themed font-mono focus:outline-none focus:border-primary-themed transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-themed mb-1 block">QR Code Image URL (Optional)</label>
                      <input
                        type="text"
                        value={method.qr_code_url ?? ''}
                        onChange={(e) => updateField(method.id, 'qr_code_url', e.target.value)}
                        placeholder="https://example.com/qr.png"
                        className="w-full bg-themed border border-themed rounded-lg px-3 py-2 text-sm text-themed font-mono focus:outline-none focus:border-primary-themed transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-themed mb-1 block">Payment Instructions</label>
                      <textarea
                        value={method.instructions ?? ''}
                        onChange={(e) => updateField(method.id, 'instructions', e.target.value)}
                        rows={2}
                        placeholder="Step by step instructions for the buyer..."
                        className="w-full bg-themed border border-themed rounded-lg px-3 py-2 text-sm text-themed focus:outline-none focus:border-primary-themed transition resize-none"
                      />
                    </div>

                    <button
                      onClick={() => handleSave(method)}
                      disabled={saving === method.id}
                      className="w-full gradient-primary text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving === method.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving === method.id ? 'Saving changes...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getBrandColor(name: string) {
  const n = name.toLowerCase();
  if (n.includes('binance'))
    return { border: 'border-yellow-400/30', glow: 'shadow-yellow-400/20' };
  if (n.includes('kucoin')) return { border: 'border-sky-400/30', glow: 'shadow-sky-400/20' };
  if (n.includes('usdt')) return { border: 'border-emerald-400/30', glow: 'shadow-emerald-400/20' };
  if (n.includes('usdc')) return { border: 'border-blue-400/30', glow: 'shadow-blue-400/20' };
  if (n.includes('trx')) return { border: 'border-red-400/30', glow: 'shadow-red-400/20' };
  return { border: 'border-white/10', glow: 'shadow-white/10' };
}

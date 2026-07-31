'use client';

import { useState, useEffect } from 'react';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { PaymentMethod } from '@/types/creditPurchase';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function AdminPaymentMethodsPage() {
  return (
    <AdminProtectedRoute>
      <PaymentMethodsContent />
    </AdminProtectedRoute>
  );
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

function PaymentMethodsContent() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch('/api/admin/payment-methods');
      if (!response.ok) throw new Error('Failed to load payment methods');
      const data = await response.json();
      setPaymentMethods(data.paymentMethods || []);
    } catch (error) {
      toast.error('Failed to load payment methods');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0118] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Configure Gateways</h1>
            <p className="text-gray-400">Set addresses for the 5 default payment methods below</p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-white/10"
          >
            ← Back to Admin
          </Link>
        </div>

        {/* Predefined Grid Layout of Default Methods */}
        <div className="grid md:grid-cols-2 gap-6">
          {paymentMethods
            .sort((a, b) => a.display_order - b.display_order)
            .map((method) => (
              <PaymentMethodCard
                key={method.id}
                method={method}
                onSaveSuccess={loadPaymentMethods}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

interface PaymentMethodCardProps {
  method: PaymentMethod;
  onSaveSuccess: () => void;
}

function PaymentMethodCard({ method, onSaveSuccess }: PaymentMethodCardProps) {
  const [address, setAddress] = useState(method.address);
  const [instructions, setInstructions] = useState(method.instructions || '');
  const [qrCodeUrl, setQrCodeUrl] = useState(method.qr_code_url || '');
  const [isActive, setIsActive] = useState(method.is_active);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/payment-methods/${method.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          instructions: instructions.trim() || null,
          qr_code_url: qrCodeUrl.trim() || null,
          is_active: isActive
        }),
      });

      if (!response.ok) throw new Error('Failed to update');
      toast.success(`${method.name} updated successfully!`);
      onSaveSuccess();
    } catch (error) {
      console.error(error);
      toast.error(`Failed to update ${method.name}`);
    } finally {
      setSaving(false);
    }
  };

  const getBrandDetails = (name: string) => {
    const normalized = name.toLowerCase();
    if (normalized.includes('binance')) {
      return {
        border: 'border-yellow-500/20 focus-within:border-yellow-500',
        glow: 'hover:shadow-yellow-500/5',
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-400'
      };
    }
    if (normalized.includes('kucoin')) {
      return {
        border: 'border-sky-500/20 focus-within:border-sky-500',
        glow: 'hover:shadow-sky-500/5',
        bg: 'bg-sky-500/10',
        text: 'text-sky-400'
      };
    }
    if (normalized.includes('usdt')) {
      return {
        border: 'border-emerald-500/20 focus-within:border-emerald-500',
        glow: 'hover:shadow-emerald-500/5',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400'
      };
    }
    if (normalized.includes('usdc')) {
      return {
        border: 'border-blue-500/20 focus-within:border-blue-500',
        glow: 'hover:shadow-blue-500/5',
        bg: 'bg-blue-500/10',
        text: 'text-blue-400'
      };
    }
    if (normalized.includes('trx')) {
      return {
        border: 'border-red-500/20 focus-within:border-red-500',
        glow: 'hover:shadow-red-500/5',
        bg: 'bg-red-500/10',
        text: 'text-red-400'
      };
    }
    return {
      border: 'border-purple-500/20 focus-within:border-purple-500',
      glow: 'hover:shadow-purple-500/5',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400'
    };
  };

  const brand = getBrandDetails(method.name);

  return (
    <div className={`glass-card rounded-2xl border ${brand.border} p-6 transition-all duration-300 shadow-xl ${isActive ? `shadow-2xl ${brand.glow}` : 'opacity-70 hover:opacity-100'}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PaymentMethodLogo name={method.name} className="w-10 h-10" />
          <div>
            <h3 className="text-xl font-bold text-white">{method.name}</h3>
            {method.network && (
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${brand.bg} ${brand.text}`}>
                {method.network} Network
              </span>
            )}
          </div>
        </div>
        
        {/* Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={isActive} 
            onChange={(e) => setIsActive(e.target.checked)}
            className="sr-only peer" 
          />
          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white"></div>
          <span className="ml-2.5 text-sm font-semibold text-slate-400">
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </label>
      </div>

      <div className="space-y-4">
        {/* Address Input */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
            Wallet Address / Pay ID
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
            placeholder={`Enter ${method.name} identifier`}
          />
        </div>

        {/* QR Code Input */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
            QR Code Image URL (optional)
          </label>
          <input
            type="text"
            value={qrCodeUrl}
            onChange={(e) => setQrCodeUrl(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none font-mono"
            placeholder="https://example.com/qr.png"
          />
        </div>

        {/* Instructions Input */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
            Payment Instructions
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
            placeholder="Step by step instructions for the buyer..."
            rows={2}
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving changes...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}

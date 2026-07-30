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

function PaymentMethodsContent() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
      const response = await fetch(`/api/admin/payment-methods/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('Payment method deleted');
      loadPaymentMethods();
    } catch (error) {
      toast.error('Failed to delete payment method');
      console.error(error);
    }
  };

  const handleToggleActive = async (method: PaymentMethod) => {
    try {
      const response = await fetch(`/api/admin/payment-methods/${method.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !method.is_active }),
      });

      if (!response.ok) throw new Error('Failed to update');

      toast.success(method.is_active ? 'Payment method disabled' : 'Payment method enabled');
      loadPaymentMethods();
    } catch (error) {
      toast.error('Failed to update payment method');
      console.error(error);
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
            <h1 className="text-3xl font-bold text-white mb-2">Payment Methods</h1>
            <p className="text-gray-400">Manage payment addresses for credit purchases</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              ← Back to Admin
            </Link>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              + Add Payment Method
            </button>
          </div>
        </div>

        {/* Payment Methods List */}
        {paymentMethods.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-12 text-center">
            <div className="text-6xl mb-4">💳</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Payment Methods</h3>
            <p className="text-gray-400 mb-6">Add your first payment method to start accepting credit purchases</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Add Payment Method
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {paymentMethods
              .sort((a, b) => a.display_order - b.display_order)
              .map((method) => (
                <div
                  key={method.id}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-white">{method.name}</h3>
                        {method.network && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                            {method.network}
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            method.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {method.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-400">Address:</p>
                          <p className="text-white font-mono text-sm break-all bg-gray-900/50 px-3 py-2 rounded mt-1">
                            {method.address}
                          </p>
                        </div>

                        {method.instructions && (
                          <div>
                            <p className="text-sm text-gray-400">Instructions:</p>
                            <p className="text-gray-300 text-sm mt-1">{method.instructions}</p>
                          </div>
                        )}

                        {method.qr_code_url && (
                          <div>
                            <p className="text-sm text-gray-400">QR Code URL:</p>
                            <a
                              href={method.qr_code_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-sm"
                            >
                              {method.qr_code_url}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(method)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          method.is_active
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {method.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => setEditingMethod(method)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(method.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(isAddModalOpen || editingMethod) && (
        <PaymentMethodModal
          method={editingMethod}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingMethod(null);
          }}
          onSave={() => {
            setIsAddModalOpen(false);
            setEditingMethod(null);
            loadPaymentMethods();
          }}
        />
      )}
    </div>
  );
}

interface PaymentMethodModalProps {
  method: PaymentMethod | null;
  onClose: () => void;
  onSave: () => void;
}

function PaymentMethodModal({ method, onClose, onSave }: PaymentMethodModalProps) {
  const [formData, setFormData] = useState({
    name: method?.name || '',
    network: method?.network || '',
    address: method?.address || '',
    qr_code_url: method?.qr_code_url || '',
    instructions: method?.instructions || '',
    display_order: method?.display_order || 0,
    is_active: method?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = method
        ? `/api/admin/payment-methods/${method.id}`
        : '/api/admin/payment-methods';
      
      const response = await fetch(url, {
        method: method ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast.success(method ? 'Payment method updated' : 'Payment method added');
      onSave();
    } catch (error) {
      toast.error('Failed to save payment method');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-6">
          {method ? 'Edit Payment Method' : 'Add Payment Method'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              placeholder="e.g., Binance Pay, USDT (BEP-20)"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Network
            </label>
            <input
              type="text"
              value={formData.network}
              onChange={(e) => setFormData({ ...formData, network: e.target.value })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              placeholder="e.g., BEP-20, TRC-20, Binance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payment Address/ID *
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 font-mono text-sm"
              placeholder="Wallet address or payment ID"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              QR Code URL (optional)
            </label>
            <input
              type="url"
              value={formData.qr_code_url}
              onChange={(e) => setFormData({ ...formData, qr_code_url: e.target.value })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Instructions (optional)
            </label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              placeholder="Payment instructions for users..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-purple-600 bg-gray-900 border-gray-700 rounded focus:ring-purple-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-300">
              Active (visible to users)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : method ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

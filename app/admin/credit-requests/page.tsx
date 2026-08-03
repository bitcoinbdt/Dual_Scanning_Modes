'use client';

import { useState, useEffect } from 'react';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { CreditPurchaseRequestWithDetails } from '@/types/creditPurchase';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function AdminCreditRequestsPage() {
  return (
    <AdminProtectedRoute>
      <CreditRequestsContent />
    </AdminProtectedRoute>
  );
}

function CreditRequestsContent() {
  const [requests, setRequests] = useState<CreditPurchaseRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [reviewingRequest, setReviewingRequest] = useState<CreditPurchaseRequestWithDetails | null>(null);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/credit-requests?status=${filter}`);
      if (!response.ok) throw new Error('Failed to load requests');
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      toast.error('Failed to load credit requests');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0118] py-4 md:py-8 px-3 md:px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Credit Requests
              {filter === 'pending' && pendingCount > 0 && (
                <span className="ml-2 md:ml-3 px-2 md:px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm md:text-lg rounded-full">
                  {pendingCount}
                </span>
              )}
            </h1>
            <p className="text-sm md:text-base text-gray-400">Review and approve credit purchase requests</p>
          </div>
          <Link
            href="/admin"
            className="px-3 md:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm md:text-base whitespace-nowrap"
          >
            ← Back
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 md:px-4 py-2 rounded-lg transition-colors capitalize text-sm md:text-base whitespace-nowrap ${
                filter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {status}
              {status === 'pending' && pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-500/30 text-yellow-400 text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No {filter !== 'all' ? filter : ''} requests
            </h3>
            <p className="text-gray-400">
              {filter === 'pending'
                ? 'All caught up! No pending requests to review.'
                : `No ${filter} credit requests found.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onReview={() => setReviewingRequest(request)}
                onReload={loadRequests}
              />
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewingRequest && (
        <ReviewModal
          request={reviewingRequest}
          onClose={() => setReviewingRequest(null)}
          onSuccess={() => {
            setReviewingRequest(null);
            loadRequests();
          }}
        />
      )}
    </div>
  );
}

interface RequestCardProps {
  request: CreditPurchaseRequestWithDetails;
  onReview: () => void;
  onReload: () => void;
}

function RequestCard({ request, onReview, onReload }: RequestCardProps) {
  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3">
        <div className="flex-1 w-full">
          <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
            <h3 className="text-base md:text-lg font-semibold text-white">
              {request.credits_amount} Credits
            </h3>
            <span className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded-full border ${statusColors[request.status]}`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </div>
          <p className="text-gray-400 text-xs md:text-sm">
            Requested by: <span className="text-white">{request.user_email || 'Unknown'}</span>
          </p>
          <p className="text-gray-400 text-xs md:text-sm">
            Submitted: {formatDate(request.created_at)}
          </p>
        </div>

        {request.status === 'pending' && (
          <button
            onClick={onReview}
            className="w-full sm:w-auto px-3 md:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm md:text-base"
          >
            Review
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-4 pt-4 border-t border-gray-700">
        <div>
          <p className="text-sm text-gray-400 mb-1">Payment Method</p>
          <p className="text-white font-medium">
            {request.payment_method_name || 'Unknown'}
            {request.payment_network && (
              <span className="ml-2 text-sm text-gray-400">({request.payment_network})</span>
            )}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-400 mb-1">Amount (USD)</p>
          <p className="text-white font-medium">
            {request.price_usd != null ? `$${request.price_usd.toFixed(2)}` : 'N/A'}
          </p>
        </div>

        <div className="md:col-span-2">
          <p className="text-xs md:text-sm text-gray-400 mb-1">Transaction Hash</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <p className="text-white font-mono text-xs md:text-sm break-all bg-gray-900/50 px-3 py-2 rounded flex-1">
              {request.transaction_hash}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(request.transaction_hash);
                toast.success('Copied!');
              }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors text-xs md:text-sm whitespace-nowrap"
            >
              Copy
            </button>
          </div>
        </div>

        {request.status !== 'pending' && (
          <>
            {request.reviewed_at && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Reviewed At</p>
                <p className="text-white text-sm">{formatDate(request.reviewed_at)}</p>
              </div>
            )}

            {request.admin_notes && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-400 mb-1">Admin Notes</p>
                <p className="text-white text-sm bg-gray-900/50 px-3 py-2 rounded">
                  {request.admin_notes}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ReviewModalProps {
  request: CreditPurchaseRequestWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}

function ReviewModal({ request, onClose, onSuccess }: ReviewModalProps) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const response = await fetch(`/api/admin/credit-requests/${request.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'approve' ? 'approved' : 'rejected',
          admin_notes: adminNotes || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to process request');

      toast.success(
        action === 'approve'
          ? `Approved! ${request.credits_amount} credits added to user account`
          : 'Request rejected'
      );
      onSuccess();
    } catch (error) {
      toast.error('Failed to process request');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">Review Credit Request</h2>

        {/* Request Summary */}
        <div className="bg-gray-900/50 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">User:</span>
            <span className="text-white font-medium">{request.user_email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Credits:</span>
            <span className="text-white font-medium">{request.credits_amount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount:</span>
            <span className="text-white font-medium">
              {request.price_usd != null ? `$${request.price_usd.toFixed(2)}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Payment Method:</span>
            <span className="text-white font-medium">{request.payment_method_name}</span>
          </div>
          <div className="pt-2 border-t border-gray-700">
            <p className="text-gray-400 text-sm mb-1">Transaction Hash:</p>
            <p className="text-white font-mono text-xs break-all">{request.transaction_hash}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Decision</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction('approve')}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  action === 'approve'
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                ✓ Approve
              </button>
              <button
                type="button"
                onClick={() => setAction('reject')}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  action === 'reject'
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                ✗ Reject
              </button>
            </div>
          </div>

          {/* Admin Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Admin Notes {action === 'reject' && '(Required for rejection)'}
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              placeholder={
                action === 'approve'
                  ? 'Optional notes about this approval...'
                  : 'Please explain why this request is being rejected...'
              }
              rows={3}
              required={action === 'reject'}
            />
          </div>

          {/* Warning for Approval */}
          {action === 'approve' && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400 text-sm">
                ⚠️ Upon approval, <strong>{request.credits_amount} credits</strong> will be
                automatically added to the user's account.
              </p>
            </div>
          )}

          {/* Warning for Rejection */}
          {action === 'reject' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">
                ⚠️ The user will be notified of the rejection. Please provide a clear reason.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              disabled={processing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              disabled={processing}
            >
              {processing ? 'Processing...' : action === 'approve' ? 'Approve & Add Credits' : 'Reject Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

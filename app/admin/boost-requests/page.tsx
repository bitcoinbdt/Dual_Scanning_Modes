'use client';

import { useState, useEffect } from 'react';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function AdminBoostRequestsPage() {
  return (
    <AdminProtectedRoute>
      <BoostRequestsContent />
    </AdminProtectedRoute>
  );
}

interface BoostRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: string;
  tokenInfo: {
    name: string;
    symbol: string;
    logoUrl: string;
    contractAddress: string;
    blockchain: string;
    website?: string;
    description?: string;
    coingeckoId?: string;
  };
  durationHours: number;
  creditsSpent: number;
  requestedAt: string;
  reviewedAt?: string;
  startsAt?: string;
  expiresAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
}

function BoostRequestsContent() {
  const [requests, setRequests] = useState<BoostRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'active' | 'rejected' | 'expired'>('pending');
  const [reviewingRequest, setReviewingRequest] = useState<BoostRequest | null>(null);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        filter === 'all'
          ? '/api/admin/boost-requests'
          : `/api/admin/boost-requests?status=${filter}`
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load boost requests');
      }
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load boost requests');
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
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
              Token Boost Requests
              {pendingCount > 0 && (
                <span className="ml-2 md:ml-3 px-2 md:px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm md:text-lg rounded-full">
                  {pendingCount}
                </span>
              )}
            </h1>
            <p className="text-sm md:text-base text-gray-400">
              Review and approve token advertising boost requests
            </p>
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
          {(['pending', 'active', 'approved', 'rejected', 'expired', 'all'] as const).map((status) => (
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
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No {filter !== 'all' ? filter : ''} boost requests
            </h3>
            <p className="text-gray-400">
              {filter === 'pending'
                ? 'All caught up! No pending boost requests to review.'
                : `No ${filter} boost requests found.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <BoostRequestCard
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

function BoostRequestCard({
  request,
  onReview,
  onReload,
}: {
  request: BoostRequest;
  onReview: () => void;
  onReload: () => void;
}) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const timeRemaining = request.expiresAt
    ? (() => {
        const diff = new Date(request.expiresAt).getTime() - Date.now();
        if (diff <= 0) return 'Expired';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
      })()
    : null;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3">
        {/* Token Info */}
        <div className="flex items-center gap-3 flex-1">
          <img
            src={request.tokenInfo.logoUrl}
            alt={request.tokenInfo.symbol}
            className="w-12 h-12 rounded-full bg-gray-700 object-cover flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://ui-avatars.com/api/?name=${request.tokenInfo.symbol}&background=7c3aed&color=fff`;
            }}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base md:text-lg font-semibold text-white">
                {request.tokenInfo.name}
                <span className="ml-1 text-gray-400 text-sm">({request.tokenInfo.symbol})</span>
              </h3>
              <span
                className={`px-2 py-0.5 text-xs rounded-full border capitalize ${
                  statusColors[request.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }`}
              >
                {request.status}
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">
              by <span className="text-white">{request.userEmail}</span>
            </p>
            <p className="text-gray-500 text-xs font-mono mt-0.5">
              {request.tokenInfo.contractAddress.slice(0, 14)}...
              {request.tokenInfo.contractAddress.slice(-8)}
              <span className="ml-2 capitalize text-purple-400">[{request.tokenInfo.blockchain}]</span>
            </p>
          </div>
        </div>

        {/* Action Button */}
        {request.status === 'pending' && (
          <button
            onClick={onReview}
            className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Review
          </button>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-gray-700">
        <div>
          <p className="text-xs text-gray-400 mb-1">Duration</p>
          <p className="text-white font-medium">{request.durationHours}h</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Credits Spent</p>
          <p className="text-white font-medium">{request.creditsSpent}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Requested</p>
          <p className="text-white text-sm">{formatDate(request.requestedAt)}</p>
        </div>
        {request.status === 'active' && timeRemaining && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Time Left</p>
            <p className="text-green-400 font-medium text-sm">{timeRemaining}</p>
          </div>
        )}
        {request.expiresAt && request.status !== 'active' && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Expires</p>
            <p className="text-white text-sm">{formatDate(request.expiresAt)}</p>
          </div>
        )}
      </div>

      {/* Optional fields */}
      {(request.tokenInfo.website || request.tokenInfo.description || request.tokenInfo.coingeckoId) && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-1">
          {request.tokenInfo.website && (
            <p className="text-xs text-gray-400">
              Website:{' '}
              <a href={request.tokenInfo.website} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:underline">{request.tokenInfo.website}</a>
            </p>
          )}
          {request.tokenInfo.coingeckoId && (
            <p className="text-xs text-gray-400">
              CoinGecko ID: <span className="text-white">{request.tokenInfo.coingeckoId}</span>
            </p>
          )}
          {request.tokenInfo.description && (
            <p className="text-xs text-gray-400">
              Description: <span className="text-white">{request.tokenInfo.description}</span>
            </p>
          )}
        </div>
      )}

      {/* Rejection Reason */}
      {request.status === 'rejected' && request.rejectionReason && (
        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-xs">
            <strong>Rejection Reason:</strong> {request.rejectionReason}
          </p>
        </div>
      )}

      {/* Admin Notes */}
      {request.adminNotes && (
        <div className="mt-2 bg-gray-700/30 rounded-lg p-3">
          <p className="text-gray-400 text-xs">
            <strong>Admin Notes:</strong> {request.adminNotes}
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewModal({
  request,
  onClose,
  onSuccess,
}: {
  request: BoostRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const url =
        action === 'approve'
          ? `/api/admin/boost-requests/${request.id}/approve`
          : `/api/admin/boost-requests/${request.id}/reject`;

      const body =
        action === 'approve'
          ? { adminNotes: adminNotes || undefined }
          : { reason: rejectionReason.trim(), adminNotes: adminNotes || undefined };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to ${action} boost`);
      }

      toast.success(
        action === 'approve'
          ? `✅ Boost approved and activated! Token is now live.`
          : `❌ Boost rejected. ${data.creditsRefunded ? `${data.creditsRefunded} credits refunded.` : ''}`
      );
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} boost`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4">Review Boost Request</h2>

        {/* Token Summary */}
        <div className="bg-gray-900/50 rounded-lg p-4 mb-5 space-y-2">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={request.tokenInfo.logoUrl}
              alt={request.tokenInfo.symbol}
              className="w-10 h-10 rounded-full bg-gray-700 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  `https://ui-avatars.com/api/?name=${request.tokenInfo.symbol}&background=7c3aed&color=fff`;
              }}
            />
            <div>
              <p className="text-white font-bold">{request.tokenInfo.name} ({request.tokenInfo.symbol})</p>
              <p className="text-gray-400 text-xs capitalize">{request.tokenInfo.blockchain}</p>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">User:</span>
            <span className="text-white">{request.userEmail}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Duration:</span>
            <span className="text-white">{request.durationHours} hours</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Credits Cost:</span>
            <span className="text-white">{request.creditsSpent}</span>
          </div>
          <div className="pt-2 border-t border-gray-700">
            <p className="text-gray-400 text-xs mb-1">Contract Address:</p>
            <p className="text-white font-mono text-xs break-all">{request.tokenInfo.contractAddress}</p>
          </div>
          {request.tokenInfo.website && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Website:</span>
              <a href={request.tokenInfo.website} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:underline text-xs">{request.tokenInfo.website}</a>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Decision */}
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
                ✓ Approve & Activate
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

          {/* Rejection Reason (required for reject) */}
          {action === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                placeholder="Explain why this boost is being rejected (visible to user)..."
                rows={3}
                required
              />
            </div>
          )}

          {/* Admin Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Admin Notes <span className="text-gray-500">(Internal, optional)</span>
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              placeholder="Internal notes (not shown to user)..."
              rows={2}
            />
          </div>

          {/* Warning banners */}
          {action === 'approve' && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400 text-sm">
                ✅ Upon approval, this token will be <strong>immediately activated</strong> and shown
                in the Featured Tokens banner across the platform for <strong>{request.durationHours} hours</strong>.
              </p>
            </div>
          )}
          {action === 'reject' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">
                ⚠️ Rejecting this request will <strong>refund {request.creditsSpent} credits</strong> back to
                the user's account. The rejection reason will be visible to the user.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 ${
                action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              disabled={processing}
            >
              {processing
                ? 'Processing...'
                : action === 'approve'
                ? 'Approve & Activate'
                : 'Reject & Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

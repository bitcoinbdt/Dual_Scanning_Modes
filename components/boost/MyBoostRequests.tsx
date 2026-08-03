'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Clock, CheckCircle, XCircle, AlertCircle, BarChart3 } from 'lucide-react';
import { getStatusColor, formatTimeRemaining, formatBoostPrice } from '@/types/boost';

interface BoostRequest {
  id: string;
  status: string;
  durationHours: number;
  creditsSpent: number;
  requestedAt: string;
  expiresAt?: string;
  rejectionReason?: string;
  tokenInfo: {
    name: string;
    symbol: string;
    logoUrl: string;
    contractAddress: string;
    blockchain: string;
    currentPriceUsd?: number;
    priceChange24h?: number;
  };
  analytics?: {
    totalScans: number;
    lastScanAt?: string;
  };
}

export default function MyBoostRequests() {
  const [requests, setRequests] = useState<BoostRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/boost/my-requests', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch requests');
      }

      setRequests(data.requests);
    } catch (err: any) {
      console.error('Error fetching boost requests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-strong rounded-2xl p-12 text-center">
        <Loader2 className="w-10 h-10 text-primary-themed animate-spin mx-auto mb-3" />
        <p className="text-muted-themed">Loading your boost requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-strong rounded-2xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="glass-strong rounded-2xl p-12 text-center">
        <BarChart3 className="w-16 h-16 text-muted-themed mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold text-themed mb-2">No Boost Requests Yet</h3>
        <p className="text-muted-themed">
          Submit your first boost request to feature your token across the platform.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request, index) => {
        const statusInfo = getStatusColor(request.status as any);
        const isActive = request.status === 'active';

        return (
          <motion.div
            key={request.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass-strong rounded-2xl p-5 border border-white/5 hover:border-primary-themed/30 transition"
          >
            <div className="flex items-start gap-4">
              {/* Token Logo */}
              <img
                src={request.tokenInfo.logoUrl}
                alt={request.tokenInfo.symbol}
                className="w-14 h-14 rounded-full bg-white/5"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
                }}
              />

              <div className="flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-themed">
                      {request.tokenInfo.name} ({request.tokenInfo.symbol})
                    </h3>
                    <p className="text-xs text-muted-themed font-mono">
                      {request.tokenInfo.contractAddress.slice(0, 10)}...
                      {request.tokenInfo.contractAddress.slice(-8)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo.bg} ${statusInfo.text}`}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div className="glass rounded-lg p-2">
                    <div className="text-xs text-muted-themed">Duration</div>
                    <div className="text-sm font-bold text-themed">{request.durationHours}h</div>
                  </div>
                  <div className="glass rounded-lg p-2">
                    <div className="text-xs text-muted-themed">Cost</div>
                    <div className="text-sm font-bold text-themed">{request.creditsSpent} cr</div>
                  </div>
                  {isActive && request.expiresAt && (
                    <div className="glass rounded-lg p-2 col-span-2">
                      <div className="text-xs text-muted-themed">Time Remaining</div>
                      <div className="text-sm font-bold text-primary-themed flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeRemaining(request.expiresAt)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Analytics (for active boosts) */}
                {isActive && request.analytics && (
                  <div className="glass rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-themed mb-1">Total Scans</div>
                        <div className="text-2xl font-bold gradient-text">{request.analytics.totalScans}</div>
                      </div>
                      {request.analytics.lastScanAt && (
                        <div className="text-right">
                          <div className="text-xs text-muted-themed">Last Scan</div>
                          <div className="text-xs text-themed">
                            {new Date(request.analytics.lastScanAt).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejection Reason */}
                {request.status === 'rejected' && request.rejectionReason && (
                  <div className="rounded-lg p-3 bg-red-400/10 border border-red-400/30">
                    <p className="text-xs text-red-300">
                      <strong>Rejection Reason:</strong> {request.rejectionReason}
                    </p>
                  </div>
                )}

                {/* Requested Date */}
                <div className="text-xs text-muted-themed mt-2">
                  Requested: {new Date(request.requestedAt).toLocaleString()}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

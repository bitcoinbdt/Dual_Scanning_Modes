import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { CreditRequest } from '@/lib/types';

type FilterTab = 'pending' | 'approved' | 'rejected' | 'all';

export function AdminCreditRequests() {
  const { user, isAdmin, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [reviewing, setReviewing] = useState<CreditRequest | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, all: 0 });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
      return;
    }
    if (user && isAdmin) loadRequests();
  }, [user, isAdmin, loading, navigate]);

  const loadRequests = async () => {
    setDataLoading(true);
    const { data, error } = await supabase
      .from('credit_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      showToast('Failed to load requests', 'error');
    } else {
      const all = (data || []) as CreditRequest[];
      setRequests(all);
      setCounts({
        pending: all.filter((r) => r.status === 'pending').length,
        approved: all.filter((r) => r.status === 'approved').length,
        rejected: all.filter((r) => r.status === 'rejected').length,
        all: all.length,
      });
    }
    setDataLoading(false);
  };

  if (loading || (!user || !isAdmin)) {
    return <div className="min-h-screen flex items-center justify-center text-muted-themed">Loading...</div>;
  }

  const filtered = requests.filter((r) => filter === 'all' || r.status === filter);

  const openReview = (req: CreditRequest) => {
    setReviewing(req);
    setDecision(null);
    setNotes('');
  };

  const closeReview = () => {
    setReviewing(null);
    setDecision(null);
    setNotes('');
  };

  const handleDecision = async () => {
    if (!reviewing || !decision) return;
    if (decision === 'reject' && !notes.trim()) {
      showToast('Rejection notes are required', 'error');
      return;
    }
    setProcessing(true);
    try {
      const fnName = decision === 'approve' ? 'approve_credit_request' : 'reject_credit_request';
      const { error } = await supabase.rpc(fnName, {
        p_request_id: reviewing.id,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      showToast(
        decision === 'approve' ? 'Request approved! Credits added.' : 'Request rejected.',
        'success',
      );
      closeReview();
      loadRequests();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showToast(msg, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    showToast('Hash copied', 'success');
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-400/20 text-amber-400 border-amber-400/30',
      approved: 'bg-green-400/20 text-green-400 border-green-400/30',
      rejected: 'bg-red-400/20 text-red-400 border-red-400/30',
    };
    return styles[status] || styles.pending;
  };

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
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold gradient-text">Credit Purchase Requests</h1>
            {counts.pending > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-400/20 text-amber-400 font-semibold">
                {counts.pending} pending
              </span>
            )}
          </div>
          <p className="text-sm text-muted-themed">Review and approve credit purchase requests</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-6">
          {(['pending', 'approved', 'rejected', 'all'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                filter === tab
                  ? 'gradient-primary text-white'
                  : 'glass text-muted-themed hover:text-themed'
              }`}
            >
              <span className="capitalize">{tab}</span>
              {counts[tab] > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filter === tab ? 'bg-white/20' : 'bg-white/10'
                  }`}
                >
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-themed" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-strong rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-bold text-themed mb-1">No {filter} requests</h3>
            <p className="text-sm text-muted-themed">
              {filter === 'pending'
                ? 'All caught up! No pending requests to review.'
                : `No ${filter} requests found.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((req) => (
              <div key={req.id} className="glass-strong rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-2xl font-bold gradient-text">{req.credits} credits</div>
                    <div className="text-sm text-muted-themed">{req.user_email}</div>
                    <div className="text-xs text-muted-themed mt-0.5">
                      {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full border font-semibold capitalize ${statusBadge(req.status)}`}>
                      {req.status}
                    </span>
                    {req.status === 'pending' && (
                      <button
                        onClick={() => openReview(req)}
                        className="text-xs gradient-primary text-white px-3 py-1.5 rounded-lg font-semibold"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div className="glass rounded-lg p-2">
                    <div className="text-xs text-muted-themed">Payment Method</div>
                    <div className="text-themed font-semibold">{req.payment_method_name}</div>
                    {req.payment_method_network && (
                      <div className="text-xs text-muted-themed uppercase">{req.payment_method_network}</div>
                    )}
                  </div>
                  <div className="glass rounded-lg p-2">
                    <div className="text-xs text-muted-themed">Amount (USD)</div>
                    <div className="text-themed font-semibold">${req.price_usd.toFixed(2)}</div>
                  </div>
                </div>

                <div className="glass rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-themed">Transaction Hash</span>
                    <button
                      onClick={() => copyHash(req.tx_hash)}
                      className="text-muted-themed hover:text-themed"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <code className="text-xs text-themed font-mono break-all block">{req.tx_hash}</code>
                </div>

                {req.reviewed_at && (
                  <div className="mt-2 text-xs text-muted-themed">
                    Reviewed: {new Date(req.reviewed_at).toLocaleString()}
                  </div>
                )}
                {req.admin_notes && (
                  <div className="mt-1 text-xs text-muted-themed">
                    Notes: {req.admin_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewing && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={closeReview}
        >
          <div
            className="relative w-full max-w-lg glass-strong rounded-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={closeReview} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold gradient-text mb-4">Review Request</h2>

            <div className="glass rounded-lg p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-themed">User:</span><span className="text-themed font-semibold">{reviewing.user_email}</span></div>
              <div className="flex justify-between"><span className="text-muted-themed">Credits:</span><span className="text-themed font-semibold">{reviewing.credits}</span></div>
              <div className="flex justify-between"><span className="text-muted-themed">USD:</span><span className="text-themed font-semibold">${reviewing.price_usd.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-themed">Method:</span><span className="text-themed font-semibold">{reviewing.payment_method_name}</span></div>
              <div>
                <div className="text-muted-themed mb-1">Transaction Hash:</div>
                <code className="text-xs text-themed font-mono break-all block bg-themed p-2 rounded">
                  {reviewing.tx_hash}
                </code>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setDecision('approve')}
                className={`py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  decision === 'approve'
                    ? 'bg-green-500 text-white'
                    : 'glass text-muted-themed hover:text-green-400'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" /> Approve
              </button>
              <button
                onClick={() => setDecision('reject')}
                className={`py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  decision === 'reject'
                    ? 'bg-red-500 text-white'
                    : 'glass text-muted-themed hover:text-red-400'
                }`}
              >
                <XCircle className="w-5 h-5" /> Reject
              </button>
            </div>

            {decision && (
              <div className="animate-fade-in">
                <label className="text-xs text-muted-themed mb-1.5 block">
                  Admin Notes {decision === 'reject' && <span className="text-red-400">(required)</span>}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={decision === 'reject' ? 'Provide a reason for rejection...' : 'Optional notes...'}
                  className="w-full bg-themed border border-themed rounded-lg px-3 py-2 text-sm text-themed focus:outline-none focus:border-primary-themed transition resize-none mb-3"
                />

                {decision === 'approve' ? (
                  <div className="rounded-lg p-3 mb-3 text-sm" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <span className="text-green-300">
                      {reviewing.credits} credits will be added to {reviewing.user_email}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg p-3 mb-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <span className="text-red-300">
                      Please provide a reason for rejection in the notes above.
                    </span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeReview}
                    className="flex-1 glass text-muted-themed hover:text-themed py-2.5 rounded-lg font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDecision}
                    disabled={processing || (decision === 'reject' && !notes.trim())}
                    className={`flex-1 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 ${
                      decision === 'approve' ? 'bg-green-500 hover:opacity-90' : 'bg-red-500 hover:opacity-90'
                    }`}
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : decision === 'approve' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {processing ? 'Processing...' : decision === 'approve' ? 'Approve & Add Credits' : 'Reject Request'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

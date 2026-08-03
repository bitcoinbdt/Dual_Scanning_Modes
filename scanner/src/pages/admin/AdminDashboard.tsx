import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  FileText,
  CreditCard,
  DollarSign,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Database,
  Zap,
  Settings,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface AdminStats {
  pendingCount: number;
  totalRequests: number;
  activeGateways: number;
  totalGateways: number;
}

export function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats>({
    pendingCount: 0,
    totalRequests: 0,
    activeGateways: 0,
    totalGateways: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
      return;
    }
    if (user && isAdmin) {
      loadStats();
    }
  }, [user, isAdmin, loading, navigate]);

  const loadStats = async () => {
    setStatsLoading(true);
    const [pending, total, gateways] = await Promise.all([
      supabase.from('credit_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('credit_requests').select('*', { count: 'exact', head: true }),
      supabase.from('payment_methods').select('*'),
    ]);
    const gatewayData = gateways.data || [];
    setStats({
      pendingCount: pending.count ?? 0,
      totalRequests: total.count ?? 0,
      activeGateways: gatewayData.filter((g: { is_active: boolean }) => g.is_active).length,
      totalGateways: gatewayData.length,
    });
    setStatsLoading(false);
  };

  if (loading || (!user || !isAdmin)) {
    return <div className="min-h-screen flex items-center justify-center text-muted-themed">Loading...</div>;
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-grid">
      {/* Top Bar */}
      <header
        className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: 'rgba(10,1,24,0.8)', backdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-themed">Admin Console</div>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                System Operational
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadStats}
              className="flex items-center gap-1.5 text-sm text-muted-themed hover:text-themed transition"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-themed hover:text-themed transition">
              <ArrowLeft className="w-4 h-4" /> Back to App
            </Link>
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold">
              {user.email?.[0]?.toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="mb-8">
          <p className="text-muted-themed">{greeting}, Admin</p>
          <h1 className="text-3xl font-bold gradient-text">Dashboard Overview</h1>
          <p className="text-sm text-muted-themed mt-1">
            {user.email} · {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Clock}
            label="Pending Requests"
            value={stats.pendingCount}
            color="text-amber-400"
            bg="bg-amber-400/10"
            actionNeeded={stats.pendingCount > 0}
            loading={statsLoading}
          />
          <StatCard
            icon={FileText}
            label="Total Requests"
            value={stats.totalRequests}
            color="text-purple-400"
            bg="bg-purple-400/10"
            loading={statsLoading}
          />
          <StatCard
            icon={CreditCard}
            label="Active Gateways"
            value={stats.activeGateways}
            color="text-green-400"
            bg="bg-green-400/10"
            loading={statsLoading}
          />
          <StatCard
            icon={DollarSign}
            label="Total Gateways"
            value={stats.totalGateways}
            color="text-pink-400"
            bg="bg-pink-400/10"
            loading={statsLoading}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Link
            to="/admin/credit-requests"
            className="glass-strong rounded-2xl p-6 hover:glow-primary transition border border-white/5 hover:border-amber-400/30"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-themed">Review Credit Requests</h3>
            </div>
            <p className="text-sm text-muted-themed">
              Approve or reject pending credit purchase requests from users
            </p>
            {stats.pendingCount > 0 && (
              <span className="inline-block mt-3 text-xs px-2 py-1 rounded-full bg-amber-400/20 text-amber-400 font-semibold">
                {stats.pendingCount} pending
              </span>
            )}
          </Link>

          <Link
            to="/admin/payment-methods"
            className="glass-strong rounded-2xl p-6 hover:glow-primary transition border border-white/5 hover:border-purple-400/30"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-400/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="font-bold text-themed">Manage Payment Methods</h3>
            </div>
            <p className="text-sm text-muted-themed">
              Configure wallet addresses for Binance, KuCoin, USDT, USDC, and TRX
            </p>
          </Link>
        </div>

        {/* System Status */}
        <div className="glass-strong rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-themed">System Status</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-green-400/20 text-green-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              All Systems Operational
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatusItem label="Admin Account" value={user.email ?? ''} />
            <StatusItem label="Database" value="Connected (Supabase)" />
            <StatusItem label="Credit System" value="Active & Operational" />
            <StatusItem label="Payment Processing" value="Manual Review Mode" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  actionNeeded,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  bg: string;
  actionNeeded?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-xs text-muted-themed mb-1">{label}</div>
      {loading ? (
        <div className="h-8 w-16 animate-shimmer rounded" />
      ) : (
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
      )}
      {actionNeeded && !loading && (
        <span className="inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 font-semibold">
          Action Needed
        </span>
      )}
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="text-xs text-muted-themed mb-1">{label}</div>
      <div className="text-sm text-green-400 font-semibold flex items-center gap-1.5 truncate">
        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

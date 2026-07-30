'use client';

import { useState, useEffect } from 'react';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminDashboardPage() {
  return (
    <AdminProtectedRoute>
      <AdminDashboardContent />
    </AdminProtectedRoute>
  );
}

function AdminDashboardContent() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    pendingRequests: 0,
    totalRequests: 0,
    activePaymentMethods: 0,
    totalPaymentMethods: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [requestsRes, methodsRes] = await Promise.all([
        fetch('/api/admin/credit-requests?status=all'),
        fetch('/api/admin/payment-methods'),
      ]);

      if (requestsRes.ok && methodsRes.ok) {
        const requestsData = await requestsRes.json();
        const methodsData = await methodsRes.json();

        const requests = requestsData.requests || [];
        const methods = methodsData.paymentMethods || [];

        setStats({
          pendingRequests: requests.filter((r: any) => r.status === 'pending').length,
          totalRequests: requests.length,
          activePaymentMethods: methods.filter((m: any) => m.is_active).length,
          totalPaymentMethods: methods.length,
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0118] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              ← Back to App
            </Link>
          </div>
          <p className="text-gray-400">Welcome back, {user?.email}</p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-700 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <StatCard
              title="Pending Requests"
              value={stats.pendingRequests}
              icon="⏳"
              color="yellow"
              highlight={stats.pendingRequests > 0}
            />
            <StatCard
              title="Total Requests"
              value={stats.totalRequests}
              icon="📋"
              color="blue"
            />
            <StatCard
              title="Active Payment Methods"
              value={stats.activePaymentMethods}
              icon="💳"
              color="green"
            />
            <StatCard
              title="Total Payment Methods"
              value={stats.totalPaymentMethods}
              icon="🏦"
              color="purple"
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <ActionCard
              title="Review Credit Requests"
              description="Approve or reject pending credit purchase requests"
              icon="✓"
              href="/admin/credit-requests"
              badge={stats.pendingRequests > 0 ? stats.pendingRequests : undefined}
            />
            <ActionCard
              title="Manage Payment Methods"
              description="Add, edit, or remove payment methods"
              icon="💳"
              href="/admin/payment-methods"
            />
          </div>
        </div>

        {/* System Info */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">System Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Admin Email:</span>
              <span className="text-white font-mono">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Database:</span>
              <span className="text-green-400">Connected (Supabase)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Manual Credit System:</span>
              <span className="text-green-400">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: 'yellow' | 'blue' | 'green' | 'purple';
  highlight?: boolean;
}

function StatCard({ title, value, icon, color, highlight }: StatCardProps) {
  const colorClasses = {
    yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm rounded-lg border p-6 ${
        highlight ? 'ring-2 ring-yellow-500/50 animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-4xl">{icon}</span>
        {highlight && (
          <span className="px-2 py-1 bg-yellow-500/30 text-yellow-400 text-xs rounded-full">
            Action Required
          </span>
        )}
      </div>
      <h3 className="text-gray-400 text-sm mb-1">{title}</h3>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
  badge?: number;
}

function ActionCard({ title, description, icon, href, badge }: ActionCardProps) {
  return (
    <Link
      href={href}
      className="block bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 hover:border-purple-500/50 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-3xl">{icon}</div>
        {badge !== undefined && badge > 0 && (
          <span className="px-3 py-1 bg-yellow-500/30 text-yellow-400 text-sm rounded-full font-semibold">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
        {title}
      </h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </Link>
  );
}

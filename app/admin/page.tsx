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
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadStats();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadStats = async () => {
    setLoading(true);
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

  const greeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0118 0%, #0d0520 50%, #0a0118 100%)' }}>
      {/* Top Navigation Bar */}
      <nav style={{
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #7c3aed, #db2777)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(124,58,237,0.4)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="hidden md:block">
                <span style={{ color: 'white', fontWeight: 700, fontSize: '16px' }}>Admin Console</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                  <span style={{ color: '#64748b', fontSize: '11px' }}>System Operational</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={loadStats}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#94a3b8', fontSize: '13px', cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M8 16H3v5"/>
                </svg>
                Refresh
              </button>

              <Link
                href="/"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(219,39,119,0.2))',
                  border: '1px solid rgba(124,58,237,0.3)',
                  color: '#c4b5fd', fontSize: '13px', fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back to App
              </Link>

              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #db2777)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '14px',
                border: '2px solid rgba(124,58,237,0.4)',
              }}>
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero Header */}
        <div style={{ marginBottom: '40px' }}>
          <p style={{ color: '#7c3aed', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>
            {greeting()}, Admin
          </p>
          <h1 style={{ color: 'white', fontSize: '36px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '8px', margin: 0 }}>
            Dashboard Overview
          </h1>
          <p style={{ color: '#475569', fontSize: '14px', marginTop: '8px' }}>
            {user?.email} &middot; {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <StatCard
            label="Pending Requests"
            value={loading ? null : stats.pendingRequests}
            accent="#f59e0b"
            accentBg="rgba(245,158,11,0.1)"
            accentBorder="rgba(245,158,11,0.2)"
            urgent={stats.pendingRequests > 0}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            }
          />
          <StatCard
            label="Total Requests"
            value={loading ? null : stats.totalRequests}
            accent="#818cf8"
            accentBg="rgba(129,140,248,0.1)"
            accentBorder="rgba(129,140,248,0.2)"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            }
          />
          <StatCard
            label="Active Gateways"
            value={loading ? null : stats.activePaymentMethods}
            accent="#34d399"
            accentBg="rgba(52,211,153,0.1)"
            accentBorder="rgba(52,211,153,0.2)"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            }
          />
          <StatCard
            label="Total Gateways"
            value={loading ? null : stats.totalPaymentMethods}
            accent="#f472b6"
            accentBg="rgba(244,114,182,0.1)"
            accentBorder="rgba(244,114,182,0.2)"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
          />
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>Quick Actions</h2>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <ActionCard
              href="/admin/credit-requests"
              title="Review Credit Requests"
              description="Approve or reject pending credit purchase requests from users"
              badge={stats.pendingRequests > 0 ? stats.pendingRequests : undefined}
              accent="#f59e0b"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              }
            />
            <ActionCard
              href="/admin/payment-methods"
              title="Manage Payment Methods"
              description="Configure wallet addresses for Binance, KuCoin, USDT, USDC, and TRX"
              accent="#7c3aed"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              }
            />
          </div>
        </div>

        {/* System Status */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0 }}>System Status</h2>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <span style={{
              padding: '4px 12px', borderRadius: '20px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              color: '#22c55e', fontSize: '12px', fontWeight: 600,
            }}>All Systems Operational</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <StatusItem label="Admin Account" value={user?.email || '—'} status="active" mono />
            <StatusItem label="Database" value="Connected (Supabase)" status="active" />
            <StatusItem label="Credit System" value="Active & Operational" status="active" />
            <StatusItem label="Payment Processing" value="Manual Review Mode" status="active" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, accentBg, accentBorder, icon, urgent }: {
  label: string; value: number | null; accent: string;
  accentBg: string; accentBorder: string; icon: React.ReactNode; urgent?: boolean;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${urgent ? accent + '60' : accentBorder}`,
      borderRadius: '16px', padding: '24px',
      position: 'relative', overflow: 'hidden',
      boxShadow: urgent ? `0 0 24px ${accent}28` : 'none',
    }}>
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px',
        width: '80px', height: '80px', borderRadius: '50%',
        background: accentBg, filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: accentBg, border: `1px solid ${accentBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        {urgent && (
          <span style={{
            padding: '4px 10px', borderRadius: '20px',
            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
          }}>Action Needed</span>
        )}
      </div>
      <p style={{ color: '#64748b', fontSize: '13px', fontWeight: 500, margin: '0 0 6px' }}>{label}</p>
      {value === null ? (
        <div style={{ width: '60px', height: '36px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px' }} />
      ) : (
        <p style={{ color: 'white', fontSize: '42px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, margin: 0 }}>
          {value}
        </p>
      )}
    </div>
  );
}

// ─── Action Card ─────────────────────────────────────────────────────────────

function ActionCard({ href, title, description, badge, accent, icon }: {
  href: string; title: string; description: string;
  badge?: number; accent: string; icon: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px', padding: '24px', cursor: 'pointer', height: '100%',
      }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.background = 'rgba(255,255,255,0.04)';
          el.style.borderColor = accent + '50';
          el.style.transform = 'translateY(-2px)';
          el.style.boxShadow = `0 12px 40px ${accent}18`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.background = 'rgba(255,255,255,0.02)';
          el.style.borderColor = 'rgba(255,255,255,0.07)';
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: accent + '18', border: `1px solid ${accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
          }}>
            {icon}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {badge !== undefined && badge > 0 && (
              <span style={{
                padding: '4px 12px', borderRadius: '20px',
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                color: '#f59e0b', fontSize: '13px', fontWeight: 700,
              }}>{badge} pending</span>
            )}
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </div>
        <h3 style={{ color: 'white', fontSize: '17px', fontWeight: 700, margin: '0 0 6px' }}>{title}</h3>
        <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{description}</p>
      </div>
    </Link>
  );
}

// ─── Status Item ─────────────────────────────────────────────────────────────

function StatusItem({ label, value, status, mono }: {
  label: string; value: string; status: 'active' | 'error' | 'warning'; mono?: boolean;
}) {
  const statusColor = status === 'active' ? '#22c55e' : status === 'warning' ? '#f59e0b' : '#ef4444';
  return (
    <div style={{
      padding: '16px', background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px',
    }}>
      <p style={{ color: '#475569', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 8px' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}`, flexShrink: 0 }} />
        <span style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
          {value}
        </span>
      </div>
    </div>
  );
}

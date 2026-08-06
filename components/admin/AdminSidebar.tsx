'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  Zap,
  Menu,
  X,
  ChevronRight,
  FileText,
  Home,
} from 'lucide-react';

interface AdminRoute {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  badgeKey?: 'pendingCredits' | 'pendingBoosts';
  accentColor?: string;
  description: string;
}

const adminRoutes: AdminRoute[] = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Overview & stats',
  },
  {
    name: 'Credit Requests',
    href: '/admin/credit-requests',
    icon: FileText,
    badgeKey: 'pendingCredits',
    accentColor: '#f59e0b',
    description: 'Approve credit purchases',
  },
  {
    name: 'Boost Requests',
    href: '/admin/boost-requests',
    icon: Zap,
    badgeKey: 'pendingBoosts',
    accentColor: '#a855f7',
    description: 'Approve token boosts',
  },
  {
    name: 'Payment Methods',
    href: '/admin/payment-methods',
    icon: CreditCard,
    accentColor: '#06b6d4',
    description: 'Manage payment gateways',
  },
];

interface PendingCounts {
  pendingCredits: number;
  pendingBoosts: number;
}

export default function AdminSidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>({
    pendingCredits: 0,
    pendingBoosts: 0,
  });
  const pathname = usePathname();

  // Fetch pending counts for badges
  useEffect(() => {
    const fetchPendingCounts = async () => {
      try {
        // Get the auth token — always read freshest session, fall back to localStorage
        const { supabase } = await import('@/lib/supabase');
        let token: string | null = null;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token ?? null;
          if (token) localStorage.setItem('authToken', token);
        } catch {
          token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        }

        const authHeaders: Record<string, string> = {};
        if (token) authHeaders['Authorization'] = `Bearer ${token}`;

        const [creditRes, boostRes] = await Promise.all([
          fetch('/api/admin/credit-requests?status=all', { headers: authHeaders }),
          fetch('/api/admin/boost-requests?status=all', { headers: authHeaders }),
        ]);

        let pendingCredits = 0;
        let pendingBoosts = 0;

        if (creditRes.ok) {
          const data = await creditRes.json();
          const requests = data.requests || [];
          pendingCredits = requests.filter((r: any) => r.status === 'pending').length;
        }

        if (boostRes.ok) {
          const data = await boostRes.json();
          const requests = data.requests || [];
          pendingBoosts = requests.filter((r: any) => r.status === 'pending').length;
        }

        setPendingCounts({ pendingCredits, pendingBoosts });
      } catch (err) {
        // silently fail — badges are cosmetic
      }
    };

    fetchPendingCounts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname?.startsWith(href);
  };

  const getBadgeCount = (key?: 'pendingCredits' | 'pendingBoosts') => {
    if (!key) return 0;
    return pendingCounts[key] ?? 0;
  };

  const totalPending = pendingCounts.pendingCredits + pendingCounts.pendingBoosts;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 w-11 h-11 rounded-xl flex items-center justify-center"
        style={{
          background: 'rgba(124,58,237,0.2)',
          border: '1px solid rgba(124,58,237,0.3)',
          backdropFilter: 'blur(10px)',
        }}
        aria-label="Open admin menu"
      >
        <Menu className="w-5 h-5 text-purple-300" />
        {totalPending > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: '#f59e0b', color: '#000' }}
          >
            {totalPending > 9 ? '9+' : totalPending}
          </span>
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-50 flex flex-col
          lg:translate-x-0 transition-transform duration-300
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'linear-gradient(180deg, rgba(10,1,24,0.98) 0%, rgba(13,5,32,1) 100%)',
          borderRight: '1px solid rgba(124,58,237,0.2)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div
          className="h-16 flex items-center justify-between px-5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(124,58,237,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #db2777)',
                boxShadow: '0 0 20px rgba(124,58,237,0.4)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-sm">Admin Panel</div>
              <div className="text-purple-400 text-[10px] font-medium">Management Console</div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Section Label */}
          <p
            className="text-[10px] font-bold uppercase tracking-widest px-4 mb-3"
            style={{ color: 'rgba(148,163,184,0.5)' }}
          >
            Navigation
          </p>

          {adminRoutes.map((route) => {
            const Icon = route.icon;
            const active = isActive(route.href);
            const badgeCount = getBadgeCount(route.badgeKey);

            return (
              <Link
                key={route.href}
                href={route.href}
                onClick={() => setMobileMenuOpen(false)}
                className="group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  background: active
                    ? `rgba(${route.accentColor ? hexToRgb(route.accentColor) : '124,58,237'}, 0.12)`
                    : 'transparent',
                  border: active
                    ? `1px solid rgba(${route.accentColor ? hexToRgb(route.accentColor) : '124,58,237'}, 0.3)`
                    : '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                  }
                }}
              >
                {/* Active indicator bar */}
                {active && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r"
                    style={{
                      background: route.accentColor
                        ? `linear-gradient(180deg, ${route.accentColor}, ${route.accentColor}99)`
                        : 'linear-gradient(180deg, #7c3aed, #db2777)',
                    }}
                  />
                )}

                {/* Icon */}
                <Icon
                  className="w-5 h-5 flex-shrink-0 transition-colors"
                  style={{
                    color: active
                      ? route.accentColor || '#a78bfa'
                      : '#64748b',
                  }}
                />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm transition-colors"
                    style={{ color: active ? '#fff' : '#94a3b8' }}
                  >
                    {route.name}
                  </div>
                  <div
                    className="text-[10px] truncate"
                    style={{ color: active ? 'rgba(255,255,255,0.4)' : 'rgba(148,163,184,0.4)' }}
                  >
                    {route.description}
                  </div>
                </div>

                {/* Badge */}
                {badgeCount > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                    style={{
                      background: route.accentColor
                        ? `${route.accentColor}30`
                        : 'rgba(245,158,11,0.2)',
                      border: `1px solid ${route.accentColor || '#f59e0b'}50`,
                      color: route.accentColor || '#fbbf24',
                    }}
                  >
                    {badgeCount}
                  </span>
                )}

                {!active && badgeCount === 0 && (
                  <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#475569' }} />
                )}
              </Link>
            );
          })}

          {/* Pending summary */}
          {totalPending > 0 && (
            <div
              className="mt-4 mx-1 p-3 rounded-xl"
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }}
                />
                <span className="text-amber-400 text-xs font-bold">Action Required</span>
              </div>
              <p className="text-amber-400/70 text-[10px]">
                {totalPending} pending request{totalPending !== 1 ? 's' : ''} awaiting review
              </p>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-3 rounded-xl transition-all w-full"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            }}
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 text-sm font-semibold">Back to App</span>
          </Link>

          <div
            className="mt-3 p-3 rounded-xl text-center"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full bg-green-400"
                style={{ boxShadow: '0 0 8px #22c55e' }}
              />
              <span className="text-green-400 text-xs font-bold">System Online</span>
            </div>
            <p className="text-green-400/60 text-[10px]">All services operational</p>
          </div>
        </div>
      </aside>

      {/* Spacer for desktop layout */}
      <div className="hidden lg:block w-64 flex-shrink-0" />
    </>
  );
}

/** Convert hex color to rgb triple string for use in rgba() */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '124,58,237';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

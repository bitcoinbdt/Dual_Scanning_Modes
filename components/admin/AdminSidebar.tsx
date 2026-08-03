'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  DollarSign,
  Users,
  Settings,
  Menu,
  X,
  ChevronRight,
  FileText,
  TrendingUp,
} from 'lucide-react';

interface AdminRoute {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const adminRoutes: AdminRoute[] = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    name: 'Credit Requests',
    href: '/admin/credit-requests',
    icon: FileText,
  },
  {
    name: 'Payment Methods',
    href: '/admin/payment-methods',
    icon: CreditCard,
  },
];

export default function AdminSidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile Menu Button (Three-dot menu) */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden fixed top-20 right-4 z-40 w-12 h-12 rounded-xl flex items-center justify-center"
        style={{
          background: 'rgba(124,58,237,0.2)',
          border: '1px solid rgba(124,58,237,0.3)',
          backdropFilter: 'blur(10px)',
        }}
        aria-label="Open admin menu"
      >
        <Menu className="w-5 h-5 text-purple-300" />
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-50
          lg:translate-x-0 transition-transform duration-300
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'linear-gradient(180deg, rgba(10,1,24,0.95) 0%, rgba(13,5,32,0.98) 100%)',
          borderRight: '1px solid rgba(124,58,237,0.2)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Sidebar Header */}
        <div
          className="h-16 flex items-center justify-between px-5 border-b"
          style={{ borderColor: 'rgba(124,58,237,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
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

          {/* Close button for mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {adminRoutes.map((route) => {
            const Icon = route.icon;
            const active = isActive(route.href);

            return (
              <Link
                key={route.href}
                href={route.href}
                onClick={() => setMobileMenuOpen(false)}
                className="group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                style={{
                  background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                  border: active
                    ? '1px solid rgba(124,58,237,0.3)'
                    : '1px solid transparent',
                  color: active ? '#c4b5fd' : '#94a3b8',
                }}
              >
                {/* Active indicator */}
                {active && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r"
                    style={{ background: 'linear-gradient(180deg, #7c3aed, #db2777)' }}
                  />
                )}

                <Icon
                  className={`w-5 h-5 transition-colors ${
                    active ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-400'
                  }`}
                />

                <span
                  className={`flex-1 font-semibold text-sm transition-colors ${
                    active ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'
                  }`}
                >
                  {route.name}
                </span>

                {route.badge !== undefined && route.badge > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: 'rgba(245,158,11,0.2)',
                      border: '1px solid rgba(245,158,11,0.3)',
                      color: '#fbbf24',
                    }}
                  >
                    {route.badge}
                  </span>
                )}

                {!active && (
                  <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-400"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="text-slate-400 text-sm font-semibold">Back to App</span>
          </Link>

          <div
            className="mt-3 p-3 rounded-xl text-center"
            style={{
              background: 'rgba(34,197,94,0.1)',
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
            <p className="text-green-400/70 text-[10px]">All services operational</p>
          </div>
        </div>
      </aside>

      {/* Spacer for desktop sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0" />
    </>
  );
}

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  LogOut,
  User as UserIcon,
  Palette,
  ChevronDown,
  ChevronUp,
  Gift,
  Search,
  DollarSign,
  Menu,
  X,
  Bot,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCredits } from '@/contexts/CreditContext';
import { useAdmin } from '@/hooks/useAdmin';
import AuthModal from '@/components/AuthModal';

const THEMES_META = {
  default: { label: 'Dark Blue', primary: '#3b82f6' },
  cyber: { label: 'Cyber Green', primary: '#22c55e' },
  neon: { label: 'Neon Purple', primary: '#a855f7' },
};

type ThemeKey = 'default' | 'cyber' | 'neon';

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { balance } = useCredits();
  const { isAdmin } = useAdmin();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
        setThemeOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/', label: 'Scanner', icon: Search },
    { href: '/agent', label: 'Agent', icon: Bot },
    { href: '/pricing', label: 'Pricing', icon: DollarSign },
    ...(isAuthenticated ? [
      { href: '/referrals', label: 'Referral', icon: Gift },
      { href: '/advertising', label: 'Advertising', icon: Zap }
    ] : []),
  ];

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  const handleOpenCredits = () => {
    router.push('/pricing');
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5"
        style={{ background: 'rgba(10,1,24,0.8)', backdropFilter: 'blur(16px)' }}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center border border-sky-400/30 group-hover:border-sky-400/60 transition shadow-[0_0_10px_rgba(56,189,248,0.2)] group-hover:shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-sky-400 group-hover:text-indigo-400 transition-colors"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" fillOpacity="0.2" />
                </svg>
              </div>
              <span className="hidden sm:block font-bold text-themed text-lg tracking-tight">
                OnChain<span className="gradient-text">Alpha</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isActive(link.href)
                        ? 'text-primary-themed bg-white/5'
                        : 'text-muted-themed hover:text-themed hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive('/admin')
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-amber-400/70 hover:text-amber-400 hover:bg-amber-400/10'
                  }`}
                >
                  Admin
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <button
                onClick={handleOpenCredits}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass hover:glow-sm transition text-sm"
              >
                <Zap className="w-4 h-4 text-primary-themed" fill="currentColor" />
                <span className="font-bold text-primary-themed">{balance.balance}</span>
                <span className="text-muted-themed text-xs hidden sm:inline">credits</span>
              </button>
            )}

            {isAuthenticated ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg glass hover:glow-sm transition"
                >
                  <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold uppercase">
                    {user?.name?.[0] || user?.email?.[0] || 'U'}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-themed" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl p-3 animate-scale-in border border-white/10 shadow-xl animate-fade-in" style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)' }}>
                    <div className="px-2 py-2 border-b border-white/10 mb-2">
                      <div className="text-sm font-semibold text-themed truncate">
                        {user?.name || 'User'}
                      </div>
                      <div className="text-xs text-muted-themed truncate">{user?.email}</div>
                    </div>

                    <div className="relative mb-1" ref={themeRef}>
                      <button
                        onClick={() => setThemeOpen(!themeOpen)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-muted-themed hover:text-themed hover:bg-white/5 transition"
                      >
                        <Palette className="w-4 h-4" />
                        Theme: {THEMES_META[theme as ThemeKey]?.label || 'Dark Blue'}
                        <ChevronDown className="w-3 h-3 ml-auto" />
                      </button>
                      {themeOpen && (
                        <div className="mb-1 mt-1 pl-2 space-y-1">
                          {(Object.keys(THEMES_META) as ThemeKey[]).map((name) => (
                            <button
                              key={name}
                              onClick={() => {
                                setTheme(name);
                                setThemeOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                                theme === name
                                  ? 'text-primary-themed bg-white/5'
                                  : 'text-muted-themed hover:text-themed hover:bg-white/5'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ background: THEMES_META[name].primary }}
                              />
                              {THEMES_META[name].label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                        router.push('/');
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-red-400 hover:bg-red-400/10 transition mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    setAuthModalMode('login');
                    setShowAuthModal(true);
                  }}
                  className="text-sm font-medium text-muted-themed hover:text-themed transition px-3 py-1.5"
                >
                  Login
                </button>
                <button
                  onClick={() => router.push('/signup')}
                  className="text-sm font-semibold gradient-primary text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition"
                >
                  Sign Up
                </button>
              </>
            )}

            <button
              className="md:hidden p-2 rounded-lg glass"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <div
            ref={mobileMenuRef}
            className="md:hidden absolute top-full left-0 right-0 border-b border-white/5 p-3 space-y-1 animate-fade-in animate-fade-in"
            style={{ background: 'rgba(10,1,24,0.95)', backdropFilter: 'blur(16px)' }}
          >
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive(link.href)
                      ? 'text-primary-themed bg-white/5'
                      : 'text-muted-themed hover:text-themed hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-400/10 transition"
              >
                Admin
              </Link>
            )}
          </div>
        )}
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authModalMode}
      />
    </>
  );
}

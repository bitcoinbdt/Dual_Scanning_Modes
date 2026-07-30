'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, Palette, ChevronDown, ChevronUp, Gift, UserPlus, Search, DollarSign, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useReferralSession } from '@/hooks/useReferralSession';
import { CreditBadge } from '@/components/credits/CreditBadge';
import AuthModal from '@/components/AuthModal';

interface NavigationProps {
  onOpenCreditStore?: () => void;
}

export default function Navigation({ onOpenCreditStore }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { hasReferralCode } = useReferralSession();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const handleOpenCredits = () => {
    router.push('/credits');
  };

  const truncateEmail = (email: string) => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    const truncatedLocal = localPart.length > 4 ? localPart.slice(0, 4) + '...' : localPart;
    return `${truncatedLocal}@${domain}`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
        setShowThemeDropdown(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { href: '/', label: 'Scanner', icon: Search },
    { href: '/pricing', label: 'Pricing', icon: DollarSign },
    { href: '/referrals', label: 'Referral', icon: Gift },
  ];

  const isActivePath = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  const themes = [
    { id: 'default' as const, name: 'Dark Blue', color: 'bg-blue-500' },
    { id: 'cyber' as const, name: 'Cyber Green', color: 'bg-green-500' },
    { id: 'neon' as const, name: 'Neon Purple', color: 'bg-purple-500' }
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-10 h-10 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <rect x="2" y="2" width="96" height="96" rx="12" fill="none" stroke="#ef4444" strokeWidth="4" />
                <defs>
                  <linearGradient id="rgbGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                    <stop offset="50%" style={{ stopColor: '#a855f7', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#ec4899', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="35" fill="none" stroke="url(#rgbGradient)" strokeWidth="3" />
                <circle cx="50" cy="50" r="25" fill="none" stroke="url(#rgbGradient)" strokeWidth="3" />
                <circle cx="50" cy="50" r="15" fill="none" stroke="url(#rgbGradient)" strokeWidth="3" />
                <circle cx="50" cy="50" r="5" fill="url(#rgbGradient)" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black tracking-tight uppercase italic leading-none bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                OnChain Alpha
              </h1>
              <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold leading-none mt-1">
                Token Scanner
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = isActivePath(link.href);
              
              // Hide Referral link if not authenticated
              if (link.href === '/referrals' && !isAuthenticated) return null;
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Credit Badge - Only show when authenticated */}
            {isAuthenticated && (
              <CreditBadge onClick={handleOpenCredits} />
            )}

            {/* Buy Credits Button - Show when not authenticated */}
            {!isAuthenticated && (
              <button
                onClick={handleOpenCredits}
                className="px-3 py-1.5 text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-all flex items-center gap-1"
              >
                <span className="text-yellow-400">⚡</span>
                Buy Credits
              </button>
            )}

            {isAuthenticated ? (
              <div className="relative ml-1 md:ml-2 pl-1 md:pl-2 border-l border-white/10" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary-500" />
                  <span className="text-xs md:text-sm font-bold text-white hidden md:inline truncate max-w-[120px]" title={user?.name}>
                    {user?.name}
                  </span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 glass-card rounded-lg border border-white/10 shadow-xl overflow-hidden">
                    <div className="p-3 border-b border-white/10">
                      <p className="text-sm font-bold text-white truncate" title={user?.name}>{user?.name}</p>
                      <p className="text-xs text-slate-400" title={user?.email}>{truncateEmail(user?.email || '')}</p>
                    </div>
                    
                    <div className="border-b border-white/10">
                      <button
                        onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          <span>THEME</span>
                        </div>
                        {showThemeDropdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      
                      {showThemeDropdown && (
                        <div className="px-3 pb-3 space-y-1">
                          {themes.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                setTheme(t.id);
                                setShowThemeDropdown(false);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                                theme === t.id ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              <div className={`w-3 h-3 rounded-full ${t.color}`} />
                              <span>{t.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        logout();
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Sign Up Button */}
                <button
                  onClick={() => router.push('/signup')}
                  className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors relative"
                >
                  <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>Sign Up</span>
                  {hasReferralCode && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Referral code detected" />
                  )}
                </button>
                
                {/* Login Button */}
                <button
                  onClick={() => {
                    setAuthModalMode('login');
                    setShowAuthModal(true);
                  }}
                  className="ml-1 md:ml-2 pl-1 md:pl-2 border-l border-white/10 flex items-center gap-1.5 px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>Login</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Slide-out Menu */}
        {showMobileMenu && (
          <div
            ref={mobileMenuRef}
            className="lg:hidden absolute top-full left-0 right-0 bg-slate-900/95 backdrop-blur-md border-b border-white/5 shadow-xl"
          >
            <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isActivePath(link.href);
                
                // Hide Referral link if not authenticated
                if (link.href === '/referrals' && !isAuthenticated) return null;
                
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-bold transition-all ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
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

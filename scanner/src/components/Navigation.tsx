import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Scan,
  CreditCard,
  Gift,
  Bot,
  Zap,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Palette,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, THEMES, ThemeName } from '@/contexts/ThemeContext';

interface NavigationProps {
  onOpenAuth: () => void;
  onOpenCreditStore: () => void;
}

export function Navigation({ onOpenAuth, onOpenCreditStore }: NavigationProps) {
  const { user, profile, signOut, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/', label: 'Scanner', icon: Scan },
    { to: '/pricing', label: 'Pricing', icon: CreditCard },
    ...(user ? [{ to: '/referrals', label: 'Referral', icon: Gift }] : []),
    { to: '/agent', label: 'Agent', icon: Bot },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <header
      className="sticky top-0 z-[100] border-b border-white/5"
      style={{ background: 'rgba(10,1,24,0.8)', backdropFilter: 'blur(16px)' }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center glow-sm group-hover:glow-primary transition">
              <Zap className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="hidden sm:block font-bold text-themed text-lg">
              OnChain<span className="gradient-text">Alpha</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive(link.to)
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
                to="/admin"
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
          {profile && (
            <button
              onClick={() => navigate('/pricing')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass hover:glow-sm transition text-sm"
            >
              <Zap className="w-4 h-4 text-primary-themed" fill="currentColor" />
              <span className="font-bold text-primary-themed">{profile.credits}</span>
              <span className="text-muted-themed text-xs hidden sm:inline">credits</span>
            </button>
          )}

          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg glass hover:glow-sm transition"
              >
                <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
                  {user.email?.[0]?.toUpperCase()}
                </div>
                <ChevronDown className="w-4 h-4 text-muted-themed" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-xl p-3 animate-scale-in">
                  <div className="px-2 py-2 border-b border-white/10 mb-2">
                    <div className="text-sm font-semibold text-themed truncate">
                      {profile?.full_name || 'User'}
                    </div>
                    <div className="text-xs text-muted-themed truncate">{user.email}</div>
                  </div>

                  <div className="relative mb-1" ref={themeRef}>
                    <button
                      onClick={() => setThemeOpen(!themeOpen)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-muted-themed hover:text-themed hover:bg-white/5 transition"
                    >
                      <Palette className="w-4 h-4" />
                      Theme: {THEMES[theme].label}
                      <ChevronDown className="w-3 h-3 ml-auto" />
                    </button>
                    {themeOpen && (
                      <div className="mb-1 space-y-1">
                        {(Object.keys(THEMES) as ThemeName[]).map((name) => (
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
                              style={{ background: THEMES[name].primary }}
                            />
                            {THEMES[name].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                      navigate('/');
                    }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-red-400 hover:bg-red-400/10 transition"
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
                onClick={onOpenAuth}
                className="text-sm font-medium text-muted-themed hover:text-themed transition px-3 py-1.5"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/signup')}
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
        <div className="md:hidden border-t border-white/5 p-3 space-y-1 animate-fade-in">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive(link.to)
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
              to="/admin"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-400/10 transition"
            >
              Admin
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

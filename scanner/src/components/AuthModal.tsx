import { useState, useEffect } from 'react';
import { X, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setError('');
      setPassword('');
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        showToast('Welcome back!', 'success');
        onSuccess?.();
        onClose();
      } else {
        const referralCode = localStorage.getItem('oca-referral') || '';
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              referred_by: referralCode || null,
            },
          },
        });
        if (err) throw err;
        if (data.user) {
          showToast('Account created! 20 free credits added.', 'success');
          localStorage.removeItem('oca-referral');
          onSuccess?.();
          onClose();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md glass-strong rounded-2xl p-6 animate-scale-in rgb-border"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold gradient-text mb-1">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-sm text-muted-themed mb-5">
          {mode === 'login'
            ? 'Sign in to scan tokens and manage credits'
            : 'Join OnChain Crypto Scanner'}
        </p>

        {error && (
          <div
            className="flex items-center gap-2 rounded-lg p-3 mb-4 text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="text-xs text-muted-themed mb-1.5 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-themed" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-themed border border-themed rounded-lg pl-10 pr-3 py-2.5 text-sm text-themed focus:outline-none focus:border-primary-themed transition"
                  placeholder="Your name"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-themed mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-themed" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-themed border border-themed rounded-lg pl-10 pr-3 py-2.5 text-sm text-themed focus:outline-none focus:border-primary-themed transition"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-themed mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-themed" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-themed border border-themed rounded-lg pl-10 pr-3 py-2.5 text-sm text-themed focus:outline-none focus:border-primary-themed transition"
                placeholder="Min 6 characters"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-themed mt-4">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-primary-themed font-semibold hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

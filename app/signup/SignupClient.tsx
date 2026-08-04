'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Gift,
  AlertCircle,
  Loader2,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-muted-themed mb-1.5 block">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-themed pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, loginWithGoogle, isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [referralLocked, setReferralLocked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      toast.error('You are already logged in!');
      router.push('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Populate referral code from URL or localStorage
  useEffect(() => {
    const urlRef = searchParams.get('ref');
    const storedRef = localStorage.getItem('pendingReferralCode');

    if (urlRef) {
      setReferral(urlRef.toUpperCase());
      setReferralLocked(true);
      localStorage.setItem('pendingReferralCode', urlRef.toUpperCase());
      sessionStorage.setItem('hasReferralCode', 'true');
    } else if (storedRef) {
      setReferral(storedRef.toUpperCase());
      setReferralLocked(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!name.trim()) throw new Error('Name is required');

      if (referral && !/^[A-Z0-9]{8}$/.test(referral)) {
        throw new Error('Invalid referral code format. Must be 8 characters (letters and numbers).');
      }

      await signup(email, password, name, referral || undefined);
      localStorage.removeItem('pendingReferralCode');
      toast.success('Account created successfully! Welcome aboard! 🎉');
      router.push('/');
    } catch (err: any) {
      const raw = err?.message;
      const msg =
        typeof raw === 'string' && raw && raw !== '{}'
          ? raw
          : err?.error_description ||
            err?.msg ||
            (typeof err?.toString === 'function' && err.toString() !== '[object Object]'
              ? err.toString()
              : null) ||
            'Signup failed. Please check your details and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      if (referral) {
        localStorage.setItem('pendingReferralCode', referral);
        sessionStorage.setItem('hasReferralCode', 'true');
      }
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-themed hover:text-themed mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h1 className="text-3xl font-bold gradient-text">Create Account</h1>
          <p className="text-sm text-muted-themed mt-1">
            Join OnChain Crypto Scanner and start analyzing tokens
          </p>
        </motion.div>

        {/* Referral Banner */}
        {referralLocked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg p-3 mb-4 flex items-center gap-2 text-sm"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <Gift className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-green-300">Referral code detected! You\'ll earn bonus credits.</span>
          </motion.div>
        )}

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl p-6 rgb-border"
        >
          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-lg p-3 mb-4 text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-red-300">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <Field icon={User} label="Full Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                placeholder="Your full name"
                className="w-full bg-transparent border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-themed placeholder:text-muted-themed focus:outline-none focus:border-primary-themed transition"
              />
            </Field>

            {/* Email */}
            <Field icon={Mail} label="Email Address">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="you@example.com"
                className="w-full bg-transparent border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-themed placeholder:text-muted-themed focus:outline-none focus:border-primary-themed transition"
              />
            </Field>

            {/* Password */}
            <div>
              <Field icon={Lock} label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  placeholder="Min 6 characters"
                  className="w-full bg-transparent border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-themed placeholder:text-muted-themed focus:outline-none focus:border-primary-themed transition"
                />
              </Field>
              <p className="text-[11px] text-muted-themed mt-1 ml-1">Minimum 6 characters</p>
            </div>

            {/* Referral Code */}
            <div>
              <Field icon={Gift} label={`Referral Code${!referralLocked ? ' (Optional)' : ''}`}>
                <input
                  type="text"
                  value={referral}
                  onChange={(e) => !referralLocked && setReferral(e.target.value.toUpperCase().slice(0, 8))}
                  disabled={referralLocked || loading}
                  maxLength={8}
                  placeholder={referralLocked ? 'Code applied from referral link' : 'Enter code'}
                  className={`w-full bg-transparent border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm font-mono uppercase text-themed placeholder:text-muted-themed focus:outline-none focus:border-primary-themed transition ${
                    referralLocked ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
                {referralLocked && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
                )}
              </Field>
              {referralLocked ? (
                <p className="text-[11px] text-green-400 mt-1 ml-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Code applied from referral link
                </p>
              ) : (
                <p className="text-[11px] text-muted-themed mt-1 ml-1">
                  Enter a friend\'s code to earn bonus credits on your first purchase
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-muted-themed">OR</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Google Sign Up */}
          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            type="button"
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold py-2.5 rounded-lg transition border border-white/10"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* Login Link */}
          <p className="text-center text-sm text-muted-themed mt-5">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/')}
              className="text-primary-themed font-semibold hover:underline"
            >
              Login
            </button>
          </p>

          <p className="text-[10px] text-muted-themed text-center mt-4">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function SignupClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-grid flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary-themed animate-spin mx-auto" />
            <p className="text-muted-themed text-sm">Loading signup form...</p>
          </div>
        </div>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Gift, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Navigation from '@/components/layout/Navigation';
import toast from 'react-hot-toast';

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, loginWithGoogle, isAuthenticated } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isReferralLocked, setIsReferralLocked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated (but only on initial mount)
  useEffect(() => {
    // Only check on initial mount, not when auth state changes during signup
    const checkInitialAuth = async () => {
      if (isAuthenticated && !loading) {
        toast.error('You are already logged in!');
        router.push('/');
      }
    };
    
    checkInitialAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Check for referral code from URL or localStorage
  useEffect(() => {
    const urlRefCode = searchParams.get('ref');
    const storedRefCode = localStorage.getItem('pendingReferralCode');
    
    if (urlRefCode) {
      // URL takes priority
      setReferralCode(urlRefCode.toUpperCase());
      setIsReferralLocked(true);
      localStorage.setItem('pendingReferralCode', urlRefCode.toUpperCase());
      sessionStorage.setItem('hasReferralCode', 'true');
    } else if (storedRefCode) {
      // Use stored code if no URL parameter
      setReferralCode(storedRefCode.toUpperCase());
      setIsReferralLocked(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!name.trim()) {
        throw new Error('Name is required');
      }
      
      // Validate referral code format if provided
      if (referralCode && !/^[A-Z0-9]{8}$/.test(referralCode)) {
        throw new Error('Invalid referral code format. Must be 8 characters (letters and numbers).');
      }

      // Call signup with referral code
      await signup(email, password, name, referralCode || undefined);
      
      // Success - redirect to homepage
      toast.success('Account created successfully! Welcome aboard! 🎉');
      router.push('/');
    } catch (err: any) {
      // Supabase errors can be objects — extract a readable message
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
      // Store referral code before OAuth redirect (will be applied after callback)
      if (referralCode) {
        localStorage.setItem('pendingReferralCode', referralCode);
        sessionStorage.setItem('hasReferralCode', 'true');
      }
      
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation onOpenCreditStore={() => {}} />
      
      <main className="max-w-2xl mx-auto px-4 md:px-6 pt-24 pb-24">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-black italic uppercase mb-4">
            Create Account
          </h1>
          <p className="text-slate-400 text-lg">
            Join OnChain Alpha Scanner and start analyzing tokens
          </p>
          {isReferralLocked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg"
            >
              <Gift className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">
                Referral code detected! You'll earn bonus credits.
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Signup Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rgb-border"
        >
          <div className="glass-card rounded-2xl p-6 md:p-8 bg-slate-950/95">
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-500 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  Full Name
                </label>
                <div className="rgb-border">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full bg-slate-900 rounded-lg py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none border-0"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  Email Address
                </label>
                <div className="rgb-border">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full bg-slate-900 rounded-lg py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none border-0"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  Password
                </label>
                <div className="rgb-border">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full bg-slate-900 rounded-lg py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none border-0"
                      required
                      minLength={6}
                      disabled={loading}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Minimum 6 characters
                </p>
              </div>

              {/* Referral Code Field */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  Referral Code {!isReferralLocked && <span className="text-slate-600">(Optional)</span>}
                </label>
                <div className="rgb-border">
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => !isReferralLocked && setReferralCode(e.target.value.toUpperCase())}
                      placeholder={isReferralLocked ? "Code applied from referral link" : "Enter referral code (optional)"}
                      className={`w-full bg-slate-900 rounded-lg py-3 pl-11 pr-11 text-white placeholder-slate-600 focus:outline-none border-0 ${
                        isReferralLocked ? 'cursor-not-allowed opacity-75' : ''
                      }`}
                      readOnly={isReferralLocked}
                      maxLength={8}
                      disabled={loading}
                    />
                    {isReferralLocked && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                    )}
                  </div>
                </div>
                {isReferralLocked ? (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Referral code will be applied after signup
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    Have a referral code? Enter it to earn bonus credits
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-800"></div>
              <span className="px-3 text-sm text-slate-500 font-medium">OR</span>
              <div className="flex-1 border-t border-slate-800"></div>
            </div>

            {/* Google Signup Button */}
            <button
              onClick={handleGoogleSignup}
              disabled={loading}
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 disabled:bg-slate-200 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-lg transition-colors border border-slate-200"
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
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-400">
                Already have an account?{' '}
                <button
                  onClick={() => router.push('/')}
                  className="text-primary-500 hover:text-primary-400 font-bold transition-colors"
                >
                  Login
                </button>
              </p>
            </div>

            {/* Terms */}
            <p className="text-xs text-slate-500 text-center mt-6">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <User className="w-12 h-12 text-primary-500 animate-pulse mx-auto" />
          <p className="text-slate-400">Loading signup form...</p>
        </div>
      </div>
    }>
      <SignupPageContent />
    </Suspense>
  );
}

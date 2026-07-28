'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, AlertCircle, Gift, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isReferralLocked, setIsReferralLocked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, loginWithGoogle } = useAuth();

  // Check for pending referral code when switching to signup mode
  useEffect(() => {
    if (mode === 'signup' && isOpen) {
      const pendingCode = localStorage.getItem('pendingReferralCode');
      if (pendingCode) {
        setReferralCode(pendingCode.toUpperCase());
        setIsReferralLocked(true);
      }
    }
  }, [mode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) {
          throw new Error('Name is required');
        }
        // Validate referral code format if provided
        if (referralCode && !/^[A-Z0-9]{8}$/.test(referralCode)) {
          throw new Error('Invalid referral code format. Must be 8 characters.');
        }
        await signup(email, password, name, referralCode || undefined);
      }
      onClose();
      // Reset form
      setEmail('');
      setPassword('');
      setName('');
      setReferralCode('');
      setIsReferralLocked(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Store referral code before OAuth redirect if in signup mode
      if (mode === 'signup' && referralCode) {
        localStorage.setItem('pendingReferralCode', referralCode);
        sessionStorage.setItem('hasReferralCode', 'true');
      }
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during Google Sign-In');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md"
            >
              <div className="rgb-border">
                <div className="glass-card rounded-2xl p-6 md:p-8 bg-slate-950/95">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black uppercase">
                      {mode === 'login' ? 'Login' : 'Sign Up'}
                    </h2>
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-500 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'signup' && (
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">
                          Name
                        </label>
                        <div className="rgb-border">
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Enter your name"
                              className="w-full bg-slate-900 rounded-lg py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none border-0"
                              required={mode === 'signup'}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">
                        Email
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
                          />
                        </div>
                      </div>
                    </div>

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
                            placeholder="Enter your password"
                            className="w-full bg-slate-900 rounded-lg py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none border-0"
                            required
                            minLength={6}
                          />
                        </div>
                      </div>
                      {mode === 'signup' && (
                        <p className="text-xs text-slate-500 mt-1">
                          Minimum 6 characters
                        </p>
                      )}
                    </div>

                    {/* Referral Code Field - Only in Signup Mode */}
                    {mode === 'signup' && (
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
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
                    >
                      {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="flex items-center my-6">
                    <div className="flex-1 border-t border-slate-800"></div>
                    <span className="px-3 text-sm text-slate-500 font-medium">OR</span>
                    <div className="flex-1 border-t border-slate-800"></div>
                  </div>

                  {/* Google Login Button */}
                  <button
                    onClick={handleGoogleLogin}
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

                  {/* Switch Mode */}
                  <div className="mt-6 text-center">
                    <p className="text-sm text-slate-400">
                      {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                      {' '}
                      <button
                        onClick={switchMode}
                        className="text-primary-500 hover:text-primary-400 font-bold transition-colors"
                      >
                        {mode === 'login' ? 'Sign Up' : 'Login'}
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

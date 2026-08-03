import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Lock,
  Gift,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';

export function Signup() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [referralLocked, setReferralLocked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferral(ref.toUpperCase());
      setReferralLocked(true);
      localStorage.setItem('oca-referral', ref.toUpperCase());
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const referralCode = referral.trim() || localStorage.getItem('oca-referral') || '';
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
        navigate('/');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-themed hover:text-themed mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold gradient-text">Create Account</h1>
          <p className="text-sm text-muted-themed mt-1">
            Join OnChain Alpha Scanner and start analyzing tokens
          </p>
        </div>

        {referralLocked && (
          <div
            className="rounded-lg p-3 mb-4 flex items-center gap-2 text-sm"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <Gift className="w-4 h-4 text-green-400" />
            <span className="text-green-300">Referral code detected! You'll earn bonus credits.</span>
          </div>
        )}

        <div className="glass-strong rounded-2xl p-6 rgb-border">
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
            <Field icon={User} label="Full Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-transparent border border-themed rounded-lg pl-10 pr-3 py-2.5 text-sm text-themed focus:outline-none focus:border-primary-themed transition"
                placeholder="Your full name"
              />
            </Field>

            <Field icon={Mail} label="Email Address">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-transparent border border-themed rounded-lg pl-10 pr-3 py-2.5 text-sm text-themed focus:outline-none focus:border-primary-themed transition"
                placeholder="you@example.com"
              />
            </Field>

            <div>
              <Field icon={Lock} label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-transparent border border-themed rounded-lg pl-10 pr-3 py-2.5 text-sm text-themed focus:outline-none focus:border-primary-themed transition"
                  placeholder="Min 6 characters"
                />
              </Field>
              <p className="text-[11px] text-muted-themed mt-1 ml-1">Minimum 6 characters</p>
            </div>

            <div>
              <Field icon={Gift} label="Referral Code (Optional)">
                <input
                  type="text"
                  value={referral}
                  onChange={(e) => setReferral(e.target.value.toUpperCase().slice(0, 8))}
                  disabled={referralLocked}
                  maxLength={8}
                  className={`w-full bg-transparent border border-themed rounded-lg pl-10 pr-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-primary-themed transition ${
                    referralLocked ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  placeholder={referralLocked ? 'Code applied from referral link' : 'Enter code'}
                />
              </Field>
              {referralLocked ? (
                <p className="text-[11px] text-green-400 mt-1 ml-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Code applied from referral link
                </p>
              ) : (
                <p className="text-[11px] text-muted-themed mt-1 ml-1">
                  Enter a friend's code to earn bonus credits on your first purchase
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-muted-themed">OR</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <p className="text-center text-sm text-muted-themed mt-4">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/')}
              className="text-primary-themed font-semibold hover:underline"
            >
              Login
            </button>
          </p>

          <p className="text-[10px] text-muted-themed text-center mt-4">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

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
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-themed" />
        {children}
      </div>
    </div>
  );
}

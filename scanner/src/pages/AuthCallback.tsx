import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          const referralCode = localStorage.getItem('oca-referral');
          if (referralCode) {
            await supabase
              .from('profiles')
              .update({ referred_by: referralCode })
              .eq('id', data.session.user.id);
            localStorage.removeItem('oca-referral');
          }
          setStatus('success');
          setTimeout(() => navigate('/'), 1500);
        } else {
          setStatus('error');
          setErrorMsg('No session found after authentication.');
          setTimeout(() => navigate('/'), 2000);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Authentication failed';
        setStatus('error');
        setErrorMsg(msg);
        setTimeout(() => navigate('/'), 2000);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-12 h-12 text-primary-themed animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold gradient-text">Processing authentication...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-lg font-bold gradient-text">Success! Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-lg font-bold text-red-400">Authentication failed</p>
            <p className="text-sm text-muted-themed mt-1">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function AuthCallbackClient() {
  const router = useRouter();

  // FIX-5.16: onAuthStateChange listener instead of immediate getSession to prevent OAuth race condition
  useEffect(() => {
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        router.push('/');
      }
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;

      if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
        resolved = true;
        clearTimeout(timeoutId);
        toast.success('Successfully authenticated!');
        router.push('/');
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative w-32 h-32 mx-auto">
          <div className="absolute inset-0 border-4 border-primary-500/20 border-t-primary-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-primary-500 rounded-full animate-pulse" />
          </div>
        </div>
        <h2 className="text-2xl font-black italic uppercase text-primary-500">
          Completing Authentication
        </h2>
        <p className="text-slate-400 text-sm">
          Please wait while we verify your credentials...
        </p>
      </div>
    </div>
  );
}

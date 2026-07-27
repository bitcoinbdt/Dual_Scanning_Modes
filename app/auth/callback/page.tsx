'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the URL
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          toast.error('Authentication failed. Please try again.');
          router.push('/');
          return;
        }

        if (session) {
          toast.success('Successfully authenticated!');
          // Redirect to home page after successful authentication
          router.push('/');
        } else {
          // No session found, redirect to home
          router.push('/');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        toast.error('Authentication error occurred.');
        router.push('/');
      }
    };

    handleAuthCallback();
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
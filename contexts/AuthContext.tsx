'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  sessionLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, referralCode?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  followedCoins: Set<string>;
  followedWhales: Set<string>;
  toggleFollowCoin: (coinId: string) => void;
  toggleFollowWhale: (whaleAddress: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true); // true until initial session check completes
  const [followedCoins, setFollowedCoins] = useState<Set<string>>(new Set());
  const [followedWhales, setFollowedWhales] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Intercept global fetch to inject Authorization header for all local /api/ and /proxy/ requests
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      
      if (url.startsWith('/api/') || url.startsWith('/proxy/')) {
        // Always get the freshest token from the Supabase session (auto-refreshes)
        // Fall back to localStorage only as a secondary option
        let token: string | null = null;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token ?? null;
          // Keep localStorage in sync with latest token
          if (token) {
            localStorage.setItem('authToken', token);
          }
        } catch {
          token = localStorage.getItem('authToken');
        }

        if (token) {
          const headers = new Headers(init?.headers);
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          return originalFetch(input, { ...init, headers });
        }
      }
      return originalFetch(input, init);
    };

    // Get initial session — keep sessionLoading=true until this resolves
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        });
        if (session.access_token) {
          localStorage.setItem('authToken', session.access_token);
        }
      }
      setSessionLoading(false); // session check done — auth state is now reliable
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
          });
          // Store JWT token for API calls
          if (session.access_token) {
            localStorage.setItem('authToken', session.access_token);
          }
        } else {
          setUser(null);
          localStorage.removeItem('authToken');
        }
      }
    );

    // Load following state
    if (typeof window !== 'undefined') {
      const storedFollowedCoins = localStorage.getItem('followedCoins');
      const storedFollowedWhales = localStorage.getItem('followedWhales');
      
      if (storedFollowedCoins) {
        setFollowedCoins(new Set(JSON.parse(storedFollowedCoins)));
      }
      if (storedFollowedWhales) {
        setFollowedWhales(new Set(JSON.parse(storedFollowedWhales)));
      }
    }

    return () => {
      subscription.unsubscribe();
      window.fetch = originalFetch;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signup = async (email: string, password: string, name: string, referralCode?: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          referralCode: referralCode || null,
        },
      },
    });
    if (error) throw error;
    
    // Apply referral code if provided
    if (referralCode && data.user) {
      try {
        // Wait a bit for user profile to be created
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Import and apply referral code
        const { applyReferralCode } = await import('../services/referralApi');
        await applyReferralCode(referralCode);
        
        // Clear pending code from storage
        localStorage.removeItem('pendingReferralCode');
        sessionStorage.removeItem('hasReferralCode');
        
        // Show success toast
        if (typeof window !== 'undefined' && (window as any).toast) {
          (window as any).toast.success('Referral code applied successfully! 🎉');
        }
      } catch (error) {
        console.error('Failed to apply referral code:', error);
        // Show warning but don't fail signup
        if (typeof window !== 'undefined' && (window as any).toast) {
          (window as any).toast.error('Account created, but referral code could not be applied. Please contact support.');
        }
      }
    } else {
      // Clear any pending referral code if no code was provided
      localStorage.removeItem('pendingReferralCode');
      sessionStorage.removeItem('hasReferralCode');
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const loginWithGoogle = async () => {
    // Determine the correct redirect URL based on environment
    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth/callback`
      : 'https://scanner.coinxera.com/auth/callback';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
  };

  const toggleFollowCoin = (coinId: string) => {
    setFollowedCoins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(coinId)) {
        newSet.delete(coinId);
      } else {
        newSet.add(coinId);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('followedCoins', JSON.stringify(Array.from(newSet)));
      }
      return newSet;
    });
  };

  const toggleFollowWhale = (whaleAddress: string) => {
    setFollowedWhales(prev => {
      const newSet = new Set(prev);
      if (newSet.has(whaleAddress)) {
        newSet.delete(whaleAddress);
      } else {
        newSet.add(whaleAddress);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('followedWhales', JSON.stringify(Array.from(newSet)));
      }
      return newSet;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        sessionLoading,
        login,
        signup,
        loginWithGoogle,
        logout,
        followedCoins,
        followedWhales,
        toggleFollowCoin,
        toggleFollowWhale
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

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
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
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
  const [followedCoins, setFollowedCoins] = useState<Set<string>>(new Set());
  const [followedWhales, setFollowedWhales] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
      }
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

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signup = async (email: string, password: string, name: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
      },
    });
    if (error) throw error;
    
    // Check for pending referral code and apply it
    if (typeof window !== 'undefined') {
      const pendingCode = localStorage.getItem('pendingReferralCode');
      if (pendingCode && data.user) {
        // Import the function dynamically to avoid circular dependency
        import('../services/referralApi').then(async ({ applyReferralCode }) => {
          try {
            // Wait a bit for user profile to be created
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Apply referral code
            await applyReferralCode(pendingCode);
            localStorage.removeItem('pendingReferralCode');
            
            // Show success toast
            if (typeof window !== 'undefined' && (window as any).toast) {
              (window as any).toast.success('Referral code applied successfully!');
            }
          } catch (error) {
            console.error('Failed to apply referral code:', error);
          }
        });
      }
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
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

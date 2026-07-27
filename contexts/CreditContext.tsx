'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CreditBalance, CreditPackage } from '@/types/credits';
import { getCreditBalance, getCreditPackages } from '@/services/creditApi';
import { useAuth } from './AuthContext';

interface CreditContextType {
  balance: CreditBalance;
  packages: CreditPackage[];
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  deductCredits: (amount: number) => void;
  addCredits: (amount: number) => void;
  hasEnoughCredits: (amount: number) => boolean;
  getCreditColor: () => string;
  isLowBalance: () => boolean;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [balance, setBalance] = useState<CreditBalance>({
    balance: 0,
    totalPurchased: 0,
    totalSpent: 0,
  });
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch credit balance
  const refreshBalance = useCallback(async () => {
    if (!isAuthenticated) {
      setBalance({
        balance: 0,
        totalPurchased: 0,
        totalSpent: 0,
      });
      return;
    }

    try {
      const data = await getCreditBalance();
      setBalance(data);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  }, [isAuthenticated]);

  // Fetch credit packages
  const fetchPackages = useCallback(async () => {
    try {
      const data = await getCreditPackages();
      setPackages(data);
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    }
  }, []);

  // Initialize data on mount and auth changes
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([refreshBalance(), fetchPackages()]);
      setIsLoading(false);
    };

    init();
  }, [isAuthenticated, refreshBalance, fetchPackages]);

  // Deduct credits (optimistic update - will sync with backend)
  const deductCredits = useCallback((amount: number) => {
    setBalance(prev => ({
      ...prev,
      balance: Math.max(0, prev.balance - amount),
      totalSpent: prev.totalSpent + amount,
    }));
  }, []);

  // Add credits (after purchase confirmation)
  const addCredits = useCallback((amount: number) => {
    setBalance(prev => ({
      ...prev,
      balance: prev.balance + amount,
      totalPurchased: prev.totalPurchased + amount,
    }));
  }, []);

  // Check if user has enough credits
  const hasEnoughCredits = useCallback((amount: number): boolean => {
    return balance.balance >= amount;
  }, [balance.balance]);

  // Get color based on credit balance
  const getCreditColor = useCallback((): string => {
    if (balance.balance >= 100) return 'text-green-400';
    if (balance.balance >= 20) return 'text-yellow-400';
    if (balance.balance >= 10) return 'text-orange-400';
    return 'text-red-400';
  }, [balance.balance]);

  // Check if balance is low
  const isLowBalance = useCallback((): boolean => {
    return balance.balance < 10;
  }, [balance.balance]);

  const value: CreditContextType = {
    balance,
    packages,
    isLoading,
    refreshBalance,
    deductCredits,
    addCredits,
    hasEnoughCredits,
    getCreditColor,
    isLowBalance,
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
}

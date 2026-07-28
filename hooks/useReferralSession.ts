import { useState, useEffect } from 'react';

/**
 * Hook to track referral code throughout user session
 * Manages localStorage and sessionStorage for referral code persistence
 */
export function useReferralSession() {
  const [hasReferralCode, setHasReferralCode] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    // Check for pending referral code on mount
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('pendingReferralCode');
      const hasCode = sessionStorage.getItem('hasReferralCode') === 'true';
      
      if (code && hasCode) {
        setHasReferralCode(true);
        setReferralCode(code);
      }
    }
  }, []);

  const clearReferralCode = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pendingReferralCode');
      sessionStorage.removeItem('hasReferralCode');
      setHasReferralCode(false);
      setReferralCode(null);
    }
  };

  const setReferralCodeSession = (code: string) => {
    if (typeof window !== 'undefined') {
      const upperCode = code.toUpperCase();
      localStorage.setItem('pendingReferralCode', upperCode);
      sessionStorage.setItem('hasReferralCode', 'true');
      setHasReferralCode(true);
      setReferralCode(upperCode);
    }
  };

  return {
    hasReferralCode,
    referralCode,
    clearReferralCode,
    setReferralCodeSession,
  };
}

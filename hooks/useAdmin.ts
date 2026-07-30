'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAIL = 'admin@anamul.com';

/**
 * Hook to check if current user is admin
 */
export function useAdmin() {
  const { user, isAuthenticated } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const adminStatus = user.email === ADMIN_EMAIL;
    setIsAdmin(adminStatus);
    setLoading(false);
  }, [user, isAuthenticated]);

  return { isAdmin, loading };
}

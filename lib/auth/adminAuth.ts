/**
 * Admin Authentication and Authorization
 * Checks if the current user is an admin (admin@anamul.com)
 */

import { supabase } from '@/lib/supabase';

import { headers } from 'next/headers';

const ADMIN_EMAIL = 'admin@anamul.com';

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const adminUser = await getAdminUser();
    return adminUser !== null;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get current admin user or null
 */
export async function getAdminUser() {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    // Try bearer token first (sent by client fetch interceptor)
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        if (user.email !== ADMIN_EMAIL) return null;
        return user;
      }
    }

    // Fallback: use the auto-refreshed internal session
    // This handles cases where the stored token is stale/expired
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return null;
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return null;
    }

    return session.user;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
}

/**
 * Require admin authentication - throws if not admin
 */
export async function requireAdmin() {
  const admin = await getAdminUser();
  
  if (!admin) {
    throw new Error('Unauthorized: Admin access required');
  }
  
  return admin;
}

/**
 * Middleware for API routes - returns JSON error if not admin
 */
export async function adminApiMiddleware() {
  try {
    const admin = await requireAdmin();
    return { isAdmin: true, user: admin };
  } catch (error) {
    return { isAdmin: false, user: null };
  }
}

/**
 * Check if user is admin by email (server-side helper)
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  return email === ADMIN_EMAIL;
}

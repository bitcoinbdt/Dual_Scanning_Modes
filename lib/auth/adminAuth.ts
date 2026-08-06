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

    console.log('[Admin Auth] Authorization header present:', !!authHeader);
    console.log('[Admin Auth] Token extracted:', token ? `${token.substring(0, 15)}...` : 'None');

    // Try bearer token first (sent by client fetch interceptor)
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error) {
        console.error('[Admin Auth] getUser(token) error:', error.message, error.status);
      }
      if (user) {
        console.log('[Admin Auth] getUser(token) success. User email:', user.email);
        if (user.email?.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
          console.warn('[Admin Auth] User email is not admin email:', user.email);
          return null;
        }
        return user;
      }
    }

    // Fallback: use the auto-refreshed internal session
    // This handles cases where the stored token is stale/expired
    console.log('[Admin Auth] Falling back to getSession()...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[Admin Auth] getSession() error:', sessionError.message);
      return null;
    }
    
    if (!session?.user) {
      console.log('[Admin Auth] No session/user found in fallback.');
      return null;
    }

    console.log('[Admin Auth] Fallback session user email:', session.user.email);
    if (session.user.email?.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      console.warn('[Admin Auth] Fallback user email is not admin email:', session.user.email);
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

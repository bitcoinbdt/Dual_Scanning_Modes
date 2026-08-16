/**
 * Supabase client factory for the Historical Reserves Indexing Worker.
 *
 * Separated from the route handler so tests can inject a mock client
 * without polluting the Next.js route with non-HTTP exports.
 *
 * Usage in tests:
 *   import { setSupabaseMock } from './supabaseClientFactory';
 *   setSupabaseMock(mockClient);
 */

import { createClient } from '@supabase/supabase-js';

let supabaseMock: any = null;

export function setSupabaseMock(mock: any) {
  supabaseMock = mock;
}

export function clearSupabaseMock() {
  supabaseMock = null;
}

export function getServiceClient() {
  if (supabaseMock) return supabaseMock;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('[HistoricalReservesWorker] Supabase credentials not configured.');
  return createClient(url, key);
}

/**
 * In-Memory Caching Layer
 * 
 * Provides simple in-memory caching for static and security data.
 * Can be upgraded to Vercel KV (Redis) later for persistent caching.
 * 
 * Cache Strategy:
 * - Static data (name, symbol): Permanent (never expires)
 * - Security data (taxes, mint): 7 days
 * - Market data: Not cached (too dynamic)
 */

import { StaticData, SecurityData, CacheEntry } from './types';

// In-memory cache stores
const staticCache = new Map<string, CacheEntry<StaticData>>();
const securityCache = new Map<string, CacheEntry<SecurityData>>();

// Cache expiry times (in milliseconds)
const STATIC_CACHE_TTL = Infinity; // Never expire
const SECURITY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check if a cache entry is expired
 */
function isExpired(entry: CacheEntry): boolean {
  return entry.expiry < Date.now();
}

/**
 * Clean up expired cache entries periodically
 */
function cleanupExpiredEntries() {
  // Clean security cache
  for (const [key, entry] of securityCache.entries()) {
    if (isExpired(entry)) {
      securityCache.delete(key);
    }
  }
}

// Run cleanup every hour
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 60 * 60 * 1000);
}

// FIX-3.3: Solana base58 addresses are case-sensitive. Lowercase only 42-char hex EVM addresses.
export function normalizeCacheKey(address: string): string {
  if (address.startsWith('0x') && address.length === 42) {
    return address.toLowerCase();
  }
  return address;
}

// ============================================================================
// Static Data Cache (Token Name, Symbol, Decimals)
// ============================================================================

/**
 * Cache static token data permanently
 */
export async function cacheStaticData(address: string, data: StaticData): Promise<void> {
  const key = `static:${normalizeCacheKey(address)}`;
  staticCache.set(key, {
    data,
    expiry: Date.now() + STATIC_CACHE_TTL
  });
}

/**
 * Get cached static token data
 */
export async function getStaticData(address: string): Promise<StaticData | null> {
  const key = `static:${normalizeCacheKey(address)}`;
  const entry = staticCache.get(key);
  
  if (!entry) {
    return null;
  }
  
  if (isExpired(entry)) {
    staticCache.delete(key);
    return null;
  }
  
  return entry.data;
}

// ============================================================================
// Security Data Cache (Taxes, Mint Function, etc.)
// ============================================================================

/**
 * Cache security data for 7 days
 */
export async function cacheSecurityData(address: string, data: SecurityData): Promise<void> {
  const key = `security:${normalizeCacheKey(address)}`;
  securityCache.set(key, {
    data,
    expiry: Date.now() + SECURITY_CACHE_TTL
  });
}

/**
 * Get cached security data
 */
export async function getSecurityData(address: string): Promise<SecurityData | null> {
  const key = `security:${normalizeCacheKey(address)}`;
  const entry = securityCache.get(key);
  
  if (!entry) {
    return null;
  }
  
  if (isExpired(entry)) {
    securityCache.delete(key);
    return null;
  }
  
  return entry.data;
}

// ============================================================================
// Cache Statistics (for debugging)
// ============================================================================

export function getCacheStats() {
  return {
    staticDataEntries: staticCache.size,
    securityDataEntries: securityCache.size,
    totalEntries: staticCache.size + securityCache.size
  };
}

/**
 * Clear all caches (useful for testing)
 */
export function clearAllCaches(): void {
  staticCache.clear();
  securityCache.clear();
}

/**
 * Clear cache for a specific address
 */
export function clearCacheForAddress(address: string): void {
  const normAddress = normalizeCacheKey(address);
  staticCache.delete(`static:${normAddress}`);
  securityCache.delete(`security:${normAddress}`);
}

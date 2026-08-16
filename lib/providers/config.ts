/**
 * Centralized Provider Configuration Layer
 *
 * Exposes availability, timeouts, base URLs, and metadata for external API providers.
 * Secrets are never exposed. All checks are performed dynamically against process.env.
 */

export interface ProviderState {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
}

export interface ProviderConfig {
  goldrush: ProviderState;
  alchemy: ProviderState;
  uniswap: ProviderState;
  bitquery: ProviderState & { authUrl: string };
  goplus: ProviderState;
  moralis: ProviderState;
  helius: ProviderState;
}

export const PROVIDER_CONFIG: ProviderConfig = {
  goldrush: {
    enabled: typeof process !== 'undefined' && !!process.env.GOLDRUSH_API_KEY,
    baseUrl: 'https://api.covalenthq.com/v1',
    timeoutMs: 10_000,
  },
  alchemy: {
    enabled: typeof process !== 'undefined' && !!process.env.ALCHEMY_API_KEY,
    baseUrl: 'https://eth-mainnet.g.alchemy.com/v2',
    timeoutMs: 10_000,
  },
  uniswap: {
    enabled: typeof process !== 'undefined' && !!process.env.UNISWAP_API_KEY,
    baseUrl: 'https://api.uniswap.org/v1',
    timeoutMs: 10_000,
  },
  bitquery: {
    enabled: typeof process !== 'undefined' && !!process.env.BITQUERY_CLIENT_ID && !!process.env.BITQUERY_CLIENT_SECRET,
    baseUrl: 'https://graphql.bitquery.io',
    authUrl: 'https://oauth2.bitquery.io/oauth/token',
    timeoutMs: 12_000,
  },
  goplus: {
    enabled: true, // Always enabled, key is optional (defaults to GoPlus public tier if GOPLUS_API_KEY is missing)
    baseUrl: 'https://api.gopluslabs.io/api/v1',
    timeoutMs: 10_000,
  },
  moralis: {
    enabled: typeof process !== 'undefined' && !!process.env.MORALIS_API_KEY,
    baseUrl: 'https://deep-index.moralis.io/api/v2.2',
    timeoutMs: 10_000,
  },
  helius: {
    enabled: typeof process !== 'undefined' && !!process.env.HELIUS_API_KEY,
    baseUrl: 'https://api.helius.xyz/v0',
    timeoutMs: 10_000,
  },
};

export interface DiagnosticReport {
  provider: string;
  configured: boolean;
  baseUrl: string;
}

/**
 * Generate a safe diagnostic report for configured APIs without exposing secrets.
 */
export function getProviderDiagnostics(): DiagnosticReport[] {
  return [
    { provider: 'goldrush', configured: PROVIDER_CONFIG.goldrush.enabled, baseUrl: PROVIDER_CONFIG.goldrush.baseUrl },
    { provider: 'alchemy', configured: PROVIDER_CONFIG.alchemy.enabled, baseUrl: PROVIDER_CONFIG.alchemy.baseUrl },
    { provider: 'uniswap', configured: PROVIDER_CONFIG.uniswap.enabled, baseUrl: PROVIDER_CONFIG.uniswap.baseUrl },
    { provider: 'bitquery', configured: PROVIDER_CONFIG.bitquery.enabled, baseUrl: PROVIDER_CONFIG.bitquery.baseUrl },
    { provider: 'goplus', configured: !!(typeof process !== 'undefined' && process.env.GOPLUS_API_KEY), baseUrl: PROVIDER_CONFIG.goplus.baseUrl },
    { provider: 'moralis', configured: PROVIDER_CONFIG.moralis.enabled, baseUrl: PROVIDER_CONFIG.moralis.baseUrl },
    { provider: 'helius', configured: PROVIDER_CONFIG.helius.enabled, baseUrl: PROVIDER_CONFIG.helius.baseUrl },
  ];
}

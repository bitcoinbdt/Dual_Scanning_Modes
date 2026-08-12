import axios from 'axios';
import { PROVIDER_CONFIG } from '../config';
import { ProviderError } from '../types';

/**
 * Check if GoPlus API key is configured.
 * Note: GoPlus public tier works without a key, but an API key can be set
 * to raise rate limits in production.
 */
export function isGoplusApiKeyConfigured(): boolean {
  return typeof process !== 'undefined' && !!process.env.GOPLUS_API_KEY;
}

/**
 * Executes a request to GoPlus.
 * Automatically appends the API key if configured.
 */
export async function queryGoplus<T = any>(
  endpoint: string,
  params: Record<string, any> = {}
): Promise<T> {
  const baseUrl = PROVIDER_CONFIG.goplus.baseUrl;
  const timeout = PROVIDER_CONFIG.goplus.timeoutMs;
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // If a key is configured, we pass it according to the GoPlus API spec (via headers or query params)
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  const apiKey = process.env.GOPLUS_API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`; // Or whatever the GoPlus spec expects
  }

  try {
    const response = await axios.get(url, {
      params,
      headers,
      timeout,
    });

    if (response.data?.code !== 1 && response.data?.message) {
      throw new ProviderError(
        `GoPlus API error: ${response.data.message}`,
        'goplus',
        response.status,
        'API_ERROR'
      );
    }

    return response.data;
  } catch (error: any) {
    if (error instanceof ProviderError) {
      throw error;
    }

    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message || 'Unknown GoPlus error';

    // Safety: Never log the Authorization key
    throw new ProviderError(
      `GoPlus request failed: ${msg}`,
      'goplus',
      status,
      error.code || 'REQUEST_FAILURE'
    );
  }
}

/**
 * Basic health check to test connectivity.
 * Fetches security data for a known address or checks GoPlus chains endpoint.
 */
export async function testGoplusHealth(): Promise<boolean> {
  try {
    // Probe check with a dummy or simple call
    const result = await queryGoplus('/token_security/1', { contract_addresses: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' });
    return !!result;
  } catch {
    return false;
  }
}

import axios from 'axios';
import { PROVIDER_CONFIG } from '../config';
import { ProviderError } from '../types';

/**
 * Check if Uniswap is configured.
 */
export function isUniswapConfigured(): boolean {
  return PROVIDER_CONFIG.uniswap.enabled;
}

/**
 * REST or GraphQL request to Uniswap API.
 */
export async function queryUniswap<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  data: any = null
): Promise<T> {
  if (!isUniswapConfigured()) {
    throw new ProviderError(
      'Uniswap is not configured. Missing API key.',
      'uniswap',
      401,
      'UNCONFIGURED'
    );
  }

  const apiKey = process.env.UNISWAP_API_KEY;
  const baseUrl = PROVIDER_CONFIG.uniswap.baseUrl;
  const timeout = PROVIDER_CONFIG.uniswap.timeoutMs;
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await axios({
      url,
      method,
      data,
      headers: {
        'x-api-key': apiKey || '',
      },
      timeout,
    });

    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message || 'Unknown Uniswap error';

    // Safety: Never log the API key
    throw new ProviderError(
      `Uniswap request failed: ${msg}`,
      'uniswap',
      status,
      error.code || 'REQUEST_FAILURE'
    );
  }
}

/**
 * Basic health check to test connectivity.
 */
export async function testUniswapHealth(): Promise<boolean> {
  try {
    // Basic test probe
    const result = await queryUniswap('/health');
    return !!result;
  } catch {
    return false;
  }
}

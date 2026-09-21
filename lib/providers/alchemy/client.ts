import axios from 'axios';
import { PROVIDER_CONFIG } from '../config';
import { ProviderError } from '../types';
import { retryWithBackoff } from '../../blockchain/retryUtils'; // FIX-4.1: Retry wrapper

/**
 * Check if Alchemy is configured.
 */
export function isAlchemyConfigured(): boolean {
  return PROVIDER_CONFIG.alchemy.enabled;
}

/**
 * Sends a JSON-RPC request to the Alchemy endpoint.
 */
// FIX-3.1: Chain-aware queryAlchemyRpc
export async function queryAlchemyRpc<T = any>(
  method: string,
  params: any[] = [],
  chain: string = 'eth'
): Promise<T> {
  if (!isAlchemyConfigured()) {
    throw new ProviderError(
      'Alchemy is not configured. Missing API key.',
      'alchemy',
      401,
      'UNCONFIGURED'
    );
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  const baseUrlMap = PROVIDER_CONFIG.alchemy.baseUrlMap;
  const baseUrl = (baseUrlMap && baseUrlMap[chain.toLowerCase()]) || PROVIDER_CONFIG.alchemy.baseUrl;
  const timeout = PROVIDER_CONFIG.alchemy.timeoutMs;
  const url = `${baseUrl}/${apiKey}`;

  try {
    // FIX-4.1: Wrap axios.post inside retryWithBackoff
    const response = await retryWithBackoff(
      async () =>
        axios.post(
          url,
          {
            jsonrpc: '2.0',
            id: 1,
            method,
            params,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout,
          }
        ),
      {
        maxRetries: 3,
        initialDelay: 500,
        maxDelay: 4000,
        retryableStatusCodes: [408, 425, 429, 500, 502, 503, 504],
        onRetry: (attempt, max, delay, err) => {
          console.log(`[Alchemy] Retry ${attempt}/${max} in ${delay}ms: ${(err as any).message}`);
        },
      }
    );

    if (response.data?.error) {
      throw new ProviderError(
        `Alchemy RPC error: ${response.data.error.message}`,
        'alchemy',
        response.status,
        'RPC_ERROR'
      );
    }

    return response.data?.result;
  } catch (error: any) {
    if (error instanceof ProviderError) {
      throw error;
    }

    const status = error.response?.status;
    const msg = error.response?.data?.error?.message || error.message || 'Unknown RPC error';

    // Safety: Never log the API key or endpoint URL with the key in logs
    throw new ProviderError(
      `Alchemy query failed: ${msg}`,
      'alchemy',
      status,
      error.code || 'RPC_FAILURE'
    );
  }
}

/**
 * Basic health check to test connectivity.
 * Calls eth_blockNumber.
 */
// FIX-3.1: Chain-aware testAlchemyHealth
export async function testAlchemyHealth(chain: string = 'eth'): Promise<boolean> {
  try {
    const result = await queryAlchemyRpc('eth_blockNumber', [], chain);
    return !!result;
  } catch {
    return false;
  }
}

import axios from 'axios';
import { PROVIDER_CONFIG } from '../config';
import { ProviderError } from '../types';

/**
 * Check if Alchemy is configured.
 */
export function isAlchemyConfigured(): boolean {
  return PROVIDER_CONFIG.alchemy.enabled;
}

/**
 * Sends a JSON-RPC request to the Alchemy endpoint.
 */
export async function queryAlchemyRpc<T = any>(
  method: string,
  params: any[] = []
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
  const baseUrl = PROVIDER_CONFIG.alchemy.baseUrl;
  const timeout = PROVIDER_CONFIG.alchemy.timeoutMs;
  const url = `${baseUrl}/${apiKey}`;

  try {
    const response = await axios.post(
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
export async function testAlchemyHealth(): Promise<boolean> {
  try {
    const result = await queryAlchemyRpc('eth_blockNumber');
    return !!result;
  } catch {
    return false;
  }
}

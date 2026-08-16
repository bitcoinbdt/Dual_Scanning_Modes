import axios from 'axios';
import { PROVIDER_CONFIG } from '../config';
import { ProviderError } from '../types';

/**
 * Check if Helius is configured.
 */
export function isHeliusConfigured(): boolean {
  return PROVIDER_CONFIG.helius.enabled;
}

/**
 * Fetch wallet transactions from Helius v0 API.
 * 
 * @param address Solana wallet address
 * @param before Optional signature for pagination cursor
 * @param limit Optional batch size (default 100, max 100)
 */
export async function fetchHeliusWalletTransactions(
  address: string,
  before?: string,
  limit = 100
): Promise<any[]> {
  if (!isHeliusConfigured()) {
    throw new ProviderError(
      'Helius is not configured. Missing API key.',
      'helius',
      401,
      'UNCONFIGURED'
    );
  }

  const apiKey = process.env.HELIUS_API_KEY;
  const baseUrl = PROVIDER_CONFIG.helius.baseUrl;
  const timeout = PROVIDER_CONFIG.helius.timeoutMs;
  const url = `${baseUrl}/addresses/${address}/transactions`;

  const params: Record<string, any> = {
    'api-key': apiKey,
    limit,
  };

  if (before) {
    params.before = before;
  }

  try {
    const response = await axios.get(url, {
      params,
      timeout,
    });

    if (!Array.isArray(response.data)) {
      throw new ProviderError(
        'Malformed response from Helius (expected transaction array).',
        'helius',
        response.status,
        'MALFORMED_RESPONSE'
      );
    }

    return response.data;
  } catch (error: any) {
    if (error instanceof ProviderError) {
      throw error;
    }

    const status = error.response?.status;
    const msg = error.response?.data?.error || error.message || 'Unknown query error';

    throw new ProviderError(
      `Helius request failed: ${msg}`,
      'helius',
      status,
      error.code || 'REQUEST_FAILURE'
    );
  }
}

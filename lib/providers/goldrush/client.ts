import axios from 'axios';
import { PROVIDER_CONFIG } from '../config';
import { ProviderError } from '../types';

/**
 * Check if GoldRush (Covalent) is configured.
 */
export function isGoldrushConfigured(): boolean {
  return PROVIDER_CONFIG.goldrush.enabled;
}

/**
 * Internal REST request wrapper for GoldRush API.
 */
export async function queryGoldrush<T = any>(endpoint: string): Promise<T> {
  if (!isGoldrushConfigured()) {
    throw new ProviderError(
      'GoldRush is not configured. Missing API key.',
      'goldrush',
      401,
      'UNCONFIGURED'
    );
  }

  const apiKey = process.env.GOLDRUSH_API_KEY;
  const baseUrl = PROVIDER_CONFIG.goldrush.baseUrl;
  const timeout = PROVIDER_CONFIG.goldrush.timeoutMs;
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await axios.get(url, {
      auth: {
        username: apiKey || '',
        password: '', // Blank password per Covalent spec
      },
      timeout,
    });

    if (response.data?.error) {
      throw new ProviderError(
        `GoldRush API error: ${response.data.error_message}`,
        'goldrush',
        response.status,
        'API_ERROR'
      );
    }

    return response.data?.data;
  } catch (error: any) {
    if (error instanceof ProviderError) {
      throw error;
    }

    const status = error.response?.status;
    const msg = error.response?.data?.error_message || error.message || 'Unknown query error';

    // Safety: Never log the API key
    throw new ProviderError(
      `GoldRush request failed: ${msg}`,
      'goldrush',
      status,
      error.code || 'REQUEST_FAILURE'
    );
  }
}

/**
 * Basic health check to test connectivity.
 * Fetches supported chains list or a simple endpoint.
 */
export async function testGoldrushHealth(): Promise<boolean> {
  try {
    const data = await queryGoldrush('/chains/');
    return !!(data && Array.isArray(data.items));
  } catch {
    return false;
  }
}

/**
 * Fetch token holders from GoldRush.
 */
export async function fetchGoldrushTokenHolders(
  chain: string,
  tokenAddress: string,
  pageSize = 100
): Promise<any> {
  let covalentChain = chain;
  const cLower = chain.toLowerCase();
  if (cLower === 'eth' || cLower === 'ethereum' || cLower === '1') {
    covalentChain = 'eth-mainnet';
  } else if (cLower === 'bsc' || cLower === '56' || cLower === 'binance') {
    covalentChain = 'bsc-mainnet';
  }
  const endpoint = `/${covalentChain}/tokens/${tokenAddress}/token_holders/?page-size=${pageSize}`;
  return await queryGoldrush(endpoint);
}

/**
 * Fetch wallet transactions from GoldRush transactions_v3.
 * Capped up to 5 pages.
 */
export async function fetchGoldrushWalletTransactions(
  chain: string,
  address: string,
  page = 0,
  pageSize = 100,
  noLogs = true
): Promise<any> {
  let covalentChain = chain;
  const cLower = chain.toLowerCase();
  if (cLower === 'eth' || cLower === 'ethereum' || cLower === '1') {
    covalentChain = 'eth-mainnet';
  } else if (cLower === 'bsc' || cLower === '56' || cLower === 'binance') {
    covalentChain = 'bsc-mainnet';
  }
  const endpoint = `/${covalentChain}/address/${address}/transactions_v3/?no-logs=${noLogs}&page-size=${pageSize}&page-number=${page}`;
  return await queryGoldrush(endpoint);
}



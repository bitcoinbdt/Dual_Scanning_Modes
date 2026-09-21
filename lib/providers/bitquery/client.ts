import axios from 'axios';
import { PROVIDER_CONFIG } from '../config';
import { ProviderError } from '../types';
import { getBitqueryAccessToken } from './auth';
import { retryWithBackoff } from '../../blockchain/retryUtils'; // FIX-4.4: Retry wrapper

/**
 * Check if Bitquery is fully configured.
 */
export function isBitqueryConfigured(): boolean {
  return PROVIDER_CONFIG.bitquery.enabled;
}

/**
 * Executes a GraphQL query against the Bitquery API.
 * Automatically injects the OAuth token and handles expiry.
 */
export async function queryBitquery<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  if (!isBitqueryConfigured()) {
    throw new ProviderError(
      'Bitquery is not configured. Missing client credentials.',
      'bitquery',
      401,
      'UNCONFIGURED'
    );
  }

  const token = await getBitqueryAccessToken();
  const url = PROVIDER_CONFIG.bitquery.baseUrl;
  const timeout = PROVIDER_CONFIG.bitquery.timeoutMs;

  try {
    // FIX-4.4: Wrap axios.post inside retryWithBackoff
    const response = await retryWithBackoff(
      async () =>
        axios.post(
          url,
          { query, variables },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            timeout,
          }
        ),
      {
        maxRetries: 3,
        initialDelay: 600,
        maxDelay: 5000,
        onRetry: (attempt, max, delay, err) => {
          console.log(`[Bitquery] Retry ${attempt}/${max} in ${delay}ms: ${(err as any).message}`);
        },
      }
    );

    // GraphQL-level errors check
    if (response.data?.errors && response.data.errors.length > 0) {
      const errMessage = response.data.errors.map((e: any) => e.message).join('; ');
      throw new ProviderError(
        `Bitquery GraphQL error: ${errMessage}`,
        'bitquery',
        200,
        'GRAPHQL_ERROR'
      );
    }

    return response.data?.data;
  } catch (error: any) {
    if (error instanceof ProviderError) {
      throw error;
    }

    const status = error.response?.status;
    const msg = error.response?.data?.error || error.message || 'Unknown query error';

    // Safety: Never log the Authorization header or token
    throw new ProviderError(
      `Bitquery query failed: ${msg}`,
      'bitquery',
      status,
      error.code || 'QUERY_FAILURE'
    );
  }
}

/**
 * Basic health check query to test connectivity.
 */
export async function testBitqueryHealth(): Promise<boolean> {
  const testQuery = `
    query {
      ethereum {
        blocks(limit: 1) {
          height
        }
      }
    }
  `;
  try {
    const data = await queryBitquery(testQuery);
    return !!(data?.ethereum?.blocks?.length > 0);
  } catch {
    return false;
  }
}

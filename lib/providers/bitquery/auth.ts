import axios from 'axios';
import { PROVIDER_CONFIG } from '../config';
import { ProviderError, BitqueryTokenState } from '../types';

let cachedTokenState: BitqueryTokenState | null = null;
let activeTokenPromise: Promise<string> | null = null;

/**
 * Reset token cache for testing purposes.
 */
export function resetBitqueryAuthCache(): void {
  cachedTokenState = null;
  activeTokenPromise = null;
}

/**
 * Fetch OAuth access token from Bitquery client credentials flow.
 */
async function fetchNewToken(): Promise<string> {
  const clientId = process.env.BITQUERY_CLIENT_ID;
  const clientSecret = process.env.BITQUERY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new ProviderError(
      'Missing BITQUERY_CLIENT_ID or BITQUERY_CLIENT_SECRET in environment.',
      'bitquery',
      401,
      'MISSING_CREDENTIALS'
    );
  }

  const url = PROVIDER_CONFIG.bitquery.authUrl;
  const timeout = PROVIDER_CONFIG.bitquery.timeoutMs;

  try {
    const response = await axios.post(
      url,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout,
      }
    );

    const data = response.data;
    if (!data || !data.access_token) {
      throw new ProviderError(
        'Authentication response missing access_token.',
        'bitquery',
        response.status,
        'MALFORMED_AUTH_RESPONSE'
      );
    }

    const expiresIn = data.expires_in || 3600; // default 1 hour
    cachedTokenState = {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return data.access_token;
  } catch (error: any) {
    // Safety check: Never log client_secret or access_token
    const status = error.response?.status;
    const msg = error.response?.data?.error_description || error.message || 'Unknown authentication error';
    
    throw new ProviderError(
      `Bitquery authentication failed: ${msg}`,
      'bitquery',
      status,
      error.code || 'AUTH_FAILURE'
    );
  }
}

/**
 * Get a valid Bitquery access token. Reuses cached token if valid.
 * Automatically handles token expiration and concurrent requests.
 */
export async function getBitqueryAccessToken(): Promise<string> {
  // If we have a cached token and it's still valid (with a 60s buffer)
  const bufferMs = 60_000;
  if (cachedTokenState && cachedTokenState.expiresAt - Date.now() > bufferMs) {
    return cachedTokenState.accessToken;
  }

  // If there is already an active request fetching a token, reuse the promise
  if (activeTokenPromise) {
    return activeTokenPromise;
  }

  // Otherwise, start a new token fetch request
  activeTokenPromise = fetchNewToken()
    .then((token) => {
      activeTokenPromise = null; // Clear lock on success
      return token;
    })
    .catch((err) => {
      activeTokenPromise = null; // Clear lock on error
      throw err;
    });

  return activeTokenPromise;
}

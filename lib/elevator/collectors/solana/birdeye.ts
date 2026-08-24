/**
 * Birdeye API Client - Fetches OHLCV (candlestick) data for Solana
 * Ported from data_collector/services/birdeye.js
 */

import axios from 'axios';
import { OHLCVCandle } from '../types';

/** Birdeye API base URL — override via BIRDEYE_API_URL env var */
const BIRDEYE_API_URL = process.env.BIRDEYE_API_URL || 'https://public-api.birdeye.so';

/**
 * Normalize OHLCV data from Birdeye API response
 */
function normalizeOHLCV(item: any): OHLCVCandle {
  return {
    timestamp: item.unixTime || item.timestamp,
    open: item.o || item.open,
    close: item.c || item.close,
    volume: item.v || item.volume
  };
}

/**
 * Fetch OHLCV (candlestick) data from Birdeye API
 * @param address - Solana token address
 * @param apiKey - Birdeye API key
 * @returns Array of OHLCV candles (15-minute intervals, last 24 hours)
 */
export async function fetchOHLCV(
  address: string,
  apiKey: string
): Promise<OHLCVCandle[]> {
  const url = `${BIRDEYE_API_URL}/defi/ohlcv`;
  
  const response = await axios.get(url, {
    headers: {
      'X-API-KEY': apiKey,
      'x-chain': 'solana'
    },
    params: {
      address: address,
      type: '15m',
      time_from: Math.floor(Date.now() / 1000) - 86400, // 24 hours ago
      time_to: Math.floor(Date.now() / 1000)
    }
  });
  
  if (!response.data?.data?.items) {
    throw new Error('Invalid OHLCV response from Birdeye');
  }
  
  const items = response.data.data.items;
  
  if (items.length === 0) {
    throw new Error('No OHLCV data returned from Birdeye');
  }
  
  return items.map(normalizeOHLCV);
}

/**
 * Fetch token transaction history from Birdeye using sequential throttled pagination.
 * Replaces the previous 10-parallel-requests strategy that immediately triggered 429 rate limits.
 *
 * Strategy:
 *   - Fetch one page at a time with a 250ms inter-request gap
 *   - On 429: exponential backoff (1s, 2s, 4s) up to MAX_RETRIES times
 *   - On persistent 429: stop early and return what was collected so far (partial = all available)
 *   - On 400 for offset 0: token not indexed in Birdeye trades API — return [] to trigger fallback
 */
export async function fetchBirdeyeTransactions(
  address: string,
  apiKey: string,
  maxTransactions: number = 10000
): Promise<any[]> {
  const url = `${BIRDEYE_API_URL}/defi/txs/token`;
  const PAGE_LIMIT = 100;           // max items per request
  const INTER_REQUEST_DELAY = 250;  // ms between requests
  const MAX_RETRIES = 3;            // retries per page on 429

  const allTx: any[] = [];
  let offset = 0;

  while (allTx.length < maxTransactions) {
    let attempt = 0;
    let pageData: any[] = [];
    let success = false;

    while (attempt <= MAX_RETRIES) {
      try {
        const res = await axios.get(url, {
          headers: {
            'X-API-KEY': apiKey,
            'x-chain': 'solana'
          },
          params: {
            address,
            offset,
            limit: PAGE_LIMIT
          },
          timeout: 10000
        });

        pageData = res.data?.data?.items ?? [];
        success = true;
        break;
      } catch (err: any) {
        const status = err.response?.status;

        if (status === 400 && offset === 0) {
          // Token not indexed in Birdeye Token Trades API — signal caller to use fallback
          console.warn(`[Birdeye] Token ${address} not indexed in trades API (HTTP 400 on first page). Falling back.`);
          return [];
        }

        if (status === 429) {
          attempt++;
          const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.warn(`[Birdeye] 429 rate limit at offset ${offset}. Backoff ${backoffMs}ms (attempt ${attempt}/${MAX_RETRIES}).`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          console.warn(`[Birdeye] Failed to fetch offset ${offset}: ${err.message}`);
          break; // Non-retryable error — stop pagination
        }
      }
    }

    if (!success) {
      // Could not fetch this page after retries — return partial result
      console.warn(`[Birdeye] Stopping pagination after persistent failure at offset ${offset}. Collected ${allTx.length} transactions so far.`);
      break;
    }

    if (pageData.length === 0) {
      // End of available history
      break;
    }

    allTx.push(...pageData);

    if (pageData.length < PAGE_LIMIT) {
      // Received fewer items than requested — we've reached the end
      break;
    }

    offset += PAGE_LIMIT;
    await new Promise(resolve => setTimeout(resolve, INTER_REQUEST_DELAY));
  }

  return allTx.slice(0, maxTransactions);
}

/**
 * Fetch token creation information from Birdeye
 * @param address - Token address
 * @param apiKey - Birdeye API key
 * @param chain - Target blockchain (default: 'solana')
 */
export async function fetchTokenCreationInfo(
  address: string,
  apiKey: string,
  chain: string = 'solana'
): Promise<{ deployer: string | null; txHash: string | null; timestamp: number | null } | null> {
  const url = `${BIRDEYE_API_URL}/defi/token_creation_info`;
  try {
    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': chain
      },
      params: { address }
    });
    const data = response.data?.data;
    if (data) {
      return {
        deployer: data.deployer || null,
        txHash: data.tx_hash || null,
        timestamp: data.timestamp ? Number(data.timestamp) : null
      };
    }
  } catch (err: any) {
    console.warn(`[Birdeye] Token creation info lookup failed for ${address} on ${chain}:`, err.message);
  }
  return null;
}



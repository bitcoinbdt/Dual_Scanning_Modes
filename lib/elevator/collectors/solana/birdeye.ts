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
 * Fetch token transaction history from Birdeye
 */
export async function fetchBirdeyeTransactions(
  address: string,
  apiKey: string,
  maxTransactions: number = 10000
): Promise<any[]> {
  const url = `${BIRDEYE_API_URL}/defi/txs/token`;
  const BATCH_SIZE = 10;   // parallel requests per batch
  const PAGE_LIMIT = 100;  // max limit allowed by Birdeye
  const totalPages = Math.ceil(maxTransactions / PAGE_LIMIT);

  const allTx: any[] = [];
  
  // We fetch page batches in parallel to respect rate limits while maintaining high performance
  for (let batch = 0; batch < totalPages / BATCH_SIZE; batch++) {
    const pagePromises = Array.from({ length: BATCH_SIZE }, (_, i) => {
      const offset = (batch * BATCH_SIZE + i) * PAGE_LIMIT;
      if (offset >= maxTransactions) return Promise.resolve([]);
      
      return axios.get(url, {
        headers: {
          'X-API-KEY': apiKey,
          'x-chain': 'solana'
        },
        params: {
          address: address,
          offset: offset,
          limit: PAGE_LIMIT
        }
      }).then(res => res.data?.data?.items || [])
        .catch(err => {
          console.warn(`[Birdeye Ingestion] Failed to fetch offset ${offset}:`, err.message);
          return [];
        });
    });

    const results = await Promise.allSettled(pagePromises);
    let emptyPageCount = 0;
    
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        if (r.value.length === 0) emptyPageCount++;
        allTx.push(...r.value);
      }
    });

    // If all pages in the current batch returned empty results, we have hit the end of history
    if (emptyPageCount === BATCH_SIZE) {
      break;
    }
  }

  return allTx.slice(0, maxTransactions);
}


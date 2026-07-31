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

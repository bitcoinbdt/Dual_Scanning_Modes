import axios from 'axios';
import { normalizeOHLCV } from '../utils/normalize.js';

export async function fetchOHLCV(address, apiKey) {
  const url = 'https://public-api.birdeye.so/defi/ohlcv';
  
  const response = await axios.get(url, {
    headers: {
      'X-API-KEY': apiKey,
      'x-chain': 'solana'
    },
    params: {
      address: address,
      type: '15m',
      time_from: Math.floor(Date.now() / 1000) - 86400,
      time_to: Math.floor(Date.now() / 1000)
    }
  });
  
  if (!response.data || !response.data.data || !response.data.data.items) {
    throw new Error('Invalid OHLCV response from Birdeye');
  }
  
  const items = response.data.data.items;
  
  if (items.length === 0) {
    throw new Error('No OHLCV data returned');
  }
  
  return items.map(normalizeOHLCV);
}

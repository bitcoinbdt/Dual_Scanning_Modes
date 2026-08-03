// =====================================================
// COINGECKO API SERVICE
// =====================================================
// Fetches live token prices from CoinGecko API
// Supports Ethereum, BSC, and Solana blockchains
// =====================================================

import type { Blockchain } from '@/types/boost';

interface TokenPrice {
  priceUsd: number | null;
  priceChange24h: number | null;
  lastUpdated: Date;
}

// Map blockchain names to CoinGecko platform IDs
const PLATFORM_MAP: Record<Blockchain, string> = {
  ethereum: 'ethereum',
  bsc: 'binance-smart-chain',
  solana: 'solana',
};

/**
 * Fetch token price from CoinGecko by contract address
 */
export async function fetchTokenPrice(
  contractAddress: string,
  blockchain: Blockchain
): Promise<TokenPrice> {
  const platform = PLATFORM_MAP[blockchain];
  const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}`;

  try {
    const response = await fetch(
      `${url}?contract_addresses=${contractAddress}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Cache for 60 seconds to avoid rate limiting
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      console.error('CoinGecko API error:', response.status, response.statusText);
      return { priceUsd: null, priceChange24h: null, lastUpdated: new Date() };
    }

    const data = await response.json();
    const tokenData = data[contractAddress.toLowerCase()];

    if (!tokenData) {
      console.warn('Token not found on CoinGecko:', contractAddress);
      return { priceUsd: null, priceChange24h: null, lastUpdated: new Date() };
    }

    return {
      priceUsd: tokenData.usd || null,
      priceChange24h: tokenData.usd_24h_change || null,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error('Error fetching token price:', error);
    return { priceUsd: null, priceChange24h: null, lastUpdated: new Date() };
  }
}

/**
 * Fetch prices for multiple tokens (batch)
 */
export async function fetchMultipleTokenPrices(
  tokens: Array<{ contractAddress: string; blockchain: Blockchain }>
): Promise<Map<string, TokenPrice>> {
  const priceMap = new Map<string, TokenPrice>();

  // Group by blockchain to make efficient batch requests
  const byBlockchain = tokens.reduce((acc, token) => {
    if (!acc[token.blockchain]) {
      acc[token.blockchain] = [];
    }
    acc[token.blockchain].push(token.contractAddress);
    return acc;
  }, {} as Record<Blockchain, string[]>);

  // Fetch prices for each blockchain
  await Promise.all(
    Object.entries(byBlockchain).map(async ([blockchain, addresses]) => {
      const platform = PLATFORM_MAP[blockchain as Blockchain];
      const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}`;

      try {
        const response = await fetch(
          `${url}?contract_addresses=${addresses.join(',')}&vs_currencies=usd&include_24hr_change=true`,
          {
            headers: {
              'Accept': 'application/json',
            },
            next: { revalidate: 60 },
          }
        );

        if (!response.ok) {
          console.error('CoinGecko API error:', response.status);
          return;
        }

        const data = await response.json();

        // Map results back to contract addresses
        addresses.forEach((address) => {
          const tokenData = data[address.toLowerCase()];
          priceMap.set(address, {
            priceUsd: tokenData?.usd || null,
            priceChange24h: tokenData?.usd_24h_change || null,
            lastUpdated: new Date(),
          });
        });
      } catch (error) {
        console.error('Error fetching prices for', blockchain, error);
      }
    })
  );

  return priceMap;
}

/**
 * Search for token by symbol or name (to help find CoinGecko ID)
 */
export async function searchToken(query: string): Promise<Array<{
  id: string;
  symbol: string;
  name: string;
}>> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('CoinGecko search error:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.coins || []).slice(0, 5).map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
    }));
  } catch (error) {
    console.error('Error searching token:', error);
    return [];
  }
}

/**
 * Rate limiting helper - ensures we don't exceed CoinGecko limits
 * Free tier: 10-50 calls per minute
 */
let lastCallTime = 0;
const MIN_CALL_INTERVAL = 1200; // 1.2 seconds between calls

export async function rateLimitedFetch<T>(
  fetchFn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;

  if (timeSinceLastCall < MIN_CALL_INTERVAL) {
    const waitTime = MIN_CALL_INTERVAL - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastCallTime = Date.now();
  return fetchFn();
}

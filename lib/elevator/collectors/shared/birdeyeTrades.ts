/**
 * Birdeye Trades API Client (Fallback)
 * Used when GeckoTerminal fails or returns no data.
 * Fetches token swap/trade history from Birdeye's /defi/txs/token endpoint.
 *
 * Free tier: limited to recent trades, no pagination.
 * Works for all chains supported by Birdeye (Solana, BSC, Ethereum).
 */

import { UniversalTransaction } from '../types';

const BIRDEYE_API_URL = process.env.BIRDEYE_API_URL || 'https://public-api.birdeye.so';

// Birdeye chain slugs
const CHAIN_SLUG: Record<'bsc' | 'eth', string> = {
  bsc: 'bsc',
  eth: 'ethereum',
};

/**
 * Fetch token trade transactions from Birdeye's /defi/txs/token endpoint.
 * Each record is already classified as buy/sell with exact USD price.
 *
 * @param chain - 'bsc' or 'eth'
 * @param tokenAddress - Token contract address
 * @param apiKey - Birdeye API key
 * @param maxTransactions - Max number of trades to fetch
 * @param tokenSymbol - Token symbol (for labelling)
 * @returns Array of UniversalTransactions or null on failure
 */
export async function fetchBirdeyeTrades(
  chain: 'bsc' | 'eth',
  tokenAddress: string,
  apiKey: string,
  maxTransactions: number,
  tokenSymbol: string = 'TOKEN'
): Promise<UniversalTransaction[] | null> {
  const chainSlug = CHAIN_SLUG[chain];
  const url = `${BIRDEYE_API_URL}/defi/txs/token`;

  console.log(`[BirdeyeTrades] Fetching trades for ${tokenAddress} on ${chain} (fallback)...`);

  try {
    // Initial key validation check
    const response = await fetch(url, {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': chainSlug
      }
    });

    if (!response.ok && response.status !== 400) { // 400 is fine as it's missing params, but if it is 401/403/etc we fail early
      console.warn(`[BirdeyeTrades] API check returned HTTP ${response.status}`);
      return null;
    }

    let allItems: any[] = [];
    let offset = 0;
    const limit = 100; // query 100 at a time

    while (allItems.length < maxTransactions) {
      const currentLimit = Math.min(limit, maxTransactions - allItems.length);
      const params = new URLSearchParams({
        address: tokenAddress,
        tx_type: 'swap',
        offset: String(offset),
        limit: String(currentLimit)
      });

      const res = await fetch(`${url}?${params.toString()}`, {
        headers: {
          'X-API-KEY': apiKey,
          'x-chain': chainSlug
        }
      });

      if (!res.ok) {
        console.warn(`[BirdeyeTrades] Trade fetch HTTP ${res.status}`);
        break;
      }

      const json = await res.json();
      const items: any[] = json?.data?.items ?? [];

      if (items.length === 0) {
        break;
      }

      allItems.push(...items);
      offset += items.length;

      if (items.length < currentLimit) {
        break; // no more data
      }

      // Add a small delay between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (allItems.length === 0) {
      console.warn(`[BirdeyeTrades] No trades returned`);
      return null;
    }

    console.log(`[BirdeyeTrades] Fetched ${allItems.length} trades`);

    return allItems.map((item: any): UniversalTransaction => {
      const isBuy = item.side === 'buy';
      const wallet = item.owner?.toLowerCase() ?? '';

      return {
        hash: item.txHash ?? item.tx_hash ?? '',
        timestamp: item.blockUnixTime ?? item.timestamp ?? 0,
        from: isBuy ? 'pool' : wallet,
        to: isBuy ? wallet : 'pool',
        amount: parseFloat(item.volumeBase ?? item.amount ?? '0') || 0,
        type: isBuy ? 'buy' : 'sell',
        priceUsd: parseFloat(item.priceUsd ?? item.price ?? '0') || 0,
        wallet,
        token: {
          address: tokenAddress.toLowerCase(),
          symbol: tokenSymbol
        },
        blockchain: chain,
        raw: item
      } as UniversalTransaction & { priceUsd: number; wallet: string };
    });
  } catch (err: any) {
    console.error('[BirdeyeTrades] Error:', err.message);
    return null;
  }
}

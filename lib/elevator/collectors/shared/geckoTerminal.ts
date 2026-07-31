/**
 * GeckoTerminal API Client
 * Primary source for DEX swap/trade data on BSC and Ethereum.
 * Free tier, no API key required.
 *
 * Endpoints used:
 *   - GET /networks/{network}/tokens/{address}/pools  → find the top liquidity pool
 *   - GET /networks/{network}/pools/{pool}/trades     → get swap events
 */

import { UniversalTransaction } from '../types';

const GECKO_API = 'https://api.geckoterminal.com/api/v2';

// GeckoTerminal network slugs
const NETWORK_SLUG: Record<'bsc' | 'eth', string> = {
  bsc: 'bsc',
  eth: 'eth',
};

// Delay between requests to respect rate limits (~30 req/min free tier)
const DELAY_MS = 1200;
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface GeckoPool {
  id: string;         // e.g. "bsc_0xabc..."
  attributes: {
    address: string;
    name: string;
    volume_usd: { h24: string };
    reserve_in_usd: string;
  };
}

interface GeckoTrade {
  id: string;
  attributes: {
    block_timestamp: string;   // ISO 8601
    tx_hash: string;
    tx_from_address: string;
    from_token_amount: string;
    to_token_amount: string;
    price_from_in_usd: string;
    price_to_in_usd: string;
    kind: 'buy' | 'sell';
  };
}

/**
 * Fetch the top pool address (by liquidity) for a token on GeckoTerminal.
 */
async function fetchTopPool(
  network: 'bsc' | 'eth',
  tokenAddress: string
): Promise<string | null> {
  const slug = NETWORK_SLUG[network];
  const url = `${GECKO_API}/networks/${slug}/tokens/${tokenAddress.toLowerCase()}/pools`;

  try {
    const res = await fetch(`${url}?page=1`, {
      headers: { 'Accept': 'application/json;version=20230302' }
    });

    if (!res.ok) {
      console.warn(`[GeckoTerminal] Pool lookup failed: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const pools: GeckoPool[] = json?.data ?? [];

    if (pools.length === 0) {
      console.warn(`[GeckoTerminal] No pools found for ${tokenAddress} on ${network}`);
      return null;
    }

    // Sort by 24h volume DESC and pick the top pool
    pools.sort((a, b) =>
      parseFloat(b.attributes.volume_usd?.h24 ?? '0') -
      parseFloat(a.attributes.volume_usd?.h24 ?? '0')
    );

    const topPool = pools[0].attributes.address;
    console.log(`[GeckoTerminal] Top pool for ${tokenAddress}: ${topPool}`);
    return topPool;
  } catch (err: any) {
    console.error('[GeckoTerminal] fetchTopPool error:', err.message);
    return null;
  }
}

/**
 * Fetch swap trades for a pool from GeckoTerminal.
 * Returns up to `limit` trades (GeckoTerminal caps at 300 per request).
 */
async function fetchPoolTrades(
  network: 'bsc' | 'eth',
  poolAddress: string,
  limit: number
): Promise<GeckoTrade[]> {
  const slug = NETWORK_SLUG[network];
  const url = `${GECKO_API}/networks/${slug}/pools/${poolAddress.toLowerCase()}/trades`;

  const trades: GeckoTrade[] = [];
  let page = 1;

  while (trades.length < limit) {
    try {
      const res = await fetch(`${url}?page=${page}&trade_volume_in_usd_greater_than=0`, {
        headers: { 'Accept': 'application/json;version=20230302' }
      });

      if (!res.ok) {
        console.warn(`[GeckoTerminal] Trades fetch failed: HTTP ${res.status}`);
        break;
      }

      const json = await res.json();
      const batch: GeckoTrade[] = json?.data ?? [];

      if (batch.length === 0) break;

      trades.push(...batch);

      if (batch.length < 100) break; // Last page

      page++;
      await sleep(DELAY_MS);
    } catch (err: any) {
      console.error('[GeckoTerminal] fetchPoolTrades error:', err.message);
      break;
    }
  }

  return trades.slice(0, limit);
}

/**
 * Convert GeckoTerminal trades to UniversalTransaction format.
 * Each swap event has an exact price in USD, wallet address, and kind (buy/sell).
 */
function convertToUniversal(
  trades: GeckoTrade[],
  tokenAddress: string,
  tokenSymbol: string,
  blockchain: 'bsc' | 'eth'
): UniversalTransaction[] {
  return trades.map(trade => {
    const attr = trade.attributes;
    const timestamp = Math.floor(new Date(attr.block_timestamp).getTime() / 1000);
    const kind = attr.kind; // 'buy' or 'sell' — directly from swap event
    const wallet = attr.tx_from_address?.toLowerCase() ?? '';

    // For a buy: wallet receives token (to = wallet), from = pool
    // For a sell: wallet sends token (from = wallet), to = pool
    const from = kind === 'sell' ? wallet : 'pool';
    const to   = kind === 'buy'  ? wallet : 'pool';

    // Amount of the target token that changed hands
    const amount = parseFloat(
      kind === 'buy' ? attr.to_token_amount : attr.from_token_amount
    ) || 0;

    // Exact price per token in USD at swap time
    const priceUsd = parseFloat(
      kind === 'buy' ? attr.price_to_in_usd : attr.price_from_in_usd
    ) || 0;

    return {
      hash: attr.tx_hash,
      timestamp,
      from,
      to,
      amount,
      type: kind,
      priceUsd,           // ← exact swap price
      wallet,             // ← initiating wallet
      token: {
        address: tokenAddress.toLowerCase(),
        symbol: tokenSymbol
      },
      blockchain,
      raw: attr
    } as UniversalTransaction & { priceUsd: number; wallet: string };
  });
}

/**
 * Main entry point: fetch swap trades for a token via GeckoTerminal.
 * Returns null if the token/pool cannot be found or if the API fails.
 */
export async function fetchGeckoTerminalTrades(
  network: 'bsc' | 'eth',
  tokenAddress: string,
  maxTransactions: number,
  tokenSymbol: string = 'TOKEN'
): Promise<UniversalTransaction[] | null> {
  console.log(`[GeckoTerminal] Starting trade fetch for ${tokenAddress} on ${network}`);

  // Step 1: Identify the primary pool
  const poolAddress = await fetchTopPool(network, tokenAddress);
  if (!poolAddress) return null;

  await sleep(DELAY_MS);

  // Step 2: Fetch swap events from the pool
  const trades = await fetchPoolTrades(network, poolAddress, maxTransactions);
  console.log(`[GeckoTerminal] Fetched ${trades.length} trades`);

  if (trades.length === 0) return null;

  // Step 3: Convert to universal format
  return convertToUniversal(trades, tokenAddress, tokenSymbol, network);
}

/**
 * GeckoTerminal API Client
 * Primary source for DEX swap/trade data on BSC, Ethereum, and Solana.
 * Free tier, no API key required.
 *
 * Endpoints used:
 *   - GET /networks/{network}/tokens/{address}/pools  → find token liquidity pools
 *   - GET /networks/{network}/pools/{pool}/trades     → get swap events
 */

import { UniversalTransaction } from '../types';

const GECKO_API = 'https://api.geckoterminal.com/api/v2';

// GeckoTerminal network slugs
const NETWORK_SLUG: Record<'bsc' | 'eth' | 'solana', string> = {
  bsc: 'bsc',
  eth: 'eth',
  solana: 'solana',
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
 * Fetch top pools (by 24h volume) for a token on GeckoTerminal.
 */
async function fetchTokenPools(
  network: 'bsc' | 'eth' | 'solana',
  tokenAddress: string
): Promise<string[]> {
  const slug = NETWORK_SLUG[network];
  const url = `${GECKO_API}/networks/${slug}/tokens/${tokenAddress.toLowerCase()}/pools`;

  try {
    const res = await fetch(`${url}?page=1`, {
      headers: { 'Accept': 'application/json;version=20230302' }
    });

    if (!res.ok) {
      console.warn(`[GeckoTerminal] Pools lookup failed for ${tokenAddress} on ${network}: HTTP ${res.status}`);
      return [];
    }

    const json = await res.json();
    const pools: GeckoPool[] = json?.data ?? [];

    if (pools.length === 0) {
      console.warn(`[GeckoTerminal] No pools found for ${tokenAddress} on ${network}`);
      return [];
    }

    // Sort by 24h volume DESC
    pools.sort((a, b) =>
      parseFloat(b.attributes.volume_usd?.h24 ?? '0') -
      parseFloat(a.attributes.volume_usd?.h24 ?? '0')
    );

    // Limit to top 5 pools to avoid excessive API requests
    const selectedPools = pools.slice(0, 5).map(p => p.attributes.address);
    console.log(`[GeckoTerminal] Found ${pools.length} pools. Selected top ${selectedPools.length} for scanning.`);
    return selectedPools;
  } catch (err: any) {
    console.error('[GeckoTerminal] fetchTokenPools error:', err.message);
    return [];
  }
}

/**
 * Fetch swap trades for a pool from GeckoTerminal.
 * Returns up to `limit` trades (GeckoTerminal caps at 300 per request).
 */
async function fetchPoolTrades(
  network: 'bsc' | 'eth' | 'solana',
  poolAddress: string,
  limit: number
): Promise<GeckoTrade[]> {
  const slug = NETWORK_SLUG[network];
  const url = `${GECKO_API}/networks/${slug}/pools/${poolAddress.toLowerCase()}/trades`;

  const trades: GeckoTrade[] = [];
  let lastTimestamp: number | null = null;

  while (trades.length < limit) {
    try {
      let requestUrl = `${url}?trade_volume_in_usd_greater_than=0`;
      if (lastTimestamp !== null) {
        requestUrl += `&before_timestamp=${lastTimestamp}`;
      }

      const res = await fetch(requestUrl, {
        headers: { 'Accept': 'application/json;version=20230302' }
      });

      if (!res.ok) {
        console.warn(`[GeckoTerminal] Trades fetch failed for pool ${poolAddress}: HTTP ${res.status}`);
        break;
      }

      const json = await res.json();
      const batch: GeckoTrade[] = json?.data ?? [];

      if (batch.length === 0) break;

      // Filter out duplicate IDs
      const existingIds = new Set(trades.map((t) => t.id));
      const newItems = batch.filter((t) => !existingIds.has(t.id));

      if (newItems.length === 0) {
        break;
      }

      trades.push(...newItems);

      if (batch.length < 100) break; // Last page

      // Get the oldest trade's timestamp in Unix seconds for paginating backwards
      const oldestTrade = batch[batch.length - 1];
      const oldestTimeStr = oldestTrade?.attributes?.block_timestamp;
      if (!oldestTimeStr) break;

      const oldestTimeSec = Math.floor(new Date(oldestTimeStr).getTime() / 1000);

      // Prevent infinite loop if timestamp does not decrease
      if (lastTimestamp !== null && oldestTimeSec >= lastTimestamp) {
        break;
      }

      lastTimestamp = oldestTimeSec;
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
  blockchain: 'bsc' | 'eth' | 'solana'
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

    // Exact price per token in USD at swap time (Feature 5)
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
      raw: attr,
      isTrade: true       // ← Flagged as trade
    } as UniversalTransaction;
  });
}

/**
 * Main entry point: fetch swap trades for a token across multiple liquidity pools.
 * Returns null if the token/pools cannot be found or if the API fails.
 */
export async function fetchGeckoTerminalTrades(
  network: 'bsc' | 'eth' | 'solana',
  tokenAddress: string,
  maxTransactions: number,
  tokenSymbol: string = 'TOKEN'
): Promise<UniversalTransaction[] | null> {
  console.log(`[GeckoTerminal] Starting multi-pool trade fetch for ${tokenAddress} on ${network}`);

  // Step 1: Identify all liquidity pools
  const poolAddresses = await fetchTokenPools(network, tokenAddress);
  if (poolAddresses.length === 0) return null;

  const allTrades: GeckoTrade[] = [];
  const processedHashes = new Set<string>();

  // Step 2: Fetch trades from each pool and merge them (Feature 6)
  for (const poolAddress of poolAddresses) {
    await sleep(DELAY_MS);
    console.log(`[GeckoTerminal] Fetching trades for pool: ${poolAddress}`);
    const poolTrades = await fetchPoolTrades(network, poolAddress, maxTransactions);
    
    for (const trade of poolTrades) {
      if (!processedHashes.has(trade.attributes.tx_hash)) {
        processedHashes.add(trade.attributes.tx_hash);
        allTrades.push(trade);
      }
    }
  }

  if (allTrades.length === 0) {
    console.warn(`[GeckoTerminal] No trades found across all ${poolAddresses.length} pools`);
    return null;
  }

  // Sort merged list chronologically descending
  allTrades.sort(
    (a, b) =>
      new Date(b.attributes.block_timestamp).getTime() -
      new Date(a.attributes.block_timestamp).getTime()
  );

  const truncatedTrades = allTrades.slice(0, maxTransactions);
  console.log(`[GeckoTerminal] Merged & returned ${truncatedTrades.length} unique trades from ${poolAddresses.length} pools`);

  // Step 3: Convert to universal format
  return convertToUniversal(truncatedTrades, tokenAddress, tokenSymbol, network);
}

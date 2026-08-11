/**
 * Market Data Fallback Chain
 * 
 * Implements a 3-provider fallback chain for market data:
 * DexScreener → GeckoTerminal → DefiLlama
 * 
 * This ensures market data availability even when the primary provider fails.
 * Each provider is tried with retry logic before falling back to the next.
 */

import axios from 'axios';
import { retryWithBackoff } from './retryUtils';
import { LiquidityInfo, DexScreenerResponse, DexScreenerPair } from './types';

/**
 * Fetch market data with fallback chain
 * Tries providers in order: DexScreener → GeckoTerminal → DefiLlama
 */
export async function fetchMarketDataWithFallback(
  address: string,
  chainId: string = '1'
): Promise<LiquidityInfo> {
  // Try DexScreener first (current primary provider)
  try {
    console.log('[MARKET] 🔍 Trying DexScreener...');
    const data = await fetchDexScreener(address);
    console.log('[MARKET] ✅ DexScreener succeeded');
    return data;
  } catch (error: any) {
    console.warn('[MARKET] ⚠️  DexScreener failed:', error.message);
  }
  
  // Try GeckoTerminal second
  try {
    console.log('[MARKET] 🔍 Trying GeckoTerminal...');
    const data = await fetchGeckoTerminal(address, chainId);
    console.log('[MARKET] ✅ GeckoTerminal succeeded');
    return data;
  } catch (error: any) {
    console.warn('[MARKET] ⚠️  GeckoTerminal failed:', error.message);
  }
  
  // Try DefiLlama third
  try {
    console.log('[MARKET] 🔍 Trying DefiLlama...');
    const data = await fetchDefiLlama(address, chainId);
    console.log('[MARKET] ✅ DefiLlama succeeded');
    return data;
  } catch (error: any) {
    console.warn('[MARKET] ⚠️  DefiLlama failed:', error.message);
  }
  
  // All providers failed, return empty market data
  console.warn('[MARKET] ❌ All providers failed, using empty market data');
  return {
    totalLiquidityUsd: 0,
    mainPools: [],
    source: 'fallback'
  };
}

/**
 * Fetch market data from DexScreener
 */
async function fetchDexScreener(address: string): Promise<LiquidityInfo> {
  return await retryWithBackoff(async () => {
    const res = await axios.get<DexScreenerResponse>(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { timeout: 8000 }
    );
    
    if (res.data.pairs && res.data.pairs.length > 0) {
      const sortedPairs = res.data.pairs.sort((a: DexScreenerPair, b: DexScreenerPair) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      );
      
      const totalLiquidity = sortedPairs.reduce((acc, pair) => 
        acc + (pair.liquidity?.usd || 0), 0
      );
      
      const mainPools = sortedPairs.slice(0, 5).map(pair => ({
        pair: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
        dex: pair.dexId || 'Unknown',
        liquidityUsd: pair.liquidity?.usd || 0,
        priceUsd: parseFloat(pair.priceUsd || "0")
      }));
      
      const mainPair = sortedPairs[0];
      const exactMatch = mainPair && mainPair.baseToken.address.toLowerCase() === address.toLowerCase();

      return {
        totalLiquidityUsd: totalLiquidity,
        mainPools,
        tokenNameOverride: exactMatch ? mainPair.baseToken.name : null,
        symbolOverride: exactMatch ? mainPair.baseToken.symbol : null,
        fdv: mainPair.fdv || mainPair.marketCap || null,
        basePriceUsd: parseFloat(mainPair.priceUsd || "0"),
        volume24hUsd: mainPair.volume?.h24 || null,
        source: 'dexscreener'
      };
    }
    
    throw new Error('No pairs found');
  }, {
    onRetry: (attempt, max, delay, error) => {
      console.log(`[DEXSCREENER] 🔄 Retry ${attempt}/${max} in ${delay}ms: ${error.message}`);
    }
  });
}

/**
 * Fetch market data from GeckoTerminal
 */
async function fetchGeckoTerminal(address: string, chainId: string = '1'): Promise<LiquidityInfo> {
  return await retryWithBackoff(async () => {
    // Map chain IDs to GeckoTerminal network names
    const networkMap: Record<string, string> = {
      '1': 'eth',
      '56': 'bsc',
      '137': 'polygon',
      '43114': 'avax',
      '250': 'ftm',
      '42161': 'arbitrum',
      '10': 'optimism'
    };
    
    const network = networkMap[chainId] || 'eth';
    
    const res = await axios.get(
      `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}/pools`,
      { 
        timeout: 8000,
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (res.data.data && res.data.data.length > 0) {
      const pools = res.data.data;
      const totalLiquidity = pools.reduce((acc: number, pool: any) => 
        acc + parseFloat(pool.attributes.reserve_in_usd || 0), 0
      );
      
      const mainPools = pools.slice(0, 5).map((pool: any) => ({
        pair: pool.attributes.name || 'Unknown',
        dex: pool.attributes.dex_id || 'Unknown',
        liquidityUsd: parseFloat(pool.attributes.reserve_in_usd || 0),
        priceUsd: parseFloat(pool.attributes.token_price_usd || 0)
      }));
      
      const mainPool = pools[0];
      const volume24hUsd = mainPool?.attributes?.volume_usd?.h24 
        ? parseFloat(mainPool.attributes.volume_usd.h24) 
        : null;
      
      return {
        totalLiquidityUsd: totalLiquidity,
        mainPools,
        volume24hUsd,
        source: 'geckoterminal'
      };
    }
    
    throw new Error('No pools found');
  }, {
    onRetry: (attempt, max, delay, error) => {
      console.log(`[GECKOTERMINAL] 🔄 Retry ${attempt}/${max} in ${delay}ms: ${error.message}`);
    }
  });
}

/**
 * Fetch market data from DefiLlama
 */
async function fetchDefiLlama(address: string, chainId: string = '1'): Promise<LiquidityInfo> {
  return await retryWithBackoff(async () => {
    // Map chain IDs to DefiLlama chain names
    const chainMap: Record<string, string> = {
      '1': 'ethereum',
      '56': 'bsc',
      '137': 'polygon',
      '43114': 'avax',
      '250': 'fantom',
      '42161': 'arbitrum',
      '10': 'optimism'
    };
    
    const chain = chainMap[chainId] || 'ethereum';
    
    const res = await axios.get(
      `https://coins.llama.fi/prices/current/${chain}:${address}`,
      { 
        timeout: 8000,
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (res.data.coins) {
      const coinKey = `${chain}:${address}`;
      const coinData = res.data.coins[coinKey];
      
      if (coinData) {
        // DefiLlama doesn't provide liquidity data, only price
        return {
          totalLiquidityUsd: 0,
          mainPools: [{
            pair: coinData.symbol || 'Unknown',
            dex: 'DefiLlama',
            liquidityUsd: 0,
            priceUsd: coinData.price || 0
          }],
          volume24hUsd: null,
          source: 'defillama'
        };
      }
    }
    
    throw new Error('No price data found');
  }, {
    onRetry: (attempt, max, delay, error) => {
      console.log(`[DEFILLAMA] 🔄 Retry ${attempt}/${max} in ${delay}ms: ${error.message}`);
    }
  });
}

export { fetchDexScreener, fetchGeckoTerminal, fetchDefiLlama };

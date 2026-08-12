import { queryAlchemyRpc, isAlchemyConfigured } from './client';

/**
 * Fetch raw getReserves() hex from a Uniswap V2 pool contract.
 * Selector: 0x0902f1ac
 */
export async function fetchV2PoolReserves(poolAddress: string): Promise<string | null> {
  if (!isAlchemyConfigured()) return null;
  try {
    const result = await queryAlchemyRpc<string>('eth_call', [
      {
        to: poolAddress,
        data: '0x0902f1ac', // getReserves()
      },
      'latest',
    ]);
    return result;
  } catch (err) {
    console.warn(`[Alchemy V2 Reserves] Failed to fetch reserves for ${poolAddress}:`, err);
    return null;
  }
}

/**
 * Fetch token0 address hex from a Uniswap V2 pool contract.
 * Selector: 0x0dfe1681
 */
export async function fetchV2PoolToken0(poolAddress: string): Promise<string | null> {
  if (!isAlchemyConfigured()) return null;
  try {
    const result = await queryAlchemyRpc<string>('eth_call', [
      {
        to: poolAddress,
        data: '0x0dfe1681', // token0()
      },
      'latest',
    ]);
    return result;
  } catch (err) {
    console.warn(`[Alchemy V2 Reserves] Failed to fetch token0 for ${poolAddress}:`, err);
    return null;
  }
}

import { NormalizedPoolState, LiquidityPool, toNormalizedPoolState } from '../blockchain/types';
import { isAlchemyConfigured, queryAlchemyRpc } from '../providers/alchemy/client';
import { adaptAlchemyV2Reserves } from '../providers/alchemy/adapter';
import { adaptUniswapV3PoolState } from '../providers/uniswap/adapter';
import { fetchV2PoolReserves, fetchV2PoolToken0 } from '../providers/alchemy/poolReserves';
import { AbiCoder } from 'ethers';

const abiCoder = AbiCoder.defaultAbiCoder();

/**
 * Checks if a string is a valid EVM address format.
 */
function isValidEvmAddress(address: string | undefined): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Enrich pools with observed V2 reserves via Alchemy RPC.
 * Only enriches constant-product pools with valid EVM contract addresses.
 */
export async function enrichPoolsWithAlchemyReserves(
  pools: (NormalizedPoolState | LiquidityPool)[],
  tokenAddress: string,
  tokenDecimals: number,
  spotPriceUsd: number,
  network: string
): Promise<NormalizedPoolState[]> {
  const networkLower = network.toLowerCase();
  const isEvm = networkLower === 'eth' || networkLower === 'ethereum' || networkLower === 'bsc' || networkLower === '56';

  const enrichedPools = pools.map(p =>
    'poolType' in p ? { ...p } : toNormalizedPoolState(p, { chain: network })
  );

  if (!isEvm || !isAlchemyConfigured()) {
    return enrichedPools;
  }

  for (const pool of enrichedPools) {
    if (pool.poolType !== 'constant-product') continue;

    const poolAddress = pool.poolIdentifier;
    if (pool.poolIdentifierType !== 'address' || !isValidEvmAddress(poolAddress)) {
      continue;
    }

    try {
      // Fetch token0 and reserves in parallel to reduce per-pool latency
      const [token0Hex, reservesHex] = await Promise.all([
        fetchV2PoolToken0(poolAddress),
        fetchV2PoolReserves(poolAddress),
      ]);

      if (token0Hex && reservesHex) {
        const token0Decoded = abiCoder.decode(['address'], token0Hex)[0] as string;
        const reserves = adaptAlchemyV2Reserves(reservesHex, {
          poolAddress,
          snapshotAt: Math.floor(Date.now() / 1000)
        });

        if (reserves.status === 'available' && reserves.tokenReserve !== undefined && reserves.quoteReserve !== undefined) {
          const t0 = token0Decoded.toLowerCase();
          const scanToken = tokenAddress.toLowerCase();

          // Identify which reserve slot belongs to the scanned token and normalise by its decimals.
          // Both branches apply tokenDecimals (the scanned token's precision) because we are
          // extracting the scanned token's count regardless of which slot (0 or 1) it occupies.
          const rawSlot = t0 === scanToken ? reserves.tokenReserve : reserves.quoteReserve;
          const tokenReserveRawVal = Number(rawSlot) / Math.pow(10, tokenDecimals);

          // Guard: only set observed fields when values are positive and spot price is known.
          // A zero tokenReserveRaw or spotPriceUsd = 0 would produce a meaningless quoteReserveRaw
          // and cause the simulator's 'observed' path to receive a zero reserve.
          if (tokenReserveRawVal > 0 && spotPriceUsd > 0) {
            pool.tokenReserveRaw = tokenReserveRawVal;

            // quoteReserveRaw is stored in USD (consistent with the simulator's derived convention:
            // quote_reserve = L/2, which is also USD).  We approximate it as
            // tokenReserveRaw × spotPriceUsd, which equals the token side's USD value.
            // This is accurate for balanced pools.  Provenance is 'derived' because we are
            // computing it from the observed token count + market spot price, NOT reading the
            // raw on-chain quote reserve (which would require the quote token's decimals).
            pool.quoteReserveRaw = tokenReserveRawVal * spotPriceUsd;
            pool.tokenReserveProvenance = 'observed';
            pool.quoteReserveProvenance = 'derived';
            pool.snapshotAt = reserves.snapshotAt;
            console.log(`[Alchemy V2 Reserves] Successfully enriched V2 pool ${poolAddress}: tokenReserveRaw=${pool.tokenReserveRaw}, quoteReserveRaw=${pool.quoteReserveRaw}`);
          }
        }
      }
    } catch (err) {
      console.warn(`[Alchemy V2 Reserves] Failed to enrich reserves for pool ${poolAddress}:`, err);
    }
  }

  return enrichedPools;
}

/**
 * Enrich pools with Uniswap V3 slot0 metadata via Alchemy RPC.
 * Only runs for concentrated-liquidity pools with valid EVM contract addresses.
 */
export async function enrichClmmPoolsWithSlot0(
  pools: NormalizedPoolState[],
  network: string
): Promise<NormalizedPoolState[]> {
  const networkLower = network.toLowerCase();
  const isEvm = networkLower === 'eth' || networkLower === 'ethereum' || networkLower === 'bsc' || networkLower === '56';

  if (!isEvm || !isAlchemyConfigured()) {
    return pools;
  }

  for (const pool of pools) {
    if (pool.poolType !== 'concentrated-liquidity') continue;

    const poolAddress = pool.poolIdentifier;
    if (pool.poolIdentifierType !== 'address' || !isValidEvmAddress(poolAddress)) {
      continue;
    }

    try {
      // Fetch slot0, liquidity, token0, token1, fee, tickSpacing in parallel
      const [slot0Hex, liquidityHex, token0Hex, token1Hex, feeHex, tickSpacingHex] = await Promise.all([
        queryAlchemyRpc<string>('eth_call', [{ to: poolAddress, data: '0x3850c7bd' }, 'latest']).catch(() => null),
        queryAlchemyRpc<string>('eth_call', [{ to: poolAddress, data: '0x1a6865d5' }, 'latest']).catch(() => null),
        queryAlchemyRpc<string>('eth_call', [{ to: poolAddress, data: '0x0dfe1681' }, 'latest']).catch(() => null),
        queryAlchemyRpc<string>('eth_call', [{ to: poolAddress, data: '0xd21220a7' }, 'latest']).catch(() => null),
        queryAlchemyRpc<string>('eth_call', [{ to: poolAddress, data: '0xddca3f43' }, 'latest']).catch(() => null),
        queryAlchemyRpc<string>('eth_call', [{ to: poolAddress, data: '0xd0c93a7c' }, 'latest']).catch(() => null),
      ]);

      if (slot0Hex && liquidityHex) {
        const decodedSlot0 = abiCoder.decode(['uint160', 'int24', 'uint16', 'uint16', 'uint16', 'uint8', 'bool'], slot0Hex);
        const decodedLiquidity = abiCoder.decode(['uint128'], liquidityHex)[0] as bigint;

        const t0 = token0Hex ? (abiCoder.decode(['address'], token0Hex)[0] as string) : undefined;
        const t1 = token1Hex ? (abiCoder.decode(['address'], token1Hex)[0] as string) : undefined;
        const f = feeHex ? (abiCoder.decode(['uint24'], feeHex)[0] as bigint) : undefined;
        const ts = tickSpacingHex ? (abiCoder.decode(['int24'], tickSpacingHex)[0] as bigint) : undefined;

        const rawV3 = {
          sqrtPriceX96: decodedSlot0[0] as bigint,
          tick: Number(decodedSlot0[1]),
          liquidity: decodedLiquidity,
          fee: f !== undefined ? Number(f) : undefined,
          tickSpacing: ts !== undefined ? Number(ts) : undefined,
          token0: t0,
          token1: t1,
        };

        const profile = adaptUniswapV3PoolState(rawV3, {
          poolAddress,
          snapshotAt: Math.floor(Date.now() / 1000)
        });

        if (profile.status === 'available') {
          pool.clmmProfile = profile;
          console.log(`[Alchemy V3 slot0] Successfully enriched V3 pool ${poolAddress} with clmmProfile`);
        }
      }
    } catch (err) {
      console.warn(`[Alchemy V3 slot0] Failed to enrich V3 pool ${poolAddress}:`, err);
    }
  }

  return pools;
}

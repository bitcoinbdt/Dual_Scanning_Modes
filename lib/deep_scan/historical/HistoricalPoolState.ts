import { ethers } from 'ethers';
import { getContractStateAtBlock, getBlockMetadata } from '../../providers/alchemy/historicalRpc';
import { HistoricalPoolStateResult } from '../types';
import { ProviderError } from '../../providers/types';

/**
 * Uniswap V2-compatible getReserves() signature selector: 0x0902f1ac
 */
const GET_RESERVES_CALLDATA = '0x0902f1ac';

/**
 * Queries reserves of a Uniswap V2 pool at a specific block tag.
 * Preserves full uint256/uint112 precision.
 */
export async function getHistoricalV2Reserves(
  chain: string,
  poolAddress: string,
  blockNumber: number,
  poolType = 'v2'
): Promise<HistoricalPoolStateResult> {
  const fetchedAt = new Date().toISOString();

  // Validate pool address
  if (!/^0x[a-fA-F0-9]{40}$/i.test(poolAddress)) {
    return {
      status: 'error',
      freshness: 'UNAVAILABLE',
      chain,
      poolAddress,
      blockNumber,
      blockHash: null,
      timestamp: null,
      reserve0: null,
      reserve1: null,
      provider: 'alchemy',
      fetchedAt,
      errorCode: 'INVALID_INPUT',
    };
  }

  // Check supported pool type
  const normalizedPoolType = poolType.toLowerCase().trim();
  if (normalizedPoolType !== 'v2' && normalizedPoolType !== 'uniswap_v2' && normalizedPoolType !== 'pancakeswap_v2') {
    return {
      status: 'unavailable',
      freshness: 'UNAVAILABLE',
      chain,
      poolAddress,
      blockNumber,
      blockHash: null,
      timestamp: null,
      reserve0: null,
      reserve1: null,
      provider: 'alchemy',
      fetchedAt,
      errorCode: 'UNSUPPORTED_POOL_TYPE',
    };
  }

  try {
    // 1. Fetch Contract State (Reserves)
    const rawReserves = await getContractStateAtBlock(chain, poolAddress, GET_RESERVES_CALLDATA, blockNumber);
    if (!rawReserves || rawReserves === '0x') {
      return {
        status: 'error',
        freshness: 'UNAVAILABLE',
        chain,
        poolAddress,
        blockNumber,
        blockHash: null,
        timestamp: null,
        reserve0: null,
        reserve1: null,
        provider: 'alchemy',
        fetchedAt,
        errorCode: 'MALFORMED_RESPONSE',
      };
    }

    // Decode uint112, uint112, uint32
    let reserve0: string;
    let reserve1: string;
    try {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint112', 'uint112', 'uint32'], rawReserves);
      reserve0 = decoded[0].toString();
      reserve1 = decoded[1].toString();
    } catch {
      return {
        status: 'error',
        freshness: 'UNAVAILABLE',
        chain,
        poolAddress,
        blockNumber,
        blockHash: null,
        timestamp: null,
        reserve0: null,
        reserve1: null,
        provider: 'alchemy',
        fetchedAt,
        errorCode: 'MALFORMED_RESPONSE',
      };
    }

    // 2. Fetch Block Metadata for provenance (non-blocking, fallback to nulls instead of fail)
    let blockHash: string | null = null;
    let timestamp: string | null = null;
    try {
      const metadata = await getBlockMetadata(chain, blockNumber);
      blockHash = metadata.blockHash;
      timestamp = metadata.timestamp;
    } catch (metaErr: any) {
      console.warn(`[HistoricalPoolState] Failed to fetch block metadata for ${blockNumber}:`, metaErr.message);
    }

    return {
      status: 'available',
      freshness: 'LIVE',
      chain,
      poolAddress,
      blockNumber,
      blockHash,
      timestamp,
      reserve0,
      reserve1,
      provider: 'alchemy',
      fetchedAt,
    };
  } catch (err: any) {
    let errorCode = 'RPC_ERROR';
    let status: 'unavailable' | 'error' = 'error';

    if (err instanceof ProviderError) {
      errorCode = err.code || 'RPC_ERROR';
      if (errorCode === 'ARCHIVE_UNAVAILABLE' || errorCode === 'UNSUPPORTED_CHAIN' || errorCode === 'INVALID_INPUT') {
        status = 'unavailable';
      }
    }

    return {
      status,
      freshness: 'UNAVAILABLE',
      chain,
      poolAddress,
      blockNumber,
      blockHash: null,
      timestamp: null,
      reserve0: null,
      reserve1: null,
      provider: 'alchemy',
      fetchedAt,
      errorCode,
    };
  }
}

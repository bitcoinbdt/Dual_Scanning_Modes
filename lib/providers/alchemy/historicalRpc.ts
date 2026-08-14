import axios from 'axios';
import { PROVIDER_CONFIG } from '../config';
import { ProviderError } from '../types';

const ALCHEMY_DOMAINS: Record<string, string> = {
  '1': 'eth-mainnet.g.alchemy.com/v2',
  'eth': 'eth-mainnet.g.alchemy.com/v2',
  'ethereum': 'eth-mainnet.g.alchemy.com/v2',
  '56': 'bnb-mainnet.g.alchemy.com/v2',
  'bsc': 'bnb-mainnet.g.alchemy.com/v2',
  'binance': 'bnb-mainnet.g.alchemy.com/v2',
  '137': 'polygon-mainnet.g.alchemy.com/v2',
  'polygon': 'polygon-mainnet.g.alchemy.com/v2',
  '42161': 'arb-mainnet.g.alchemy.com/v2',
  'arbitrum': 'arb-mainnet.g.alchemy.com/v2',
  '8453': 'base-mainnet.g.alchemy.com/v2',
  'base': 'base-mainnet.g.alchemy.com/v2',
  '10': 'opt-mainnet.g.alchemy.com/v2',
  'optimism': 'opt-mainnet.g.alchemy.com/v2',
};

/**
 * Sends a historical JSON-RPC request to the Alchemy endpoint.
 */
export async function queryAlchemyHistoricalRpc<T = any>(
  chain: string,
  method: string,
  params: any[] = []
): Promise<T> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new ProviderError(
      'Alchemy API key is not configured.',
      'alchemy',
      401,
      'UNCONFIGURED'
    );
  }

  const normalizedChain = chain.toLowerCase().trim();
  const domain = ALCHEMY_DOMAINS[normalizedChain];
  if (!domain) {
    throw new ProviderError(
      `Unsupported chain for Alchemy RPC: ${chain}`,
      'alchemy',
      400,
      'UNSUPPORTED_CHAIN'
    );
  }

  const timeout = PROVIDER_CONFIG.alchemy.timeoutMs || 10000;
  const url = `https://${domain}/${apiKey}`;

  try {
    const response = await axios.post(
      url,
      {
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout,
      }
    );

    const data = response.data;
    if (data?.error) {
      const errMsg = String(data.error.message).toLowerCase();
      let code = 'RPC_ERROR';
      if (
        errMsg.includes('trie') ||
        errMsg.includes('archive') ||
        errMsg.includes('state not found') ||
        errMsg.includes('pruned') ||
        errMsg.includes('not authorized')
      ) {
        code = 'ARCHIVE_UNAVAILABLE';
      }
      throw new ProviderError(
        `Alchemy historical RPC error: ${data.error.message}`,
        'alchemy',
        response.status,
        code
      );
    }

    return data?.result;
  } catch (error: any) {
    if (error instanceof ProviderError) {
      throw error;
    }
    const status = error.response?.status;
    const msg = error.response?.data?.error?.message || error.message || 'Unknown RPC error';
    
    // Safety: Never leak API keys or parameters in logs
    throw new ProviderError(
      `Alchemy query failed: ${msg}`,
      'alchemy',
      status,
      error.code === 'ECONNABORTED' ? 'RPC_TIMEOUT' : 'RPC_FAILURE'
    );
  }
}

/**
 * Query EVM contract state at a specific historical block number.
 */
export async function getContractStateAtBlock(
  chain: string,
  contractAddress: string,
  calldata: string,
  blockNumber: number
): Promise<string> {
  // Address validation
  if (!/^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
    throw new ProviderError('Invalid EVM contract address.', 'alchemy', 400, 'INVALID_INPUT');
  }
  // Block number validation
  if (!Number.isInteger(blockNumber) || blockNumber < 0) {
    throw new ProviderError('Invalid block number.', 'alchemy', 400, 'INVALID_INPUT');
  }

  const hexBlock = '0x' + blockNumber.toString(16);
  const params = [
    {
      to: contractAddress,
      data: calldata,
    },
    hexBlock,
  ];

  return await queryAlchemyHistoricalRpc<string>(chain, 'eth_call', params);
}

/**
 * Retrieve metadata for a specific block number to enforce provenance.
 */
export async function getBlockMetadata(
  chain: string,
  blockNumber: number
): Promise<{ blockHash: string; timestamp: string }> {
  // Block number validation
  if (!Number.isInteger(blockNumber) || blockNumber < 0) {
    throw new ProviderError('Invalid block number.', 'alchemy', 400, 'INVALID_INPUT');
  }

  const hexBlock = '0x' + blockNumber.toString(16);
  const result = await queryAlchemyHistoricalRpc<any>(chain, 'eth_getBlockByNumber', [
    hexBlock,
    false, // Only header fields
  ]);

  if (!result) {
    throw new ProviderError('Block not found.', 'alchemy', 404, 'BLOCK_NOT_FOUND');
  }

  const blockHash = result.hash;
  const timestampHex = result.timestamp;

  if (!blockHash) {
    throw new ProviderError('Provenance unavailable: block hash missing.', 'alchemy', 502, 'PROVENANCE_UNAVAILABLE');
  }
  if (!timestampHex) {
    throw new ProviderError('Provenance unavailable: block timestamp missing.', 'alchemy', 502, 'PROVENANCE_UNAVAILABLE');
  }

  const unixTimestamp = parseInt(timestampHex, 16);
  const timestamp = new Date(unixTimestamp * 1000).toISOString();

  return { blockHash, timestamp };
}

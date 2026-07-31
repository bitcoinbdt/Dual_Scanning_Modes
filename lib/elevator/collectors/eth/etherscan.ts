/**
 * Etherscan API Client - Fetches Ethereum transaction data
 * Uses Etherscan API to get ERC-20 token transactions
 */

import axios from 'axios';

const DELAY_MS = 200; // Etherscan free tier: 5 req/sec
const MAX_RETRIES = 3;

/** Etherscan API base URL — override via ETHERSCAN_API_URL env var */
const ETHERSCAN_API_URL = process.env.ETHERSCAN_API_URL || 'https://api.etherscan.io/api';

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry logic
 */
async function fetchWithRetry(
  url: string,
  params: Record<string, any>,
  retries = 0
): Promise<any> {
  try {
    return await axios.get(url, { params });
  } catch (error: any) {
    if (retries < MAX_RETRIES) {
      console.log(`[Etherscan] Retry ${retries + 1}/${MAX_RETRIES} after error: ${error.message}`);
      await sleep(DELAY_MS * 2);
      return fetchWithRetry(url, params, retries + 1);
    }
    throw error;
  }
}

/**
 * Fetch token transactions from Etherscan
 * @param contractAddress - ERC-20 token contract address
 * @param apiKey - Etherscan API key
 * @param maxTransactions - Maximum number of transactions to fetch
 * @returns Array of raw Etherscan transactions
 */
export async function fetchEthTransactions(
  contractAddress: string,
  apiKey: string,
  maxTransactions: number = 1000
): Promise<any[]> {
  const url = ETHERSCAN_API_URL;
  
  console.log(`[Etherscan] Fetching transactions for ${contractAddress}...`);
  console.log(`[Etherscan] Max transactions: ${maxTransactions}`);
  
  const params = {
    module: 'account',
    action: 'tokentx',
    contractaddress: contractAddress,
    startblock: 0,
    endblock: 99999999,
    page: 1,
    offset: Math.min(maxTransactions, 10000), // Etherscan limit: 10k per request
    sort: 'desc',
    apikey: apiKey
  };
  
  const response = await fetchWithRetry(url, params);
  
  if (!response.data) {
    throw new Error('Invalid response from Etherscan');
  }
  
  if (response.data.status === '0') {
    // Status 0 can mean error or no results
    if (response.data.message === 'No transactions found') {
      console.log('[Etherscan] No transactions found');
      return [];
    }
    throw new Error(response.data.result || response.data.message || 'Etherscan API error');
  }
  
  if (response.data.status !== '1') {
    throw new Error(`Etherscan API error: ${response.data.message || 'Unknown error'}`);
  }
  
  const transactions = Array.isArray(response.data.result) ? response.data.result : [];
  
  console.log(`[Etherscan] Fetched ${transactions.length} transactions`);
  
  // Limit to requested amount
  return transactions.slice(0, maxTransactions);
}

/**
 * Get token information from Etherscan
 * @param contractAddress - Token contract address
 * @param apiKey - Etherscan API key
 * @returns Token info (name, symbol, decimals)
 */
export async function getTokenInfo(
  contractAddress: string,
  apiKey: string
): Promise<{ name?: string; symbol?: string; decimals?: number }> {
  try {
    const url = ETHERSCAN_API_URL;
    
    const params = {
      module: 'token',
      action: 'tokeninfo',
      contractaddress: contractAddress,
      apikey: apiKey
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data?.status === '1' && response.data.result) {
      const result = Array.isArray(response.data.result) 
        ? response.data.result[0] 
        : response.data.result;
      
      return {
        name: result.tokenName,
        symbol: result.symbol,
        decimals: result.divisor ? parseInt(result.divisor) : undefined
      };
    }
    
    return {};
  } catch (error) {
    console.warn('[Etherscan] Could not fetch token info:', error);
    return {};
  }
}

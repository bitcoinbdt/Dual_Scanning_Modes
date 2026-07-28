/**
 * Helius API Client - Fetches Solana transaction data
 * Ported from data_collector/services/helius.js
 */

import axios from 'axios';
import { NormalizedTransaction, TokenTransfer } from '../types';

const DELAY_MS = 300;
const MAX_RETRIES = 3;

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
      console.log(`[Helius] Retry ${retries + 1}/${MAX_RETRIES} after error: ${error.message}`);
      await sleep(DELAY_MS * 2);
      return fetchWithRetry(url, params, retries + 1);
    }
    throw error;
  }
}

/**
 * Normalize a raw Helius transaction
 */
function normalizeTransaction(tx: any, targetMint: string): NormalizedTransaction | null {
  if (!tx.timestamp) {
    return null;
  }
  
  const wallets = new Set<string>();
  const transfers: TokenTransfer[] = [];
  
  // Add fee payer
  if (tx.feePayer) {
    wallets.add(tx.feePayer);
  }
  
  // Process token transfers
  if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
    tx.tokenTransfers.forEach((transfer: any) => {
      // Filter by target mint if specified
      if (targetMint && transfer.mint !== targetMint) {
        return;
      }
      
      if (transfer.fromUserAccount) {
        wallets.add(transfer.fromUserAccount);
        transfers.push({
          from: transfer.fromUserAccount,
          to: transfer.toUserAccount,
          amount: transfer.tokenAmount,
          type: 'token',
          mint: transfer.mint
        });
      }
      if (transfer.toUserAccount) {
        wallets.add(transfer.toUserAccount);
      }
    });
  }
  
  // Skip transactions with no relevant transfers
  if (transfers.length === 0) {
    return null;
  }
  
  return {
    timestamp: tx.timestamp,
    wallets: Array.from(wallets),
    transfers
  };
}

/**
 * Fetch all transactions for a token address
 * @param address - Solana token address
 * @param apiKey - Helius API key
 * @param targetMint - Filter transactions by this mint address
 * @param maxTransactions - Maximum number of transactions to fetch
 * @returns Array of normalized transactions
 */
export async function fetchTransactions(
  address: string,
  apiKey: string,
  targetMint: string,
  maxTransactions: number = 5000
): Promise<NormalizedTransaction[]> {
  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions`;
  const allTransactions: NormalizedTransaction[] = [];
  let before: string | null = null;
  let hasMore = true;
  
  console.log(`[Helius] Fetching transactions for ${address}...`);
  console.log(`[Helius] Target mint: ${targetMint}`);
  console.log(`[Helius] Max transactions: ${maxTransactions}`);
  
  while (hasMore && allTransactions.length < maxTransactions) {
    const params: Record<string, any> = {
      'api-key': apiKey,
      limit: 100
    };
    
    if (before) {
      params.before = before;
    }
    
    console.log(`[Helius] Fetching batch (total: ${allTransactions.length})...`);
    
    const response = await fetchWithRetry(url, params);
    
    if (!response.data) {
      throw new Error('Invalid transaction response from Helius');
    }
    
    const transactions = Array.isArray(response.data) ? response.data : [];
    
    if (transactions.length === 0) {
      console.log('[Helius] No more transactions available');
      break;
    }
    
    const normalized = transactions
      .map((tx: any) => normalizeTransaction(tx, targetMint))
      .filter((tx: NormalizedTransaction | null): tx is NormalizedTransaction => tx !== null);
    
    allTransactions.push(...normalized);
    
    before = transactions[transactions.length - 1].signature;
    
    if (transactions.length < 100) {
      hasMore = false;
    }
    
    await sleep(DELAY_MS);
  }
  
  console.log(`[Helius] Total transactions: ${allTransactions.length}`);
  
  return allTransactions;
}

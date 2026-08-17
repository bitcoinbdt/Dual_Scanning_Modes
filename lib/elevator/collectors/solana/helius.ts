/**
 * Helius API Client - Fetches Solana transaction data
 * Ported from data_collector/services/helius.js
 */

import axios from 'axios';
import { NormalizedTransaction, TokenTransfer } from '../types';

const DELAY_MS = 300;
const MAX_RETRIES = 3;

// Known Solana DEX program IDs
const SOLANA_DEX_PROGRAMS = new Set([
  '675k1q2c2T6m779aoxxX48BudGXWv97Qr4BDG87paL18', // Raydium V4 AMM
  'CAMMC7Jbi2gTYccZ4t1gnhsihjh29yb2y2wqShH6A1E3', // Raydium CLMM
  'CPMMoo87FVaCHxtnTa9515pZSme8BSfU2bgZmd4CoQ2', // Raydium CPMM
  '6EF8f514592B11E0F5E5113810c3461d57c3080b', // Pump.fun Bonding Curve
  'MoonCVVeaRTTKc2Z9dZ55H1bw39s2kFjkK2t7cZ7q9Q', // Moonshot
  'JUP6LkbZbjS1jKKbbRB67cjSsCc49GVvpjC285137LM', // Jupiter v6
  'whirSpFb6fc49YrevjZgx7Ko6sD4iPr2Sm8DTrG7dVY', // Orca Whirlpool
  '24Uqj9J6jxYiGLNsgeW9msiw1xN24sa58CcG9w8AK3mG', // Meteora
  'LBRaCz9coTvCR6yURJfKTY2yJE461Pk6ziw21XRs59r', // Meteora DLMM
  '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin', // Serum V3
  'EewJydroVMLEnd8cJeLY2dBXQXkpcB6sok996g3jJifg', // Lifinity
  'AMM55xQq7bVrrw67kE54ywHE695jmW1mP5K4px7ZC7tA', // Aldrin
  'Dooar9JkhdND4o1Y5K15cxX4x8t8as51D76R1K4tFdQG', // Step Finance
  'CTMAaa74M55EjnwAhd6FZEhxS4E1mF4Kdf1GfB87CD5D', // Crema
]);

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
  
  // Differentiate swaps (trades) from simple transfers
  let isTrade = false;
  const source = String(tx.source || '').toUpperCase();
  const type = String(tx.type || '').toUpperCase();
  
  const knownDexSources = [
    'JUPITER', 'RAYDIUM', 'ORCA', 'SERUM', 'METEORA', 
    'LIFINITY', 'ALDRIN', 'STEP_FINANCE', 'CREMA', 'PUMP'
  ];
  
  if (knownDexSources.includes(source) || type.includes('SWAP')) {
    isTrade = true;
  }
  
  if (!isTrade && tx.instructions && Array.isArray(tx.instructions)) {
    for (const inst of tx.instructions) {
      if (inst.programId && SOLANA_DEX_PROGRAMS.has(inst.programId)) {
        isTrade = true;
        break;
      }
    }
  }
  
  return {
    signature: tx.signature || tx.transactionID,
    timestamp: tx.timestamp,
    wallets: Array.from(wallets),
    transfers,
    isTrade
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
      limit: Math.min(maxTransactions, 100)
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

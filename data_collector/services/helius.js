import axios from 'axios';
import { normalizeTransaction } from '../utils/normalize.js';

const DELAY_MS = 300;
const MAX_RETRIES = 3;
const MAX_TRANSACTIONS = 5000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, params, retries = 0) {
  try {
    const response = await axios.get(url, { params });
    return response;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(`Retry ${retries + 1}/${MAX_RETRIES} after error: ${error.message}`);
      await sleep(DELAY_MS * 2);
      return fetchWithRetry(url, params, retries + 1);
    }
    throw error;
  }
}

export async function fetchTransactions(address, apiKey, targetMint) {
  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions`;
  const allTransactions = [];
  let before = null;
  let hasMore = true;
  
  console.log(`Fetching transactions for ${address}...`);
  console.log(`Target mint filter: ${targetMint || 'NONE'}`);
  
  while (hasMore && allTransactions.length < MAX_TRANSACTIONS) {
    const params = {
      'api-key': apiKey,
      limit: 100
    };
    
    if (before) {
      params.before = before;
    }
    
    console.log(`Fetching batch (total so far: ${allTransactions.length})...`);
    
    const response = await fetchWithRetry(url, params);
    
    if (!response.data) {
      throw new Error('Invalid transaction response from Helius');
    }
    
    const transactions = Array.isArray(response.data) ? response.data : [];
    
    if (transactions.length === 0) {
      console.log('No more transactions available');
      break;
    }
    
    const normalized = transactions
      .map(tx => normalizeTransaction(tx, targetMint))
      .filter(tx => tx !== null);
    
    allTransactions.push(...normalized);
    
    before = transactions[transactions.length - 1].signature;
    
    if (transactions.length < 100) {
      hasMore = false;
    }
    
    await sleep(DELAY_MS);
  }
  
  console.log(`Total transactions fetched: ${allTransactions.length}`);
  
  return allTransactions;
}

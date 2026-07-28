/**
 * Wallet Balance Engine - Calculates wallet balances and holder metrics for Solana
 * Ported from data_collector/utils/wallet-engine.js
 */

import { NormalizedTransaction, WalletBalance, HolderInfo, WalletMetrics } from '../types';

/**
 * Build wallet balance data from Solana transactions
 * @param transactions - Array of normalized Solana transactions
 * @returns Wallet balances, holders, and metrics
 */
export function buildWalletData(transactions: NormalizedTransaction[]): {
  wallets: Record<string, WalletBalance>;
  holders: HolderInfo[];
  metrics: WalletMetrics;
} {
  const wallets: Record<string, WalletBalance> = {};
  
  // Process each transaction
  transactions.forEach(tx => {
    if (!tx.wallets || !tx.transfers) {
      return;
    }
    
    // Track wallet activity
    tx.wallets.forEach(wallet => {
      if (!wallets[wallet]) {
        wallets[wallet] = {
          total_in: 0,
          total_out: 0,
          tx_count: 0
        };
      }
      wallets[wallet].tx_count++;
    });
    
    // Track transfers
    tx.transfers.forEach(transfer => {
      if (transfer.from && wallets[transfer.from]) {
        wallets[transfer.from].total_out += transfer.amount;
      }
      if (transfer.to && wallets[transfer.to]) {
        wallets[transfer.to].total_in += transfer.amount;
      }
    });
  });
  
  // Calculate holders (wallets with positive balance)
  const holders: HolderInfo[] = [];
  Object.keys(wallets).forEach(wallet => {
    const balance = wallets[wallet].total_in - wallets[wallet].total_out;
    if (balance > 0) {
      holders.push({
        wallet,
        balance,
        tx_count: wallets[wallet].tx_count
      });
    }
  });
  
  // Sort by balance descending
  holders.sort((a, b) => b.balance - a.balance);
  
  const metrics: WalletMetrics = {
    total_wallets: Object.keys(wallets).length,
    total_holders: holders.length,
    top_10_wallets: holders.slice(0, 10)
  };
  
  return { wallets, holders, metrics };
}

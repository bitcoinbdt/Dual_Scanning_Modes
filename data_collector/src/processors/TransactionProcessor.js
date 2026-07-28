/**
 * TransactionProcessor - V1 MINIMAL
 * Processes raw transaction data and calculates wallet balances
 */

class TransactionProcessor {
  constructor() {
    this.EXPECTED_DECIMALS = 9; // Default for Solana tokens
  }

  /**
   * Process raw transactions from API
   * @param {Array} rawTransactions - Raw transaction data from Birdeye
   * @param {number} launchTime - Token launch timestamp
   * @returns {Object} Processed transactions and wallet balances
   */
  processTransactions(rawTransactions, launchTime) {
    if (!rawTransactions || rawTransactions.length === 0) {
      return {
        transactions: [],
        walletBalances: {},
        holders: []
      };
    }

    // Filter transactions within 24h window
    const endTime = launchTime + 86400;
    const filtered = rawTransactions.filter(tx => 
      tx.blockTime >= launchTime && tx.blockTime < endTime
    );

    // Sort by timestamp
    const sorted = filtered.sort((a, b) => a.blockTime - b.blockTime);

    // Deduplicate by txHash
    const seen = new Set();
    const unique = [];
    for (const tx of sorted) {
      if (!seen.has(tx.txHash)) {
        seen.add(tx.txHash);
        unique.push(tx);
      }
    }

    // Transform to output format
    const transactions = unique.map(tx => this.transformTransaction(tx));

    // Calculate wallet balances
    const { walletBalances, holders } = this.calculateBalances(transactions);

    return {
      transactions,
      walletBalances,
      holders
    };
  }

  /**
   * Transform raw transaction to output format
   * @param {Object} tx - Raw transaction
   * @returns {Object} Transformed transaction
   */
  transformTransaction(tx) {
    const decimals = tx.decimals || this.EXPECTED_DECIMALS;
    const amount = tx.amount / Math.pow(10, decimals);

    return {
      timestamp: tx.blockTime,
      tx_hash: tx.txHash,
      from: tx.from,
      to: tx.to,
      amount: amount,
      type: tx.type || 'unknown'
    };
  }

  /**
   * Calculate wallet balances from transactions
   * @param {Array} transactions - Processed transactions
   * @returns {Object} Wallet balances and holder list
   */
  calculateBalances(transactions) {
    const walletBalances = {};
    const holders = new Set();

    // Initialize balances
    for (const tx of transactions) {
      if (tx.from && !walletBalances[tx.from]) {
        walletBalances[tx.from] = 0;
        holders.add(tx.from);
      }
      if (tx.to && !walletBalances[tx.to]) {
        walletBalances[tx.to] = 0;
        holders.add(tx.to);
      }
    }

    // Calculate balances chronologically
    for (const tx of transactions) {
      if (tx.from) {
        walletBalances[tx.from] -= tx.amount;
      }
      if (tx.to) {
        walletBalances[tx.to] += tx.amount;
      }
    }

    return {
      walletBalances,
      holders: Array.from(holders)
    };
  }

  /**
   * Extract unique holders with positive balances
   * @param {Object} walletBalances - Wallet balance map
   * @returns {Array} Holders with positive balances
   */
  getActiveHolders(walletBalances) {
    return Object.entries(walletBalances)
      .filter(([_, balance]) => balance > 0)
      .map(([address, balance]) => ({ address, balance }));
  }
}

export default TransactionProcessor;

/**
 * SmartMoney Swap Parser — Phase 5D-2
 *
 * Deterministically parses transaction log events to identify DEX swaps
 * relative to a specific wallet.
 *
 * ANTI-FABRICATION GUARANTEES:
 *   - Only transfers touching the wallet are counted.
 *   - Event types are classified as 'buy' or 'sell' only if direction can be proven.
 *   - Quote amount is set in USD only when swapped against a verified stablecoin.
 *   - Native assets and unknown protocols default to 'unknown' event types or null USD amounts.
 */

import type { SmartMoneyTradeEvent } from '../types';

/** Verified USD stablecoin addresses (lowercased) */
const STABLECOINS = new Set([
  // Ethereum
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  '0x4fabb145d64652a948d72533023f6e7a623c7c53', // BUSD
  // BSC
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC on BSC
  '0x55d398326f99059ff775485246999027b3197955', // USDT on BSC
  '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', // DAI on BSC
]);

/** Standard native / wrapped gas tokens (lowercased) */
const GAS_TOKENS = new Set([
  'native',
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
]);

interface SimpleTransfer {
  tokenAddress: string;
  from: string;
  to: string;
  amount: number;
}

/**
 * Reconstructs a single transaction into a set of SmartMoneyTradeEvent records.
 * Returns empty array if no swap can be verified.
 */
export function parseTransactionToSwaps(
  tx: any,
  walletAddress: string,
  chain: string
): SmartMoneyTradeEvent[] {
  const walletNorm = walletAddress.toLowerCase().trim();
  const txHash = String(tx.tx_hash).toLowerCase().trim();
  const blockNumber = Number(tx.block_height);
  const blockHash = tx.block_hash ? String(tx.block_hash).toLowerCase().trim() : null;
  const timestamp = new Date(tx.block_signed_at).toISOString();

  const transfers: SimpleTransfer[] = [];

  // 1. Collect standard ERC-20 Transfer logs
  if (Array.isArray(tx.log_events)) {
    for (const log of tx.log_events) {
      if (log.decoded?.name === 'Transfer') {
        const tokenAddress = log.sender_address ? String(log.sender_address).toLowerCase().trim() : '';
        const params = log.decoded.params || [];
        const fromParam = params.find((p: any) => p.name === 'from')?.value;
        const toParam = params.find((p: any) => p.name === 'to')?.value;
        const valParam = params.find((p: any) => p.name === 'value')?.value;

        if (tokenAddress && fromParam && toParam && valParam !== undefined) {
          const from = String(fromParam).toLowerCase().trim();
          const to = String(toParam).toLowerCase().trim();
          const decimals = log.sender_contract_decimals ? Number(log.sender_contract_decimals) : 18;
          const rawAmount = Number(valParam);
          const amount = rawAmount / Math.pow(10, decimals);

          if (Number.isFinite(amount) && amount > 0) {
            transfers.push({ tokenAddress, from, to, amount });
          }
        }
      }
    }
  }

  // 2. Collect native asset transfers (value sent/received)
  if (tx.value && Number(tx.value) > 0) {
    const rawVal = Number(tx.value);
    const amount = rawVal / Math.pow(10, 18); // native assumes 18 decimals (ETH/BNB)
    const from = tx.from_address ? String(tx.from_address).toLowerCase().trim() : '';
    const to = tx.to_address ? String(tx.to_address).toLowerCase().trim() : '';
    if (from && to && Number.isFinite(amount) && amount > 0) {
      transfers.push({ tokenAddress: 'native', from, to, amount });
    }
  }

  // 3. Reconstruct net transfer balances for the target wallet
  const netBalances = new Map<string, number>();
  for (const t of transfers) {
    if (t.from === walletNorm) {
      netBalances.set(t.tokenAddress, (netBalances.get(t.tokenAddress) || 0) - t.amount);
    }
    if (t.to === walletNorm) {
      netBalances.set(t.tokenAddress, (netBalances.get(t.tokenAddress) || 0) + t.amount);
    }
  }

  // 4. Identify separate OUT (sold) and IN (bought) assets
  const soldAssets: { token: string; amount: number }[] = [];
  const boughtAssets: { token: string; amount: number }[] = [];

  for (const [token, balance] of netBalances.entries()) {
    if (balance < 0) {
      soldAssets.push({ token, amount: Math.abs(balance) });
    } else if (balance > 0) {
      boughtAssets.push({ token, amount: balance });
    }
  }

  // A valid swap requires at least one asset leaving and one asset entering
  if (soldAssets.length === 0 || boughtAssets.length === 0) {
    return [];
  }

  const events: SmartMoneyTradeEvent[] = [];

  // 5. Match sold and bought pairs
  // For each distinct swap pair, create a trade event
  for (const sold of soldAssets) {
    for (const bought of boughtAssets) {
      if (sold.token === bought.token) continue; // skip identical

      // Determine which one is base token and which is quote token
      const soldIsQuote = STABLECOINS.has(sold.token) || GAS_TOKENS.has(sold.token);
      const boughtIsQuote = STABLECOINS.has(bought.token) || GAS_TOKENS.has(bought.token);

      let eventType: 'buy' | 'sell' | 'swap' | 'unknown' = 'unknown';
      let tokenAddress: string | null = null;
      let tokenAmount: number | null = null;
      let quoteAmount: number | null = null;
      let quoteToken: string | null = null;

      if (soldIsQuote && !boughtIsQuote) {
        // Quote asset goes OUT, Base token comes IN -> BUY
        eventType = 'buy';
        tokenAddress = bought.token;
        tokenAmount = bought.amount;
        quoteToken = sold.token;
        // USD value is only safe to derive if the quote is a stablecoin
        quoteAmount = STABLECOINS.has(sold.token) ? sold.amount : null;
      } else if (!soldIsQuote && boughtIsQuote) {
        // Base token goes OUT, Quote asset comes IN -> SELL
        eventType = 'sell';
        tokenAddress = sold.token;
        tokenAmount = sold.amount;
        quoteToken = bought.token;
        // USD value is only safe to derive if the quote is a stablecoin
        quoteAmount = STABLECOINS.has(bought.token) ? bought.amount : null;
      } else {
        // Obscure trade or stable-to-stable trade -> default to unknown base/quote
        tokenAddress = bought.token;
        tokenAmount = bought.amount;
        quoteToken = sold.token;
        quoteAmount = STABLECOINS.has(sold.token) ? sold.amount : null;
      }

      events.push({
        walletAddress: walletNorm,
        chain,
        tokenAddress,
        txHash,
        blockNumber,
        blockHash,
        logIndex:      -1, // representing transaction level swap
        timestamp,
        eventType,
        tokenAmount,
        quoteAmount,
        quoteToken,
        provider:      'goldrush',
        indexedAt:     new Date().toISOString(),
      });
    }
  }

  return events;
}

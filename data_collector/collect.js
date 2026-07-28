#!/usr/bin/env node

import fs from 'fs';
import dotenv from 'dotenv';
import { fetchOHLCV } from './services/birdeye.js';
import { fetchTransactions } from './services/helius.js';
import { buildWalletData } from './utils/wallet-engine.js';
import { calculateMetrics } from './utils/metrics.js';

dotenv.config();

async function main() {
  const tokensFile = process.argv[2] || 'tokens.json';
  
  if (!process.env.BIRDEYE_API_KEY) {
    throw new Error('BIRDEYE_API_KEY not set in .env');
  }
  
  if (!process.env.HELIUS_API_KEY) {
    throw new Error('HELIUS_API_KEY not set in .env');
  }
  
  const tokensData = fs.readFileSync(tokensFile, 'utf8');
  const tokens = JSON.parse(tokensData);
  
  if (tokens.length === 0) {
    throw new Error('No tokens in tokens.json');
  }
  
  const token = tokens[0];
  const address = token.address;
  const mint = token.mint || address;
  
  console.log(`Processing token: ${address}`);
  console.log(`Mint address: ${mint}`);
  
  const ohlcv = await fetchOHLCV(address, process.env.BIRDEYE_API_KEY);
  console.log(`Fetched ${ohlcv.length} OHLCV records`);
  
  const transactions = await fetchTransactions(address, process.env.HELIUS_API_KEY, mint);
  console.log(`Fetched ${transactions.length} transactions`);
  
  if (transactions.length === 0) {
    throw new Error('No transactions found for this token');
  }
  
  const walletData = buildWalletData(transactions);
  console.log(`Extracted ${walletData.metrics.total_wallets} wallets, ${walletData.metrics.total_holders} holders`);
  
  const metrics = calculateMetrics(ohlcv, walletData);
  
  const output = {
    ohlcv,
    transactions,
    wallets: walletData.wallets,
    holders: walletData.holders,
    wallet_metrics: walletData.metrics,
    metrics
  };
  
  if (!fs.existsSync('output')) {
    fs.mkdirSync('output');
  }
  
  fs.writeFileSync('output/result.json', JSON.stringify(output, null, 2));
  
  console.log('\n=== EXECUTION SUMMARY ===');
  console.log(`Total transactions fetched: ${transactions.length}`);
  console.log(`Total wallets: ${walletData.metrics.total_wallets}`);
  console.log(`Total holders: ${walletData.metrics.total_holders}`);
  console.log(`Metrics: RF17=${metrics.RF17}, W5=${metrics.W5}`);
  console.log('\nTop 5 wallets:');
  walletData.metrics.top_10_wallets.slice(0, 5).forEach((holder, i) => {
    console.log(`${i + 1}. ${holder.wallet.substring(0, 8)}... balance: ${holder.balance.toFixed(2)}`);
  });
  console.log(`\nOutput written to: output/result.json`);
}

main().catch(error => {
  console.error('ERROR:', error.message);
  process.exit(1);
});

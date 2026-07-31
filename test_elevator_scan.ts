import fs from 'fs';
import path from 'path';
import { SolanaCollector } from './lib/elevator/collectors/solana/SolanaCollector';

// Parse .env.local manually
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)$/);
      if (match) {
        let val = match[2].trim();
        // remove surrounding quotes
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        process.env[match[1]] = val;
      }
    }
  }
}

async function run() {
  loadEnv();
  
  const birdeyeKey = process.env.BIRDEYE_API_KEY;
  const heliusKey = process.env.HELIUS_API_KEY;
  
  if (!birdeyeKey || !heliusKey) {
    console.error('Error: BIRDEYE_API_KEY or HELIUS_API_KEY not found in .env.local');
    process.exit(1);
  }
  
  console.log('API Keys Loaded:');
  console.log(`- Birdeye: ${birdeyeKey.substring(0, 5)}...`);
  console.log(`- Helius: ${heliusKey.substring(0, 5)}...`);
  
  const tokenAddress = 'DTfN4DotNupzDbqpg6dX4jfXekB5vVkePxjuyivJpump'; // SOL token
  const maxTransactions = 50; // Requests 50 transactions (5 credits tier)
  
  console.log(`\nInitializing SolanaCollector for token: ${tokenAddress}`);
  console.log(`Target Transaction Count: ${maxTransactions}`);
  
  const collector = new SolanaCollector(birdeyeKey, heliusKey);
  
  try {
    const result = await collector.collect(tokenAddress, maxTransactions);
    
    console.log('\n=== TEST SUCCESSFUL ===');
    console.log(`Blockchain: ${result.blockchain}`);
    console.log(`OHLCV Records: ${result.ohlcv.length}`);
    console.log(`Transactions Processed: ${result.transactions.length}`);
    console.log(`Holders Calculated: ${result.holders.length}`);
    console.log(`Metrics: RF17 (Wash Trading)=${result.metrics.RF17}, W5 (Total Holders)=${result.metrics.W5}`);
    console.log(`Collection Time: ${result.collectionTime}ms`);
    
    console.log('\nTop 3 Holders:');
    result.wallet_metrics.top_10_wallets.slice(0, 3).forEach((holder, i) => {
      console.log(`  ${i+1}. Wallet: ${holder.wallet} | Balance: ${holder.balance.toFixed(2)} | Txs: ${holder.tx_count}`);
    });
  } catch (error) {
    console.error('Scan Execution Failed:', error);
  }
}

run();

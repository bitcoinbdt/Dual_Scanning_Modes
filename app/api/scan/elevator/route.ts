/**
 * Elevator Scan API Route
 * Handles deep blockchain data collection for token analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollectorConfig } from '@/lib/elevator/collectors/config';
import { detectChain, isChainSupported, getUnsupportedChainMessage } from '@/lib/elevator/utils/chainDetector';
import { CollectorFactory } from '@/lib/elevator/collectors/CollectorFactory';
import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { estimateTransactionFees } from '@/lib/fees/feeEstimator';
import { verifyTransactions } from '@/lib/verification/verifyTransactions';

// Load CEX addresses
const cexAddressesPath = path.join(process.cwd(), 'data', 'cex-addresses.json');
let cexAddresses: Record<string, Array<{ address: string; label: string }>> = {};
try {
  const fileContent = fs.readFileSync(cexAddressesPath, 'utf8');
  cexAddresses = JSON.parse(fileContent);
} catch (err) {
  console.error('[API] Failed to load cex-addresses.json:', err);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user from Authorization header
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required to scan tokens' },
        { status: 401 }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid session. Please log in again.' },
        { status: 401 }
      );
    }

    const { address, creditsSpent = 10, preferredChain } = await request.json();
    
    // Validate input
    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }
    
    // Detect blockchain from address format
    const detection = detectChain(address, preferredChain as 'eth' | 'bsc' | undefined);
    
    console.log(`[API] Chain detection:`, detection);
    console.log(`[API] Preferred chain:`, preferredChain || 'auto');
    
    // Check if address format is valid
    if (!detection.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid token address',
          details: detection.message || 'Address does not match any known blockchain format',
          detectedFormat: detection.format
        },
        { status: 400 }
      );
    }
    
    // Check if detected chain is supported
    if (!isChainSupported(detection.chain)) {
      return NextResponse.json(
        { 
          error: 'Blockchain not supported',
          details: getUnsupportedChainMessage(detection),
          detectedChain: detection.format,
          supportedChains: ['Solana', 'BSC', 'Ethereum'],
        },
        { status: 400 }
      );
    }
    
    // Validate credit amount
    if (![5, 10, 20, 30].includes(creditsSpent)) {
      return NextResponse.json(
        { error: 'Credits must be 5, 10, 20, or 30' },
        { status: 400 }
      );
    }

    // 2. Deduct credits from user profile atomically using RPC
    const { data: newBalance, error: rpcError } = await supabase.rpc(
      'deduct_credits_for_scan',
      {
        p_user_id: user.id,
        p_amount: creditsSpent,
        p_scan_type: 'ELEVATOR',
        p_token_address: address,
      }
    );

    if (rpcError) {
      console.error('[Elevator Scan API] Credit deduction error:', rpcError);
      
      // Handle insufficient credits explicitly
      if (rpcError.message?.includes('Insufficient credit balance')) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits.', code: 'INSUFFICIENT_CREDITS' },
          { status: 402 } // 402 Payment Required
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to process credit deduction. Please ensure database functions are set up.' },
        { status: 500 }
      );
    }
    
    // Validate API keys — only Birdeye (all chains) and Helius (Solana only) are required
    const birdeyeKey = process.env.BIRDEYE_API_KEY;
    const heliusKey = process.env.HELIUS_API_KEY;
    
    if (!birdeyeKey) {
      console.error('[API] Missing BIRDEYE_API_KEY');
      return NextResponse.json(
        { error: 'Elevator scan API keys not configured (Birdeye)' },
        { status: 500 }
      );
    }

    if (detection.chain === 'solana' && !heliusKey) {
      console.error('[API] Missing HELIUS_API_KEY for Solana');
      return NextResponse.json(
        { error: 'Elevator scan API keys not configured (Helius)' },
        { status: 500 }
      );
    }
    
    // Get config based on credits
    const config = getCollectorConfig(creditsSpent);
    
    console.log(`[API] Starting elevator scan for ${address}`);
    console.log(`[API] Credits: ${creditsSpent}, Tier: ${config.tier}, Max Transactions: ${config.maxTransactions}`);
    
    // Create collector — BSC/ETH use GeckoTerminal (free, no key) + Birdeye fallback
    const collector = CollectorFactory.create(detection.chain as 'solana' | 'bsc' | 'eth', {
      BIRDEYE_API_KEY: birdeyeKey,
      HELIUS_API_KEY: heliusKey,
    });
    
    console.log(`[API] Using ${collector.getBlockchain()} collector`);
    
    // Collect data
    const rawData = await collector.collect(
      address,
      config.maxTransactions
    );
    
        // Tag exchanges and calculate flow metrics (Feature 10)
        const exchangeResult = tagAndComputeExchangeFlow(rawData.transactions, rawData.blockchain);
        rawData.transactions = exchangeResult.transactions;

        // Estimate gas & DEX transaction fees (Feature 11)
        const trades = rawData.transactions.filter((tx: any) => tx.isTrade && tx.hash);
        const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
        
        // Query RPC nodes concurrently for up to 15 trades to stay within rate limits, estimate the rest
        await Promise.all(
          trades.slice(0, 15).map(async (tx: any) => {
            try {
              const fees = await estimateTransactionFees(
                tx.hash,
                rawData.blockchain as any,
                tx.amount,
                tx.priceUsd || 0,
                HELIUS_API_KEY
              );
              tx.gasCostUsd = fees.gasCostUsd;
              tx.dexFeeUsd = fees.dexFeeUsd;
            } catch (err) {
              tx.gasCostUsd = 0;
              tx.dexFeeUsd = 0;
            }
          })
        );

        // Fallback calculations for any remaining trades
        const remainingTrades = trades.slice(15);
        for (const tx of remainingTrades) {
          const nativePrice = rawData.blockchain === 'solana' ? 200 : (rawData.blockchain === 'bsc' ? 600 : 3000);
          const estimatedGasUsed = rawData.blockchain === 'solana' ? 0.00001 : 150000;
          const rate = rawData.blockchain === 'solana' ? 1 : (rawData.blockchain === 'bsc' ? 3 * 1e9 : 20 * 1e9);
          tx.gasCostUsd = (rawData.blockchain === 'solana' ? estimatedGasUsed : (estimatedGasUsed * rate / 1e18)) * nativePrice;
          tx.dexFeeUsd = tx.amount * (tx.priceUsd || 0) * 0.003;
        }

        // On-chain transaction verification (Feature 12)
        const verificationResult = await verifyTransactions(
          rawData.transactions,
          rawData.blockchain as any,
          HELIUS_API_KEY
        );

        return NextResponse.json({
          success: true,
          remainingCredits: newBalance,
          rawData: {
            transactions: rawData.transactions,
            holders: rawData.holders,
            ohlcv: rawData.ohlcv,
            blockchain: rawData.blockchain, // Include detected blockchain
            token: {
              symbol: 'TOKEN', // TODO: Get from token metadata
              address: address
            },
            holder_spike: rawData.holder_spike,
            spike_percentage: rawData.spike_percentage,
            new_holders_24h: rawData.new_holders_24h,
            total_holders_before_24h: rawData.total_holders_before_24h,
            top_10_wallets: rawData.wallet_metrics.top_10_wallets,
            top_holders_filtered: rawData.wallet_metrics.top_holders_filtered,
            holder_growth: computeHolderGrowth(rawData.transactions),
            exchange_flow: exchangeResult.metrics,
            trust_score: {
              verifiedCount: verificationResult.verifiedCount,
              totalChecked: verificationResult.totalChecked,
              score: verificationResult.totalChecked > 0 ? Math.round((verificationResult.verifiedCount / verificationResult.totalChecked) * 100) : 100,
              discrepancies: verificationResult.discrepancies
            }
          },
      metadata: {
        blockchain: rawData.blockchain, // Also include in metadata
        detectedChain: detection.chain,
        creditsSpent,
        tier: config.tier,
        transactionCount: rawData.transactions.length,
        holderCount: rawData.holders.length,
        walletCount: rawData.wallet_metrics.total_wallets,
        timestamp: new Date().toISOString(),
        metrics: {
          RF17: rawData.metrics.RF17,
          W5: rawData.metrics.W5
        }
      }
    });
    
  } catch (error: any) {
    console.error('[API] Elevator scan error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Elevator scan failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Use Node.js runtime for API calls
export const runtime = 'nodejs';

// Set maximum execution time to 60 seconds
export const maxDuration = 60;

function isSystemAddressStatic(address: string): boolean {
  const addr = address.toLowerCase();
  
  if (addr === '0x0000000000000000000000000000000000000000' ||
      addr === '0x000000000000000000000000000000000000dead' ||
      addr === '11111111111111111111111111111111' ||
      addr === 'system' ||
      addr === 'pool') {
    return true;
  }
  
  const SYSTEM_SET = new Set([
    '0x10ed43c718714eb63d5aa57b78b54704e256024e',
    '0x13f4ea83f0bd40e75c8222255bc855a974568dd4',
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
    '0xe592427a0d586ae1a4500ab49d8a3edcf6f3f024',
    'jup6lkbzbjs1jkkbbrb67cjsscc49gvvpjc285137lm',
    '675k1q2c2t6m779aoxxx48budgxwv97qr4bdg87pal18',
    '5q52f7oktj7rmbs178fk9yadek4qyq145qqwgqbvmtqp',
    'whirspfb6fc49yrevjzgx7ko6sd4ipr2sm8dtrg7dvy',
    'lbracz9cotvcr6yurjfkty2yje461pk6ziw21xrs59r',
  ]);
  
  return SYSTEM_SET.has(addr);
}

function computeHolderGrowth(transactions: any[]): Array<{ timestamp: number, holders: number }> {
  if (transactions.length === 0) return [];
  
  const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
  const balances = new Map<string, number>();
  const growthPoints: Array<{ timestamp: number; holders: number }> = [];
  
  const startTime = sortedTxs[0].timestamp;
  const endTime = sortedTxs[sortedTxs.length - 1].timestamp;
  
  const durationDays = (endTime - startTime) / 86400;
  const intervalSeconds = durationDays > 4 ? 86400 : 14400; // Daily or 4-hourly
  
  let currentIntervalLimit = startTime + intervalSeconds;
  
  for (const tx of sortedTxs) {
    const from = tx.from;
    const to = tx.to;
    const amount = tx.amount;
    
    if (from && !isSystemAddressStatic(from)) {
      const bal = balances.get(from) || 0;
      balances.set(from, Math.max(0, bal - amount));
    }
    
    if (to && !isSystemAddressStatic(to)) {
      const bal = balances.get(to) || 0;
      balances.set(to, bal + amount);
    }
    
    while (tx.timestamp >= currentIntervalLimit) {
      let holderCount = 0;
      for (const [_, bal] of balances.entries()) {
        if (bal > 1e-6) {
          holderCount++;
        }
      }
      
      growthPoints.push({
        timestamp: currentIntervalLimit * 1000,
        holders: holderCount
      });
      
      currentIntervalLimit += intervalSeconds;
    }
  }
  
  let finalHolderCount = 0;
  for (const [_, bal] of balances.entries()) {
    if (bal > 1e-6) {
      finalHolderCount++;
    }
  }
  
  growthPoints.push({
    timestamp: endTime * 1000,
    holders: finalHolderCount
  });
  
  return growthPoints;
}

function tagAndComputeExchangeFlow(
  transactions: any[],
  chain: string
): {
  transactions: any[];
  metrics: {
    totalTokensToExchanges: number;
    totalTokensFromExchanges: number;
    netExchangeFlow: number;
  };
} {
  const chainKey = chain === 'solana' ? 'solana' : (chain === 'bsc' ? 'bsc' : 'ethereum');
  const addressList = cexAddresses[chainKey] || [];
  
  const exchangeMap = new Map<string, string>();
  for (const item of addressList) {
    exchangeMap.set(item.address.toLowerCase(), item.label);
  }
  
  let totalTokensToExchanges = 0;
  let totalTokensFromExchanges = 0;
  
  for (const tx of transactions) {
    const fromAddr = tx.from?.toLowerCase();
    const toAddr = tx.to?.toLowerCase();
    
    const fromLabel = exchangeMap.get(fromAddr);
    const toLabel = exchangeMap.get(toAddr);
    
    if (toLabel) {
      tx.toExchange = true;
      tx.exchangeName = toLabel;
      totalTokensToExchanges += tx.amount;
    }
    
    if (fromLabel) {
      tx.fromExchange = true;
      tx.exchangeName = fromLabel;
      totalTokensFromExchanges += tx.amount;
    }
  }
  
  return {
    transactions,
    metrics: {
      totalTokensToExchanges,
      totalTokensFromExchanges,
      netExchangeFlow: totalTokensToExchanges - totalTokensFromExchanges
    }
  };
}

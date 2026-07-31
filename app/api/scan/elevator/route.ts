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
    
    // Return data in format expected by UI
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

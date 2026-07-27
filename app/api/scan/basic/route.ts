import { NextRequest, NextResponse } from 'next/server';
import { scanToken, validateAddress } from '@/lib/blockchain/tokenScanner';

export async function POST(request: NextRequest) {
  try {
    const { address, chain } = await request.json();
    
    // Validate address
    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const validation = validateAddress(address);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    
    // Scan token
    const result = await scanToken(address, chain || '1');
    
    return NextResponse.json({
      success: true,
      data: result.data.onChainData,
      metadata: result.data.metadata,
      timestamp: result.timestamp
    });
  } catch (error: any) {
    console.error('[Basic Scan API] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Scan failed',
        details: error.stack 
      },
      { status: 500 }
    );
  }
}

// Use Node.js runtime for ethers.js and @solana/web3.js
export const runtime = 'nodejs';

// Set maximum execution time to 60 seconds
export const maxDuration = 60;

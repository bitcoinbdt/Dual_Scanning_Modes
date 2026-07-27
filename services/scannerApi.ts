/**
 * Scanner API Client
 * 
 * Now uses embedded Next.js API routes instead of external backend.
 * All blockchain data collection happens server-side in the same app.
 */

export interface BasicScanResponse {
  address: string;
  tokenName: string;
  symbol: string;
  totalSupply: number;
  contractVerified: boolean;
  network: string;
  taxBuy: string;
  taxSell: string;
  mintFunction: string;
  freezable: string;
  liquidityLocked: boolean;
  timestamp: string;
  recentTransactions: any[];
  liquidityInfo?: any;
}

/**
 * Scan a token (EVM or Solana) using embedded blockchain services
 */
export async function getBasicScan(address: string, chain: string = '1'): Promise<BasicScanResponse> {
  try {
    const res = await fetch('/api/scan/basic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, chain })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Scan failed');
    }
    
    return data.data;
  } catch (error: any) {
    console.error('[Scanner API] Error:', error);
    throw error;
  }
}

/**
 * Elevator scan - TODO: Implement deep analysis in the future
 * For now, falls back to basic scan
 */
export async function startElevatorScan(
  address: string, 
  chain: string = '1', 
  mood: string = 'neutral'
): Promise<{ jobId: string, status: string, data?: any }> {
  try {
    // For now, just do a basic scan and return immediately
    const data = await getBasicScan(address, chain);
    return {
      jobId: 'immediate',
      status: 'completed',
      data
    };
  } catch (error: any) {
    console.error('[Scanner API] Elevator scan error:', error);
    throw error;
  }
}

/**
 * Get elevator job status - TODO: Implement job queue in the future
 */
export async function getElevatorJobStatus(jobId: string): Promise<{ status: string, address?: string, data?: any }> {
  return {
    status: 'completed',
    data: null
  };
}

/**
 * Validate backend connection (now checks embedded API health)
 */
export async function validateBackendConnection() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    return { 
      connected: res.ok, 
      scanner: data.scanner 
    };
  } catch (error) {
    console.warn('[Scanner API] Health check failed');
    return { connected: false, scanner: 'offline' };
  }
}

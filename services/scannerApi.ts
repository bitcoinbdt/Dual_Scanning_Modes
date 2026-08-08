/**
 * Scanner API Client
 * 
 * Now uses embedded Next.js API routes instead of external backend.
 * All blockchain data collection happens server-side in the same app.
 */

import { supabase } from '@/lib/supabase';
import type { DeepScanResult } from '@/lib/deep_scan/types';

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

/** Retrieve the current Supabase session token, throwing if not logged in */
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw { message: 'You must be logged in to scan. Please sign in and try again.', code: 'AUTH_REQUIRED' };
  }
  return token;
}

/**
 * Scan a token (EVM or Solana) using embedded blockchain services
 */
export async function getBasicScan(address: string, chain: string = '1'): Promise<BasicScanResponse> {
  try {
    const token = await getAuthToken();

    const res = await fetch('/api/scan/basic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ address, chain })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw { message: data.error || 'Scan failed', code: data.code };
    }
    
    return data.data;
  } catch (error: any) {
    console.error('[Scanner API] Error:', error);
    throw error;
  }
}

/**
 * Elevator scan - Deep blockchain analysis with raw transaction data
 * Collects OHLCV, transactions, wallet balances, and holder metrics
 */
export async function startElevatorScan(
  address: string,
  creditsSpent: number = 10,
  preferredChain?: 'eth' | 'bsc' | 'solana'
): Promise<{ jobId: string, status: string, rawData?: any, metadata?: any }> {
  try {
    const token = await getAuthToken();

    const res = await fetch('/api/scan/elevator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ address, creditsSpent, preferredChain })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      // Throw an object with both message and code so the frontend can branch on specific errors
      throw { message: data.error || 'Elevator scan failed', code: data.code };
    }
    
    return {
      jobId: 'immediate',
      status: 'completed',
      rawData: data.rawData,
      metadata: data.metadata
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

/**
 * Deep Scan — 15-credit full on-chain intelligence report.
 * Posts to /api/scan/deep and returns the raw DeepScanResult.
 */
export async function getDeepScan(
  address: string,
  chain: string
): Promise<DeepScanResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch('/api/scan/deep', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ address, preferredChain: chain }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const error: any = new Error(
      errData.error || `Deep scan failed (HTTP ${res.status})`
    );
    error.code = errData.code || 'DEEP_SCAN_ERROR';
    throw error;
  }

  const data = await res.json();
  return data.result as DeepScanResult;
}

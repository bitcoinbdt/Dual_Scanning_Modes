import { NextRequest, NextResponse } from 'next/server';
import { validateAddress } from '@/lib/blockchain/tokenScanner';

/**
 * GET /api/debug/scan?address=0x...&chain=1
 * Runs scan stages one-by-one and reports which one fails.
 * REMOVE THIS ROUTE AFTER DEBUGGING.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address') || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH default
  const chain = searchParams.get('chain') || '1';

  const steps: Record<string, any> = {};

  // Step 1: Address validation
  try {
    const v = validateAddress(address);
    steps.validate = { ok: v.valid, network: v.network, error: v.error };
  } catch (e: any) {
    steps.validate = { ok: false, error: e.message };
  }

  // Step 2: EVM provider
  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com', undefined, { staticNetwork: true });
    const block = await provider.getBlockNumber();
    steps.rpc = { ok: true, block };
  } catch (e: any) {
    steps.rpc = { ok: false, error: e.message };
  }

  // Step 3: GoPlus Security
  try {
    const { fetchGoPlusSecurity } = await import('@/lib/blockchain/goPlusSecurity');
    const sec = await fetchGoPlusSecurity(address, chain);
    steps.goplus = { ok: true, isHoneypot: sec?.isHoneypot };
  } catch (e: any) {
    steps.goplus = { ok: false, error: e.message };
  }

  // Step 4: Market data
  try {
    const { fetchMarketDataWithFallback } = await import('@/lib/blockchain/marketDataFallback');
    const mkt = await fetchMarketDataWithFallback(address, chain);
    steps.market = { ok: true, source: mkt.source, liquidity: mkt.totalLiquidityUsd };
  } catch (e: any) {
    steps.market = { ok: false, error: e.message };
  }

  // Step 5: Full scanToken
  try {
    const { scanToken } = await import('@/lib/blockchain/tokenScanner');
    const result = await scanToken(address, chain);
    steps.fullScan = { ok: true, name: result.data.onChainData.tokenName };
  } catch (e: any) {
    steps.fullScan = { ok: false, error: e.message, stack: e.stack?.split('\n').slice(0, 5).join(' | ') };
  }

  return NextResponse.json({ address, chain, steps });
}

export const runtime = 'nodejs';
export const maxDuration = 60;

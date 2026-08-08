import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';
import crypto from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────────
interface BoostEntry {
  chainId: string;
  tokenAddress: string;
  description?: string;
  // NOTE: boost API does NOT return name/symbol — those come from pair data
}

interface PairData {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd?: string;
  volume?: { h24?: number };
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  priceChange?: { h24?: number };
  info?: { imageUrl?: string };
  txns?: { h24?: { buys?: number; sells?: number } };
}

interface EnrichedToken {
  chainId: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  price: string;
  priceChange24h: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  dexId: string;
  baseTokenAddress: string;
  hypeScore: number;
}

// ── Quality thresholds ───────────────────────────────────────────────────────
const MIN_LIQUIDITY   = 15_000;   // $15k minimum pool depth
const MIN_VOLUME_24H  = 30_000;   // $30k minimum 24h trading volume
const MIN_MARKET_CAP  = 100_000;  // $100k minimum market cap

// ── Hype Scoring ─────────────────────────────────────────────────────────────
// Higher score = more genuinely hyped token
function calcHypeScore(token: EnrichedToken): number {
  const turnover = token.volume24h / (token.liquidity || 1);   // trading velocity
  const momentum = Math.abs(token.priceChange24h);              // price movement magnitude
  const sizeBonus = Math.log10(Math.max(token.marketCap, 1));  // size normalizer (log scale)
  return turnover * (1 + momentum / 100) * sizeBonus;
}

// ── Helper: fetch + enrich a single token address ────────────────────────────
async function enrichToken(
  entry: BoostEntry,
): Promise<EnrichedToken | null> {
  try {
    const pairRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${entry.tokenAddress}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
    );
    if (!pairRes.ok) return null;
    const pairJson = await pairRes.json();
    const pairs: PairData[] = pairJson.pairs || [];
    if (pairs.length === 0) return null;

    // Pick the pair with the highest 24h volume (most liquid/active pair)
    const best = pairs.reduce((a, b) =>
      (b.volume?.h24 ?? 0) > (a.volume?.h24 ?? 0) ? b : a
    );

    const liquidity  = best.liquidity?.usd   ?? 0;
    const volume24h  = best.volume?.h24      ?? 0;
    const marketCap  = best.marketCap ?? best.fdv ?? 0;

    // Quality gate — skip low-quality / illiquid tokens
    if (liquidity  < MIN_LIQUIDITY)  return null;
    if (volume24h  < MIN_VOLUME_24H) return null;
    if (marketCap  < MIN_MARKET_CAP) return null;

    // Name/symbol ALWAYS come from pair data — boost API has no name field
    const name   = best.baseToken?.name   || 'Unknown Token';
    const symbol = best.baseToken?.symbol || '???';

    const enriched: EnrichedToken = {
      chainId:          entry.chainId,
      tokenAddress:     entry.tokenAddress,
      name,
      symbol,
      description:      entry.description || '',
      imageUrl:         best.info?.imageUrl || '',
      price:            best.priceUsd || '0',
      priceChange24h:   best.priceChange?.h24 ?? 0,
      marketCap,
      liquidity,
      volume24h,
      dexId:            best.dexId,
      baseTokenAddress: best.baseToken?.address || entry.tokenAddress,
      hypeScore:        0, // calculated after
    };

    enriched.hypeScore = calcHypeScore(enriched);
    return enriched;
  } catch {
    return null;
  }
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let creditsDeducted = false;
  let refundIssued = false;           // P2-3: prevents double-refund locally
  const scanId = crypto.randomUUID(); // P0: unique identifier for database-level idempotency
  const agentCost = 5;

  try {
    // 1. Authenticate
    const headersList = await headers();
    const authHeader  = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required to run the agent' },
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
    userId = user.id;

    // 2. Deduct 5 credits atomically
    const { data: newBalance, error: rpcError } = await supabase.rpc(
      'deduct_credits_for_scan',
      { p_user_id: user.id, p_amount: agentCost, p_scan_type: 'AGENT', p_token_address: 'ALL', p_scan_id: scanId }
    );

    if (!rpcError) {
      creditsDeducted = true;
    }

    if (rpcError) {
      console.error('[Agent API] Credit deduction error:', rpcError);
      if (rpcError.message?.includes('Insufficient credit balance')) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits.', code: 'INSUFFICIENT_CREDITS' },
          { status: 402 }
        );
      }
      return NextResponse.json({ error: 'Failed to process credit deduction.' }, { status: 500 });
    }

    // 3. Multi-source token discovery
    // Source A: Top ongoing boosts (high market attention)
    // Source B: Latest boosts     (freshest hype, may be from any chain)
    const [topRes, latestRes] = await Promise.allSettled([
      fetch('https://api.dexscreener.com/token-boosts/top/v1',    { headers: { Accept: 'application/json' } }),
      fetch('https://api.dexscreener.com/token-boosts/latest/v1', { headers: { Accept: 'application/json' } }),
    ]);

    const topBoosts:    BoostEntry[] = topRes.status    === 'fulfilled' && topRes.value.ok
      ? await topRes.value.json()    : [];
    const latestBoosts: BoostEntry[] = latestRes.status === 'fulfilled' && latestRes.value.ok
      ? await latestRes.value.json() : [];

    // Merge and deduplicate by tokenAddress (prefer top-boost entries)
    const seen  = new Set<string>();
    const merged: BoostEntry[] = [];
    for (const entry of [...topBoosts, ...latestBoosts]) {
      const key = `${entry.chainId}:${entry.tokenAddress}`.toLowerCase();
      if (!seen.has(key) && entry.tokenAddress) {
        seen.add(key);
        merged.push(entry);
      }
    }

    // Limit candidate pool to 60 to bound API calls but cast a wide net
    const candidates = merged.slice(0, 60);

    // 4. Enrich in parallel (with per-request timeout)
    const enriched = await Promise.all(candidates.map(enrichToken));

    // 5. Filter nulls, sort by hype score (descending), return top 10
    const results = enriched
      .filter((e): e is EnrichedToken => e !== null)
      .sort((a, b) => b.hypeScore - a.hypeScore)
      .slice(0, 10)
      // Strip internal hypeScore from response
      .map(({ hypeScore: _, ...rest }) => rest);

    return NextResponse.json({
      success:    true,
      newBalance,
      tokens:     results,
      total:      results.length,
    });

  } catch (error: any) {
    if (creditsDeducted && userId && !refundIssued) {
      refundIssued = true;
      console.log(`[Agent API] Attempting credit refund of ${agentCost} for user ${userId} due to failure...`);
      try {
        const { error: refundError } = await supabase.rpc('refund_credits_for_scan', {
          p_user_id: userId,
          p_amount: agentCost,
          p_scan_type: 'AGENT',
          p_token_address: 'ALL',
          p_scan_id: scanId, // Pass scanId for database-level idempotency
        });
        if (refundError) {
          console.error('[Agent API] Credit refund RPC failed:', refundError);
        } else {
          console.log('[Agent API] Credit refund successful');
        }
      } catch (refundErr) {
        console.error('[Agent API] Error calling credit refund RPC:', refundErr);
      }
    }

    console.error('[Agent API] Run error:', error);
    return NextResponse.json(
      { error: 'Failed to run agent. Please try again.' },
      { status: 500 }
    );
  }
}

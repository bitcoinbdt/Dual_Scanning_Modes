import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BoostedToken {
  chainId: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  description?: string;
  links?: Record<string, string>;
  createdAt?: string;
}

interface PairData {
  chainId: string;
  dexId: string;
  baseToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  priceChange?: { h24?: number };
  info?: { imageUrl?: string };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const boostedRes = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      headers: { Accept: "application/json" },
    });
    if (!boostedRes.ok) {
      throw new Error(`DexScreener boosts API returned ${boostedRes.status}`);
    }
    const boosted: BoostedToken[] = await boostedRes.json();
    const top20 = boosted.slice(0, 20);

    const enriched = await Promise.all(
      top20.map(async (token) => {
        try {
          const pairRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${token.tokenAddress}`,
            { headers: { Accept: "application/json" } },
          );
          if (!pairRes.ok) return null;
          const pairJson = await pairRes.json();
          const pairs: PairData[] = pairJson.pairs || [];
          const best = pairs[0] || null;
          if (!best) return null;
          return {
            chainId: token.chainId,
            tokenAddress: token.tokenAddress,
            name: token.name,
            symbol: token.symbol,
            description: token.description || "",
            imageUrl: best.info?.imageUrl || "",
            price: best.priceUsd || "0",
            priceChange24h: best.priceChange?.h24 ?? 0,
            marketCap: best.marketCap ?? best.fdv ?? 0,
            liquidity: best.liquidity?.usd ?? 0,
            dexId: best.dexId,
            baseTokenAddress: best.baseToken?.address || token.tokenAddress,
          };
        } catch {
          return null;
        }
      }),
    );

    const valid = enriched.filter((e): e is NonNullable<typeof e> => e !== null);

    return new Response(JSON.stringify({ tokens: valid, total: valid.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

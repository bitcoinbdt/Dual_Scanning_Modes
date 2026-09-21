// FIX-2.1: Helper to fetch token symbol via DexScreener (no key) and Birdeye fallback
export async function fetchTokenSymbol(
  chain: 'solana' | 'bsc' | 'eth',
  address: string,
  birdeyeApiKey?: string
): Promise<string | null> {
  // Try DexScreener first (no key)
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      const pair = data?.pairs?.find((p: any) =>
        p.baseToken?.address?.toLowerCase() === address.toLowerCase()
      );
      const sym = pair?.baseToken?.symbol;
      if (sym && typeof sym === 'string' && sym.length > 0) return sym;
    }
  } catch {}

  // Fallback: Birdeye token overview (chain-aware)
  if (birdeyeApiKey) {
    try {
      const chainSlug = chain === 'solana' ? 'solana' : chain === 'bsc' ? 'bsc' : 'ethereum';
      const res = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${address}`, {
        headers: { 'X-API-KEY': birdeyeApiKey, 'x-chain': chainSlug },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        const sym = data?.data?.symbol;
        if (sym && typeof sym === 'string' && sym.length > 0) return sym;
      }
    } catch {}
  }
  return null;
}

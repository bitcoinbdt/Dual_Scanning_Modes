import axios from 'axios';

// Cache native coin prices
let solPriceCache = { price: 200, lastFetched: 0 };
let ethPriceCache = { price: 3000, lastFetched: 0 };
let bnbPriceCache = { price: 600, lastFetched: 0 };

async function fetchNativePrice(coin: 'sol' | 'eth' | 'bnb'): Promise<number> {
  const now = Date.now();
  const cache = coin === 'sol' ? solPriceCache : (coin === 'eth' ? ethPriceCache : bnbPriceCache);
  
  if (now - cache.lastFetched < 300000) { // 5 minutes cache
    return cache.price;
  }
  
  try {
    let tokenAddress = '';
    if (coin === 'sol') tokenAddress = 'So11111111111111111111111111111111111111112';
    else if (coin === 'eth') tokenAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    else if (coin === 'bnb') tokenAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
    
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const resp = await axios.get(url, { timeout: 3000 });
    const pairs = resp.data?.pairs || [];
    if (pairs.length > 0) {
      const price = parseFloat(pairs[0].priceUsd);
      if (price > 0) {
        if (coin === 'sol') solPriceCache = { price, lastFetched: now };
        else if (coin === 'eth') ethPriceCache = { price, lastFetched: now };
        else if (coin === 'bnb') bnbPriceCache = { price, lastFetched: now };
        return price;
      }
    }
  } catch (err) {
    console.error(`[Fees] Failed to fetch native price for ${coin}:`, err);
  }
  
  return cache.price;
}

/**
 * Estimate gas and DEX fees for a specific transaction.
 * EVM queries public RPC, Solana queries Helius parsed transactions API if key is available.
 */
export async function estimateTransactionFees(
  txHash: string,
  chain: 'solana' | 'bsc' | 'eth',
  tradeAmount: number,
  tradePriceUsd: number,
  heliusApiKey?: string
): Promise<{ gasCostUsd: number; dexFeeUsd: number }> {
  let gasCostUsd = 0;
  const dexFeeUsd = tradeAmount * tradePriceUsd * 0.003; // Standard 0.3% LP fee approximation

  try {
    if (chain === 'solana') {
      const solPrice = await fetchNativePrice('sol');
      if (heliusApiKey) {
        try {
          const url = `https://api.helius.xyz/v0/transactions/?api-key=${heliusApiKey}`;
          const resp = await axios.post(url, { transactions: [txHash] }, { timeout: 3000 });
          const txData = resp.data?.[0];
          if (txData && typeof txData.fee === 'number') {
            gasCostUsd = (txData.fee / 1e9) * solPrice;
          }
        } catch (e) {
          // ignore helius fetch failures, fall back to default
        }
      }
      if (gasCostUsd === 0) {
        // Standard Solana gas fee (0.000005 SOL + priority fee estimate)
        gasCostUsd = 0.00001 * solPrice;
      }
    } else {
      const rpcUrl = chain === 'bsc' ? 'https://bsc-dataseed.binance.org' : 'https://eth.llamarpc.com';
      const nativePrice = await fetchNativePrice(chain === 'bsc' ? 'bnb' : 'eth');
      
      const payload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      };
      
      const resp = await axios.post(rpcUrl, payload, { timeout: 3000 });
      const result = resp.data?.result;
      if (result) {
        const gasUsed = parseInt(result.gasUsed, 16);
        const effectiveGasPrice = result.effectiveGasPrice ? parseInt(result.effectiveGasPrice, 16) : 0;
        
        let gasPrice = effectiveGasPrice;
        if (gasPrice === 0) {
          const txPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'eth_getTransactionByHash',
            params: [txHash]
          };
          const txResp = await axios.post(rpcUrl, txPayload, { timeout: 3000 });
          const txResult = txResp.data?.result;
          if (txResult && txResult.gasPrice) {
            gasPrice = parseInt(txResult.gasPrice, 16);
          }
        }
        
        if (gasPrice > 0 && gasUsed > 0) {
          gasCostUsd = (gasUsed * gasPrice / 1e18) * nativePrice;
        }
      }
      
      if (gasCostUsd === 0) {
        // Fallback Uniswap swap fee estimate (~150,000 gas)
        const estimatedGasUsed = 150000;
        const estimatedGasPriceGwei = chain === 'bsc' ? 3 : 20; // 3 Gwei BSC, 20 Gwei ETH
        gasCostUsd = (estimatedGasUsed * (estimatedGasPriceGwei * 1e9) / 1e18) * nativePrice;
      }
    }
  } catch (err) {
    const nativePrice = chain === 'solana' ? 200 : (chain === 'bsc' ? 600 : 3000);
    const estimatedGasUsed = chain === 'solana' ? 0.00001 : 150000;
    const rate = chain === 'solana' ? 1 : (chain === 'bsc' ? 3 * 1e9 : 20 * 1e9);
    gasCostUsd = (chain === 'solana' ? estimatedGasUsed : (estimatedGasUsed * rate / 1e18)) * nativePrice;
  }

  return { gasCostUsd, dexFeeUsd };
}

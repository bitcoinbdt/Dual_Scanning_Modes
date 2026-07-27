/**
 * Solana Token Scanner
 * 
 * Scans Solana SPL tokens using public RPC nodes
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { cacheStaticData, getStaticData } from './cache';
import { fetchMarketDataWithFallback } from './marketDataFallback';
import { OnChainData, StaticData } from './types';

// Public Solana RPCs round-robin
const PUBLIC_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-rpc.publicnode.com'
];

function getConnection(): Connection {
  const rpc = PUBLIC_RPCS[Math.floor(Math.random() * PUBLIC_RPCS.length)];
  return new Connection(rpc, 'confirmed');
}

/**
 * Scan a Solana token
 */
export async function scanSolanaToken(address: string): Promise<OnChainData> {
  console.log(`[SOLANA] 🔍 Scanning token ${address} via Public RPCs...`);
  
  const connection = getConnection();
  let pubkey: PublicKey;
  
  try {
    pubkey = new PublicKey(address);
  } catch (e) {
    throw new Error('Invalid Solana public key format');
  }

  // Step 1: Check cache
  let staticData: StaticData | null = null;
  try {
    staticData = await getStaticData(address);
  } catch (err) {}
  
  const isFirstScan = !staticData;
  
  // Market Data (we fetch this early because DexScreener gives us the Name/Symbol for free!)
  let marketData: any;
  const completedSources: string[] = [];
  const failedSources: string[] = [];

  try {
    marketData = await fetchMarketDataWithFallback(address);
    completedSources.push('market_data');
  } catch (e) {
    failedSources.push('market_data');
    marketData = { totalLiquidityUsd: 0, mainPools: [], source: 'fallback' };
  }

  if (isFirstScan) {
    console.log(`[SOLANA] 📥 FIRST SCAN - Fetching static data directly from public nodes...`);
    
    // We use DexScreener for name/symbol since public nodes don't easily return Metaplex metadata
    const tokenName = marketData.tokenNameOverride || "Unknown Solana Token";
    const symbol = marketData.symbolOverride || "???";
    
    let decimals = 0;
    try {
      const supplyRes = await connection.getTokenSupply(pubkey);
      decimals = supplyRes.value.decimals;
    } catch(e: any) {
      console.warn(`[SOLANA] ⚠️ Could not fetch decimals via node: ${e.message}`);
    }

    staticData = {
      tokenName,
      symbol,
      decimals,
      network: "solana",
      contractVerified: true,
      cachedAt: new Date().toISOString()
    };
    
    try { 
      await cacheStaticData(address, staticData); 
    } catch(e){}
  } else {
    console.log(`[SOLANA] ✅ CACHE HIT - Loading static data from cache`);
  }
  
  // Step 2: Dynamic Data
  console.log(`[SOLANA] 🔄 Fetching dynamic data via Public RPC...`);
  let dynamicData: any = {
    totalSupply: 0,
    recentTransactions: [],
    networkHealth: { lastBlock: "Live", blockReward: "Solana Network Active" },
    recentVolume: 'Low' as const,
    holderConcentration: 'Medium' as const,
    mintFunction: 'N/A',
    freezable: 'N/A',
    taxBuy: '0%',
    taxSell: '0%'
  };

  try {
    const supplyRes = await connection.getTokenSupply(pubkey);
    dynamicData.totalSupply = supplyRes.value.uiAmount || 0;
    
    // Check Mint and Freeze Authorities and Token-2022 Transfer Fees
    try {
      const accountInfo = await connection.getParsedAccountInfo(pubkey);
      if (accountInfo.value && accountInfo.value.data && 'parsed' in accountInfo.value.data) {
        const info = (accountInfo.value.data as any).parsed.info;
        dynamicData.mintFunction = info.mintAuthority ? 'Enabled' : 'Disabled';
        dynamicData.freezable = info.freezeAuthority ? 'Yes' : 'No';
        
        // Token-2022 Transfer Fees
        if (info.extensions) {
          const feeConfig = info.extensions.find((e: any) => e.extension === 'transferFeeConfig');
          if (feeConfig && feeConfig.state && feeConfig.state.newerTransferFee) {
            const basisPoints = feeConfig.state.newerTransferFee.transferFeeBasisPoints;
            const percentage = (basisPoints / 100).toFixed(1) + "%";
            dynamicData.taxBuy = percentage;
            dynamicData.taxSell = percentage;
          }
        }
      }
    } catch(e: any) {
      console.warn(`[SOLANA] ⚠️ Could not fetch authorities: ${e.message}`);
    }

    const block = await connection.getSlot();
    dynamicData.networkHealth.lastBlock = block.toString();
    
    // Fetch signatures for transactions
    const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 10 });
    dynamicData.recentTransactions = sigs.map(s => ({
      hash: s.signature.slice(0, 10) + '...',
      fullHash: s.signature,
      from: "...",
      to: "...",
      amount: "N/A",
      rawAmount: 0,
      timestamp: s.blockTime ? new Date(s.blockTime * 1000).toLocaleTimeString() : "N/A",
      type: "Transfer" as const
    }));
    
    dynamicData.recentVolume = sigs.length > 5 ? 'Medium' : 'Low';
    completedSources.push('dynamic_data');
  } catch (e: any) {
    console.warn(`[SOLANA] ⚠️ Dynamic data fetch failed: ${e.message}`);
    failedSources.push('dynamic_data');
  }

  if (staticData) completedSources.push('static_data');

  const combinedData: OnChainData = {
    address,
    tokenName: staticData?.tokenName || "Unknown Solana Token",
    symbol: staticData?.symbol || "???",
    decimals: staticData?.decimals || 9,
    totalSupply: dynamicData.totalSupply,
    contractVerified: true,
    network: "solana",
    recentTransactions: dynamicData.recentTransactions,
    networkHealth: dynamicData.networkHealth,
    recentVolume: dynamicData.recentVolume,
    holderConcentration: dynamicData.holderConcentration,
    securityInfo: null,
    liquidityInfo: marketData,
    taxBuy: dynamicData.taxBuy,
    taxSell: dynamicData.taxSell,
    mintFunction: dynamicData.mintFunction,
    freezable: dynamicData.freezable,
    liquidityLocked: false,
    cacheStatus: isFirstScan ? 'miss' : 'hit',
    cachedAt: staticData?.cachedAt,
    meta: {
      confidence: completedSources.length / (completedSources.length + failedSources.length) || 0,
      failed_sources: failedSources,
      completed_sources: completedSources,
      partial_data: failedSources.length > 0
    }
  };

  return combinedData;
}

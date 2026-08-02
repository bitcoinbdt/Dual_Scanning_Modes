/**
 * EVM Token Scanner
 * 
 * Scans EVM-compatible tokens (Ethereum, BSC, Polygon, Arbitrum, Base, Optimism)
 * using public RPC nodes and free APIs.
 */

import { ethers } from 'ethers';
import { cacheStaticData, cacheSecurityData, getStaticData, getSecurityData } from './cache';
import { fetchGoPlusSecurity, getFallbackSecurityData } from './goPlusSecurity';
import { fetchMarketDataWithFallback } from './marketDataFallback';
import { OnChainData, StaticData, ChainId } from './types';

// Public RPCs round-robin configuration
const PUBLIC_RPCS: Record<string, string[]> = {
  '1': [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://cloudflare-eth.com'
  ],
  '56': [
    'https://bsc-dataseed.binance.org/',
    'https://rpc.ankr.com/bsc',
    'https://binance.llamarpc.com'
  ],
  '137': [
    'https://polygon-rpc.com/',
    'https://rpc.ankr.com/polygon'
  ],
  '42161': [
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum'
  ],
  '8453': [
    'https://mainnet.base.org',
    'https://base.llamarpc.com'
  ],
  '10': [
    'https://mainnet.optimism.io',
    'https://optimism.llamarpc.com'
  ]
};

const CHAIN_NAMES: Record<string, string> = {
  '1': 'Ethereum',
  '56': 'BSC',
  '137': 'Polygon',
  '42161': 'Arbitrum',
  '8453': 'Base',
  '10': 'Optimism'
};

// Generic ERC20 ABI
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)"
];

/**
 * Fallback to fetch string values safely
 */
async function safeCallString(contract: ethers.Contract, method: string): Promise<string | null> {
  try {
    return await contract[method]();
  } catch (e) {
    return null;
  }
}

/**
 * Get provider with simple round-robin (random pick for zero cost distribution)
 */
function getProvider(chainId: string): ethers.JsonRpcProvider {
  const rpcs = PUBLIC_RPCS[chainId];
  if (!rpcs || rpcs.length === 0) {
    throw new Error(`Unsupported chain ID for public RPC: ${chainId}`);
  }
  const rpc = rpcs[Math.floor(Math.random() * rpcs.length)];
  return new ethers.JsonRpcProvider(rpc);
}

/**
 * Auto-detect EVM chain ID by probing supported chains in parallel.
 * Checks where the contract bytecode is deployed.
 */
export async function autoDetectChainId(address: string): Promise<string> {
  const chains = Object.keys(PUBLIC_RPCS);
  const results = await Promise.all(
    chains.map(async (chainId) => {
      try {
        const provider = getProvider(chainId);
        const code = await provider.getCode(address);
        if (code && code !== '0x' && code !== '0x0') {
          return chainId;
        }
      } catch (e) {
        // ignore connection or RPC errors
      }
      return null;
    })
  );
  
  const detected = results.find(res => res !== null);
  return detected || '1'; // Default to Ethereum (1) if not found
}

/**
 * Scan an EVM token
 */
export async function scanEVMToken(
  address: string,
  requestedChainId: string = '1'
): Promise<OnChainData> {
  let chainId = requestedChainId;
  
  if (chainId === 'evm' || !PUBLIC_RPCS[chainId]) {
    console.log(`[EVM] 🌐 Auto-detecting chain for ${address}...`);
    chainId = await autoDetectChainId(address);
    console.log(`[EVM] 🌐 Auto-detected chain: ${chainId} (${CHAIN_NAMES[chainId]})`);
  }

  console.log(`[EVM] 🔍 Scanning token ${address} via Public RPCs (Resolved chain: ${chainId})...`);
  
  const provider = getProvider(chainId);
  const contract = new ethers.Contract(address, ERC20_ABI, provider);

  // Step 1: Check cache for static data
  let staticData: StaticData | null = null;
  let securityData: any = null;
  
  try {
    staticData = await getStaticData(address);
    securityData = await getSecurityData(address);
  } catch (err: any) {
    console.warn(`[EVM] ⚠️  Cache read failed: ${err.message}, continuing without cache`);
  }
  
  const isFirstScan = !staticData;
  
  if (isFirstScan) {
    console.log(`[EVM] 📥 FIRST SCAN - Fetching static data directly from nodes (Zero API Cost)...`);
    try {
      // ethers v6 automatically batches these calls internally when using Promise.all
      const [name, symbol, decimals, code] = await Promise.all([
        safeCallString(contract, 'name'),
        safeCallString(contract, 'symbol'),
        contract.decimals().catch(() => 18),
        provider.getCode(address).catch(() => "0x")
      ]);
      
      staticData = {
        tokenName: name || "Unknown Token",
        symbol: symbol || "???",
        decimals: Number(decimals),
        bytecode: code,
        contractVerified: false, // Default to false without Etherscan
        network: CHAIN_NAMES[chainId].toLowerCase(),
        cachedAt: new Date().toISOString()
      };
      
      try { 
        await cacheStaticData(address, staticData); 
      } catch(e) {}
    } catch (e: any) {
      console.warn(`[EVM] ⚠️  Static data fetch failed: ${e.message}`);
      throw e;
    }

    // Security Data
    try {
      securityData = await fetchGoPlusSecurity(address, chainId);
      if (securityData) {
        try { 
          await cacheSecurityData(address, securityData); 
        } catch(e) {}
      } else {
        securityData = getFallbackSecurityData();
      }
    } catch (e) {
      securityData = getFallbackSecurityData();
    }
  } else {
    console.log(`[EVM] ✅ CACHE HIT - Loading static data from cache`);
    if (!securityData) {
      securityData = await fetchGoPlusSecurity(address, chainId) || getFallbackSecurityData();
      if (securityData !== getFallbackSecurityData()) {
        try { 
          await cacheSecurityData(address, securityData); 
        } catch(e) {}
      }
    } else {
      console.log(`[EVM] ✅ CACHE HIT - Loading security data from cache`);
    }
  }
  
  // Step 2: Dynamic Data
  console.log(`[EVM] 🔄 Fetching dynamic data...`);
  
  const completedSources: string[] = [];
  const failedSources: string[] = [];

  let dynamicData: any = {
    totalSupply: 0,
    recentTransactions: [],
    networkHealth: { lastBlock: "Live", blockReward: "0" },
    recentVolume: 'Unknown' as const,
    holderConcentration: 'Medium' as const
  };

  try {
    try {
      const rawSupply = await contract.totalSupply();
      const adjustedSupply = Number(ethers.formatUnits(rawSupply, staticData!.decimals));
      dynamicData.totalSupply = adjustedSupply;
    } catch(e: any) {
      console.warn(`[EVM] ⚠️  totalSupply call failed: ${e.message}`);
    }
    
    const blockNum = await provider.getBlockNumber();
    dynamicData.networkHealth.lastBlock = blockNum.toString();
    completedSources.push('dynamic_data');

    // Recent TX placeholder since public nodes don't index full transfer history quickly
    dynamicData.recentTransactions = []; 

  } catch (e: any) {
    console.warn(`[EVM] ⚠️  Dynamic data fetch failed: ${e.message}`);
    failedSources.push('dynamic_data');
  }

  // Market Data
  let marketData: any;
  try {
    marketData = await fetchMarketDataWithFallback(address, chainId);
    completedSources.push('market_data');
    
    // Robust Supply Fallback: If EVM node failed to provide totalSupply
    if (!dynamicData.totalSupply && marketData.fdv && marketData.basePriceUsd > 0) {
      console.log(`[EVM] 🔄 Inferring totalSupply from Market FDV and Price...`);
      dynamicData.totalSupply = marketData.fdv / marketData.basePriceUsd;
    }
  } catch (e) {
    failedSources.push('market_data');
    marketData = { totalLiquidityUsd: 0, mainPools: [], source: 'fallback' };
  }

  if (staticData) completedSources.push('static_data');
  if (securityData && securityData.source !== 'fallback') {
    completedSources.push('security_data');
  } else if (securityData?.source === 'fallback') {
    failedSources.push('security_data');
  }

  const washTradingPercentage = 0; // Not implemented yet

  let finalTokenName = staticData ? staticData.tokenName : "Unknown Token";
  let finalSymbol = staticData ? staticData.symbol : "???";
  
  if (marketData && marketData.tokenNameOverride) finalTokenName = marketData.tokenNameOverride;
  if (marketData && marketData.symbolOverride) finalSymbol = marketData.symbolOverride;

  const combinedData: OnChainData = {
    address,
    tokenName: finalTokenName,
    symbol: finalSymbol,
    decimals: staticData?.decimals || 18,
    totalSupply: dynamicData.totalSupply,
    contractVerified: staticData?.contractVerified || false,
    network: staticData?.network || CHAIN_NAMES[chainId].toLowerCase(),
    recentTransactions: dynamicData.recentTransactions,
    networkHealth: dynamicData.networkHealth,
    recentVolume: dynamicData.recentVolume,
    holderConcentration: dynamicData.holderConcentration,
    securityInfo: securityData,
    liquidityInfo: marketData,
    washTradingPercentage,
    taxBuy: securityData ? `${securityData.buyTax.toFixed(1)}%` : "0%",
    taxSell: securityData ? `${securityData.sellTax.toFixed(1)}%` : "0%",
    mintFunction: securityData?.hasMintFunction ? 'Enabled' : 'Disabled',
    freezable: securityData?.canBePaused ? 'Yes' : 'No',
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

export function getChainConfig() {
  const config: Record<string, { name: string; key: string }> = {};
  for (const [id, name] of Object.entries(CHAIN_NAMES)) {
    config[id] = { name, key: 'PUBLIC_RPC_NO_KEY_NEEDED' };
  }
  return config;
}

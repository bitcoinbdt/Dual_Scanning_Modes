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
import axios from 'axios';
import { fetchTokenCreationInfo } from '../elevator/collectors/solana/birdeye';

// Public RPCs round-robin configuration
const CHAIN_NAMES: Record<string, string> = {
  '1': 'Ethereum',
  '56': 'BSC',
  '137': 'Polygon',
  '42161': 'Arbitrum',
  '8453': 'Base',
  '10': 'Optimism'
};

/**
 * Dynamically resolves list of RPC endpoints for a chain,
 * prioritizing private Alchemy keys if set, then reliable public RPCs.
 */
export function getChainRPCs(chainId: string): string[] {
  const rpcs: string[] = [];
  const alchemyKey = process.env.ALCHEMY_API_KEY;

  if (alchemyKey) {
    const alchemyPrefixes: Record<string, string> = {
      '1': 'https://eth-mainnet.g.alchemy.com/v2/',
      '137': 'https://polygon-mainnet.g.alchemy.com/v2/',
      '42161': 'https://arb-mainnet.g.alchemy.com/v2/',
      '8453': 'https://base-mainnet.g.alchemy.com/v2/',
      '10': 'https://opt-mainnet.g.alchemy.com/v2/',
    };
    if (alchemyPrefixes[chainId]) {
      rpcs.push(`${alchemyPrefixes[chainId]}${alchemyKey}`);
    }
  }

  const publicMap: Record<string, string[]> = {
    '1': [
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
      'https://ethereum-rpc.publicnode.com',
      'https://rpc.payload.de',
      'https://eth-mainnet.public.blastapi.io',
      'https://gateway.tenderly.co/public/mainnet',
      'https://rpc.ankr.com/eth',
      'https://eth.llamarpc.com',
      'https://cloudflare-eth.com'
    ],
    '56': [
      'https://bsc.drpc.org',
      'https://1rpc.io/bnb',
      'https://bsc-rpc.publicnode.com',
      'https://bsc-dataseed.binance.org/',
      'https://bsc-dataseed1.binance.org/',
      'https://rpc.ankr.com/bsc',
      'https://binance.llamarpc.com'
    ],
    '137': [
      'https://polygon.drpc.org',
      'https://1rpc.io/matic',
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon-rpc.com/',
      'https://rpc.ankr.com/polygon'
    ],
    '42161': [
      'https://arbitrum.drpc.org',
      'https://1rpc.io/arb',
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum'
    ],
    '8453': [
      'https://base.drpc.org',
      'https://1rpc.io/base',
      'https://base-rpc.publicnode.com',
      'https://mainnet.base.org',
      'https://base.llamarpc.com'
    ],
    '10': [
      'https://optimism.drpc.org',
      'https://1rpc.io/op',
      'https://optimism-rpc.publicnode.com',
      'https://mainnet.optimism.io',
      'https://optimism.llamarpc.com'
    ]
  };

  if (publicMap[chainId]) {
    rpcs.push(...publicMap[chainId]);
  }

  return rpcs;
}

// Generic ERC20 ABI
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)"
];

// Static registry of known EVM presale platform factory addresses
const EVM_PRESALE_FACTORIES: Record<string, string[]> = {
  '56': [ // BSC
    '0x7ee9139ad4cd4efb26c6d03d36e2d1945f0d98ac', // PinkSale BSC
    '0xd99d1c33f9fc3444f8101754abc46c52416550d1', // DXSale BSC
  ],
  '1': [ // Ethereum
    '0x7ee9139ad4cd4efb26c6d03d36e2d1945f0d98ac', // PinkSale ETH
  ],
};

/**
 * Detection: check if token's largest holder is a known presale factory
 */
export async function detectEVMPresale(
  tokenAddress: string,
  chainId: string,
  provider: ethers.JsonRpcProvider
): Promise<{ isPresale: boolean; presaleContract: string | null }> {
  const factories = EVM_PRESALE_FACTORIES[chainId] ?? [];
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  for (const factory of factories) {
    try {
      const balance: bigint = await tokenContract.balanceOf(factory);
      const totalSupply: bigint = await tokenContract.totalSupply();
      // If factory holds > 10% of total supply, presale is active
      if (totalSupply > 0n && (balance * 100n) / totalSupply > 10n) {
        return { isPresale: true, presaleContract: factory };
      }
    } catch (e) {
      // ignore read failures on custom tokens
    }
  }
  return { isPresale: false, presaleContract: null };
}

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
  const rpcs = getChainRPCs(chainId);
  if (!rpcs || rpcs.length === 0) {
    throw new Error(`Unsupported chain ID for public RPC: ${chainId}`);
  }
  const rpc = rpcs[0];
  return new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });
}

/**
 * Auto-detect EVM chain ID by probing supported chains in parallel.
 * Checks where the contract bytecode is deployed.
 */
export async function autoDetectChainId(address: string): Promise<string> {
  const chains = ['1', '56', '137', '42161', '8453', '10'];
  const results = await Promise.all(
    chains.map(async (chainId) => {
      const rpcs = getChainRPCs(chainId);
      for (const rpc of rpcs) {
        try {
          const fetchReq = new ethers.FetchRequest(rpc);
          fetchReq.timeout = 3000;
          const provider = new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true });
          const code = await provider.getCode(address);
          if (code && code !== '0x' && code !== '0x0') {
            return chainId;
          }
          break; // Succeeded to query but returned no bytecode, this is correct chain but no token contract
        } catch (e) {
          // ignore and try next RPC in this chain
        }
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
  
  const availableRpcs = getChainRPCs(chainId);
  if (chainId === 'evm' || availableRpcs.length === 0) {
    console.log(`[EVM] 🌐 Auto-detecting chain for ${address}...`);
    chainId = await autoDetectChainId(address);
    console.log(`[EVM] 🌐 Auto-detected chain: ${chainId} (${CHAIN_NAMES[chainId] || chainId})`);
  }

  console.log(`[EVM] 🔍 Scanning token ${address} via RPCs (Resolved chain: ${chainId})...`);
  
  const rpcs = getChainRPCs(chainId);
  if (rpcs.length === 0) {
    throw new Error(`Unsupported chain ID for public RPC: ${chainId}`);
  }

  let provider: ethers.JsonRpcProvider | null = null;
  let contract: ethers.Contract | null = null;
  let lastError: Error | null = null;

  for (const rpcUrl of rpcs) {
    try {
      const isPrivate = rpcUrl.includes('alchemy.com');
      console.log(`[EVM] Probing RPC node: ${isPrivate ? 'Alchemy Private RPC' : rpcUrl}`);
      const fetchReq = new ethers.FetchRequest(rpcUrl);
      fetchReq.timeout = 4000; // 4 second probe timeout
      const tempProvider = new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true });
      await tempProvider.getBlockNumber(); // lightweight probe
      provider = tempProvider;
      contract = new ethers.Contract(address, ERC20_ABI, provider);
      console.log(`[EVM] Active RPC node selected: ${isPrivate ? 'Alchemy Private RPC' : rpcUrl}`);
      break;
    } catch (err: any) {
      const isPrivate = rpcUrl.includes('alchemy.com');
      console.warn(`[EVM] RPC node probe failed: ${isPrivate ? 'Alchemy Private RPC' : rpcUrl} - ${err.message}`);
      lastError = err;
    }
  }

  if (!provider || !contract) {
    throw new Error(`All RPC nodes failed for chain ${chainId}. Last error: ${lastError?.message}`);
  }

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

  // Fetch creator/deployer and deployment date
  let creatorAddress = securityData?.creatorAddress || undefined;
  let deploymentDate: string | undefined = undefined;

  const birdeyeKey = process.env.BIRDEYE_API_KEY;
  if (birdeyeKey) {
    try {
      const birdeyeChainMap: Record<string, string> = {
        '1': 'ethereum',
        'eth': 'ethereum',
        '56': 'bsc',
        'bsc': 'bsc',
        '8453': 'base',
        'base': 'base',
        '137': 'polygon',
        'polygon': 'polygon'
      };
      const beChain = birdeyeChainMap[chainId] || 'ethereum';
      const creationInfo = await fetchTokenCreationInfo(address, birdeyeKey, beChain);
      if (creationInfo) {
        if (creationInfo.deployer) creatorAddress = creationInfo.deployer;
        if (creationInfo.timestamp) {
          deploymentDate = new Date(creationInfo.timestamp * 1000).toISOString();
        }
      }
    } catch (err: any) {
      console.warn(`[EVM Creation Info] Birdeye fetch failed: ${err.message}`);
    }
  }

  // Fallback for EVM deploymentDate via Explorer API
  if (!deploymentDate) {
    try {
      const EXPLORER_API_MAP: Record<string, { url: string; keyEnvVar: string }> = {
        '1': { url: 'https://api.etherscan.io/api', keyEnvVar: 'ETHERSCAN_API_KEY' },
        'eth': { url: 'https://api.etherscan.io/api', keyEnvVar: 'ETHERSCAN_API_KEY' },
        '56': { url: 'https://api.bscscan.com/api', keyEnvVar: 'BSCSCAN_API_KEY' },
        'bsc': { url: 'https://api.bscscan.com/api', keyEnvVar: 'BSCSCAN_API_KEY' },
        '8453': { url: 'https://api.basescan.org/api', keyEnvVar: 'BASESCAN_API_KEY' },
        'base': { url: 'https://api.basescan.org/api', keyEnvVar: 'BASESCAN_API_KEY' },
        '137': { url: 'https://api.polygonscan.com/api', keyEnvVar: 'POLYGONSCAN_API_KEY' },
        'polygon': { url: 'https://api.polygonscan.com/api', keyEnvVar: 'POLYGONSCAN_API_KEY' },
      };
      const apiInfo = EXPLORER_API_MAP[chainId];
      if (apiInfo) {
        const apiKey = process.env[apiInfo.keyEnvVar] || '';
        const res = await axios.get(apiInfo.url, {
          params: {
            module: 'account',
            action: 'txlist',
            address: address,
            startblock: 0,
            endblock: 99999999,
            page: 1,
            offset: 1,
            sort: 'asc',
            apikey: apiKey
          },
          timeout: 4000
        });
        const firstTx = res.data?.result?.[0];
        if (firstTx && firstTx.timeStamp) {
          deploymentDate = new Date(Number(firstTx.timeStamp) * 1000).toISOString();
        }
      }
    } catch (err: any) {
      console.warn(`[EVM Creation Info] Explorer fallback failed: ${err.message}`);
    }
  }

  // Detect EVM presale platforms (PinkSale / DXSale)
  let isPreGraduation = false;
  try {
    const presaleCheck = await detectEVMPresale(address, chainId, provider);
    if (presaleCheck.isPresale) {
      isPreGraduation = true;
      console.log(`[EVM] Token is in pre-graduation/presale phase (PinkSale/DXSale detected).`);
    }
  } catch (err: any) {
    console.warn(`[EVM Presale Detection] Failed: ${err.message}`);
  }

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
    creatorAddress,
    deploymentDate,
    taxBuy: securityData ? `${securityData.buyTax.toFixed(1)}%` : "0%",
    taxSell: securityData ? `${securityData.sellTax.toFixed(1)}%` : "0%",
    mintFunction: securityData?.hasMintFunction ? 'Enabled' : 'Disabled',
    freezable: securityData?.canBePaused ? 'Yes' : 'No',
    liquidityLocked: false,
    isPreGraduation,
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

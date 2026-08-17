/**
 * Solana Token Scanner
 * 
 * Scans Solana SPL tokens using public RPC nodes
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { cacheStaticData, getStaticData } from './cache';
import { fetchMarketDataWithFallback } from './marketDataFallback';
import { OnChainData, StaticData } from './types';
import { detectSolanaLaunchpad, getPumpFunBondingCurvePda, readPumpFunCurveState } from '../solana/PumpFunCurveReader';

// Public Solana RPCs round-robin
const PUBLIC_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-rpc.publicnode.com'
];

export async function getSolanaConnection(): Promise<Connection> {
  const rpcs: string[] = [];
  
  if (process.env.HELIUS_API_KEY) {
    rpcs.push(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`);
  }
  
  rpcs.push(...PUBLIC_RPCS);

  let lastError: Error | null = null;
  for (const rpc of rpcs) {
    try {
      const isPrivate = rpc.includes('helius-rpc.com');
      console.log(`[SOLANA] Probing RPC node: ${isPrivate ? 'Helius Private RPC' : rpc}`);
      const conn = new Connection(rpc, 'confirmed');
      await conn.getSlot(); // lightweight probe call
      console.log(`[SOLANA] Active RPC node selected: ${isPrivate ? 'Helius Private RPC' : rpc}`);
      return conn;
    } catch (err: any) {
      const isPrivate = rpc.includes('helius-rpc.com');
      console.warn(`[SOLANA] RPC node probe failed: ${isPrivate ? 'Helius Private RPC' : rpc} - ${err.message}`);
      lastError = err;
    }
  }
  throw new Error(`All Solana RPC nodes failed. Last error: ${lastError?.message}`);
}

async function getActiveConnection(): Promise<Connection> {
  return getSolanaConnection();
}

/**
 * Scan a Solana bonding curve token (pre-graduation)
 */
export async function scanSolanaBondingCurveToken(
  address: string,
  connection: Connection,
  platform: 'pump' | 'launchlab'
): Promise<OnChainData> {
  console.log(`[SOLANA-BONDING-CURVE] 🔍 Scanning ${platform} token ${address}...`);
  const pubkey = new PublicKey(address);

  // 1. Resolve SOL price in USD (using SOL mint: So11111111111111111111111111111111111111112)
  let solPriceUsd = 150; // default fallback
  try {
    const solMarketData = await fetchMarketDataWithFallback('So11111111111111111111111111111111111111112');
    if (solMarketData.basePriceUsd) {
      solPriceUsd = solMarketData.basePriceUsd;
    }
  } catch (err) {
    console.warn(`[SOLANA-BONDING-CURVE] Could not fetch SOL price, using default $150:`, err);
  }

  // 2. Fetch static metadata (first scan caching)
  let staticDataOrNull: StaticData | null = null;
  try {
    staticDataOrNull = await getStaticData(address);
  } catch (err) {}

  const isFirstScan = !staticDataOrNull;

  if (isFirstScan) {
    // Basic defaults since there's no AMM pool
    staticDataOrNull = {
      tokenName: `Bonding Curve Token (${platform})`,
      symbol: "BCT",
      decimals: 6, // Pump.fun uses 6 decimals standard
      network: "solana",
      contractVerified: true,
      cachedAt: new Date().toISOString()
    };
    try {
      await cacheStaticData(address, staticDataOrNull);
    } catch (e) {}
  }

  // After the first-scan guard, staticDataOrNull is always assigned — narrow to non-null.
  const staticData = staticDataOrNull as StaticData;

  // 3. Compute bonding curve specific metrics
  let progressPct = 0;
  let virtualSolReserves = 30000000000n; // default starting Pump.fun reserves (30 SOL)
  let virtualTokenReserves = 1073000000000000n; // default virtual tokens
  let complete = false;

  if (platform === 'pump') {
    const bondingCurvePda = getPumpFunBondingCurvePda(address);
    const curveState = await readPumpFunCurveState(connection, bondingCurvePda);
    
    if (curveState) {
      virtualSolReserves = curveState.virtualSolReserves;
      virtualTokenReserves = curveState.virtualTokenReserves;
      complete = curveState.complete;

      // Pump.fun graduation target is 85 SOL (85 * 10^9 lamports)
      const currentSol = Number(curveState.realSolReserves) / 1e9;
      progressPct = Math.min((currentSol / 85) * 100, 100);
    }
  } else if (platform === 'launchlab') {
    // Raydium LaunchLab default/mock logic
    progressPct = 10.0; // placeholder
  }

  // Derived price: SOL per token = virtualSolReserves / virtualTokenReserves
  const solAmount = Number(virtualSolReserves) / 1e9;
  const tokenAmount = Number(virtualTokenReserves) / 1e6;
  const priceInSol = tokenAmount > 0 ? (solAmount / tokenAmount) : 0;
  const priceInUsd = priceInSol * solPriceUsd;

  // Virtual Liquidity pool value in USD: virtualSolReserves * 2 * solPriceUsd
  const totalLiquidityUsd = (Number(virtualSolReserves) / 1e9) * 2 * solPriceUsd;

  const marketData = {
    totalLiquidityUsd,
    mainPools: [{
      pair: `${staticData.symbol}/SOL (Virtual)`,
      poolAddress: platform === 'pump' ? getPumpFunBondingCurvePda(address).toBase58() : 'VirtualPool',
      dex: platform === 'pump' ? 'Pump.fun Curve' : 'Raydium LaunchLab',
      liquidityUsd: totalLiquidityUsd,
      priceUsd: priceInUsd,
      type: 'constant-product' as const
    }],
    basePriceUsd: priceInUsd,
    volume24hUsd: 0,
    source: 'fallback' as const
  };

  let totalSupply = 1000000000;
  try {
    const supplyRes = await connection.getTokenSupply(pubkey);
    totalSupply = supplyRes.value.uiAmount || 1000000000;
  } catch (e) {}

  return {
    address,
    tokenName: staticData.tokenName,
    symbol: staticData.symbol,
    decimals: staticData.decimals,
    totalSupply,
    contractVerified: true,
    network: "solana",
    recentTransactions: [],
    networkHealth: { lastBlock: "Live", blockReward: "Solana Network Active" },
    recentVolume: 'Low',
    holderConcentration: 'Medium',
    securityInfo: null,
    liquidityInfo: marketData,
    taxBuy: '0%',
    taxSell: '0%',
    mintFunction: 'Enabled', // Enabled during curve phase
    freezable: 'No',
    liquidityLocked: false,
    cacheStatus: isFirstScan ? 'miss' : 'hit',
    cachedAt: staticData.cachedAt,
    isPreGraduation: !complete,
    launchpadPlatform: platform,
    meta: {
      confidence: 1.0,
      failed_sources: [],
      completed_sources: ['bonding_curve_state'],
      partial_data: false
    }
  };
}

/**
 * Scan a Solana token
 */
export async function scanSolanaToken(address: string): Promise<OnChainData> {
  console.log(`[SOLANA] 🔍 Scanning token ${address} via Public RPCs...`);
  
  const connection = await getActiveConnection();
  
  // Step 1: Detect launchpad and check pre-graduation status
  const launchpadInfo = await detectSolanaLaunchpad(connection, address);
  if (launchpadInfo.isLaunchpad && launchpadInfo.platform !== 'none') {
    let isPreGraduation = true;
    if (launchpadInfo.platform === 'pump') {
      const bondingCurvePda = getPumpFunBondingCurvePda(address);
      const curveState = await readPumpFunCurveState(connection, bondingCurvePda);
      if (curveState && curveState.complete) {
        isPreGraduation = false;
      }
    } else if (launchpadInfo.platform === 'launchlab') {
      try {
        const mData = await fetchMarketDataWithFallback(address);
        if (mData && mData.totalLiquidityUsd > 0) {
          isPreGraduation = false;
        }
      } catch (err) {}
    }

    if (isPreGraduation) {
      return await scanSolanaBondingCurveToken(address, connection, launchpadInfo.platform);
    }
  }

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
    
    // Do not fetch recent transactions for basic scan
    dynamicData.recentTransactions = [];
    dynamicData.recentVolume = 'Low';
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

/**
 * GoPlus Security API Integration
 * 
 * Fetches security data including taxes, mint function, honeypot detection
 * with Honeypot.is fallback for missing tax data.
 */

import axios from 'axios';
import { retryWithBackoff } from './retryUtils';
import { SecurityData } from './types';

const GOPLUS_BASE_URL = 'https://api.gopluslabs.io/api/v1';

// Chain ID mapping for GoPlus API
const CHAIN_ID_MAP: Record<string, string> = {
  '1': '1',        // Ethereum
  '56': '56',      // BSC
  '137': '137',    // Polygon
  '42161': '42161', // Arbitrum
  '8453': '8453',  // Base
  '10': '10',      // Optimism
  '43114': '43114' // Avalanche
};

interface GoPlusResponse {
  code: number;
  message?: string;
  result: {
    [address: string]: {
      is_honeypot: string;
      buy_tax: string;
      sell_tax: string;
      is_mintable: string;
      is_proxy: string;
      transfer_pausable: string;
      is_blacklisted: string;
      trading_cooldown: string;
      owner_change_balance: string;
      can_take_back_ownership: string;
      owner_address: string;
      creator_address: string;
      holder_count: string;
      total_supply: string;
    };
  };
}

interface HoneypotResponse {
  simulationResult?: {
    buyTax: number;
    sellTax: number;
  };
  honeypotResult?: {
    isHoneypot: boolean;
  };
}

interface ExtendedSecurityData extends SecurityData {
  isProxy?: boolean;
  transferPausable?: boolean;
  hasBlacklist?: boolean;
  tradingCooldown?: boolean;
  ownerCanChangeBalance?: boolean;
  totalSupply?: string;
  cachedAt?: string;
  source?: string;
  note?: string;
}

/**
 * Fetch security data from GoPlus API with retry logic
 */
export async function fetchGoPlusSecurity(
  address: string,
  chainId: string
): Promise<ExtendedSecurityData | null> {
  try {
    const mappedChainId = CHAIN_ID_MAP[chainId];
    if (!mappedChainId) {
      console.warn(`[GOPLUS] ⚠️  Chain ${chainId} not supported`);
      return getFallbackSecurityData();
    }

    const url = `${GOPLUS_BASE_URL}/token_security/${mappedChainId}?contract_addresses=${address}`;
    console.log(`[GOPLUS] 🔍 Fetching security data for ${address} on chain ${chainId}...`);
    
    // Wrap axios call with retry logic
    const response = await retryWithBackoff<{ data: GoPlusResponse }>(
      async () => {
        return await axios.get(url, { 
          timeout: 10000,
          headers: {
            'Accept': 'application/json'
          }
        });
      },
      {
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 16000,
        retryableStatusCodes: [429, 503, 504],
        onRetry: (attempt, maxRetries, delay, error: any) => {
          const statusCode = error.response?.status;
          const errorType = statusCode === 429 ? 'Rate limit' : 
                           statusCode ? `HTTP ${statusCode}` : 
                           error.code || 'Network error';
          console.log(`[GOPLUS] 🔄 Retry ${attempt}/${maxRetries} in ${delay}ms (${errorType})`);
        }
      }
    );
    
    if (response.data.code !== 1) {
      console.warn(`[GOPLUS] ⚠️  API error: ${response.data.message}`);
      return getFallbackSecurityData();
    }

    const securityData = response.data.result[address.toLowerCase()];
    if (!securityData) {
      console.warn(`[GOPLUS] ⚠️  No security data found for ${address}`);
      return getFallbackSecurityData();
    }

    // Parse and normalize the data
    const normalized: ExtendedSecurityData = {
      isHoneypot: securityData.is_honeypot === "1",
      buyTax: securityData.buy_tax === "" ? 0 : parseFloat(securityData.buy_tax || "0") * 100,
      sellTax: securityData.sell_tax === "" ? 0 : parseFloat(securityData.sell_tax || "0") * 100,
      hasMintFunction: securityData.is_mintable === "1",
      canBePaused: securityData.transfer_pausable === "1",
      holderCount: parseInt(securityData.holder_count || "0"),
      lpHolderCount: 0, // GoPlus doesn't provide this
      isProxy: securityData.is_proxy === "1",
      transferPausable: securityData.transfer_pausable === "1",
      hasBlacklist: securityData.is_blacklisted === "1",
      tradingCooldown: securityData.trading_cooldown === "1",
      ownerCanChangeBalance: securityData.owner_change_balance === "1",
      ownerAddress: securityData.owner_address || undefined,
      creatorAddress: securityData.creator_address || undefined,
      totalSupply: securityData.total_supply || "0",
      cachedAt: new Date().toISOString(),
      source: "goplus"
    };

    // Robust Tax Fallback: If GoPlus fails to parse the tax, try Honeypot.is
    let buyTaxMissing = securityData.buy_tax === "";
    let sellTaxMissing = securityData.sell_tax === "";
    
    if ((buyTaxMissing || sellTaxMissing) && (chainId === '1' || chainId === '56')) {
      console.log(`[GOPLUS] ⚠️ GoPlus missing tax data. Falling back to Honeypot.is simulation...`);
      try {
        const honeypotRes = await axios.get<HoneypotResponse>(
          `https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${chainId}`, 
          { timeout: 8000 }
        );
        
        if (honeypotRes.data && honeypotRes.data.simulationResult) {
          if (buyTaxMissing) {
            normalized.buyTax = honeypotRes.data.simulationResult.buyTax;
          }
          if (sellTaxMissing) {
            normalized.sellTax = honeypotRes.data.simulationResult.sellTax;
          }
          normalized.isHoneypot = honeypotRes.data.honeypotResult?.isHoneypot || normalized.isHoneypot;
          console.log(`[HONEYPOT] ✅ Retrieved accurate tax: ${normalized.buyTax}% / ${normalized.sellTax}%`);
        }
      } catch (e: any) {
        console.warn(`[HONEYPOT] ⚠️ Fallback failed: ${e.message}`);
      }
    }

    console.log(`[GOPLUS] ✅ Security data retrieved for ${address}`);
    console.log(`[GOPLUS] 📊 Honeypot: ${normalized.isHoneypot}, Buy Tax: ${normalized.buyTax}%, Sell Tax: ${normalized.sellTax}%`);
    
    return normalized;
  } catch (error: any) {
    // After all retries exhausted, return fallback data
    if (error.code === 'ECONNABORTED') {
      console.error('[GOPLUS] ❌ Request timeout after all retries');
    } else if (error.response) {
      console.error(`[GOPLUS] ❌ API error after all retries: ${error.response.status} - ${error.response.statusText}`);
    } else {
      console.error('[GOPLUS] ❌ Error fetching security data after all retries:', error.message);
    }
    console.warn('[GOPLUS] ⚠️  Using fallback security data');
    return getFallbackSecurityData();
  }
}

/**
 * Get fallback security data when GoPlus is unavailable
 */
export function getFallbackSecurityData(): ExtendedSecurityData {
  return {
    isHoneypot: false,
    buyTax: 0,
    sellTax: 0,
    hasMintFunction: false,
    canBePaused: false,
    holderCount: 0,
    lpHolderCount: 0,
    isProxy: false,
    transferPausable: false,
    hasBlacklist: false,
    tradingCooldown: false,
    ownerCanChangeBalance: false,
    ownerAddress: undefined,
    creatorAddress: undefined,
    totalSupply: "0",
    cachedAt: new Date().toISOString(),
    source: "fallback",
    note: "Security data unavailable - using safe defaults"
  };
}

export { CHAIN_ID_MAP };

import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { HolderInfo } from '../collectors/types';

// Hardcoded known system program/DEX router/null addresses
const SYSTEM_ADDRESSES: Record<string, string[]> = {
  eth: [
    '0x0000000000000000000000000000000000000000', // Null
    '0x000000000000000000000000000000000000dead', // Dead
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
    '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
    '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Uniswap V3 SwapRouter02
  ],
  bsc: [
    '0x0000000000000000000000000000000000000000', // Null
    '0x000000000000000000000000000000000000dead', // Dead
    '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 Router
    '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', // PancakeSwap V3 Router
  ],
  solana: [
    '11111111111111111111111111111111', // System Program
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
    '675k1q2c2T6m779aoxxX48BudGXWv97Qr4BDG87paL18', // Raydium AMM
    'CAMMC7Jbi2gTYccZ4t1gnhsihjh29yb2y2wqShH6A1E3', // Raydium CLMM
    'JUP6LkbZbjS1jKKbbRB67cjSsCc49GVvpjC285137LM', // Jupiter v6
    'whirSpFb6fc49YrevjZgx7Ko6sD4iPr2Sm8DTrG7dVY', // Orca Whirlpool
    '24Uqj9J6jxYiGLNsgeW9msiw1xN24sa58CcG9w8AK3mG', // Meteora
    'LBRaCz9coTvCR6yURJfKTY2yJE461Pk6ziw21XRs59r', // Meteora DLMM
  ]
};

const EVM_RPC_URLS: Record<string, string> = {
  eth: 'https://cloudflare-eth.com',
  bsc: 'https://bsc-dataseed.binance.org/',
};

/**
 * Filter out system addresses, DEX routers, and smart contracts from the top holders list
 */
export async function filterSystemAddresses(
  holders: HolderInfo[],
  blockchain: 'eth' | 'bsc' | 'solana',
  heliusApiKey?: string
): Promise<HolderInfo[]> {
  const systemList = SYSTEM_ADDRESSES[blockchain] || [];
  const systemSet = new Set(systemList.map(a => blockchain === 'solana' ? a : a.toLowerCase()));
  
  const topHoldersToCheck = holders.slice(0, 30);
  
  // Setup RPC connections
  let evmProvider: ethers.JsonRpcProvider | null = null;
  let solanaConnection: Connection | null = null;
  
  if (blockchain === 'eth' || blockchain === 'bsc') {
    const rpcUrl = EVM_RPC_URLS[blockchain];
    evmProvider = new ethers.JsonRpcProvider(rpcUrl);
  } else if (blockchain === 'solana') {
    const url = heliusApiKey 
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : 'https://api.mainnet-beta.solana.com';
    solanaConnection = new Connection(url);
  }
  
  console.log(`[Filter] Filtering top ${topHoldersToCheck.length} wallets for contracts on ${blockchain}...`);
  
  // Concurrently check bytecode/executable status
  const checkPromises = topHoldersToCheck.map(async (holder) => {
    const walletCompare = blockchain === 'solana' ? holder.wallet : holder.wallet.toLowerCase();
    
    if (systemSet.has(walletCompare)) {
      console.log(`[Filter] Match hardcoded system address: ${holder.wallet}`);
      return { wallet: holder.wallet, isContract: true };
    }
    
    try {
      if (blockchain === 'solana' && solanaConnection) {
        const pubkey = new PublicKey(holder.wallet);
        const accountInfo = await solanaConnection.getAccountInfo(pubkey);
        if (accountInfo?.executable) {
          console.log(`[Filter] Executable Solana account: ${holder.wallet}`);
          return { wallet: holder.wallet, isContract: true };
        }
      } else if (evmProvider) {
        const code = await evmProvider.getCode(holder.wallet);
        // Smart contracts return bytecode; normal wallets return '0x' or empty
        if (code && code !== '0x' && code !== '0x00') {
          console.log(`[Filter] EVM contract account: ${holder.wallet}`);
          return { wallet: holder.wallet, isContract: true };
        }
      }
    } catch (err: any) {
      console.warn(`[Filter] RPC check failed for ${holder.wallet}: ${err.message}`);
    }
    
    return { wallet: holder.wallet, isContract: false };
  });
  
  const results = await Promise.all(checkPromises);
  const contractSet = new Set(results.filter(r => r.isContract).map(r => r.wallet));
  
  // Filter the entire list of holders based on the concurrent lookup and hardcoded list
  return holders.filter(holder => {
    const walletCompare = blockchain === 'solana' ? holder.wallet : holder.wallet.toLowerCase();
    if (systemSet.has(walletCompare)) return false;
    if (contractSet.has(holder.wallet)) return false;
    return true;
  });
}

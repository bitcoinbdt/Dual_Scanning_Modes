import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';

export interface PoolReserves {
  baseReserve: bigint;
  quoteReserve: bigint;
  source: 'api' | 'rpc_vaults';
}

export class RaydiumPoolReader {
  /**
   * Fetch Raydium AMM V4 or CPMM pool reserves without importing Raydium SDK
   */
  static async getPoolReserves(
    poolAddress: string,
    connection: Connection
  ): Promise<PoolReserves | null> {
    // 1. Try Raydium public REST API (Approach A)
    try {
      console.log(`[RAYDIUM-READER] Querying Raydium API for pool ${poolAddress}...`);
      const response = await axios.get(
        `https://api-v3.raydium.io/pools/info/ids?ids=${poolAddress}`,
        { timeout: 1500 }
      );
      
      const data = response.data?.data?.[0];
      if (data) {
        // Find pool reserves in returned payload
        // API v3 usually returns reserves directly as strings
        const baseReserveStr = data.mintAmountA || data.baseReserve || data.reserveA;
        const quoteReserveStr = data.mintAmountB || data.quoteReserve || data.reserveB;

        if (baseReserveStr !== undefined && quoteReserveStr !== undefined) {
          const decimalsA = data.mintDecimalsA || 6;
          const decimalsB = data.mintDecimalsB || 9;
          
          const baseReserve = BigInt(Math.round(Number(baseReserveStr) * Math.pow(10, decimalsA)));
          const quoteReserve = BigInt(Math.round(Number(quoteReserveStr) * Math.pow(10, decimalsB)));
          
          return {
            baseReserve,
            quoteReserve,
            source: 'api'
          };
        }
      }
    } catch (err: any) {
      console.warn(`[RAYDIUM-READER] Raydium API request failed: ${err.message}. Falling back to RPC...`);
    }

    // 2. Fallback to reading pool account and vaults directly via RPC (Approach B)
    try {
      console.log(`[RAYDIUM-READER] Querying Solana RPC for pool account info...`);
      const pubkey = new PublicKey(poolAddress);
      const accInfo = await connection.getAccountInfo(pubkey);

      if (accInfo && accInfo.data) {
        const buffer = accInfo.data;
        // Raydium V4 AMM layout: coinVault at offset 336 (32 bytes), pcVault at offset 368 (32 bytes)
        if (buffer.length >= 400) {
          const coinVaultPubkey = new PublicKey(buffer.slice(336, 368));
          const pcVaultPubkey = new PublicKey(buffer.slice(368, 400));

          console.log(`[RAYDIUM-READER] Found coinVault: ${coinVaultPubkey.toBase58()}, pcVault: ${pcVaultPubkey.toBase58()}`);
          
          const [coinBalanceRes, pcBalanceRes] = await Promise.all([
            connection.getTokenAccountBalance(coinVaultPubkey),
            connection.getTokenAccountBalance(pcVaultPubkey)
          ]);

          const baseReserve = BigInt(coinBalanceRes.value.amount);
          const quoteReserve = BigInt(pcBalanceRes.value.amount);

          return {
            baseReserve,
            quoteReserve,
            source: 'rpc_vaults'
          };
        }
      }
    } catch (err: any) {
      console.warn(`[RAYDIUM-READER] Solana RPC vault balance check failed:`, err.message);
    }

    return null;
  }
}

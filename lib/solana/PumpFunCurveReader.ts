import { Connection, PublicKey } from '@solana/web3.js';

export const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const RAYDIUM_LAUNCHLAB_PROGRAM_ID = 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj';

export interface BondingCurveState {
  virtualTokenReserves: bigint;  // Tokens available in virtual AMM
  virtualSolReserves: bigint;    // SOL in virtual AMM (determines price)
  realTokenReserves: bigint;     // Actual tokens held by the curve
  realSolReserves: bigint;       // Actual SOL deposited by buyers
  tokenTotalSupply: bigint;      // Total token supply
  complete: boolean;             // true = graduated to Raydium
}

/**
 * Detects if a Solana token is a launchpad token
 */
// FIX-3.8: Check bonding curve PDA account existence and owner matching PUMP_FUN_PROGRAM_ID
export async function detectSolanaLaunchpad(
  connection: Connection,
  mintAddress: string
): Promise<{ isLaunchpad: boolean; platform: 'pump' | 'launchlab' | 'none' }> {
  try {
    const mintPubKey = new PublicKey(mintAddress);

    // 1. Check Pump.fun bonding curve PDA existence and owner
    try {
      const pda = getPumpFunBondingCurvePda(mintAddress);
      const curveAccount = await connection.getAccountInfo(pda);
      if (curveAccount && curveAccount.owner.toBase58() === PUMP_FUN_PROGRAM_ID) {
        return { isLaunchpad: true, platform: 'pump' };
      }
    } catch {
      // Ignore PDA derivation/lookup errors and fallback to authority check
    }

    // 2. Check mint authorities (fallback or Raydium LaunchLab)
    const accountInfo = await connection.getParsedAccountInfo(mintPubKey);
    
    const parsedData = (accountInfo.value?.data as any)?.parsed?.info;
    if (!parsedData) {
      return { isLaunchpad: false, platform: 'none' };
    }

    const mintAuthority = parsedData.mintAuthority;
    const freezeAuthority = parsedData.freezeAuthority;

    // Pre-graduation: Mint authority or freeze authority matches Pump.fun
    if (mintAuthority === PUMP_FUN_PROGRAM_ID || freezeAuthority === PUMP_FUN_PROGRAM_ID) {
      return { isLaunchpad: true, platform: 'pump' };
    }

    // Same check for Raydium LaunchLab
    if (mintAuthority === RAYDIUM_LAUNCHLAB_PROGRAM_ID) {
      return { isLaunchpad: true, platform: 'launchlab' };
    }

    return { isLaunchpad: false, platform: 'none' };
  } catch (error) {
    console.error('[LAUNCHPAD-DETECTION] Error:', error);
    return { isLaunchpad: false, platform: 'none' };
  }
}

/**
 * Derives the bonding curve PDA for a Pump.fun token
 */
// FIX-3.11: Seed 'bonding-curve' verified
export function getPumpFunBondingCurvePda(mintAddress: string): PublicKey {
  const mintPubKey = new PublicKey(mintAddress);
  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mintPubKey.toBuffer()],
    new PublicKey(PUMP_FUN_PROGRAM_ID)
  );
  return bondingCurvePda;
}

/**
 * Reads the Pump.fun curve state from the blockchain
 */
export async function readPumpFunCurveState(
  connection: Connection,
  bondingCurvePda: PublicKey
): Promise<BondingCurveState | null> {
  try {
    const accountInfo = await connection.getAccountInfo(bondingCurvePda);
    if (!accountInfo?.data) return null;

    const data = accountInfo.data;
    // FIX-3.11: Guard for minimum buffer length (8-byte discriminator + 40 bytes data + 1 byte bool = 49 bytes)
    if (data.length < 49) {
      console.warn(`[CURVE-READER] Insufficient buffer length: ${data.length} < 49`);
      return null;
    }

    const offset = 8; // Skip 8-byte discriminator
    return {
      virtualTokenReserves: data.readBigUInt64LE(offset),
      virtualSolReserves:   data.readBigUInt64LE(offset + 8),
      realTokenReserves:    data.readBigUInt64LE(offset + 16),
      realSolReserves:      data.readBigUInt64LE(offset + 24),
      tokenTotalSupply:     data.readBigUInt64LE(offset + 32),
      complete:             data[offset + 40] === 1,
    };
  } catch (error) {
    console.error('[CURVE-READER] Error reading Pump.fun curve state:', error);
    return null;
  }
}

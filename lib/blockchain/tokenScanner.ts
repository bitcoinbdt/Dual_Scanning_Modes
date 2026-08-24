/**
 * Main Token Scanner - Orchestrates EVM and Solana scanners
 * 
 * This is the main entry point for scanning tokens.
 * It detects the network type and delegates to the appropriate scanner.
 */

import { scanEVMToken } from './evmScanner';
import { scanSolanaToken } from './solanaScanner';
import { ScanResult, AddressValidation } from './types';

/**
 * Main token scanner - orchestrates EVM and Solana scanners
 */
export async function scanToken(address: string, chainId: string = '1'): Promise<ScanResult> {
  console.log('='.repeat(60));
  console.log(`[SCANNER] 🚀 Starting scan for ${address}`);
  console.log(`[SCANNER] 📊 Chain: ${chainId}`);
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Step 1: Detect network (EVM vs Solana)
    const isSolana = detectNetwork(address);
    console.log(`[SCANNER] 🌐 Network detected: ${isSolana ? 'Solana' : 'EVM'}`);
    
    // Step 2: Scan token based on network
    let onChainData;
    if (isSolana) {
      onChainData = await scanSolanaToken(address);
    } else {
      onChainData = await scanEVMToken(address, chainId);
    }
    
    // Step 3: Combine results
    const result: ScanResult = {
      success: true,
      data: {
        onChainData,
        metadata: {
          network: isSolana ? 'solana' : 'evm',
          chainId: isSolana ? null : chainId,
          cacheStatus: onChainData.cacheStatus || 'miss',
          scanDuration: Date.now() - startTime,
          isPreGraduation: onChainData.isPreGraduation || false
        }
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('='.repeat(60));
    console.log(`[SCANNER] ✅ Scan completed successfully`);
    console.log(`[SCANNER] ⏱️  Duration: ${result.data.metadata.scanDuration}ms`);
    console.log(`[SCANNER] 💾 Cache: ${result.data.metadata.cacheStatus}`);
    console.log('='.repeat(60));
    
    return result;
  } catch (error: any) {
    console.error('='.repeat(60));
    console.error(`[SCANNER] ❌ Scan failed: ${error.message}`);
    console.error(`[SCANNER] ❌ Error stack:`, error.stack);
    console.error(`[SCANNER] ❌ Error type:`, error.constructor.name);
    console.error('='.repeat(60));
    
    throw error;
  }
}

export function detectNetwork(address: string): boolean {
  const cleaned = address.trim().toLowerCase();
  // EVM addresses start with 0x and are 42 characters
  if (cleaned.startsWith('0x') && cleaned.length === 42) {
    return false; // EVM
  }
  
  // Solana addresses are base58 encoded, 32-44 characters, no 0x prefix
  if (!cleaned.startsWith('0x') && cleaned.length >= 32 && cleaned.length <= 44) {
    return true; // Solana
  }
  
  throw new Error('Invalid address format - must be EVM (0x...) or Solana address');
}

/**
 * Validate address format
 */
export function validateAddress(address: string): AddressValidation {
  if (!address || typeof address !== 'string') {
    return {
      valid: false,
      error: 'Address is required and must be a string'
    };
  }
  
  const trimmed = address.trim();
  
  // Check EVM format
  const isEVM = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  if (isEVM) {
    return {
      valid: true,
      network: 'evm',
      address: trimmed.toLowerCase()
    };
  }
  
  // Check Solana format (base58, 32-44 chars)
  const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
  if (isSolana) {
    return {
      valid: true,
      network: 'solana',
      address: trimmed
    };
  }
  
  return {
    valid: false,
    error: 'Invalid address format - must be EVM (0x...) or Solana address'
  };
}

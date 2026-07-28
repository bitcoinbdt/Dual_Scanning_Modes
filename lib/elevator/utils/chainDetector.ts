/**
 * Chain Detection Utility
 * Detects blockchain network from token address format
 */

export type SupportedChain = 'solana' | 'bsc' | 'eth' | 'unknown';

export interface ChainDetectionResult {
  chain: SupportedChain;
  isValid: boolean;
  format: string;
  message?: string;
}

/**
 * Detect blockchain from address format
 * @param address - Token address to analyze
 * @param preferredChain - Optional hint for EVM addresses ('eth' or 'bsc')
 * @returns Detection result with chain type and validity
 */
export function detectChain(address: string, preferredChain?: 'eth' | 'bsc'): ChainDetectionResult {
  if (!address || typeof address !== 'string') {
    return {
      chain: 'unknown',
      isValid: false,
      format: 'Invalid',
      message: 'Address is required'
    };
  }

  const trimmedAddress = address.trim();

  // Ethereum/BSC format (0x + 40 hexadecimal characters)
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
    // Use preferred chain if specified, otherwise default to BSC for backward compatibility
    const detectedChain = preferredChain === 'eth' ? 'eth' : 'bsc';
    
    return {
      chain: detectedChain,
      isValid: true,
      format: 'EVM (BSC/Ethereum)',
      message: `EVM address detected (${detectedChain.toUpperCase()})`
    };
  }

  // Solana format (base58, 32-44 characters, excluding confusing chars: 0, O, I, l)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedAddress)) {
    return {
      chain: 'solana',
      isValid: true,
      format: 'Solana',
      message: 'Solana address detected'
    };
  }

  // Unknown format
  return {
    chain: 'unknown',
    isValid: false,
    format: 'Unknown',
    message: 'Address does not match any known blockchain format'
  };
}

/**
 * Check if a chain is currently supported for elevator scan
 * @param chain - Chain type to check
 * @returns Whether the chain is supported
 */
export function isChainSupported(chain: SupportedChain): boolean {
  return chain === 'solana' || chain === 'bsc' || chain === 'eth';
}

/**
 * Get helpful error message for unsupported chain
 * @param detection - Chain detection result
 * @returns User-friendly error message
 */
export function getUnsupportedChainMessage(detection: ChainDetectionResult): string {
  if (!detection.isValid) {
    return 'Invalid token address format. Please check the address and try again.';
  }

  // All chains are now supported!
  return `${detection.format} blockchain is supported. Please ensure you have the required API keys configured.`;
}

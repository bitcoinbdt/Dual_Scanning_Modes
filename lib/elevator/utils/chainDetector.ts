/**
 * Chain Detection Utility
 * Detects blockchain network from token address format
 */

export type SupportedChain = 'solana' | 'bsc' | 'eth' | 'unknown';
export type DetectionReason = 'ambiguous_evm' | 'unsupported_format' | undefined;

export interface ChainDetectionResult {
  chain: SupportedChain;
  isValid: boolean;
  format: string;
  message?: string;
  reason?: DetectionReason;
}

/**
 * Detect blockchain from address format
 * @param address - Token address to analyze
 * @param preferredChain - Explicit chain choice by the user ('eth' or 'bsc'). If absent, EVM addresses are treated as ambiguous.
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
    if (preferredChain === 'eth') {
      return {
        chain: 'eth',
        isValid: true,
        format: 'EVM (Ethereum)',
        message: 'EVM address detected (ETH)'
      };
    }
    if (preferredChain === 'bsc') {
      return {
        chain: 'bsc',
        isValid: true,
        format: 'EVM (BSC)',
        message: 'EVM address detected (BSC)'
      };
    }
    // No explicit chain selected — EVM addresses are ambiguous (could be ETH or BSC).
    // Do NOT silently default; require the user to specify.
    return {
      chain: 'unknown',
      isValid: false,
      format: 'EVM (BSC/Ethereum)',
      message: 'EVM address detected. Please select Ethereum or BSC to continue.',
      reason: 'ambiguous_evm'
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
    message: 'Address does not match any known blockchain format',
    reason: 'unsupported_format'
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

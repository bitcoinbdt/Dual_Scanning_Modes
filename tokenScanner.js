const { scanEVMToken } = require('./evmScanner');
const { scanSolanaToken } = require('./solanaScanner');
const { generateAlphaSignal } = require('./api_heuristic');

/**
 * Main token scanner - orchestrates EVM and Solana scanners
 * @param {string} address - Token contract address
 * @param {string} chainId - Optional chain ID for EVM tokens
 * @returns {Promise<Object>} Complete scan result
 */
async function scanToken(address, chainId = '1') {
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
    
    // Step 3: Generate heuristic signal
    const algorithmicSignal = generateAlphaSignal(onChainData, 'Default');
    onChainData.cachedSignals = {
      'Default': {
        signal: algorithmicSignal,
        timestamp: new Date().toISOString()
      }
    };
    
    // Step 4: Combine results
    const result = {
      success: true,
      data: {
        onChainData,
        signal: algorithmicSignal, // Make it easily accessible
        metadata: {
          network: isSolana ? 'solana' : 'evm',
          chainId: isSolana ? null : chainId,
          cacheStatus: onChainData.cacheStatus,
          scanDuration: Date.now() - startTime
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
  } catch (error) {
    console.error('='.repeat(60));
    console.error(`[SCANNER] ❌ Scan failed: ${error.message}`);
    console.error(`[SCANNER] ❌ Error stack:`, error.stack);
    console.error(`[SCANNER] ❌ Error type:`, error.constructor.name);
    console.error('='.repeat(60));
    
    throw error;
  }
}

/**
 * Detect network type from address format
 * @param {string} address - Token address
 * @returns {boolean} True if Solana, false if EVM
 */
function detectNetwork(address) {
  // EVM addresses start with 0x and are 42 characters
  if (address.startsWith('0x') && address.length === 42) {
    return false; // EVM
  }
  
  // Solana addresses are base58 encoded, 32-44 characters, no 0x prefix
  if (!address.startsWith('0x') && address.length >= 32 && address.length <= 44) {
    return true; // Solana
  }
  
  throw new Error('Invalid address format - must be EVM (0x...) or Solana address');
}

/**
 * Validate address format
 * @param {string} address - Token address
 * @returns {Object} Validation result
 */
function validateAddress(address) {
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

module.exports = {
  scanToken,
  detectNetwork,
  validateAddress
};

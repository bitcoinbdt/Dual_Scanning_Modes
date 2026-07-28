/**
 * Logger Usage Examples
 * 
 * This file demonstrates how to use the Logger utility module
 * in the crypto token CLI data collector.
 */

import logger from './Logger.js';

// Example 1: Basic logging at different levels
console.log('\n=== Example 1: Basic Logging ===');
logger.info('Application started');
logger.debug('Debug information');
logger.warn('This is a warning');
logger.error('This is an error');

// Example 2: Setting log level
console.log('\n=== Example 2: Log Level Control ===');
logger.setLevel('ERROR');
logger.info('This will not be shown');
logger.error('Only errors are shown now');

// Reset to INFO
logger.setLevel('INFO');

// Example 3: Context-aware logging for token processing
console.log('\n=== Example 3: Context-Aware Logging ===');
logger.setContext({
  tokenName: 'PEPE',
  tokenAddress: 'So11111111111111111111111111111111111111112'
});
logger.info('Starting token data collection');
logger.info('Fetching OHLCV data');

// Example 4: Adding API endpoint context
console.log('\n=== Example 4: API Context ===');
logger.setContext({ apiEndpoint: '/defi/ohlcv' });
logger.debug('Making API request');
logger.warn('Rate limit approaching', { remaining: 10 });

// Example 5: Logging with metadata
console.log('\n=== Example 5: Metadata Logging ===');
logger.info('Data collection complete', {
  ohlcvRecords: 1440,
  transactions: 1250,
  holders: 187
});

// Example 6: Error logging with context
console.log('\n=== Example 6: Error with Context ===');
logger.error('API request failed', {
  statusCode: 500,
  retryAttempt: 2,
  endpoint: '/defi/ohlcv'
});

// Example 7: Clearing context between tokens
console.log('\n=== Example 7: Context Management ===');
logger.clearContext();
logger.setContext({
  tokenName: 'BONK',
  tokenAddress: '0x1234567890123456789012345678901234567890'
});
logger.info('Processing next token');

// Example 8: Partial context clearing
console.log('\n=== Example 8: Partial Context Clear ===');
logger.setContext({
  tokenName: 'TEST',
  tokenAddress: 'So11111111111111111111111111111111111111112',
  apiEndpoint: '/defi/txs'
});
logger.info('Before clearing endpoint');
logger.clearContext('apiEndpoint');
logger.info('After clearing endpoint');

// Clean up
logger.clearContext();

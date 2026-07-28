/**
 * OHLCVProcessor Usage Example
 * 
 * This example demonstrates how to use the OHLCVProcessor module
 * to fetch and process OHLCV data for a cryptocurrency token.
 */

import OHLCVProcessor from './OHLCVProcessor.js';
import BirdeyeClient from '../api/BirdeyeClient.js';
import RateLimiter from '../core/RateLimiter.js';

// Example usage
async function example() {
  // Initialize dependencies
  const apiKey = process.env.BIRDEYE_API_KEY || 'your-api-key-here';
  const rateLimiter = new RateLimiter(100); // 100ms minimum delay
  const apiClient = new BirdeyeClient(apiKey, rateLimiter);
  
  // Create processor
  const processor = new OHLCVProcessor(apiClient);
  
  // Token details
  const tokenAddress = 'So11111111111111111111111111111111111111112';
  const launchTime = 1704067200; // Jan 1, 2024 00:00:00 UTC
  
  try {
    console.log('Processing OHLCV data...');
    
    // Process OHLCV data for 24-hour window
    const result = await processor.processOHLCV(tokenAddress, launchTime);
    
    // Display results
    console.log('\n=== OHLCV Processing Results ===');
    console.log(`Total Records: ${result.metadata.totalRecords}`);
    console.log(`Real Records: ${result.metadata.realRecords}`);
    console.log(`Synthetic Records: ${result.metadata.syntheticRecords}`);
    console.log(`Missing Intervals: ${result.metadata.missingIntervals}`);
    console.log(`Expected Records: ${result.metadata.expectedRecords}`);
    
    // Display validation results
    console.log('\n=== Data Quality Validation ===');
    console.log(`Chronological Order: ${result.metadata.validation.isChronological ? '✓' : '✗'}`);
    console.log(`Complete Fields: ${result.metadata.validation.hasCompleteFields ? '✓' : '✗'}`);
    console.log(`Price Consistency: ${result.metadata.validation.hasPriceConsistency ? '✓' : '✗'}`);
    
    if (result.metadata.validation.errors.length > 0) {
      console.log(`\nValidation Errors: ${result.metadata.validation.errors.length}`);
      result.metadata.validation.errors.slice(0, 5).forEach(error => {
        console.log(`  - ${error.type}: ${error.message}`);
      });
    }
    
    // Display gaps
    if (result.metadata.gaps.length > 0) {
      console.log('\n=== Detected Gaps (> 300 seconds) ===');
      result.metadata.gaps.forEach(gap => {
        console.log(`  - ${gap.warning}`);
      });
    } else {
      console.log('\n=== No Large Gaps Detected ===');
    }
    
    // Display sample data
    console.log('\n=== Sample OHLCV Records (first 5) ===');
    result.data.slice(0, 5).forEach(record => {
      const type = record.synthetic ? '[SYNTHETIC]' : '[REAL]';
      console.log(`${type} ${new Date(record.timestamp * 1000).toISOString()}`);
      console.log(`  O: ${record.open}, H: ${record.high}, L: ${record.low}, C: ${record.close}, V: ${record.volume}`);
    });
    
    return result;
    
  } catch (error) {
    console.error('Error processing OHLCV data:', error.message);
    throw error;
  }
}

// Run example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example()
    .then(() => console.log('\nExample completed successfully'))
    .catch(error => {
      console.error('\nExample failed:', error);
      process.exit(1);
    });
}

export default example;

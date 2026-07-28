/**
 * Integration tests for OHLCVProcessor
 * Demonstrates complete workflow with realistic scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import OHLCVProcessor from './OHLCVProcessor.js';

describe('OHLCVProcessor Integration Tests', () => {
  let processor;
  let mockApiClient;

  beforeEach(() => {
    mockApiClient = {
      fetchOHLCV: vi.fn()
    };
    processor = new OHLCVProcessor(mockApiClient);
  });

  it('should handle 24-hour window with sparse data and generate synthetic records', async () => {
    const address = 'So11111111111111111111111111111111111111112';
    const launchTime = 1704067200; // Jan 1, 2024 00:00:00 UTC
    
    // Simulate sparse API data (only 3 records in 24 hours)
    mockApiClient.fetchOHLCV.mockImplementation(async (addr, start, end) => {
      // Return different data for different chunks
      if (start === launchTime) {
        return [
          { unixTime: launchTime, o: 0.000100, h: 0.000105, l: 0.000098, c: 0.000102, v: 1000000 },
          { unixTime: launchTime + 3600, o: 0.000102, h: 0.000110, l: 0.000100, c: 0.000108, v: 1500000 }
        ];
      }
      return [];
    });

    const result = await processor.processOHLCV(address, launchTime);

    // Should have 1440 total records (24 hours * 60 minutes)
    expect(result.metadata.expectedRecords).toBe(1440);
    expect(result.metadata.totalRecords).toBe(1440);
    
    // Should have generated synthetic records for missing intervals
    expect(result.metadata.syntheticRecords).toBeGreaterThan(0);
    expect(result.metadata.realRecords).toBeGreaterThanOrEqual(2);
    
    // All records should be sorted chronologically
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].timestamp).toBeGreaterThan(result.data[i - 1].timestamp);
    }
    
    // Synthetic records should have zero volume
    const syntheticRecords = result.data.filter(r => r.synthetic);
    syntheticRecords.forEach(record => {
      expect(record.volume).toBe(0);
    });
  });

  it('should detect and report gaps larger than 300 seconds', async () => {
    const address = 'token123';
    const launchTime = 1000;
    
    // Create data with a large gap
    mockApiClient.fetchOHLCV.mockResolvedValue([
      { unixTime: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 },
      { unixTime: 1060, o: 105, h: 115, l: 100, c: 110, v: 1500 },
      // Gap of 600 seconds (10 minutes)
      { unixTime: 1660, o: 110, h: 120, l: 105, c: 115, v: 2000 }
    ]);

    const result = await processor.processOHLCV(address, launchTime);

    // Should have generated synthetic records to fill the gap
    expect(result.metadata.syntheticRecords).toBeGreaterThan(0);
    
    // The missing intervals should have been identified
    expect(result.metadata.missingIntervals).toBeGreaterThan(0);
    
    // After filling with synthetic records, gaps should be minimal (60 seconds between records)
    // But we can verify synthetic records were created for the gap period
    const syntheticInGap = result.data.filter(r => 
      r.synthetic && r.timestamp > 1060 && r.timestamp < 1660
    );
    expect(syntheticInGap.length).toBeGreaterThan(0);
  });

  it('should handle chunked requests for 24-hour period', async () => {
    const address = 'token123';
    const launchTime = 1704067200;
    const endTime = launchTime + 86400; // 24 hours
    
    let callCount = 0;
    mockApiClient.fetchOHLCV.mockImplementation(async (addr, start, end) => {
      callCount++;
      // Return one record per chunk
      return [
        { unixTime: start, o: 100, h: 110, l: 95, c: 105, v: 1000 }
      ];
    });

    await processor.processOHLCV(address, launchTime);

    // Should make 24 calls (24 hours / 1 hour chunks)
    expect(callCount).toBe(24);
  });

  it('should validate data quality and report errors', async () => {
    const address = 'token123';
    const launchTime = 1000;
    
    // Provide data with quality issues
    mockApiClient.fetchOHLCV.mockResolvedValue([
      { unixTime: 1000, o: 100, h: 90, l: 95, c: 105, v: 1000 }, // high < low (invalid)
      { unixTime: 1060, o: -10, h: 110, l: 95, c: 105, v: 1000 } // negative price
    ]);

    const result = await processor.processOHLCV(address, launchTime);

    // Should detect price consistency issues
    expect(result.metadata.validation.hasPriceConsistency).toBe(false);
    expect(result.metadata.validation.errors.length).toBeGreaterThan(0);
  });

  it('should carry forward last known price for synthetic records', async () => {
    const address = 'token123';
    const launchTime = 1000;
    
    mockApiClient.fetchOHLCV.mockResolvedValue([
      { unixTime: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 },
      // Missing: 1060
      { unixTime: 1120, o: 110, h: 120, l: 105, c: 115, v: 1500 }
    ]);

    const result = await processor.processOHLCV(address, launchTime);

    // Find the synthetic record at timestamp 1060
    const syntheticRecord = result.data.find(r => r.timestamp === 1060 && r.synthetic);
    
    expect(syntheticRecord).toBeDefined();
    // Should carry forward the close price from timestamp 1000 (105)
    expect(syntheticRecord.close).toBe(105);
    expect(syntheticRecord.open).toBe(105);
    expect(syntheticRecord.high).toBe(105);
    expect(syntheticRecord.low).toBe(105);
    expect(syntheticRecord.volume).toBe(0);
  });

  it('should remove duplicate timestamps', async () => {
    const address = 'token123';
    const launchTime = 1000;
    
    // Provide data with duplicates
    mockApiClient.fetchOHLCV.mockResolvedValue([
      { unixTime: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 },
      { unixTime: 1000, o: 101, h: 111, l: 96, c: 106, v: 1100 }, // duplicate
      { unixTime: 1060, o: 105, h: 115, l: 100, c: 110, v: 1500 }
    ]);

    const result = await processor.processOHLCV(address, launchTime);

    // Count records at timestamp 1000
    const recordsAt1000 = result.data.filter(r => r.timestamp === 1000);
    expect(recordsAt1000).toHaveLength(1);
    
    // Should keep the first occurrence
    expect(recordsAt1000[0].close).toBe(105);
  });

  it('should handle API failures gracefully and continue processing', async () => {
    const address = 'token123';
    const launchTime = 1704067200;
    
    let callCount = 0;
    mockApiClient.fetchOHLCV.mockImplementation(async (addr, start, end) => {
      callCount++;
      // Fail every other chunk
      if (callCount % 2 === 0) {
        throw new Error('API error');
      }
      return [
        { unixTime: start, o: 100, h: 110, l: 95, c: 105, v: 1000 }
      ];
    });

    const result = await processor.processOHLCV(address, launchTime);

    // Should still return data despite some failures
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.metadata.realRecords).toBeGreaterThan(0);
  });

  it('should ensure all timestamps are within 24-hour window', async () => {
    const address = 'token123';
    const launchTime = 1704067200;
    const endTime = launchTime + 86400;
    
    mockApiClient.fetchOHLCV.mockResolvedValue([
      { unixTime: launchTime, o: 100, h: 110, l: 95, c: 105, v: 1000 },
      { unixTime: launchTime + 3600, o: 105, h: 115, l: 100, c: 110, v: 1500 }
    ]);

    const result = await processor.processOHLCV(address, launchTime);

    // All timestamps should be >= launchTime and < endTime
    result.data.forEach(record => {
      expect(record.timestamp).toBeGreaterThanOrEqual(launchTime);
      expect(record.timestamp).toBeLessThan(endTime);
    });
  });
});

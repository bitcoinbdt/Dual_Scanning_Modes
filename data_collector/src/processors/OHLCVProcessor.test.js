/**
 * Unit tests for OHLCVProcessor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import OHLCVProcessor from './OHLCVProcessor.js';

describe('OHLCVProcessor', () => {
  let processor;
  let mockApiClient;

  beforeEach(() => {
    mockApiClient = {
      fetchOHLCV: vi.fn()
    };
    processor = new OHLCVProcessor(mockApiClient);
  });

  describe('constructor', () => {
    it('should throw error if API client is not provided', () => {
      expect(() => new OHLCVProcessor()).toThrow('API client is required');
    });

    it('should initialize with correct default values', () => {
      expect(processor.EXPECTED_INTERVAL).toBe(60);
      expect(processor.EXPECTED_RECORDS_24H).toBe(1440);
      expect(processor.MAX_GAP_SECONDS).toBe(300);
      expect(processor.CHUNK_SIZE).toBe(3600);
    });
  });

  describe('transformOHLCVRecord', () => {
    it('should transform API record to internal format', () => {
      const apiRecord = {
        unixTime: 1704067200,
        o: 0.000123,
        h: 0.000125,
        l: 0.000122,
        c: 0.000124,
        v: 15000000
      };

      const result = processor.transformOHLCVRecord(apiRecord);

      expect(result).toEqual({
        timestamp: 1704067200,
        open: 0.000123,
        high: 0.000125,
        low: 0.000122,
        close: 0.000124,
        volume: 15000000,
        synthetic: false
      });
    });
  });

  describe('sortAndDeduplicate', () => {
    it('should return empty array for empty input', () => {
      expect(processor.sortAndDeduplicate([])).toEqual([]);
      expect(processor.sortAndDeduplicate(null)).toEqual([]);
    });

    it('should sort records by timestamp ascending', () => {
      const data = [
        { timestamp: 1000, close: 3 },
        { timestamp: 500, close: 1 },
        { timestamp: 750, close: 2 }
      ];

      const result = processor.sortAndDeduplicate(data);

      expect(result[0].timestamp).toBe(500);
      expect(result[1].timestamp).toBe(750);
      expect(result[2].timestamp).toBe(1000);
    });

    it('should remove duplicate timestamps keeping first occurrence', () => {
      const data = [
        { timestamp: 1000, close: 1, value: 'first' },
        { timestamp: 1000, close: 2, value: 'second' },
        { timestamp: 2000, close: 3, value: 'third' }
      ];

      const result = processor.sortAndDeduplicate(data);

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe('first');
      expect(result[1].value).toBe('third');
    });
  });

  describe('identifyMissingIntervals', () => {
    it('should identify all missing intervals in 24-hour window', () => {
      const startTime = 1000;
      const endTime = 1000 + 300; // 5 minutes = 5 expected records
      const data = [
        { timestamp: 1000 },
        { timestamp: 1120 },
        { timestamp: 1240 }
      ];

      const missing = processor.identifyMissingIntervals(data, startTime, endTime);

      expect(missing).toEqual([1060, 1180]);
    });

    it('should return empty array when no intervals are missing', () => {
      const startTime = 1000;
      const endTime = 1180;
      const data = [
        { timestamp: 1000 },
        { timestamp: 1060 },
        { timestamp: 1120 }
      ];

      const missing = processor.identifyMissingIntervals(data, startTime, endTime);

      expect(missing).toEqual([]);
    });

    it('should handle empty data array', () => {
      const startTime = 1000;
      const endTime = 1180;

      const missing = processor.identifyMissingIntervals([], startTime, endTime);

      expect(missing).toEqual([1000, 1060, 1120]);
    });
  });

  describe('generateSyntheticRecords', () => {
    it('should return empty array when no missing intervals', () => {
      const result = processor.generateSyntheticRecords([], []);
      expect(result).toEqual([]);
    });

    it('should generate synthetic records with carry-forward price', () => {
      const missingIntervals = [1120, 1180];
      const realData = [
        { timestamp: 1000, close: 100 },
        { timestamp: 1060, close: 105 }
      ];

      const result = processor.generateSyntheticRecords(missingIntervals, realData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        timestamp: 1120,
        open: 105,
        high: 105,
        low: 105,
        close: 105,
        volume: 0,
        synthetic: true
      });
      expect(result[1]).toEqual({
        timestamp: 1180,
        open: 105,
        high: 105,
        low: 105,
        close: 105,
        volume: 0,
        synthetic: true
      });
    });

    it('should use first available price when missing interval is before first real data', () => {
      const missingIntervals = [900];
      const realData = [
        { timestamp: 1000, close: 100 }
      ];

      const result = processor.generateSyntheticRecords(missingIntervals, realData);

      expect(result[0].close).toBe(100);
    });

    it('should use zero when no real data exists', () => {
      const missingIntervals = [1000];
      const realData = [];

      const result = processor.generateSyntheticRecords(missingIntervals, realData);

      expect(result[0].close).toBe(0);
    });
  });

  describe('detectGaps', () => {
    it('should detect gaps larger than 300 seconds', () => {
      const data = [
        { timestamp: 1000 },
        { timestamp: 1060 },
        { timestamp: 1500 }, // 440 second gap
        { timestamp: 1560 }
      ];

      const gaps = processor.detectGaps(data);

      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({
        startTimestamp: 1060,
        endTimestamp: 1500,
        durationSeconds: 440,
        warning: 'Gap of 440 seconds exceeds threshold of 300 seconds'
      });
    });

    it('should not detect gaps smaller than or equal to 300 seconds', () => {
      const data = [
        { timestamp: 1000 },
        { timestamp: 1300 }, // exactly 300 seconds
        { timestamp: 1360 }
      ];

      const gaps = processor.detectGaps(data);

      expect(gaps).toHaveLength(0);
    });

    it('should return empty array for data with less than 2 records', () => {
      expect(processor.detectGaps([])).toEqual([]);
      expect(processor.detectGaps([{ timestamp: 1000 }])).toEqual([]);
    });
  });

  describe('validateDataQuality', () => {
    it('should pass validation for valid data', () => {
      const data = [
        { timestamp: 1000, open: 100, high: 110, low: 95, close: 105, volume: 1000 },
        { timestamp: 1060, open: 105, high: 115, low: 100, close: 110, volume: 1500 }
      ];

      const result = processor.validateDataQuality(data);

      expect(result.isChronological).toBe(true);
      expect(result.hasCompleteFields).toBe(true);
      expect(result.hasPriceConsistency).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect non-chronological order', () => {
      const data = [
        { timestamp: 1060, open: 100, high: 110, low: 95, close: 105, volume: 1000 },
        { timestamp: 1000, open: 105, high: 115, low: 100, close: 110, volume: 1500 }
      ];

      const result = processor.validateDataQuality(data);

      expect(result.isChronological).toBe(false);
      expect(result.errors.some(e => e.type === 'chronological')).toBe(true);
    });

    it('should detect incomplete fields', () => {
      const data = [
        { timestamp: 1000, open: 100, high: 110 } // missing low, close, volume
      ];

      const result = processor.validateDataQuality(data);

      expect(result.hasCompleteFields).toBe(false);
      expect(result.errors.some(e => e.type === 'incomplete_fields')).toBe(true);
    });

    it('should detect price inconsistency - high < low', () => {
      const data = [
        { timestamp: 1000, open: 100, high: 90, low: 95, close: 92, volume: 1000 }
      ];

      const result = processor.validateDataQuality(data);

      expect(result.hasPriceConsistency).toBe(false);
      expect(result.errors.some(e => e.type === 'price_consistency')).toBe(true);
    });

    it('should detect negative values', () => {
      const data = [
        { timestamp: 1000, open: -100, high: 110, low: 95, close: 105, volume: 1000 }
      ];

      const result = processor.validateDataQuality(data);

      expect(result.hasPriceConsistency).toBe(false);
      expect(result.errors.some(e => e.type === 'negative_values')).toBe(true);
    });

    it('should handle empty data', () => {
      const result = processor.validateDataQuality([]);

      expect(result.isChronological).toBe(true);
      expect(result.hasCompleteFields).toBe(true);
      expect(result.hasPriceConsistency).toBe(true);
    });
  });

  describe('fetchOHLCVData', () => {
    it('should fetch in single request for duration <= 1 hour', async () => {
      const address = 'token123';
      const startTime = 1000;
      const endTime = 1000 + 3600; // exactly 1 hour

      mockApiClient.fetchOHLCV.mockResolvedValue([
        { unixTime: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 }
      ]);

      const result = await processor.fetchOHLCVData(address, startTime, endTime);

      expect(mockApiClient.fetchOHLCV).toHaveBeenCalledTimes(1);
      expect(mockApiClient.fetchOHLCV).toHaveBeenCalledWith(address, startTime, endTime, '1m');
      expect(result).toHaveLength(1);
    });

    it('should fetch in chunks for duration > 1 hour', async () => {
      const address = 'token123';
      const startTime = 1000;
      const endTime = 1000 + 7200; // 2 hours

      mockApiClient.fetchOHLCV.mockResolvedValue([
        { unixTime: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 }
      ]);

      const result = await processor.fetchOHLCVData(address, startTime, endTime);

      expect(mockApiClient.fetchOHLCV).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should continue fetching even if one chunk fails', async () => {
      const address = 'token123';
      const startTime = 1000;
      const endTime = 1000 + 7200; // 2 hours

      mockApiClient.fetchOHLCV
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([
          { unixTime: 4600, o: 100, h: 110, l: 95, c: 105, v: 1000 }
        ]);

      const result = await processor.fetchOHLCVData(address, startTime, endTime);

      expect(mockApiClient.fetchOHLCV).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
    });
  });

  describe('processOHLCV', () => {
    it('should process complete OHLCV workflow', async () => {
      const address = 'token123';
      const launchTime = 1000;

      mockApiClient.fetchOHLCV.mockResolvedValue([
        { unixTime: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 },
        { unixTime: 1120, o: 105, h: 115, l: 100, c: 110, v: 1500 }
      ]);

      const result = await processor.processOHLCV(address, launchTime);

      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalRecords).toBeGreaterThan(0);
      expect(result.metadata.realRecords).toBe(2);
      expect(result.metadata.syntheticRecords).toBeGreaterThan(0);
      expect(result.metadata.expectedRecords).toBe(1440);
    });

    it('should include validation results in metadata', async () => {
      const address = 'token123';
      const launchTime = 1000;

      mockApiClient.fetchOHLCV.mockResolvedValue([
        { unixTime: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 }
      ]);

      const result = await processor.processOHLCV(address, launchTime);

      expect(result.metadata.validation).toBeDefined();
      expect(result.metadata.validation.isChronological).toBeDefined();
      expect(result.metadata.validation.hasCompleteFields).toBeDefined();
      expect(result.metadata.validation.hasPriceConsistency).toBeDefined();
    });
  });
});

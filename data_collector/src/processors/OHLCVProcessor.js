/**
 * OHLCVProcessor Module
 * 
 * Processes raw OHLCV data from Birdeye API:
 * - Fetches OHLCV data for 24-hour window (launch_time to launch_time + 86400)
 * - Implements chunked requests strategy (1-hour chunks if needed)
 * - Detects missing intervals (expected 1440 records at 60-second intervals)
 * - Generates synthetic records (carry-forward last close price with zero volume)
 * - Detects gaps (warns if gap > 300 seconds)
 * - Sorts timestamps and removes duplicates
 * - Validates data quality (chronological order, field completeness, price consistency)
 * 
 * Validates Requirements: 2.1, 2.2, 2.5, 2.6
 */

class OHLCVProcessor {
  /**
   * Initialize OHLCVProcessor
   * @param {BirdeyeClient} apiClient - Birdeye API client instance
   */
  constructor(apiClient) {
    if (!apiClient) {
      throw new Error('API client is required');
    }
    this.apiClient = apiClient;
    this.EXPECTED_INTERVAL = 60; // 60 seconds between records
    this.EXPECTED_RECORDS_24H = 1440; // 24 hours * 60 minutes
    this.MAX_GAP_SECONDS = 300; // 5 minutes
    this.CHUNK_SIZE = 3600; // 1 hour in seconds
  }

  /**
   * Process OHLCV data for a token's 24-hour window
   * @param {string} address - Token contract address
   * @param {number} launchTime - Launch timestamp (Unix seconds)
   * @returns {Promise<Object>} Processed OHLCV data with metadata
   */
  async processOHLCV(address, launchTime) {
    const endTime = launchTime + 86400; // 24 hours after launch
    
    // Fetch OHLCV data (with chunking if needed)
    const rawData = await this.fetchOHLCVData(address, launchTime, endTime);
    
    // Sort by timestamp and remove duplicates
    const sortedData = this.sortAndDeduplicate(rawData);
    
    // Validate data quality
    const validationResults = this.validateDataQuality(sortedData);
    
    // Identify missing intervals
    const missingIntervals = this.identifyMissingIntervals(sortedData, launchTime, endTime);
    
    // Generate synthetic records for missing intervals
    const syntheticRecords = this.generateSyntheticRecords(missingIntervals, sortedData);
    
    // Merge real and synthetic data
    const completeData = this.sortAndDeduplicate([...sortedData, ...syntheticRecords]);
    
    // Detect gaps
    const gaps = this.detectGaps(completeData);
    
    return {
      data: completeData,
      metadata: {
        totalRecords: completeData.length,
        realRecords: sortedData.length,
        syntheticRecords: syntheticRecords.length,
        missingIntervals: missingIntervals.length,
        expectedRecords: this.EXPECTED_RECORDS_24H,
        gaps: gaps,
        validation: validationResults
      }
    };
  }

  /**
   * Fetch OHLCV data with chunked requests strategy
   * @param {string} address - Token contract address
   * @param {number} startTime - Start timestamp (Unix seconds)
   * @param {number} endTime - End timestamp (Unix seconds)
   * @returns {Promise<Array>} Array of OHLCV records
   */
  async fetchOHLCVData(address, startTime, endTime) {
    const allData = [];
    const totalDuration = endTime - startTime;
    
    // If duration is <= 1 hour, fetch in single request
    if (totalDuration <= this.CHUNK_SIZE) {
      const data = await this.apiClient.fetchOHLCV(address, startTime, endTime, '1m');
      return data.map(record => this.transformOHLCVRecord(record));
    }
    
    // Otherwise, fetch in 1-hour chunks
    let currentStart = startTime;
    
    while (currentStart < endTime) {
      const currentEnd = Math.min(currentStart + this.CHUNK_SIZE, endTime);
      
      try {
        const chunkData = await this.apiClient.fetchOHLCV(address, currentStart, currentEnd, '1m');
        const transformedData = chunkData.map(record => this.transformOHLCVRecord(record));
        allData.push(...transformedData);
      } catch (error) {
        console.warn(`Failed to fetch OHLCV chunk ${currentStart}-${currentEnd}: ${error.message}`);
        // Continue with next chunk even if one fails
      }
      
      currentStart = currentEnd;
    }
    
    return allData;
  }

  /**
   * Transform raw OHLCV record from API to internal format
   * @param {Object} record - Raw OHLCV record from API
   * @returns {Object} Transformed OHLCV record
   */
  transformOHLCVRecord(record) {
    return {
      timestamp: record.unixTime,
      open: record.o,
      high: record.h,
      low: record.l,
      close: record.c,
      volume: record.v,
      synthetic: false
    };
  }

  /**
   * Sort OHLCV data by timestamp and remove duplicates
   * @param {Array} data - Array of OHLCV records
   * @returns {Array} Sorted and deduplicated array
   */
  sortAndDeduplicate(data) {
    if (!data || data.length === 0) {
      return [];
    }
    
    // Sort by timestamp ascending
    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove duplicates (keep first occurrence)
    const seen = new Set();
    const deduplicated = [];
    
    for (const record of sorted) {
      if (!seen.has(record.timestamp)) {
        seen.add(record.timestamp);
        deduplicated.push(record);
      }
    }
    
    return deduplicated;
  }

  /**
   * Identify missing intervals in OHLCV data
   * @param {Array} data - Sorted OHLCV records
   * @param {number} startTime - Expected start timestamp
   * @param {number} endTime - Expected end timestamp
   * @returns {Array} Array of missing timestamps
   */
  identifyMissingIntervals(data, startTime, endTime) {
    const missingIntervals = [];
    const existingTimestamps = new Set(data.map(record => record.timestamp));
    
    // Check all expected timestamps from startTime to endTime (exclusive)
    for (let ts = startTime; ts < endTime; ts += this.EXPECTED_INTERVAL) {
      if (!existingTimestamps.has(ts)) {
        missingIntervals.push(ts);
      }
    }
    
    return missingIntervals;
  }

  /**
   * Generate synthetic records for missing intervals
   * Uses carry-forward strategy: last known close price with zero volume
   * @param {Array} missingIntervals - Array of missing timestamps
   * @param {Array} realData - Array of real OHLCV records (sorted)
   * @returns {Array} Array of synthetic OHLCV records
   */
  generateSyntheticRecords(missingIntervals, realData) {
    if (missingIntervals.length === 0) {
      return [];
    }
    
    const syntheticRecords = [];
    let lastKnownPrice = null;
    
    // Find initial price if we have real data
    if (realData.length > 0) {
      lastKnownPrice = realData[0].close;
    }
    
    for (const timestamp of missingIntervals) {
      // Find the last known price before this timestamp
      for (let i = realData.length - 1; i >= 0; i--) {
        if (realData[i].timestamp < timestamp) {
          lastKnownPrice = realData[i].close;
          break;
        }
      }
      
      // If no price found yet, use first available price
      if (lastKnownPrice === null && realData.length > 0) {
        lastKnownPrice = realData[0].close;
      }
      
      // Generate synthetic record
      const syntheticPrice = lastKnownPrice !== null ? lastKnownPrice : 0;
      
      syntheticRecords.push({
        timestamp: timestamp,
        open: syntheticPrice,
        high: syntheticPrice,
        low: syntheticPrice,
        close: syntheticPrice,
        volume: 0,
        synthetic: true
      });
    }
    
    return syntheticRecords;
  }

  /**
   * Detect gaps in OHLCV data (gaps > 300 seconds)
   * @param {Array} data - Sorted OHLCV records
   * @returns {Array} Array of gap objects with start, end, and duration
   */
  detectGaps(data) {
    const gaps = [];
    
    if (data.length < 2) {
      return gaps;
    }
    
    for (let i = 1; i < data.length; i++) {
      const prevTimestamp = data[i - 1].timestamp;
      const currentTimestamp = data[i].timestamp;
      const gap = currentTimestamp - prevTimestamp;
      
      if (gap > this.MAX_GAP_SECONDS) {
        gaps.push({
          startTimestamp: prevTimestamp,
          endTimestamp: currentTimestamp,
          durationSeconds: gap,
          warning: `Gap of ${gap} seconds exceeds threshold of ${this.MAX_GAP_SECONDS} seconds`
        });
      }
    }
    
    return gaps;
  }

  /**
   * Validate data quality
   * Checks: chronological order, field completeness, price consistency
   * @param {Array} data - OHLCV records
   * @returns {Object} Validation results
   */
  validateDataQuality(data) {
    const results = {
      isChronological: true,
      hasCompleteFields: true,
      hasPriceConsistency: true,
      errors: []
    };
    
    if (!data || data.length === 0) {
      return results;
    }
    
    // Check chronological order
    for (let i = 1; i < data.length; i++) {
      if (data[i].timestamp <= data[i - 1].timestamp) {
        results.isChronological = false;
        results.errors.push({
          type: 'chronological',
          index: i,
          message: `Record at index ${i} has timestamp ${data[i].timestamp} <= previous timestamp ${data[i - 1].timestamp}`
        });
      }
    }
    
    // Check field completeness and price consistency
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      // Check required fields exist
      if (
        record.timestamp === undefined ||
        record.open === undefined ||
        record.high === undefined ||
        record.low === undefined ||
        record.close === undefined ||
        record.volume === undefined
      ) {
        results.hasCompleteFields = false;
        results.errors.push({
          type: 'incomplete_fields',
          index: i,
          timestamp: record.timestamp,
          message: `Record at index ${i} is missing required fields`
        });
        continue;
      }
      
      // Check price consistency: high >= low, high >= open, high >= close, low <= open, low <= close
      if (
        record.high < record.low ||
        record.high < record.open ||
        record.high < record.close ||
        record.low > record.open ||
        record.low > record.close
      ) {
        results.hasPriceConsistency = false;
        results.errors.push({
          type: 'price_consistency',
          index: i,
          timestamp: record.timestamp,
          message: `Record at index ${i} has inconsistent prices: O=${record.open}, H=${record.high}, L=${record.low}, C=${record.close}`
        });
      }
      
      // Check for negative values
      if (
        record.open < 0 ||
        record.high < 0 ||
        record.low < 0 ||
        record.close < 0 ||
        record.volume < 0
      ) {
        results.hasPriceConsistency = false;
        results.errors.push({
          type: 'negative_values',
          index: i,
          timestamp: record.timestamp,
          message: `Record at index ${i} has negative values`
        });
      }
    }
    
    return results;
  }
}

export default OHLCVProcessor;

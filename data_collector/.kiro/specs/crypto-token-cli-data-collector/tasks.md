# Implementation Plan: Crypto Token CLI Data Collector

## Overview

This implementation plan breaks down the development of a Node.js CLI tool that collects and analyzes early-stage cryptocurrency token data from the Birdeye API. The tool fetches OHLCV data and transaction history, processes it into time windows (1h, 6h, 24h), performs feature engineering (40 features), calculates success scores, detects red flags, and generates comprehensive JSON output files.

The implementation follows a modular architecture with clear separation of concerns: API interaction, data processing, feature engineering, analysis, and output generation.

## Tasks

- [x] 1. Set up project structure and core dependencies
  - Create project directory structure (src/config, src/core, src/api, src/collectors, src/processors, src/analysis, src/output, src/utils)
  - Initialize package.json with Node.js >= 18.0.0 requirement
  - Add dependencies: none required (using native fetch API)
  - Create .gitignore file
  - Create example tokens.json file
  - Create output/ directory
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 2. Implement configuration and input validation
  - [x] 2.1 Create ConfigManager module
    - Implement environment variable loading (BIRDEYE_API_KEY)
    - Implement tokens.json file reading and parsing
    - Implement token specification validation (name, address, launch_time)
    - Implement address format validation (Ethereum 0x format, Solana base58)
    - Implement launch timestamp validation
    - Handle missing file and invalid JSON errors
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [x] 2.2 Create Logger utility module
    - Implement log levels (ERROR, WARN, INFO, DEBUG)
    - Implement timestamp formatting
    - Implement context-aware logging (token name, address, API endpoint)
    - _Requirements: 11.1, 11.8_

  - [x] 2.3 Create Validators utility module
    - Implement OHLCV record validation (required fields, price consistency)
    - Implement transaction record validation (required fields)
    - Implement filesystem-safe name validation
    - _Requirements: 2.5, 2.6_

- [x] 3. Implement rate limiting and API client
  - [x] 3.1 Create RateLimiter module
    - Implement minimum delay enforcement (100ms between requests)
    - Implement adaptive delay adjustment (increase 50% after 3 rate limits, decrease 25% after 20 successes)
    - Track consecutive successes and rate limit errors
    - Implement waitBeforeRequest() method
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 4.8_

  - [x] 3.2 Create BirdeyeClient API module
    - Implement base HTTP request method with authentication headers
    - Implement retry logic with exponential backoff (network: 1s/2s/4s, server: 2s/4s/8s)
    - Implement rate limit error handling (HTTP 429 with retry-after header)
    - Implement fetchOHLCV() method
    - Implement fetchTransactions() method with pagination support
    - Handle timeout errors (30s timeout)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.12, 4.3, 4.4, 4.5, 11.3, 11.4, 11.5, 11.6, 11.9_

- [x] 4. Implement OHLCV data collection and processing
  - [x] 4.1 Create OHLCVProcessor module
    - Implement OHLCV data fetching for 24-hour window (launch_time to launch_time + 86400)
    - Implement chunked requests strategy (1-hour chunks if needed)
    - Implement missing interval detection (expected 1440 records at 60-second intervals)
    - Implement synthetic record generation (carry-forward last close price with zero volume)
    - Implement gap detection (warn if gap > 300 seconds)
    - Implement timestamp sorting and deduplication
    - Implement data quality validation (chronological order, field completeness, price consistency)
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

- [ ] 5. Implement transaction collection and processing
  - [ ] 5.1 Create TransactionProcessor module
    - Implement transaction pagination (offset-based, check hasMore flag)
    - Implement 24-hour boundary check (stop when timestamp >= launch_time + 86400)
    - Implement transaction deduplication by txHash
    - Implement two-record transformation (one buy record, one sell record per blockchain tx)
    - Implement amount conversion (divide by 10^decimals)
    - Implement chronological sorting
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

  - [ ] 5.2 Implement holder extraction and balance calculation
    - Extract unique wallet addresses from all transactions
    - Initialize wallet balances to zero
    - Calculate balances by processing transactions chronologically (add for buy, subtract for sell)
    - Handle negative balances (wallets that sold pre-launch holdings)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6. Implement time window slicing
  - [ ] 6.1 Create TimeWindowSlicer module
    - Implement strict timestamp filtering (inclusive start, exclusive end)
    - Create 1h window (launch_time to launch_time + 3600)
    - Create 6h window (launch_time to launch_time + 21600)
    - Create 24h window (launch_time to launch_time + 86400)
    - Filter OHLCV data for each window
    - Filter transactions for each window
    - Calculate window-specific wallet balances
    - Count unique holders per window
    - Ensure no duplicate records in any window
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement feature engineering (40 features)
  - [ ] 8.1 Create FeatureEngine module - Volume features (V1-V10)
    - V1: Total volume in 24h window
    - V2: Volume trend (1h vs 24h average)
    - V3: Volume volatility (coefficient of variation)
    - V4: Volume concentration (top hour percentage)
    - V5: Volume acceleration (6h vs 24h)
    - V6: Early volume ratio (first hour vs 24h)
    - V7: Volume consistency (percentage of non-zero intervals)
    - V8: Peak volume timing (minutes from launch)
    - V9: Volume decay rate (exponential fit)
    - V10: Volume spike count (intervals > 2 std dev)

  - [ ] 8.2 Create FeatureEngine module - Wallet features (W1-W10)
    - W1: Total unique holders in 24h
    - W2: Holder growth rate (1h to 24h)
    - W3: Holder concentration (Gini coefficient)
    - W4: Top 10 holder percentage
    - W5: Whale count (holders with > 1% supply)
    - W6: New holder velocity (holders per hour)
    - W7: Holder retention (1h holders still in 24h)
    - W8: Average holder balance
    - W9: Median holder balance
    - W10: Balance distribution skewness

  - [ ] 8.3 Create FeatureEngine module - Transaction features (T1-T10)
    - T1: Total transaction count in 24h
    - T2: Transaction velocity (transactions per hour)
    - T3: Buy/sell ratio
    - T4: Average transaction size
    - T5: Transaction size volatility
    - T6: Unique traders count
    - T7: Repeat trader percentage
    - T8: Large transaction count (> 2 std dev)
    - T9: Transaction clustering (temporal concentration)
    - T10: Early transaction intensity (first hour)

  - [ ] 8.4 Create FeatureEngine module - Growth features (G1-G10)
    - G1: Price change 24h (percentage)
    - G2: Price volatility (coefficient of variation)
    - G3: ATH timing (minutes from launch)
    - G4: Price stability (percentage of time within 10% of mean)
    - G5: Price momentum (6h vs 24h)
    - G6: Drawdown from ATH (percentage)
    - G7: Price recovery rate (from ATL to current)
    - G8: Support level strength (price floor consistency)
    - G9: Resistance level strength (price ceiling consistency)
    - G10: Price-volume correlation

- [ ] 9. Implement success scoring system
  - [ ] 9.1 Create SuccessScorer module
    - Implement price performance dimension (30 points max)
      - Price appreciation component (15 points)
      - Price stability component (10 points)
      - ATH timing component (5 points)
    - Implement community growth dimension (25 points max)
      - Holder growth component (10 points)
      - Holder retention component (8 points)
      - Distribution health component (7 points)
    - Implement trading activity dimension (25 points max)
      - Transaction velocity component (10 points)
      - Buy/sell ratio component (8 points)
      - Volume consistency component (7 points)
    - Implement distribution health dimension (20 points max)
      - Concentration penalty component (10 points)
      - Whale presence component (5 points)
      - Balance distribution component (5 points)
    - Apply penalty modifiers (extreme concentration, suspicious patterns)
    - Determine rating (HIGH: 70-100, MEDIUM: 40-69, LOW: 0-39)

- [ ] 10. Implement pattern matching system
  - [ ] 10.1 Create PatternMatcher module
    - Load winner profile with IQR-based feature ranges
    - Implement IQR-based distance calculation for each feature
    - Check critical gates (G1, W2, V2, T2)
    - Check important features (G4, W1, T3, W6)
    - Check supporting features (G3, G9, W4, V7)
    - Identify disqualifying patterns (extreme concentration, suspicious timing)
    - Calculate overall similarity score (0-100)
    - Determine confidence level (HIGH: 80-100, MEDIUM: 60-79, LOW: 0-59)

- [ ] 11. Implement red flag detection system
  - [ ] 11.1 Create RedFlagDetector module - Ownership flags (RF1-RF5)
    - RF1: Single wallet dominance (> 40% supply)
    - RF2: Top 3 concentration (> 60% supply)
    - RF3: Top 10 concentration (> 80% supply)
    - RF4: Whale cluster (> 5 wallets with > 5% each)
    - RF5: Extreme Gini coefficient (> 0.85)

  - [ ] 11.2 Create RedFlagDetector module - Volume flags (RF6-RF10)
    - RF6: Volume front-loading (> 50% in first hour)
    - RF7: Volume cliff (> 70% drop from peak hour)
    - RF8: Suspicious volume spikes (> 5 spikes > 3 std dev)
    - RF9: Low volume consistency (< 30% non-zero intervals)
    - RF10: Artificial volume pattern (regular interval spikes)

  - [ ] 11.3 Create RedFlagDetector module - Growth flags (RF11-RF15)
    - RF11: Immediate dump (> 50% price drop in first 6h)
    - RF12: No recovery (price never returns to 50% of ATH)
    - RF13: Extreme volatility (CV > 1.5)
    - RF14: Instant ATH (ATH within first 5 minutes)
    - RF15: Continuous decline (negative price trend entire 24h)

  - [ ] 11.4 Create RedFlagDetector module - Price flags (RF16-RF20)
    - RF16: Price manipulation pattern (repeated pump-dump cycles)
    - RF17: Wash trading indicator (high volume, low price movement)
    - RF18: Coordinated buying (large buys at exact intervals)
    - RF19: Rug pull signature (sudden liquidity removal pattern)
    - RF20: Bot trading pattern (identical transaction sizes)

  - [ ] 11.5 Create RedFlagDetector module - Behavioral flags (RF21-RF25)
    - RF21: Sybil attack indicator (many wallets, similar balances)
    - RF22: Insider trading pattern (large buys before price spike)
    - RF23: Exit scam indicator (top holders all selling)
    - RF24: Fake engagement (transactions with no price impact)
    - RF25: Coordinated exit (multiple large sells at same time)

  - [ ] 11.6 Calculate red flag score and determine risk level
    - Calculate score (critical flags: 10 points each, warning flags: 5 points each)
    - Determine risk level (CRITICAL: 30+, HIGH: 20-29, MEDIUM: 10-19, LOW: 0-9)
    - Build detailed flag information with evidence

- [ ] 12. Implement classification system
  - [ ] 12.1 Create Classifier module
    - Calculate classification metrics (price change, holder growth, volume trend, concentration)
    - Evaluate WINNER criteria (price > 100%, holders > 50%, volume trend > 0, concentration < 0.7)
    - Evaluate LOSER criteria (price < -30%, holders < 10%, volume trend < -0.5, concentration > 0.85)
    - Determine classification (WINNER, LOSER, or NEUTRAL)
    - Calculate confidence score based on metric strength

- [ ] 13. Implement output generation
  - [ ] 13.1 Create OutputGenerator module
    - Build complete JSON structure with all sections
    - Add token metadata (name, address, chain, launch_time)
    - Add classification results
    - Add success score results
    - Add pattern match results
    - Add red flags results
    - Add metadata (low_data flag, transaction_count, processing_timestamp)
    - Add time window data (1h, 6h, 24h with OHLCV, transactions, wallet_balances, holders_count, unique_wallets)
    - Generate filename with format: {token_name}_{address_prefix}.json
    - Ensure output directory exists
    - Write JSON file with proper formatting
    - Handle file write errors gracefully
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

- [ ] 14. Implement main CLI orchestration
  - [ ] 14.1 Create collect.js main entry point
    - Parse command-line arguments (support --file flag for custom tokens.json path)
    - Validate Node.js version (>= 18.0.0)
    - Initialize ConfigManager and load configuration
    - Implement token processing loop (sequential, one token at a time)
    - Log token processing start with position (e.g., "Processing token 2 of 5: TokenName")
    - Execute complete workflow for each token (OHLCV, transactions, processing, analysis, output)
    - Handle per-token errors with full context logging
    - Continue to next token on error (isolated error handling)
    - Maintain rate limiter state across all tokens
    - Log batch summary (total processed, successes, failures)
    - Exit with appropriate status code (0 if any success, non-zero if all failed)
    - _Requirements: 1.3, 1.4, 1.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 11.2, 11.7_

- [ ] 15. Implement validation script
  - [ ] 15.1 Create validate.js validation script
    - Parse command-line arguments (accept JSON file path)
    - Read and parse JSON output file
    - Analyze OHLCV data for time gaps (consecutive timestamps > 60s)
    - Calculate volume statistics (mean, standard deviation)
    - Detect volume spikes (volume > mean + 3 std dev)
    - Count unique holders from wallet_balances
    - Generate validation report with all findings
    - Display report in human-readable format
    - Flag time gaps and volume spikes as data quality issues
    - Support multiple file validation (generate separate report per token)
    - Handle file read and parse errors
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12_

- [ ] 16. Create DataCollector orchestration module
  - Implement collectTokenData() to orchestrate OHLCV and transaction collection
  - Coordinate between OHLCVProcessor and TransactionProcessor
  - Handle data processing errors gracefully
  - Return structured data for time window slicing
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 17. Final checkpoint - Integration and testing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Create documentation and examples
  - Create README.md with installation instructions
  - Document environment variable setup (BIRDEYE_API_KEY)
  - Document tokens.json format with examples
  - Document output JSON schema
  - Document CLI usage (default mode, custom file mode, validation mode)
  - Create example tokens.json with sample tokens
  - Document error messages and troubleshooting
  - Document feature descriptions (all 40 features)
  - Document success scoring methodology
  - Document red flag detection logic

## Notes

- This is a data collection and analysis tool, not a trading bot
- All 40 features are calculated from collected data
- Success scoring uses weighted dimensions with penalty modifiers
- Pattern matching compares against historical winner profile
- Red flag detection checks 25 indicators across 5 categories
- Classification determines WINNER/LOSER/NEUTRAL based on metrics
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The tool processes tokens sequentially with isolated error handling
- Rate limiting is maintained across all tokens in batch mode
- Output files include comprehensive analysis results


---

## AUDIT FIX TASKS

- [ ] 19. Implement market data collection (supply and market cap)
  - [ ] 19.1 Update ConfigManager to accept optional market data fields
    - Add validation for circulating_supply, total_supply, market_cap (can be null)
    - Do not fail if fields are missing
    - _Requirements: 13.1, 13.6_

  - [ ] 19.2 Add fetchTokenMetadata() to BirdeyeClient
    - Implement API call to fetch token metadata
    - Extract circulating_supply, total_supply, market_cap
    - Return null for missing fields
    - _Requirements: 13.2, 13.3, 13.4, 13.5_

  - [ ] 19.3 Update OutputGenerator to include market data
    - Add circulating_supply, total_supply, market_cap to output schema
    - _Requirements: 13.7_

- [ ] 20. Implement liquidity data collection
  - [ ] 20.1 Create LiquidityCollector module
    - Fetch liquidity pool data from Birdeye or DEX APIs
    - Collect snapshots at 1-minute resolution
    - Store as time series: pool_address, token_reserve, base_reserve, liquidity_usd, timestamp
    - Handle missing data gracefully (return empty array)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.6, 14.7_

  - [ ] 20.2 Update OutputGenerator to include liquidity data
    - Add liquidity_timeseries array to output schema
    - _Requirements: 14.5_

- [ ] 21. Implement mint/burn event tracking
  - [ ] 21.1 Create MintBurnTracker module
    - Fetch mint and burn events from blockchain or API
    - Record type (mint|burn), amount, timestamp
    - Store in chronological order
    - Handle missing data gracefully (return empty array)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.6_

  - [ ] 21.2 Update OutputGenerator to include mint/burn events
    - Add mint_burn_events array to output schema
    - _Requirements: 15.5_

- [ ] 22. Fix broken derived metrics
  - [ ] 22.1 Fix W5 (Whale Count) in FeatureEngine
    - Check if circulating_supply is not null before computing
    - IF circulating_supply is null, set W5 to null
    - Compute whale_count = holders where (balance / circulating_supply) >= 0.01
    - _Requirements: 13.8, 13.9_

  - [ ] 22.2 Fix RF19 (Rug Pull Detection) in RedFlagDetector
    - Check if liquidity_timeseries has at least 2 data points
    - IF insufficient data, set RF19 to null
    - Detect liquidity drops > 70% within 1 hour
    - Include evidence (timestamps, values, drop percentage)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ] 22.3 Fix RF17 (Wash Trading) in RedFlagDetector
    - Update logic to include liquidity context
    - Flag when: volume high AND price change < 2% AND (liquidity low OR decreasing)
    - Handle missing liquidity data (partial detection)
    - Include liquidity context in evidence
    - Log warning if computed without liquidity
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ] 22.4 Exclude synthetic OHLCV from volume features
    - Ensure synthetic flag is set on all OHLCV records
    - Filter out synthetic=true records before computing V1-V10
    - Log count of synthetic vs real records
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.6_

  - [ ] 22.5 Update OutputGenerator to include synthetic flag
    - Add synthetic field to each OHLCV record in output
    - _Requirements: 18.5_

- [ ] 23. Implement winner profile loading
  - [ ] 23.1 Update PatternMatcher to load winner_profile.json
    - Attempt to load winner_profile.json on initialization
    - Check if file exists and sample_size > 0
    - IF invalid or empty, disable pattern matching and set score to null
    - Log warning when pattern matching is disabled
    - Do not guess or generate profile values
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [ ] 23.2 Update OutputGenerator to include pattern_match_enabled flag
    - Add pattern_match_enabled boolean to output
    - _Requirements: 19.7_

- [ ] 24. Implement external events tracking
  - [ ] 24.1 Create ExternalEventsLoader module
    - Load cex_listings.json
    - Search for listings matching token address
    - Extract exchange_name, listing_timestamp, price snapshots
    - Return null if no listing found
    - Do not fail if file is missing or empty
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [ ] 24.2 Update OutputGenerator to include CEX listing data
    - Add cex_listing field to output schema
    - _Requirements: 20.7_

- [ ] 25. Implement data consistency validation
  - [ ] 25.1 Create DataConsistencyChecker module
    - Compare prices from different sources
    - Flag inconsistency if mismatch > 20%
    - Record warnings with details (type, values, mismatch %)
    - _Requirements: 21.1, 21.2, 21.3_

  - [ ] 25.2 Update OutputGenerator to include consistency flags
    - Add data_inconsistency boolean flag
    - Add data_warnings array
    - _Requirements: 21.4, 21.5, 21.6, 21.7_

- [ ] 26. Implement API fallback strategy
  - [ ] 26.1 Create HeliusClient fallback API module
    - Implement transaction fetching via Helius API
    - Use as fallback when Birdeye fails
    - _Requirements: 22.2_

  - [ ] 26.2 Create RPCClient fallback module
    - Implement on-chain data fetching via blockchain RPC
    - Use as fallback when APIs fail
    - _Requirements: 22.3_

  - [ ] 26.3 Update DataCollector with fallback logic
    - Try Birdeye first
    - On failure, try Helius
    - On failure, try RPC
    - Log which source was used
    - Continue to next token if all sources fail
    - _Requirements: 22.1, 22.4, 22.5_

  - [ ] 26.4 Update OutputGenerator to include data_source field
    - Add data_source to metadata (e.g., "birdeye", "helius", "rpc")
    - _Requirements: 22.6_

- [ ] 27. Implement simple batching
  - [ ] 27.1 Update collect.js with batch processing
    - Group tokens into batches of 5
    - Process batches sequentially
    - Process tokens within batch sequentially
    - Maintain rate limiter state across batches
    - Log batch progress
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 28. Implement basic caching
  - [ ] 28.1 Update collect.js with caching logic
    - Check if output file exists before processing
    - Skip token if file exists (log message)
    - Support --force flag to override caching
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

- [ ] 29. Final audit validation
  - Verify all broken metrics are fixed (W5, RF19, RF17)
  - Verify synthetic OHLCV excluded from volume features
  - Verify pattern matching disabled when profile empty
  - Verify output includes all new fields
  - Verify system handles missing data gracefully
  - Run validation script on sample output
  - Document any remaining limitations

## Notes on Audit Fixes

- All fixes preserve existing 4-layer structure (Market Data, On-chain Data, Derived Intelligence, External Events)
- No redesign or new architecture - only patches to existing system
- Missing data is handled gracefully (set to null, do not estimate)
- Broken metrics return null when required data is unavailable
- System continues processing even with missing optional data
- Fallback strategy removes single point of failure
- Simple batching and caching improve scalability without major refactoring

# Design Document

## System Architecture

The Crypto Token CLI Data Collector is designed as a modular Node.js application that collects, processes, and analyzes early-stage cryptocurrency token data. The system follows a sequential, deterministic execution model with comprehensive error handling and rate limiting.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Entry Point                          │
│                         (collect.js)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Configuration Manager                         │
│  - Load environment variables (BIRDEYE_API_KEY)                 │
│  - Parse tokens.json                                            │
│  - Validate inputs                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Token Processing Loop                         │
│  (Sequential - one token at a time)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────┴────────────────┐
        │                                  │
        ▼                                  ▼
┌──────────────────┐            ┌──────────────────┐
│  Data Collection │            │  Rate Limiter    │
│     Module       │◄───────────┤     Module       │
└────────┬─────────┘            └──────────────────┘
         │
         ├─► OHLCV Fetcher
         ├─► Transaction Fetcher (with pagination)
         └─► API Client (with retry logic)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Processing Module                        │
│  - Filter by timestamp                                          │
│  - Build holder list                                            │
│  - Calculate wallet balances                                    │
│  - Generate synthetic OHLCV records                             │
│  - Slice into time windows (1h, 6h, 24h)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Feature Engineering Module                    │
│  - Calculate 40 features (V1-V10, W1-W10, T1-T10, G1-G10)     │
│  - Compute success probability score (0-100)                    │
│  - Calculate pattern matching similarity                        │
│  - Detect red flags (25 checks)                                │
│  - Generate classification (WINNER/LOSER/NEUTRAL)              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Output Generation Module                      │
│  - Build JSON structure                                         │
│  - Write to output/{token_name}_{address_prefix}.json          │
│  - Log completion status                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Design

### 1. CLI Entry Point Module

**File**: `collect.js`

**Responsibilities**:
- Parse command-line arguments
- Initialize application
- Orchestrate token processing loop
- Handle global errors
- Exit with appropriate status code

**Key Functions**:
```javascript
async function main()
function parseArguments(argv)
function validateNodeVersion()
function initializeApplication()
async function processTokenBatch(tokens)
function logBatchSummary(results)
```

---

### 2. Configuration Manager Module

**File**: `src/config/ConfigManager.js`

**Responsibilities**:
- Load and validate environment variables
- Read and parse tokens.json
- Validate token specifications
- Provide configuration access

**Key Functions**:
```javascript
class ConfigManager {
  constructor()
  loadEnvironment()
  validateApiKey()
  loadTokensFile(filePath)
  validateTokens(tokens)
  getConfig()
}
```

**Configuration Schema**:
```javascript
{
  apiKey: string,
  tokensFilePath: string,
  outputDirectory: string,
  tokens: Array<{
    name: string,
    address: string,
    launch_time: number
  }>
}
```

---

### 3. Rate Limiter Module

**File**: `src/core/RateLimiter.js`

**Responsibilities**:
- Enforce minimum delay between API requests (100ms)
- Track consecutive successes and failures
- Adapt delay based on rate limit errors
- Provide delay enforcement interface

**Key Functions**:
```javascript
class RateLimiter {
  constructor(minDelay = 100)
  async waitBeforeRequest()
  recordSuccess()
  recordRateLimit(retryAfter)
  recordFailure()
  getCurrentDelay()
}
```

**State**:
```javascript
{
  minDelay: 100,
  currentDelay: 100,
  consecutiveSuccesses: 0,
  consecutiveRateLimits: 0,
  lastRequestTime: null
}
```

---

### 4. API Client Module

**File**: `src/api/BirdeyeClient.js`

**Responsibilities**:
- Make HTTP requests to Birdeye API
- Handle authentication headers
- Implement retry logic with exponential backoff
- Parse and validate API responses

**Key Functions**:
```javascript
class BirdeyeClient {
  constructor(apiKey, rateLimiter)
  async fetchOHLCV(address, timeFrom, timeTo, type = '1m')
  async fetchTransactions(address, limit = 100, offset = 0)
  async makeRequest(url, options, retryConfig)
  handleRateLimitError(response)
  handleServerError(response, attempt)
  handleNetworkError(error, attempt)
}
```

**Retry Configuration**:
```javascript
{
  maxRetries: 3,
  networkBackoff: [1000, 2000, 4000],  // 1s, 2s, 4s
  serverBackoff: [2000, 4000, 8000],   // 2s, 4s, 8s
  timeout: 30000  // 30 seconds
}
```

---

### 5. Data Collection Module

**File**: `src/collectors/DataCollector.js`

**Responsibilities**:
- Orchestrate OHLCV and transaction data collection
- Handle pagination for transactions
- Deduplicate transactions
- Filter data by timestamp

**Key Functions**:
```javascript
class DataCollector {
  constructor(apiClient, rateLimiter)
  async collectTokenData(token)
  async collectOHLCV(address, launchTime)
  async collectTransactions(address, launchTime)
  async paginateTransactions(address, launchTime)
  deduplicateTransactions(transactions)
  filterByTimeWindow(data, startTime, endTime)
}
```

---

### 6. OHLCV Processor Module

**File**: `src/processors/OHLCVProcessor.js`

**Responsibilities**:
- Process raw OHLCV data
- Identify missing intervals
- Generate synthetic records (carry-forward strategy)
- Validate data quality
- Sort and deduplicate

**Key Functions**:
```javascript
class OHLCVProcessor {
  processOHLCV(rawData, launchTime)
  identifyMissingIntervals(data, launchTime)
  generateSyntheticRecords(missingIntervals, lastKnownPrice)
  validateOHLCVRecord(record)
  sortByTimestamp(data)
  detectGaps(data, maxGapSeconds = 300)
}
```

**Synthetic Record Structure**:
```javascript
{
  timestamp: number,
  open: lastClose,
  high: lastClose,
  low: lastClose,
  close: lastClose,
  volume: 0,
  synthetic: true
}
```

---

### 7. Transaction Processor Module

**File**: `src/processors/TransactionProcessor.js`

**Responsibilities**:
- Transform raw transactions to output format
- Create two-record model (buy + sell per blockchain tx)
- Extract holder list
- Calculate wallet balances

**Key Functions**:
```javascript
class TransactionProcessor {
  processTransactions(rawTransactions, launchTime)
  transformToOutputFormat(transaction)
  extractHolders(transactions)
  calculateBalances(transactions, holders)
  validateTransaction(transaction)
}
```

**Output Transaction Format**:
```javascript
{
  tx_hash: string,
  wallet: string,
  side: 'buy' | 'sell',
  amount: number,
  timestamp: number
}
```

---

### 8. Time Window Slicer Module

**File**: `src/processors/TimeWindowSlicer.js`

**Responsibilities**:
- Slice data into 1h, 6h, 24h windows
- Filter OHLCV and transactions by time boundaries
- Calculate window-specific holder lists and balances
- Ensure strict timestamp filtering (inclusive start, exclusive end)

**Key Functions**:
```javascript
class TimeWindowSlicer {
  sliceIntoWindows(ohlcvData, transactions, launchTime)
  createWindow(ohlcvData, transactions, startTime, endTime)
  filterOHLCV(data, startTime, endTime)
  filterTransactions(data, startTime, endTime)
  calculateWindowBalances(transactions)
  countUniqueHolders(transactions)
}
```

**Window Definitions**:
```javascript
{
  '1h': { start: launchTime, end: launchTime + 3600 },
  '6h': { start: launchTime, end: launchTime + 21600 },
  '24h': { start: launchTime, end: launchTime + 86400 }
}
```

---

### 9. Feature Engineering Module

**File**: `src/analysis/FeatureEngine.js`

**Responsibilities**:
- Calculate all 40 features from processed data
- Implement feature calculation algorithms
- Handle missing data gracefully
- Return feature vector

**Key Functions**:
```javascript
class FeatureEngine {
  calculateAllFeatures(jsonData)
  
  // Volume Features (V1-V10)
  calculateV1_TotalVolume24h(ohlcvData)
  calculateV2_VolumeTrend(data1h, data24h, launchTime)
  calculateV3_VolumeVolatility(ohlcvData, launchTime)
  // ... V4-V10
  
  // Wallet Features (W1-W10)
  calculateW1_TotalHolders(data24h)
  calculateW2_HolderGrowthRate(data1h, data24h)
  calculateW3_HolderConcentration(walletBalances)
  // ... W4-W10
  
  // Transaction Features (T1-T10)
  calculateT1_TotalTransactions(metadata)
  calculateT2_TransactionVelocity(metadata)
  calculateT3_BuySellRatio(transactions)
  // ... T4-T10
  
  // Growth Features (G1-G10)
  calculateG1_PriceChange24h(ohlcvData)
  calculateG2_PriceVolatility(ohlcvData)
  calculateG3_ATHTiming(ohlcvData, launchTime)
  // ... G4-G10
}
```

---

### 10. Success Scoring Module

**File**: `src/analysis/SuccessScorer.js`

**Responsibilities**:
- Calculate success probability score (0-100)
- Evaluate 4 dimensions with weighted components
- Apply penalty modifiers
- Determine rating (HIGH/MEDIUM/LOW)

**Key Functions**:
```javascript
class SuccessScorer {
  calculateScore(features)
  
  // Dimension Scorers
  scorePricePerformance(features)  // 30 points max
  scoreCommunityGrowth(features)   // 25 points max
  scoreTradingActivity(features)   // 25 points max
  scoreDistributionHealth(features) // 20 points max
  
  // Component Scorers
  scorePriceAppreciation(G1)       // 15 points
  scorePriceStability(G4)          // 10 points
  scoreATHTiming(G3)               // 5 points
  // ... other components
  
  applyPenalties(score, features)
  determineRating(score)
}
```

---

### 11. Pattern Matching Module

**File**: `src/analysis/PatternMatcher.js`

**Responsibilities**:
- Compare token features with historical winner profile
- Calculate similarity score using IQR-based distance
- Check critical gates and disqualifying patterns
- Determine confidence level

**Key Functions**:
```javascript
class PatternMatcher {
  constructor(winnerProfile)
  
  calculateSimilarity(features)
  checkCriticalGates(features)
  checkDisqualifyingPatterns(features)
  calculateFeatureDistance(value, profileStats)
  checkFeatureConsistency(features)
  validateTemporalConsistency(jsonData)
  determineConfidence(score, disqualifications)
}
```

**Winner Profile Structure**:
```javascript
{
  profile_id: string,
  sample_size: number,
  feature_ranges: {
    critical_features: { G1, W2, V2, T2 },
    important_features: { G4, W1, T3, W6 },
    supporting_features: { G3, G9, W4, V7 }
  },
  disqualifying_patterns: { ... }
}
```

---

### 12. Red Flag Detector Module

**File**: `src/analysis/RedFlagDetector.js`

**Responsibilities**:
- Check all 25 red flags across 5 categories
- Calculate red flag score
- Determine risk level
- Provide detailed flag information

**Key Functions**:
```javascript
class RedFlagDetector {
  detectRedFlags(features, jsonData)
  
  // Category Checkers
  checkOwnershipFlags(features, jsonData)
  checkVolumeFlags(features, jsonData)
  checkGrowthFlags(features, jsonData)
  checkPriceFlags(features, jsonData)
  checkBehavioralFlags(features, jsonData)
  
  // Individual Flag Checkers
  checkRF1_SingleWalletDominance(walletBalances)
  checkRF2_Top3Concentration(walletBalances)
  // ... RF3-RF25
  
  calculateRedFlagScore(criticalFlags, warningFlags)
  determineRiskLevel(score)
  buildFlagDetails(flags, features, jsonData)
}
```

---

### 13. Classification Module

**File**: `src/analysis/Classifier.js`

**Responsibilities**:
- Classify token as WINNER/LOSER/NEUTRAL
- Calculate classification metrics
- Evaluate classification criteria

**Key Functions**:
```javascript
class Classifier {
  classify(features)
  calculateMetrics(features)
  evaluateWinnerCriteria(metrics)
  evaluateLoserCriteria(metrics)
  determineClassification(isWinner, isLoser)
}
```

---

### 14. Output Generator Module

**File**: `src/output/OutputGenerator.js`

**Responsibilities**:
- Build complete JSON output structure
- Add metadata (low_data flag, transaction_count)
- Generate filename with address prefix
- Write JSON file to output directory
- Handle file system errors

**Key Functions**:
```javascript
class OutputGenerator {
  generateOutput(tokenData, analysisResults)
  buildOutputStructure(tokenData, analysisResults)
  generateFilename(tokenName, tokenAddress)
  ensureOutputDirectory()
  writeOutputFile(filename, data)
  addMetadata(output, tokenData)
}
```

**Output Structure**:
```javascript
{
  token: string,
  address: string,
  chain: 'solana',
  launch_time: number,
  classification: { ... },
  success_score: { ... },
  pattern_match: { ... },
  red_flags: { ... },
  metadata: { ... },
  data: {
    '1h': { ohlcv, transactions, wallet_balances, holders_count, unique_wallets },
    '6h': { ... },
    '24h': { ... }
  }
}
```

---

### 15. Validation Script Module

**File**: `validate.js`

**Responsibilities**:
- Read and parse JSON output files
- Validate data quality
- Detect time gaps in OHLCV
- Detect volume spikes
- Verify holder counts
- Generate validation report

**Key Functions**:
```javascript
async function main(args)
function validateFile(filePath)
function analyzeOHLCV(ohlcvData)
function detectTimeGaps(ohlcvData)
function detectVolumeSpikes(ohlcvData)
function analyzeTransactions(transactions)
function generateReport(validationResults)
```

---

## Data Flow

### Token Processing Flow

```
1. Load Token Specification
   ↓
2. Validate Token Parameters
   ↓
3. Fetch OHLCV Data (with rate limiting)
   ├─► Single request (24h)
   └─► Chunked requests (1h chunks) if needed
   ↓
4. Process OHLCV Data
   ├─► Sort by timestamp
   ├─► Identify missing intervals
   ├─► Generate synthetic records
   └─► Validate data quality
   ↓
5. Fetch Transaction Data (with pagination)
   ├─► Request page 1
   ├─► Check hasMore flag
   ├─► Request page 2, 3, ... (sequential)
   └─► Stop when hasMore = false or 24h exceeded
   ↓
6. Process Transactions
   ├─► Deduplicate by tx_hash
   ├─► Filter by timestamp
   ├─► Transform to two-record format
   ├─► Extract holders
   └─► Calculate balances
   ↓
7. Slice into Time Windows
   ├─► Create 1h window
   ├─► Create 6h window
   └─► Create 24h window
   ↓
8. Feature Engineering
   ├─► Calculate 40 features
   ├─► Compute success score
   ├─► Calculate pattern similarity
   ├─► Detect red flags
   └─► Generate classification
   ↓
9. Generate Output
   ├─► Build JSON structure
   ├─► Add all analysis results
   └─► Write to file
   ↓
10. Log Completion
```

---

## Error Handling Strategy

### Error Categories

**1. Configuration Errors** (Exit immediately)
- Missing API key
- Invalid tokens.json
- Missing required fields
- Invalid file paths

**2. API Errors** (Retry with backoff)
- Network errors (3 retries, 1s/2s/4s)
- Server errors 5xx (3 retries, 2s/4s/8s)
- Rate limit errors (adaptive delay)
- Timeout errors (30s timeout)

**3. Data Processing Errors** (Log and continue)
- Invalid OHLCV records (exclude)
- Invalid transactions (exclude)
- Missing fields (use defaults)

**4. File System Errors** (Log and skip token)
- Cannot create output directory
- Cannot write output file
- Insufficient permissions

### Error Handling Flow

```javascript
try {
  // Token processing
} catch (error) {
  if (error instanceof ConfigurationError) {
    logger.error('Configuration error:', error);
    process.exit(1);
  } else if (error instanceof APIError) {
    if (error.retryable) {
      // Retry with backoff
    } else {
      logger.error('Non-retryable API error:', error);
      // Continue to next token
    }
  } else if (error instanceof DataProcessingError) {
    logger.warn('Data processing error:', error);
    // Continue processing with available data
  } else if (error instanceof FileSystemError) {
    logger.error('File system error:', error);
    // Skip token, continue to next
  } else {
    logger.error('Unexpected error:', error);
    // Continue to next token
  }
}
```

---

## Performance Considerations

### Memory Management

**Strategy**: Clear data after each token to prevent memory accumulation

```javascript
async function processToken(token) {
  let ohlcvData = null;
  let transactions = null;
  let processedData = null;
  
  try {
    // Process token
    ohlcvData = await collectOHLCV(token);
    transactions = await collectTransactions(token);
    processedData = processData(ohlcvData, transactions);
    await writeOutput(processedData);
  } finally {
    // Explicit cleanup
    ohlcvData = null;
    transactions = null;
    processedData = null;
    
    // Hint to garbage collector
    if (global.gc) {
      global.gc();
    }
  }
}
```

### Rate Limiting

**Minimum Delay**: 100ms between requests
**Adaptive Strategy**:
- 3 consecutive rate limits → increase delay by 50%
- 20 consecutive successes → decrease delay by 25% (min 100ms)

### Pagination Optimization

**Transaction Pagination**:
- Limit: 100 transactions per page
- Sequential requests (no parallel)
- Stop early if 24h boundary exceeded
- Cap at 50,000 transactions per token

---

## Security Considerations

### API Key Management

- Store in environment variable `BIRDEYE_API_KEY`
- Never log API key value
- Never include in error messages
- Never write to output files
- Validate at startup

### Input Validation

- Validate all token addresses (Solana base58 format)
- Validate launch timestamps (reasonable range)
- Sanitize token names for filesystem safety
- Validate JSON structure

### Output Security

- Write files with restrictive permissions (0644)
- Prevent path traversal attacks
- Validate output directory exists and is writable
- Handle filename collisions safely

---

## Testing Strategy

### Unit Tests

**Modules to Test**:
- ConfigManager: Input validation, file parsing
- RateLimiter: Delay calculation, adaptive strategy
- OHLCVProcessor: Synthetic record generation, gap detection
- TransactionProcessor: Two-record transformation, balance calculation
- TimeWindowSlicer: Timestamp filtering, boundary conditions
- FeatureEngine: All 40 feature calculations
- SuccessScorer: Score calculation, penalty application
- PatternMatcher: Distance calculation, gate checking
- RedFlagDetector: All 25 flag checks
- Classifier: Classification logic

### Integration Tests

**Scenarios**:
- End-to-end token processing with mock API
- Rate limiting behavior under load
- Error handling and retry logic
- File output generation
- Batch processing with multiple tokens

### Edge Case Tests

**Test Cases**:
- Token with zero transactions
- Token with zero OHLCV data
- Token with all synthetic OHLCV records
- Token with negative balances
- Token with single holder
- Token with 50,000+ transactions (cap)
- API rate limit scenarios
- Network timeout scenarios

---

## Deployment

### Prerequisites

- Node.js >= 18.0.0 (for native fetch API)
- Environment variable: `BIRDEYE_API_KEY`
- Write permissions for output directory

### Installation

```bash
npm install
```

### Configuration

```bash
export BIRDEYE_API_KEY="your_api_key_here"
```

### Execution

```bash
# Default (reads ./tokens.json)
node collect.js

# Custom file
node collect.js --file /path/to/tokens.json

# Validation
node validate.js output/token.json
```

### Directory Structure

```
crypto-token-cli-data-collector/
├── collect.js                 # Main entry point
├── validate.js                # Validation script
├── tokens.json                # Input file
├── package.json
├── src/
│   ├── config/
│   │   └── ConfigManager.js
│   ├── core/
│   │   └── RateLimiter.js
│   ├── api/
│   │   └── BirdeyeClient.js
│   ├── collectors/
│   │   └── DataCollector.js
│   ├── processors/
│   │   ├── OHLCVProcessor.js
│   │   ├── TransactionProcessor.js
│   │   └── TimeWindowSlicer.js
│   ├── analysis/
│   │   ├── FeatureEngine.js
│   │   ├── SuccessScorer.js
│   │   ├── PatternMatcher.js
│   │   ├── RedFlagDetector.js
│   │   └── Classifier.js
│   ├── output/
│   │   └── OutputGenerator.js
│   └── utils/
│       ├── Logger.js
│       └── Validators.js
├── output/                    # Generated output files
└── tests/
    ├── unit/
    └── integration/
```

---

## Logging Strategy

### Log Levels

- **ERROR**: Critical failures, API errors after retries
- **WARN**: Data quality issues, missing fields, validation warnings
- **INFO**: Token processing start/end, batch summary
- **DEBUG**: API requests, retry attempts, feature calculations

### Log Format

```
[2024-01-15 10:30:45] [INFO] Processing token 1 of 5: PEPE
[2024-01-15 10:30:46] [DEBUG] Fetching OHLCV data for address: DezXAZ8z...
[2024-01-15 10:30:47] [DEBUG] Collected 1440 OHLCV records
[2024-01-15 10:30:48] [WARN] Missing 15 OHLCV intervals, generating synthetic records
[2024-01-15 10:30:50] [INFO] Collected 1250 unique transactions
[2024-01-15 10:30:51] [INFO] Identified 187 unique holders
[2024-01-15 10:30:52] [INFO] Success score: 78 (MEDIUM)
[2024-01-15 10:30:52] [INFO] Pattern match: 82 (HIGH confidence)
[2024-01-15 10:30:52] [WARN] Red flags detected: 2 warnings
[2024-01-15 10:30:53] [INFO] Saved output to output/pepe_dezxaz8z.json
[2024-01-15 10:30:53] [INFO] Completed processing token PEPE
```

---

## Future Enhancements

### Phase 2 Features

1. **Multi-chain Support**: Add Ethereum via different API
2. **Real-time Monitoring**: WebSocket support for live data
3. **Historical Analysis**: Compare current tokens with past winners
4. **Alert System**: Notify on high-score tokens
5. **Web Dashboard**: Visualize token data and scores
6. **Database Storage**: Store results in database for querying
7. **Batch Optimization**: Parallel processing with worker threads
8. **Advanced Analytics**: Machine learning model integration

### Scalability Improvements

1. **Caching Layer**: Cache API responses to reduce requests
2. **Queue System**: Process tokens via job queue
3. **Distributed Processing**: Multiple workers for large batches
4. **Incremental Updates**: Update existing token data without full reprocessing

---

## Conclusion

This design provides a robust, modular, and maintainable architecture for collecting and analyzing early-stage cryptocurrency token data. The system is built with clear separation of concerns, comprehensive error handling, and extensive analysis capabilities including feature engineering, success scoring, pattern matching, and red flag detection.

The sequential, deterministic execution model ensures predictable behavior and compliance with API rate limits, while the modular design allows for easy testing, maintenance, and future enhancements.


---

## AUDIT FIX DESIGN UPDATES

### New Modules (Audit Fixes)

#### 16. LiquidityCollector Module

**File**: `src/collectors/LiquidityCollector.js`

**Responsibilities**:
- Fetch liquidity pool data from DEX APIs (Raydium, Orca via Birdeye)
- Collect time series snapshots (1-minute resolution)
- Track pool reserves and liquidity USD value
- Handle missing data gracefully

**Key Functions**:
```javascript
class LiquidityCollector {
  constructor(apiClient)
  async collectLiquidityData(address, launchTime)
  async fetchLiquiditySnapshot(address, timestamp)
  buildLiquidityTimeSeries(snapshots)
}
```

**Output Structure**:
```javascript
{
  liquidity_timeseries: [
    {
      timestamp: number,
      pool_address: string,
      token_reserve: number,
      base_reserve: number,
      liquidity_usd: number
    }
  ]
}
```

---

#### 17. MintBurnTracker Module

**File**: `src/collectors/MintBurnTracker.js`

**Responsibilities**:
- Track token mint events (supply increases)
- Track token burn events (supply decreases)
- Fetch from blockchain RPC or Birdeye events API
- Store in chronological order

**Key Functions**:
```javascript
class MintBurnTracker {
  constructor(apiClient)
  async collectMintBurnEvents(address, launchTime)
  async fetchMintEvents(address, startTime, endTime)
  async fetchBurnEvents(address, startTime, endTime)
  sortByTimestamp(events)
}
```

**Output Structure**:
```javascript
{
  mint_burn_events: [
    {
      type: 'mint' | 'burn',
      amount: number,
      timestamp: number
    }
  ]
}
```

---

#### 18. ExternalEventsLoader Module

**File**: `src/collectors/ExternalEventsLoader.js`

**Responsibilities**:
- Load CEX listing data from cex_listings.json
- Match listings to token address
- Extract price impact data
- Handle missing file gracefully

**Key Functions**:
```javascript
class ExternalEventsLoader {
  constructor()
  loadCEXListings()
  findListingForToken(address)
  calculatePriceImpact(listing, ohlcvData)
}
```

**Output Structure**:
```javascript
{
  cex_listing: {
    exchange_name: string,
    listing_timestamp: number,
    price_before_listing_1h: number | null,
    price_after_listing_1h: number | null,
    price_after_listing_6h: number | null,
    price_after_listing_24h: number | null
  } | null
}
```

---

#### 19. DataConsistencyChecker Module

**File**: `src/validators/DataConsistencyChecker.js`

**Responsibilities**:
- Cross-validate data from multiple sources
- Detect price mismatches (>20% threshold)
- Record data warnings with evidence
- Set inconsistency flags

**Key Functions**:
```javascript
class DataConsistencyChecker {
  constructor()
  checkPriceConsistency(onchainPrice, apiPrice)
  checkVolumeAnomalies(volumeData)
  generateWarnings(checks)
  determineInconsistencyFlag(warnings)
}
```

**Output Structure**:
```javascript
{
  data_inconsistency: boolean,
  data_warnings: [
    {
      type: 'price_mismatch' | 'volume_anomaly',
      details: object,
      severity: 'high' | 'medium' | 'low'
    }
  ]
}
```

---

#### 20. HeliusClient (Fallback API)

**File**: `src/api/HeliusClient.js`

**Responsibilities**:
- Provide fallback for Birdeye API failures
- Fetch transaction data via Helius API
- Implement same interface as BirdeyeClient
- Handle authentication and rate limiting

**Key Functions**:
```javascript
class HeliusClient {
  constructor(apiKey, rateLimiter)
  async fetchTransactions(address, limit, offset)
  async fetchTokenMetadata(address)
  async makeRequest(url, options)
}
```

---

#### 21. RPCClient (Blockchain Fallback)

**File**: `src/api/RPCClient.js`

**Responsibilities**:
- Provide fallback for API failures
- Fetch on-chain data directly via RPC
- Query token accounts and transactions
- Handle RPC-specific errors

**Key Functions**:
```javascript
class RPCClient {
  constructor(rpcUrl)
  async getTokenAccounts(address)
  async getTransactionHistory(address, startTime, endTime)
  async getTokenSupply(address)
}
```

---

### Updated Modules (Audit Fixes)

#### ConfigManager Updates

**New Validations**:
- Accept optional fields: circulating_supply, total_supply, market_cap
- Allow null values for market data fields
- Do not fail if fields are missing

**Updated Schema**:
```javascript
{
  name: string,
  address: string,
  launch_time: number,
  circulating_supply: number | null,
  total_supply: number | null,
  market_cap: number | null
}
```

---

#### BirdeyeClient Updates

**New Method**:
```javascript
async fetchTokenMetadata(address) {
  // Fetch circulating_supply, total_supply, market_cap
  // Return null for missing fields
}
```

---

#### FeatureEngine Updates

**W5 Fix (Whale Count)**:
```javascript
calculateW5_WhaleCount(data24h, circulatingSupply) {
  if (circulatingSupply === null) {
    return null;  // Cannot compute without supply data
  }
  
  const walletBalances = Object.values(data24h.wallet_balances);
  const whaleThreshold = circulatingSupply * 0.01;
  
  return walletBalances.filter(balance => balance >= whaleThreshold).length;
}
```

**Volume Features Fix**:
```javascript
calculateVolumeFeatures(ohlcvData) {
  // Filter out synthetic records
  const realOHLCV = ohlcvData.filter(record => !record.synthetic);
  
  // Compute V1-V10 using realOHLCV only
  const V1 = realOHLCV.reduce((sum, r) => sum + r.volume, 0);
  // ... rest of volume features
}
```

---

#### RedFlagDetector Updates

**RF19 Fix (Rug Pull Detection)**:
```javascript
checkRF19_RugPullSignature(liquidityTimeseries) {
  if (!liquidityTimeseries || liquidityTimeseries.length < 2) {
    return { flag: null, evidence: 'Insufficient liquidity data' };
  }
  
  for (let i = 1; i < liquidityTimeseries.length; i++) {
    const prev = liquidityTimeseries[i-1];
    const curr = liquidityTimeseries[i];
    const timeDiff = curr.timestamp - prev.timestamp;
    const liquidityDrop = (prev.liquidity_usd - curr.liquidity_usd) / prev.liquidity_usd;
    
    if (timeDiff <= 3600 && liquidityDrop > 0.70) {
      return {
        flag: true,
        evidence: {
          timestamp: curr.timestamp,
          prev_liquidity: prev.liquidity_usd,
          curr_liquidity: curr.liquidity_usd,
          drop_percent: liquidityDrop * 100,
          time_window_seconds: timeDiff
        }
      };
    }
  }
  
  return { flag: false, evidence: 'No significant liquidity removal detected' };
}
```

**RF17 Fix (Wash Trading)**:
```javascript
checkRF17_WashTrading(volumeData, priceData, liquidityData) {
  const volumeHigh = this.isVolumeHigh(volumeData);
  const priceChange = this.calculatePriceChange(priceData);
  const liquidityLow = liquidityData ? this.isLiquidityLow(liquidityData) : null;
  const liquidityDecreasing = liquidityData ? this.isLiquidityDecreasing(liquidityData) : null;
  
  if (volumeHigh && priceChange < 0.02) {
    if (liquidityData && (liquidityLow || liquidityDecreasing)) {
      return {
        flag: true,
        evidence: {
          volume_high: true,
          price_change_percent: priceChange * 100,
          liquidity_low: liquidityLow,
          liquidity_decreasing: liquidityDecreasing
        }
      };
    } else if (!liquidityData) {
      // Partial detection without liquidity context
      return {
        flag: true,
        evidence: {
          volume_high: true,
          price_change_percent: priceChange * 100,
          liquidity_context: 'unavailable',
          warning: 'Detection without liquidity data - may be unreliable'
        }
      };
    }
  }
  
  return { flag: false, evidence: 'No wash trading pattern detected' };
}
```

---

#### PatternMatcher Updates

**Winner Profile Loading**:
```javascript
class PatternMatcher {
  constructor() {
    this.winnerProfile = null;
    this.patternMatchingEnabled = false;
    this.loadWinnerProfile();
  }
  
  loadWinnerProfile() {
    try {
      const profilePath = 'winner_profile.json';
      if (!fs.existsSync(profilePath)) {
        logger.warn('winner_profile.json not found - pattern matching DISABLED');
        return;
      }
      
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      
      if (profile.sample_size === 0 || profile.sample_size === null) {
        logger.warn('winner_profile.json is empty (sample_size=0) - pattern matching DISABLED');
        return;
      }
      
      this.winnerProfile = profile;
      this.patternMatchingEnabled = true;
      logger.info(`Loaded winner profile with ${profile.sample_size} samples`);
    } catch (error) {
      logger.error(`Failed to load winner profile: ${error.message}`);
    }
  }
  
  calculateSimilarity(features) {
    if (!this.patternMatchingEnabled) {
      return {
        score: null,
        confidence: null,
        enabled: false,
        reason: 'Winner profile not available'
      };
    }
    
    // Proceed with pattern matching
    // ... existing logic
  }
}
```

---

#### OutputGenerator Updates

**Updated Output Schema**:
```javascript
{
  token: string,
  address: string,
  chain: string,
  launch_time: number,
  
  // NEW: Market data
  circulating_supply: number | null,
  total_supply: number | null,
  market_cap: number | null,
  
  // NEW: Liquidity data
  liquidity_timeseries: Array<{
    timestamp: number,
    pool_address: string,
    token_reserve: number,
    base_reserve: number,
    liquidity_usd: number
  }>,
  
  // NEW: Mint/burn events
  mint_burn_events: Array<{
    type: 'mint' | 'burn',
    amount: number,
    timestamp: number
  }>,
  
  // NEW: Data quality
  data_inconsistency: boolean,
  data_warnings: Array<{
    type: string,
    details: object,
    severity: string
  }>,
  
  // NEW: External events
  cex_listing: {
    exchange_name: string,
    listing_timestamp: number,
    price_before_listing_1h: number | null,
    price_after_listing_1h: number | null,
    price_after_listing_6h: number | null,
    price_after_listing_24h: number | null
  } | null,
  
  // NEW: Metadata
  data_source: 'birdeye' | 'helius' | 'rpc',
  pattern_match_enabled: boolean,
  
  classification: { ... },
  success_score: { ... },
  pattern_match: { ... },
  red_flags: { ... },
  metadata: { ... },
  
  data: {
    '1h': {
      ohlcv: Array<{
        timestamp: number,
        open: number,
        high: number,
        low: number,
        close: number,
        volume: number,
        synthetic: boolean  // NEW: Synthetic flag
      }>,
      transactions: [ ... ],
      wallet_balances: { ... },
      holders_count: number,
      unique_wallets: number
    },
    '6h': { ... },
    '24h': { ... }
  }
}
```

---

#### DataCollector Updates

**Fallback Strategy**:
```javascript
async collectTokenData(token) {
  let ohlcvData, transactions, metadata;
  let dataSource = 'birdeye';
  
  try {
    // Try Birdeye first
    ohlcvData = await this.birdeyeClient.fetchOHLCV(...);
    transactions = await this.birdeyeClient.fetchTransactions(...);
    metadata = await this.birdeyeClient.fetchTokenMetadata(...);
  } catch (error) {
    logger.warn(`Birdeye failed: ${error.message}, trying Helius...`);
    
    try {
      // Fallback to Helius
      transactions = await this.heliusClient.fetchTransactions(...);
      dataSource = 'helius';
    } catch (heliusError) {
      logger.warn(`Helius failed: ${heliusError.message}, trying RPC...`);
      
      try {
        // Fallback to RPC
        transactions = await this.rpcClient.getTransactionHistory(...);
        dataSource = 'rpc';
      } catch (rpcError) {
        logger.error('All data sources failed');
        throw rpcError;
      }
    }
  }
  
  return { ohlcvData, transactions, metadata, dataSource };
}
```

---

#### collect.js Updates

**Batching**:
```javascript
const BATCH_SIZE = 5;

for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(tokens.length / BATCH_SIZE);
  
  logger.info(`Processing batch ${batchNum} of ${totalBatches}`);
  
  const batch = tokens.slice(i, i + BATCH_SIZE);
  
  for (const token of batch) {
    await processToken(token);
  }
}
```

**Caching**:
```javascript
const forceReprocess = process.argv.includes('--force');

for (const token of tokens) {
  const outputPath = `output/${token.name}_${token.address.substring(0,8)}.json`;
  
  if (!forceReprocess && fs.existsSync(outputPath)) {
    logger.info(`Skipping ${token.name} - output already exists (use --force to reprocess)`);
    continue;
  }
  
  await processToken(token);
}
```

---

## Audit Fix Summary

### Critical Fixes Applied:
1. ✅ Added market data fields (supply, market cap) to token schema
2. ✅ Created winner_profile.json template (pattern matching disabled until populated)
3. ✅ Created cex_listings.json template for external events
4. ⚠️ W5 fix requires implementation (check circulating_supply before computing)
5. ⚠️ RF19 fix requires implementation (liquidity-based rug pull detection)
6. ⚠️ RF17 fix requires implementation (liquidity context for wash trading)
7. ⚠️ Synthetic OHLCV filtering requires implementation
8. ⚠️ New modules require implementation (LiquidityCollector, MintBurnTracker, etc.)

### Design Principles Maintained:
- No redesign or new architecture
- Existing 4-layer structure preserved
- Missing data handled gracefully (null values)
- System continues processing with partial data
- Backward compatible with existing code

### Scalability Improvements:
- Simple batching (groups of 5 tokens)
- Basic caching (skip existing output files)
- Fallback strategy (removes single point of failure)

### Data Quality Improvements:
- Cross-validation of data sources
- Inconsistency detection and flagging
- Synthetic data exclusion from analysis
- Evidence-based red flag detection

# Requirements Document

## Introduction

The Crypto Token CLI Data Collector is a command-line tool that collects and processes early-stage trading data for cryptocurrency tokens. The tool fetches OHLCV (Open, High, Low, Close, Volume) data and transaction history from the Birdeye API, builds a holder list, calculates wallet balances, and outputs structured JSON files with data sliced into time intervals (1 hour, 6 hours, 24 hours) for subsequent analysis. The tool supports both single-token and batch processing modes, allowing users to efficiently collect data for multiple tokens in a single execution with independent error handling per token.

### Project Structure

```
crypto-token-cli-data-collector/
├── collect.js          (main CLI script)
├── tokens.json         (input file with token list)
├── output/             (directory for JSON outputs)
│   ├── pepe.json      (example output for token)
│   ├── bonk.json      (example output for token)
```

The main entry point is `collect.js`, which reads token specifications from `tokens.json` and writes all output files to the `output/` directory with filenames based on token names.

## Glossary

- **CLI_Tool**: The command-line application that orchestrates data collection
- **Birdeye_API**: External API service providing cryptocurrency market data
- **OHLCV_Data**: Open, High, Low, Close, Volume price data at specific time intervals
- **Transaction_Record**: A blockchain transaction involving the token
- **Transaction_Identifier**: Unique identifier for a transaction (transaction hash or transaction ID)
- **Holder_List**: Collection of wallet addresses that hold the token
- **Wallet_Balance**: The token amount held by a specific wallet address
- **Time_Slice**: A subset of data covering a specific time period (1h, 6h, or 24h)
- **Launch_Timestamp**: Unix timestamp marking when the token was launched
- **Token_Address**: Blockchain address identifying the token
- **Token_Specification**: A complete set of parameters defining a token (name, address, launch timestamp)
- **Batch_Mode**: Processing mode where multiple tokens are processed sequentially
- **Tokens_File**: The `tokens.json` file containing an array of token specifications
- **Output_Directory**: The `output/` directory where all JSON output files are saved
- **Rate_Limiter**: Component that manages API request timing to avoid rate limits
- **JSON_Output**: Structured data file in JSON format
- **Pagination_Cursor**: Token or identifier returned by the API to fetch the next page of results
- **Validation_Script**: Separate script or module that analyzes JSON output files for data quality
- **Validation_Report**: Output from the Validation_Script identifying data quality issues
- **Time_Gap**: Missing OHLCV data point in the expected 1-minute interval sequence
- **Volume_Spike**: OHLCV volume value that exceeds a statistical threshold indicating potential data anomaly
- **Unique_Holder_Count**: The total number of distinct wallet addresses in the Holder_List

## Requirements

### Requirement 1: Accept Token Input Parameters

**User Story:** As a crypto analyst, I want to provide token details via the tokens.json file or command-line arguments, so that I can specify which tokens to analyze.

#### Acceptance Criteria

1. WHEN the CLI_Tool is executed without command-line arguments, THE CLI_Tool SHALL read token specifications from the Tokens_File located at `tokens.json` in the project root
2. WHEN reading from the Tokens_File, THE CLI_Tool SHALL parse the JSON array of token specifications
3. WHEN the CLI_Tool is executed with command-line arguments, THE CLI_Tool SHALL accept a token name as a required parameter
4. WHEN the CLI_Tool is executed with command-line arguments, THE CLI_Tool SHALL accept a token address as a required parameter
5. WHEN the CLI_Tool is executed with command-line arguments, THE CLI_Tool SHALL accept a launch timestamp as a required parameter
6. WHEN processing token specifications from any source, THE CLI_Tool SHALL validate that each token specification contains name, address, and launch timestamp fields
7. IF the Tokens_File does not exist and no command-line arguments are provided, THEN THE CLI_Tool SHALL display an error message and exit with a non-zero status code
8. IF the Tokens_File cannot be parsed as valid JSON, THEN THE CLI_Tool SHALL display an error message and exit with a non-zero status code
9. IF any required parameter is missing for any token, THEN THE CLI_Tool SHALL display an error message identifying the problematic token and exit with a non-zero status code
10. WHEN all required parameters are provided, THE CLI_Tool SHALL validate that each launch timestamp is a valid Unix timestamp

### Requirement 2: Fetch OHLCV Data with Retry Logic

**User Story:** As a crypto analyst, I want to retrieve OHLCV price data at 1-minute intervals with robust error handling, so that I can analyze price movements reliably.

#### Acceptance Criteria

1. WHEN token parameters are validated, THE CLI_Tool SHALL request OHLCV data from the Birdeye_API with a 1-minute interval
2. WHEN the Birdeye_API returns OHLCV data, THE CLI_Tool SHALL store the data in memory
3. IF the Birdeye_API request fails with a network error, THEN THE CLI_Tool SHALL retry up to 3 times with exponential backoff starting at 1 second (1s, 2s, 4s)
4. IF the Birdeye_API request fails with a server error (HTTP 5xx), THEN THE CLI_Tool SHALL retry up to 3 times with exponential backoff starting at 2 seconds (2s, 4s, 8s)
5. WHEN OHLCV data is received, THE CLI_Tool SHALL verify that each record contains open, high, low, close, volume, and timestamp fields
6. IF OHLCV data validation fails, THEN THE CLI_Tool SHALL log the validation error and exclude the invalid record from processing

### Requirement 3: Fetch Transaction History with Pagination and Deduplication

**User Story:** As a crypto analyst, I want to collect all unique transactions for the first 24 hours after launch with proper pagination handling, so that I can analyze trading activity without duplicates.

#### Acceptance Criteria

1. WHEN token parameters are validated, THE CLI_Tool SHALL request transaction records from the Birdeye_API starting from the Launch_Timestamp
2. WHEN the Birdeye_API returns a pagination cursor or token, THE CLI_Tool SHALL store it for subsequent requests
3. WHEN fetching each transaction page, THE CLI_Tool SHALL include the pagination cursor from the previous response in the next request
4. WHEN a transaction page contains no pagination cursor or returns an empty cursor value, THE CLI_Tool SHALL treat it as the final page and stop pagination
5. WHILE a pagination cursor exists AND the most recent transaction timestamp is less than Launch_Timestamp plus 24 hours, THE CLI_Tool SHALL continue fetching additional transaction pages
6. WHEN the most recent transaction timestamp is greater than or equal to Launch_Timestamp plus 24 hours, THE CLI_Tool SHALL stop fetching additional transactions
7. WHEN processing each transaction page, THE CLI_Tool SHALL extract a unique transaction identifier (transaction hash or transaction ID) from each Transaction_Record
8. WHEN a transaction identifier is encountered, THE CLI_Tool SHALL check if it already exists in the accumulated transaction set
9. WHEN a duplicate transaction identifier is detected, THE CLI_Tool SHALL exclude that Transaction_Record from the accumulated results
10. WHEN processing paginated results, THE CLI_Tool SHALL accumulate only unique Transaction_Records in chronological order based on timestamp
11. WHEN pagination completes, THE CLI_Tool SHALL verify that no duplicate transaction identifiers exist in the final transaction set
12. IF the Birdeye_API request fails, THEN THE CLI_Tool SHALL log the error and retry up to 3 times with exponential backoff starting at 1 second

### Requirement 4: Manage API Rate Limits with Adaptive Strategy

**User Story:** As a system operator, I want the tool to respect API rate limits with intelligent handling, so that requests are not rejected and throughput is optimized.

#### Acceptance Criteria

1. WHEN the Rate_Limiter is initialized, THE Rate_Limiter SHALL configure a minimum delay of 100 milliseconds between API requests
2. WHEN the CLI_Tool makes an API request, THE Rate_Limiter SHALL enforce the configured delay before allowing the next request
3. IF the Birdeye_API returns a rate limit error response (HTTP 429), THEN THE CLI_Tool SHALL extract the retry-after header value
4. WHEN a retry-after header is present, THE CLI_Tool SHALL wait for the specified duration plus 500 milliseconds buffer before retrying
5. WHEN a retry-after header is absent, THE CLI_Tool SHALL wait for 5 seconds before retrying
6. WHEN multiple API requests are queued, THE Rate_Limiter SHALL process them sequentially with appropriate delays
7. WHEN the Rate_Limiter detects 3 consecutive rate limit errors, THE Rate_Limiter SHALL increase the minimum delay by 50 percent
8. WHEN the Rate_Limiter completes 20 consecutive successful requests, THE Rate_Limiter SHALL decrease the minimum delay by 25 percent to a minimum of 100 milliseconds

### Requirement 5: Build Holder List from Transactions

**User Story:** As a crypto analyst, I want to identify all wallet addresses that hold the token, so that I can analyze holder distribution.

#### Acceptance Criteria

1. WHEN transaction records are collected, THE CLI_Tool SHALL extract unique wallet addresses from sender and receiver fields
2. WHEN processing transactions, THE CLI_Tool SHALL maintain a deduplicated list of wallet addresses
3. WHEN a wallet address appears in multiple transactions, THE CLI_Tool SHALL include it only once in the Holder_List
4. WHEN the Holder_List is complete, THE CLI_Tool SHALL store it in memory for balance calculation

### Requirement 6: Calculate Wallet Balances

**User Story:** As a crypto analyst, I want to calculate token balances for each holder, so that I can understand token distribution.

#### Acceptance Criteria

1. WHEN the Holder_List is built, THE CLI_Tool SHALL initialize each wallet balance to zero
2. WHEN processing each Transaction_Record, THE CLI_Tool SHALL subtract the transaction amount from the sender wallet balance
3. WHEN processing each Transaction_Record, THE CLI_Tool SHALL add the transaction amount to the receiver wallet balance
4. WHEN all transactions are processed, THE CLI_Tool SHALL produce a final Wallet_Balance for each address in the Holder_List
5. WHEN calculating balances, THE CLI_Tool SHALL handle transactions in chronological order based on timestamp

### Requirement 7: Slice Data into Time Intervals with Strict Timestamp Filtering

**User Story:** As a crypto analyst, I want data organized into 1-hour, 6-hour, and 24-hour intervals with strict timestamp filtering and no duplicates, so that I can analyze different time periods with precise boundaries and no data overlap or gaps.

#### Acceptance Criteria

1. WHEN all data is collected, THE CLI_Tool SHALL create a Time_Slice containing data from Launch_Timestamp (inclusive) to Launch_Timestamp plus 3600 seconds (exclusive) for the 1-hour interval
2. WHEN all data is collected, THE CLI_Tool SHALL create a Time_Slice containing data from Launch_Timestamp (inclusive) to Launch_Timestamp plus 21600 seconds (exclusive) for the 6-hour interval
3. WHEN all data is collected, THE CLI_Tool SHALL create a Time_Slice containing data from Launch_Timestamp (inclusive) to Launch_Timestamp plus 86400 seconds (exclusive) for the 24-hour interval
4. WHEN creating each Time_Slice, THE CLI_Tool SHALL include OHLCV_Data, Transaction_Records, and Wallet_Balance data for that time period
5. WHEN filtering Transaction_Records for a Time_Slice, THE CLI_Tool SHALL include only records where the transaction timestamp satisfies: slice_start_timestamp <= transaction_timestamp < slice_end_timestamp
6. WHEN filtering OHLCV_Data for a Time_Slice, THE CLI_Tool SHALL include only records where the OHLCV timestamp satisfies: slice_start_timestamp <= ohlcv_timestamp < slice_end_timestamp
7. WHEN a Transaction_Record timestamp equals the slice end boundary exactly, THE CLI_Tool SHALL exclude it from that slice
8. WHEN an OHLCV_Data record timestamp equals the slice end boundary exactly, THE CLI_Tool SHALL exclude it from that slice
9. WHEN a Transaction_Record timestamp equals the slice start boundary exactly, THE CLI_Tool SHALL include it in that slice
10. WHEN an OHLCV_Data record timestamp equals the slice start boundary exactly, THE CLI_Tool SHALL include it in that slice
11. WHEN calculating Wallet_Balance for a Time_Slice, THE CLI_Tool SHALL process only Transaction_Records where the transaction timestamp satisfies: slice_start_timestamp <= transaction_timestamp < slice_end_timestamp
12. WHEN filtering records for any Time_Slice, THE CLI_Tool SHALL ensure no duplicate Transaction_Records appear in the slice by verifying unique transaction identifiers
13. WHEN filtering records for any Time_Slice, THE CLI_Tool SHALL ensure no duplicate OHLCV_Data records appear in the slice by verifying unique OHLCV timestamps

### Requirement 8: Generate JSON Output to Output Directory

**User Story:** As a crypto analyst, I want structured JSON output files saved to the output/ directory with filenames based on token names, so that I can perform further analysis with other tools.

#### Acceptance Criteria

1. WHEN all Time_Slices are created for a token, THE CLI_Tool SHALL generate a separate JSON_Output file for that token containing all three time slices
2. WHEN generating JSON_Output, THE CLI_Tool SHALL include token metadata (name, address, launch timestamp)
3. WHEN generating JSON_Output, THE CLI_Tool SHALL structure data with clearly labeled sections for each Time_Slice
4. WHEN writing the JSON_Output file, THE CLI_Tool SHALL save it to the Output_Directory located at `output/` in the project root
5. WHEN writing the JSON_Output file, THE CLI_Tool SHALL use the token name as the filename with `.json` extension (e.g., `pepe.json`, `bonk.json`)
6. IF the Output_Directory does not exist, THEN THE CLI_Tool SHALL create it before writing any output files
7. WHEN processing multiple tokens, THE CLI_Tool SHALL generate a separate JSON_Output file for each token in the Output_Directory
8. WHEN the JSON_Output file is written successfully, THE CLI_Tool SHALL log the output file path relative to the project root
9. IF the JSON_Output file cannot be written, THEN THE CLI_Tool SHALL log the error and continue processing remaining tokens when in batch mode
10. IF a JSON_Output file with the same name already exists in the Output_Directory, THEN THE CLI_Tool SHALL overwrite it with the new data

### Requirement 9: Process Multiple Tokens Sequentially with Isolated Error Handling

**User Story:** As a crypto analyst, I want to process multiple tokens in a single execution with independent error handling, so that I can collect data for multiple tokens efficiently without one failure stopping the entire batch.

#### Acceptance Criteria

1. WHEN multiple tokens are provided, THE CLI_Tool SHALL process each token sequentially in the order provided
2. WHEN processing each token in batch mode, THE CLI_Tool SHALL execute the complete data collection workflow (OHLCV fetch, transaction fetch, holder list build, balance calculation, time slicing, JSON output)
3. WHEN starting to process a token, THE CLI_Tool SHALL log the token name and its position in the batch (e.g., "Processing token 2 of 5: TokenName")
4. WHEN completing processing for a token, THE CLI_Tool SHALL log the completion status and output file path
5. IF an error occurs while processing a token, THEN THE CLI_Tool SHALL log the error with full context including token name and address
6. WHEN an error occurs for a token, THE CLI_Tool SHALL continue processing the next token in the batch
7. WHEN all tokens have been processed, THE CLI_Tool SHALL log a summary showing total tokens processed, successful completions, and failures
8. WHEN batch processing completes, THE CLI_Tool SHALL exit with a zero status code if at least one token was processed successfully
9. WHEN batch processing completes with all tokens failing, THE CLI_Tool SHALL exit with a non-zero status code
10. WHEN processing tokens in batch mode, THE Rate_Limiter SHALL maintain state across all tokens to ensure consistent rate limiting throughout the entire batch execution

### Requirement 10: Implement Modular Architecture

**User Story:** As a developer, I want the code organized into clean modular functions, so that the tool is maintainable and testable.

#### Acceptance Criteria

1. THE CLI_Tool SHALL separate API interaction logic into dedicated modules
2. THE CLI_Tool SHALL separate data processing logic into dedicated modules
3. THE CLI_Tool SHALL separate output generation logic into dedicated modules
4. THE CLI_Tool SHALL separate command-line interface logic into dedicated modules
5. WHEN a module performs a single responsibility, THE CLI_Tool SHALL encapsulate that logic within the module without external dependencies on other business logic modules

### Requirement 11: Handle Errors Gracefully with Comprehensive Retry Logic

**User Story:** As a system operator, I want clear error messages and robust error handling with intelligent retry strategies, so that I can diagnose issues quickly and maximize data collection success.

#### Acceptance Criteria

1. WHEN an error occurs during execution, THE CLI_Tool SHALL log a descriptive error message to the console including timestamp and error type
2. WHEN an unrecoverable error occurs, THE CLI_Tool SHALL exit with a non-zero status code
3. IF an API request fails with a network error, THEN THE CLI_Tool SHALL retry up to 3 times with exponential backoff starting at 1 second (1s, 2s, 4s)
4. IF an API request fails with a server error (HTTP 5xx), THEN THE CLI_Tool SHALL retry up to 3 times with exponential backoff starting at 2 seconds (2s, 4s, 8s)
5. IF an API request fails with a client error (HTTP 4xx) other than rate limiting, THEN THE CLI_Tool SHALL log the error and not retry
6. IF an API request fails after all retry attempts are exhausted, THEN THE CLI_Tool SHALL log the failure reason with full context and exit gracefully
7. IF invalid input parameters are provided, THEN THE CLI_Tool SHALL display usage instructions and exit with status code 1
8. WHEN logging errors, THE CLI_Tool SHALL include relevant context such as token address, timestamp, API endpoint, and retry attempt number
9. WHEN retrying a failed request, THE CLI_Tool SHALL log the retry attempt number and wait duration
10. IF a transient error occurs during data processing (not API-related), THEN THE CLI_Tool SHALL log the error and continue processing remaining data when possible

### Requirement 12: Validate Data Quality with Separate Validation Script

**User Story:** As a crypto analyst, I want to validate the quality of collected data by detecting gaps, anomalies, and verifying holder counts, so that I can ensure data integrity before performing analysis.

#### Acceptance Criteria

1. WHEN the Validation_Script is executed with a JSON_Output file path, THE Validation_Script SHALL read and parse the JSON_Output file
2. WHEN analyzing OHLCV_Data for each Time_Slice, THE Validation_Script SHALL identify Time_Gaps where consecutive OHLCV records have timestamps differing by more than 60 seconds
3. WHEN a Time_Gap is detected, THE Validation_Script SHALL record the gap start timestamp, gap end timestamp, and gap duration in seconds
4. WHEN analyzing OHLCV_Data for each Time_Slice, THE Validation_Script SHALL calculate the mean volume and standard deviation of volume across all OHLCV records
5. WHEN a Volume_Spike is detected where volume exceeds mean plus 3 standard deviations, THE Validation_Script SHALL record the timestamp and volume value
6. WHEN analyzing the Holder_List for each Time_Slice, THE Validation_Script SHALL count the Unique_Holder_Count by counting distinct wallet addresses
7. WHEN validation analysis is complete, THE Validation_Script SHALL generate a Validation_Report containing all detected Time_Gaps, Volume_Spikes, and Unique_Holder_Count for each Time_Slice
8. WHEN generating the Validation_Report, THE Validation_Script SHALL include token metadata (name, address, launch timestamp) from the JSON_Output file
9. WHEN the Validation_Script processes multiple JSON_Output files, THE Validation_Script SHALL generate a separate Validation_Report section for each token
10. WHEN outputting the Validation_Report, THE Validation_Script SHALL display results to the console in a human-readable format
11. WHEN Time_Gaps or Volume_Spikes are detected, THE Validation_Script SHALL clearly flag them as potential data quality issues in the Validation_Report
12. IF the JSON_Output file cannot be read or parsed, THEN THE Validation_Script SHALL log a descriptive error message and exit with a non-zero status code


## Technical API Specification

### Birdeye API Overview

**Base URL**: `https://public-api.birdeye.so`

**Authentication**: All API requests require authentication via API key in the request header.

**Header Format**:
```
x-api-key: <API_KEY>
```

**Rate Limiting**: Birdeye API enforces rate limits. Implement delays between requests as specified in Requirement 4 (minimum 100ms between requests, adaptive strategy for rate limit errors).

---

### OHLCV Data Endpoint

**Endpoint**: `GET /defi/ohlcv`

**Description**: Retrieves Open, High, Low, Close, Volume data for a token at specified time intervals.

**Required Parameters**:
- `address` (string): Token contract address
- `type` (string): Interval type - use `1m` for 1-minute intervals
- `time_from` (integer): Start timestamp in Unix seconds
- `time_to` (integer): End timestamp in Unix seconds

**Example Request** (curl):
```bash
curl -X GET "https://public-api.birdeye.so/defi/ohlcv?address=So11111111111111111111111111111111111111112&type=1m&time_from=1704067200&time_to=1704153600" \
  -H "x-api-key: YOUR_API_KEY"
```

**Example Response**:
```json
{
  "data": {
    "items": [
      {
        "unixTime": 1704067200,
        "o": 0.000123,
        "h": 0.000125,
        "l": 0.000122,
        "c": 0.000124,
        "v": 15000000
      },
      {
        "unixTime": 1704067260,
        "o": 0.000124,
        "h": 0.000126,
        "l": 0.000123,
        "c": 0.000125,
        "v": 18500000
      }
    ]
  },
  "success": true
}
```

**Response Fields**:
- `unixTime`: Timestamp in Unix seconds
- `o`: Open price
- `h`: High price
- `l`: Low price
- `c`: Close price
- `v`: Volume

**Notes**:
- The API returns data in ascending chronological order
- If no data exists for a specific 1-minute interval, that interval will be missing from the response
- Maximum time range per request may be limited by API - may require multiple requests for 24-hour period

---

### Transactions Endpoint

**Endpoint**: `GET /defi/v3/token/txs`

**Description**: Retrieves transaction history for a token with pagination support.

**Required Parameters**:
- `address` (string): Token contract address
- `limit` (integer): Number of transactions per page (recommended: 100)

**Optional Parameters**:
- `before` (integer): Unix timestamp - fetch transactions before this time
- `offset` (integer): Pagination offset for retrieving next page

**Example Request** (curl - first page):
```bash
curl -X GET "https://public-api.birdeye.so/defi/v3/token/txs?address=So11111111111111111111111111111111111111112&limit=100" \
  -H "x-api-key: YOUR_API_KEY"
```

**Example Request** (curl - subsequent page):
```bash
curl -X GET "https://public-api.birdeye.so/defi/v3/token/txs?address=So11111111111111111111111111111111111111112&limit=100&offset=100" \
  -H "x-api-key: YOUR_API_KEY"
```

**Example Response**:
```json
{
  "data": {
    "items": [
      {
        "txHash": "5J7z...",
        "blockTime": 1704067245,
        "from": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        "to": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        "amount": 1000000000,
        "decimals": 9,
        "type": "swap"
      },
      {
        "txHash": "3K9m...",
        "blockTime": 1704067280,
        "from": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        "to": "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy",
        "amount": 500000000,
        "decimals": 9,
        "type": "transfer"
      }
    ],
    "hasMore": true
  },
  "success": true
}
```

**Response Fields**:
- `txHash`: Unique transaction identifier (transaction hash)
- `blockTime`: Transaction timestamp in Unix seconds
- `from`: Sender wallet address
- `to`: Receiver wallet address
- `amount`: Token amount transferred (in smallest unit based on decimals)
- `decimals`: Token decimal places
- `type`: Transaction type (swap, transfer, etc.)
- `hasMore`: Boolean indicating if more pages are available

**Pagination Mechanism**:

1. **First Request**: Call endpoint with `address` and `limit` parameters only
2. **Check for More Data**: Examine `hasMore` field in response
   - If `hasMore: true`, more pages exist
   - If `hasMore: false`, this is the last page
3. **Next Page**: Increment `offset` by `limit` value and include in next request
   - Example: First request offset=0, second request offset=100, third request offset=200
4. **Stop Condition**: Stop pagination when:
   - `hasMore: false` in response, OR
   - `items` array is empty, OR
   - Most recent transaction timestamp >= Launch_Timestamp + 24 hours

**Pagination Example Flow**:
```
Request 1: ?address=TOKEN&limit=100
  → Returns 100 items, hasMore: true, offset for next: 100

Request 2: ?address=TOKEN&limit=100&offset=100
  → Returns 100 items, hasMore: true, offset for next: 200

Request 3: ?address=TOKEN&limit=100&offset=200
  → Returns 45 items, hasMore: false
  → Stop pagination
```

**Notes**:
- Transactions are returned in descending chronological order (newest first)
- Use `blockTime` field for timestamp filtering
- Use `txHash` field for deduplication (as specified in Requirement 3)
- The `amount` field must be divided by 10^decimals to get the actual token amount
- Enforce rate limiting between pagination requests as specified in Requirement 4

---

### Error Responses

**Rate Limit Error** (HTTP 429):
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 5
}
```

**Authentication Error** (HTTP 401):
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

**Server Error** (HTTP 5xx):
```json
{
  "success": false,
  "error": "Internal server error"
}
```

**Client Error** (HTTP 400):
```json
{
  "success": false,
  "error": "Invalid parameters: address is required"
}
```

---

### Implementation Notes

1. **API Key Management**: Store API key in environment variable or configuration file, never hardcode
2. **Time Range Calculation**: For 24-hour data collection, set `time_from` = Launch_Timestamp and `time_to` = Launch_Timestamp + 86400
3. **Timestamp Validation**: All timestamps are in Unix seconds (not milliseconds)
4. **Decimal Handling**: Transaction amounts must be converted using the `decimals` field to get human-readable values
5. **Sequential Requests**: Always enforce delays between requests to respect rate limits (Requirement 4)
6. **Response Validation**: Check `success` field in response before processing data


## Output JSON Schema

### Schema Definition

The JSON output file for each token follows a strict schema with token metadata at the root level and time-windowed data organized under the `data` object.

**Root Structure**:
```
{
  "token": string,           // Token name
  "address": string,         // Token contract address
  "chain": string,           // Blockchain (e.g., "solana")
  "launch_time": number,     // Launch timestamp in Unix seconds
  "data": {
    "1h": { ... },          // 1-hour time window data
    "6h": { ... },          // 6-hour time window data
    "24h": { ... }          // 24-hour time window data
  }
}
```

---

### Time Window Structure

Each time window (`1h`, `6h`, `24h`) contains the following fields:

```
{
  "ohlcv": [                // Array of OHLCV objects
    { ... }
  ],
  "transactions": [         // Array of transaction objects
    { ... }
  ],
  "wallet_balances": {      // Object mapping wallet addresses to balances
    "wallet_address": balance
  },
  "holders_count": number,  // Total number of unique holders
  "unique_wallets": number  // Total number of unique wallet addresses (same as holders_count)
}
```

**Field Descriptions**:
- `ohlcv`: Array of OHLCV price data objects for the time window
- `transactions`: Array of all transactions within the time window
- `wallet_balances`: Key-value object where keys are wallet addresses and values are token balances
- `holders_count`: Count of unique wallet addresses that hold the token
- `unique_wallets`: Count of unique wallet addresses (identical to holders_count, included for clarity)

---

### OHLCV Object Schema

Each OHLCV object in the `ohlcv` array has the following structure:

```
{
  "timestamp": number,      // Unix timestamp in seconds
  "open": number,           // Opening price
  "high": number,           // Highest price
  "low": number,            // Lowest price
  "close": number,          // Closing price
  "volume": number          // Trading volume
}
```

**Field Types**:
- `timestamp`: Integer (Unix seconds)
- `open`, `high`, `low`, `close`: Float (price values)
- `volume`: Float (volume amount)

---

### Transaction Object Schema

Each transaction object in the `transactions` array has the following structure:

```
{
  "tx_hash": string,        // Unique transaction hash/identifier
  "wallet": string,         // Wallet address involved in transaction
  "side": string,           // Transaction side: "buy" or "sell"
  "amount": number,         // Token amount (human-readable, adjusted for decimals)
  "timestamp": number       // Transaction timestamp in Unix seconds
}
```

**Field Descriptions**:
- `tx_hash`: Unique transaction identifier from blockchain
- `wallet`: The wallet address that performed the transaction
- `side`: Either `"buy"` (receiving tokens) or `"sell"` (sending tokens)
- `amount`: Token amount in human-readable format (already divided by 10^decimals)
- `timestamp`: Unix timestamp in seconds when transaction occurred

**Side Determination Logic**:
- `"buy"`: Wallet is the receiver (`to` field in API response)
- `"sell"`: Wallet is the sender (`from` field in API response)

---

### Wallet Balances Object Schema

The `wallet_balances` object is a key-value mapping:

```
{
  "wallet_address_1": balance_1,
  "wallet_address_2": balance_2,
  ...
}
```

**Structure**:
- **Key**: Wallet address (string)
- **Value**: Token balance (number, human-readable format)

**Example**:
```json
{
  "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU": 1500000.5,
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": 250000.0,
  "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy": 750000.25
}
```

---

### Complete Example JSON Output

**File**: `output/pepe.json`

```json
{
  "token": "PEPE",
  "address": "So11111111111111111111111111111111111111112",
  "chain": "solana",
  "launch_time": 1704067200,
  "data": {
    "1h": {
      "ohlcv": [
        {
          "timestamp": 1704067200,
          "open": 0.000123,
          "high": 0.000125,
          "low": 0.000122,
          "close": 0.000124,
          "volume": 15000000
        },
        {
          "timestamp": 1704067260,
          "open": 0.000124,
          "high": 0.000126,
          "low": 0.000123,
          "close": 0.000125,
          "volume": 18500000
        },
        {
          "timestamp": 1704067320,
          "open": 0.000125,
          "high": 0.000128,
          "low": 0.000124,
          "close": 0.000127,
          "volume": 22000000
        }
      ],
      "transactions": [
        {
          "tx_hash": "5J7zKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          "side": "buy",
          "amount": 1000000,
          "timestamp": 1704067245
        },
        {
          "tx_hash": "3K9mWzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
          "wallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
          "side": "sell",
          "amount": 500000,
          "timestamp": 1704067280
        },
        {
          "tx_hash": "8P2nVsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy",
          "wallet": "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy",
          "side": "buy",
          "amount": 750000,
          "timestamp": 1704067350
        }
      ],
      "wallet_balances": {
        "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU": 1000000,
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": -500000,
        "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy": 750000
      },
      "holders_count": 3,
      "unique_wallets": 3
    },
    "6h": {
      "ohlcv": [
        {
          "timestamp": 1704067200,
          "open": 0.000123,
          "high": 0.000125,
          "low": 0.000122,
          "close": 0.000124,
          "volume": 15000000
        },
        {
          "timestamp": 1704067260,
          "open": 0.000124,
          "high": 0.000126,
          "low": 0.000123,
          "close": 0.000125,
          "volume": 18500000
        }
      ],
      "transactions": [
        {
          "tx_hash": "5J7zKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          "side": "buy",
          "amount": 1000000,
          "timestamp": 1704067245
        },
        {
          "tx_hash": "3K9mWzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
          "wallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
          "side": "sell",
          "amount": 500000,
          "timestamp": 1704067280
        },
        {
          "tx_hash": "8P2nVsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy",
          "wallet": "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy",
          "side": "buy",
          "amount": 750000,
          "timestamp": 1704067350
        },
        {
          "tx_hash": "9L5kRtyUI3CXbuGxvemRN2yfeSOgKhJ8itxidz5yhCUz",
          "wallet": "2aLMnopQR89eFghJKLmNoPqRsTuVwXyZ6dcDefGhIjKl",
          "side": "buy",
          "amount": 2000000,
          "timestamp": 1704070800
        }
      ],
      "wallet_balances": {
        "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU": 1000000,
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": -500000,
        "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy": 750000,
        "2aLMnopQR89eFghJKLmNoPqRsTuVwXyZ6dcDefGhIjKl": 2000000
      },
      "holders_count": 4,
      "unique_wallets": 4
    },
    "24h": {
      "ohlcv": [
        {
          "timestamp": 1704067200,
          "open": 0.000123,
          "high": 0.000125,
          "low": 0.000122,
          "close": 0.000124,
          "volume": 15000000
        },
        {
          "timestamp": 1704067260,
          "open": 0.000124,
          "high": 0.000126,
          "low": 0.000123,
          "close": 0.000125,
          "volume": 18500000
        },
        {
          "timestamp": 1704067320,
          "open": 0.000125,
          "high": 0.000128,
          "low": 0.000124,
          "close": 0.000127,
          "volume": 22000000
        }
      ],
      "transactions": [
        {
          "tx_hash": "5J7zKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          "side": "buy",
          "amount": 1000000,
          "timestamp": 1704067245
        },
        {
          "tx_hash": "3K9mWzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
          "wallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
          "side": "sell",
          "amount": 500000,
          "timestamp": 1704067280
        },
        {
          "tx_hash": "8P2nVsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy",
          "wallet": "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy",
          "side": "buy",
          "amount": 750000,
          "timestamp": 1704067350
        },
        {
          "tx_hash": "9L5kRtyUI3CXbuGxvemRN2yfeSOgKhJ8itxidz5yhCUz",
          "wallet": "2aLMnopQR89eFghJKLmNoPqRsTuVwXyZ6dcDefGhIjKl",
          "side": "buy",
          "amount": 2000000,
          "timestamp": 1704070800
        },
        {
          "tx_hash": "6M8pSuvWU4DYcvGyfnRO3zgfTPjLiJ9juxjez6ziDVa",
          "wallet": "5bNMqrsTS9fGijKLnOpRtUwYzZ7edEfHjLm",
          "side": "sell",
          "amount": 1250000,
          "timestamp": 1704088900
        }
      ],
      "wallet_balances": {
        "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU": 1000000,
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": -500000,
        "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy": 750000,
        "2aLMnopQR89eFghJKLmNoPqRsTuVwXyZ6dcDefGhIjKl": 2000000,
        "5bNMqrsTS9fGijKLnOpRtUwYzZ7edEfHjLm": -1250000
      },
      "holders_count": 5,
      "unique_wallets": 5
    }
  }
}
```

---

### Schema Validation Rules

1. **Required Fields**: All root-level fields (`token`, `address`, `chain`, `launch_time`, `data`) are required
2. **Time Windows**: All three time windows (`1h`, `6h`, `24h`) must be present in the `data` object
3. **Array Types**: `ohlcv` and `transactions` must be arrays (can be empty if no data)
4. **Object Types**: `wallet_balances` must be an object (can be empty if no transactions)
5. **Number Types**: All numeric fields must be valid numbers (not strings)
6. **Timestamp Format**: All timestamps must be Unix seconds (integer)
7. **Side Values**: Transaction `side` field must be either `"buy"` or `"sell"` (lowercase)
8. **Consistency**: `holders_count` and `unique_wallets` must have the same value
9. **Balance Calculation**: Wallet balances can be negative if wallet sold more than it bought within the time window
10. **Chronological Order**: OHLCV and transaction arrays should be in ascending chronological order by timestamp

---

## Input Schema (tokens.json)

### File Format

The input file `tokens.json` must be located in the project root directory and contain a JSON array of token specification objects.

**Structure**:
```json
[
  {
    "name": "PEPE",
    "address": "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    "chain": "eth",
    "launch_time": 1681430400
  },
  {
    "name": "BONK",
    "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "chain": "solana",
    "launch_time": 1672531200
  }
]
```

---

### Field Definitions

**Required Fields** (all fields are mandatory):

1. **`name`** (string)
   - Token name or symbol
   - Used for output filename generation (e.g., `pepe.json`)
   - Must be filesystem-safe (no special characters: `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`)
   - Case-insensitive for filename purposes
   - Example: `"PEPE"`, `"BONK"`, `"Wrapped-ETH"`

2. **`address`** (string)
   - Token contract address on the blockchain
   - Format must match the specified chain:
     - **Ethereum**: 42-character hexadecimal string starting with `0x` (e.g., `0x6982508145454Ce325dDbE47a25d4ec3d2311933`)
     - **Solana**: 32-44 character base58 string (e.g., `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`)
   - Used for API requests to fetch token data
   - Must be a valid, checksummed address for the specified chain

3. **`chain`** (string)
   - Blockchain network identifier
   - **Allowed values**: `"eth"` or `"solana"` (lowercase only)
   - Determines which blockchain to query for token data
   - Must match the address format

4. **`launch_time`** (integer)
   - Token launch timestamp in Unix seconds (not milliseconds)
   - Must be a positive integer
   - Used as the starting point for all time window calculations (1h, 6h, 24h)
   - Should be in the past (cannot collect data for future launches)
   - Example: `1681430400` represents April 13, 2023, 20:00:00 UTC

---

### Validation Rules

The CLI tool must validate the `tokens.json` file according to these rules:

1. **File Existence**: The file must exist at `tokens.json` in the project root
2. **Valid JSON**: The file must contain valid JSON syntax
3. **Array Type**: The root element must be a JSON array
4. **Non-Empty**: The array must contain at least one token object
5. **Required Fields**: Each token object must have all four fields: `name`, `address`, `chain`, `launch_time`
6. **Field Types**:
   - `name`: Must be a non-empty string
   - `address`: Must be a non-empty string
   - `chain`: Must be exactly `"eth"` or `"solana"` (case-sensitive, lowercase)
   - `launch_time`: Must be a positive integer (Unix timestamp in seconds)
7. **Address Format Validation**:
   - If `chain` is `"eth"`: Address must match Ethereum format (42 chars, starts with `0x`, hexadecimal)
   - If `chain` is `"solana"`: Address must match Solana format (32-44 chars, base58 encoding)
8. **Timestamp Validation**:
   - `launch_time` must be a valid Unix timestamp (positive integer)
   - `launch_time` should be in the past (less than current time)
   - `launch_time` should not be unreasonably old (e.g., before 2009 when Bitcoin launched)
9. **Name Validation**:
   - `name` must not contain filesystem-unsafe characters: `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`
   - `name` should not be empty or only whitespace
10. **Uniqueness** (recommended):
    - Token names should be unique to avoid output file conflicts
    - If duplicate names exist, later tokens will overwrite earlier ones

---

### Example with Two Tokens

**File**: `tokens.json`

```json
[
  {
    "name": "PEPE",
    "address": "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    "chain": "eth",
    "launch_time": 1681430400
  },
  {
    "name": "BONK",
    "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "chain": "solana",
    "launch_time": 1672531200
  }
]
```

**Explanation**:
- **PEPE**: Ethereum token launched on April 13, 2023
- **BONK**: Solana token launched on January 1, 2023

---

### Error Handling

If validation fails, the CLI tool must:

1. Display a clear error message identifying:
   - Which token failed validation (by name or array index)
   - Which field caused the error
   - What the expected format is
2. Exit with a non-zero status code (as specified in Requirement 1)
3. Not proceed with data collection

**Example Error Messages**:
```
Error: Token at index 0 has invalid chain value "ethereum". Must be "eth" or "solana".
Error: Token "PEPE" has invalid Ethereum address format. Expected 42-character hex string starting with 0x.
Error: Token "BONK" missing required field "launch_time".
Error: tokens.json file not found in project root.
```


## OHLCV Data Collection Rules

### Time Range Specification

**Collection Window**: OHLCV data must be collected for exactly 24 hours from the token launch time.

**Calculation**:
- **Start Time**: `launch_time` (from tokens.json, Unix seconds)
- **End Time**: `launch_time + 86400` (24 hours = 86400 seconds)
- **Inclusive/Exclusive**: `[launch_time, launch_time + 86400)` (start inclusive, end exclusive)

**Example**:
```
launch_time = 1704067200 (January 1, 2024, 00:00:00 UTC)
Start: 1704067200
End: 1704153600 (January 2, 2024, 00:00:00 UTC)
```

**API Request Parameters**:
- `time_from` = `launch_time`
- `time_to` = `launch_time + 86400`
- `type` = `1m`

---

### Interval Specification

**Fixed Interval**: 1-minute intervals only (no other intervals supported)

**Expected Data Points**: 1440 data points per 24-hour period (24 hours × 60 minutes)

**Timestamp Sequence**: OHLCV records must have timestamps at exact 60-second intervals:
```
launch_time + 0
launch_time + 60
launch_time + 120
launch_time + 180
...
launch_time + 86340 (last interval before 24h mark)
```

**Validation**: Each OHLCV timestamp must satisfy:
- `timestamp % 60 == 0` (aligned to minute boundaries)
- `launch_time <= timestamp < launch_time + 86400`

---

### Missing Data Handling

**Detection**: A data point is considered missing if:
- No OHLCV record exists for an expected 60-second interval
- Gap between consecutive timestamps exceeds 60 seconds

**Handling Strategy**: **Carry Forward Last Close Price**

When a 1-minute interval is missing from the API response:

1. **Create a synthetic OHLCV record** with:
   - `timestamp`: The missing interval timestamp
   - `open`: Last known close price (from previous interval)
   - `high`: Last known close price
   - `low`: Last known close price
   - `close`: Last known close price
   - `volume`: 0 (zero volume for missing interval)

2. **First Interval Special Case**: If the very first interval (at `launch_time`) is missing:
   - Skip synthetic record creation
   - Wait for first available data point
   - Use that data point's open price for subsequent carry-forward operations

3. **Consecutive Missing Intervals**: Apply carry-forward iteratively for each missing interval

**Example**:
```
Available data:
  timestamp: 1704067200, o: 0.000123, h: 0.000125, l: 0.000122, c: 0.000124, v: 15000000
  timestamp: 1704067260, o: 0.000124, h: 0.000126, l: 0.000123, c: 0.000125, v: 18500000
  [MISSING: 1704067320]
  timestamp: 1704067380, o: 0.000126, h: 0.000128, l: 0.000125, c: 0.000127, v: 22000000

Synthetic record for missing interval:
  timestamp: 1704067320, o: 0.000125, h: 0.000125, l: 0.000125, c: 0.000125, v: 0
```

**Rationale**: Carry-forward preserves price continuity and prevents artificial price jumps in analysis.

---

### API Response Pagination

**Issue**: Birdeye API may limit the number of OHLCV records returned in a single request, especially for 24-hour periods with 1-minute intervals (1440 records).

**Strategy**: **Chunked Time-Based Requests**

If the API response is incomplete or truncated:

1. **Split the 24-hour period into smaller time chunks**:
   - Recommended chunk size: **1 hour (3600 seconds)** = 60 data points per request
   - Alternative chunk size: **6 hours (21600 seconds)** = 360 data points per request

2. **Sequential chunk requests**:
   ```
   Request 1: time_from = launch_time, time_to = launch_time + 3600
   Request 2: time_from = launch_time + 3600, time_to = launch_time + 7200
   Request 3: time_from = launch_time + 7200, time_to = launch_time + 10800
   ...
   Request 24: time_from = launch_time + 82800, time_to = launch_time + 86400
   ```

3. **Merge results**: Combine all chunk responses into a single chronological array

4. **Deduplication**: Remove any duplicate timestamps if chunk boundaries overlap

5. **Rate limiting**: Apply rate limiter delays between chunk requests (as specified in Requirement 4)

**Detection of Incomplete Response**:
- If response contains fewer records than expected for the time range
- If the last timestamp in response is significantly before `time_to`
- If API documentation indicates pagination or size limits

**Chunk Size Selection**:
- Start with 1-hour chunks (60 records)
- If API still returns incomplete data, reduce to 30-minute chunks (30 records)
- Never exceed 6-hour chunks to avoid hitting API limits

---

### Data Validation Rules

**Rule 1: Maximum Gap Detection**

After collecting all OHLCV data (including synthetic records for missing intervals):

1. **Calculate gaps** between consecutive timestamps:
   ```
   gap = current_timestamp - previous_timestamp
   ```

2. **Maximum allowed gap**: 300 seconds (5 minutes)

3. **Validation check**:
   - If any gap exceeds 300 seconds, log a warning
   - Include gap details: start timestamp, end timestamp, gap duration
   - Continue processing (do not fail)

4. **Rationale**: Gaps larger than 5 minutes may indicate:
   - API data quality issues
   - Token had no trading activity (acceptable for new tokens)
   - Network or API errors during collection

**Rule 2: Timestamp Sequence Validation**

1. **Chronological order**: Timestamps must be in ascending order
2. **No duplicates**: No two OHLCV records should have the same timestamp
3. **Boundary compliance**: All timestamps must satisfy `launch_time <= timestamp < launch_time + 86400`

**Rule 3: Field Completeness**

Each OHLCV record must have all required fields:
- `timestamp` (integer, non-null)
- `open` (number, non-null, non-negative)
- `high` (number, non-null, non-negative)
- `low` (number, non-null, non-negative)
- `close` (number, non-null, non-negative)
- `volume` (number, non-null, non-negative)

**Rule 4: Price Consistency**

For each OHLCV record:
- `low <= open <= high`
- `low <= close <= high`
- `low <= high`

If any record violates these rules, log a warning but include the record in output.

**Rule 5: Expected Record Count**

After processing (including synthetic records):
- **Minimum expected**: 1380 records (allowing up to 60 missing intervals)
- **Maximum expected**: 1440 records (complete 24-hour coverage)
- **Warning threshold**: If fewer than 1380 records, log a data quality warning

---

### Implementation Workflow

**Step-by-Step Process**:

1. **Calculate time range**:
   - `start = launch_time`
   - `end = launch_time + 86400`

2. **Determine request strategy**:
   - Attempt single request first: `GET /defi/ohlcv?address=TOKEN&type=1m&time_from=start&time_to=end`
   - If response incomplete, switch to chunked requests (1-hour chunks)

3. **Collect raw data**:
   - Make API request(s) with rate limiting
   - Store all returned OHLCV records in memory
   - Merge chunks if using chunked strategy

4. **Sort and deduplicate**:
   - Sort records by timestamp (ascending)
   - Remove duplicate timestamps (keep first occurrence)

5. **Identify missing intervals**:
   - Generate expected timestamp sequence: `[launch_time, launch_time + 60, launch_time + 120, ..., launch_time + 86340]`
   - Compare with actual timestamps
   - Create list of missing intervals

6. **Generate synthetic records**:
   - For each missing interval, create synthetic record using carry-forward strategy
   - Insert synthetic records into sorted array

7. **Validate data**:
   - Check for gaps > 5 minutes
   - Validate timestamp sequence
   - Validate field completeness
   - Validate price consistency
   - Check record count

8. **Log warnings**:
   - Log any validation failures or warnings
   - Include token name and specific issues

9. **Store for time slicing**:
   - Keep complete OHLCV array in memory
   - Use for time window filtering (1h, 6h, 24h) as specified in Requirement 7

---

### Error Handling

**Scenario 1: API Returns No Data**
- Log error: "No OHLCV data returned for token [name] at address [address]"
- Create empty OHLCV array for output
- Continue processing (do not fail entire batch)

**Scenario 2: API Returns Partial Data (< 50% coverage)**
- Log warning: "Incomplete OHLCV data for token [name]: only [count] of 1440 expected records"
- Apply synthetic record generation for missing intervals
- Continue processing

**Scenario 3: All API Requests Fail**
- Log error: "Failed to fetch OHLCV data after all retries for token [name]"
- Create empty OHLCV array for output
- Continue processing next token (batch mode)

**Scenario 4: Invalid Data in Response**
- Log warning: "Invalid OHLCV record at timestamp [timestamp] for token [name]"
- Exclude invalid record
- Treat as missing interval and generate synthetic record
- Continue processing

---

### Summary

**Key Points**:
1. Collect exactly 24 hours of data from `launch_time` to `launch_time + 86400`
2. Use 1-minute intervals only (1440 expected records)
3. Handle missing intervals by carrying forward last close price with zero volume
4. Use chunked requests (1-hour chunks) if API limits response size
5. Validate for gaps larger than 5 minutes (log warning, do not fail)
6. Generate synthetic records to maintain continuous time series
7. Apply rate limiting between all API requests


## Transaction & Holder Processing

### Transaction Data Requirements

**Required Fields**: Each transaction record must contain the following fields after processing:

1. **`tx_hash`** (string)
   - Unique transaction identifier from blockchain
   - Used for deduplication (as specified in Requirement 3)
   - Must be non-empty and unique within the dataset

2. **`wallet`** (string)
   - The wallet address involved in the transaction
   - Extracted from either `from` or `to` field in API response
   - Determination logic:
     - If wallet is receiver (`to` field): This is a BUY transaction for that wallet
     - If wallet is sender (`from` field): This is a SELL transaction for that wallet

3. **`side`** (string)
   - Transaction side from wallet's perspective
   - **Allowed values**: `"buy"` or `"sell"` (lowercase only)
   - **Buy**: Wallet received tokens (wallet = `to` field in API response)
   - **Sell**: Wallet sent tokens (wallet = `from` field in API response)

4. **`amount`** (number)
   - Token amount in human-readable format
   - **Conversion required**: Divide API `amount` field by `10^decimals`
   - Example: API returns `amount: 1000000000, decimals: 9` → Output: `1.0`
   - Must be positive (non-zero, non-negative)

5. **`timestamp`** (integer)
   - Transaction timestamp in Unix seconds
   - Extracted from `blockTime` field in API response
   - Used for chronological ordering and time window filtering

---

### Transaction Collection Process

**Step 1: Fetch Raw Transactions**

1. Use Birdeye API endpoint: `GET /defi/v3/token/txs`
2. Collect all transactions from `launch_time` to `launch_time + 86400` (24 hours)
3. Use pagination as specified in Technical API Specification section
4. Apply rate limiting between requests (Requirement 4)

**Step 2: Filter by Time Window**

Include only transactions where:
```
launch_time <= transaction.blockTime < launch_time + 86400
```

**Step 3: Deduplicate**

1. Extract `txHash` from each transaction
2. Check if `txHash` already exists in accumulated set
3. If duplicate found, exclude the transaction
4. Keep only unique transactions based on `txHash`

**Step 4: Transform to Output Format**

For each unique transaction, create TWO records (one for sender, one for receiver):

**Sender Record** (SELL):
```json
{
  "tx_hash": "5J7z...",
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "side": "sell",
  "amount": 1.0,
  "timestamp": 1704067245
}
```

**Receiver Record** (BUY):
```json
{
  "tx_hash": "5J7z...",
  "wallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "side": "buy",
  "amount": 1.0,
  "timestamp": 1704067245
}
```

**Important**: Each blockchain transaction generates TWO output records (one buy, one sell) because tokens move from sender to receiver.

**Step 5: Sort Chronologically**

Sort all transaction records by `timestamp` in ascending order (oldest first).

---

### Holder Extraction Logic

**Definition**: A holder is any unique wallet address that appears in the transaction history (either as buyer or seller).

**Extraction Process**:

1. **Initialize empty set**: `holders = new Set()`

2. **Iterate through all transaction records**:
   - Extract `wallet` field from each record
   - Add wallet address to `holders` set

3. **Deduplication**: The set automatically ensures uniqueness (each wallet appears only once)

4. **Result**: `holders` set contains all unique wallet addresses

**Example**:
```
Transactions:
  { wallet: "0xAAA...", side: "buy", ... }
  { wallet: "0xBBB...", side: "sell", ... }
  { wallet: "0xAAA...", side: "sell", ... }  // Duplicate wallet
  { wallet: "0xCCC...", side: "buy", ... }

Holders: ["0xAAA...", "0xBBB...", "0xCCC..."]  // 3 unique holders
```

**Holder Count**: The total number of unique wallet addresses in the `holders` set.

---

### Wallet Balance Calculation

**Core Principle**: Balance = Total Buys - Total Sells (from launch time only)

**Critical Assumption**: 
- **Ignore all pre-launch balances**
- Only track token movements from `launch_time` onwards
- Wallets start with zero balance at `launch_time`
- This means calculated balances may be negative if a wallet sold more than it bought within the 24-hour window

**Calculation Algorithm**:

1. **Initialize balance map**:
   ```
   wallet_balances = {}  // Empty object/map
   ```

2. **For each wallet in holders set**:
   ```
   wallet_balances[wallet] = 0  // Start at zero
   ```

3. **Process transactions in chronological order**:
   ```
   For each transaction:
     wallet = transaction.wallet
     amount = transaction.amount
     
     If transaction.side == "buy":
       wallet_balances[wallet] += amount
     
     If transaction.side == "sell":
       wallet_balances[wallet] -= amount
   ```

4. **Result**: `wallet_balances` object contains final balance for each wallet

**Example**:
```
Transactions (chronological):
  1. { wallet: "0xAAA", side: "buy", amount: 1000 }
  2. { wallet: "0xAAA", side: "sell", amount: 300 }
  3. { wallet: "0xBBB", side: "buy", amount: 500 }
  4. { wallet: "0xAAA", side: "buy", amount: 200 }

Calculation:
  0xAAA: 0 + 1000 - 300 + 200 = 900
  0xBBB: 0 + 500 = 500

Final Balances:
  {
    "0xAAA": 900,
    "0xBBB": 500
  }
```

**Negative Balances**:

If a wallet sells more than it bought within the 24-hour window, the balance will be negative:

```
Transactions:
  1. { wallet: "0xCCC", side: "sell", amount: 1000 }
  2. { wallet: "0xCCC", side: "buy", amount: 200 }

Balance:
  0xCCC: 0 - 1000 + 200 = -800
```

**Interpretation**: Negative balance indicates the wallet had pre-launch holdings and sold them during the 24-hour window. This is expected and valid.

---

### Time Window Processing

**Requirement**: Calculate separate holder lists and wallet balances for each time window (1h, 6h, 24h).

**Process for Each Time Window**:

1. **Filter transactions** by time window boundaries:
   ```
   For 1h window:
     Include transactions where: launch_time <= timestamp < launch_time + 3600
   
   For 6h window:
     Include transactions where: launch_time <= timestamp < launch_time + 21600
   
   For 24h window:
     Include transactions where: launch_time <= timestamp < launch_time + 86400
   ```

2. **Extract holders** from filtered transactions (using holder extraction logic above)

3. **Calculate balances** from filtered transactions (using balance calculation algorithm above)

4. **Store results** in time window object:
   ```json
   {
     "transactions": [...],           // Filtered transaction records
     "wallet_balances": {...},        // Calculated balances
     "holders_count": 123,            // Count of unique holders
     "unique_wallets": 123            // Same as holders_count
   }
   ```

**Important**: Each time window has independent holder lists and balances calculated only from transactions within that window.

---

### Edge Case: Low Transaction Volume

**Detection**: A token is considered "low data" if:
- Total transaction count (24-hour window) is less than 50 transactions

**Handling**:

1. **Continue processing**: Do not skip or fail the token
2. **Process normally**: Apply all transaction and holder logic as specified
3. **Add metadata flag**: Include a `low_data` flag in the output JSON

**Output Modification**:

Add a `metadata` section to the root level of the output JSON:

```json
{
  "token": "PEPE",
  "address": "0x...",
  "chain": "solana",
  "launch_time": 1704067200,
  "metadata": {
    "low_data": true,
    "transaction_count": 35,
    "warning": "Token has fewer than 50 transactions in 24-hour window"
  },
  "data": {
    "1h": { ... },
    "6h": { ... },
    "24h": { ... }
  }
}
```

**Metadata Fields**:
- `low_data` (boolean): `true` if transaction count < 50, `false` otherwise
- `transaction_count` (integer): Total number of unique transactions in 24-hour window
- `warning` (string): Human-readable warning message (only present if `low_data` is `true`)

**Rationale**: Low transaction volume may indicate:
- Newly launched token with limited activity
- Low liquidity token
- Data collection issues
- Users should be aware when analyzing the data

---

### Validation Rules

**Rule 1: Transaction Field Completeness**

Each transaction record must have all required fields:
- `tx_hash` (non-empty string)
- `wallet` (non-empty string, valid address format)
- `side` (exactly `"buy"` or `"sell"`)
- `amount` (positive number)
- `timestamp` (positive integer)

If any field is missing or invalid, exclude the transaction and log a warning.

**Rule 2: Transaction Uniqueness**

No two transaction records should have the same `tx_hash` within a time window.

**Rule 3: Chronological Order**

Transaction records in output must be sorted by `timestamp` in ascending order.

**Rule 4: Balance Consistency**

For each time window:
- Sum of all buy amounts should equal sum of all sell amounts (within rounding tolerance)
- If imbalance exceeds 1%, log a warning (may indicate data quality issues)

**Rule 5: Holder Count Consistency**

For each time window:
- `holders_count` must equal `unique_wallets`
- Both must equal the number of keys in `wallet_balances` object

---

### Error Handling

**Scenario 1: No Transactions Found**

If API returns zero transactions for the 24-hour window:
1. Log warning: "No transactions found for token [name] in 24-hour window"
2. Set `low_data: true` in metadata
3. Create empty arrays and objects:
   ```json
   {
     "transactions": [],
     "wallet_balances": {},
     "holders_count": 0,
     "unique_wallets": 0
   }
   ```
4. Continue processing (do not fail)

**Scenario 2: Invalid Transaction Data**

If a transaction record has invalid or missing fields:
1. Log warning: "Invalid transaction [tx_hash] for token [name]: [reason]"
2. Exclude the transaction from processing
3. Continue with remaining transactions

**Scenario 3: Duplicate Transaction Hash**

If duplicate `tx_hash` detected during deduplication:
1. Keep the first occurrence
2. Discard subsequent duplicates
3. Log info: "Duplicate transaction [tx_hash] excluded for token [name]"

**Scenario 4: API Pagination Failure**

If pagination fails after retries:
1. Log error: "Failed to fetch all transactions for token [name]"
2. Process transactions collected so far
3. Set `low_data: true` in metadata
4. Add warning: "Incomplete transaction data due to API errors"

---

### Summary

**Key Points**:
1. Each blockchain transaction generates TWO output records (one buy, one sell)
2. Holders are unique wallet addresses extracted from all transactions
3. Wallet balances = Total Buys - Total Sells (starting from zero at launch time)
4. Negative balances are valid (indicate pre-launch holdings sold during window)
5. Tokens with <50 transactions are flagged as "low data" but still processed
6. Each time window (1h, 6h, 24h) has independent holder lists and balances
7. All transactions must be deduplicated by `tx_hash` before processing
8. Transactions must be processed in chronological order for accurate balance calculation


## Execution Flow

### Overview

The CLI tool executes in a **strictly sequential, deterministic manner** with no parallel processing. All operations are performed in a fixed order to ensure predictable behavior and compliance with API rate limits.

**Core Principles**:
1. **Sequential Execution**: Process one token at a time, never in parallel
2. **Sequential API Calls**: Make one API request at a time, never concurrent
3. **Mandatory Delays**: Enforce delays between all API requests (rate limiting)
4. **Deterministic Order**: Always follow the same execution sequence
5. **Isolated Error Handling**: Token failures do not stop batch processing

---

### High-Level Execution Sequence

```
START
  ↓
1. Initialize CLI Tool
  ↓
2. Load and Validate tokens.json
  ↓
3. Initialize Rate Limiter
  ↓
4. FOR EACH token in tokens.json (sequential):
     ↓
   4.1. Log: "Processing token X of Y: [token_name]"
     ↓
   4.2. Fetch OHLCV Data
     ↓
   4.3. Fetch Transaction Data (with pagination)
     ↓
   4.4. Filter Data by Timestamp
     ↓
   4.5. Build Holder List
     ↓
   4.6. Compute Wallet Balances
     ↓
   4.7. Slice Data into Time Windows
     ↓
   4.8. Generate and Save JSON Output
     ↓
   4.9. Log: "Completed token [token_name]"
     ↓
5. Log Batch Summary
  ↓
6. Exit with Status Code
  ↓
END
```

---

### Step-by-Step Execution Details

### **Phase 1: Initialization**

**Step 1.1: Initialize CLI Tool**
- Load environment variables (API key)
- Initialize logging system
- Set up error handling
- Record start time

**Step 1.2: Load tokens.json**
- Read file from project root: `./tokens.json`
- Parse JSON content
- Validate JSON structure (must be array)
- If file not found or invalid JSON: Display error and exit with code 1

**Step 1.3: Validate Token Specifications**
- For each token in array:
  - Validate all required fields present: `name`, `address`, `chain`, `launch_time`
  - Validate field types and formats (as specified in Input Schema section)
  - Validate `chain` value is `"eth"` or `"solana"`
  - Validate `address` format matches chain
  - Validate `launch_time` is valid Unix timestamp
- If any validation fails: Display error identifying problematic token and exit with code 1
- If validation succeeds: Log "Loaded [count] tokens for processing"

**Step 1.4: Initialize Rate Limiter**
- Set minimum delay: 100 milliseconds (as specified in Requirement 4)
- Initialize consecutive error counter: 0
- Initialize consecutive success counter: 0
- Log "Rate limiter initialized with 100ms minimum delay"

---

### **Phase 2: Token Processing Loop**

**CRITICAL**: Process tokens sequentially in the order they appear in tokens.json array. Never process multiple tokens in parallel.

For each token, execute the following steps in order:

---

### **Step 2.1: Token Processing Start**

**Action**: Log token processing start
- Log message: `"Processing token [index] of [total]: [token_name]"`
- Example: `"Processing token 1 of 5: PEPE"`
- Record token start time

---

### **Step 2.2: Fetch OHLCV Data**

**Objective**: Collect 24 hours of 1-minute interval OHLCV data

**Substeps**:

**2.2.1: Calculate Time Range**
```
start_time = token.launch_time
end_time = token.launch_time + 86400
```

**2.2.2: Determine Request Strategy**
- Default: Single request for full 24-hour period
- Fallback: Chunked requests (1-hour chunks) if single request fails or returns incomplete data

**2.2.3: Make OHLCV API Request(s)**

**For Single Request Strategy**:
1. Construct request URL:
   ```
   GET https://public-api.birdeye.so/defi/ohlcv?address=[token.address]&type=1m&time_from=[start_time]&time_to=[end_time]
   ```
2. Add header: `x-api-key: [API_KEY]`
3. **Apply rate limiter delay** (wait minimum delay before request)
4. Execute HTTP GET request
5. **Apply rate limiter delay** (wait minimum delay after request)
6. Handle response:
   - If success (HTTP 200): Parse JSON and extract `data.items` array
   - If rate limit error (HTTP 429): Apply retry logic (Requirement 4)
   - If server error (HTTP 5xx): Retry up to 3 times with exponential backoff (2s, 4s, 8s)
   - If network error: Retry up to 3 times with exponential backoff (1s, 2s, 4s)
   - If all retries fail: Log error, set OHLCV data to empty array, continue to next step

**For Chunked Request Strategy** (if single request incomplete):
1. Split 24-hour period into 24 one-hour chunks
2. For each chunk (sequential, not parallel):
   - Calculate chunk time range: `chunk_start = start_time + (chunk_index * 3600)`
   - Construct request URL with chunk time range
   - **Apply rate limiter delay**
   - Execute HTTP GET request
   - **Apply rate limiter delay**
   - Handle response (same error handling as single request)
   - Store chunk results in memory
3. Merge all chunk results into single chronological array
4. Deduplicate by timestamp (keep first occurrence)

**2.2.4: Process OHLCV Data**
1. Sort records by timestamp (ascending)
2. Identify missing intervals (as specified in OHLCV Data Collection Rules)
3. Generate synthetic records for missing intervals (carry-forward strategy)
4. Validate data (check for gaps > 5 minutes, log warnings)
5. Store complete OHLCV array in memory

**2.2.5: Log OHLCV Collection Result**
- Log: `"Collected [count] OHLCV records for [token_name]"`
- If warnings: Log warnings (gaps, incomplete data, etc.)

---

### **Step 2.3: Fetch Transaction Data**

**Objective**: Collect all transactions for 24-hour period with pagination

**Substeps**:

**2.3.1: Initialize Transaction Collection**
```
transactions = []  // Empty array
seen_tx_hashes = new Set()  // For deduplication
offset = 0
has_more = true
```

**2.3.2: Pagination Loop**

**CRITICAL**: Execute pagination requests sequentially, never in parallel.

While `has_more == true`:

1. **Construct Request URL**:
   ```
   GET https://public-api.birdeye.so/defi/v3/token/txs?address=[token.address]&limit=100&offset=[offset]
   ```

2. **Add Header**: `x-api-key: [API_KEY]`

3. **Apply Rate Limiter Delay** (wait minimum delay before request)

4. **Execute HTTP GET Request**

5. **Apply Rate Limiter Delay** (wait minimum delay after request)

6. **Handle Response**:
   - If success (HTTP 200):
     - Parse JSON and extract `data.items` array
     - Extract `data.hasMore` boolean
   - If rate limit error (HTTP 429): Apply retry logic (Requirement 4)
   - If server error (HTTP 5xx): Retry up to 3 times with exponential backoff (2s, 4s, 8s)
   - If network error: Retry up to 3 times with exponential backoff (1s, 2s, 4s)
   - If all retries fail: Log error, set `has_more = false`, break loop

7. **Process Page Results**:
   - For each transaction in `data.items`:
     - Check if `txHash` exists in `seen_tx_hashes`
     - If duplicate: Skip transaction
     - If unique: Add `txHash` to `seen_tx_hashes`, add transaction to `transactions` array
     - Check if `blockTime >= launch_time + 86400`: If yes, set `has_more = false`

8. **Update Pagination State**:
   - If `data.hasMore == false`: Set `has_more = false`
   - If `data.items` is empty: Set `has_more = false`
   - Otherwise: Increment `offset` by 100 (offset += 100)

9. **Loop**: Repeat from step 1 if `has_more == true`

**2.3.3: Log Transaction Collection Result**
- Log: `"Collected [count] unique transactions for [token_name]"`

---

### **Step 2.4: Filter Data by Timestamp**

**Objective**: Ensure all data is within the 24-hour window

**Substeps**:

**2.4.1: Filter Transactions**
```
filtered_transactions = []
For each transaction in transactions:
  If launch_time <= transaction.blockTime < launch_time + 86400:
    Add transaction to filtered_transactions
```

**2.4.2: Filter OHLCV** (already filtered during collection, but verify)
```
filtered_ohlcv = []
For each ohlcv_record in ohlcv_data:
  If launch_time <= ohlcv_record.unixTime < launch_time + 86400:
    Add ohlcv_record to filtered_ohlcv
```

**2.4.3: Sort Data Chronologically**
- Sort `filtered_transactions` by `blockTime` (ascending)
- Sort `filtered_ohlcv` by `unixTime` (ascending)

**2.4.4: Store Filtered Data**
- Replace `transactions` with `filtered_transactions`
- Replace `ohlcv_data` with `filtered_ohlcv`

---

### **Step 2.5: Build Holder List**

**Objective**: Extract unique wallet addresses from transactions

**Substeps**:

**2.5.1: Initialize Holder Set**
```
holders = new Set()  // Empty set for unique addresses
```

**2.5.2: Transform Transactions to Output Format**

For each transaction in `transactions`:
1. Extract fields: `txHash`, `from`, `to`, `amount`, `decimals`, `blockTime`
2. Convert amount: `human_amount = amount / (10 ^ decimals)`
3. Create TWO output records:
   
   **Sender Record (SELL)**:
   ```
   {
     tx_hash: txHash,
     wallet: from,
     side: "sell",
     amount: human_amount,
     timestamp: blockTime
   }
   ```
   Add `from` address to `holders` set
   
   **Receiver Record (BUY)**:
   ```
   {
     tx_hash: txHash,
     wallet: to,
     side: "buy",
     amount: human_amount,
     timestamp: blockTime
   }
   ```
   Add `to` address to `holders` set

4. Store both records in `processed_transactions` array

**2.5.3: Replace Transaction Array**
- Replace `transactions` with `processed_transactions`

**2.5.4: Convert Holder Set to Array**
```
holder_list = Array.from(holders)  // Convert set to array
```

**2.5.5: Log Holder Count**
- Log: `"Identified [count] unique holders for [token_name]"`

---

### **Step 2.6: Compute Wallet Balances**

**Objective**: Calculate balance for each holder (Total Buys - Total Sells)

**Substeps**:

**2.6.1: Initialize Balance Map**
```
wallet_balances = {}  // Empty object
For each wallet in holder_list:
  wallet_balances[wallet] = 0  // Start at zero
```

**2.6.2: Process Transactions in Chronological Order**
```
For each transaction in transactions (already sorted by timestamp):
  wallet = transaction.wallet
  amount = transaction.amount
  
  If transaction.side == "buy":
    wallet_balances[wallet] += amount
  
  If transaction.side == "sell":
    wallet_balances[wallet] -= amount
```

**2.6.3: Store Balance Map**
- Keep `wallet_balances` object in memory for time window slicing

---

### **Step 2.7: Slice Data into Time Windows**

**Objective**: Create separate datasets for 1h, 6h, and 24h time windows

**Substeps**:

**2.7.1: Define Time Window Boundaries**
```
windows = {
  "1h": { start: launch_time, end: launch_time + 3600 },
  "6h": { start: launch_time, end: launch_time + 21600 },
  "24h": { start: launch_time, end: launch_time + 86400 }
}
```

**2.7.2: For Each Time Window** (process in order: 1h, 6h, 24h):

1. **Filter OHLCV Data**:
   ```
   window_ohlcv = []
   For each ohlcv_record in ohlcv_data:
     If window.start <= ohlcv_record.timestamp < window.end:
       Add ohlcv_record to window_ohlcv
   ```

2. **Filter Transaction Data**:
   ```
   window_transactions = []
   For each transaction in transactions:
     If window.start <= transaction.timestamp < window.end:
       Add transaction to window_transactions
   ```

3. **Build Window Holder List**:
   ```
   window_holders = new Set()
   For each transaction in window_transactions:
     Add transaction.wallet to window_holders
   window_holder_list = Array.from(window_holders)
   ```

4. **Compute Window Wallet Balances**:
   ```
   window_wallet_balances = {}
   For each wallet in window_holder_list:
     window_wallet_balances[wallet] = 0
   
   For each transaction in window_transactions:
     wallet = transaction.wallet
     amount = transaction.amount
     
     If transaction.side == "buy":
       window_wallet_balances[wallet] += amount
     
     If transaction.side == "sell":
       window_wallet_balances[wallet] -= amount
   ```

5. **Create Window Data Object**:
   ```
   window_data = {
     ohlcv: window_ohlcv,
     transactions: window_transactions,
     wallet_balances: window_wallet_balances,
     holders_count: window_holder_list.length,
     unique_wallets: window_holder_list.length
   }
   ```

6. **Store Window Data**: Add to output structure under appropriate key ("1h", "6h", or "24h")

---

### **Step 2.8: Generate and Save JSON Output**

**Objective**: Create JSON file with all collected and processed data

**Substeps**:

**2.8.1: Check for Low Data Condition**
```
total_transaction_count = transactions.length
low_data = (total_transaction_count < 50)
```

**2.8.2: Build Output JSON Structure**
```
output = {
  token: token.name,
  address: token.address,
  chain: token.chain,
  launch_time: token.launch_time,
  data: {
    "1h": window_data_1h,
    "6h": window_data_6h,
    "24h": window_data_24h
  }
}

If low_data == true:
  output.metadata = {
    low_data: true,
    transaction_count: total_transaction_count,
    warning: "Token has fewer than 50 transactions in 24-hour window"
  }
```

**2.8.3: Ensure Output Directory Exists**
- Check if `./output/` directory exists
- If not exists: Create directory
- If creation fails: Log error and skip to next token

**2.8.4: Generate Output Filename**
```
filename = token.name.toLowerCase() + ".json"
filepath = "./output/" + filename
```

**2.8.5: Write JSON File**
1. Convert `output` object to JSON string (with pretty formatting, 2-space indent)
2. Write JSON string to `filepath`
3. If write succeeds: Log `"Saved output to [filepath]"`
4. If write fails: Log error `"Failed to write output file for [token_name]: [error]"`

---

### **Step 2.9: Token Processing Complete**

**Action**: Log token completion
- Log: `"Completed processing token [token_name]"`
- If errors occurred: Log error summary
- Record token end time
- Calculate token processing duration

---

### **Phase 3: Batch Completion**

### **Step 3.1: Log Batch Summary**

After all tokens processed, log summary:
```
"Batch processing complete"
"Total tokens: [total_count]"
"Successful: [success_count]"
"Failed: [failure_count]"
"Total duration: [duration]"
```

### **Step 3.2: Determine Exit Status**

```
If success_count > 0:
  exit_code = 0  // Success
Else:
  exit_code = 1  // All tokens failed
```

### **Step 3.3: Exit**

Exit CLI tool with `exit_code`

---

### Critical Execution Rules

**Rule 1: Sequential Token Processing**
- Process tokens one at a time in array order
- Never process multiple tokens concurrently
- Complete all steps for token N before starting token N+1

**Rule 2: Sequential API Requests**
- Make one API request at a time
- Never make concurrent/parallel API requests
- Always wait for response before making next request

**Rule 3: Mandatory Rate Limiting**
- Apply rate limiter delay BEFORE every API request
- Apply rate limiter delay AFTER every API request
- Minimum delay: 100 milliseconds (configurable via Requirement 4)
- Adaptive delay based on rate limit errors (Requirement 4)

**Rule 4: Error Isolation**
- Token processing errors do not stop batch execution
- Log error and continue to next token
- Only exit early if tokens.json is invalid or missing

**Rule 5: Deterministic Order**
- Always execute steps in the exact order specified
- No step reordering or optimization
- Ensures reproducible behavior

**Rule 6: Synchronous Operations**
- All operations are synchronous (blocking)
- Wait for each operation to complete before proceeding
- No asynchronous/concurrent operations

---

### Timing and Performance

**Estimated Duration per Token**:
- OHLCV fetch: 1-5 seconds (single request) or 30-120 seconds (chunked)
- Transaction fetch: 5-30 seconds (depends on transaction count and pagination)
- Data processing: 1-2 seconds
- File write: <1 second
- **Total per token**: ~10-150 seconds

**Estimated Duration for Batch**:
- For 5 tokens: ~1-12 minutes
- For 10 tokens: ~2-25 minutes
- For 50 tokens: ~10-125 minutes

**Rate Limiting Impact**:
- Minimum 100ms delay between requests
- For 24 chunked OHLCV requests: +2.4 seconds
- For 10 transaction pagination requests: +1 second
- Total rate limiting overhead per token: ~3-5 seconds

---

### Summary

**Execution is**:
1. **Sequential**: One token at a time, one API request at a time
2. **Deterministic**: Always follows the same step order
3. **Rate-Limited**: Mandatory delays between all API requests
4. **Error-Tolerant**: Token failures don't stop batch processing
5. **Synchronous**: All operations block until complete
6. **Logged**: Every major step is logged for observability


---

# Clarifications & Final Decisions

This section resolves all critical ambiguities identified during specification audit. All decisions are **final, explicit, and non-negotiable** for implementation.

---

## 1. CHAIN SUPPORT DECISION

### **FINAL DECISION: Support ONLY Solana**

**Rationale**:
- Birdeye API (`https://public-api.birdeye.so`) is **Solana-only**
- No Ethereum endpoint exists in Birdeye API
- Supporting Ethereum would require integrating a completely different API (e.g., Etherscan, Alchemy, Dune)
- Multi-chain support adds significant complexity without clear benefit for this tool's scope

**Implementation Rules**:

1. **Remove Ethereum from Input Schema**:
   - The `chain` field in `tokens.json` is **REMOVED**
   - All tokens are assumed to be Solana tokens
   - Token addresses must be Solana base58 format (32-44 characters)

2. **Updated tokens.json Schema**:
```json
[
  {
    "name": "BONK",
    "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "launch_time": 1672531200
  }
]
```

3. **Output JSON Schema Update**:
   - The `chain` field in output JSON is **REMOVED**
   - OR set to constant value `"solana"` for all outputs

4. **Validation Rules**:
   - Address validation: Must be valid Solana base58 address (32-44 characters)
   - No Ethereum address validation needed
   - If address format is invalid, exit with error

5. **Error Messages**:
   - If user provides Ethereum address (starts with `0x`): Display error "Ethereum addresses not supported. This tool only supports Solana tokens via Birdeye API."

**This decision is FINAL. Ethereum support is OUT OF SCOPE.**

---

## 2. TRANSACTION MODEL DECISION

### **FINAL DECISION: Two-Record Model (One blockchain transaction = Two output records)**

**Rationale**:
- Enables wallet-centric analysis (each wallet sees its own buy/sell activity)
- Simplifies balance calculation (sum of wallet's transactions)
- Matches common crypto analytics patterns

**Explicit Rules**:

### **Terminology**:
- **Blockchain Transaction**: A single on-chain transaction with one `txHash`
- **Output Record**: A JSON object in the `transactions` array
- **Logical Transaction**: One blockchain transaction generates TWO output records

### **Record Generation**:

For each blockchain transaction with fields `{txHash, from, to, amount, decimals, blockTime}`:

**Generate TWO output records**:

1. **Sender Record**:
```json
{
  "tx_hash": "ABC123...",
  "wallet": "SenderAddress...",
  "side": "sell",
  "amount": 1000.5,
  "timestamp": 1704067245
}
```

2. **Receiver Record**:
```json
{
  "tx_hash": "ABC123...",
  "wallet": "ReceiverAddress...",
  "side": "buy",
  "amount": 1000.5,
  "timestamp": 1704067245
}
```

### **Duplicate tx_hash is INTENTIONAL**:
- The same `tx_hash` appears in BOTH records
- This is **NOT a violation** of uniqueness
- Uniqueness applies to blockchain transactions (deduplicate by `txHash` during collection)
- Output records are wallet-centric views of the same blockchain event

### **Transaction Count Semantics**:
- `transactions` array length = 2 × number of blockchain transactions
- `metadata.transaction_count` = number of UNIQUE blockchain transactions (divide array length by 2)
- Low data threshold (50 transactions) refers to UNIQUE blockchain transactions, not output records

### **Balance Calculation**:
- Process ALL output records (including duplicates)
- Each wallet's balance = sum of its buy records - sum of its sell records
- This correctly accounts for token flow

### **Validation Rule Update**:
- "Transaction Uniqueness" rule applies to blockchain transactions during COLLECTION (deduplicate by `txHash`)
- Output records in `transactions` array WILL have duplicate `tx_hash` values (expected behavior)

**This model is FINAL and NON-NEGOTIABLE.**

---

## 3. API KEY DEFINITION

### **FINAL DECISION: Environment Variable with Strict Validation**

**Environment Variable Name**: `BIRDEYE_API_KEY`

**Implementation Rules**:

1. **Initialization (Step 1.1)**:
   - Read environment variable: `process.env.BIRDEYE_API_KEY`
   - If variable is undefined, null, or empty string:
     - Display error: `"Error: BIRDEYE_API_KEY environment variable not set. Please set your Birdeye API key."`
     - Exit immediately with status code 1
     - Do NOT proceed to load tokens.json

2. **Usage**:
   - Include in ALL API requests as header: `x-api-key: <value of BIRDEYE_API_KEY>`

3. **Security**:
   - Never log the API key value
   - Never include in error messages
   - Never write to output files

4. **Documentation**:
   - README must include setup instructions:
     ```bash
     export BIRDEYE_API_KEY="your_api_key_here"
     node collect.js
     ```

**This is FINAL. No alternative sources (config file, CLI arg) are supported.**

---

## 4. CLI INTERFACE DEFINITION

### **FINAL DECISION: File-Based Input Only**

**Rationale**:
- Batch processing is the primary use case
- Single-token CLI arguments add complexity without significant benefit
- File-based input is more maintainable and auditable

**Command Format**:

```bash
node collect.js [options]
```

**Options**:

1. **`--file <path>`** (optional):
   - Path to tokens.json file
   - Default: `./tokens.json` (project root)
   - Example: `node collect.js --file ./my-tokens.json`

2. **No other arguments supported**

**Behavior**:

1. **Default Execution** (no arguments):
   ```bash
   node collect.js
   ```
   - Reads `./tokens.json` from project root
   - Processes all tokens in file

2. **Custom File Path**:
   ```bash
   node collect.js --file /path/to/tokens.json
   ```
   - Reads specified file
   - Processes all tokens in file

3. **Invalid Arguments**:
   - If unknown arguments provided: Display usage and exit with code 1
   - Usage message:
     ```
     Usage: node collect.js [--file <path>]
     
     Options:
       --file <path>    Path to tokens.json file (default: ./tokens.json)
     
     Environment Variables:
       BIRDEYE_API_KEY  Required. Your Birdeye API key.
     
     Example:
       export BIRDEYE_API_KEY="your_key"
       node collect.js
       node collect.js --file ./my-tokens.json
     ```

**Single-Token Support: REMOVED**

- Requirement 1 acceptance criteria 3-5 (command-line arguments for single token) are **DEPRECATED**
- Only file-based batch processing is supported
- To process a single token, create a tokens.json file with one entry

**This is FINAL. No single-token CLI arguments.**

---

## 5. VALIDATION SCRIPT POSITION

### **FINAL DECISION: Separate Command (Not Automatic)**

**Rationale**:
- Validation is optional (user may want raw data immediately)
- Separation allows validation to be run multiple times without re-collecting data
- Cleaner separation of concerns

**Implementation**:

1. **Validation Script is a SEPARATE executable**:
   - File: `validate.js` (separate from `collect.js`)
   - Not invoked automatically by `collect.js`

2. **Command Format**:
   ```bash
   node validate.js <output-file>
   ```
   
   **Examples**:
   ```bash
   node validate.js output/pepe.json
   node validate.js output/*.json
   ```

3. **Behavior**:
   - Reads specified JSON output file(s)
   - Performs validation checks (gaps, spikes, holder counts)
   - Displays validation report to console
   - Exits with code 0 if no critical issues, code 1 if critical issues found

4. **Integration with collect.js**:
   - `collect.js` does NOT call `validate.js`
   - User must manually run validation after collection
   - Recommended workflow:
     ```bash
     node collect.js
     node validate.js output/*.json
     ```

5. **Requirement 12 Update**:
   - Validation Script is a separate tool
   - Not part of the main collection workflow
   - Execution is manual and optional

**This is FINAL. Validation is separate and manual.**

---

## 6. FINAL ASSUMPTIONS LOCK

### **Explicit Rules for All Critical Assumptions**

These rules convert assumptions into enforceable implementation requirements:

### **6.1. API Response Sorting**

**Assumption**: API returns data in specific order

**Rule**:
- **OHLCV Data**: ALWAYS sort by `unixTime` ascending after receiving from API (do not trust API order)
- **Transaction Data**: ALWAYS sort by `blockTime` ascending after receiving from API (do not trust API order)
- **Rationale**: Defensive programming - never trust external API ordering

### **6.2. Missing Decimals Field**

**Assumption**: Transaction `decimals` field is always present

**Rule**:
- If `decimals` field is missing or null:
  - Log warning: `"Transaction [txHash] missing decimals field, using default: 9"`
  - Use default value: `9` (Solana standard)
  - Continue processing
- If `decimals` field is not a number:
  - Log warning: `"Transaction [txHash] has invalid decimals value, using default: 9"`
  - Use default value: `9`
  - Continue processing

### **6.3. Missing Required Fields**

**Assumption**: API always returns all required fields

**Rules**:

**OHLCV Records**:
- If any field is missing (`unixTime`, `o`, `h`, `l`, `c`, `v`):
  - Log warning: `"Invalid OHLCV record at timestamp [timestamp]: missing field [field_name]"`
  - Exclude record from processing
  - Treat as missing interval (generate synthetic record)

**Transaction Records**:
- If `txHash` is missing:
  - Log warning: `"Transaction missing txHash, skipping"`
  - Exclude transaction
  - Continue processing
- If `from` OR `to` is missing:
  - Log warning: `"Transaction [txHash] missing from/to field, skipping"`
  - Exclude transaction
  - Continue processing
- If `amount` is missing:
  - Log warning: `"Transaction [txHash] missing amount, skipping"`
  - Exclude transaction
  - Continue processing
- If `blockTime` is missing:
  - Log warning: `"Transaction [txHash] missing blockTime, skipping"`
  - Exclude transaction
  - Continue processing

### **6.4. Null or Invalid Wallet Addresses**

**Assumption**: Wallet addresses are always valid

**Rule**:
- If `from` or `to` is null, undefined, or empty string:
  - This may indicate minting (from = null) or burning (to = null)
  - Log info: `"Transaction [txHash] has null address (mint/burn), skipping"`
  - Exclude transaction from processing
  - Continue processing
- If address is not a valid Solana base58 string:
  - Log warning: `"Transaction [txHash] has invalid address format, skipping"`
  - Exclude transaction
  - Continue processing

### **6.5. Negative or Zero Transaction Amounts**

**Assumption**: Transaction amounts are always positive

**Rule**:
- If `amount` (after decimal conversion) is <= 0:
  - Log warning: `"Transaction [txHash] has non-positive amount: [amount], skipping"`
  - Exclude transaction
  - Continue processing

### **6.6. Future Launch Time**

**Assumption**: Launch time is in the past

**Rule**:
- During token validation (Step 1.3):
  - Get current Unix timestamp: `current_time = Date.now() / 1000`
  - If `launch_time > current_time`:
    - Display error: `"Token [name] has future launch time: [launch_time]. Cannot collect data for future launches."`
    - Exit with status code 1
    - Do NOT proceed with processing

### **6.7. Unreasonably Old Launch Time**

**Assumption**: Launch time is not before blockchain existed

**Rule**:
- During token validation (Step 1.3):
  - Minimum valid timestamp: `1230940800` (January 1, 2009 - Bitcoin genesis)
  - If `launch_time < 1230940800`:
    - Display error: `"Token [name] has invalid launch time: [launch_time]. Must be after January 1, 2009."`
    - Exit with status code 1

### **6.8. API Success Field**

**Assumption**: API returns `success` field

**Rule**:
- After parsing API response JSON:
  - If `success` field is missing: Assume success if `data` field exists
  - If `success === false`: Treat as API error, apply retry logic
  - If `success === true`: Proceed with data extraction

### **6.9. OHLCV Timestamp Alignment**

**Assumption**: OHLCV timestamps are minute-aligned

**Rule**:
- After receiving OHLCV data:
  - For each record, check: `timestamp % 60 === 0`
  - If NOT aligned:
    - Round down to nearest minute: `aligned_timestamp = Math.floor(timestamp / 60) * 60`
    - Log warning: `"OHLCV timestamp [timestamp] not minute-aligned, rounded to [aligned_timestamp]"`
    - Use aligned timestamp
    - Continue processing

### **6.10. Balance Consistency Check**

**Assumption**: Sum of buys equals sum of sells

**Rule - CORRECTED**:
- This assumption is **INVALID** for tokens with minting/burning
- Remove balance consistency check (Validation Rule 4 in Transaction & Holder Processing)
- Do NOT log warnings for balance imbalances
- Rationale: Minting creates tokens (buys > sells), burning destroys tokens (sells > buys)

---

## 7. SAFETY RULES

### **7.1. Maximum Tokens Per Run**

**Rule**: Soft limit of 10 tokens per execution

**Implementation**:
- If `tokens.json` contains more than 10 tokens:
  - Log warning: `"Warning: Processing [count] tokens. Large batches may take significant time and memory. Recommended: max 10 tokens per run."`
  - Continue processing (do not fail)
  - Rationale: Allow flexibility but warn user

**Recommendation for Users**:
- Split large token lists into multiple files
- Run multiple batches sequentially

### **7.2. Maximum Transactions Per Token**

**Rule**: Soft cap of 50,000 transactions per token

**Implementation**:
- During transaction collection (Step 2.3):
  - If `transactions.length > 50000`:
    - Log warning: `"Token [name] has exceeded 50,000 transactions. Stopping collection to prevent memory issues."`
    - Stop pagination (set `has_more = false`)
    - Process collected transactions
    - Set `low_data = false` (not low data, just capped)
    - Add to metadata: `"capped": true, "cap_reason": "Exceeded 50,000 transaction limit"`

**Rationale**:
- High-volume tokens can cause memory exhaustion
- 50,000 transactions × 2 records = 100,000 output records (reasonable limit)
- Prevents tool from crashing on extremely active tokens

### **7.3. Memory Safety Notes**

**Implementation Requirements**:

1. **No Global State Accumulation**:
   - Clear all token data from memory after writing JSON output
   - Do NOT accumulate data across tokens
   - Each token processing should be independent

2. **Streaming for Large Arrays**:
   - If implementing in Node.js, consider streaming JSON output for large transaction arrays
   - Rationale: Prevents memory spikes during JSON.stringify()

3. **Garbage Collection Hints**:
   - After Step 2.8 (JSON output), explicitly null out large data structures:
     ```
     ohlcv_data = null
     transactions = null
     wallet_balances = null
     ```
   - Allows garbage collector to reclaim memory before next token

4. **Memory Monitoring**:
   - Log memory usage at start and end of each token processing
   - If memory usage exceeds 1GB, log warning
   - Rationale: Early detection of memory leaks

### **7.4. File System Safety**

**Rule**: Validate output directory is writable before processing

**Implementation**:
- During initialization (Step 1.1):
  - Check if `./output/` directory exists
  - If not exists: Create directory
  - Test write permissions by creating and deleting a test file: `./output/.test`
  - If write fails:
    - Display error: `"Error: Cannot write to output directory. Check permissions."`
    - Exit with status code 1

### **7.5. API Rate Limit Safety**

**Rule**: Never exceed 10 requests per second

**Implementation**:
- Rate limiter minimum delay: 100ms (already specified)
- This ensures maximum 10 requests/second
- If adaptive strategy reduces delay below 100ms, enforce 100ms minimum
- Rationale: Prevents API ban even if rate limiter adapts aggressively

### **7.6. Timeout Safety**

**Rule**: All API requests must have timeouts

**Implementation**:
- Set HTTP request timeout: 30 seconds
- If request exceeds timeout:
  - Treat as network error
  - Apply retry logic (3 retries with exponential backoff)
  - If all retries timeout: Log error and continue to next token
- Rationale: Prevents hanging on slow/unresponsive API

---

## 8. FINAL IMPLEMENTATION CHECKLIST

Before implementation is considered complete, verify:

- [ ] Only Solana tokens are supported (no Ethereum)
- [ ] `BIRDEYE_API_KEY` environment variable is required and validated
- [ ] CLI accepts only `--file` argument (no single-token arguments)
- [ ] Two-record transaction model is implemented (buy + sell per blockchain tx)
- [ ] Validation script is separate executable (`validate.js`)
- [ ] All missing field scenarios have explicit fallback rules
- [ ] Future launch times are rejected during validation
- [ ] API responses are always sorted (never trust API order)
- [ ] Maximum 10 tokens per run warning is displayed
- [ ] Maximum 50,000 transactions per token cap is enforced
- [ ] Memory is cleared between token processing
- [ ] Output directory write permissions are validated at startup
- [ ] All API requests have 30-second timeout
- [ ] Rate limiter enforces 100ms minimum delay

---

## 9. BREAKING CHANGES SUMMARY

The following changes from earlier sections are **superseded** by this clarifications section:

1. **Input Schema**: `chain` field is REMOVED from tokens.json
2. **Output Schema**: `chain` field is REMOVED or set to constant `"solana"`
3. **CLI Interface**: Single-token command-line arguments (Requirement 1, criteria 3-5) are DEPRECATED
4. **Transaction Uniqueness**: Duplicate `tx_hash` in output is INTENTIONAL and EXPECTED
5. **Balance Consistency**: Validation Rule 4 (sum of buys = sum of sells) is REMOVED

---

## 10. FINAL AUTHORITY

**In case of conflict between sections**:

1. This "Clarifications & Final Decisions" section has HIGHEST authority
2. If any earlier section contradicts this section, THIS section takes precedence
3. All implementation decisions in this section are FINAL and NON-NEGOTIABLE

**Specification Version**: 2.0 (Hardened)

**Last Updated**: 2026-04-28

**Status**: READY FOR IMPLEMENTATION

---

**END OF CLARIFICATIONS**


---

# Final Consistency Fixes

## 1. CHAIN FIELD CONSISTENCY

**DECISION**: Always include `"chain": "solana"` in output JSON

**Rules**:
- Output JSON root level MUST include: `"chain": "solana"`
- This field is constant for all tokens
- Input schema does NOT include chain field (removed)
- Output schema MUST include chain field (constant value)

---

## 2. TRANSACTION COUNT CLARITY

**DECISION**: `transaction_count` = number of UNIQUE blockchain transactions

**Rules**:
- `metadata.transaction_count` = `transactions.length / 2`
- This represents UNIQUE blockchain transactions, NOT output records
- Low data threshold (50) applies to `transaction_count`, NOT `transactions.length`
- Example: If `transactions.length = 70`, then `transaction_count = 35`

---

## 3. VALIDATION SCRIPT FINALIZATION

**Script Name**: `validate.js`

**Execution**: `node validate.js output/pepe.json`

**Exit Codes**:
- `0` = No issues (data is valid)
- `1` = Warnings detected (gaps, spikes, but data usable)
- `2` = Critical errors (file not found, invalid JSON, corrupted data)

**Output Format**: Console logs (human-readable text)

**Output Structure**:
```
Validating: output/pepe.json
Token: PEPE
Launch Time: 2024-01-01 00:00:00 UTC

OHLCV Analysis:
  - Total records: 1440
  - Time gaps detected: 2
    - Gap 1: 2024-01-01 03:15:00 to 03:20:00 (5 minutes)
    - Gap 2: 2024-01-01 08:45:00 to 08:50:00 (5 minutes)
  - Volume spikes detected: 1
    - Spike at 2024-01-01 12:30:00: volume 50000000 (3.2 std dev above mean)

Transaction Analysis:
  - Total transactions: 1250
  - Unique holders: 87

Status: WARNINGS (2 gaps, 1 spike)
```

---

## 4. SYNTHETIC OHLCV FLAG

**DECISION**: Add `"synthetic"` field to OHLCV objects

**Rules**:
- All OHLCV objects MUST include: `"synthetic": boolean`
- `"synthetic": true` → Record was generated (missing interval, carry-forward strategy)
- `"synthetic": false` → Record came from API (real data)
- Synthetic records have `volume: 0` and carry-forward prices

**Updated OHLCV Object Schema**:
```json
{
  "timestamp": 1704067200,
  "open": 0.000123,
  "high": 0.000125,
  "low": 0.000122,
  "close": 0.000124,
  "volume": 15000000,
  "synthetic": false
}
```

---

## 5. NODE ENVIRONMENT LOCK

**Requirement**: Node.js >= 18.0.0

**Rationale**: Native fetch API support (no external HTTP library required)

**Validation**: Tool MUST check Node.js version at startup:
- If `process.version < 18.0.0`: Display error and exit with code 1
- Error message: `"Error: Node.js 18.0.0 or higher required. Current version: [version]"`

---

## 6. FILE NAMING COLLISION RULE

**DECISION**: Deterministic naming with address prefix

**Format**: `{lowercase_name}_{first_8_chars_of_address}.json`

**Rules**:
- Convert token name to lowercase
- Extract first 8 characters of token address
- Combine with underscore separator
- Add `.json` extension

**Examples**:
- Token: `PEPE`, Address: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`
  - Filename: `pepe_dezxaz8z.json`
- Token: `BONK`, Address: `So11111111111111111111111111111111111111112`
  - Filename: `bonk_so111111.json`

**Collision Prevention**: Address prefix ensures uniqueness even with duplicate names

---

## 7. FLOAT PRECISION RULE

**DECISION**: Store all amounts as JavaScript numbers (no rounding)

**Rules**:
- All token amounts stored as `number` type (IEEE 754 double precision)
- NO rounding during processing
- NO precision loss during calculations
- NO string conversion for amounts
- Precision: ~15-17 significant decimal digits (sufficient for most tokens)
- If token requires higher precision: OUT OF SCOPE (use BigInt library - not specified)

---

## 8. FINAL SAFETY LOCK

**API Key Invalid**:
- If API returns 401 (Unauthorized) on FIRST request: EXIT immediately with code 1
- Do NOT attempt to process remaining tokens
- Error message: `"Error: Invalid API key. Check BIRDEYE_API_KEY environment variable."`

**Zero Data Collected**:
- If OHLCV data is empty AND transactions are empty: STILL create output file
- Output structure:
```json
{
  "token": "PEPE",
  "address": "DezXAZ8z...",
  "chain": "solana",
  "launch_time": 1704067200,
  "metadata": {
    "low_data": true,
    "transaction_count": 0,
    "warning": "No data collected for this token"
  },
  "data": {
    "1h": {
      "ohlcv": [],
      "transactions": [],
      "wallet_balances": {},
      "holders_count": 0,
      "unique_wallets": 0
    },
    "6h": {
      "ohlcv": [],
      "transactions": [],
      "wallet_balances": {},
      "holders_count": 0,
      "unique_wallets": 0
    },
    "24h": {
      "ohlcv": [],
      "transactions": [],
      "wallet_balances": {},
      "holders_count": 0,
      "unique_wallets": 0
    }
  }
}
```

---

## 9. BREAKING CHANGES FROM SECTION 9

**Updated Breaking Changes**:
- Output filenames now include address prefix (prevents collisions)
- OHLCV objects now include `synthetic` field (new required field)
- Node.js 18+ required (version constraint added)
- Chain field is INCLUDED in output (not removed)

---

## 10. FINAL AUTHORITY UPDATE

**Precedence Order**:
1. "Final Consistency Fixes" (this section) - HIGHEST
2. "Clarifications & Final Decisions" (Section 9)
3. All other sections

**Specification Version**: 2.1 (Final)

**Status**: LOCKED FOR IMPLEMENTATION

---

**END OF FINAL CONSISTENCY FIXES**


---

# Token Classification Criteria

This section defines strict, measurable criteria for classifying tokens as WINNER or LOSER based on 24-hour post-launch data.

---

## Classification Definitions

### **WINNER**: High-growth meme coin with strong early adoption
### **LOSER**: Failed meme coin with weak performance

---

## Measurable Metrics

All metrics calculated from 24-hour window data (`launch_time` to `launch_time + 86400`).

### **Metric 1: Price Change**

**Calculation**:
```
first_close = OHLCV data at launch_time (first record close price)
last_close = OHLCV data at launch_time + 86340 (last record close price)
price_change_percent = ((last_close - first_close) / first_close) * 100
```

**Data Source**: `data.24h.ohlcv` array

**Handling Edge Cases**:
- If `first_close = 0`: Set `price_change_percent = 0` (invalid data)
- If OHLCV data is empty: Set `price_change_percent = 0`

---

### **Metric 2: Volume Growth**

**Calculation**:
```
first_hour_volume = sum of volume in data.1h.ohlcv
last_hour_volume = sum of volume in OHLCV records from (launch_time + 82800) to (launch_time + 86400)
volume_growth_percent = ((last_hour_volume - first_hour_volume) / first_hour_volume) * 100
```

**Data Source**: `data.1h.ohlcv` and `data.24h.ohlcv` arrays

**Handling Edge Cases**:
- If `first_hour_volume = 0`: Set `volume_growth_percent = 0` (no initial trading)
- If `last_hour_volume = 0`: Set `volume_growth_percent = -100` (trading died)

---

### **Metric 3: Holder Growth**

**Calculation**:
```
first_hour_holders = data.1h.holders_count
final_holders = data.24h.holders_count
holder_growth_percent = ((final_holders - first_hour_holders) / first_hour_holders) * 100
```

**Data Source**: `data.1h.holders_count` and `data.24h.holders_count`

**Handling Edge Cases**:
- If `first_hour_holders = 0`: Set `holder_growth_percent = 0` (no initial holders)
- If `final_holders = 0`: Set `holder_growth_percent = 0` (invalid data)

---

### **Metric 4: Transaction Velocity**

**Calculation**:
```
total_transactions = metadata.transaction_count (unique blockchain transactions)
transaction_velocity = total_transactions / 24 (transactions per hour)
```

**Data Source**: `metadata.transaction_count`

**Handling Edge Cases**:
- If `total_transactions = 0`: Set `transaction_velocity = 0`

---

### **Metric 5: Peak Volume Ratio**

**Calculation**:
```
peak_volume = maximum volume value in data.24h.ohlcv array
average_volume = (sum of all volumes in data.24h.ohlcv) / (number of OHLCV records)
peak_volume_ratio = peak_volume / average_volume
```

**Data Source**: `data.24h.ohlcv` array

**Handling Edge Cases**:
- If `average_volume = 0`: Set `peak_volume_ratio = 0`
- If OHLCV data is empty: Set `peak_volume_ratio = 0`

---

## Classification Rules

### **WINNER Criteria** (ALL conditions must be TRUE):

1. **Price Change**: `price_change_percent >= 100` (at least 2x price increase)
2. **Volume Growth**: `volume_growth_percent >= 0` (sustained or growing volume)
3. **Holder Growth**: `holder_growth_percent >= 50` (at least 50% holder increase)
4. **Transaction Velocity**: `transaction_velocity >= 10` (at least 10 transactions/hour)
5. **Minimum Holders**: `final_holders >= 50` (at least 50 unique holders)

**Classification**: If ALL 5 conditions are TRUE → `"classification": "WINNER"`

---

### **LOSER Criteria** (ANY condition is TRUE):

1. **Price Crash**: `price_change_percent <= -50` (50%+ price drop)
2. **Volume Death**: `volume_growth_percent <= -80` (80%+ volume decline)
3. **Holder Stagnation**: `holder_growth_percent <= 10` (less than 10% holder growth)
4. **Low Activity**: `transaction_velocity < 5` (less than 5 transactions/hour)
5. **Low Adoption**: `final_holders < 30` (fewer than 30 holders)

**Classification**: If ANY condition is TRUE → `"classification": "LOSER"`

---

### **NEUTRAL Criteria**:

If token does NOT meet WINNER criteria AND does NOT meet LOSER criteria:

**Classification**: `"classification": "NEUTRAL"`

---

## Output Schema Addition

Add `classification` object to output JSON root level:

```json
{
  "token": "PEPE",
  "address": "DezXAZ8z...",
  "chain": "solana",
  "launch_time": 1704067200,
  "classification": {
    "result": "WINNER",
    "metrics": {
      "price_change_percent": 250.5,
      "volume_growth_percent": 45.2,
      "holder_growth_percent": 120.8,
      "transaction_velocity": 52.1,
      "peak_volume_ratio": 8.3,
      "final_holders": 187
    },
    "criteria_met": {
      "price_change": true,
      "volume_growth": true,
      "holder_growth": true,
      "transaction_velocity": true,
      "minimum_holders": true
    }
  },
  "metadata": { ... },
  "data": { ... }
}
```

---

## Classification Algorithm

**Step 1: Calculate All Metrics**
- Compute `price_change_percent`
- Compute `volume_growth_percent`
- Compute `holder_growth_percent`
- Compute `transaction_velocity`
- Compute `peak_volume_ratio`
- Extract `final_holders`

**Step 2: Evaluate WINNER Criteria**
```
winner_criteria = {
  price_change: price_change_percent >= 100,
  volume_growth: volume_growth_percent >= 0,
  holder_growth: holder_growth_percent >= 50,
  transaction_velocity: transaction_velocity >= 10,
  minimum_holders: final_holders >= 50
}

is_winner = ALL values in winner_criteria are true
```

**Step 3: Evaluate LOSER Criteria**
```
loser_criteria = {
  price_crash: price_change_percent <= -50,
  volume_death: volume_growth_percent <= -80,
  holder_stagnation: holder_growth_percent <= 10,
  low_activity: transaction_velocity < 5,
  low_adoption: final_holders < 30
}

is_loser = ANY value in loser_criteria is true
```

**Step 4: Determine Classification**
```
IF is_winner == true:
  result = "WINNER"
ELSE IF is_loser == true:
  result = "LOSER"
ELSE:
  result = "NEUTRAL"
```

**Step 5: Build Classification Object**
```
classification = {
  result: result,
  metrics: {
    price_change_percent: price_change_percent,
    volume_growth_percent: volume_growth_percent,
    holder_growth_percent: holder_growth_percent,
    transaction_velocity: transaction_velocity,
    peak_volume_ratio: peak_volume_ratio,
    final_holders: final_holders
  },
  criteria_met: winner_criteria (if WINNER) OR loser_criteria (if LOSER) OR null (if NEUTRAL)
}
```

---

## Implementation Rules

1. **Classification is MANDATORY**: Every output JSON MUST include `classification` object
2. **Calculation Order**: Perform classification AFTER all time window slicing is complete
3. **Precision**: Store all metric percentages with 1 decimal place (e.g., `250.5`)
4. **Missing Data**: If any metric cannot be calculated (empty data), classify as `"NEUTRAL"`
5. **Logging**: Log classification result for each token: `"Token [name] classified as [result]"`

---

## Validation Rules

**Classification Validation** (add to validation script):

1. **Verify classification object exists** in output JSON
2. **Verify result is one of**: `"WINNER"`, `"LOSER"`, or `"NEUTRAL"`
3. **Verify all metrics are present** in `metrics` object
4. **Verify metrics are numbers** (not null, not strings)
5. **Verify criteria_met logic**:
   - If result = "WINNER": All winner criteria must be true
   - If result = "LOSER": At least one loser criterion must be true
   - If result = "NEUTRAL": No validation needed

---

## Examples

### **Example 1: WINNER Token**

```json
{
  "classification": {
    "result": "WINNER",
    "metrics": {
      "price_change_percent": 450.2,
      "volume_growth_percent": 120.5,
      "holder_growth_percent": 280.3,
      "transaction_velocity": 85.4,
      "peak_volume_ratio": 12.8,
      "final_holders": 342
    },
    "criteria_met": {
      "price_change": true,
      "volume_growth": true,
      "holder_growth": true,
      "transaction_velocity": true,
      "minimum_holders": true
    }
  }
}
```

---

### **Example 2: LOSER Token**

```json
{
  "classification": {
    "result": "LOSER",
    "metrics": {
      "price_change_percent": -75.3,
      "volume_growth_percent": -92.1,
      "holder_growth_percent": 5.2,
      "transaction_velocity": 2.3,
      "peak_volume_ratio": 3.1,
      "final_holders": 18
    },
    "criteria_met": {
      "price_crash": true,
      "volume_death": true,
      "holder_stagnation": true,
      "low_activity": true,
      "low_adoption": true
    }
  }
}
```

---

### **Example 3: NEUTRAL Token**

```json
{
  "classification": {
    "result": "NEUTRAL",
    "metrics": {
      "price_change_percent": 45.8,
      "volume_growth_percent": 15.2,
      "holder_growth_percent": 35.7,
      "transaction_velocity": 12.5,
      "peak_volume_ratio": 5.2,
      "final_holders": 68
    },
    "criteria_met": null
  }
}
```

---

## Summary

**WINNER**: 2x+ price, growing volume, 50%+ holder growth, 10+ tx/hour, 50+ holders

**LOSER**: 50%+ price drop OR 80%+ volume drop OR <10% holder growth OR <5 tx/hour OR <30 holders

**NEUTRAL**: Everything else

**All criteria are measurable, deterministic, and implementation-ready.**

---

**END OF TOKEN CLASSIFICATION CRITERIA**


---

# Early-Stage Feature Engineering

This section defines ALL computable features from 24-hour post-launch data that can distinguish winning meme coins from losing ones. All features are derived from the JSON output structure.

---

## Feature Categories

1. **Volume Features**: Trading volume patterns and dynamics
2. **Wallet Features**: Holder distribution and wallet behavior
3. **Transaction Features**: Transaction patterns and characteristics
4. **Growth Features**: Time-series growth and momentum indicators

---

## Data Sources Reference

All features computed from output JSON structure:
- `data.1h.*` - First hour data
- `data.6h.*` - First 6 hours data
- `data.24h.*` - Full 24 hours data
- `data.*.ohlcv[]` - OHLCV price/volume records
- `data.*.transactions[]` - Transaction records
- `data.*.wallet_balances{}` - Wallet balance mapping
- `data.*.holders_count` - Unique holder count

---

## 1. VOLUME FEATURES

### **V1: Total Volume 24h**
**Definition**: Sum of all trading volume in 24-hour window

**Calculation**:
```
total_volume_24h = sum(data.24h.ohlcv[i].volume for all i)
```

**Data Type**: Float

**Interpretation**: Higher values indicate more trading activity

---

### **V2: Volume Trend (First Hour vs Last Hour)**
**Definition**: Percentage change in volume from first hour to last hour

**Calculation**:
```
first_hour_volume = sum(data.1h.ohlcv[i].volume for all i)
last_hour_ohlcv = filter data.24h.ohlcv where timestamp >= launch_time + 82800
last_hour_volume = sum(last_hour_ohlcv[i].volume for all i)
volume_trend = ((last_hour_volume - first_hour_volume) / first_hour_volume) * 100
```

**Data Type**: Float (percentage)

**Interpretation**: Positive = growing interest, Negative = declining interest

---

### **V3: Volume Volatility**
**Definition**: Standard deviation of hourly volume across 24 hours

**Calculation**:
```
hourly_volumes = []
For each hour h in [0, 1, 2, ..., 23]:
  hour_start = launch_time + (h * 3600)
  hour_end = launch_time + ((h + 1) * 3600)
  hour_ohlcv = filter data.24h.ohlcv where hour_start <= timestamp < hour_end
  hourly_volumes[h] = sum(hour_ohlcv[i].volume for all i)

mean_volume = mean(hourly_volumes)
volume_volatility = sqrt(sum((hourly_volumes[i] - mean_volume)^2) / 24)
```

**Data Type**: Float

**Interpretation**: Higher values indicate inconsistent trading patterns

---

### **V4: Peak Volume Hour**
**Definition**: Hour index (0-23) with highest trading volume

**Calculation**:
```
hourly_volumes = [compute as in V3]
peak_volume_hour = index of max(hourly_volumes)
```

**Data Type**: Integer (0-23)

**Interpretation**: Early peak (0-3) = initial hype, Late peak (20-23) = sustained interest

---

### **V5: Volume Concentration Ratio**
**Definition**: Ratio of top 3 hours volume to total volume

**Calculation**:
```
hourly_volumes = [compute as in V3]
top_3_hours_volume = sum of top 3 values in hourly_volumes
volume_concentration = top_3_hours_volume / total_volume_24h
```

**Data Type**: Float (0-1)

**Interpretation**: Higher values = volume concentrated in few hours (pump-and-dump pattern)

---

### **V6: Volume Acceleration**
**Definition**: Rate of change in volume growth across time windows

**Calculation**:
```
vol_1h = sum(data.1h.ohlcv[i].volume)
vol_6h = sum(data.6h.ohlcv[i].volume)
vol_24h = sum(data.24h.ohlcv[i].volume)

growth_1h_to_6h = (vol_6h - vol_1h) / 5  // Average per hour for hours 2-6
growth_6h_to_24h = (vol_24h - vol_6h) / 18  // Average per hour for hours 7-24

volume_acceleration = growth_6h_to_24h - growth_1h_to_6h
```

**Data Type**: Float

**Interpretation**: Positive = accelerating growth, Negative = decelerating growth

---

### **V7: Zero Volume Intervals**
**Definition**: Count of 1-minute intervals with zero volume

**Calculation**:
```
zero_volume_count = count(data.24h.ohlcv[i] where volume == 0)
```

**Data Type**: Integer

**Interpretation**: Higher values = low liquidity, inactive trading

---

### **V8: Volume Gini Coefficient**
**Definition**: Measure of volume inequality across 1-minute intervals

**Calculation**:
```
volumes = [data.24h.ohlcv[i].volume for all i]
sorted_volumes = sort(volumes ascending)
n = length(sorted_volumes)
cumsum = cumulative sum of sorted_volumes
gini = (2 * sum(i * sorted_volumes[i] for i in 1..n)) / (n * sum(sorted_volumes)) - (n + 1) / n
```

**Data Type**: Float (0-1)

**Interpretation**: 0 = equal distribution, 1 = extreme concentration (few large spikes)

---

### **V9: Average Volume Per Transaction**
**Definition**: Mean trading volume per unique transaction

**Calculation**:
```
total_volume_24h = sum(data.24h.ohlcv[i].volume)
transaction_count = metadata.transaction_count
avg_volume_per_tx = total_volume_24h / transaction_count
```

**Data Type**: Float

**Interpretation**: Higher values = larger trades (whales), Lower values = retail activity

---

### **V10: Volume Momentum Score**
**Definition**: Weighted volume growth favoring recent hours

**Calculation**:
```
hourly_volumes = [compute as in V3]
weights = [1, 1.1, 1.2, ..., 3.3]  // Linear weights from 1.0 to 3.3 for hours 0-23
weighted_sum = sum(hourly_volumes[i] * weights[i] for i in 0..23)
unweighted_sum = sum(hourly_volumes)
volume_momentum = weighted_sum / unweighted_sum
```

**Data Type**: Float

**Interpretation**: >1.5 = strong late momentum, <1.0 = early momentum faded

---

## 2. WALLET FEATURES

### **W1: Total Unique Holders 24h**
**Definition**: Number of unique wallet addresses in 24-hour window

**Calculation**:
```
total_holders = data.24h.holders_count
```

**Data Type**: Integer

**Interpretation**: Higher values = broader adoption

---

### **W2: Holder Growth Rate**
**Definition**: Percentage increase in holders from first hour to 24 hours

**Calculation**:
```
holders_1h = data.1h.holders_count
holders_24h = data.24h.holders_count
holder_growth_rate = ((holders_24h - holders_1h) / holders_1h) * 100
```

**Data Type**: Float (percentage)

**Interpretation**: Higher values = viral growth, Lower values = stagnant adoption

---

### **W3: Holder Concentration (Top 10 Wallets)**
**Definition**: Percentage of total supply held by top 10 wallets

**Calculation**:
```
balances = values from data.24h.wallet_balances
positive_balances = filter balances where balance > 0
sorted_balances = sort(positive_balances descending)
top_10_sum = sum(sorted_balances[0:10])
total_supply = sum(positive_balances)
holder_concentration = (top_10_sum / total_supply) * 100
```

**Data Type**: Float (percentage)

**Interpretation**: Higher values = centralized ownership (whale control)

---

### **W4: Whale Wallet Count**
**Definition**: Number of wallets holding >1% of total supply

**Calculation**:
```
balances = values from data.24h.wallet_balances
positive_balances = filter balances where balance > 0
total_supply = sum(positive_balances)
threshold = total_supply * 0.01
whale_count = count(positive_balances where balance >= threshold)
```

**Data Type**: Integer

**Interpretation**: Higher values = more whales (risk of manipulation)

---

### **W5: Average Wallet Balance**
**Definition**: Mean token balance across all holders

**Calculation**:
```
balances = values from data.24h.wallet_balances
positive_balances = filter balances where balance > 0
avg_balance = sum(positive_balances) / length(positive_balances)
```

**Data Type**: Float

**Interpretation**: Higher values = fewer large holders, Lower values = distributed ownership

---

### **W6: Wallet Balance Gini Coefficient**
**Definition**: Measure of wealth inequality among holders

**Calculation**:
```
balances = values from data.24h.wallet_balances
positive_balances = filter balances where balance > 0
sorted_balances = sort(positive_balances ascending)
n = length(sorted_balances)
cumsum = cumulative sum of sorted_balances
gini = (2 * sum(i * sorted_balances[i] for i in 1..n)) / (n * sum(sorted_balances)) - (n + 1) / n
```

**Data Type**: Float (0-1)

**Interpretation**: 0 = equal distribution, 1 = extreme inequality (whale dominated)

---

### **W7: Active Buyer Ratio**
**Definition**: Percentage of holders who only bought (never sold)

**Calculation**:
```
For each wallet in data.24h.wallet_balances:
  wallet_txs = filter data.24h.transactions where wallet == wallet
  buy_count = count(wallet_txs where side == "buy")
  sell_count = count(wallet_txs where side == "sell")
  if sell_count == 0 and buy_count > 0:
    active_buyers += 1

active_buyer_ratio = (active_buyers / data.24h.holders_count) * 100
```

**Data Type**: Float (percentage)

**Interpretation**: Higher values = strong holder conviction (diamond hands)

---

### **W8: Negative Balance Wallet Count**
**Definition**: Number of wallets with negative balance (sold more than bought)

**Calculation**:
```
balances = values from data.24h.wallet_balances
negative_balance_count = count(balances where balance < 0)
```

**Data Type**: Integer

**Interpretation**: Higher values = many pre-launch holders dumping

---

### **W9: Holder Velocity**
**Definition**: Rate of new holder acquisition per hour

**Calculation**:
```
holders_1h = data.1h.holders_count
holders_6h = data.6h.holders_count
holders_24h = data.24h.holders_count

velocity_0_1h = holders_1h / 1
velocity_1_6h = (holders_6h - holders_1h) / 5
velocity_6_24h = (holders_24h - holders_6h) / 18

holder_velocity = velocity_6_24h  // Use late-stage velocity
```

**Data Type**: Float (holders per hour)

**Interpretation**: Higher values = sustained growth, Lower values = early spike only

---

### **W10: Median Wallet Balance**
**Definition**: Median token balance across all holders

**Calculation**:
```
balances = values from data.24h.wallet_balances
positive_balances = filter balances where balance > 0
sorted_balances = sort(positive_balances ascending)
median_balance = sorted_balances[length(sorted_balances) / 2]
```

**Data Type**: Float

**Interpretation**: More robust than mean, less affected by whales

---

## 3. TRANSACTION FEATURES

### **T1: Total Transaction Count 24h**
**Definition**: Number of unique blockchain transactions in 24 hours

**Calculation**:
```
total_transactions = metadata.transaction_count
```

**Data Type**: Integer

**Interpretation**: Higher values = more trading activity

---

### **T2: Transaction Velocity**
**Definition**: Average transactions per hour

**Calculation**:
```
transaction_velocity = metadata.transaction_count / 24
```

**Data Type**: Float

**Interpretation**: Higher values = sustained activity

---

### **T3: Buy/Sell Ratio**
**Definition**: Ratio of buy transactions to sell transactions

**Calculation**:
```
buy_count = count(data.24h.transactions where side == "buy")
sell_count = count(data.24h.transactions where side == "sell")
buy_sell_ratio = buy_count / sell_count
```

**Data Type**: Float

**Interpretation**: >1 = more buying pressure, <1 = more selling pressure

---

### **T4: Average Transaction Size**
**Definition**: Mean token amount per transaction

**Calculation**:
```
amounts = [data.24h.transactions[i].amount for all i]
avg_tx_size = sum(amounts) / length(amounts)
```

**Data Type**: Float

**Interpretation**: Higher values = larger trades (institutional/whale activity)

---

### **T5: Transaction Size Variance**
**Definition**: Standard deviation of transaction amounts

**Calculation**:
```
amounts = [data.24h.transactions[i].amount for all i]
mean_amount = mean(amounts)
tx_size_variance = sqrt(sum((amounts[i] - mean_amount)^2) / length(amounts))
```

**Data Type**: Float

**Interpretation**: Higher values = mixed retail and whale activity

---

### **T6: Large Transaction Ratio**
**Definition**: Percentage of transactions above 2x average size

**Calculation**:
```
amounts = [data.24h.transactions[i].amount for all i]
avg_amount = mean(amounts)
large_threshold = avg_amount * 2
large_tx_count = count(amounts where amount >= large_threshold)
large_tx_ratio = (large_tx_count / length(amounts)) * 100
```

**Data Type**: Float (percentage)

**Interpretation**: Higher values = whale-dominated trading

---

### **T7: Transaction Frequency Trend**
**Definition**: Change in transaction rate from first hour to last hour

**Calculation**:
```
tx_1h = count(data.1h.transactions) / 2  // Divide by 2 for unique blockchain txs
last_hour_txs = filter data.24h.transactions where timestamp >= launch_time + 82800
tx_last_hour = count(last_hour_txs) / 2

tx_frequency_trend = ((tx_last_hour - tx_1h) / tx_1h) * 100
```

**Data Type**: Float (percentage)

**Interpretation**: Positive = growing activity, Negative = declining activity

---

### **T8: Unique Wallets Per Transaction**
**Definition**: Average number of unique wallets per transaction

**Calculation**:
```
unique_wallets = data.24h.holders_count
unique_txs = metadata.transaction_count
wallets_per_tx = unique_wallets / unique_txs
```

**Data Type**: Float

**Interpretation**: Lower values = same wallets trading repeatedly (wash trading risk)

---

### **T9: Transaction Clustering Score**
**Definition**: Measure of transaction time clustering (bursts vs steady)

**Calculation**:
```
timestamps = [data.24h.transactions[i].timestamp for all i]
time_gaps = [timestamps[i+1] - timestamps[i] for i in 0..length-1]
mean_gap = mean(time_gaps)
gap_variance = variance(time_gaps)
clustering_score = gap_variance / mean_gap
```

**Data Type**: Float

**Interpretation**: Higher values = bursty trading (coordinated activity)

---

### **T10: First Hour Transaction Dominance**
**Definition**: Percentage of total transactions in first hour

**Calculation**:
```
tx_1h = count(data.1h.transactions) / 2
tx_24h = metadata.transaction_count
first_hour_dominance = (tx_1h / tx_24h) * 100
```

**Data Type**: Float (percentage)

**Interpretation**: Higher values = initial hype faded quickly

---

## 4. GROWTH FEATURES

### **G1: Price Change 24h**
**Definition**: Percentage change from launch price to 24h price

**Calculation**:
```
first_close = data.24h.ohlcv[0].close
last_close = data.24h.ohlcv[last].close
price_change = ((last_close - first_close) / first_close) * 100
```

**Data Type**: Float (percentage)

**Interpretation**: Higher values = strong price appreciation

---

### **G2: Price Volatility**
**Definition**: Standard deviation of 1-minute close prices

**Calculation**:
```
closes = [data.24h.ohlcv[i].close for all i]
mean_close = mean(closes)
price_volatility = sqrt(sum((closes[i] - mean_close)^2) / length(closes))
```

**Data Type**: Float

**Interpretation**: Higher values = unstable price (risky)

---

### **G3: All-Time High Timing**
**Definition**: Hour index (0-23) when highest price occurred

**Calculation**:
```
highs = [data.24h.ohlcv[i].high for all i]
ath_index = index of max(highs)
ath_timestamp = data.24h.ohlcv[ath_index].timestamp
ath_hour = (ath_timestamp - launch_time) / 3600
```

**Data Type**: Float (0-24)

**Interpretation**: Early ATH (0-3) = pump-and-dump, Late ATH (20-24) = sustained growth

---

### **G4: Price Recovery Ratio**
**Definition**: Ratio of final price to all-time high

**Calculation**:
```
highs = [data.24h.ohlcv[i].high for all i]
ath = max(highs)
final_price = data.24h.ohlcv[last].close
recovery_ratio = final_price / ath
```

**Data Type**: Float (0-1)

**Interpretation**: Higher values = maintained gains, Lower values = dumped after peak

---

### **G5: Holder Growth Acceleration**
**Definition**: Rate of change in holder growth rate

**Calculation**:
```
holders_1h = data.1h.holders_count
holders_6h = data.6h.holders_count
holders_24h = data.24h.holders_count

growth_rate_1h_6h = (holders_6h - holders_1h) / holders_1h
growth_rate_6h_24h = (holders_24h - holders_6h) / holders_6h

holder_growth_acceleration = growth_rate_6h_24h - growth_rate_1h_6h
```

**Data Type**: Float

**Interpretation**: Positive = accelerating adoption, Negative = slowing adoption

---

### **G6: Volume-to-Holder Ratio**
**Definition**: Trading volume per unique holder

**Calculation**:
```
total_volume = sum(data.24h.ohlcv[i].volume)
total_holders = data.24h.holders_count
volume_per_holder = total_volume / total_holders
```

**Data Type**: Float

**Interpretation**: Higher values = active trading per holder (engagement)

---

### **G7: Price-Volume Correlation**
**Definition**: Correlation between price changes and volume

**Calculation**:
```
prices = [data.24h.ohlcv[i].close for all i]
volumes = [data.24h.ohlcv[i].volume for all i]
price_changes = [prices[i+1] - prices[i] for i in 0..length-1]
volume_changes = [volumes[i+1] - volumes[i] for i in 0..length-1]

correlation = pearson_correlation(price_changes, volume_changes)
```

**Data Type**: Float (-1 to 1)

**Interpretation**: Positive = volume drives price (healthy), Negative = inverse relationship (manipulation)

---

### **G8: Momentum Score (6h to 24h)**
**Definition**: Combined price and volume growth in later hours

**Calculation**:
```
price_6h = data.6h.ohlcv[last].close
price_24h = data.24h.ohlcv[last].close
price_growth = (price_24h - price_6h) / price_6h

vol_6h = sum(data.6h.ohlcv[i].volume)
vol_24h = sum(data.24h.ohlcv[i].volume)
vol_growth = (vol_24h - vol_6h) / vol_6h

momentum_score = (price_growth + vol_growth) / 2
```

**Data Type**: Float

**Interpretation**: Higher values = strong late-stage momentum

---

### **G9: Holder Retention Rate**
**Definition**: Percentage of first-hour holders still holding at 24h

**Calculation**:
```
holders_1h = set of wallets in data.1h.wallet_balances
holders_24h = set of wallets in data.24h.wallet_balances

retained_holders = intersection(holders_1h, holders_24h)
retention_rate = (count(retained_holders) / count(holders_1h)) * 100
```

**Data Type**: Float (percentage)

**Interpretation**: Higher values = strong holder conviction

---

### **G10: Growth Consistency Score**
**Definition**: Measure of steady vs erratic growth

**Calculation**:
```
hourly_holder_counts = []
For each hour h in [0, 1, 2, ..., 23]:
  hour_end = launch_time + ((h + 1) * 3600)
  hour_txs = filter data.24h.transactions where timestamp < hour_end
  hour_wallets = unique wallets in hour_txs
  hourly_holder_counts[h] = count(hour_wallets)

growth_rates = [hourly_holder_counts[i+1] - hourly_holder_counts[i] for i in 0..22]
consistency_score = 1 / (1 + variance(growth_rates))
```

**Data Type**: Float (0-1)

**Interpretation**: Higher values = steady growth, Lower values = erratic spikes

---

## Feature Summary

**Total Features**: 40

**Breakdown**:
- Volume Features: 10
- Wallet Features: 10
- Transaction Features: 10
- Growth Features: 10

**All features are**:
- Clearly defined with mathematical formulas
- Computable from JSON output structure
- Based on 24-hour post-launch data only
- Deterministic (same input → same output)
- Implementation-ready

---

## Implementation Notes

### **Feature Computation Order**:
1. Load JSON output file
2. Extract data from `data.1h`, `data.6h`, `data.24h` sections
3. Compute features in any order (no dependencies)
4. Store features in feature vector for ML model

### **Missing Data Handling**:
- If OHLCV data is empty: Set volume/price features to 0
- If transaction data is empty: Set transaction features to 0
- If holder count is 0: Set wallet features to 0
- Never fail computation, always return numeric value

### **Feature Normalization**:
- Percentages: Already normalized (0-100)
- Ratios: Already normalized (0-1 or 0-∞)
- Counts: May need log transformation for ML
- Gini coefficients: Already normalized (0-1)

### **Feature Engineering Pipeline**:
```
JSON Output → Feature Extraction → Feature Vector → ML Model → Classification
```

---

**END OF EARLY-STAGE FEATURE ENGINEERING**


---

# Token Success Probability Scoring System

This section defines a rule-based scoring system that evaluates a token's success probability using weighted features from 24-hour data. The system produces a score from 0 to 100 without machine learning.

---

## Scoring Overview

**Output**: Success Probability Score (0-100)

**Interpretation**:
- **80-100**: High Potential (Strong winner signals)
- **50-79**: Medium Potential (Mixed signals)
- **0-49**: Low Potential (Weak or failing signals)

**Methodology**: Weighted combination of normalized feature scores across 4 dimensions

---

## Scoring Dimensions

The system evaluates 4 key dimensions with assigned weights:

1. **Price Performance** (30% weight) - Price growth and stability
2. **Community Growth** (25% weight) - Holder adoption and retention
3. **Trading Activity** (25% weight) - Volume and transaction patterns
4. **Distribution Health** (20% weight) - Wallet concentration and fairness

**Total Weight**: 100%

---

## Dimension 1: Price Performance (30 points max)

### **Sub-Components**:

#### **PP1: Price Appreciation Score (15 points)**

**Feature**: G1 (Price Change 24h)

**Scoring Logic**:
```
price_change = G1  // Percentage

IF price_change >= 200:
  score = 15
ELSE IF price_change >= 100:
  score = 12
ELSE IF price_change >= 50:
  score = 9
ELSE IF price_change >= 0:
  score = 5
ELSE IF price_change >= -25:
  score = 2
ELSE:
  score = 0
```

**Rationale**: Strong price growth indicates market demand

---

#### **PP2: Price Stability Score (10 points)**

**Feature**: G4 (Price Recovery Ratio)

**Scoring Logic**:
```
recovery_ratio = G4  // 0-1

IF recovery_ratio >= 0.9:
  score = 10  // Maintained 90%+ of ATH
ELSE IF recovery_ratio >= 0.75:
  score = 7   // Maintained 75%+ of ATH
ELSE IF recovery_ratio >= 0.5:
  score = 4   // Maintained 50%+ of ATH
ELSE IF recovery_ratio >= 0.25:
  score = 2
ELSE:
  score = 0   // Dumped hard after peak
```

**Rationale**: Tokens that maintain gains show strength

---

#### **PP3: ATH Timing Bonus (5 points)**

**Feature**: G3 (All-Time High Timing)

**Scoring Logic**:
```
ath_hour = G3  // 0-24

IF ath_hour >= 18:
  score = 5   // Late ATH = sustained growth
ELSE IF ath_hour >= 12:
  score = 3
ELSE IF ath_hour >= 6:
  score = 1
ELSE:
  score = 0   // Early ATH = pump-and-dump
```

**Rationale**: Late ATH indicates sustained interest, not just launch hype

---

**Price Performance Total**: PP1 + PP2 + PP3 = 30 points max

---

## Dimension 2: Community Growth (25 points max)

### **Sub-Components**:

#### **CG1: Holder Growth Score (10 points)**

**Feature**: W2 (Holder Growth Rate)

**Scoring Logic**:
```
growth_rate = W2  // Percentage

IF growth_rate >= 200:
  score = 10  // 3x+ holder growth
ELSE IF growth_rate >= 100:
  score = 8   // 2x+ holder growth
ELSE IF growth_rate >= 50:
  score = 6   // 1.5x+ holder growth
ELSE IF growth_rate >= 25:
  score = 3
ELSE IF growth_rate >= 0:
  score = 1
ELSE:
  score = 0   // Negative growth (impossible but handle edge case)
```

**Rationale**: Rapid holder growth indicates viral adoption

---

#### **CG2: Holder Base Size Score (8 points)**

**Feature**: W1 (Total Unique Holders 24h)

**Scoring Logic**:
```
total_holders = W1

IF total_holders >= 500:
  score = 8   // Large community
ELSE IF total_holders >= 200:
  score = 6
ELSE IF total_holders >= 100:
  score = 4
ELSE IF total_holders >= 50:
  score = 2
ELSE:
  score = 0   // Too small
```

**Rationale**: Larger holder base = broader adoption

---

#### **CG3: Holder Retention Score (7 points)**

**Feature**: G9 (Holder Retention Rate)

**Scoring Logic**:
```
retention_rate = G9  // Percentage

IF retention_rate >= 80:
  score = 7   // Strong diamond hands
ELSE IF retention_rate >= 60:
  score = 5
ELSE IF retention_rate >= 40:
  score = 3
ELSE IF retention_rate >= 20:
  score = 1
ELSE:
  score = 0   // High churn
```

**Rationale**: High retention shows holder conviction

---

**Community Growth Total**: CG1 + CG2 + CG3 = 25 points max

---

## Dimension 3: Trading Activity (25 points max)

### **Sub-Components**:

#### **TA1: Volume Momentum Score (10 points)**

**Feature**: V2 (Volume Trend)

**Scoring Logic**:
```
volume_trend = V2  // Percentage

IF volume_trend >= 50:
  score = 10  // Growing volume
ELSE IF volume_trend >= 0:
  score = 7   // Sustained volume
ELSE IF volume_trend >= -25:
  score = 4   // Slight decline
ELSE IF volume_trend >= -50:
  score = 2   // Moderate decline
ELSE:
  score = 0   // Collapsing volume
```

**Rationale**: Growing or sustained volume indicates continued interest

---

#### **TA2: Transaction Activity Score (8 points)**

**Feature**: T2 (Transaction Velocity)

**Scoring Logic**:
```
tx_velocity = T2  // Transactions per hour

IF tx_velocity >= 50:
  score = 8   // Very active
ELSE IF tx_velocity >= 20:
  score = 6
ELSE IF tx_velocity >= 10:
  score = 4
ELSE IF tx_velocity >= 5:
  score = 2
ELSE:
  score = 0   // Dead
```

**Rationale**: High transaction rate shows active trading

---

#### **TA3: Buy Pressure Score (7 points)**

**Feature**: T3 (Buy/Sell Ratio)

**Scoring Logic**:
```
buy_sell_ratio = T3

IF buy_sell_ratio >= 1.5:
  score = 7   // Strong buy pressure
ELSE IF buy_sell_ratio >= 1.2:
  score = 5
ELSE IF buy_sell_ratio >= 1.0:
  score = 3   // Balanced
ELSE IF buy_sell_ratio >= 0.8:
  score = 1   // Slight sell pressure
ELSE:
  score = 0   // Heavy sell pressure
```

**Rationale**: More buying than selling indicates bullish sentiment

---

**Trading Activity Total**: TA1 + TA2 + TA3 = 25 points max

---

## Dimension 4: Distribution Health (20 points max)

### **Sub-Components**:

#### **DH1: Decentralization Score (10 points)**

**Feature**: W6 (Wallet Balance Gini Coefficient)

**Scoring Logic**:
```
gini = W6  // 0-1

IF gini <= 0.5:
  score = 10  // Very decentralized
ELSE IF gini <= 0.65:
  score = 7   // Moderately decentralized
ELSE IF gini <= 0.75:
  score = 4   // Somewhat centralized
ELSE IF gini <= 0.85:
  score = 2   // Highly centralized
ELSE:
  score = 0   // Extreme whale control
```

**Rationale**: Lower Gini = fairer distribution = healthier token

---

#### **DH2: Whale Risk Score (5 points)**

**Feature**: W4 (Whale Wallet Count)

**Scoring Logic**:
```
whale_count = W4

IF whale_count == 0:
  score = 5   // No whales
ELSE IF whale_count <= 2:
  score = 4   // Few whales
ELSE IF whale_count <= 5:
  score = 2   // Moderate whale presence
ELSE IF whale_count <= 10:
  score = 1   // Many whales
ELSE:
  score = 0   // Whale dominated
```

**Rationale**: Fewer whales = less manipulation risk

---

#### **DH3: Active Participation Score (5 points)**

**Feature**: W7 (Active Buyer Ratio)

**Scoring Logic**:
```
active_buyer_ratio = W7  // Percentage

IF active_buyer_ratio >= 70:
  score = 5   // Most holders are diamond hands
ELSE IF active_buyer_ratio >= 50:
  score = 4
ELSE IF active_buyer_ratio >= 30:
  score = 2
ELSE IF active_buyer_ratio >= 15:
  score = 1
ELSE:
  score = 0   // High selling activity
```

**Rationale**: High active buyer ratio shows holder conviction

---

**Distribution Health Total**: DH1 + DH2 + DH3 = 20 points max

---

## Final Score Calculation

### **Step 1: Calculate Dimension Scores**

```
price_performance_score = PP1 + PP2 + PP3  // Max 30
community_growth_score = CG1 + CG2 + CG3   // Max 25
trading_activity_score = TA1 + TA2 + TA3   // Max 25
distribution_health_score = DH1 + DH2 + DH3 // Max 20
```

### **Step 2: Sum All Dimensions**

```
total_score = price_performance_score + 
              community_growth_score + 
              trading_activity_score + 
              distribution_health_score

// Total score range: 0-100
```

### **Step 3: Apply Penalty Modifiers (Optional)**

**Critical Failure Penalties**:

```
// Penalty 1: Extreme Price Dump
IF G1 < -75:  // Price dropped 75%+
  total_score = total_score * 0.5  // 50% penalty

// Penalty 2: Volume Death
IF V2 < -90:  // Volume dropped 90%+
  total_score = total_score * 0.6  // 40% penalty

// Penalty 3: Holder Exodus
IF W2 < -20:  // Holders decreased
  total_score = total_score * 0.7  // 30% penalty

// Penalty 4: Transaction Death
IF T2 < 2:  // Less than 2 tx/hour
  total_score = total_score * 0.8  // 20% penalty
```

### **Step 4: Clamp Score to Range**

```
final_score = CLAMP(total_score, 0, 100)
```

---

## Score Interpretation

### **High Potential (80-100)**

**Characteristics**:
- Strong price appreciation (100%+)
- Rapid holder growth (100%+)
- Sustained or growing volume
- Healthy distribution (low Gini)
- High transaction activity
- Late ATH timing (sustained momentum)

**Action**: Strong buy signal

---

### **Medium Potential (50-79)**

**Characteristics**:
- Moderate price growth (25-100%)
- Steady holder growth (25-100%)
- Stable volume
- Moderate distribution
- Decent transaction activity
- Mixed signals across dimensions

**Action**: Monitor closely, potential entry point

---

### **Low Potential (0-49)**

**Characteristics**:
- Weak or negative price performance
- Stagnant holder growth (<25%)
- Declining volume
- Centralized distribution (high Gini)
- Low transaction activity
- Early ATH (pump-and-dump pattern)

**Action**: Avoid or exit

---

## Output Schema Addition

Add `success_score` object to output JSON root level:

```json
{
  "token": "PEPE",
  "address": "DezXAZ8z...",
  "chain": "solana",
  "launch_time": 1704067200,
  "success_score": {
    "total_score": 78,
    "rating": "MEDIUM",
    "dimensions": {
      "price_performance": {
        "score": 22,
        "max": 30,
        "components": {
          "price_appreciation": 12,
          "price_stability": 7,
          "ath_timing": 3
        }
      },
      "community_growth": {
        "score": 19,
        "max": 25,
        "components": {
          "holder_growth": 8,
          "holder_base_size": 6,
          "holder_retention": 5
        }
      },
      "trading_activity": {
        "score": 20,
        "max": 25,
        "components": {
          "volume_momentum": 10,
          "transaction_activity": 6,
          "buy_pressure": 4
        }
      },
      "distribution_health": {
        "score": 17,
        "max": 20,
        "components": {
          "decentralization": 10,
          "whale_risk": 4,
          "active_participation": 3
        }
      }
    },
    "penalties_applied": [],
    "features_used": {
      "G1": 125.5,
      "G3": 18.2,
      "G4": 0.78,
      "G9": 65.3,
      "W1": 187,
      "W2": 110.4,
      "W4": 3,
      "W6": 0.58,
      "W7": 52.1,
      "V2": 45.2,
      "T2": 22.5,
      "T3": 1.15
    }
  },
  "classification": { ... },
  "metadata": { ... },
  "data": { ... }
}
```

---

## Implementation Algorithm

```python
def calculate_success_score(json_data):
    # Extract features
    G1 = calculate_feature_G1(json_data)
    G3 = calculate_feature_G3(json_data)
    G4 = calculate_feature_G4(json_data)
    G9 = calculate_feature_G9(json_data)
    W1 = calculate_feature_W1(json_data)
    W2 = calculate_feature_W2(json_data)
    W4 = calculate_feature_W4(json_data)
    W6 = calculate_feature_W6(json_data)
    W7 = calculate_feature_W7(json_data)
    V2 = calculate_feature_V2(json_data)
    T2 = calculate_feature_T2(json_data)
    T3 = calculate_feature_T3(json_data)
    
    # Dimension 1: Price Performance
    PP1 = score_price_appreciation(G1)
    PP2 = score_price_stability(G4)
    PP3 = score_ath_timing(G3)
    price_performance = PP1 + PP2 + PP3
    
    # Dimension 2: Community Growth
    CG1 = score_holder_growth(W2)
    CG2 = score_holder_base_size(W1)
    CG3 = score_holder_retention(G9)
    community_growth = CG1 + CG2 + CG3
    
    # Dimension 3: Trading Activity
    TA1 = score_volume_momentum(V2)
    TA2 = score_transaction_activity(T2)
    TA3 = score_buy_pressure(T3)
    trading_activity = TA1 + TA2 + TA3
    
    # Dimension 4: Distribution Health
    DH1 = score_decentralization(W6)
    DH2 = score_whale_risk(W4)
    DH3 = score_active_participation(W7)
    distribution_health = DH1 + DH2 + DH3
    
    # Calculate total
    total_score = price_performance + community_growth + trading_activity + distribution_health
    
    # Apply penalties
    penalties = []
    if G1 < -75:
        total_score *= 0.5
        penalties.append("extreme_price_dump")
    if V2 < -90:
        total_score *= 0.6
        penalties.append("volume_death")
    if W2 < -20:
        total_score *= 0.7
        penalties.append("holder_exodus")
    if T2 < 2:
        total_score *= 0.8
        penalties.append("transaction_death")
    
    # Clamp to 0-100
    final_score = max(0, min(100, total_score))
    
    # Determine rating
    if final_score >= 80:
        rating = "HIGH"
    elif final_score >= 50:
        rating = "MEDIUM"
    else:
        rating = "LOW"
    
    return {
        "total_score": round(final_score, 2),
        "rating": rating,
        "dimensions": {
            "price_performance": {
                "score": price_performance,
                "max": 30,
                "components": {"price_appreciation": PP1, "price_stability": PP2, "ath_timing": PP3}
            },
            "community_growth": {
                "score": community_growth,
                "max": 25,
                "components": {"holder_growth": CG1, "holder_base_size": CG2, "holder_retention": CG3}
            },
            "trading_activity": {
                "score": trading_activity,
                "max": 25,
                "components": {"volume_momentum": TA1, "transaction_activity": TA2, "buy_pressure": TA3}
            },
            "distribution_health": {
                "score": distribution_health,
                "max": 20,
                "components": {"decentralization": DH1, "whale_risk": DH2, "active_participation": DH3}
            }
        },
        "penalties_applied": penalties,
        "features_used": {
            "G1": G1, "G3": G3, "G4": G4, "G9": G9,
            "W1": W1, "W2": W2, "W4": W4, "W6": W6, "W7": W7,
            "V2": V2, "T2": T2, "T3": T3
        }
    }
```

---

## Scoring Examples

### **Example 1: High Potential Token (Score: 87)**

**Features**:
- G1 (Price Change): 250% → PP1 = 15
- G4 (Recovery Ratio): 0.92 → PP2 = 10
- G3 (ATH Hour): 20 → PP3 = 5
- W2 (Holder Growth): 180% → CG1 = 8
- W1 (Total Holders): 420 → CG2 = 6
- G9 (Retention): 75% → CG3 = 5
- V2 (Volume Trend): 65% → TA1 = 10
- T2 (TX Velocity): 45 → TA2 = 6
- T3 (Buy/Sell): 1.35 → TA3 = 5
- W6 (Gini): 0.52 → DH1 = 7
- W4 (Whales): 2 → DH2 = 4
- W7 (Active Buyers): 68% → DH3 = 4

**Calculation**: 15+10+5 + 8+6+5 + 10+6+5 + 7+4+4 = **87**

**Rating**: HIGH

---

### **Example 2: Medium Potential Token (Score: 62)**

**Features**:
- G1: 75% → PP1 = 9
- G4: 0.68 → PP2 = 4
- G3: 8 → PP3 = 1
- W2: 85% → CG1 = 6
- W1: 150 → CG2 = 4
- G9: 55% → CG3 = 3
- V2: 15% → TA1 = 7
- T2: 18 → TA2 = 4
- T3: 1.05 → TA3 = 3
- W6: 0.68 → DH1 = 7
- W4: 4 → DH2 = 2
- W7: 42% → DH3 = 2

**Calculation**: 9+4+1 + 6+4+3 + 7+4+3 + 7+2+2 = **62**

**Rating**: MEDIUM

---

### **Example 3: Low Potential Token (Score: 28)**

**Features**:
- G1: -45% → PP1 = 2
- G4: 0.35 → PP2 = 2
- G3: 2 → PP3 = 0
- W2: 18% → CG1 = 1
- W1: 35 → CG2 = 0
- G9: 25% → CG3 = 1
- V2: -65% → TA1 = 0
- T2: 4 → TA2 = 2
- T3: 0.75 → TA3 = 1
- W6: 0.88 → DH1 = 0
- W4: 8 → DH2 = 1
- W7: 12% → DH3 = 0

**Calculation**: 2+2+0 + 1+0+1 + 0+2+1 + 0+1+0 = **10**

**Penalties**: Volume death (-90%) → 10 * 0.6 = **6**

**Rating**: LOW

---

## Validation Rules

**Score Validation** (add to validation script):

1. **Verify success_score object exists** in output JSON
2. **Verify total_score is between 0 and 100**
3. **Verify rating matches score**:
   - If score >= 80: rating must be "HIGH"
   - If score >= 50 and < 80: rating must be "MEDIUM"
   - If score < 50: rating must be "LOW"
4. **Verify dimension scores sum correctly**
5. **Verify all component scores are within valid ranges**
6. **Verify all features_used values are present and numeric**

---

## Summary

**Scoring System Characteristics**:
- ✅ Rule-based (no ML)
- ✅ Transparent (all weights and thresholds explicit)
- ✅ Interpretable (dimension breakdown provided)
- ✅ Deterministic (same input → same output)
- ✅ Computable from JSON data only
- ✅ Covers 4 key dimensions with 12 features
- ✅ Includes penalty system for critical failures
- ✅ Produces actionable ratings (HIGH/MEDIUM/LOW)

**Use Cases**:
- Automated token screening
- Investment decision support
- Risk assessment
- Portfolio management
- Alert systems (trigger on HIGH scores)

---

**END OF TOKEN SUCCESS PROBABILITY SCORING SYSTEM**


---

# Pattern Matching System for Historical Winner Comparison

This section defines a logic-based pattern matching system that compares new tokens against historical winners to calculate similarity scores. No machine learning is used.

---

## System Overview

**Purpose**: Identify new tokens that exhibit similar patterns to historically successful tokens

**Input**: 
- New token features (from JSON output)
- Historical winner database (reference patterns)

**Output**: 
- Similarity score (0-100)
- Matching confidence level
- Pattern breakdown
- Risk flags

**Methodology**: Weighted feature distance calculation with critical feature gating

---

## Historical Winner Profile Definition

### **Winner Profile Structure**

A historical winner profile contains aggregated statistics from known successful tokens:

```json
{
  "profile_id": "winner_profile_v1",
  "sample_size": 50,
  "description": "Tokens that achieved 10x+ within 7 days",
  "feature_ranges": {
    "critical_features": {
      "G1_price_change_24h": {
        "min": 100,
        "max": 800,
        "median": 250,
        "q1": 150,
        "q3": 400
      },
      "W2_holder_growth_rate": {
        "min": 80,
        "max": 500,
        "median": 180,
        "q1": 120,
        "q3": 280
      },
      "V2_volume_trend": {
        "min": 0,
        "max": 300,
        "median": 65,
        "q1": 30,
        "q3": 120
      },
      "T2_transaction_velocity": {
        "min": 10,
        "max": 200,
        "median": 45,
        "q1": 25,
        "q3": 80
      }
    },
    "important_features": {
      "G4_price_recovery_ratio": {
        "min": 0.65,
        "max": 0.98,
        "median": 0.82,
        "q1": 0.75,
        "q3": 0.90
      },
      "W1_total_holders": {
        "min": 100,
        "max": 2000,
        "median": 420,
        "q1": 250,
        "q3": 750
      },
      "T3_buy_sell_ratio": {
        "min": 1.1,
        "max": 2.5,
        "median": 1.35,
        "q1": 1.2,
        "q3": 1.6
      },
      "W6_gini_coefficient": {
        "min": 0.35,
        "max": 0.70,
        "median": 0.52,
        "q1": 0.45,
        "q3": 0.60
      }
    },
    "supporting_features": {
      "G3_ath_timing": {
        "min": 12,
        "max": 24,
        "median": 18,
        "q1": 15,
        "q3": 21
      },
      "G9_holder_retention": {
        "min": 50,
        "max": 90,
        "median": 68,
        "q1": 60,
        "q3": 78
      },
      "W4_whale_count": {
        "min": 0,
        "max": 5,
        "median": 2,
        "q1": 1,
        "q3": 3
      },
      "V7_zero_volume_intervals": {
        "min": 0,
        "max": 50,
        "median": 15,
        "q1": 5,
        "q3": 30
      }
    }
  },
  "disqualifying_patterns": {
    "early_ath": "G3 < 6",
    "extreme_dump": "G1 < -50",
    "volume_death": "V2 < -80",
    "holder_exodus": "W2 < 0",
    "whale_dominated": "W6 > 0.85",
    "dead_trading": "T2 < 3"
  }
}
```

---

## Feature Importance Hierarchy

### **Tier 1: Critical Features (50% weight)**

These features MUST match reasonably well for a token to be considered similar:

1. **G1 (Price Change 24h)** - 15% weight
   - Most important indicator of success
   - Must be positive and substantial

2. **W2 (Holder Growth Rate)** - 15% weight
   - Indicates viral adoption
   - Strong correlation with long-term success

3. **V2 (Volume Trend)** - 10% weight
   - Shows sustained interest
   - Negative trend is red flag

4. **T2 (Transaction Velocity)** - 10% weight
   - Measures active trading
   - Low velocity indicates dead token

---

### **Tier 2: Important Features (30% weight)**

These features significantly influence similarity but aren't deal-breakers:

5. **G4 (Price Recovery Ratio)** - 8% weight
   - Shows price stability
   - High ratio = maintained gains

6. **W1 (Total Holders)** - 7% weight
   - Community size matters
   - Larger base = more stability

7. **T3 (Buy/Sell Ratio)** - 8% weight
   - Buying pressure indicator
   - >1.0 is bullish

8. **W6 (Gini Coefficient)** - 7% weight
   - Distribution fairness
   - Lower = healthier

---

### **Tier 3: Supporting Features (20% weight)**

These features provide additional context but have lower impact:

9. **G3 (ATH Timing)** - 5% weight
   - Late ATH preferred
   - Early ATH = pump-and-dump

10. **G9 (Holder Retention)** - 5% weight
    - Diamond hands indicator
    - High retention = conviction

11. **W4 (Whale Count)** - 5% weight
    - Manipulation risk
    - Fewer whales preferred

12. **V7 (Zero Volume Intervals)** - 5% weight
    - Liquidity indicator
    - Fewer gaps = better

---

## Similarity Calculation Algorithm

### **Step 1: Critical Feature Gating**

Before calculating similarity, check if token passes critical thresholds:

```python
def check_critical_gates(token_features, winner_profile):
    gates_passed = []
    gates_failed = []
    
    # Gate 1: Positive Price Growth
    if token_features['G1'] >= winner_profile['critical_features']['G1_price_change_24h']['min']:
        gates_passed.append('positive_price_growth')
    else:
        gates_failed.append('negative_or_low_price_growth')
    
    # Gate 2: Holder Growth
    if token_features['W2'] >= winner_profile['critical_features']['W2_holder_growth_rate']['min']:
        gates_passed.append('holder_growth')
    else:
        gates_failed.append('insufficient_holder_growth')
    
    # Gate 3: Volume Trend
    if token_features['V2'] >= winner_profile['critical_features']['V2_volume_trend']['min']:
        gates_passed.append('volume_trend')
    else:
        gates_failed.append('declining_volume')
    
    # Gate 4: Transaction Activity
    if token_features['T2'] >= winner_profile['critical_features']['T2_transaction_velocity']['min']:
        gates_passed.append('transaction_activity')
    else:
        gates_failed.append('low_transaction_activity')
    
    # Must pass at least 3 out of 4 critical gates
    if len(gates_passed) >= 3:
        return True, gates_passed, gates_failed
    else:
        return False, gates_passed, gates_failed
```

**If critical gates fail**: Similarity score capped at 40 (automatic LOW rating)

---

### **Step 2: Disqualifying Pattern Check**

Check for patterns that historically indicate failure:

```python
def check_disqualifying_patterns(token_features):
    disqualifications = []
    
    # Early ATH (pump-and-dump)
    if token_features['G3'] < 6:
        disqualifications.append('early_ath')
    
    # Extreme price dump
    if token_features['G1'] < -50:
        disqualifications.append('extreme_dump')
    
    # Volume death
    if token_features['V2'] < -80:
        disqualifications.append('volume_death')
    
    # Holder exodus
    if token_features['W2'] < 0:
        disqualifications.append('holder_exodus')
    
    # Whale dominated
    if token_features['W6'] > 0.85:
        disqualifications.append('whale_dominated')
    
    # Dead trading
    if token_features['T2'] < 3:
        disqualifications.append('dead_trading')
    
    return disqualifications
```

**If any disqualifying pattern found**: Apply 30% penalty to final similarity score

---

### **Step 3: Feature Distance Calculation**

For each feature, calculate normalized distance from winner profile median:

```python
def calculate_feature_distance(token_value, profile_stats):
    """
    Calculate normalized distance using interquartile range (IQR)
    Returns value between 0 (perfect match) and 1 (far from profile)
    """
    median = profile_stats['median']
    q1 = profile_stats['q1']
    q3 = profile_stats['q3']
    iqr = q3 - q1
    
    # Distance from median
    distance = abs(token_value - median)
    
    # Normalize by IQR (robust to outliers)
    if iqr > 0:
        normalized_distance = distance / iqr
    else:
        normalized_distance = 0 if distance == 0 else 1
    
    # Clamp to [0, 1] range
    # Values within IQR get distance < 1
    # Values outside IQR get distance >= 1
    normalized_distance = min(normalized_distance, 1.0)
    
    # Convert to similarity (inverse of distance)
    similarity = 1.0 - normalized_distance
    
    return similarity
```

---

### **Step 4: Weighted Similarity Score**

Calculate weighted average of all feature similarities:

```python
def calculate_similarity_score(token_features, winner_profile):
    # Step 1: Check critical gates
    gates_passed, passed_list, failed_list = check_critical_gates(token_features, winner_profile)
    
    if not gates_passed:
        return {
            'similarity_score': min(40, calculate_partial_score()),
            'confidence': 'LOW',
            'gates_passed': passed_list,
            'gates_failed': failed_list,
            'reason': 'Failed critical feature gates'
        }
    
    # Step 2: Check disqualifying patterns
    disqualifications = check_disqualifying_patterns(token_features)
    
    # Step 3: Calculate feature similarities
    
    # Tier 1: Critical Features (50% total weight)
    G1_sim = calculate_feature_distance(
        token_features['G1'], 
        winner_profile['critical_features']['G1_price_change_24h']
    )
    W2_sim = calculate_feature_distance(
        token_features['W2'], 
        winner_profile['critical_features']['W2_holder_growth_rate']
    )
    V2_sim = calculate_feature_distance(
        token_features['V2'], 
        winner_profile['critical_features']['V2_volume_trend']
    )
    T2_sim = calculate_feature_distance(
        token_features['T2'], 
        winner_profile['critical_features']['T2_transaction_velocity']
    )
    
    tier1_score = (G1_sim * 0.15 + W2_sim * 0.15 + V2_sim * 0.10 + T2_sim * 0.10) * 100
    
    # Tier 2: Important Features (30% total weight)
    G4_sim = calculate_feature_distance(
        token_features['G4'], 
        winner_profile['important_features']['G4_price_recovery_ratio']
    )
    W1_sim = calculate_feature_distance(
        token_features['W1'], 
        winner_profile['important_features']['W1_total_holders']
    )
    T3_sim = calculate_feature_distance(
        token_features['T3'], 
        winner_profile['important_features']['T3_buy_sell_ratio']
    )
    W6_sim = calculate_feature_distance(
        token_features['W6'], 
        winner_profile['important_features']['W6_gini_coefficient']
    )
    
    tier2_score = (G4_sim * 0.08 + W1_sim * 0.07 + T3_sim * 0.08 + W6_sim * 0.07) * 100
    
    # Tier 3: Supporting Features (20% total weight)
    G3_sim = calculate_feature_distance(
        token_features['G3'], 
        winner_profile['supporting_features']['G3_ath_timing']
    )
    G9_sim = calculate_feature_distance(
        token_features['G9'], 
        winner_profile['supporting_features']['G9_holder_retention']
    )
    W4_sim = calculate_feature_distance(
        token_features['W4'], 
        winner_profile['supporting_features']['W4_whale_count']
    )
    V7_sim = calculate_feature_distance(
        token_features['V7'], 
        winner_profile['supporting_features']['V7_zero_volume_intervals']
    )
    
    tier3_score = (G3_sim * 0.05 + G9_sim * 0.05 + W4_sim * 0.05 + V7_sim * 0.05) * 100
    
    # Step 4: Combine tier scores
    total_score = tier1_score + tier2_score + tier3_score
    
    # Step 5: Apply disqualification penalty
    if len(disqualifications) > 0:
        penalty_factor = 0.7  # 30% penalty
        total_score = total_score * penalty_factor
    
    # Step 6: Determine confidence level
    if total_score >= 80 and len(disqualifications) == 0:
        confidence = 'HIGH'
    elif total_score >= 60 and len(disqualifications) <= 1:
        confidence = 'MEDIUM'
    else:
        confidence = 'LOW'
    
    return {
        'similarity_score': round(total_score, 2),
        'confidence': confidence,
        'tier_scores': {
            'tier1_critical': round(tier1_score, 2),
            'tier2_important': round(tier2_score, 2),
            'tier3_supporting': round(tier3_score, 2)
        },
        'feature_similarities': {
            'G1': round(G1_sim * 100, 2),
            'W2': round(W2_sim * 100, 2),
            'V2': round(V2_sim * 100, 2),
            'T2': round(T2_sim * 100, 2),
            'G4': round(G4_sim * 100, 2),
            'W1': round(W1_sim * 100, 2),
            'T3': round(T3_sim * 100, 2),
            'W6': round(W6_sim * 100, 2),
            'G3': round(G3_sim * 100, 2),
            'G9': round(G9_sim * 100, 2),
            'W4': round(W4_sim * 100, 2),
            'V7': round(V7_sim * 100, 2)
        },
        'gates_passed': passed_list,
        'gates_failed': failed_list,
        'disqualifications': disqualifications
    }
```

---

## False Positive Prevention Strategies

### **Strategy 1: Multi-Gate System**

**Problem**: Single feature can be misleading

**Solution**: Require passing multiple critical gates (3 out of 4 minimum)

**Example**: 
- Token has 300% price growth (passes G1 gate)
- But only 5% holder growth (fails W2 gate)
- And declining volume (fails V2 gate)
- And 2 tx/hour (fails T2 gate)
- **Result**: Only 1/4 gates passed → Similarity capped at 40

---

### **Strategy 2: Disqualifying Pattern Detection**

**Problem**: Token may match some features but have fatal flaws

**Solution**: Explicit checks for known failure patterns

**Disqualifying Patterns**:
1. **Early ATH** (G3 < 6 hours): Pump-and-dump signature
2. **Extreme Dump** (G1 < -50%): Already failed
3. **Volume Death** (V2 < -80%): Interest collapsed
4. **Holder Exodus** (W2 < 0%): People leaving
5. **Whale Dominated** (W6 > 0.85): Manipulation risk
6. **Dead Trading** (T2 < 3 tx/hour): No activity

**Penalty**: 30% reduction in similarity score if any pattern detected

---

### **Strategy 3: IQR-Based Distance Normalization**

**Problem**: Outliers can skew similarity calculations

**Solution**: Use interquartile range (IQR) instead of min-max normalization

**Benefits**:
- Robust to extreme outliers
- Focuses on typical winner behavior (Q1-Q3 range)
- Values within IQR get high similarity
- Values far outside IQR get low similarity

**Example**:
```
Winner Profile G1 (Price Change):
  Q1 = 150%, Median = 250%, Q3 = 400%, IQR = 250%

Token A: G1 = 240%
  Distance from median = |240 - 250| = 10%
  Normalized distance = 10 / 250 = 0.04
  Similarity = 1 - 0.04 = 0.96 (96% similar) ✓

Token B: G1 = 50%
  Distance from median = |50 - 250| = 200%
  Normalized distance = 200 / 250 = 0.80
  Similarity = 1 - 0.80 = 0.20 (20% similar) ✗
```

---

### **Strategy 4: Confidence Level Gating**

**Problem**: High similarity score doesn't always mean high confidence

**Solution**: Confidence level considers both score AND disqualifications

**Confidence Rules**:
```
HIGH confidence:
  - Similarity >= 80
  - Zero disqualifications
  - All critical gates passed

MEDIUM confidence:
  - Similarity >= 60
  - At most 1 disqualification
  - At least 3 critical gates passed

LOW confidence:
  - Similarity < 60, OR
  - 2+ disqualifications, OR
  - Fewer than 3 critical gates passed
```

**Action**: Only act on HIGH confidence matches

---

### **Strategy 5: Feature Correlation Checks**

**Problem**: Some feature combinations are suspicious

**Solution**: Check for internally inconsistent patterns

```python
def check_feature_consistency(token_features):
    warnings = []
    
    # Check 1: High price but low holder growth (pump scheme)
    if token_features['G1'] > 200 and token_features['W2'] < 50:
        warnings.append('price_holder_mismatch')
    
    # Check 2: High volume but low transactions (wash trading)
    if token_features['V2'] > 100 and token_features['T2'] < 10:
        warnings.append('volume_tx_mismatch')
    
    # Check 3: Many holders but low retention (churn)
    if token_features['W1'] > 300 and token_features['G9'] < 30:
        warnings.append('high_churn')
    
    # Check 4: High buy/sell ratio but declining price (manipulation)
    if token_features['T3'] > 1.5 and token_features['G1'] < 0:
        warnings.append('ratio_price_mismatch')
    
    # Check 5: Low Gini but few holders (data quality issue)
    if token_features['W6'] < 0.4 and token_features['W1'] < 50:
        warnings.append('distribution_size_mismatch')
    
    return warnings
```

**Penalty**: 10% reduction per consistency warning (max 30% total)

---

### **Strategy 6: Temporal Pattern Validation**

**Problem**: Some patterns only work in specific time windows

**Solution**: Validate that growth patterns are sustained, not just spikes

```python
def validate_temporal_consistency(json_data):
    """
    Check that growth is consistent across time windows (1h, 6h, 24h)
    """
    issues = []
    
    # Check 1: Holder growth consistency
    holders_1h = json_data['data']['1h']['holders_count']
    holders_6h = json_data['data']['6h']['holders_count']
    holders_24h = json_data['data']['24h']['holders_count']
    
    growth_1h_6h = (holders_6h - holders_1h) / holders_1h if holders_1h > 0 else 0
    growth_6h_24h = (holders_24h - holders_6h) / holders_6h if holders_6h > 0 else 0
    
    # If early growth is strong but late growth is weak = fading interest
    if growth_1h_6h > 0.5 and growth_6h_24h < 0.1:
        issues.append('fading_holder_growth')
    
    # Check 2: Volume consistency
    vol_1h = sum([ohlcv['volume'] for ohlcv in json_data['data']['1h']['ohlcv']])
    vol_6h = sum([ohlcv['volume'] for ohlcv in json_data['data']['6h']['ohlcv']])
    vol_24h = sum([ohlcv['volume'] for ohlcv in json_data['data']['24h']['ohlcv']])
    
    avg_vol_1h = vol_1h / 1 if vol_1h > 0 else 0
    avg_vol_6h_24h = (vol_24h - vol_6h) / 18 if vol_24h > vol_6h else 0
    
    # If early volume is high but late volume is low = pump-and-dump
    if avg_vol_1h > avg_vol_6h_24h * 3:
        issues.append('volume_front_loaded')
    
    return issues
```

**Penalty**: 15% reduction if temporal inconsistencies detected

---

## Output Schema Addition

Add `pattern_match` object to output JSON root level:

```json
{
  "token": "PEPE",
  "address": "DezXAZ8z...",
  "chain": "solana",
  "launch_time": 1704067200,
  "pattern_match": {
    "similarity_score": 78.5,
    "confidence": "MEDIUM",
    "matched_profile": "winner_profile_v1",
    "tier_scores": {
      "tier1_critical": 42.0,
      "tier2_important": 24.5,
      "tier3_supporting": 12.0
    },
    "feature_similarities": {
      "G1": 85.2,
      "W2": 78.3,
      "V2": 92.1,
      "T2": 68.5,
      "G4": 81.0,
      "W1": 75.4,
      "T3": 88.7,
      "W6": 79.2,
      "G3": 65.0,
      "G9": 72.1,
      "W4": 90.0,
      "V7": 55.3
    },
    "gates_passed": [
      "positive_price_growth",
      "holder_growth",
      "volume_trend",
      "transaction_activity"
    ],
    "gates_failed": [],
    "disqualifications": [],
    "consistency_warnings": [
      "high_churn"
    ],
    "temporal_issues": [],
    "penalties_applied": {
      "disqualification_penalty": 0,
      "consistency_penalty": 10,
      "temporal_penalty": 0
    },
    "recommendation": "MONITOR",
    "match_quality": "GOOD"
  },
  "success_score": { ... },
  "classification": { ... },
  "metadata": { ... },
  "data": { ... }
}
```

---

## Similarity Score Interpretation

### **Score Ranges**:

**85-100: Excellent Match**
- All critical gates passed
- No disqualifications
- High confidence
- Strong similarity across all tiers
- **Action**: Strong buy signal

**70-84: Good Match**
- All critical gates passed
- At most 1 minor disqualification
- Medium-high confidence
- Good similarity in critical features
- **Action**: Buy with caution

**55-69: Moderate Match**
- 3/4 critical gates passed
- Some disqualifications or warnings
- Medium confidence
- Mixed similarity across features
- **Action**: Monitor closely

**40-54: Weak Match**
- 2/4 critical gates passed
- Multiple disqualifications
- Low confidence
- Poor similarity in critical features
- **Action**: Avoid

**0-39: No Match**
- Fewer than 2 critical gates passed
- Severe disqualifications
- Very low confidence
- Fundamentally different pattern
- **Action**: Reject

---

## Example Calculations

### **Example 1: Excellent Match (Score: 92)**

**Token Features**:
- G1: 240% (Winner median: 250%)
- W2: 175% (Winner median: 180%)
- V2: 70% (Winner median: 65%)
- T2: 48 tx/h (Winner median: 45 tx/h)
- G4: 0.85 (Winner median: 0.82)
- W1: 410 holders (Winner median: 420)
- T3: 1.38 (Winner median: 1.35)
- W6: 0.54 (Winner median: 0.52)

**Calculation**:
- All features very close to winner medians
- All critical gates passed (4/4)
- No disqualifications
- No consistency warnings
- Tier 1: 48/50 points
- Tier 2: 28/30 points
- Tier 3: 16/20 points
- **Total: 92/100**
- **Confidence: HIGH**

---

### **Example 2: Good Match with Warning (Score: 73)**

**Token Features**:
- G1: 180% (good)
- W2: 95% (lower than median but acceptable)
- V2: 45% (acceptable)
- T2: 32 tx/h (acceptable)
- G4: 0.72 (slightly low)
- W1: 280 holders (acceptable)
- T3: 1.25 (acceptable)
- W6: 0.58 (acceptable)
- G9: 28% (low retention - warning)

**Calculation**:
- All critical gates passed (4/4)
- No disqualifications
- 1 consistency warning (high_churn): -10% penalty
- Tier 1: 40/50 points
- Tier 2: 24/30 points
- Tier 3: 14/20 points
- Subtotal: 78/100
- After penalty: 78 * 0.9 = **70.2/100**
- **Confidence: MEDIUM**

---

### **Example 3: Weak Match (Score: 38)**

**Token Features**:
- G1: 85% (below winner minimum)
- W2: 45% (below winner minimum)
- V2: -15% (declining volume - fails gate)
- T2: 8 tx/h (low but passes gate)
- G3: 4 hours (early ATH - disqualification)

**Calculation**:
- Only 2/4 critical gates passed
- 1 disqualification (early_ath): -30% penalty
- Similarity score capped at 40 due to gate failures
- After penalty: 40 * 0.7 = **28/100**
- **Confidence: LOW**

---

## Implementation Checklist

- [ ] Create historical winner profile database
- [ ] Implement feature distance calculation (IQR-based)
- [ ] Implement critical gate checking
- [ ] Implement disqualifying pattern detection
- [ ] Implement consistency warning system
- [ ] Implement temporal validation
- [ ] Implement weighted similarity calculation
- [ ] Implement confidence level determination
- [ ] Add pattern_match object to JSON output
- [ ] Create validation rules for pattern matching
- [ ] Document winner profile creation methodology

---

## Summary

**Pattern Matching System Characteristics**:
- ✅ Logic-based (no ML)
- ✅ Multi-tier feature weighting (50% + 30% + 20%)
- ✅ Critical feature gating (must pass 3/4)
- ✅ Disqualifying pattern detection (6 patterns)
- ✅ IQR-based distance calculation (robust to outliers)
- ✅ Consistency checking (5 checks)
- ✅ Temporal validation (2 checks)
- ✅ Confidence level system (HIGH/MEDIUM/LOW)
- ✅ Multiple false positive prevention strategies
- ✅ Transparent scoring breakdown

**Key Differentiators from Success Score**:
- Success Score: Absolute evaluation (is this token good?)
- Pattern Match: Relative evaluation (is this token like winners?)
- Both scores complement each other for decision-making

**Use Cases**:
- Identify tokens with winner-like patterns early
- Filter out false positives with multi-gate system
- Provide confidence levels for risk management
- Compare new tokens against proven success patterns

---

**END OF PATTERN MATCHING SYSTEM**


---

# Red Flag Detection System for Meme Coins

This section defines measurable red flags that indicate potential scams, manipulation, or failure patterns using early-stage 24-hour data.

---

## Red Flag Categories

1. **Ownership & Distribution Red Flags**
2. **Volume & Trading Red Flags**
3. **Growth & Adoption Red Flags**
4. **Price & Volatility Red Flags**
5. **Behavioral Pattern Red Flags**

---

## Category 1: Ownership & Distribution Red Flags

### **RF1: Single Wallet Dominance**

**Definition**: One wallet controls excessive percentage of total supply

**Measurement**:
```
balances = values from data.24h.wallet_balances
positive_balances = filter balances where balance > 0
sorted_balances = sort(positive_balances descending)
largest_wallet = sorted_balances[0]
total_supply = sum(positive_balances)
dominance_ratio = (largest_wallet / total_supply) * 100
```

**Red Flag Threshold**:
- **CRITICAL**: dominance_ratio >= 30%
- **WARNING**: dominance_ratio >= 20%

**Risk**: Single entity can dump and crash price

**Data Source**: `data.24h.wallet_balances`

---

### **RF2: Top 3 Wallet Concentration**

**Definition**: Top 3 wallets control majority of supply

**Measurement**:
```
sorted_balances = sort(positive_balances descending)
top_3_sum = sum(sorted_balances[0:3])
concentration_ratio = (top_3_sum / total_supply) * 100
```

**Red Flag Threshold**:
- **CRITICAL**: concentration_ratio >= 60%
- **WARNING**: concentration_ratio >= 50%

**Risk**: Coordinated dump by few wallets

**Data Source**: `data.24h.wallet_balances`

---

### **RF3: Extreme Gini Coefficient**

**Definition**: Wealth distribution is extremely unequal

**Measurement**:
```
gini = W6 (Wallet Balance Gini Coefficient)
```

**Red Flag Threshold**:
- **CRITICAL**: gini >= 0.90
- **WARNING**: gini >= 0.80

**Risk**: Unfair distribution, whale manipulation

**Data Source**: Feature W6

---

### **RF4: Excessive Whale Count**

**Definition**: Too many wallets holding >1% of supply

**Measurement**:
```
whale_count = W4 (Whale Wallet Count)
```

**Red Flag Threshold**:
- **CRITICAL**: whale_count >= 15
- **WARNING**: whale_count >= 10

**Risk**: Multiple whales can coordinate dumps

**Data Source**: Feature W4

---

### **RF5: Negative Balance Dominance**

**Definition**: Many wallets have negative balances (pre-launch holders dumping)

**Measurement**:
```
balances = values from data.24h.wallet_balances
negative_count = count(balances where balance < 0)
total_wallets = length(balances)
negative_ratio = (negative_count / total_wallets) * 100
```

**Red Flag Threshold**:
- **CRITICAL**: negative_ratio >= 40%
- **WARNING**: negative_ratio >= 25%

**Risk**: Insiders dumping on retail buyers

**Data Source**: `data.24h.wallet_balances`

---

## Category 2: Volume & Trading Red Flags

### **RF6: Fake Volume Pattern (Wash Trading)**

**Definition**: High volume but low unique transactions

**Measurement**:
```
total_volume = sum(data.24h.ohlcv[i].volume for all i)
unique_txs = metadata.transaction_count
volume_per_tx = total_volume / unique_txs

# Also check unique wallets per transaction
unique_wallets = data.24h.holders_count
wallets_per_tx = unique_wallets / unique_txs
```

**Red Flag Threshold**:
- **CRITICAL**: wallets_per_tx < 0.3 (same wallets trading repeatedly)
- **WARNING**: wallets_per_tx < 0.5

**Risk**: Artificial volume to attract buyers

**Data Source**: `data.24h.ohlcv`, `metadata.transaction_count`, `data.24h.holders_count`

---

### **RF7: Volume Front-Loading**

**Definition**: Majority of volume in first hour, then dies

**Measurement**:
```
vol_1h = sum(data.1h.ohlcv[i].volume for all i)
vol_24h = sum(data.24h.ohlcv[i].volume for all i)
first_hour_dominance = (vol_1h / vol_24h) * 100
```

**Red Flag Threshold**:
- **CRITICAL**: first_hour_dominance >= 70%
- **WARNING**: first_hour_dominance >= 50%

**Risk**: Pump-and-dump scheme

**Data Source**: `data.1h.ohlcv`, `data.24h.ohlcv`

---

### **RF8: Volume Collapse**

**Definition**: Volume drops dramatically after initial period

**Measurement**:
```
volume_trend = V2 (Volume Trend)
```

**Red Flag Threshold**:
- **CRITICAL**: volume_trend <= -80%
- **WARNING**: volume_trend <= -60%

**Risk**: Interest died, token is dead

**Data Source**: Feature V2

---

### **RF9: Extreme Volume Spikes**

**Definition**: Few massive volume spikes, otherwise dead

**Measurement**:
```
volumes = [data.24h.ohlcv[i].volume for all i]
mean_volume = mean(volumes)
std_volume = standard_deviation(volumes)
spike_count = count(volumes where volume > mean_volume + 5 * std_volume)
spike_ratio = spike_count / length(volumes)
```

**Red Flag Threshold**:
- **CRITICAL**: spike_ratio >= 0.05 (5%+ of intervals are extreme spikes)
- **WARNING**: spike_ratio >= 0.03

**Risk**: Coordinated pump activity

**Data Source**: `data.24h.ohlcv`

---

### **RF10: Zero Volume Dominance**

**Definition**: Too many intervals with zero trading volume

**Measurement**:
```
zero_volume_count = V7 (Zero Volume Intervals)
total_intervals = length(data.24h.ohlcv)
zero_ratio = (zero_volume_count / total_intervals) * 100
```

**Red Flag Threshold**:
- **CRITICAL**: zero_ratio >= 30%
- **WARNING**: zero_ratio >= 20%

**Risk**: No liquidity, dead token

**Data Source**: Feature V7

---

## Category 3: Growth & Adoption Red Flags

### **RF11: No Organic Growth**

**Definition**: Holder count stagnant or declining

**Measurement**:
```
holder_growth = W2 (Holder Growth Rate)
```

**Red Flag Threshold**:
- **CRITICAL**: holder_growth <= 0% (declining)
- **WARNING**: holder_growth <= 10%

**Risk**: No community interest

**Data Source**: Feature W2

---

### **RF12: Tiny Holder Base**

**Definition**: Very few unique holders after 24 hours

**Measurement**:
```
total_holders = W1 (Total Unique Holders 24h)
```

**Red Flag Threshold**:
- **CRITICAL**: total_holders < 30
- **WARNING**: total_holders < 50

**Risk**: No community, easy to manipulate

**Data Source**: Feature W1

---

### **RF13: Extreme Holder Churn**

**Definition**: Most early holders exit quickly

**Measurement**:
```
retention_rate = G9 (Holder Retention Rate)
```

**Red Flag Threshold**:
- **CRITICAL**: retention_rate <= 20%
- **WARNING**: retention_rate <= 35%

**Risk**: No holder conviction, everyone dumping

**Data Source**: Feature G9

---

### **RF14: All Sellers, No Holders**

**Definition**: Very few wallets are pure buyers (most are selling)

**Measurement**:
```
active_buyer_ratio = W7 (Active Buyer Ratio)
```

**Red Flag Threshold**:
- **CRITICAL**: active_buyer_ratio <= 15%
- **WARNING**: active_buyer_ratio <= 30%

**Risk**: Everyone is exiting, no diamond hands

**Data Source**: Feature W7

---

### **RF15: Holder Growth Deceleration**

**Definition**: Holder growth slows dramatically over time

**Measurement**:
```
holders_1h = data.1h.holders_count
holders_6h = data.6h.holders_count
holders_24h = data.24h.holders_count

growth_rate_early = (holders_6h - holders_1h) / holders_1h
growth_rate_late = (holders_24h - holders_6h) / holders_6h

deceleration = growth_rate_early - growth_rate_late
```

**Red Flag Threshold**:
- **CRITICAL**: deceleration >= 0.8 (80%+ slowdown)
- **WARNING**: deceleration >= 0.5

**Risk**: Initial hype faded, no sustained interest

**Data Source**: `data.1h.holders_count`, `data.6h.holders_count`, `data.24h.holders_count`

---

## Category 4: Price & Volatility Red Flags

### **RF16: Extreme Price Dump**

**Definition**: Price crashed significantly from launch

**Measurement**:
```
price_change = G1 (Price Change 24h)
```

**Red Flag Threshold**:
- **CRITICAL**: price_change <= -70%
- **WARNING**: price_change <= -50%

**Risk**: Token already failed

**Data Source**: Feature G1

---

### **RF17: Early All-Time High (Pump-and-Dump)**

**Definition**: ATH occurred very early, then dumped

**Measurement**:
```
ath_hour = G3 (All-Time High Timing)
recovery_ratio = G4 (Price Recovery Ratio)
```

**Red Flag Threshold**:
- **CRITICAL**: ath_hour <= 3 AND recovery_ratio <= 0.4
- **WARNING**: ath_hour <= 6 AND recovery_ratio <= 0.6

**Risk**: Classic pump-and-dump pattern

**Data Source**: Features G3, G4

---

### **RF18: Failed to Maintain Gains**

**Definition**: Price peaked but couldn't hold gains

**Measurement**:
```
recovery_ratio = G4 (Price Recovery Ratio)
```

**Red Flag Threshold**:
- **CRITICAL**: recovery_ratio <= 0.30
- **WARNING**: recovery_ratio <= 0.50

**Risk**: Weak price action, no support

**Data Source**: Feature G4

---

### **RF19: Extreme Price Volatility**

**Definition**: Price swings wildly (manipulation)

**Measurement**:
```
closes = [data.24h.ohlcv[i].close for all i]
mean_close = mean(closes)
std_close = standard_deviation(closes)
coefficient_of_variation = std_close / mean_close
```

**Red Flag Threshold**:
- **CRITICAL**: coefficient_of_variation >= 1.5
- **WARNING**: coefficient_of_variation >= 1.0

**Risk**: Unstable, likely manipulated

**Data Source**: `data.24h.ohlcv`

---

### **RF20: Negative Price-Volume Correlation**

**Definition**: Price drops when volume increases (coordinated dumps)

**Measurement**:
```
price_volume_correlation = G7 (Price-Volume Correlation)
```

**Red Flag Threshold**:
- **CRITICAL**: price_volume_correlation <= -0.5
- **WARNING**: price_volume_correlation <= -0.3

**Risk**: Volume spikes are dumps, not organic buying

**Data Source**: Feature G7

---

## Category 5: Behavioral Pattern Red Flags

### **RF21: Dead Trading Activity**

**Definition**: Very few transactions per hour

**Measurement**:
```
tx_velocity = T2 (Transaction Velocity)
```

**Red Flag Threshold**:
- **CRITICAL**: tx_velocity < 3 tx/hour
- **WARNING**: tx_velocity < 5 tx/hour

**Risk**: No interest, dead token

**Data Source**: Feature T2

---

### **RF22: Extreme Sell Pressure**

**Definition**: Far more selling than buying

**Measurement**:
```
buy_sell_ratio = T3 (Buy/Sell Ratio)
```

**Red Flag Threshold**:
- **CRITICAL**: buy_sell_ratio <= 0.6
- **WARNING**: buy_sell_ratio <= 0.8

**Risk**: Everyone is exiting

**Data Source**: Feature T3

---

### **RF23: Transaction Clustering (Bot Activity)**

**Definition**: Transactions occur in suspicious bursts

**Measurement**:
```
clustering_score = T9 (Transaction Clustering Score)
```

**Red Flag Threshold**:
- **CRITICAL**: clustering_score >= 100
- **WARNING**: clustering_score >= 50

**Risk**: Bot-driven trading, not organic

**Data Source**: Feature T9

---

### **RF24: Large Transaction Dominance**

**Definition**: Most volume from few large transactions (whale manipulation)

**Measurement**:
```
large_tx_ratio = T6 (Large Transaction Ratio)
```

**Red Flag Threshold**:
- **CRITICAL**: large_tx_ratio >= 40%
- **WARNING**: large_tx_ratio >= 30%

**Risk**: Whales control price action

**Data Source**: Feature T6

---

### **RF25: Inconsistent Buy/Sell with Price**

**Definition**: High buy ratio but price is dropping (fake buying)

**Measurement**:
```
buy_sell_ratio = T3
price_change = G1

# Red flag if buy_sell_ratio > 1.3 but price_change < 0
inconsistency = (buy_sell_ratio > 1.3) AND (price_change < 0)
```

**Red Flag Threshold**:
- **CRITICAL**: inconsistency = TRUE AND price_change <= -20%
- **WARNING**: inconsistency = TRUE AND price_change < 0

**Risk**: Wash trading or fake volume

**Data Source**: Features T3, G1

---

## Red Flag Scoring System

### **Severity Levels**:

- **CRITICAL**: 10 points per flag
- **WARNING**: 5 points per flag

### **Total Red Flag Score Calculation**:

```python
def calculate_red_flag_score(token_features, json_data):
    critical_flags = []
    warning_flags = []
    
    # Category 1: Ownership & Distribution
    if check_RF1(token_features) == 'CRITICAL':
        critical_flags.append('RF1_single_wallet_dominance')
    elif check_RF1(token_features) == 'WARNING':
        warning_flags.append('RF1_single_wallet_dominance')
    
    # ... check all 25 red flags ...
    
    critical_score = len(critical_flags) * 10
    warning_score = len(warning_flags) * 5
    total_red_flag_score = critical_score + warning_score
    
    # Determine risk level
    if total_red_flag_score >= 50:
        risk_level = 'EXTREME'
    elif total_red_flag_score >= 30:
        risk_level = 'HIGH'
    elif total_red_flag_score >= 15:
        risk_level = 'MEDIUM'
    else:
        risk_level = 'LOW'
    
    return {
        'total_red_flag_score': total_red_flag_score,
        'risk_level': risk_level,
        'critical_flags': critical_flags,
        'warning_flags': warning_flags,
        'flag_count': {
            'critical': len(critical_flags),
            'warning': len(warning_flags),
            'total': len(critical_flags) + len(warning_flags)
        }
    }
```

---

## Output Schema Addition

Add `red_flags` object to output JSON root level:

```json
{
  "token": "PEPE",
  "address": "DezXAZ8z...",
  "chain": "solana",
  "launch_time": 1704067200,
  "red_flags": {
    "total_score": 35,
    "risk_level": "HIGH",
    "critical_flags": [
      "RF1_single_wallet_dominance",
      "RF7_volume_front_loading",
      "RF17_early_ath_pump_dump"
    ],
    "warning_flags": [
      "RF3_extreme_gini",
      "RF13_extreme_holder_churn"
    ],
    "flag_count": {
      "critical": 3,
      "warning": 2,
      "total": 5
    },
    "category_breakdown": {
      "ownership_distribution": {
        "flags": ["RF1_single_wallet_dominance", "RF3_extreme_gini"],
        "score": 15
      },
      "volume_trading": {
        "flags": ["RF7_volume_front_loading"],
        "score": 10
      },
      "growth_adoption": {
        "flags": ["RF13_extreme_holder_churn"],
        "score": 5
      },
      "price_volatility": {
        "flags": ["RF17_early_ath_pump_dump"],
        "score": 10
      },
      "behavioral_patterns": {
        "flags": [],
        "score": 0
      }
    },
    "flag_details": {
      "RF1_single_wallet_dominance": {
        "severity": "CRITICAL",
        "measured_value": 35.2,
        "threshold": 30.0,
        "description": "Single wallet controls 35.2% of supply"
      },
      "RF3_extreme_gini": {
        "severity": "WARNING",
        "measured_value": 0.82,
        "threshold": 0.80,
        "description": "Gini coefficient indicates extreme inequality"
      },
      "RF7_volume_front_loading": {
        "severity": "CRITICAL",
        "measured_value": 72.5,
        "threshold": 70.0,
        "description": "72.5% of volume in first hour"
      },
      "RF13_extreme_holder_churn": {
        "severity": "WARNING",
        "measured_value": 28.3,
        "threshold": 35.0,
        "description": "Only 28.3% of early holders retained"
      },
      "RF17_early_ath_pump_dump": {
        "severity": "CRITICAL",
        "measured_value": {"ath_hour": 2.5, "recovery_ratio": 0.35},
        "threshold": {"ath_hour": 3, "recovery_ratio": 0.4},
        "description": "ATH at hour 2.5, recovered only 35%"
      }
    }
  },
  "pattern_match": { ... },
  "success_score": { ... },
  "classification": { ... },
  "metadata": { ... },
  "data": { ... }
}
```

---

## Risk Level Interpretation

### **EXTREME Risk (50+ points)**

**Characteristics**:
- 5+ critical flags OR 10+ total flags
- Multiple severe issues across categories
- Clear scam or manipulation indicators

**Action**: **REJECT** - Do not invest under any circumstances

---

### **HIGH Risk (30-49 points)**

**Characteristics**:
- 3-4 critical flags OR 6-9 total flags
- Significant concerns in multiple areas
- Likely pump-and-dump or failing token

**Action**: **AVOID** - High probability of loss

---

### **MEDIUM Risk (15-29 points)**

**Characteristics**:
- 1-2 critical flags OR 3-5 total flags
- Some concerning patterns
- Mixed signals

**Action**: **CAUTION** - Only invest with strict risk management

---

### **LOW Risk (0-14 points)**

**Characteristics**:
- 0-1 critical flags OR 0-2 total flags
- Minimal red flags
- Relatively healthy patterns

**Action**: **PROCEED** - But still monitor closely

---

## Red Flag Priority Matrix

### **Highest Priority (Immediate Disqualification)**:

1. **RF1**: Single Wallet Dominance (>30%)
2. **RF16**: Extreme Price Dump (<-70%)
3. **RF17**: Early ATH Pump-and-Dump
4. **RF6**: Fake Volume (Wash Trading)
5. **RF11**: No Organic Growth (declining holders)

**If ANY of these are CRITICAL**: Automatic rejection regardless of other metrics

---

### **High Priority (Strong Warning)**:

6. **RF2**: Top 3 Wallet Concentration (>60%)
7. **RF7**: Volume Front-Loading (>70%)
8. **RF8**: Volume Collapse (<-80%)
9. **RF13**: Extreme Holder Churn (<20%)
10. **RF22**: Extreme Sell Pressure (<0.6)

---

### **Medium Priority (Caution)**:

11-25: All remaining red flags

---

## Validation Rules

**Red Flag Validation** (add to validation script):

1. **Verify red_flags object exists** in output JSON
2. **Verify total_score matches** sum of flag scores
3. **Verify risk_level matches** score thresholds
4. **Verify flag_count is accurate**
5. **Verify all flagged items have details** in flag_details
6. **Verify measured_value exceeds threshold** for each flag

---

## Example Red Flag Analysis

### **Example 1: Scam Token (Score: 65 - EXTREME)**

**Flags Detected**:
- RF1 (CRITICAL): 42% single wallet dominance
- RF2 (CRITICAL): 78% top 3 concentration
- RF6 (CRITICAL): 0.25 wallets per tx (wash trading)
- RF7 (CRITICAL): 85% volume in first hour
- RF17 (CRITICAL): ATH at hour 1, 25% recovery
- RF11 (WARNING): 5% holder growth
- RF13 (WARNING): 18% retention

**Total**: 50 (critical) + 10 (warning) = **60 points**
**Risk Level**: EXTREME
**Action**: REJECT

---

### **Example 2: Risky Token (Score: 35 - HIGH)**

**Flags Detected**:
- RF3 (WARNING): 0.83 Gini coefficient
- RF7 (CRITICAL): 72% volume in first hour
- RF13 (WARNING): 32% retention
- RF17 (CRITICAL): ATH at hour 4, 45% recovery
- RF24 (WARNING): 35% large transaction ratio

**Total**: 20 (critical) + 15 (warning) = **35 points**
**Risk Level**: HIGH
**Action**: AVOID

---

### **Example 3: Cautious Token (Score: 20 - MEDIUM)**

**Flags Detected**:
- RF3 (WARNING): 0.81 Gini coefficient
- RF10 (WARNING): 22% zero volume intervals
- RF13 (WARNING): 33% retention
- RF24 (WARNING): 31% large transaction ratio

**Total**: 0 (critical) + 20 (warning) = **20 points**
**Risk Level**: MEDIUM
**Action**: CAUTION

---

## Summary

**Red Flag System Characteristics**:
- ✅ 25 distinct red flags across 5 categories
- ✅ All flags are measurable from JSON data
- ✅ Clear thresholds (CRITICAL vs WARNING)
- ✅ Severity-based scoring (10 pts critical, 5 pts warning)
- ✅ 4-tier risk levels (EXTREME/HIGH/MEDIUM/LOW)
- ✅ Priority matrix for decision-making
- ✅ Detailed flag breakdown in output
- ✅ Automatic rejection criteria for worst flags

**Use Cases**:
- Pre-investment screening
- Scam detection
- Risk assessment
- Portfolio filtering
- Alert systems (trigger on CRITICAL flags)

**Integration with Other Systems**:
- Red Flags: Identifies what's wrong
- Success Score: Evaluates overall potential
- Pattern Match: Compares to winners
- **Combined**: Comprehensive risk/reward analysis

---

**END OF RED FLAG DETECTION SYSTEM**


---

## AUDIT FIX REQUIREMENTS

### Requirement 13: Collect Market Data (Supply and Market Cap)

**User Story:** As a crypto analyst, I want to collect circulating supply, total supply, and market cap data, so that I can normalize metrics and compute whale percentages accurately.

#### Acceptance Criteria

1. WHEN token specifications are loaded, THE CLI_Tool SHALL accept optional fields: circulating_supply, total_supply, market_cap
2. IF circulating_supply is not provided in tokens.json, THE CLI_Tool SHALL attempt to fetch it from Birdeye API token metadata endpoint
3. IF total_supply is not provided in tokens.json, THE CLI_Tool SHALL attempt to fetch it from Birdeye API token metadata endpoint
4. IF market_cap is not provided in tokens.json, THE CLI_Tool SHALL attempt to fetch it from Birdeye API token metadata endpoint
5. IF any market data field cannot be fetched, THE CLI_Tool SHALL set it to null
6. THE CLI_Tool SHALL NOT estimate or infer missing market data values
7. WHEN generating JSON output, THE CLI_Tool SHALL include circulating_supply, total_supply, and market_cap fields
8. WHEN computing whale metrics (W5), THE CLI_Tool SHALL check if circulating_supply is not null before computing
9. IF circulating_supply is null, THE CLI_Tool SHALL set W5 (whale count) to null

### Requirement 14: Collect Liquidity Data

**User Story:** As a crypto analyst, I want to track liquidity pool data over time, so that I can detect rug pulls and liquidity manipulation.

#### Acceptance Criteria

1. WHEN processing a token, THE CLI_Tool SHALL collect liquidity pool data for the 24-hour window
2. THE CLI_Tool SHALL fetch liquidity snapshots at minimum 1-minute resolution
3. FOR each liquidity snapshot, THE CLI_Tool SHALL collect: pool_address, token_reserve, base_reserve, liquidity_usd, timestamp
4. THE CLI_Tool SHALL store liquidity data as a time series array
5. WHEN generating JSON output, THE CLI_Tool SHALL include liquidity_timeseries array
6. IF liquidity data cannot be fetched, THE CLI_Tool SHALL set liquidity_timeseries to empty array
7. THE CLI_Tool SHALL log a warning if liquidity data is unavailable

### Requirement 15: Track Mint and Burn Events

**User Story:** As a crypto analyst, I want to track token supply changes (mints and burns), so that I can detect supply manipulation.

#### Acceptance Criteria

1. WHEN processing a token, THE CLI_Tool SHALL collect mint and burn events for the 24-hour window
2. FOR each mint event, THE CLI_Tool SHALL record: type="mint", amount, timestamp
3. FOR each burn event, THE CLI_Tool SHALL record: type="burn", amount, timestamp
4. THE CLI_Tool SHALL store mint/burn events in chronological order
5. WHEN generating JSON output, THE CLI_Tool SHALL include mint_burn_events array
6. IF mint/burn data cannot be fetched, THE CLI_Tool SHALL set mint_burn_events to empty array

### Requirement 16: Fix Rug Pull Detection (RF19)

**User Story:** As a crypto analyst, I want accurate rug pull detection based on liquidity removal, so that I can identify exit scams.

#### Acceptance Criteria

1. WHEN computing RF19 (rug pull detection), THE CLI_Tool SHALL check if liquidity_timeseries has at least 2 data points
2. IF liquidity_timeseries has fewer than 2 data points, THE CLI_Tool SHALL set RF19 to null
3. WHEN liquidity_timeseries is available, THE CLI_Tool SHALL check for liquidity drops exceeding 70% within 1 hour
4. IF a liquidity drop exceeds 70% within 1 hour, THE CLI_Tool SHALL set RF19 to true
5. IF no significant liquidity drop is detected, THE CLI_Tool SHALL set RF19 to false
6. THE CLI_Tool SHALL include evidence in red flag details (timestamps, liquidity values, drop percentage)

### Requirement 17: Improve Wash Trading Detection (RF17)

**User Story:** As a crypto analyst, I want improved wash trading detection that considers liquidity context, so that I can distinguish fake volume from genuine trading.

#### Acceptance Criteria

1. WHEN computing RF17 (wash trading), THE CLI_Tool SHALL check volume, price movement, and liquidity
2. THE CLI_Tool SHALL flag wash trading when: volume is high AND price change < 2% AND (liquidity is low OR liquidity is decreasing)
3. IF liquidity data is unavailable, THE CLI_Tool SHALL compute RF17 using volume and price only (partial detection)
4. THE CLI_Tool SHALL include liquidity context in RF17 evidence
5. THE CLI_Tool SHALL log a warning if RF17 is computed without liquidity data

### Requirement 18: Exclude Synthetic OHLCV from Volume Features

**User Story:** As a crypto analyst, I want volume features computed only from real data, so that synthetic records do not corrupt analysis.

#### Acceptance Criteria

1. WHEN generating synthetic OHLCV records, THE CLI_Tool SHALL set synthetic flag to true
2. WHEN generating real OHLCV records, THE CLI_Tool SHALL set synthetic flag to false
3. WHEN computing volume features (V1-V10), THE CLI_Tool SHALL filter out records where synthetic=true
4. THE CLI_Tool SHALL compute volume features using only real OHLCV data
5. WHEN generating JSON output, THE CLI_Tool SHALL include synthetic field for each OHLCV record
6. THE CLI_Tool SHALL log the count of synthetic vs real records

### Requirement 19: Load Winner Profile for Pattern Matching

**User Story:** As a crypto analyst, I want pattern matching to use a validated winner profile, so that comparisons are based on real historical data.

#### Acceptance Criteria

1. WHEN initializing PatternMatcher, THE CLI_Tool SHALL attempt to load winner_profile.json
2. IF winner_profile.json does not exist, THE CLI_Tool SHALL disable pattern matching and set similarity score to null
3. IF winner_profile.json exists but sample_size is 0, THE CLI_Tool SHALL disable pattern matching and set similarity score to null
4. IF winner_profile.json is valid and populated, THE CLI_Tool SHALL enable pattern matching
5. THE CLI_Tool SHALL NOT guess or generate winner profile values
6. WHEN pattern matching is disabled, THE CLI_Tool SHALL log a warning
7. WHEN generating JSON output, THE CLI_Tool SHALL include pattern_match_enabled flag

### Requirement 20: Track External Events (CEX Listings)

**User Story:** As a crypto analyst, I want to correlate token data with CEX listing events, so that I can analyze listing impact.

#### Acceptance Criteria

1. WHEN processing a token, THE CLI_Tool SHALL attempt to load cex_listings.json
2. THE CLI_Tool SHALL search for listings matching the token address
3. IF a matching listing is found, THE CLI_Tool SHALL include listing data in output
4. THE CLI_Tool SHALL include: exchange_name, listing_timestamp, price snapshots (before/after)
5. IF no listing is found, THE CLI_Tool SHALL set cex_listing to null
6. THE CLI_Tool SHALL NOT fail if cex_listings.json is missing or empty
7. WHEN generating JSON output, THE CLI_Tool SHALL include cex_listing field

### Requirement 21: Validate Data Consistency

**User Story:** As a crypto analyst, I want cross-validation of data sources, so that I can detect inconsistencies and data quality issues.

#### Acceptance Criteria

1. WHEN OHLCV data is collected, THE CLI_Tool SHALL compare prices from different sources if available
2. IF price mismatch exceeds 20%, THE CLI_Tool SHALL set data_inconsistency flag to true
3. THE CLI_Tool SHALL record data warnings with details (type, values, mismatch percentage)
4. WHEN generating JSON output, THE CLI_Tool SHALL include data_inconsistency boolean flag
5. WHEN generating JSON output, THE CLI_Tool SHALL include data_warnings array
6. THE CLI_Tool SHALL log data inconsistency warnings
7. THE CLI_Tool SHALL continue processing even when inconsistencies are detected

### Requirement 22: Implement API Fallback Strategy

**User Story:** As a system operator, I want fallback data sources when primary API fails, so that data collection is more reliable.

#### Acceptance Criteria

1. WHEN Birdeye API request fails after all retries, THE CLI_Tool SHALL attempt fallback to secondary source
2. THE CLI_Tool SHALL support Helius API as fallback for transaction data
3. THE CLI_Tool SHALL support blockchain RPC as fallback for on-chain data
4. IF primary and fallback sources both fail, THE CLI_Tool SHALL log error and continue to next token
5. THE CLI_Tool SHALL log which data source was used (primary or fallback)
6. THE CLI_Tool SHALL include data_source field in output metadata

### Requirement 23: Implement Simple Batching

**User Story:** As a system operator, I want to process tokens in small batches, so that the system can scale to more tokens.

#### Acceptance Criteria

1. WHEN processing multiple tokens, THE CLI_Tool SHALL group tokens into batches of 5
2. THE CLI_Tool SHALL process each batch sequentially
3. WITHIN each batch, THE CLI_Tool SHALL process tokens sequentially (no parallel processing)
4. THE CLI_Tool SHALL maintain rate limiter state across all batches
5. THE CLI_Tool SHALL log batch progress (e.g., "Processing batch 2 of 10")

### Requirement 24: Implement Basic Caching

**User Story:** As a system operator, I want to skip tokens that have already been processed, so that I can resume interrupted batch jobs.

#### Acceptance Criteria

1. BEFORE processing a token, THE CLI_Tool SHALL check if output file already exists
2. IF output file exists, THE CLI_Tool SHALL log "Skipping [token] - output already exists"
3. IF output file exists, THE CLI_Tool SHALL skip to next token
4. THE CLI_Tool SHALL support --force flag to override caching and reprocess all tokens
5. WHEN --force flag is provided, THE CLI_Tool SHALL process all tokens regardless of existing output files

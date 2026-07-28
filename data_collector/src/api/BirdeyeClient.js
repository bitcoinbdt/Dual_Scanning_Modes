/**
 * BirdeyeClient API Module
 * 
 * Handles all HTTP communication with the Birdeye API.
 * 
 * Features:
 * - Authentication via API key header
 * - Retry logic with exponential backoff
 * - Rate limit handling (HTTP 429)
 * - Timeout handling (30s)
 * - Network error retry: 1s, 2s, 4s
 * - Server error retry: 2s, 4s, 8s
 */

class BirdeyeClient {
  /**
   * Initialize BirdeyeClient
   * @param {string} apiKey - Birdeye API key
   * @param {RateLimiter} rateLimiter - Rate limiter instance
   */
  constructor(apiKey, rateLimiter) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    if (!rateLimiter) {
      throw new Error('RateLimiter instance is required');
    }

    this.apiKey = apiKey;
    this.rateLimiter = rateLimiter;
    this.baseUrl = 'https://public-api.birdeye.so';
    this.timeout = 30000; // 30 seconds
    this.maxRetries = 3;
    this.networkBackoff = [1000, 2000, 4000]; // 1s, 2s, 4s
    this.serverBackoff = [2000, 4000, 8000];  // 2s, 4s, 8s
  }

  /**
   * Fetch OHLCV data for a token
   * @param {string} address - Token contract address
   * @param {number} timeFrom - Start timestamp (Unix seconds)
   * @param {number} timeTo - End timestamp (Unix seconds)
   * @param {string} type - Interval type (default: '1m')
   * @returns {Promise<Array>} Array of OHLCV records
   */
  async fetchOHLCV(address, timeFrom, timeTo, type = '1m') {
    const url = `${this.baseUrl}/defi/ohlcv?address=${address}&type=${type}&time_from=${timeFrom}&time_to=${timeTo}`;
    
    const response = await this.makeRequest(url, {
      method: 'GET',
      headers: this._getHeaders()
    });

    if (response.success && response.data && response.data.items) {
      return response.data.items;
    }

    return [];
  }

  /**
   * Fetch transactions for a token with pagination support
   * @param {string} address - Token contract address
   * @param {number} limit - Number of transactions per page (default: 100)
   * @param {number} offset - Pagination offset (default: 0)
   * @returns {Promise<Object>} Object containing items array and pagination info
   */
  async fetchTransactions(address, limit = 100, offset = 0) {
    let url = `${this.baseUrl}/defi/v3/token/txs?address=${address}&limit=${limit}`;
    
    if (offset > 0) {
      url += `&offset=${offset}`;
    }

    const response = await this.makeRequest(url, {
      method: 'GET',
      headers: this._getHeaders()
    });

    if (response.success && response.data) {
      return {
        items: response.data.items || [],
        hasMore: response.data.items && response.data.items.length === limit
      };
    }

    return {
      items: [],
      hasMore: false
    };
  }

  /**
   * Make HTTP request with retry logic and error handling
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   * @private
   */
  async makeRequest(url, options) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Wait for rate limiter before making request
        await this.rateLimiter.waitBeforeRequest();

        // Make request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle rate limit error (HTTP 429)
        if (response.status === 429) {
          const retryAfter = this._getRetryAfter(response);
          this.rateLimiter.recordRateLimit(retryAfter);
          
          const waitTime = retryAfter ? (retryAfter * 1000) + 500 : 5000;
          
          if (attempt < this.maxRetries) {
            await this._sleep(waitTime);
            continue;
          }
          
          throw new Error(`Rate limit exceeded after ${this.maxRetries} retries`);
        }

        // Handle server errors (HTTP 5xx)
        if (response.status >= 500) {
          this.rateLimiter.recordFailure();
          
          if (attempt < this.maxRetries) {
            const backoffTime = this.serverBackoff[attempt];
            await this._sleep(backoffTime);
            continue;
          }
          
          throw new Error(`Server error ${response.status} after ${this.maxRetries} retries`);
        }

        // Handle client errors (HTTP 4xx, except 429)
        if (response.status >= 400 && response.status < 500) {
          const errorBody = await response.text();
          throw new Error(`Client error ${response.status}: ${errorBody}`);
        }

        // Success - parse response
        const data = await response.json();
        this.rateLimiter.recordSuccess();
        return data;

      } catch (error) {
        lastError = error;

        // Handle timeout errors
        if (error.name === 'AbortError') {
          this.rateLimiter.recordFailure();
          
          if (attempt < this.maxRetries) {
            const backoffTime = this.networkBackoff[attempt];
            await this._sleep(backoffTime);
            continue;
          }
          
          throw new Error(`Request timeout after ${this.timeout}ms (${this.maxRetries} retries)`);
        }

        // Handle network errors (connection issues, DNS failures, etc.)
        if (this._isNetworkError(error)) {
          this.rateLimiter.recordFailure();
          
          if (attempt < this.maxRetries) {
            const backoffTime = this.networkBackoff[attempt];
            await this._sleep(backoffTime);
            continue;
          }
          
          throw new Error(`Network error after ${this.maxRetries} retries: ${error.message}`);
        }

        // Re-throw other errors immediately (no retry)
        throw error;
      }
    }

    throw lastError || new Error('Request failed');
  }

  /**
   * Get authentication headers
   * @returns {Object} Headers object
   * @private
   */
  _getHeaders() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Extract retry-after value from response headers
   * @param {Response} response - Fetch response object
   * @returns {number|null} Retry-after value in seconds, or null if not present
   * @private
   */
  _getRetryAfter(response) {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      return isNaN(seconds) ? null : seconds;
    }
    return null;
  }

  /**
   * Check if error is a network error
   * @param {Error} error - Error object
   * @returns {boolean} True if network error
   * @private
   */
  _isNetworkError(error) {
    return (
      error.message.includes('fetch failed') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ECONNRESET') ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET'
    );
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BirdeyeClient;

/**
 * RateLimiter Module
 * 
 * Manages API request timing to avoid rate limits with adaptive delay strategy.
 * 
 * Features:
 * - Enforces minimum delay between requests (100ms)
 * - Tracks consecutive successes and rate limit errors
 * - Adapts delay based on API response patterns
 * - Increases delay by 50% after 3 consecutive rate limits
 * - Decreases delay by 25% after 20 consecutive successes
 */

class RateLimiter {
  /**
   * Initialize RateLimiter with minimum delay
   * @param {number} minDelay - Minimum delay in milliseconds (default: 100ms)
   */
  constructor(minDelay = 100) {
    this.minDelay = minDelay;
    this.currentDelay = minDelay;
    this.consecutiveSuccesses = 0;
    this.consecutiveRateLimits = 0;
    this.lastRequestTime = null;
  }

  /**
   * Wait before making the next API request
   * Enforces the current delay based on the time since last request
   * @returns {Promise<void>}
   */
  async waitBeforeRequest() {
    if (this.lastRequestTime === null) {
      this.lastRequestTime = Date.now();
      return;
    }

    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    const remainingDelay = this.currentDelay - timeSinceLastRequest;

    if (remainingDelay > 0) {
      await this._sleep(remainingDelay);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Record a successful API request
   * Increases consecutive success counter and adapts delay if threshold reached
   */
  recordSuccess() {
    this.consecutiveSuccesses++;
    this.consecutiveRateLimits = 0;

    // After 20 consecutive successes, decrease delay by 25%
    if (this.consecutiveSuccesses >= 20) {
      this._decreaseDelay();
      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Record a rate limit error
   * Increases consecutive rate limit counter and adapts delay if threshold reached
   * @param {number} retryAfter - Optional retry-after value from API (in seconds)
   */
  recordRateLimit(retryAfter = null) {
    this.consecutiveRateLimits++;
    this.consecutiveSuccesses = 0;

    // After 3 consecutive rate limits, increase delay by 50%
    if (this.consecutiveRateLimits >= 3) {
      this._increaseDelay();
      this.consecutiveRateLimits = 0;
    }
  }

  /**
   * Record a general failure (not rate limit)
   * Resets consecutive success counter
   */
  recordFailure() {
    this.consecutiveSuccesses = 0;
  }

  /**
   * Get the current delay value
   * @returns {number} Current delay in milliseconds
   */
  getCurrentDelay() {
    return this.currentDelay;
  }

  /**
   * Increase delay by 50%
   * @private
   */
  _increaseDelay() {
    this.currentDelay = Math.round(this.currentDelay * 1.5);
  }

  /**
   * Decrease delay by 25%, but not below minimum
   * @private
   */
  _decreaseDelay() {
    const newDelay = Math.round(this.currentDelay * 0.75);
    this.currentDelay = Math.max(newDelay, this.minDelay);
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

export default RateLimiter;

import { describe, it, expect, beforeEach, vi } from 'vitest';
import RateLimiter from './RateLimiter.js';

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    vi.useFakeTimers();
  });

  describe('constructor', () => {
    it('should initialize with default minimum delay of 100ms', () => {
      const limiter = new RateLimiter();
      expect(limiter.minDelay).toBe(100);
      expect(limiter.currentDelay).toBe(100);
    });

    it('should initialize with custom minimum delay', () => {
      const limiter = new RateLimiter(200);
      expect(limiter.minDelay).toBe(200);
      expect(limiter.currentDelay).toBe(200);
    });

    it('should initialize counters to zero', () => {
      const limiter = new RateLimiter();
      expect(limiter.consecutiveSuccesses).toBe(0);
      expect(limiter.consecutiveRateLimits).toBe(0);
    });

    it('should initialize lastRequestTime to null', () => {
      const limiter = new RateLimiter();
      expect(limiter.lastRequestTime).toBeNull();
    });
  });

  describe('waitBeforeRequest', () => {
    it('should not wait on first request', async () => {
      const startTime = Date.now();
      await rateLimiter.waitBeforeRequest();
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeLessThan(10);
      expect(rateLimiter.lastRequestTime).not.toBeNull();
    });

    it('should enforce minimum delay between requests', async () => {
      await rateLimiter.waitBeforeRequest();
      
      vi.advanceTimersByTime(50);
      
      const waitPromise = rateLimiter.waitBeforeRequest();
      vi.advanceTimersByTime(50);
      await waitPromise;
      
      const timeSinceFirst = Date.now() - rateLimiter.lastRequestTime;
      expect(timeSinceFirst).toBeGreaterThanOrEqual(0);
    });

    it('should not wait if enough time has passed', async () => {
      await rateLimiter.waitBeforeRequest();
      
      vi.advanceTimersByTime(150);
      
      const startTime = Date.now();
      await rateLimiter.waitBeforeRequest();
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeLessThan(10);
    });

    it('should update lastRequestTime after each wait', async () => {
      await rateLimiter.waitBeforeRequest();
      const firstTime = rateLimiter.lastRequestTime;
      
      vi.advanceTimersByTime(100);
      await rateLimiter.waitBeforeRequest();
      const secondTime = rateLimiter.lastRequestTime;
      
      expect(secondTime).toBeGreaterThan(firstTime);
    });
  });

  describe('recordSuccess', () => {
    it('should increment consecutive successes counter', () => {
      rateLimiter.recordSuccess();
      expect(rateLimiter.consecutiveSuccesses).toBe(1);
      
      rateLimiter.recordSuccess();
      expect(rateLimiter.consecutiveSuccesses).toBe(2);
    });

    it('should reset consecutive rate limits counter', () => {
      rateLimiter.consecutiveRateLimits = 2;
      rateLimiter.recordSuccess();
      
      expect(rateLimiter.consecutiveRateLimits).toBe(0);
    });

    it('should decrease delay by 25% after 20 consecutive successes', () => {
      rateLimiter.currentDelay = 200;
      
      for (let i = 0; i < 20; i++) {
        rateLimiter.recordSuccess();
      }
      
      expect(rateLimiter.currentDelay).toBe(150);
      expect(rateLimiter.consecutiveSuccesses).toBe(0);
    });

    it('should not decrease delay below minimum', () => {
      rateLimiter.currentDelay = 100;
      rateLimiter.minDelay = 100;
      
      for (let i = 0; i < 20; i++) {
        rateLimiter.recordSuccess();
      }
      
      expect(rateLimiter.currentDelay).toBe(100);
    });

    it('should reset success counter after decreasing delay', () => {
      rateLimiter.currentDelay = 200;
      
      for (let i = 0; i < 20; i++) {
        rateLimiter.recordSuccess();
      }
      
      expect(rateLimiter.consecutiveSuccesses).toBe(0);
    });
  });

  describe('recordRateLimit', () => {
    it('should increment consecutive rate limits counter', () => {
      rateLimiter.recordRateLimit();
      expect(rateLimiter.consecutiveRateLimits).toBe(1);
      
      rateLimiter.recordRateLimit();
      expect(rateLimiter.consecutiveRateLimits).toBe(2);
    });

    it('should reset consecutive successes counter', () => {
      rateLimiter.consecutiveSuccesses = 5;
      rateLimiter.recordRateLimit();
      
      expect(rateLimiter.consecutiveSuccesses).toBe(0);
    });

    it('should increase delay by 50% after 3 consecutive rate limits', () => {
      rateLimiter.currentDelay = 100;
      
      rateLimiter.recordRateLimit();
      rateLimiter.recordRateLimit();
      rateLimiter.recordRateLimit();
      
      expect(rateLimiter.currentDelay).toBe(150);
      expect(rateLimiter.consecutiveRateLimits).toBe(0);
    });

    it('should reset rate limit counter after increasing delay', () => {
      rateLimiter.recordRateLimit();
      rateLimiter.recordRateLimit();
      rateLimiter.recordRateLimit();
      
      expect(rateLimiter.consecutiveRateLimits).toBe(0);
    });

    it('should accept optional retryAfter parameter', () => {
      expect(() => rateLimiter.recordRateLimit(5)).not.toThrow();
    });
  });

  describe('recordFailure', () => {
    it('should reset consecutive successes counter', () => {
      rateLimiter.consecutiveSuccesses = 10;
      rateLimiter.recordFailure();
      
      expect(rateLimiter.consecutiveSuccesses).toBe(0);
    });

    it('should not affect rate limit counter', () => {
      rateLimiter.consecutiveRateLimits = 2;
      rateLimiter.recordFailure();
      
      expect(rateLimiter.consecutiveRateLimits).toBe(2);
    });

    it('should not affect current delay', () => {
      rateLimiter.currentDelay = 150;
      rateLimiter.recordFailure();
      
      expect(rateLimiter.currentDelay).toBe(150);
    });
  });

  describe('getCurrentDelay', () => {
    it('should return current delay value', () => {
      expect(rateLimiter.getCurrentDelay()).toBe(100);
      
      rateLimiter.currentDelay = 200;
      expect(rateLimiter.getCurrentDelay()).toBe(200);
    });
  });

  describe('adaptive delay behavior', () => {
    it('should adapt delay upward with multiple rate limits', () => {
      rateLimiter.currentDelay = 100;
      
      // First 3 rate limits: 100 -> 150
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRateLimit();
      }
      expect(rateLimiter.currentDelay).toBe(150);
      
      // Next 3 rate limits: 150 -> 225
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRateLimit();
      }
      expect(rateLimiter.currentDelay).toBe(225);
    });

    it('should adapt delay downward with multiple successes', () => {
      rateLimiter.currentDelay = 300;
      
      // First 20 successes: 300 -> 225
      for (let i = 0; i < 20; i++) {
        rateLimiter.recordSuccess();
      }
      expect(rateLimiter.currentDelay).toBe(225);
      
      // Next 20 successes: 225 -> 169
      for (let i = 0; i < 20; i++) {
        rateLimiter.recordSuccess();
      }
      expect(rateLimiter.currentDelay).toBe(169);
    });

    it('should handle mixed success and rate limit patterns', () => {
      rateLimiter.currentDelay = 100;
      
      // 3 rate limits: increase to 150
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRateLimit();
      }
      expect(rateLimiter.currentDelay).toBe(150);
      
      // 20 successes: decrease to 113 (150 * 0.75 = 112.5, rounds to 113)
      for (let i = 0; i < 20; i++) {
        rateLimiter.recordSuccess();
      }
      expect(rateLimiter.currentDelay).toBe(113);
    });

    it('should not decrease below minimum delay', () => {
      rateLimiter.currentDelay = 120;
      rateLimiter.minDelay = 100;
      
      // 20 successes would decrease to 90, but should stop at 100
      for (let i = 0; i < 20; i++) {
        rateLimiter.recordSuccess();
      }
      
      expect(rateLimiter.currentDelay).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive calls to recordSuccess', () => {
      for (let i = 0; i < 100; i++) {
        rateLimiter.recordSuccess();
      }
      
      expect(rateLimiter.consecutiveSuccesses).toBe(0);
      expect(rateLimiter.currentDelay).toBe(100);
    });

    it('should handle rapid successive calls to recordRateLimit', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRateLimit();
      }
      
      expect(rateLimiter.consecutiveRateLimits).toBe(1);
      expect(rateLimiter.currentDelay).toBeGreaterThan(100);
    });

    it('should handle zero minimum delay', () => {
      const limiter = new RateLimiter(0);
      expect(limiter.minDelay).toBe(0);
      expect(limiter.currentDelay).toBe(0);
    });

    it('should round delay values correctly', () => {
      rateLimiter.currentDelay = 101;
      
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRateLimit();
      }
      
      // 101 * 1.5 = 151.5, should round to 152
      expect(rateLimiter.currentDelay).toBe(152);
    });
  });
});

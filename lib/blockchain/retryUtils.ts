/**
 * Retry utility with exponential backoff for handling transient API failures
 * 
 * This module provides retry logic to handle temporary failures from external APIs
 * (timeouts, rate limits, connection errors) while avoiding retries for permanent
 * errors (404, 401, 400).
 */

import { RetryOptions } from './types';

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate Limiter to queue API requests and enforce requests per second
 */
export class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private intervalMs: number;
  private lastExecution = 0;

  constructor(requestsPerSecond: number) {
    this.intervalMs = 1000 / requestsPerSecond;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await fn();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLast = now - this.lastExecution;
      
      if (timeSinceLast < this.intervalMs) {
        await sleep(this.intervalMs - timeSinceLast);
      }

      const task = this.queue.shift();
      this.lastExecution = Date.now();
      if (task) {
        await task();
      }
    }

    this.isProcessing = false;
  }
}

interface RetryError extends Error {
  code?: string;
  isPermanent?: boolean;
  response?: {
    status: number;
  };
}

interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  retryableStatusCodes?: number[];
  onRetry?: (attempt: number, maxRetries: number, delay: number, error: Error) => void;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 16000,
    backoffMultiplier = 2,
    retryableErrors = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'],
    retryableStatusCodes = [429, 403, 503, 504],
    onRetry = null
  } = options;

  let lastError: RetryError | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error as RetryError;
      
      // Check if error is marked as permanent
      if (lastError.isPermanent) {
        throw lastError;
      }
      
      // Check if error is retryable
      const isRetryableError = retryableErrors.includes(lastError.code || '');
      const isRetryableStatus = lastError.response && 
        retryableStatusCodes.includes(lastError.response.status);
      const isRetryable = isRetryableError || isRetryableStatus;
      
      // Don't retry permanent errors or if this was the last attempt
      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );
      
      // Add jitter
      const jitter = Math.random() * 500;
      const finalDelay = delay + jitter;
      
      // Invoke retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, finalDelay, lastError);
      }
      
      // Wait before next retry
      await sleep(finalDelay);
    }
  }
  
  throw lastError;
}

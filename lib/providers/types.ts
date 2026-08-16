/**
 * Provider-level Types and Interfaces
 */

export type ProviderName = 'goldrush' | 'alchemy' | 'uniswap' | 'bitquery' | 'goplus' | 'moralis' | 'helius';

export interface ProviderStatus {
  provider: ProviderName;
  configured: boolean;
  error?: string;
}

export class ProviderError extends Error {
  public readonly provider: ProviderName;
  public readonly status?: number;
  public readonly code?: string;

  constructor(message: string, provider: ProviderName, status?: number, code?: string) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

export interface BitqueryTokenState {
  accessToken: string;
  expiresAt: number; // unix timestamp in ms
}

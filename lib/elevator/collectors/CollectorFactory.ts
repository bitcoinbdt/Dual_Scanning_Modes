/**
 * Collector Factory - Creates blockchain-specific collectors
 * Implements factory pattern for easy multi-chain support.
 *
 * BSC and ETH now use GeckoTerminal (primary) + Birdeye (fallback).
 * No Etherscan or BscScan API keys required.
 */

import { IBlockchainCollector, CollectorApiKeys } from './types';
import { SolanaCollector } from './solana/SolanaCollector';
import { BscCollector } from './bsc/BscCollector';
import { EthCollector } from './eth/EthCollector';

export type SupportedBlockchain = 'solana' | 'bsc' | 'eth';

export class CollectorFactory {
  /**
   * Create a collector for the specified blockchain.
   */
  static create(
    blockchain: SupportedBlockchain,
    apiKeys: CollectorApiKeys
  ): IBlockchainCollector {
    switch (blockchain) {
      case 'solana':
        return this.createSolanaCollector(apiKeys);
      case 'bsc':
        return this.createBscCollector(apiKeys);
      case 'eth':
        return this.createEthCollector(apiKeys);
      default:
        throw new Error(`Unsupported blockchain: ${blockchain}`);
    }
  }

  /** Create Solana collector (Helius + Birdeye OHLCV) */
  private static createSolanaCollector(apiKeys: CollectorApiKeys): SolanaCollector {
    const { BIRDEYE_API_KEY, HELIUS_API_KEY } = apiKeys;

    if (!BIRDEYE_API_KEY) throw new Error('BIRDEYE_API_KEY is required for Solana collector');
    if (!HELIUS_API_KEY)  throw new Error('HELIUS_API_KEY is required for Solana collector');

    return new SolanaCollector(BIRDEYE_API_KEY, HELIUS_API_KEY);
  }

  /**
   * Create BSC collector.
   * Uses GeckoTerminal (primary, no key) + Birdeye trades (fallback) for swap events.
   * Only BIRDEYE_API_KEY needed for OHLCV and fallback trades.
   */
  private static createBscCollector(apiKeys: CollectorApiKeys): BscCollector {
    const { BIRDEYE_API_KEY } = apiKeys;

    if (!BIRDEYE_API_KEY) throw new Error('BIRDEYE_API_KEY is required for BSC collector');

    return new BscCollector(BIRDEYE_API_KEY);
  }

  /**
   * Create ETH collector.
   * Uses GeckoTerminal (primary, no key) + Birdeye trades (fallback) for swap events.
   * Only BIRDEYE_API_KEY needed for OHLCV and fallback trades.
   */
  private static createEthCollector(apiKeys: CollectorApiKeys): EthCollector {
    const { BIRDEYE_API_KEY } = apiKeys;

    if (!BIRDEYE_API_KEY) throw new Error('BIRDEYE_API_KEY is required for ETH collector');

    return new EthCollector(BIRDEYE_API_KEY);
  }

  static isSupported(blockchain: string): blockchain is SupportedBlockchain {
    return blockchain === 'solana' || blockchain === 'bsc' || blockchain === 'eth';
  }

  static getImplementedChains(): SupportedBlockchain[] {
    return ['solana', 'bsc', 'eth'];
  }

  static getAllSupportedChains(): SupportedBlockchain[] {
    return ['solana', 'bsc', 'eth'];
  }
}

/**
 * Collector Factory - Creates blockchain-specific collectors
 * Implements factory pattern for easy multi-chain support
 */

import { IBlockchainCollector, CollectorApiKeys } from './types';
import { SolanaCollector } from './solana/SolanaCollector';
import { BscCollector } from './bsc/BscCollector';
import { EthCollector } from './eth/EthCollector';

export type SupportedBlockchain = 'solana' | 'bsc' | 'eth';

/**
 * Factory class to create blockchain collectors
 */
export class CollectorFactory {
  /**
   * Create a collector for the specified blockchain
   * @param blockchain - The blockchain type
   * @param apiKeys - API keys for various services
   * @returns Blockchain collector instance
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

  /**
   * Create Solana collector
   */
  private static createSolanaCollector(apiKeys: CollectorApiKeys): SolanaCollector {
    const { BIRDEYE_API_KEY, HELIUS_API_KEY } = apiKeys;

    if (!BIRDEYE_API_KEY) {
      throw new Error('BIRDEYE_API_KEY is required for Solana collector');
    }

    if (!HELIUS_API_KEY) {
      throw new Error('HELIUS_API_KEY is required for Solana collector');
    }

    return new SolanaCollector(BIRDEYE_API_KEY, HELIUS_API_KEY);
  }

  /**
   * Create BSC collector
   */
  private static createBscCollector(apiKeys: CollectorApiKeys): BscCollector {
    const { BIRDEYE_API_KEY, BSCSCAN_API_KEY } = apiKeys;

    if (!BIRDEYE_API_KEY) {
      throw new Error('BIRDEYE_API_KEY is required for BSC collector');
    }

    if (!BSCSCAN_API_KEY) {
      throw new Error('BSCSCAN_API_KEY is required for BSC collector');
    }

    return new BscCollector(BIRDEYE_API_KEY, BSCSCAN_API_KEY);
  }

  /**
   * Create ETH collector
   */
  private static createEthCollector(apiKeys: CollectorApiKeys): EthCollector {
    const { BIRDEYE_API_KEY, ETHERSCAN_API_KEY } = apiKeys;

    if (!BIRDEYE_API_KEY) {
      throw new Error('BIRDEYE_API_KEY is required for ETH collector');
    }

    if (!ETHERSCAN_API_KEY) {
      throw new Error('ETHERSCAN_API_KEY is required for ETH collector');
    }

    return new EthCollector(BIRDEYE_API_KEY, ETHERSCAN_API_KEY);
  }

  /**
   * Check if a blockchain is supported
   * @param blockchain - The blockchain type
   * @returns Whether the blockchain is supported
   */
  static isSupported(blockchain: string): blockchain is SupportedBlockchain {
    return blockchain === 'solana' || blockchain === 'bsc' || blockchain === 'eth';
  }

  /**
   * Get list of currently implemented blockchains
   * @returns Array of implemented blockchain names
   */
  static getImplementedChains(): SupportedBlockchain[] {
    return ['solana', 'bsc', 'eth'];
  }

  /**
   * Get list of all supported (planned) blockchains
   * @returns Array of all supported blockchain names
   */
  static getAllSupportedChains(): SupportedBlockchain[] {
    return ['solana', 'bsc', 'eth'];
  }
}

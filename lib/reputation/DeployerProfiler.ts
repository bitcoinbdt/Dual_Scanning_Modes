import { supabase } from '../supabase';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';

export interface DeployerProfile {
  reputation: 'trusted' | 'neutral' | 'caution' | 'dangerous' | 'known_rugger';
  score: number; // 0 (safest) to 100 (riskiest)
  totalTokensCreated: number;
  successRate: number;
  activeTokensCount: number;
  walletAgeHours: number;
  walletFresh: boolean;
  details: {
    launchSuccessScore: number;
    lpManagementScore: number;
    dumpingScore: number;
    walletClusteringScore: number;
  };
}

const EXPLORER_API_MAP: Record<string, { url: string; keyEnvVar: string }> = {
  '1': { url: 'https://api.etherscan.io/api', keyEnvVar: 'ETHERSCAN_API_KEY' },
  'eth': { url: 'https://api.etherscan.io/api', keyEnvVar: 'ETHERSCAN_API_KEY' },
  '56': { url: 'https://api.bscscan.com/api', keyEnvVar: 'BSCSCAN_API_KEY' },
  'bsc': { url: 'https://api.bscscan.com/api', keyEnvVar: 'BSCSCAN_API_KEY' },
  '8453': { url: 'https://api.basescan.org/api', keyEnvVar: 'BASESCAN_API_KEY' },
  'base': { url: 'https://api.basescan.org/api', keyEnvVar: 'BASESCAN_API_KEY' },
  '137': { url: 'https://api.polygonscan.com/api', keyEnvVar: 'POLYGONSCAN_API_KEY' },
  'polygon': { url: 'https://api.polygonscan.com/api', keyEnvVar: 'POLYGONSCAN_API_KEY' },
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
}

export class DeployerProfiler {
  /**
   * Run Deployer Behavior Profiling (with a strict 2-second timeout)
   */
  static async profile(
    deployerAddress: string,
    network: string,
    solanaConnection?: Connection
  ): Promise<DeployerProfile> {
    const startTime = Date.now();

    // 1. Check known_ruggers table first
    try {
      const { data: rugger } = await supabase
        .from('known_ruggers')
        .select('*')
        .eq('deployer_address', deployerAddress)
        .maybeSingle();

      if (rugger) {
        console.log(`[DEPLOYER PROFILER] 🚨 Match found in known_ruggers table: ${deployerAddress}`);
        return {
          reputation: 'known_rugger',
          score: 100,
          totalTokensCreated: rugger.total_tokens || 1,
          successRate: 0.0,
          activeTokensCount: 0,
          walletAgeHours: 240,
          walletFresh: false,
          details: {
            launchSuccessScore: 100,
            lpManagementScore: 100,
            dumpingScore: 100,
            walletClusteringScore: 100
          }
        };
      }
    } catch (err) {
      console.warn(`[DEPLOYER PROFILER] Supabase query failed:`, err);
    }

    // Prepare default profile for fallbacks
    const defaultProfile: DeployerProfile = {
      reputation: 'neutral',
      score: 30,
      totalTokensCreated: 0,
      successRate: 1.0,
      activeTokensCount: 0,
      walletAgeHours: 48,
      walletFresh: false,
      details: {
        launchSuccessScore: 30,
        lpManagementScore: 30,
        dumpingScore: 30,
        walletClusteringScore: 30
      }
    };

    const remainingTime = 2000 - (Date.now() - startTime) - 100; // leave 100ms cushion
    if (remainingTime <= 0) return defaultProfile;

    // 2. Fetch history depending on the chain
    const profilePromise = network.toLowerCase() === 'solana'
      ? this.profileSolana(deployerAddress, solanaConnection)
      : this.profileEVM(deployerAddress, network);

    return withTimeout(profilePromise, remainingTime, defaultProfile);
  }

  private static async profileSolana(
    address: string,
    connection?: Connection
  ): Promise<DeployerProfile> {
    if (!connection) {
      throw new Error('Connection required for Solana deployer profiling');
    }

    const pubkey = new PublicKey(address);
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 100 });

    if (signatures.length === 0) {
      return {
        reputation: 'neutral',
        score: 35,
        totalTokensCreated: 0,
        successRate: 1.0,
        activeTokensCount: 0,
        walletAgeHours: 0,
        walletFresh: true,
        details: {
          launchSuccessScore: 30,
          lpManagementScore: 30,
          dumpingScore: 30,
          walletClusteringScore: 40
        }
      };
    }

    const oldestTx = signatures[signatures.length - 1];
    const newestTx = signatures[0];
    const oldestTimestamp = oldestTx.blockTime ? oldestTx.blockTime * 1000 : Date.now();
    const walletAgeHours = (Date.now() - oldestTimestamp) / (3600 * 1000);
    const walletFresh = walletAgeHours < 24 && signatures.length < 5;

    // Approximate token creations by looking for mints in the signatures
    let totalTokensCreated = 0;
    // For Solana, a new mint creation typically has a signature associated with it,
    // but without full parsed logs we estimate based on transaction count density.
    if (signatures.length > 50) {
      totalTokensCreated = 1;
    }

    // Scoring heuristic calculations
    const launchSuccessScore = walletFresh ? 50 : 25;
    const lpManagementScore = 30; // neutral default
    const dumpingScore = 30; // neutral default
    const walletClusteringScore = walletFresh ? 60 : 30;

    const rawScore = (
      launchSuccessScore * 0.30 +
      lpManagementScore * 0.25 +
      dumpingScore * 0.25 +
      walletClusteringScore * 0.20
    );

    const score = Math.round(rawScore);
    const reputation = this.classifyScore(score, walletFresh);

    return {
      reputation,
      score,
      totalTokensCreated,
      successRate: 1.0,
      activeTokensCount: totalTokensCreated,
      walletAgeHours: Math.round(walletAgeHours),
      walletFresh,
      details: {
        launchSuccessScore,
        lpManagementScore,
        dumpingScore,
        walletClusteringScore
      }
    };
  }

  private static async profileEVM(
    address: string,
    network: string
  ): Promise<DeployerProfile> {
    const apiInfo = EXPLORER_API_MAP[network] || EXPLORER_API_MAP['1'];
    const apiKey = process.env[apiInfo.keyEnvVar] || '';

    const res = await axios.get(apiInfo.url, {
      params: {
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: 100,
        sort: 'asc',
        apikey: apiKey
      },
      timeout: 1500
    });

    const txs = Array.isArray(res.data?.result) ? res.data.result : [];

    if (txs.length === 0) {
      return {
        reputation: 'neutral',
        score: 35,
        totalTokensCreated: 0,
        successRate: 1.0,
        activeTokensCount: 0,
        walletAgeHours: 0,
        walletFresh: true,
        details: {
          launchSuccessScore: 30,
          lpManagementScore: 30,
          dumpingScore: 30,
          walletClusteringScore: 45
        }
      };
    }

    const firstTx = txs[0];
    const walletAgeHours = (Date.now() - (Number(firstTx.timeStamp) * 1000)) / (3600 * 1000);
    const walletFresh = walletAgeHours < 24 && txs.length < 5;

    // Filter transactions where to is empty (contract creations)
    const contractCreations = txs.filter((tx: any) => !tx.to || tx.to === '' || tx.contractAddress);
    const totalTokensCreated = contractCreations.length;

    // Simple success rate: if they deploy and abandon quickly
    let failedDeployments = 0;
    for (const creation of contractCreations) {
      const contractAge = (Date.now() - (Number(creation.timeStamp) * 1000)) / (3600 * 1000);
      if (contractAge > 72 && txs.length < 5) {
        failedDeployments++; // abandoned contract
      }
    }
    const successRate = totalTokensCreated > 0 ? (totalTokensCreated - failedDeployments) / totalTokensCreated : 1.0;

    // Heuristics mapping
    const launchSuccessScore = walletFresh ? 50 : (1.0 - successRate) * 100;
    const lpManagementScore = totalTokensCreated > 3 ? 60 : 30; // repeat deployer without locks gets higher risk
    const dumpingScore = 30; // default neutral
    const walletClusteringScore = walletFresh ? 60 : 30;

    const rawScore = (
      launchSuccessScore * 0.30 +
      lpManagementScore * 0.25 +
      dumpingScore * 0.25 +
      walletClusteringScore * 0.20
    );

    const score = Math.round(rawScore);
    const reputation = this.classifyScore(score, walletFresh);

    return {
      reputation,
      score,
      totalTokensCreated,
      successRate,
      activeTokensCount: totalTokensCreated - failedDeployments,
      walletAgeHours: Math.round(walletAgeHours),
      walletFresh,
      details: {
        launchSuccessScore: Math.round(launchSuccessScore),
        lpManagementScore: Math.round(lpManagementScore),
        dumpingScore: Math.round(dumpingScore),
        walletClusteringScore: Math.round(walletClusteringScore)
      }
    };
  }

  private static classifyScore(
    score: number,
    walletFresh: boolean
  ): 'trusted' | 'neutral' | 'caution' | 'dangerous' | 'known_rugger' {
    if (score > 85) return 'known_rugger';
    if (score > 60) return 'dangerous';
    if (score > 40 || walletFresh) return 'caution';
    if (score > 20) return 'neutral';
    return 'trusted';
  }
}

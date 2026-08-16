import { WalletQualityProfile } from '../adapter-types';
import fs from 'fs';
import path from 'path';

export interface HeliusWalletAccumulator {
  items: any[];
  wasCapped: boolean;
}

export interface AdaptHeliusWalletHistoryOpts {
  chain: string;
  walletAddress: string;
  fetchedAt: number;
}

function getCexAddresses(): Record<string, string[]> {
  try {
    const cexAddressesPath = path.join(process.cwd(), 'data', 'cex-addresses.json');
    if (fs.existsSync(cexAddressesPath)) {
      const fileContent = fs.readFileSync(cexAddressesPath, 'utf8');
      const data = JSON.parse(fileContent);
      const res: Record<string, string[]> = {};
      for (const [ch, list] of Object.entries(data)) {
        if (Array.isArray(list)) {
          res[ch] = list.map((item: any) => String(item.address)); // Solana is case-sensitive base58
        }
      }
      return res;
    }
  } catch (err) {
    console.error('[classifySolanaFundingSource] Failed to load cex-addresses.json:', err);
  }
  return {};
}

function classifySolanaFundingSource(address: string, chain: string): 'cex' | 'bridge' | 'wallet' | 'contract' | 'unknown' {
  // 1. Check CEX
  const cexList = getCexAddresses();
  const chainCex = cexList[chain] || cexList['solana'] || [];
  if (chainCex.includes(address)) {
    return 'cex';
  }

  // 2. Check known system programs
  const knownContracts = new Set([
    '11111111111111111111111111111111', // System Program
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
    '675k1q2c2T6m779aoxxX48BudGXWv97Qr4BDG87paL18', // Raydium V4
    'CAMMC7Jbi2gTYccZ4t1gnhsihjh29yb2y2wqShH6A1E3', // Raydium CLMM
    'JUP6LkbZbjS1jKKbbRB67cjSsCc49GVvpjC285137LM', // Jupiter v6
    'whirSpFb6fc49YrevjZgx7Ko6sD4iPr2Sm8DTrG7dVY', // Orca
    '24Uqj9J6jxYiGLNsgeW9msiw1xN24sa58CcG9w8AK3mG', // Meteora
    'LBRaCz9coTvCR6yURJfKTY2yJE461Pk6ziw21XRs59r', // Meteora DLMM
  ]);

  if (knownContracts.has(address)) {
    return 'contract';
  }

  return 'wallet';
}

export function adaptHeliusWalletHistory(
  acc: HeliusWalletAccumulator,
  opts: AdaptHeliusWalletHistoryOpts
): WalletQualityProfile | null {
  if (!acc || !Array.isArray(acc.items) || acc.items.length === 0) return null;

  const timestamps: number[] = [];
  const activeDays = new Set<string>();

  for (const item of acc.items) {
    if (!item.timestamp) continue;
    const sec = Number(item.timestamp);
    if (!Number.isFinite(sec) || sec <= 0) continue;
    timestamps.push(sec);
    activeDays.add(new Date(sec * 1000).toISOString().slice(0, 10));
  }

  if (timestamps.length === 0) return null;

  const minTs = Math.min(...timestamps);
  const firstSeenAt = new Date(minTs * 1000).toISOString();
  const ageSeconds = Math.max(0, opts.fetchedAt - minTs);
  const walletAgeDays = Math.floor(ageSeconds / 86400);

  // Trace funding source
  const targetWallet = opts.walletAddress;
  let resolvedFundingAddress: string | null = null;
  let resolvedFundingTxHash: string | null = null;

  for (let i = acc.items.length - 1; i >= 0; i--) {
    const tx = acc.items[i];
    let funderAddress: string | null = null;

    // A. Native transfers
    if (Array.isArray(tx.nativeTransfers)) {
      for (const nt of tx.nativeTransfers) {
        if (nt.toUserAccount === targetWallet && nt.fromUserAccount !== targetWallet && nt.amount > 0) {
          funderAddress = nt.fromUserAccount;
          break;
        }
      }
    }

    if (funderAddress) {
      resolvedFundingAddress = funderAddress;
      resolvedFundingTxHash = tx.signature || tx.transactionID || null;
      break;
    }

    // B. Token transfers
    if (Array.isArray(tx.tokenTransfers)) {
      for (const tt of tx.tokenTransfers) {
        const amt = tt.tokenAmount ? Number(tt.tokenAmount) : 0;
        if (tt.toUserAccount === targetWallet && tt.fromUserAccount !== targetWallet && amt > 0) {
          funderAddress = tt.fromUserAccount;
          break;
        }
      }
    }

    if (funderAddress) {
      resolvedFundingAddress = funderAddress;
      resolvedFundingTxHash = tx.signature || tx.transactionID || null;
      break;
    }
  }

  const fundingSourceType = resolvedFundingAddress
    ? classifySolanaFundingSource(resolvedFundingAddress, opts.chain)
    : null;

  return {
    walletAddress: opts.walletAddress,
    chain:         opts.chain,
    firstSeenAt,
    walletAgeDays,
    transactionCount: acc.items.length,
    activeDaysCount:  activeDays.size,
    lastUpdated:      opts.fetchedAt,
    coverage:         acc.wasCapped ? 'capped' : 'complete',
    provenance:       'helius',
    fundingSource:     resolvedFundingAddress,
    fundingSourceType,
    fundingTxHash:     resolvedFundingTxHash,
  };
}

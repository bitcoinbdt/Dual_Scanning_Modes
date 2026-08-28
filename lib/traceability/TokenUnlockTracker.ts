import { supabase } from '../supabase';
import { Connection, PublicKey } from '@solana/web3.js';

export interface UnlockSchedule {
  totalLockedPercentage: number;
  nextUnlockAt: string | null;
  nextUnlockPercentage: number;
  nextUnlockUsdValue: number | null;
  badge: 'Vesting Active' | '⚠️ Emerging Unlock' | '🚨 CRITICAL UNLOCK RISK' | 'No Active Lock';
  vestingDetails: any;
  airdropPercentage: number;
}

const STREAMFLOW_PROGRAM_ID = 'strmqZ7p4zPQzRqpgNMbW2s1zCdHPF1cMkBCAwJWyEr';

export class TokenUnlockTracker {
  /**
   * Resolve token unlock and vesting schedules
   */
  static async getUnlockSchedule(
    tokenAddress: string,
    network: string,
    transactions: any[],
    totalSupply: number,
    solanaConnection?: Connection
  ): Promise<UnlockSchedule> {
    const isSolana = network.toLowerCase() === 'solana';

    // 1. Calculate in-memory airdrop/ICO distribution
    const airdropPercentage = this.calculateAirdropDistribution(transactions, totalSupply);

    // 2. Query Supabase cache table
    try {
      const { data: cached } = await supabase
        .from('token_unlock_schedules')
        .select('*')
        .eq('token_address', tokenAddress)
        .eq('chain', network)
        .maybeSingle();

      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      if (cached && (Date.now() - new Date(cached.last_updated_at).getTime()) < ONE_DAY_MS) {
        console.log(`[UNLOCK TRACKER] Cache hit for ${tokenAddress}`);
        return {
          totalLockedPercentage: Number(cached.total_locked_percentage),
          nextUnlockAt: cached.next_unlock_at,
          nextUnlockPercentage: Number(cached.next_unlock_percentage),
          nextUnlockUsdValue: cached.next_unlock_usd_value ? Number(cached.next_unlock_usd_value) : null,
          badge: this.determineBadge(cached.next_unlock_at, Number(cached.next_unlock_percentage)),
          vestingDetails: cached.vesting_details,
          airdropPercentage,
        };
      }
    } catch (err) {
      console.warn(`[UNLOCK TRACKER] Supabase cache read failed:`, err);
    }

    // 3. Perform on-chain/source retrieval
    let totalLockedPercentage = 0;
    let nextUnlockAt: string | null = null;
    let nextUnlockPercentage = 0;
    let nextUnlockUsdValue: number | null = null;
    let vestingDetails: any = null;

    if (isSolana && solanaConnection) {
      try {
        // Wrap the heavy program-accounts RPC query in a 3-second timeout so
        // the scan degrades gracefully when the public RPC node is slow or
        // rate-limiting this type of expensive filter query.
        const rpcTimeoutMs = 3_000;
        const streamAccountsResult = await Promise.race([
          solanaConnection.getProgramAccounts(
            new PublicKey(STREAMFLOW_PROGRAM_ID),
            {
              filters: [
                { dataSize: 496 }, // Known stream account size
                { memcmp: { offset: 40, bytes: tokenAddress } } // Filter by token mint
              ]
            }
          ),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Streamflow getProgramAccounts timed out after ${rpcTimeoutMs}ms`)),
              rpcTimeoutMs
            )
          ),
        ]).catch((err: Error) => {
          console.warn(`[UNLOCK TRACKER] Streamflow RPC query bypassed: ${err.message}`);
          return [] as Awaited<ReturnType<typeof solanaConnection.getProgramAccounts>>;
        });
        const streamAccounts = streamAccountsResult;

        if (streamAccounts.length > 0) {
          console.log(`[UNLOCK TRACKER] Found ${streamAccounts.length} Streamflow streams`);
          let totalLocked = 0n;
          let nextUnlock = 0n;
          let earliestUnlockTime = Number.MAX_SAFE_INTEGER;

          for (const account of streamAccounts) {
            const data = account.account.data;
            // Streamflow layout parsing (basic estimation from raw buffer structure)
            // Streamflow accounts store metadata, start, end, amounts, etc.
            // Let's extract values or use derived estimations
            try {
              // start_time at offset 8, end_time at offset 16 (estimated)
              const endTime = Number(data.readBigUInt64LE(16));
              const amount = data.readBigUInt64LE(80); // total deposited
              const withdrawn = data.readBigUInt64LE(88); // already withdrawn
              const remaining = amount - withdrawn;

              if (remaining > 0n) {
                totalLocked += remaining;
                if (endTime > 0 && endTime < earliestUnlockTime) {
                  earliestUnlockTime = endTime;
                  // Estimate next unlock percentage (e.g. 5% or 10%)
                  nextUnlock += remaining / 20n; // estimate 5% release
                }
              }
            } catch (err) {
              console.warn(`[UNLOCK TRACKER] Error decoding stream account:`, err);
            }
          }

          if (totalLocked > 0n) {
            totalLockedPercentage = Number(totalLocked * 100n / BigInt(totalSupply * 1e9 || 1));
            nextUnlockPercentage = Number(nextUnlock * 100n / BigInt(totalSupply * 1e9 || 1));
            if (earliestUnlockTime !== Number.MAX_SAFE_INTEGER) {
              nextUnlockAt = new Date(earliestUnlockTime * 1000).toISOString();
            }
            vestingDetails = {
              streamCount: streamAccounts.length,
              totalLockedTokens: totalLocked.toString(),
            };
          }
        }
      } catch (err) {
        console.warn(`[UNLOCK TRACKER] On-chain Streamflow scan failed:`, err);
      }
    }

    // Default/fallback for EVM or when no on-chain locks are detected
    if (totalLockedPercentage === 0) {
      // Mock/neutral lock status if none found (safety fallback)
      totalLockedPercentage = 0;
      nextUnlockAt = null;
      nextUnlockPercentage = 0;
    }

    const badge = this.determineBadge(nextUnlockAt, nextUnlockPercentage);

    // 4. Update Supabase cache
    try {
      await supabase
        .from('token_unlock_schedules')
        .upsert({
          token_address: tokenAddress,
          chain: network,
          total_locked_percentage: totalLockedPercentage,
          next_unlock_at: nextUnlockAt,
          next_unlock_percentage: nextUnlockPercentage,
          next_unlock_usd_value: nextUnlockUsdValue,
          vesting_details: vestingDetails,
          last_updated_at: new Date().toISOString(),
        }, { onConflict: 'token_address,chain' });
    } catch (err) {
      console.warn(`[UNLOCK TRACKER] Supabase cache write failed:`, err);
    }

    return {
      totalLockedPercentage,
      nextUnlockAt,
      nextUnlockPercentage,
      nextUnlockUsdValue,
      badge,
      vestingDetails,
      airdropPercentage,
    };
  }

  private static determineBadge(
    nextUnlockAt: string | null,
    unlockPercentage: number
  ): 'Vesting Active' | '⚠️ Emerging Unlock' | '🚨 CRITICAL UNLOCK RISK' | 'No Active Lock' {
    if (!nextUnlockAt) return 'No Active Lock';

    const now = Date.now();
    const unlockTime = new Date(nextUnlockAt).getTime();
    const msToUnlock = unlockTime - now;

    if (msToUnlock <= 0) return 'No Active Lock';

    const daysToUnlock = msToUnlock / (24 * 60 * 60 * 1000);

    if (unlockPercentage >= 5.0 && daysToUnlock <= 1.0) {
      return '🚨 CRITICAL UNLOCK RISK';
    }

    if (unlockPercentage >= 2.0 && daysToUnlock <= 3.0) {
      return '⚠️ Emerging Unlock';
    }

    return 'Vesting Active';
  }

  private static calculateAirdropDistribution(transactions: any[], totalSupply: number): number {
    if (!transactions || transactions.length === 0 || totalSupply <= 0) return 0;

    // Sort transactions by timestamp ascending
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    const earliestTime = sorted[0].timestamp;

    // Look at transfers in the first 5 minutes (earliestTime + 300 seconds)
    const earlyTxs = sorted.filter(tx => tx.timestamp <= earliestTime + 300);

    // Group early txs by sender ('from' address)
    const senders: Record<string, Set<string>> = {};
    const senderAmount: Record<string, number> = {};

    for (const tx of earlyTxs) {
      const from = tx.from?.toLowerCase();
      const to = tx.to?.toLowerCase();
      if (from && to && from !== to) {
        if (!senders[from]) {
          senders[from] = new Set();
          senderAmount[from] = 0;
        }
        senders[from].add(to);
        senderAmount[from] += Number(tx.amount) || 0;
      }
    }

    let maxAirdroppedAmount = 0;
    for (const [sender, recipients] of Object.entries(senders)) {
      if (recipients.size >= 10) { // check if sender transferred to multiple wallets
        const amt = senderAmount[sender];
        if (amt > maxAirdroppedAmount) {
          maxAirdroppedAmount = amt;
        }
      }
    }

    const percentage = (maxAirdroppedAmount / totalSupply) * 100;
    return Math.min(percentage, 100);
  }
}

import { UniversalTransaction } from '../collectors/types';

/**
 * Utility function to aggregate multi-hop/aggregator swaps into a single net trade.
 * Group transactions by transaction hash, calculate user's net token changes, 
 * and replace the multiple swaps with a single logical buy/sell transaction.
 */
export function aggregateTrades(transactions: UniversalTransaction[]): UniversalTransaction[] {
  const groups = new Map<string, UniversalTransaction[]>();

  // Group by transaction hash
  for (const tx of transactions) {
    if (!tx.isTrade) continue; // Only aggregate DEX trades
    
    const hash = tx.hash;
    if (!groups.has(hash)) {
      groups.set(hash, []);
    }
    groups.get(hash)!.push(tx);
  }

  const result: UniversalTransaction[] = [];
  const processedHashes = new Set<string>();

  for (const tx of transactions) {
    if (!tx.isTrade) {
      result.push(tx); // Plain transfers are not aggregated
      continue;
    }

    const hash = tx.hash;
    if (processedHashes.has(hash)) continue;
    processedHashes.add(hash);

    const group = groups.get(hash)!;
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Aggregate multi-hop transaction
    const firstTx = group[0];
    
    // Find the end-user's wallet involved in the swaps
    const wallet = firstTx.wallet || (firstTx.from !== 'pool' ? firstTx.from : firstTx.to);

    let netTokenAmount = 0;
    let totalUsdValue = 0;

    for (const hop of group) {
      const isOutflow = hop.from === wallet;
      const isInflow = hop.to === wallet;

      if (isInflow) {
        netTokenAmount += hop.amount;
      }
      if (isOutflow) {
        netTokenAmount -= hop.amount;
      }

      totalUsdValue += hop.amount * (hop.priceUsd || 0);
    }

    // Skip groups with negligible net token balance change (e.g. dust or exact wrap/unwrap)
    if (Math.abs(netTokenAmount) < 1e-9) {
      continue;
    }

    const action = netTokenAmount > 0 ? 'buy' : 'sell';
    const effectivePriceUsd = totalUsdValue / Math.abs(netTokenAmount);

    result.push({
      hash: firstTx.hash,
      timestamp: Math.min(...group.map(t => t.timestamp)),
      from: action === 'sell' ? wallet : 'pool',
      to: action === 'buy' ? wallet : 'pool',
      amount: Math.abs(netTokenAmount),
      type: action,
      priceUsd: effectivePriceUsd,
      wallet,
      token: firstTx.token,
      blockchain: firstTx.blockchain,
      raw: firstTx.raw,
      isTrade: true,
      aggregated: true // Mark as aggregated trade
    } as UniversalTransaction);
  }

  return result;
}

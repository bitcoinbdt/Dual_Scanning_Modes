import { CollectorResult } from '../collectors/types';

/**
 * Calculates holder spike metrics and updates the CollectorResult in place.
 */
export function detectHolderSpike(result: CollectorResult): void {
  const transactions = result.transactions || [];
  
  if (transactions.length === 0) {
    result.holder_spike = false;
    result.spike_percentage = 0;
    result.new_holders_24h = 0;
    result.total_holders_before_24h = 0;
    return;
  }
  
  // Find the latest transaction timestamp as the anchor for the scan
  const latestTxSec = Math.max(...transactions.map(t => t.timestamp));
  const windowStart = latestTxSec - 86400; // 24 hours window
  
  const recipientsBeforeWindow = new Set<string>();
  const recipientsInWindow = new Set<string>();
  
  // Categorize recipients based on transaction timing
  for (const tx of transactions) {
    if (!tx.to) continue;
    const toAddress = tx.to.toLowerCase();
    
    if (tx.timestamp < windowStart) {
      recipientsBeforeWindow.add(toAddress);
    } else {
      recipientsInWindow.add(toAddress);
    }
  }
  
  // A new holder is someone who received tokens for the first time in the 24h window
  // (meaning they do not appear in the recipient history prior to the window start)
  const newHolders = new Set<string>();
  for (const address of recipientsInWindow) {
    if (!recipientsBeforeWindow.has(address)) {
      newHolders.add(address);
    }
  }
  
  const new_holders_24h = newHolders.size;
  // Approximation of unique holders before the 24h window
  const total_holders_before_24h = recipientsBeforeWindow.size;
  
  let holder_spike = false;
  let spike_percentage = 0;
  
  if (total_holders_before_24h > 0) {
    const increaseRatio = new_holders_24h / total_holders_before_24h;
    if (new_holders_24h >= 10 && increaseRatio > 0.5) {
      holder_spike = true;
      spike_percentage = Math.round(increaseRatio * 100 * 100) / 100; // Round to 2 decimal places
    }
  } else if (new_holders_24h >= 10) {
    // If there were no prior holders and we got >=10 new ones, it's a spike (100% growth)
    holder_spike = true;
    spike_percentage = 100;
  }
  
  // Update result properties in-place
  result.holder_spike = holder_spike;
  result.spike_percentage = spike_percentage;
  result.new_holders_24h = new_holders_24h;
  result.total_holders_before_24h = total_holders_before_24h;
  
  console.log(`[Spike Detection] Complete:
    - 24h Window Start: ${new Date(windowStart * 1000).toISOString()}
    - New Holders (24h): ${new_holders_24h}
    - Total Holders Before: ${total_holders_before_24h}
    - Spike Detected: ${holder_spike} (${spike_percentage}%)
  `);
}

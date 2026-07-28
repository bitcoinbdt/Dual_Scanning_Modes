/**
 * Collector Configuration - Maps credit spending to transaction limits
 */

export interface CollectorConfig {
  maxTransactions: number;
  tier: 'quick_peek' | 'standard' | 'professional' | 'institutional';
}

/**
 * Get collector configuration based on credits spent
 * @param creditsSpent - Number of credits user wants to spend (5-100)
 * @returns Configuration with transaction limit and tier name
 */
export function getCollectorConfig(creditsSpent: number): CollectorConfig {
  if (creditsSpent <= 10) {
    return {
      maxTransactions: 50,
      tier: 'quick_peek'
    };
  } else if (creditsSpent <= 25) {
    return {
      maxTransactions: 200,
      tier: 'standard'
    };
  } else if (creditsSpent <= 50) {
    return {
      maxTransactions: 1000,
      tier: 'professional'
    };
  } else {
    // 100 credits
    return {
      maxTransactions: 5000,
      tier: 'institutional'
    };
  }
}

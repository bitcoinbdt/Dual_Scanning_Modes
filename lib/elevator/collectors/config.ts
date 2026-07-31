/**
 * Collector Configuration - Maps credit spending to transaction limits
 */

export interface CollectorConfig {
  maxTransactions: number;
  tier: 'quick_peek' | 'standard' | 'professional' | 'institutional';
}

export function getCollectorConfig(creditsSpent: number): CollectorConfig {
  if (creditsSpent <= 5) {
    return {
      maxTransactions: 50,
      tier: 'quick_peek'
    };
  } else if (creditsSpent <= 10) {
    return {
      maxTransactions: 100,
      tier: 'standard'
    };
  } else if (creditsSpent <= 20) {
    return {
      maxTransactions: 200,
      tier: 'professional'
    };
  } else {
    // 30 credits or more
    return {
      maxTransactions: 500,
      tier: 'institutional'
    };
  }
}

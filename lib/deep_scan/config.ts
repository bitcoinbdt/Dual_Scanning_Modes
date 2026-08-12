/**
 * Deep Scan — Configuration Center
 *
 * Centralizes all hardcoded policy constants, thresholds, risk weights,
 * and cache timings used across the Deep Scan analytics engines.
 *
 * Tuning these values will adjust the sensitivity, scoring, and performance
 * of the Web3 token behavioral intelligence suite without modifying engine code.
 */

export const DEEP_SCAN_CONFIG = {
  // ── Session Cache Policy ──
  cache: {
    /** TTL in milliseconds for caching Deep Scan results (60 seconds) */
    ttlMs: 60_000,
  },

  // ── Freshness Policy (Seconds) ──
  freshnessThresholds: {
    /** How recent the token metadata / price snapshot must be (5 minutes) */
    marketData: 300,
    /** How recent the OHLCV candlestick data must be (2 hours) */
    ohlcv: 7200,
    /** How recent the transaction batch window must be (1 hour) */
    transactions: 3600,
  },

  // ── AMM Slippage Simulation Policy ──
  amm: {
    /** Canonical V2 constant-product default fee (0.3%) applied when pool fee is unknown */
    defaultSwapFee: 0.003,
    /** Default trade position sizes (USD) to simulate */
    defaultPositionSizesUsd: [1_000, 5_000, 10_000, 25_000, 50_000, 100_000],
    /** Price impact risk limits (%) */
    priceImpactRisk: {
      low: 1,
      medium: 5,
      high: 15,
    },
  },

  // ── Volume HHI Concentration Policy ──
  volumeHhi: {
    /** HHI ranges for concentration categorization */
    thresholds: {
      low: 0.10,
      moderate: 0.18,
      high: 0.35,
    },
    /** Organic score penalty weights */
    organicWeights: {
      buyerHhi: 40,
      washRatio: 30,
      sellerHhi: 30,
    },
    /** Volume-Price divergence thresholds */
    divergence: {
      buyerHhiLimit: 0.5,
      buySellRatioLimit: 2.0,
    },
  },

  // ── Whale Behavior Policy ──
  whaleBehavior: {
    /** Whale qualification threshold (% of total supply) */
    supplyThresholdPct: 1.0,
    /** Whale qualification threshold (% of total executable liquidity) */
    liquidityThresholdPct: 5.0,
    /** Accumulation / distribution net flow ratio threshold */
    flowRatioThreshold: 1.2,
    /** Supply share limit for distribution risk classification (%) */
    distributionRiskShareThreshold: 15,
  },

  // ── Whale Exit Simulation Policy ──
  whaleExit: {
    /** Fraction percentages to simulate for whale liquidations */
    liquidationFractions: [
      { fraction: 0.10, label: '10%' as const },
      { fraction: 0.25, label: '25%' as const },
      { fraction: 0.50, label: '50%' as const },
    ],
    /** Price delta severity classification limits (%) */
    severityLimits: {
      low: 5,
      medium: 15,
      high: 30,
    },
  },

  // ── Buyer Quality Policy ──
  buyerQuality: {
    /** Starting base buyer quality score (out of 100) */
    baseScore: 60,
    /** Returning buyer ratio thresholds and their score changes */
    returningBuyer: {
      highLimit: 0.6,
      highBonus: 10,
      modLimit: 0.3,
      modBonus: 5,
    },
    /** Capital uniformity index threshold and bonus */
    capitalDiversity: {
      uniformLimit: 0.5,
      uniformBonus: 10,
    },
    /** Minimum buyer counts and score penalties */
    sampleCount: {
      sufficientLimit: 20,
      sufficientBonus: 5,
      thinLimit: 5,
      thinPenalty: 15,
      insufficientLimit: 3,
    },
    /** Ratio of single-use buyers and score penalty */
    singleUse: {
      highLimit: 0.8,
      highPenalty: 20,
    },
    /** Coefficient of variation of buy sizes (stddev / mean) and penalty */
    erraticSizes: {
      cvLimit: 3.0,
      cvPenalty: 10,
    },
    /** Confidence levels based on buyer sample sizes */
    confidenceLevels: [
      { minBuyers: 20, confidence: 80 },
      { minBuyers: 10, confidence: 65 },
      { minBuyers: 5,  confidence: 50 },
      { minBuyers: 0,  confidence: 30 },
    ],
    /** Confidence penalty when price data is missing on most trades */
    missingPricePenalty: 10,
    missingPriceThreshold: 0.5,
  },

  // ── Market Regime Policy ──
  marketRegime: {
    /** Minimum candles required to classify a regime */
    minCandles: 8,
    /** Normalised price slope threshold to flag rising/falling trend (% per candle) */
    trendLimit: 0.005,
    /** standard deviation of change per candle to flag high volatility */
    volatilityLimit: 0.05,
    /** Price volatility limit for recovery classification */
    recoveryVolatilityLimit: 0.08,
    /** Cumulative price drawdown limit for recovery/dead regimes (%) */
    drawdownLimit: -20,
    deadDrawdownLimit: -50,
    deadVolumeZScoreLimit: -1.0,
    liquidityExitVolumeZScoreLimit: 0,
    /** Confidence baseline based on history size */
    confidenceLevels: [
      { minCandles: 48, confidence: 85 },
      { minCandles: 24, confidence: 75 },
      { minCandles: 0,  confidence: 55 },
    ],
    /** Pearson correlation multiplier bonus when price-vol correlation is strong */
    correlationBonus: 10,
    correlationLimit: 0.6,
  },

  // ── Capital Efficiency Policy ──
  capitalEfficiency: {
    /** MC to liquidity ratio limits for sensitivity classification */
    lowThreshold: 10,
    highThreshold: 50,
  },

  // ── Risk Scoring Policy ──
  riskScoring: {
    /** Module sub-score weights (must sum to 1.0) */
    weights: {
      ammSlippage: 0.20,
      whaleExit: 0.25,
      volumeConcentration: 0.20,
      whaleBehavior: 0.15,
      capitalEfficiency: 0.10,
      buyerQuality: 0.10,
    },
    /** Points deducted from the overall risk score for positive traits */
    mitigationPoints: {
      broadBuyerBase: 5,
      organicVolume: 5,
    },
    /** Score boundaries for risk classification */
    scoreLimits: {
      low: 30,
      medium: 50, // standard threshold before 50 is medium, 50-75 is high
      high: 75,
    },
    /** Maximum number of top prioritized risks to return in results */
    topRisksMax: 5,
  },
};

/**
 * Validates Deep Scan configuration to catch duplicates, impossible values,
 * or invalid ranges early on module load.
 */
export function validateDeepScanConfig(cfg: typeof DEEP_SCAN_CONFIG): void {
  // Check duplicate thresholds
  const bqMinBuyers = cfg.buyerQuality.confidenceLevels.map(c => c.minBuyers);
  if (new Set(bqMinBuyers).size !== bqMinBuyers.length) {
    throw new Error('Invalid config: duplicate minBuyers in buyerQuality.confidenceLevels');
  }

  const mrMinCandles = cfg.marketRegime.confidenceLevels.map(c => c.minCandles);
  if (new Set(mrMinCandles).size !== mrMinCandles.length) {
    throw new Error('Invalid config: duplicate minCandles in marketRegime.confidenceLevels');
  }

  // Check impossible values / invalid confidence range
  for (const level of cfg.buyerQuality.confidenceLevels) {
    if (level.confidence < 0 || level.confidence > 100) {
      throw new Error(`Invalid config: confidence ${level.confidence} out of range [0, 100] in buyerQuality`);
    }
    if (level.minBuyers < 0) {
      throw new Error(`Invalid config: negative minBuyers ${level.minBuyers} in buyerQuality`);
    }
  }

  for (const level of cfg.marketRegime.confidenceLevels) {
    if (level.confidence < 0 || level.confidence > 100) {
      throw new Error(`Invalid config: confidence ${level.confidence} out of range [0, 100] in marketRegime`);
    }
    if (level.minCandles < 0) {
      throw new Error(`Invalid config: negative minCandles ${level.minCandles} in marketRegime`);
    }
  }

  // Check riskScoring weights sum to 1.0 (approximately)
  const weights = cfg.riskScoring.weights;
  const weightSum = weights.ammSlippage + weights.whaleExit + weights.volumeConcentration + weights.whaleBehavior + weights.capitalEfficiency + weights.buyerQuality;
  if (Math.abs(weightSum - 1.0) > 0.001) {
    throw new Error(`Invalid config: riskScoring weights must sum to 1.0, got ${weightSum}`);
  }

  // Check required base levels (min=0)
  if (!bqMinBuyers.includes(0)) {
    throw new Error('Invalid config: missing base level (minBuyers: 0) in buyerQuality.confidenceLevels');
  }
  if (!mrMinCandles.includes(0)) {
    throw new Error('Invalid config: missing base level (minCandles: 0) in marketRegime.confidenceLevels');
  }
}

// Automatically validate config on load
validateDeepScanConfig(DEEP_SCAN_CONFIG);


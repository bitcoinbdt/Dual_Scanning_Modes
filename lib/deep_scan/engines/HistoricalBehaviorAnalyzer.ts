import {
  OHLCVCandle,
  DrawdownInfo,
  PumpDumpAnalysis,
  SlowRugAnalysis,
  DistributionVelocityResult,
  HistoricalBehaviorResult
} from '../types';

/** Minimum candles required to perform analysis. */
const MIN_CANDLES = 7;

/**
 * Compute peak-to-trough max drawdown across historical price series.
 * Track depth (%), duration (candles), and recovery time (candles).
 */
export function calculateMaxDrawdown(ohlcv: OHLCVCandle[]): DrawdownInfo | null {
  if (!ohlcv || ohlcv.length === 0) return null;

  let peak = -Infinity;
  let peakIndex = -1;
  
  let maxDepth = 0;
  let maxDuration = 0;
  let maxRecovery: number | null = null;
  
  for (let i = 0; i < ohlcv.length; i++) {
    const price = ohlcv[i].close;
    if (price > peak) {
      peak = price;
      peakIndex = i;
    } else if (peak > 0) {
      const depth = (peak - price) / peak;
      if (depth > maxDepth) {
        maxDepth = depth;
        maxDuration = i - peakIndex;
        
        // Find recovery time: how many candles after peakIndex until price >= peak again?
        let recovery: number | null = null;
        for (let j = i + 1; j < ohlcv.length; j++) {
          if (ohlcv[j].close >= peak) {
            recovery = j - peakIndex;
            break;
          }
        }
        maxRecovery = recovery;
      }
    }
  }

  return {
    depthPercent: maxDepth * 100,
    durationCandles: maxDuration,
    recoveryCandles: maxRecovery,
  };
}

/**
 * Detect pump-and-dump: rapid price appreciation → collapse with volume spike.
 */
export function detectPumpAndDump(ohlcv: OHLCVCandle[]): PumpDumpAnalysis | null {
  if (!ohlcv || ohlcv.length < MIN_CANDLES) return null;

  // Find the highest close price and its index
  let peakPrice = -Infinity;
  let peakIndex = -1;
  for (let i = 0; i < ohlcv.length; i++) {
    if (ohlcv[i].close > peakPrice) {
      peakPrice = ohlcv[i].close;
      peakIndex = i;
    }
  }

  // Pre-peak: find the lowest price in the preceding 10 candles
  const pumpStart = Math.max(0, peakIndex - 10);
  let minPrePrice = Infinity;
  let minPreIndex = -1;
  for (let i = pumpStart; i < peakIndex; i++) {
    if (ohlcv[i].close < minPrePrice) {
      minPrePrice = ohlcv[i].close;
      minPreIndex = i;
    }
  }

  if (peakIndex === 0 || minPreIndex === -1) {
    return { detected: false, confidence: 0 };
  }

  const priceAppreciation = (peakPrice - minPrePrice) / minPrePrice;

  // Post-peak: find the lowest price in the 10 candles after peak
  const dumpEnd = Math.min(ohlcv.length - 1, peakIndex + 10);
  let minPostPrice = Infinity;
  let minPostIndex = -1;
  for (let i = peakIndex + 1; i <= dumpEnd; i++) {
    if (ohlcv[i].close < minPostPrice) {
      minPostPrice = ohlcv[i].close;
      minPostIndex = i;
    }
  }

  if (minPostIndex === -1) {
    return { detected: false, confidence: 0 };
  }

  const priceCollapse = (peakPrice - minPostPrice) / peakPrice;

  // Volume spike check
  const peakVolume = ohlcv[peakIndex].volume;
  const prePeakVolumes = ohlcv.slice(0, Math.max(1, peakIndex)).map(c => c.volume);
  const avgPrePeakVolume = prePeakVolumes.reduce((a, b) => a + b, 0) / prePeakVolumes.length;
  const volumeMultiplier = avgPrePeakVolume > 0 ? peakVolume / avgPrePeakVolume : 1;

  // Pump-and-dump signature:
  // - Appreciation >= 50%
  // - Collapse >= 60%
  // - Volume >= 1.5x increase
  if (priceAppreciation >= 0.5 && priceCollapse >= 0.6 && volumeMultiplier >= 1.5) {
    const confidence = Math.min(1.0, 0.5 + (priceAppreciation - 0.5) * 0.2 + (priceCollapse - 0.6) * 0.3);
    return {
      detected: true,
      confidence,
      details: `Pump: +${(priceAppreciation * 100).toFixed(0)}%, Dump: -${(priceCollapse * 100).toFixed(0)}%, Volume spike: ${volumeMultiplier.toFixed(1)}x`,
    };
  }

  return { detected: false, confidence: 0 };
}

/**
 * Detect slow rug: gradual volume decline alongside steady price decline.
 */
export function detectSlowRug(ohlcv: OHLCVCandle[]): SlowRugAnalysis | null {
  if (!ohlcv || ohlcv.length < 15) return null;

  // Check trend over the latter 70% of candles
  const startIndex = Math.floor(ohlcv.length * 0.3);
  const subset = ohlcv.slice(startIndex);
  const n = subset.length;

  let priceDecreases = 0;
  let volumeDecreases = 0;

  for (let i = 1; i < n; i++) {
    if (subset[i].close < subset[i - 1].close) priceDecreases++;
    if (subset[i].volume < subset[i - 1].volume) volumeDecreases++;
  }

  const priceDeclineRatio = priceDecreases / (n - 1);
  const volumeDeclineRatio = volumeDecreases / (n - 1);

  // Overall price & volume change
  const firstPrice = subset[0].close;
  const lastPrice = subset[n - 1].close;
  const priceChange = firstPrice > 0 ? (lastPrice - firstPrice) / firstPrice : 0;

  const firstVol = subset[0].volume;
  const lastVol = subset[n - 1].volume;
  const volChange = firstVol > 0 ? (lastVol - firstVol) / firstVol : 0;

  // Slow rug criteria:
  // - Consistent price decline (priceDeclineRatio >= 0.55 and overall decline >= 30%)
  // - Consistent volume decline (volumeDeclineRatio >= 0.55 and overall volume decline >= 40%)
  if (priceDeclineRatio >= 0.55 && priceChange <= -0.3 && volumeDeclineRatio >= 0.55 && volChange <= -0.4) {
    const confidence = Math.min(1.0, 0.4 + (0.5 - priceChange) * 0.4 + (0.5 - volChange) * 0.2);
    return {
      detected: true,
      confidence,
      details: `Price: ${(priceChange * 100).toFixed(0)}%, Volume: ${(volChange * 100).toFixed(0)}%`,
    };
  }

  return { detected: false, confidence: 0 };
}

/**
 * Calculate rate of wallet count growth vs. decline (distribution velocity) over transaction subsets.
 */
export function calculateDistributionVelocity(transactions: any[]): DistributionVelocityResult | null {
  if (!transactions || transactions.length < 10) return null;

  // Sort chronologically (oldest first)
  const sorted = [...transactions].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));

  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const walletsT0 = new Set<string>();
  for (const tx of firstHalf) {
    if (tx.from) walletsT0.add(tx.from.toLowerCase());
    if (tx.to) walletsT0.add(tx.to.toLowerCase());
    if (Array.isArray(tx.wallets)) {
      tx.wallets.forEach((w: string) => walletsT0.add(w.toLowerCase()));
    }
  }

  const walletsT1 = new Set<string>();
  for (const tx of secondHalf) {
    if (tx.from) walletsT1.add(tx.from.toLowerCase());
    if (tx.to) walletsT1.add(tx.to.toLowerCase());
    if (Array.isArray(tx.wallets)) {
      tx.wallets.forEach((w: string) => walletsT1.add(w.toLowerCase()));
    }
  }

  const countT0 = walletsT0.size;
  const countT1 = walletsT1.size;

  const velocity = countT0 > 0 ? (countT1 - countT0) / countT0 : 0;

  return { velocity, countT0, countT1 };
}

/**
 * Primary coordinator for historical behavior analysis.
 */
export function analyzeHistoricalBehavior(
  ohlcv: OHLCVCandle[],
  transactions: any[]
): HistoricalBehaviorResult {
  if (!ohlcv || ohlcv.length < MIN_CANDLES) {
    return {
      status: 'insufficient_data',
      reason: `Insufficient candle history (found ${ohlcv ? ohlcv.length : 0}, requires minimum ${MIN_CANDLES}).`,
      maxDrawdown: null,
      pumpDump: null,
      slowRug: null,
      distributionVelocity: null
    };
  }

  try {
    const maxDrawdown = calculateMaxDrawdown(ohlcv);
    const pumpDump = detectPumpAndDump(ohlcv);
    const slowRug = detectSlowRug(ohlcv);
    const distributionVelocity = calculateDistributionVelocity(transactions);

    return {
      status: 'ok',
      maxDrawdown,
      pumpDump,
      slowRug,
      distributionVelocity
    };
  } catch (err: any) {
    return {
      status: 'unavailable',
      reason: `Analysis failed: ${err.message}`,
      maxDrawdown: null,
      pumpDump: null,
      slowRug: null,
      distributionVelocity: null
    };
  }
}

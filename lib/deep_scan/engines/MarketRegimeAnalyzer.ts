/**
 * Market Regime Analyzer — Module 8
 *
 * Classifies the token's trading phase based on linear price/volume trends,
 * volatility Z-scores, and Pearson correlation coefficients.
 *
 * IMPORTANT: This classifies CURRENT behavior only. It does NOT predict
 * future price direction or provide buy/sell signals.
 */

import { MarketRegimeResult, RegimeLabel, OHLCVStats, ModuleStatus } from '../types';
import { OHLCVCandle } from '../../elevator/collectors/types';
import { DEEP_SCAN_CONFIG } from '../config';

const MIN_CANDLES = DEEP_SCAN_CONFIG.marketRegime.minCandles;
const PREDICTION_DISCLAIMER =
  'This classification describes CURRENT market behavior based on observed price and volume patterns. ' +
  'It does NOT predict future price direction.';

function round(n: number, dp = 6): number {
  return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateSlope(series: number[]): number {
  const n = series.length;
  if (n < 2) return 0;
  
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = series[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  
  const num = n * sumXY - sumX * sumY;
  const den = n * sumXX - sumX * sumX;
  
  if (den === 0) return 0;
  return num / den;
}

function calculateCorrelation(xSeries: number[], ySeries: number[]): number {
  const n = xSeries.length;
  if (n === 0 || n !== ySeries.length) return 0;
  
  const meanX = xSeries.reduce((a, b) => a + b, 0) / n;
  const meanY = ySeries.reduce((a, b) => a + b, 0) / n;
  
  let num = 0;
  let denX = 0;
  let denY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = xSeries[i] - meanX;
    const dy = ySeries[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

/**
 * Classify current market regime using historical OHLCV data.
 *
 * @param ohlcv - Candlestick chart series from Birdeye/Elevator
 */
export function analyzeMarketRegime(ohlcv: OHLCVCandle[]): MarketRegimeResult {
  if (!ohlcv || ohlcv.length < MIN_CANDLES) {
    return {
      status: 'insufficient_data',
      reason: `Insufficient candle history (found ${ohlcv ? ohlcv.length : 0}, requires minimum ${MIN_CANDLES}).`,
      regime: 'INSUFFICIENT_DATA',
      confidence: 0,
      regimeDescription: 'Not enough price history available to determine a market regime.',
      predictionDisclaimer: PREDICTION_DISCLAIMER,
      evidenceIds: [],
    };
  }

  const closes = ohlcv.map((c) => c.close);
  const volumes = ohlcv.map((c) => c.volume);
  const n = ohlcv.length;

  const firstPrice = closes[0];
  const lastPrice = closes[n - 1];
  const totalPriceChangePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

  // Linear regression slope
  const priceSlope = calculateSlope(closes);
  const volumeSlope = calculateSlope(volumes);

  // Volatility of period-to-period returns
  const pctChanges: number[] = [];
  for (let i = 1; i < n; i++) {
    if (closes[i - 1] > 0) {
      pctChanges.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  const priceVolatility = stdDev(pctChanges);

  // Volume Z-score (last candle volume vs historical mean volume)
  const meanVolume = volumes.reduce((a, b) => a + b, 0) / n;
  const stdVolume = stdDev(volumes);
  const lastVolume = ohlcv[n - 1].volume;
  const volumeZScore = stdVolume > 0 ? (lastVolume - meanVolume) / stdVolume : 0;

  // Price-Volume Correlation
  const priceVolumeCorrelation = calculateCorrelation(closes, volumes);

  const stats: OHLCVStats = {
    priceSlopePerCandle: round(priceSlope),
    volumeSlopePerCandle: round(volumeSlope),
    priceVolatility: round(priceVolatility),
    volumeZScore: round(volumeZScore),
    priceVolumeCorrelation: round(priceVolumeCorrelation),
    candleCount: n,
    firstPrice: round(firstPrice),
    lastPrice: round(lastPrice),
    totalPriceChangePct: round(totalPriceChangePct),
    avgVolume: round(meanVolume),
  };

  // ── Classification Logic ──
  const normalizedPriceSlope = firstPrice > 0 ? priceSlope / firstPrice : 0;
  const cfg = DEEP_SCAN_CONFIG.marketRegime;

  const priceUp = normalizedPriceSlope > cfg.trendLimit;
  const priceDown = normalizedPriceSlope < -cfg.trendLimit;
  const volumeUp = volumeSlope > 0;
  const highVolatility = priceVolatility > cfg.volatilityLimit;
  
  let regime: RegimeLabel = 'ACCUMULATION';
  let regimeDescription = 'Price is consolidating on stable or rising volume, suggesting steady accumulation.';

  if (priceDown && totalPriceChangePct < cfg.deadDrawdownLimit && volumeZScore < cfg.deadVolumeZScoreLimit) {
    regime = 'DEAD';
    regimeDescription = 'Token trading activity has halted or collapsed alongside massive price drawdowns.';
  } else if (priceDown && volumeUp) {
    regime = 'LIQUIDITY_EXIT';
    regimeDescription = 'Price is declining on rising volume, indicating aggressive selling and pool distribution.';
  } else if (priceUp && volumeUp && !highVolatility) {
    regime = 'MOMENTUM';
    regimeDescription = 'Price is rising on expanding volume, indicating strong breakout momentum.';
  } else if (priceUp && !volumeUp) {
    regime = 'DISTRIBUTION';
    regimeDescription = 'Price is rising but trade volume is contracting, indicating low-liquidity squeeze or distribution.';
  } else if (priceUp && (priceVolatility > cfg.recoveryVolatilityLimit || totalPriceChangePct < cfg.drawdownLimit)) {
    regime = 'RECOVERY';
    regimeDescription = 'Token is recovering from a steep sell-off, showing heightened price volatility.';
  } else if (priceDown && !volumeUp) {
    regime = 'LIQUIDITY_EXIT';
    regimeDescription = 'Price is sliding on descending volume, showing slow bleed-out of support.';
  }

  // ── Confidence Score ──
  const confLevels = [...cfg.confidenceLevels].sort((a, b) => b.minCandles - a.minCandles);
  let confidence = confLevels[confLevels.length - 1].confidence; // fallback to lowest if nothing matches
  const matchedLevel = confLevels.find(level => n >= level.minCandles);
  if (matchedLevel) {
    confidence = matchedLevel.confidence;
  }
  if (Math.abs(priceVolumeCorrelation) > cfg.correlationLimit) {
    confidence += cfg.correlationBonus;
  }
  confidence = Math.min(100, Math.max(0, confidence));

  return {
    status: 'ok',
    regime,
    confidence,
    stats,
    regimeDescription,
    predictionDisclaimer: PREDICTION_DISCLAIMER,
    evidenceIds: ['ohlcv-regime-analysis'],
  };
}

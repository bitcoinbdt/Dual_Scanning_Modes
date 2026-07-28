/**
 * Metrics Calculator - Calculates risk indicators (RF17, W5) for Solana
 * Ported from data_collector/utils/metrics.js
 */

import { OHLCVCandle, WalletMetrics, CalculatedMetrics } from '../types';

/**
 * Calculate risk metrics from OHLCV and wallet data
 * @param ohlcv - OHLCV candlestick data
 * @param walletMetrics - Wallet metrics summary
 * @returns Calculated metrics (RF17, W5)
 */
export function calculateMetrics(
  ohlcv: OHLCVCandle[],
  walletMetrics: WalletMetrics
): CalculatedMetrics {
  if (ohlcv.length === 0) {
    return {
      RF17: false,
      W5: null
    };
  }
  
  const firstOpen = ohlcv[0].open;
  const lastClose = ohlcv[ohlcv.length - 1].close;
  
  // Calculate price change percentage
  const priceChange = (lastClose - firstOpen) / firstOpen;
  
  // Calculate volume metrics
  const totalVolume = ohlcv.reduce((sum, candle) => sum + candle.volume, 0);
  const avgVolume = totalVolume / ohlcv.length;
  
  // RF17: Wash trading indicator
  // High volume but minimal price movement suggests artificial trading
  const RF17 = (totalVolume > avgVolume) && (Math.abs(priceChange) < 0.02);
  
  // W5: Total holder count
  const W5 = walletMetrics.total_holders;
  
  return { RF17, W5 };
}

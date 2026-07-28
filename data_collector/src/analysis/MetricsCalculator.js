/**
 * MetricsCalculator - V1 MINIMAL
 * Computes W5 (Whale Count) and RF17 (Wash Trading)
 */

import logger from '../utils/Logger.js';

class MetricsCalculator {
  /**
   * Calculate W5 - Whale Count
   * @param {Object} walletBalances - Map of wallet addresses to balances
   * @param {number|null} circulatingSupply - Circulating supply (can be null)
   * @returns {number|null} Number of whales or null if cannot compute
   */
  calculateW5(walletBalances, circulatingSupply) {
    if (circulatingSupply === null || circulatingSupply === undefined) {
      logger.warn('W5: circulating_supply is null - cannot compute whale count');
      return null;
    }

    if (circulatingSupply <= 0) {
      logger.warn('W5: circulating_supply is zero or negative - cannot compute');
      return null;
    }

    const whaleThreshold = circulatingSupply * 0.01; // 1% of supply
    
    const whaleCount = Object.values(walletBalances).filter(balance => 
      balance >= whaleThreshold
    ).length;

    logger.info(`W5: Found ${whaleCount} whales (threshold: ${whaleThreshold})`);
    
    return whaleCount;
  }

  /**
   * Calculate RF17 - Wash Trading (Basic)
   * @param {Array} ohlcvData - OHLCV records (real only, no synthetic)
   * @returns {boolean} True if wash trading detected
   */
  calculateRF17(ohlcvData) {
    if (!ohlcvData || ohlcvData.length === 0) {
      logger.warn('RF17: No OHLCV data - cannot compute');
      return false;
    }

    // Filter out synthetic records
    const realOHLCV = ohlcvData.filter(record => !record.synthetic);

    if (realOHLCV.length === 0) {
      logger.warn('RF17: No real OHLCV data - cannot compute');
      return false;
    }

    // Calculate total volume
    const totalVolume = realOHLCV.reduce((sum, record) => sum + record.volume, 0);
    
    // Calculate median volume
    const volumes = realOHLCV.map(r => r.volume).sort((a, b) => a - b);
    const medianVolume = volumes[Math.floor(volumes.length / 2)];

    // Calculate price change
    const firstOpen = realOHLCV[0].open;
    const lastClose = realOHLCV[realOHLCV.length - 1].close;
    const priceChange = Math.abs((lastClose - firstOpen) / firstOpen);

    // Determine if volume is high
    const volumeHigh = totalVolume > medianVolume * realOHLCV.length;

    // Wash trading detection: high volume + low price movement
    const washTradingDetected = volumeHigh && priceChange < 0.02;

    logger.info(`RF17: volume_high=${volumeHigh}, price_change=${(priceChange * 100).toFixed(2)}%, wash_trading=${washTradingDetected}`);

    return washTradingDetected;
  }

  /**
   * Calculate all V1 metrics
   * @param {Object} data - Processed data
   * @returns {Object} Computed metrics
   */
  calculateAll(data) {
    const { ohlcvData, walletBalances, circulatingSupply } = data;

    const metrics = {
      W5: this.calculateW5(walletBalances, circulatingSupply),
      RF17: this.calculateRF17(ohlcvData)
    };

    logger.info('Metrics calculated:', metrics);

    return metrics;
  }
}

export default MetricsCalculator;

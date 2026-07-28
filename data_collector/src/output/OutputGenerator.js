/**
 * OutputGenerator - V1 MINIMAL
 * Generates JSON output file
 */

import fs from 'fs';
import path from 'path';
import logger from '../utils/Logger.js';

class OutputGenerator {
  constructor() {
    this.outputDir = 'output';
  }

  /**
   * Generate output JSON file
   * @param {Object} tokenData - All collected and processed data
   * @returns {string} Output file path
   */
  generateOutput(tokenData) {
    const {
      token,
      address,
      chain,
      launch_time,
      circulating_supply,
      ohlcvData,
      transactions,
      walletBalances,
      metrics
    } = tokenData;

    // Build output structure
    const output = {
      token,
      address,
      chain: chain || 'solana',
      launch_time,
      circulating_supply,
      ohlcv: ohlcvData,
      transactions,
      wallet_balances: walletBalances,
      metrics,
      metadata: {
        generated_at: Date.now(),
        ohlcv_count: ohlcvData.length,
        transaction_count: transactions.length,
        holder_count: Object.keys(walletBalances).length,
        real_ohlcv_count: ohlcvData.filter(r => !r.synthetic).length,
        synthetic_ohlcv_count: ohlcvData.filter(r => r.synthetic).length
      }
    };

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      logger.info(`Created output directory: ${this.outputDir}`);
    }

    // Generate filename
    const filename = `${token}.json`;
    const filepath = path.join(this.outputDir, filename);

    // Write JSON file
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), 'utf8');

    logger.info(`Output written to: ${filepath}`);

    return filepath;
  }
}

export default OutputGenerator;

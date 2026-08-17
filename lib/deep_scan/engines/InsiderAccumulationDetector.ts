import { OHLCVCandle, UniversalTransaction } from '../../elevator/collectors/types';
import { SeverityLevel } from '../types';

export interface InsiderCluster {
  windowStart: number;          // Unix timestamp
  windowEnd: number;
  wallets: string[];            // Unique wallet addresses
  totalBuyVolumeUsd: number;    // Sum of all buys in window
  avgBuyUsd: number;
  priceAtBuy: number;           // Avg price during window
  priceAtEventPeak: number;     // Peak price at event candle
  impliedPnlPct: number;        // (peakPrice - buyPrice) / buyPrice * 100
}

export interface InsiderAccumulationResult {
  status: 'ok' | 'insufficient_data';
  score: number; // 0 to 100
  clusters: InsiderCluster[];
  signals: Array<{
    signalId: string;
    name: string;
    severity: SeverityLevel;
    description: string;
  }>;
}

export class InsiderAccumulationDetector {
  /**
   * Analyze transaction timeline for insider accumulation before volume spikes
   */
  static analyze(
    ohlcv: OHLCVCandle[],
    transactions: UniversalTransaction[],
    spotPriceUsd: number,
    twentyFourHourVolumeUsd: number
  ): InsiderAccumulationResult {
    // Return early if not enough candles
    if (!ohlcv || ohlcv.length < 12) { // Less than 1 hour of 5m candles
      return {
        status: 'insufficient_data',
        score: 0,
        clusters: [],
        signals: []
      };
    }

    // 1. Identify Candidate Event Candles
    // Calculate mean volume of OHLCV candles
    const totalVolume = ohlcv.reduce((sum, c) => sum + (c.volume || 0), 0);
    const meanVolume = totalVolume / ohlcv.length;

    const eventCandles: OHLCVCandle[] = [];
    for (const candle of ohlcv) {
      const vol = candle.volume || 0;
      const pctChange = candle.open > 0 ? Math.abs(candle.close - candle.open) / candle.open : 0;
      
      if (vol > meanVolume * 3.0 && pctChange > 0.15) {
        eventCandles.push(candle);
      }
    }

    const clusters: InsiderCluster[] = [];
    const walletEventCounts: Record<string, number> = {};

    // Sort transactions by timestamp ascending to track buy history
    const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

    // 2. Scan preceding 300s for each event candle
    for (const event of eventCandles) {
      const eventTimestamp = event.timestamp; // unix seconds
      const preEventTxs = sortedTxs.filter(tx =>
        tx.type === 'buy' &&
        tx.isTrade === true &&
        tx.timestamp >= (eventTimestamp - 300) &&
        tx.timestamp < eventTimestamp &&
        tx.wallet
      );

      // Group buys into 60-second buckets
      const buckets: Record<number, UniversalTransaction[]> = {};
      for (const tx of preEventTxs) {
        // Round to 60-second interval
        const bucketKey = Math.floor(tx.timestamp / 60) * 60;
        if (!buckets[bucketKey]) buckets[bucketKey] = [];
        buckets[bucketKey].push(tx);
      }

      for (const [bucketStartStr, bucketTxs] of Object.entries(buckets)) {
        const bucketStart = Number(bucketStartStr);
        const uniqueWallets = Array.from(new Set(bucketTxs.map(tx => tx.wallet!).filter(Boolean)));

        // Require >= 3 different wallets
        if (uniqueWallets.length >= 3) {
          // Wallet freshness filter: >= 50% must have no prior buys
          let freshCount = 0;
          for (const wallet of uniqueWallets) {
            const hasPriorBuy = sortedTxs.some(tx =>
              tx.wallet?.toLowerCase() === wallet.toLowerCase() &&
              tx.type === 'buy' &&
              tx.timestamp < bucketStart
            );
            if (!hasPriorBuy) freshCount++;
          }

          const freshnessRatio = freshCount / uniqueWallets.length;
          if (freshnessRatio >= 0.50) {
            const totalBuyVolumeUsd = bucketTxs.reduce((sum, tx) => sum + (tx.amount * (tx.priceUsd || spotPriceUsd)), 0);
            const avgBuyUsd = totalBuyVolumeUsd / bucketTxs.length;
            const priceAtBuy = bucketTxs.reduce((sum, tx) => sum + (tx.priceUsd || spotPriceUsd), 0) / bucketTxs.length;
            const priceAtEventPeak = Math.max(event.open, event.close, event.close); // Event peak estimation
            const impliedPnlPct = priceAtBuy > 0 ? ((priceAtEventPeak - priceAtBuy) / priceAtBuy) * 100 : 0;

            // Profitability filter: PnL > 20%
            if (impliedPnlPct > 20) {
              const cluster: InsiderCluster = {
                windowStart: bucketStart,
                windowEnd: bucketStart + 60,
                wallets: uniqueWallets,
                totalBuyVolumeUsd,
                avgBuyUsd,
                priceAtBuy,
                priceAtEventPeak,
                impliedPnlPct
              };
              clusters.push(cluster);

              // Track how many events each wallet participates in
              for (const wallet of uniqueWallets) {
                walletEventCounts[wallet] = (walletEventCounts[wallet] || 0) + 1;
              }
            }
          }
        }
      }
    }

    // 3. Calculate Insider Score
    let score = 0;
    score += clusters.length * 20;

    // +15 if any cluster wallet appears in >= 2 separate events
    const repeatParticipants = Object.values(walletEventCounts).some(count => count >= 2);
    if (repeatParticipants) {
      score += 15;
    }

    // +10 if cluster total buy volume > 3% of 24h volume
    const highVolumeCluster = clusters.some(c => c.totalBuyVolumeUsd > twentyFourHourVolumeUsd * 0.03);
    if (highVolumeCluster) {
      score += 10;
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // 4. Generate Signals
    const signals: InsiderAccumulationResult['signals'] = [];
    if (score > 80) {
      signals.push({
        signalId: 'INS-004',
        name: 'Critical Insider Accumulation Pattern',
        severity: 'critical',
        description: `Highly coordinated pre-event buy clusters detected (${clusters.length} clusters) showing significant volume spikes and profitable timing.`
      });
    } else if (score > 50) {
      signals.push({
        signalId: 'INS-003',
        name: 'High-Probability Insider Accumulation',
        severity: 'high',
        description: `Multiple fresh wallets accumulated before large price swings, with cluster volumes indicating strategic sizing.`
      });
    } else if (score > 20) {
      signals.push({
        signalId: 'INS-002',
        name: 'Emerging Accumulation Cluster',
        severity: 'medium',
        description: 'Coordinated buying patterns detected in a narrow time window prior to volume breakouts.'
      });
    } else if (score > 0) {
      signals.push({
        signalId: 'INS-001',
        name: 'Low-Activity Accumulation Event',
        severity: 'low',
        description: 'Minor cluster of timed purchases detected prior to price action.'
      });
    }

    return {
      status: 'ok',
      score,
      clusters,
      signals
    };
  }
}

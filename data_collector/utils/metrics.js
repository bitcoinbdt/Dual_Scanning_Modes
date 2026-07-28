export function calculateMetrics(ohlcv, walletData) {
  if (ohlcv.length === 0) {
    return {
      RF17: false,
      W5: null
    };
  }
  
  const firstOpen = ohlcv[0].open;
  const lastClose = ohlcv[ohlcv.length - 1].close;
  
  const priceChange = (lastClose - firstOpen) / firstOpen;
  
  const totalVolume = ohlcv.reduce((sum, candle) => sum + candle.volume, 0);
  const avgVolume = totalVolume / ohlcv.length;
  
  const RF17 = (totalVolume > avgVolume) && (Math.abs(priceChange) < 0.02);
  
  const W5 = walletData && walletData.holders ? walletData.holders.length : null;
  
  return {
    RF17: RF17,
    W5: W5
  };
}

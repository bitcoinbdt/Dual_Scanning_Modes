export interface BasicScanResult {
  tokenName: string;
  symbol: string;
  totalSupply: number;
  holderCount: number;
  liquidityLocked: boolean;
  liquidityPct: number;
  buyTax: number;
  sellTax: number;
  isHoneypot: boolean;
  isMintable: boolean;
  isProxy: boolean;
  canPause: boolean;
  ownerBalance: number;
  topHolderPct: number;
  contractAgeDays: number;
  marketCap: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  auditScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  warnings: string[];
  positives: string[];
}

export interface ElevatorTx {
  hash: string;
  type: 'buy' | 'sell';
  wallet: string;
  amountUsd: number;
  tokenAmount: number;
  price: number;
  timestamp: string;
  pnlUsd: number | null;
}

export interface ElevatorWallet {
  address: string;
  txCount: number;
  bought: number;
  sold: number;
  netUsd: number;
  realizedPnl: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  status: 'profit' | 'loss' | 'neutral';
}

export interface ElevatorScanResult {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  totalTxs: number;
  uniqueWallets: number;
  totalVolume: number;
  wallets: ElevatorWallet[];
  transactions: ElevatorTx[];
  avgPrice: number;
  priceSpread: number;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function detectChain(address: string): string {
  const a = address.trim();
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return 'solana';
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return 'evm';
  return 'unknown';
}

function shortAddr(addr: string, len = 6): string {
  if (addr.length <= len * 2 + 2) return addr;
  return `${addr.slice(0, len)}...${addr.slice(-4)}`;
}

const TOKEN_NAMES = [
  ['AlphaFi', 'ALPHA'],
  ['MetaYield', 'MYIELD'],
  ['QuantumSwap', 'QSWAP'],
  ['NovaPad', 'NOVA'],
  ['HyperLend', 'HLEND'],
  ['CosmicVault', 'CVAULT'],
  ['ZenithDAO', 'ZDAO'],
  ['PixelPay', 'PIX'],
  ['OrbitStake', 'ORBIT'],
  ['FluxProtocol', 'FLUX'],
  ['AstroBonds', 'ASTRO'],
  ['EchoChain', 'ECHO'],
];

export function performBasicScan(address: string): BasicScanResult {
  const seed = hashString(address);
  const rand = seededRandom(seed);
  const [name, symbol] = TOKEN_NAMES[seed % TOKEN_NAMES.length];
  const isHoneypot = rand() > 0.88;
  const liquidityLocked = rand() > 0.35;
  const buyTax = Math.floor(rand() * 12);
  const sellTax = Math.floor(rand() * 15);
  const isMintable = rand() > 0.7;
  const isProxy = rand() > 0.8;
  const canPause = rand() > 0.6;
  const topHolderPct = Math.round(rand() * 25 + 1);
  const ownerBalance = Math.round(rand() * 15);
  const holderCount = Math.floor(rand() * 8000 + 50);
  const liquidityPct = Math.round(rand() * 100);
  const contractAgeDays = Math.floor(rand() * 365 + 1);
  const price = rand() * 0.001 + 0.00001;
  const priceChange24h = (rand() - 0.45) * 80;
  const volume24h = Math.floor(rand() * 500000 + 5000);
  const marketCap = price * (rand() * 10000000 + 100000);

  const warnings: string[] = [];
  const positives: string[] = [];

  if (isHoneypot) warnings.push('Potential honeypot detected: sell may be blocked');
  if (buyTax > 5) warnings.push(`High buy tax: ${buyTax}%`);
  if (sellTax > 8) warnings.push(`High sell tax: ${sellTax}%`);
  if (isMintable) warnings.push('Contract is mintable: supply can increase');
  if (isProxy) warnings.push('Proxy contract: logic can be upgraded');
  if (canPause) warnings.push('Trading can be paused by owner');
  if (topHolderPct > 15) warnings.push(`Top holder owns ${topHolderPct}% of supply`);
  if (ownerBalance > 10) warnings.push(`Owner holds ${ownerBalance}% of supply`);
  if (contractAgeDays < 7) warnings.push('Very new contract (< 7 days old)');

  if (liquidityLocked) positives.push(`Liquidity locked (${liquidityPct}%)`);
  if (!isHoneypot) positives.push('No honeypot indicators found');
  if (buyTax <= 3) positives.push('Low buy tax');
  if (sellTax <= 5) positives.push('Low sell tax');
  if (!isMintable) positives.push('Supply is fixed (no mint function)');
  if (topHolderPct < 10) positives.push('Well-distributed holdings');
  if (contractAgeDays > 90) positives.push(`Established contract (${contractAgeDays} days)`);

  let auditScore = 100;
  if (isHoneypot) auditScore -= 50;
  if (isMintable) auditScore -= 15;
  if (isProxy) auditScore -= 10;
  if (canPause) auditScore -= 8;
  if (buyTax > 5) auditScore -= 8;
  if (sellTax > 8) auditScore -= 10;
  if (topHolderPct > 15) auditScore -= 12;
  if (ownerBalance > 10) auditScore -= 10;
  if (contractAgeDays < 7) auditScore -= 8;
  if (liquidityLocked) auditScore += 5;
  auditScore = Math.max(0, Math.min(100, auditScore));

  const riskLevel: BasicScanResult['riskLevel'] =
    auditScore >= 80
      ? 'Low'
      : auditScore >= 60
        ? 'Medium'
        : auditScore >= 35
          ? 'High'
          : 'Critical';

  return {
    tokenName: name,
    symbol,
    totalSupply: Math.floor(rand() * 1000000000 + 1000000),
    holderCount,
    liquidityLocked,
    liquidityPct,
    buyTax,
    sellTax,
    isHoneypot,
    isMintable,
    isProxy,
    canPause,
    ownerBalance,
    topHolderPct,
    contractAgeDays,
    marketCap,
    price,
    priceChange24h,
    volume24h,
    auditScore,
    riskLevel,
    warnings,
    positives,
  };
}

export function performElevatorScan(
  address: string,
  chain: string,
  txCount: number,
): ElevatorScanResult {
  const seed = hashString(address + chain + txCount);
  const rand = seededRandom(seed);
  const [name, symbol] = TOKEN_NAMES[seed % TOKEN_NAMES.length];
  const detected = chain === 'auto' ? detectChain(address) : chain;

  const wallets = Math.min(Math.floor(txCount / 8 + rand() * 10 + 3), txCount);
  const basePrice = rand() * 0.01 + 0.0001;
  const transactions: ElevatorTx[] = [];
  const walletMap = new Map<string, { buys: number[]; sells: number[]; txCount: number }>();

  const walletAddresses: string[] = [];
  for (let i = 0; i < wallets; i++) {
    const wSeed = seed + i * 1000;
    const wRand = seededRandom(wSeed);
    const addr =
      detected === 'solana'
        ? Array.from({ length: 44 }, () => '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(wRand() * 58)]).join('')
        : '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(wRand() * 16)]).join('');
    walletAddresses.push(addr);
    walletMap.set(addr, { buys: [], sells: [], txCount: 0 });
  }

  for (let i = 0; i < txCount; i++) {
    const wallet = walletAddresses[Math.floor(rand() * wallets)];
    const type: 'buy' | 'sell' = rand() > 0.5 ? 'buy' : 'sell';
    const priceVar = 1 + (rand() - 0.5) * 0.3;
    const price = basePrice * priceVar;
    const tokenAmount = Math.floor(rand() * 100000 + 100);
    const amountUsd = tokenAmount * price;
    const entry = walletMap.get(wallet)!;
    entry.txCount++;

    let pnl: number | null = null;
    if (type === 'buy') {
      entry.buys.push(price);
    } else {
      entry.sells.push(price);
      if (entry.buys.length > 0) {
        const avgBuy = entry.buys.reduce((a, b) => a + b, 0) / entry.buys.length;
        pnl = (price - avgBuy) * tokenAmount;
      }
    }

    transactions.push({
      hash: '0x' + Array.from({ length: 16 }, () => '0123456789abcdef'[Math.floor(rand() * 16)]).join(''),
      type,
      wallet: shortAddr(wallet),
      amountUsd,
      tokenAmount,
      price,
      timestamp: new Date(Date.now() - i * 3600000 * rand() * 24).toISOString(),
      pnlUsd: pnl,
    });
  }

  transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const walletResults: ElevatorWallet[] = walletAddresses.map((addr) => {
    const entry = walletMap.get(addr)!;
    const bought = entry.buys.length;
    const sold = entry.sells.length;
    const avgBuyPrice = entry.buys.length > 0 ? entry.buys.reduce((a, b) => a + b, 0) / entry.buys.length : 0;
    const avgSellPrice = entry.sells.length > 0 ? entry.sells.reduce((a, b) => a + b, 0) / entry.sells.length : 0;
    const realizedPnl = entry.sells.length > 0 && avgBuyPrice > 0
      ? (avgSellPrice - avgBuyPrice) * entry.sells.length * 1000
      : 0;
    const netUsd = (sold * avgSellPrice - bought * avgBuyPrice) * 1000;
    const status: ElevatorWallet['status'] = realizedPnl > 0 ? 'profit' : realizedPnl < 0 ? 'loss' : 'neutral';
    return {
      address: shortAddr(addr),
      txCount: entry.txCount,
      bought,
      sold,
      netUsd: Math.round(netUsd),
      realizedPnl: Math.round(realizedPnl),
      avgBuyPrice,
      avgSellPrice,
      status,
    };
  });

  walletResults.sort((a, b) => b.txCount - a.txCount);

  const totalVolume = transactions.reduce((sum, t) => sum + t.amountUsd, 0);
  const avgPrice = transactions.reduce((sum, t) => sum + t.price, 0) / transactions.length;
  const prices = transactions.map((t) => t.price);
  const priceSpread = Math.max(...prices) - Math.min(...prices);

  return {
    symbol,
    name,
    address: shortAddr(address),
    chain: detected === 'unknown' ? chain : detected,
    totalTxs: txCount,
    uniqueWallets: wallets,
    totalVolume,
    wallets: walletResults,
    transactions,
    avgPrice,
    priceSpread,
  };
}

export function detectChainLabel(address: string): string {
  const detected = detectChain(address);
  if (detected === 'solana') return 'solana';
  if (detected === 'evm') return 'evm-ambiguous';
  return 'unknown';
}

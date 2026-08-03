interface BrandLogoProps {
  name: string;
  size?: number;
}

export function BrandLogo({ name, size = 40 }: BrandLogoProps) {
  const n = name.toLowerCase();
  if (n.includes('binance')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#1a1a1a" />
        <path d="M20 9l3.5 3.5v2.8L20 11.8l-3.5 3.5V12.5L20 9z" fill="#f0b90b" />
        <path d="M16.5 12.5L20 9l3.5 3.5L20 16l-3.5-3.5z" fill="#f0b90b" opacity="0.6" />
        <rect x="13" y="17" width="3" height="3" fill="#f0b90b" />
        <rect x="24" y="17" width="3" height="3" fill="#f0b90b" />
        <rect x="13" y="21.5" width="3" height="3" fill="#f0b90b" />
        <rect x="24" y="21.5" width="3" height="3" fill="#f0b90b" />
        <rect x="18.5" y="21.5" width="3" height="3" fill="#f0b90b" />
        <rect x="18.5" y="26" width="3" height="3" fill="#f0b90b" />
      </svg>
    );
  }
  if (n.includes('kucoin')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#0a0a0a" />
        <rect x="8" y="8" width="10" height="10" rx="2" fill="#24ae8f" />
        <rect x="8" y="22" width="10" height="10" rx="2" fill="#24ae8f" opacity="0.7" />
        <rect x="22" y="8" width="10" height="10" rx="2" fill="#24ae8f" opacity="0.7" />
        <circle cx="27" cy="27" r="5" fill="#24ae8f" />
        <text x="11" y="16" fontSize="7" fill="#fff" fontWeight="bold">
          K
        </text>
      </svg>
    );
  }
  if (n.includes('usdt')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="#26a17b" />
        <text x="20" y="27" fontSize="18" fill="#fff" textAnchor="middle" fontWeight="bold">
          T
        </text>
        <path d="M20 9h-5v3h10V9H20z" fill="#fff" />
      </svg>
    );
  }
  if (n.includes('usdc')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="#2775ca" />
        <text x="20" y="26" fontSize="11" fill="#fff" textAnchor="middle" fontWeight="bold">
          USD
        </text>
        <text x="20" y="16" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="bold">
          C
        </text>
      </svg>
    );
  }
  if (n.includes('trx') || n.includes('tron')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#0a0a0a" />
        <path d="M12 12l16 4-7 6-2 8-7-8 0-10z" fill="#eb0029" />
        <path d="M12 12l9 10-2 8-7-8V12z" fill="#eb0029" opacity="0.6" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#1a1a1a" />
      <circle cx="20" cy="20" r="10" fill="#64748b" />
    </svg>
  );
}

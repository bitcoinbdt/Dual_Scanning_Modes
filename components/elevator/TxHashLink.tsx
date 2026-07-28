'use client';

import { ExternalLink } from 'lucide-react';

interface TxHashLinkProps {
  hash?: string;
  network?: 'solana' | 'ethereum' | 'bsc' | 'polygon' | 'eth';
  showIcon?: boolean;
}

/**
 * Transaction Hash Link Component
 * Displays transaction hash with link to blockchain explorer
 */
export function TxHashLink({ 
  hash, 
  network = 'solana',
  showIcon = true 
}: TxHashLinkProps) {
  // If no hash provided, show placeholder
  if (!hash) {
    return (
      <span className="text-xs text-slate-500 font-mono">—</span>
    );
  }
  
  // Determine explorer URL based on network
  const getExplorerUrl = () => {
    switch (network) {
      case 'solana':
        return `https://solscan.io/tx/${hash}`;
      case 'eth':
      case 'ethereum':
        return `https://etherscan.io/tx/${hash}`;
      case 'bsc':
        return `https://bscscan.com/tx/${hash}`;
      case 'polygon':
        return `https://polygonscan.com/tx/${hash}`;
      default:
        return `https://solscan.io/tx/${hash}`;
    }
  };
  
  // Abbreviate hash for display
  const displayHash = hash.length > 16 
    ? `${hash.slice(0, 8)}...${hash.slice(-6)}` 
    : hash;
  
  return (
    <a
      href={getExplorerUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-1.5 text-xs font-mono text-primary-400 hover:text-primary-300 transition-colors"
      title={`View transaction: ${hash}`}
    >
      <span>{displayHash}</span>
      {showIcon && (
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </a>
  );
}

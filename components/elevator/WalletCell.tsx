'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface WalletCellProps {
  wallet: string;
  showFull?: boolean;
}

/**
 * Wallet Cell Component
 * Displays wallet address with copy-to-clipboard functionality
 */
export function WalletCell({ wallet, showFull = false }: WalletCellProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy wallet address:', error);
    }
  };
  
  // Format wallet address (abbreviated or full)
  const displayAddress = showFull 
    ? wallet 
    : `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="group flex items-center gap-2 text-xs font-mono text-slate-300 hover:text-primary-400 transition-colors"
        title={`${wallet}\nClick to copy`}
      >
        <span>{displayAddress}</span>
        {copied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
      {copied && (
        <span className="text-xs text-green-400 font-semibold animate-pulse">
          Copied!
        </span>
      )}
    </div>
  );
}

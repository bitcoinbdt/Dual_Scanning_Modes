'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { BoostedToken } from '@/types/boost';
import { formatBoostPrice, getBlockchainLabel } from '@/types/boost';

interface BoostedTokenCardProps {
  token: BoostedToken;
  onClick?: (contractAddress: string, blockchain: string) => void;
  index?: number;
}

export default function BoostedTokenCard({ token, onClick, index = 0 }: BoostedTokenCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(token.tokenContractAddress, token.blockchain);
    }
  };

  const priceChangePositive = token.priceChange24h && token.priceChange24h > 0;
  const priceChangeNegative = token.priceChange24h && token.priceChange24h < 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      className={`
        group relative flex items-center gap-3 
        glass-light hover:glass-strong 
        rounded-xl p-3
        border border-white/5 hover:border-purple-500/30
        transition-all duration-300
        ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}
        min-w-[180px] max-w-[220px]
      `}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-pink-500/0 to-blue-500/0 group-hover:from-purple-500/5 group-hover:via-pink-500/5 group-hover:to-blue-500/5 rounded-xl transition-all duration-300 pointer-events-none" />

      {/* Token Logo */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-black/20 border border-white/10">
          {token.tokenLogoUrl ? (
            <img
              src={token.tokenLogoUrl}
              alt={token.tokenSymbol}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to gradient on image error
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  parent.classList.add('gradient-bg');
                  parent.innerHTML = `<span class="text-sm font-bold text-white">${token.tokenSymbol.substring(0, 2)}</span>`;
                  parent.classList.add('flex', 'items-center', 'justify-center');
                }
              }}
            />
          ) : (
            <div className="gradient-bg w-full h-full flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                {token.tokenSymbol.substring(0, 2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Token Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <h3 className="text-sm font-bold text-white truncate group-hover:text-purple-400 transition-colors">
            {token.tokenName}
          </h3>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400 font-medium truncate">
            ${token.tokenSymbol}
          </span>
          {token.currentPriceUsd && (
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-white">
                {formatBoostPrice(token.currentPriceUsd)}
              </span>
              {token.priceChange24h !== undefined && token.priceChange24h !== null && (
                <span
                  className={`
                    flex items-center text-xs font-medium
                    ${priceChangePositive ? 'text-green-400' : ''}
                    ${priceChangeNegative ? 'text-red-400' : ''}
                    ${!priceChangePositive && !priceChangeNegative ? 'text-gray-400' : ''}
                  `}
                >
                  {priceChangePositive && <TrendingUp className="w-3 h-3 mr-0.5" />}
                  {priceChangeNegative && <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {priceChangePositive && '+'}
                  {token.priceChange24h.toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Blockchain Badge */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
          <span className="text-[10px] font-semibold text-gray-300 uppercase">
            {getBlockchainLabel(token.blockchain)}
          </span>
        </div>
      </div>

      {/* Featured Badge */}
      <div className="absolute -top-1 -left-1">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
          <span className="text-xs">⭐</span>
        </div>
      </div>
    </motion.div>
  );
}

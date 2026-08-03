'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import BoostedTokenCard from './BoostedTokenCard';
import type { BoostedToken } from '@/types/boost';

interface BoostedTokenBannerProps {
  placement: 'home' | 'agent' | 'pricing';
  onTokenClick?: (contractAddress: string, blockchain: string) => void;
}

export default function BoostedTokenBanner({ placement, onTokenClick }: BoostedTokenBannerProps) {
  const [boostedTokens, setBoostedTokens] = useState<BoostedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBoostedTokens();
    // Refresh every 60 seconds to get updated prices and expiring tokens
    const interval = setInterval(fetchBoostedTokens, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    updateScrollButtons();
  }, [boostedTokens, scrollPosition]);

  const fetchBoostedTokens = async () => {
    try {
      const response = await fetch('/api/boost/active');
      const data = await response.json();

      if (data.success && data.boosts) {
        setBoostedTokens(data.boosts);
      }
    } catch (error) {
      console.error('Error fetching boosted tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 240; // Approximate width of one card + gap
      const newPosition =
        direction === 'left'
          ? scrollContainerRef.current.scrollLeft - scrollAmount
          : scrollContainerRef.current.scrollLeft + scrollAmount;

      scrollContainerRef.current.scrollTo({
        left: newPosition,
        behavior: 'smooth',
      });
      
      setTimeout(updateScrollButtons, 300);
    }
  };

  const handleTokenClick = (contractAddress: string, blockchain: string) => {
    // Track scan click
    trackClick(contractAddress);

    if (onTokenClick) {
      onTokenClick(contractAddress, blockchain);
    } else if (placement !== 'home') {
      // If not on home page, redirect to home with the contract address
      const url = new URL(window.location.origin);
      url.searchParams.set('token', contractAddress);
      url.searchParams.set('blockchain', blockchain);
      window.location.href = url.toString();
    }
  };

  const trackClick = async (contractAddress: string) => {
    // This would ideally track impressions/clicks for analytics
    // For now, we're only tracking when a token is actually scanned
    console.log('Token clicked:', contractAddress);
  };

  if (loading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="glass-light rounded-xl p-4 h-24" />
      </div>
    );
  }

  if (boostedTokens.length === 0) {
    return null; // Don't show banner if no active boosts
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6 relative group"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Featured Tokens
        </h3>
        <div className="h-px flex-1 bg-gradient-to-r from-yellow-400/20 via-transparent to-transparent" />
      </div>

      {/* Scrollable Container */}
      <div className="relative">
        {/* Left Scroll Button */}
        {canScrollLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 
                     w-8 h-8 rounded-full glass-strong border border-white/10
                     flex items-center justify-center
                     hover:border-purple-500/30 hover:scale-110
                     transition-all duration-200
                     shadow-lg"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Right Scroll Button */}
        {canScrollRight && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                     w-8 h-8 rounded-full glass-strong border border-white/10
                     flex items-center justify-center
                     hover:border-purple-500/30 hover:scale-110
                     transition-all duration-200
                     shadow-lg"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Tokens Container */}
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollButtons}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {boostedTokens.map((token, index) => (
            <BoostedTokenCard
              key={token.id}
              token={token}
              onClick={handleTokenClick}
              index={index}
            />
          ))}
        </div>

        {/* Fade Edges */}
        {boostedTokens.length > 3 && (
          <>
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a0a0f] to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a0f] to-transparent pointer-events-none" />
          </>
        )}
      </div>

      {/* Sponsored Label */}
      <div className="flex items-center justify-center mt-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">
          Sponsored
        </span>
      </div>
    </motion.div>
  );
}

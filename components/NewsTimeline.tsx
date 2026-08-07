'use client';

import React, { useState } from 'react';
import { AlertCircle, Clock, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NewsItem {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'maintenance' | 'update' | 'info';
}

const NEWS_ITEMS: NewsItem[] = [
  {
    id: '1',
    date: '2026-08-15',
    title: 'System Maintenance',
    description: 'The platform is currently undergoing scheduled maintenance to enhance performance and security. Some features may be temporarily unavailable. We appreciate your patience.',
    type: 'maintenance',
  },
  {
    id: '2',
    date: '2026-08-01',
    title: 'Elevator Deep Scan Enhanced',
    description: 'Multi-chain support now includes Solana, BSC, and Ethereum with improved transaction analysis.',
    type: 'update',
  },
  {
    id: '3',
    date: '2026-07-28',
    title: 'New Referral Program',
    description: 'Earn credits by referring friends. Check out the Referral section for more details.',
    type: 'info',
  },
];

export default function NewsTimeline() {
  const [isVisible, setIsVisible] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>('1'); // Auto-expand maintenance notice

  if (!isVisible) return null;

  const getIcon = (type: NewsItem['type']) => {
    switch (type) {
      case 'maintenance':
        return <AlertCircle className="w-4 h-4" />;
      case 'update':
        return <Clock className="w-4 h-4" />;
      case 'info':
        return <Info className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: NewsItem['type']) => {
    switch (type) {
      case 'maintenance':
        return {
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          glow: 'rgba(245, 158, 11, 0.15)',
        };
      case 'update':
        return {
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          glow: 'rgba(59, 130, 246, 0.15)',
        };
      case 'info':
        return {
          badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          glow: 'rgba(6, 182, 212, 0.15)',
        };
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="glass-strong rounded-2xl p-4 sm:p-6 rgb-border relative">
          {/* Close Button */}
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-3 right-3 p-1.5 hover:bg-white/5 rounded-lg transition-colors z-10"
            title="Dismiss news"
          >
            <X className="w-4 h-4 text-muted-themed hover:text-themed" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary-themed" />
            <h2 className="text-lg sm:text-xl font-bold gradient-text">Platform Updates</h2>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            {NEWS_ITEMS.map((item, index) => {
              const colors = getTypeColor(item.type);
              const isExpanded = expandedId === item.id;
              const isFirst = index === 0;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className={`w-full text-left rounded-lg border transition-all ${
                      isExpanded
                        ? 'bg-white/5 border-primary-themed/50 glow-sm'
                        : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04] hover:border-white/20'
                    }`}
                  >
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        {/* Timeline Dot */}
                        <div className="relative flex-shrink-0 mt-1">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center border ${colors.badge}`}
                            style={{
                              boxShadow: isFirst ? `0 0 16px ${colors.glow}` : 'none',
                            }}
                          >
                            {getIcon(item.type)}
                          </div>
                          {/* Connector Line */}
                          {index < NEWS_ITEMS.length - 1 && (
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gradient-to-b from-white/20 to-transparent" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colors.badge}`}
                            >
                              {item.type}
                            </span>
                            <span className="text-xs text-muted-themed">
                              {new Date(item.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>

                          <h3 className="text-sm sm:text-base font-bold text-themed mb-1">
                            {item.title}
                          </h3>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <p className="text-xs sm:text-sm text-muted-themed leading-relaxed mt-2">
                                  {item.description}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[10px] sm:text-xs text-muted-themed text-center">
              Stay informed about platform updates, maintenance schedules, and new features.
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

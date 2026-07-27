'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Zap } from 'lucide-react';
import { SCAN_COSTS } from '@/types/credits';

interface InsufficientCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuyCredits: () => void;
  scanType: 'BASIC' | 'ELEVATOR';
  currentBalance: number;
}

export function InsufficientCreditsModal({
  isOpen,
  onClose,
  onBuyCredits,
  scanType,
  currentBalance,
}: InsufficientCreditsModalProps) {
  const required = SCAN_COSTS[scanType];
  const shortage = required - currentBalance;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative glass-card rounded-2xl border border-red-500/30 max-w-md w-full bg-gradient-to-br from-red-900/20 to-slate-900/50"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="w-16 h-16 bg-red-500/20 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </motion.div>

            {/* Header */}
            <h3 className="text-2xl font-black text-center mb-2">
              Insufficient Credits
            </h3>
            <p className="text-slate-400 text-center text-sm mb-6">
              You don't have enough credits to perform this scan
            </p>

            {/* Credit Info */}
            <div className="bg-slate-900/50 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Scan Type:</span>
                <span className="text-white font-bold">
                  {scanType === 'BASIC' ? 'Basic Scan' : 'Elevator Deep Scan'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Required:</span>
                <span className="text-white font-bold flex items-center gap-1">
                  {required} <Zap className="w-4 h-4 text-yellow-400" fill="currentColor" />
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Your Balance:</span>
                <span className="text-red-400 font-bold flex items-center gap-1">
                  {currentBalance} <Zap className="w-4 h-4 text-red-400" fill="currentColor" />
                </span>
              </div>
              <div className="border-t border-white/10 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">You Need:</span>
                  <span className="text-primary-400 font-black text-lg flex items-center gap-1">
                    +{shortage} <Zap className="w-5 h-5 text-primary-400" fill="currentColor" />
                  </span>
                </div>
              </div>
            </div>

            {/* Package Suggestions */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
              <h4 className="text-sm font-bold text-blue-400 mb-2">💡 Recommended Package</h4>
              <p className="text-slate-300 text-xs">
                The <span className="font-bold text-white">Starter Package (50 credits)</span> would give you{' '}
                {Math.floor(50 / SCAN_COSTS[scanType])} {scanType === 'BASIC' ? 'Basic' : 'Elevator'} scans
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  onClose();
                  onBuyCredits();
                }}
                className="w-full bg-gradient-to-r from-primary-600 to-blue-600 hover:from-primary-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" fill="currentColor" />
                Buy Credits Now
              </button>
              <button
                onClick={onClose}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

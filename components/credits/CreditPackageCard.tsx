'use client';

import { motion } from 'framer-motion';
import { Check, Flame, Star, Zap } from 'lucide-react';
import type { CreditPackage } from '@/types/credits';
import { calculateScanExamples, formatUsdAmount } from '@/services/creditApi';

interface CreditPackageCardProps {
  package: CreditPackage;
  isSelected: boolean;
  onSelect: (pkg: CreditPackage) => void;
}

export function CreditPackageCard({ package: pkg, isSelected, onSelect }: CreditPackageCardProps) {
  const { basicScans, elevatorScans } = calculateScanExamples(pkg.credits);

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative glass-card rounded-2xl p-6 cursor-pointer transition-all
        ${isSelected 
          ? 'border-2 border-primary-500 bg-primary-900/20' 
          : 'border border-white/10 hover:border-primary-500/50'
        }
      `}
      onClick={() => onSelect(pkg)}
    >
      {/* Badge for Hot/Best Value */}
      {(pkg.isHot || pkg.isBestValue) && (
        <div className={`
          absolute -top-3 -right-3 px-3 py-1 rounded-full text-xs font-black uppercase
          flex items-center gap-1 shadow-lg
          ${pkg.isBestValue 
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' 
            : 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
          }
        `}>
          {pkg.isBestValue ? (
            <>
              <Star className="w-3 h-3" fill="currentColor" />
              Best Value
            </>
          ) : (
            <>
              <Flame className="w-3 h-3" fill="currentColor" />
              Hot
            </>
          )}
        </div>
      )}

      {/* Selected Checkmark */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-4 right-4 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center"
        >
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}

      {/* Package Name */}
      <div className="text-center mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
          {pkg.name}
        </h3>
      </div>

      {/* Credits */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" fill="currentColor" />
          <span className="text-4xl font-black text-white">
            {pkg.credits}
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="text-center mb-4">
        <div className="text-3xl font-black text-primary-400">
          {formatUsdAmount(pkg.priceUsd)}
        </div>
      </div>

      {/* Bonus Badge */}
      {pkg.bonusPercentage > 0 && (
        <div className="text-center mb-4">
          <div className="inline-block bg-green-500/20 border border-green-500/30 text-green-400 px-3 py-1 rounded-full text-xs font-bold">
            +{pkg.bonusPercentage}% Bonus
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-white/10 my-4" />

      {/* Scan Examples */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Basic Scans:</span>
          <span className="text-white font-bold">{basicScans}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Elevator Scans:</span>
          <span className="text-white font-bold">{elevatorScans}</span>
        </div>
      </div>

      {/* Select Button */}
      <button
        className={`
          w-full py-3 rounded-xl font-bold text-sm transition-all
          ${isSelected
            ? 'bg-primary-600 text-white'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }
        `}
      >
        {isSelected ? 'Selected' : 'Select'}
      </button>
    </motion.div>
  );
}

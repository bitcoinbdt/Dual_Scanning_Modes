'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { useCredits } from '@/contexts/CreditContext';
import { BOOST_PRICING, type BoostDuration, type Blockchain, type BoostSubmitRequest } from '@/types/boost';
import toast from 'react-hot-toast';

const BLOCKCHAIN_OPTIONS: Array<{ value: Blockchain; label: string }> = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'bsc', label: 'BSC (Binance Smart Chain)' },
  { value: 'solana', label: 'Solana' },
];

const DURATION_OPTIONS: Array<{ value: BoostDuration; label: string; credits: number }> = [
  { value: 6, label: '6 Hours', credits: BOOST_PRICING[6] },
  { value: 12, label: '12 Hours', credits: BOOST_PRICING[12] },
  { value: 24, label: '24 Hours', credits: BOOST_PRICING[24] },
  { value: 36, label: '36 Hours', credits: BOOST_PRICING[36] },
];

export default function BoostRequestForm() {
  const { balance, refreshBalance } = useCredits();
  
  const [formData, setFormData] = useState<BoostSubmitRequest>({
    tokenName: '',
    tokenSymbol: '',
    tokenLogoUrl: '',
    tokenContractAddress: '',
    blockchain: 'ethereum',
    durationHours: 12,
    website: '',
    description: '',
    coingeckoId: '',
  });

  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentCost = BOOST_PRICING[formData.durationHours];
  const hasEnoughCredits = balance.balance >= currentCost;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.tokenName.trim()) newErrors.tokenName = 'Token name is required';
    if (formData.tokenName.length > 50) newErrors.tokenName = 'Token name must be 50 characters or less';
    
    if (!formData.tokenSymbol.trim()) newErrors.tokenSymbol = 'Token symbol is required';
    if (formData.tokenSymbol.length > 10) newErrors.tokenSymbol = 'Token symbol must be 10 characters or less';
    
    if (!formData.tokenLogoUrl.trim()) newErrors.tokenLogoUrl = 'Token logo URL is required';
    if (formData.tokenLogoUrl && !formData.tokenLogoUrl.match(/^https?:\/\/.+/i)) {
      newErrors.tokenLogoUrl = 'Please provide a valid image URL starting with http:// or https://';
    }
    
    if (!formData.tokenContractAddress.trim()) {
      newErrors.tokenContractAddress = 'Contract address is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    if (!hasEnoughCredits) {
      toast.error(`You need ${currentCost} credits but have ${balance.balance}`);
      return;
    }

    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    setLoading(true);
    setShowConfirmation(false);

    try {
      const response = await fetch('/api/boost/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit boost request');
      }

      toast.success('Boost request submitted! Awaiting admin approval.');
      
      // Reset form
      setFormData({
        tokenName: '',
        tokenSymbol: '',
        tokenLogoUrl: '',
        tokenContractAddress: '',
        blockchain: 'ethereum',
        durationHours: 12,
        website: '',
        description: '',
        coingeckoId: '',
      });

      // Refresh credit balance
      refreshBalance();
    } catch (error: any) {
      console.error('Error submitting boost:', error);
      toast.error(error.message || 'Failed to submit boost request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="glass-strong rounded-2xl p-6">
        <h2 className="text-xl font-bold gradient-text mb-6">Submit Boost Request</h2>

        <div className="space-y-5">
          {/* Token Name */}
          <div>
            <label className="block text-sm font-medium text-themed mb-2">
              Token Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.tokenName}
              onChange={(e) => setFormData({ ...formData, tokenName: e.target.value })}
              placeholder="e.g., Giga Cat"
              maxLength={50}
              className={`w-full bg-white/5 border ${
                errors.tokenName ? 'border-red-400' : 'border-white/10'
              } rounded-lg px-4 py-3 text-sm text-themed focus:outline-none focus:border-primary-themed transition`}
            />
            {errors.tokenName && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.tokenName}
              </p>
            )}
            <p className="text-xs text-muted-themed mt-1">{formData.tokenName.length}/50 characters</p>
          </div>

          {/* Token Symbol */}
          <div>
            <label className="block text-sm font-medium text-themed mb-2">
              Token Symbol <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.tokenSymbol}
              onChange={(e) => setFormData({ ...formData, tokenSymbol: e.target.value.toUpperCase() })}
              placeholder="e.g., GICAT"
              maxLength={10}
              className={`w-full bg-white/5 border ${
                errors.tokenSymbol ? 'border-red-400' : 'border-white/10'
              } rounded-lg px-4 py-3 text-sm text-themed focus:outline-none focus:border-primary-themed transition uppercase`}
            />
            {errors.tokenSymbol && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.tokenSymbol}
              </p>
            )}
          </div>

          {/* Token Logo URL */}
          <div>
            <label className="block text-sm font-medium text-themed mb-2">
              Token Logo URL <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={formData.tokenLogoUrl}
                onChange={(e) => setFormData({ ...formData, tokenLogoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                className={`flex-1 bg-white/5 border ${
                  errors.tokenLogoUrl ? 'border-red-400' : 'border-white/10'
                } rounded-lg px-4 py-3 text-sm text-themed focus:outline-none focus:border-primary-themed transition`}
              />
              {formData.tokenLogoUrl && (
                <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  <img
                    src={formData.tokenLogoUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            {errors.tokenLogoUrl && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.tokenLogoUrl}
              </p>
            )}
            <p className="text-xs text-muted-themed mt-1">Any public image URL (JPG, PNG, GIF, WEBP, SVG or CDN links)</p>
          </div>

          {/* Contract Address */}
          <div>
            <label className="block text-sm font-medium text-themed mb-2">
              Contract Address <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.tokenContractAddress}
              onChange={(e) => setFormData({ ...formData, tokenContractAddress: e.target.value })}
              placeholder="0x... or token address"
              className={`w-full bg-white/5 border ${
                errors.tokenContractAddress ? 'border-red-400' : 'border-white/10'
              } rounded-lg px-4 py-3 text-sm text-themed font-mono focus:outline-none focus:border-primary-themed transition`}
            />
            {errors.tokenContractAddress && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.tokenContractAddress}
              </p>
            )}
          </div>

          {/* Blockchain */}
          <div>
            <label className="block text-sm font-medium text-themed mb-2">
              Blockchain <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BLOCKCHAIN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormData({ ...formData, blockchain: option.value })}
                  className={`py-2.5 rounded-lg text-sm font-medium transition ${
                    formData.blockchain === option.value
                      ? 'gradient-primary text-white'
                      : 'glass text-muted-themed hover:text-themed hover:bg-white/5'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-themed mb-2">
              Duration <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormData({ ...formData, durationHours: option.value })}
                  className={`py-3 rounded-lg text-sm transition ${
                    formData.durationHours === option.value
                      ? 'gradient-primary text-white'
                      : 'glass text-muted-themed hover:text-themed hover:bg-white/5'
                  }`}
                >
                  <div className="font-bold">{option.label}</div>
                  <div className="text-xs opacity-80">{option.credits} credits</div>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Fields */}
          <div className="border-t border-white/5 pt-5">
            <h3 className="text-sm font-bold text-themed mb-4">Optional Information</h3>
            
            <div className="space-y-4">
              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-muted-themed mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourtoken.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-themed focus:outline-none focus:border-primary-themed transition"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-muted-themed mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of your token..."
                  maxLength={200}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-themed focus:outline-none focus:border-primary-themed transition resize-none"
                />
                <p className="text-xs text-muted-themed mt-1">{formData.description?.length || 0}/200 characters</p>
              </div>

              {/* CoinGecko ID */}
              <div>
                <label className="block text-sm font-medium text-muted-themed mb-2">
                  CoinGecko ID
                </label>
                <input
                  type="text"
                  value={formData.coingeckoId}
                  onChange={(e) => setFormData({ ...formData, coingeckoId: e.target.value })}
                  placeholder="e.g., bitcoin"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-themed focus:outline-none focus:border-primary-themed transition"
                />
                <p className="text-xs text-muted-themed mt-1">For automatic price fetching (optional)</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="border-t border-white/5 pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-themed">
                Cost: <span className="text-primary-themed font-bold">{currentCost} credits</span>
                {' '} | Balance: <span className={hasEnoughCredits ? 'text-green-400' : 'text-red-400'}>{balance.balance} credits</span>
              </div>
            </div>
            
            <button
              onClick={handleSubmit}
              disabled={loading || !hasEnoughCredits}
              className="w-full gradient-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>Submit Boost Request</>
              )}
            </button>

            {!hasEnoughCredits && (
              <p className="text-xs text-red-400 mt-2 text-center">
                Insufficient credits. Please purchase more credits to continue.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowConfirmation(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-strong rounded-2xl p-6 max-w-md w-full border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold gradient-text mb-4">Confirm Submission</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-themed">Token:</span>
                  <span className="text-themed font-medium">{formData.tokenName} ({formData.tokenSymbol})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-themed">Blockchain:</span>
                  <span className="text-themed font-medium capitalize">{formData.blockchain}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-themed">Duration:</span>
                  <span className="text-themed font-medium">{formData.durationHours} hours</span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/5 pt-3">
                  <span className="text-muted-themed font-bold">Credits to be deducted:</span>
                  <span className="text-primary-themed font-bold">{currentCost} credits</span>
                </div>
              </div>

              <p className="text-xs text-muted-themed mb-6">
                Your request will be reviewed by an admin. Credits will be refunded if rejected.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 glass py-2.5 rounded-lg text-sm font-medium text-themed hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSubmit}
                  disabled={loading}
                  className="flex-1 gradient-primary text-white font-bold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

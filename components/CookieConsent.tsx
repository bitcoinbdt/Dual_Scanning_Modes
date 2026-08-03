'use client';

import React, { useState, useEffect } from 'react';
import { Cookie, X, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CookieConsent: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true, // Always true, cannot be disabled
    functional: true,
    analytics: true,
    performance: true
  });

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Show banner after a short delay
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const handleAcceptAll = () => {
    const consent = {
      essential: true,
      functional: true,
      analytics: true,
      performance: true,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consent));
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    const consent = {
      essential: true, // Essential cookies cannot be rejected
      functional: false,
      analytics: false,
      performance: false,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consent));
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    const consent = {
      ...preferences,
      essential: true, // Always true
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consent));
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleClose = () => {
    // If user closes without choosing, treat as reject all except essential
    handleRejectAll();
  };

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-3 md:p-6"
      >
        <div className="max-w-6xl mx-auto">
          <div className="glass-card rounded-xl md:rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {!showSettings ? (
              // Main Banner - Mobile Optimized
              <div className="p-4 md:p-8">
                <div className="flex items-start gap-3 md:gap-4">
                  {/* Icon - Hidden on small mobile, shown on larger screens */}
                  <div className="hidden sm:flex w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 items-center justify-center flex-shrink-0">
                    <Cookie className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-base md:text-xl font-black text-white leading-tight">
                        We Value Your Privacy
                      </h3>
                      <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
                        title="Close"
                      >
                        <X className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                      </button>
                    </div>
                    
                    <p className="text-xs md:text-sm text-slate-300 leading-snug md:leading-relaxed mb-3 md:mb-4">
                      We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. 
                      By clicking "Accept All", you consent to our use of cookies. You can customize your preferences or learn more in our{' '}
                      <a href="/cookie-policy" className="text-primary-400 hover:text-primary-300 underline">
                        Cookie Policy
                      </a>.
                    </p>
                    
                    {/* Mobile: Vertical Stack, Desktop: Horizontal */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <button
                        onClick={handleAcceptAll}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs sm:text-sm font-bold transition-colors"
                      >
                        Accept All
                      </button>
                      <button
                        onClick={handleRejectAll}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold transition-colors"
                      >
                        Reject All
                      </button>
                      <button
                        onClick={() => setShowSettings(true)}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Customize
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Settings Panel - Mobile Optimized with Scrollable Content
              <div className="p-4 md:p-8 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 md:mb-6 sticky top-0 bg-slate-950/95 backdrop-blur-sm pb-3 -mt-1 z-10">
                  <h3 className="text-base md:text-xl font-black text-white">
                    Cookie Preferences
                  </h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1.5 md:p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                  {/* Essential Cookies */}
                  <div className="flex items-start justify-between p-3 md:p-4 bg-slate-900/50 rounded-lg border border-white/10">
                    <div className="flex-1 pr-3 md:pr-4">
                      <h4 className="text-xs md:text-sm font-bold text-white mb-1">Essential Cookies</h4>
                      <p className="text-[10px] md:text-xs text-slate-400 leading-tight">
                        Required for the platform to function. Cannot be disabled.
                      </p>
                    </div>
                    <div className="flex items-center">
                      <div className="w-9 h-5 md:w-11 md:h-6 bg-primary-600 rounded-full relative cursor-not-allowed opacity-50">
                        <div className="absolute top-[2px] right-[2px] w-4 h-4 md:w-5 md:h-5 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* Functional Cookies */}
                  <div className="flex items-start justify-between p-3 md:p-4 bg-slate-900/50 rounded-lg border border-white/10">
                    <div className="flex-1 pr-3 md:pr-4">
                      <h4 className="text-xs md:text-sm font-bold text-white mb-1">Functional Cookies</h4>
                      <p className="text-[10px] md:text-xs text-slate-400 leading-tight">
                        Remember your preferences and settings.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 md:w-11 md:h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {/* Analytics Cookies */}
                  <div className="flex items-start justify-between p-3 md:p-4 bg-slate-900/50 rounded-lg border border-white/10">
                    <div className="flex-1 pr-3 md:pr-4">
                      <h4 className="text-xs md:text-sm font-bold text-white mb-1">Analytics Cookies</h4>
                      <p className="text-[10px] md:text-xs text-slate-400 leading-tight">
                        Help us understand how you use the platform.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 md:w-11 md:h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {/* Performance Cookies */}
                  <div className="flex items-start justify-between p-3 md:p-4 bg-slate-900/50 rounded-lg border border-white/10">
                    <div className="flex-1 pr-3 md:pr-4">
                      <h4 className="text-xs md:text-sm font-bold text-white mb-1">Performance Cookies</h4>
                      <p className="text-[10px] md:text-xs text-slate-400 leading-tight">
                        Monitor and improve platform performance.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={preferences.performance}
                        onChange={(e) => setPreferences({ ...preferences, performance: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 md:w-11 md:h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sticky bottom-0 bg-slate-950/95 backdrop-blur-sm pt-3 -mb-1">
                  <button
                    onClick={handleSavePreferences}
                    className="flex-1 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs sm:text-sm font-bold transition-colors"
                  >
                    Save Preferences
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CookieConsent;

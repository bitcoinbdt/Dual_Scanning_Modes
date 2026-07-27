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
        className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
      >
        <div className="max-w-6xl mx-auto">
          <div className="glass-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {!showSettings ? (
              // Main Banner
              <div className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Cookie className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-black text-white mb-2">
                      We Value Your Privacy
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">
                      We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. 
                      By clicking "Accept All", you consent to our use of cookies. You can customize your preferences or learn more in our{' '}
                      <a href="/cookie-policy" className="text-primary-400 hover:text-primary-300 underline">
                        Cookie Policy
                      </a>.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleAcceptAll}
                        className="px-6 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold transition-colors"
                      >
                        Accept All
                      </button>
                      <button
                        onClick={handleRejectAll}
                        className="px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors"
                      >
                        Reject All
                      </button>
                      <button
                        onClick={() => setShowSettings(true)}
                        className="px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Customize
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
                    title="Close"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>
            ) : (
              // Settings Panel
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg md:text-xl font-black text-white">
                    Cookie Preferences
                  </h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  {/* Essential Cookies */}
                  <div className="flex items-start justify-between p-4 bg-slate-900/50 rounded-lg border border-white/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-sm font-bold text-white mb-1">Essential Cookies</h4>
                      <p className="text-xs text-slate-400">
                        Required for the platform to function. Cannot be disabled.
                      </p>
                    </div>
                    <div className="flex items-center">
                      <div className="w-11 h-6 bg-primary-600 rounded-full relative cursor-not-allowed opacity-50">
                        <div className="absolute top-[2px] right-[2px] w-5 h-5 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* Functional Cookies */}
                  <div className="flex items-start justify-between p-4 bg-slate-900/50 rounded-lg border border-white/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-sm font-bold text-white mb-1">Functional Cookies</h4>
                      <p className="text-xs text-slate-400">
                        Remember your preferences and settings.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {/* Analytics Cookies */}
                  <div className="flex items-start justify-between p-4 bg-slate-900/50 rounded-lg border border-white/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-sm font-bold text-white mb-1">Analytics Cookies</h4>
                      <p className="text-xs text-slate-400">
                        Help us understand how you use the platform.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {/* Performance Cookies */}
                  <div className="flex items-start justify-between p-4 bg-slate-900/50 rounded-lg border border-white/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-sm font-bold text-white mb-1">Performance Cookies</h4>
                      <p className="text-xs text-slate-400">
                        Monitor and improve platform performance.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.performance}
                        onChange={(e) => setPreferences({ ...preferences, performance: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSavePreferences}
                    className="flex-1 px-6 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold transition-colors"
                  >
                    Save Preferences
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors"
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

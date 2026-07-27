'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Target, Zap, Search, Database, Clock, ExternalLink, Cpu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditContext';
import { useEventBus } from '@/hooks/useEventBus';
import { getBasicScan, startElevatorScan, getElevatorJobStatus, validateBackendConnection } from '@/services/scannerApi';
import type { OnChainData } from '@/types/scanner';
import { SCAN_COSTS } from '@/types/credits';
import Navigation from '@/components/layout/Navigation';
import { TokenOverviewCard } from '@/components/TokenOverviewCard';
import { AdvancedRiskMetricsCard } from '@/components/AdvancedRiskMetricsCard';
import { TokenAuditCard } from '@/components/TokenAuditCard';
import { MarketIntelligenceCard } from '@/components/MarketIntelligenceCard';
import { RecentTransactionsCard } from '@/components/RecentTransactionsCard';
import { ElevatorResultCard } from '@/components/ElevatorResultCard';
import { CreditStoreModal } from '@/components/credits/CreditStoreModal';
import { InsufficientCreditsModal } from '@/components/credits/InsufficientCreditsModal';
import toast from 'react-hot-toast';

function HomePageContent() {
  useEventBus();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { balance, hasEnoughCredits, deductCredits } = useCredits();
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState<OnChainData | null>(null);
  const [elevatorData, setElevatorData] = useState<any | null>(null);
  const [isElevatorMode, setIsElevatorMode] = useState(false);
  const [address, setAddress] = useState('');
  const [scanType, setScanType] = useState<'BASIC' | 'ELEVATOR'>('BASIC');
  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);
  const [showCreditStore, setShowCreditStore] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);

  // Capture referral code from URL parameter
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      // Store in localStorage for later use during registration/purchase
      localStorage.setItem('pendingReferralCode', refCode);
      toast.success(`Referral code ${refCode} saved! It will be applied on your first purchase.`, {
        duration: 5000,
        icon: '🎁',
      });
    }
  }, [searchParams]);

  // Check backend connection on mount
  useEffect(() => {
    const checkBackend = async () => {
      const status = await validateBackendConnection();
      setBackendStatus(status.connected);
    };
    checkBackend();
  }, []);

  const handleScan = async (addr: string, type: 'BASIC' | 'ELEVATOR') => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      toast.error('Please login to scan tokens');
      return;
    }

    // Check if user has enough credits
    const required = SCAN_COSTS[type];
    if (!hasEnoughCredits(required)) {
      setShowInsufficientCredits(true);
      return;
    }

    setLoading(true);
    setTokenData(null);
    setElevatorData(null);
    setIsElevatorMode(false);
    
    try {
      // Deduct credits before scanning
      deductCredits(required);
      toast.success(`${required} credits deducted. Scanning...`);

      if (type === 'ELEVATOR') {
        const res = await startElevatorScan(addr, 'evm', 'neutral');
        if (res.jobId === 'cached') {
          setElevatorData(res.data);
          setIsElevatorMode(true);
          setLoading(false);
          return;
        }
        
        // Poll for results
        const interval = setInterval(async () => {
          try {
            const statusRes = await getElevatorJobStatus(res.jobId);
            if (statusRes.status === 'completed') {
              clearInterval(interval);
              setElevatorData(statusRes.data);
              setIsElevatorMode(true);
              setLoading(false);
            }
          } catch (e) {
            clearInterval(interval);
            setLoading(false);
            toast.error('Job polling failed: ' + (e as Error).message);
          }
        }, 1000);
      } else {
        const data = await getBasicScan(addr, 'evm');
        setTokenData(data as any);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error scanning');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation onOpenCreditStore={() => setShowCreditStore(true)} />
      
      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-24">
        {/* Scan Terminal */}
        <section className="pt-24 pb-12">
          <div className="max-w-4xl mx-auto rgb-border">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-1 rounded-2xl"
            >
              <div className="p-4 md:p-8 space-y-6 md:space-y-8 bg-slate-950/40 rounded-2xl backdrop-blur-2xl">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black italic uppercase">Acquire Target</h2>
                  <p className="text-slate-400 text-xs md:text-sm">Enter a Token Contract Address to initiate on-chain reconnaissance.</p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 justify-center mb-4">
                  <div className="flex bg-slate-900 rounded-lg p-1 border border-white/10 inline-flex mx-auto">
                    <button 
                      onClick={() => setScanType('BASIC')}
                      className={`px-6 py-2 text-xs font-bold rounded-md transition-all ${scanType === 'BASIC' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Basic Scan
                    </button>
                    <button 
                      onClick={() => setScanType('ELEVATOR')}
                      className={`px-6 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${scanType === 'ELEVATOR' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      <Database className="w-3 h-3" /> Elevator Deep Scan
                    </button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <div className={`flex-1 rgb-border ${loading ? 'opacity-80' : ''}`}>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                        <Search className="w-5 h-5" />
                      </div>
                      <input 
                        type="text" 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && address && !loading) {
                            handleScan(address, scanType);
                          }
                        }}
                        disabled={loading}
                        placeholder="Paste Token Contract Address (0x...)"
                        className={`w-full bg-slate-950 rounded-xl py-3 md:py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono text-xs md:text-sm transition-all shadow-inner border-0 ${loading ? 'animate-terminal-flicker' : ''}`}
                      />
                    </div>
                  </div>
                  {address.trim().length > 0 && (
                    <div className="rgb-border">
                      <button 
                        type="button"
                        disabled={loading}
                        onClick={() => handleScan(address, scanType)}
                        className={`font-bold px-6 md:px-8 py-3 md:py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-sm md:text-base w-full ${loading ? 'bg-primary-900 text-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-500 text-white active:scale-95'}`}
                      >
                        <Zap className={`w-4 h-4 md:w-5 md:h-5 ${loading ? 'animate-pulse' : ''}`} />
                        {loading ? 'SCANNING...' : 'Scan'}
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Cost Display */}
                {isAuthenticated && (
                  <div className="text-center text-sm">
                    <span className="text-slate-400">Cost: </span>
                    <span className="text-primary-400 font-bold">{SCAN_COSTS[scanType]} credits ⚡</span>
                    <span className="text-slate-500 mx-2">|</span>
                    <span className="text-slate-400">Your Balance: </span>
                    <span className={`font-bold ${balance.balance >= SCAN_COSTS[scanType] ? 'text-green-400' : 'text-red-400'}`}>
                      {balance.balance} credits
                    </span>
                  </div>
                )}
                <div className="border-t border-white/5 pt-4 md:pt-6">
                  <p className="text-[10px] md:text-xs text-slate-400 text-center leading-relaxed">
                    <span className="font-bold text-slate-300">Disclaimer:</span> This platform provides analytical tools for informational purposes only. 
                    Data may contain inaccuracies or delays. Always conduct your own research and due diligence. 
                    This is not financial, investment, or trading advice. Cryptocurrency investments carry significant risk.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-12 flex flex-col items-center justify-center space-y-8"
          >
            <div className="relative w-32 h-32">
              <motion.div 
                className="absolute inset-0 border-4 border-primary-500/20 border-t-primary-600 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Cpu className="w-10 h-10 text-primary-500 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black italic uppercase text-primary-500">Scanning Blockchain...</h3>
              <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest animate-pulse">
                {isElevatorMode ? 'Deep Analysis In Progress...' : 'Establishing Secure Link...'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Basic Scan Results */}
        {tokenData && !isElevatorMode && (
          <div className="space-y-6">
            <TokenOverviewCard token={tokenData} />
            <AdvancedRiskMetricsCard token={tokenData} />
            <TokenAuditCard token={tokenData} />
            <MarketIntelligenceCard token={tokenData} />
            <RecentTransactionsCard token={tokenData} />
          </div>
        )}

        {/* Elevator Scan Results */}
        {elevatorData && isElevatorMode && (
          <div className="space-y-6">
            <ElevatorResultCard data={elevatorData} />
          </div>
        )}

        {/* Network Health Stats - Always Show */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          <div className="rgb-border">
            <div className="glass-card p-6 rounded-2xl">
              <Clock className="w-5 h-5 text-blue-400 mb-4" />
              <h4 className="text-xs font-black uppercase text-slate-300">Network Epoch</h4>
              <p className="text-xl font-bold font-mono text-slate-100">{tokenData?.networkHealth?.lastBlock || 'Awaiting...'}</p>
            </div>
          </div>
          <div className="rgb-border">
            <div className="glass-card p-6 rounded-2xl">
              <Database className="w-5 h-5 text-purple-400 mb-4" />
              <h4 className="text-xs font-black uppercase text-slate-300">Block Reward</h4>
              <p className="text-xl font-bold font-mono text-slate-100 truncate">{tokenData?.networkHealth?.blockReward || 'Awaiting...'}</p>
            </div>
          </div>
          <div className="rgb-border">
            <div className="glass-card p-6 rounded-2xl">
              <ExternalLink className="w-5 h-5 text-pink-400 mb-4" />
              <h4 className="text-xs font-black uppercase text-slate-300">Exchanges Scanned</h4>
              <p className="text-xl font-bold font-mono text-slate-100">
                {tokenData?.liquidityInfo?.mainPools 
                  ? `${new Set(tokenData.liquidityInfo.mainPools.map(p => p.dex)).size} Global DEX(s)` 
                  : (tokenData ? '0 Active' : 'Awaiting...')}
              </p>
            </div>
          </div>
          <div className="rgb-border">
            <div className="glass-card p-6 rounded-2xl">
              <Target className="w-5 h-5 text-cyan-400 mb-4" />
              <h4 className="text-xs font-black uppercase text-slate-300">Scan Status</h4>
              <p className="text-xl font-bold font-mono text-slate-100">{tokenData || elevatorData ? 'Complete' : 'Awaiting...'}</p>
            </div>
          </div>
        </section>
      </main>

      {/* Credit Store Modal */}
      <CreditStoreModal
        isOpen={showCreditStore}
        onClose={() => setShowCreditStore(false)}
      />

      {/* Insufficient Credits Modal */}
      <InsufficientCreditsModal
        isOpen={showInsufficientCredits}
        onClose={() => setShowInsufficientCredits(false)}
        onBuyCredits={() => {
          setShowInsufficientCredits(false);
          setShowCreditStore(true);
        }}
        scanType={scanType}
        currentBalance={balance.balance}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Cpu className="w-12 h-12 text-primary-500 animate-pulse mx-auto" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}

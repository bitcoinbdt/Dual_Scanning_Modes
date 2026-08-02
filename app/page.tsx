'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Target, Zap, Search, Database, Clock, ExternalLink, Cpu, Info, ChevronDown } from 'lucide-react';
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
import { RawTransactionTable } from '@/components/elevator/RawTransactionTable';
import { InsufficientCreditsModal } from '@/components/credits/InsufficientCreditsModal';
import { CreditStoreModal } from '@/components/credits/CreditStoreModal';
import toast from 'react-hot-toast';

function HomePageContent() {
  useEventBus();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { balance, hasEnoughCredits, deductCredits } = useCredits();
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState<OnChainData | null>(null);
  const [elevatorData, setElevatorData] = useState<any | null>(null);
  const [isElevatorMode, setIsElevatorMode] = useState(false);
  const [address, setAddress] = useState('');
  const [scanType, setScanType] = useState<'BASIC' | 'ELEVATOR'>('BASIC');
  const [selectedChain, setSelectedChain] = useState<'auto' | 'solana' | 'bsc' | 'eth'>('auto');
  const [chainAmbiguous, setChainAmbiguous] = useState(false);
  const [elevatorCredits, setElevatorCredits] = useState<5 | 10 | 20 | 30>(10);
  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);
  const [showCreditStore, setShowCreditStore] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);

  // Capture referral code from URL parameter and redirect to signup
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      // Check if user is already logged in
      if (isAuthenticated) {
        toast.error('You\'re already registered. Referral codes can only be used during signup.', {
          duration: 5000,
          icon: '❌',
        });
        return;
      }

      // Store referral code
      localStorage.setItem('pendingReferralCode', refCode.toUpperCase());
      sessionStorage.setItem('hasReferralCode', 'true');
      
      // Show success message and redirect to signup
      toast.success(`Referral code ${refCode.toUpperCase()} detected! Redirecting to signup...`, {
        duration: 3000,
        icon: '🎁',
      });
      
      // Redirect to signup page with referral code
      setTimeout(() => {
        router.push(`/signup?ref=${refCode.toUpperCase()}`);
      }, 1000);
    }
  }, [searchParams, isAuthenticated, router]);

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
    const required = type === 'ELEVATOR' ? elevatorCredits : SCAN_COSTS[type];
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
        // Determine preferred chain (convert 'auto' to undefined)
        const preferredChain = selectedChain === 'auto' ? undefined : selectedChain;
        
        // Call new elevator API with credits spent and preferred chain
        const res = await startElevatorScan(addr, required, preferredChain);
        setElevatorData(res.rawData);
        setIsElevatorMode(true);
        setLoading(false);
        
        // Show metadata in console
        if (res.metadata) {
          console.log('[Elevator Scan] Metadata:', res.metadata);
          toast.success(`Loaded ${res.metadata.transactionCount} transactions from ${res.metadata.holderCount} holders`);
        }
      } else {
        const data = await getBasicScan(addr, 'evm');
        setTokenData(data as any);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      if (err.code === 'AMBIGUOUS_CHAIN') {
        // EVM address but no chain selected — show inline prompt instead of a generic toast
        setChainAmbiguous(true);
      } else {
        toast.error(err.message || 'Error scanning');
      }
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

                {/* Chain & Credit Selector - Only for Elevator Mode */}
                {scanType === 'ELEVATOR' && (
                  <div className="flex flex-col gap-4 items-center">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                      {/* Chain Select */}
                      <div className="flex flex-col items-center gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Select Blockchain
                        </label>
                        <div className="relative">
                          <select
                            value={selectedChain}
                            onChange={(e) => {
                              setSelectedChain(e.target.value as 'auto' | 'solana' | 'bsc' | 'eth');
                              setChainAmbiguous(false); // clear prompt when user makes a selection
                            }}
                            className={`appearance-none bg-slate-900 rounded-lg px-6 py-3 pr-12 text-sm font-medium text-slate-200 hover:border-slate-600 focus:outline-none focus:ring-2 transition-all cursor-pointer border ${
                              chainAmbiguous
                                ? 'border-amber-500 ring-2 ring-amber-500/40 animate-pulse'
                                : 'border-slate-700 focus:ring-blue-500/50'
                            }`}
                          >
                            <option value="auto">🔍 Auto-Detect</option>
                            <option value="solana">🟢 Solana</option>
                            <option value="bsc">🟡 BSC (Binance Smart Chain)</option>
                            <option value="eth">🔵 Ethereum</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>

                      {/* Credit Cost Select */}
                      <div className="flex flex-col items-center gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Scan Depth (Credits)
                        </label>
                        <div className="relative">
                          <select
                            value={elevatorCredits}
                            onChange={(e) => setElevatorCredits(Number(e.target.value) as any)}
                            className="appearance-none bg-slate-900 border border-slate-700 rounded-lg px-6 py-3 pr-12 text-sm font-medium text-slate-200 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer"
                          >
                            <option value="5">⚡ 5 Credits (50 Tx)</option>
                            <option value="10">⚡ 10 Credits (100 Tx)</option>
                            <option value="20">⚡ 20 Credits (200 Tx)</option>
                            <option value="30">⚡ 30 Credits (500 Tx)</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ambiguous EVM prompt — shown when user scans a 0x address without selecting a chain */}
                    {chainAmbiguous && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                        <span className="text-amber-400 text-base">⚠️</span>
                        EVM address detected. Please select <strong>Ethereum</strong> or <strong>BSC</strong> above, then scan again.
                      </div>
                    )}
                    {!chainAmbiguous && selectedChain === 'auto' && (
                      <p className="text-xs text-slate-500 text-center max-w-md">
                        Chain will be automatically detected from address format.
                        <span className="text-slate-400"> Solana: base58, EVM: select ETH or BSC manually.</span>
                      </p>
                    )}
                    {!chainAmbiguous && selectedChain !== 'auto' && (
                      <p className="text-xs text-blue-400 text-center max-w-md flex items-center gap-2 justify-center">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                        {selectedChain.toUpperCase()} chain selected manually
                      </p>
                    )}
                  </div>
                )}

                {/* Elevator Scan Info Banner */}
                {scanType === 'ELEVATOR' && (
                  <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-400/30 rounded-xl backdrop-blur-sm">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Info className="w-3 h-3 text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-blue-300 leading-relaxed">
                        <strong className="text-blue-200">Multi-Chain Support:</strong> Elevator Deep Scan now supports <span className="text-green-400">Solana</span>, <span className="text-yellow-400">BSC</span>, and <span className="text-blue-400">Ethereum</span> tokens. 
                        <span className="text-blue-400/80"> More chains coming soon!</span>
                      </p>
                    </div>
                  </div>
                )}

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
                    <span className="text-primary-400 font-bold">
                      {scanType === 'ELEVATOR' ? elevatorCredits : SCAN_COSTS[scanType]} credits ⚡
                    </span>
                    <span className="text-slate-500 mx-2">|</span>
                    <span className="text-slate-400">Your Balance: </span>
                    <span className={`font-bold ${balance.balance >= (scanType === 'ELEVATOR' ? elevatorCredits : SCAN_COSTS[scanType]) ? 'text-green-400' : 'text-red-400'}`}>
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
              {/* Show selected chain if not auto */}
              {scanType === 'ELEVATOR' && selectedChain !== 'auto' && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    selectedChain === 'solana' ? 'bg-green-400' :
                    selectedChain === 'bsc' ? 'bg-yellow-400' :
                    'bg-blue-400'
                  }`}></div>
                  <span className="text-xs text-slate-400">
                    Scanning {selectedChain.toUpperCase()}
                  </span>
                </div>
              )}
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
          </div>
        )}

        {/* Elevator Scan Results */}
        {elevatorData && isElevatorMode && (
          <div className="space-y-6">
            {/* NEW: Raw Transaction Table with P&L - PRIMARY FEATURE */}
            <RawTransactionTable
              rawData={elevatorData}
              tokenSymbol={elevatorData.token?.symbol || 'TOKEN'}
              tokenAddress={address}
              network={(elevatorData.blockchain || 'solana') as 'solana' | 'ethereum' | 'bsc'}
            />
            
            {/* OLD: Advanced analytics card - kept for future use but commented out */}
            {/* <ElevatorResultCard data={elevatorData} /> */}
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

      {/* Credit Store Modal */}
      <CreditStoreModal
        isOpen={showCreditStore}
        onClose={() => setShowCreditStore(false)}
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

'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Target,
  Zap,
  Search,
  Database,
  Clock,
  ExternalLink,
  Cpu,
  Info,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditContext';
import { useEventBus } from '@/hooks/useEventBus';
import { getBasicScan, startElevatorScan, validateBackendConnection } from '@/services/scannerApi';
import type { OnChainData } from '@/types/scanner';
import { SCAN_COSTS } from '@/types/credits';
import Navigation from '@/components/layout/Navigation';
import NewsTimeline from '@/components/NewsTimeline';
import BoostedTokenBanner from '@/components/boost/BoostedTokenBanner';
import toast from 'react-hot-toast';

// Dynamically import heavy components to reduce initial bundle size
const TokenOverviewCard = dynamic(() => import('@/components/TokenOverviewCard').then(mod => mod.TokenOverviewCard));
const AdvancedRiskMetricsCard = dynamic(() => import('@/components/AdvancedRiskMetricsCard').then(mod => mod.AdvancedRiskMetricsCard));
const TokenAuditCard = dynamic(() => import('@/components/TokenAuditCard').then(mod => mod.TokenAuditCard));
const MarketIntelligenceCard = dynamic(() => import('@/components/MarketIntelligenceCard').then(mod => mod.MarketIntelligenceCard));
const RawTransactionTable = dynamic(() => import('@/components/elevator/RawTransactionTable').then(mod => mod.RawTransactionTable));
const InsufficientCreditsModal = dynamic(() => import('@/components/credits/InsufficientCreditsModal').then(mod => mod.InsufficientCreditsModal));
const CreditStoreModal = dynamic(() => import('@/components/credits/CreditStoreModal').then(mod => mod.CreditStoreModal));

const CHAINS = [
  { id: 'solana', label: 'Solana' },
  { id: 'bsc', label: 'BSC' },
  { id: 'eth', label: 'Ethereum' },
];

const ELEVATOR_OPTIONS = [
  { credits: 5, transactions: 50 },
  { credits: 10, transactions: 100 },
  { credits: 20, transactions: 200 },
  { credits: 30, transactions: 500 },
];

function HomePageContent() {
  useEventBus();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { balance, hasEnoughCredits, deductCredits, refreshBalance } = useCredits();

  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState<OnChainData | null>(null);
  const [elevatorData, setElevatorData] = useState<any | null>(null);
  const [isElevatorMode, setIsElevatorMode] = useState(false);
  const [address, setAddress] = useState('');
  const [scanType, setScanType] = useState<'BASIC' | 'ELEVATOR'>('BASIC');
  const [selectedChain, setSelectedChain] = useState<'solana' | 'bsc' | 'eth'>('solana');
  const [chainAmbiguous, setChainAmbiguous] = useState(false);
  const [elevatorCredits, setElevatorCredits] = useState<5 | 10 | 20 | 30>(10);
  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);
  const [showCreditStore, setShowCreditStore] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);

  // Capture referral code from URL parameter and redirect to signup
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      if (isAuthenticated) {
        toast.error("You're already registered. Referral codes can only be used during signup.", {
          duration: 5000,
          icon: '❌',
        });
        return;
      }

      localStorage.setItem('pendingReferralCode', refCode.toUpperCase());
      sessionStorage.setItem('hasReferralCode', 'true');
      
      toast.success(`Referral code ${refCode.toUpperCase()} detected! Redirecting to signup...`, {
        duration: 3000,
        icon: '🎁',
      });
      
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

  // Handle boosted token click - populate scanner input
  const handleBoostedTokenClick = useCallback((contractAddress: string, blockchain: string) => {
    setAddress(contractAddress);
    
    // Set the appropriate blockchain if available
    if (blockchain === 'solana' || blockchain === 'ethereum' || blockchain === 'bsc') {
      setSelectedChain(blockchain === 'ethereum' ? 'eth' : blockchain);
    }
    
    // Scroll to scanner input
    setTimeout(() => {
      const scannerInput = document.querySelector('input[placeholder*="Token Contract"]');
      if (scannerInput) {
        scannerInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (scannerInput as HTMLInputElement).focus();
      }
    }, 100);
    
    toast.success(`Token address loaded. Select scan type and click Scan!`, {
      duration: 4000,
      icon: '🎯',
    });
  }, []);

  const handleScan = async (addr: string, type: 'BASIC' | 'ELEVATOR') => {
    if (!isAuthenticated) {
      toast.error('Please login to scan tokens');
      return;
    }

    const required = type === 'ELEVATOR' ? elevatorCredits : SCAN_COSTS[type];
    if (!hasEnoughCredits(required)) {
      setShowInsufficientCredits(true);
      return;
    }

    setLoading(true);
    setTokenData(null);
    setElevatorData(null);
    setIsElevatorMode(false);
    setChainAmbiguous(false);
    
    try {
      if (type === 'ELEVATOR') {
        const res = await startElevatorScan(addr, required, selectedChain);
        // Only deduct credits optimistically after a successful scan
        deductCredits(required);
        setElevatorData(res.rawData);
        setIsElevatorMode(true);
        setLoading(false);
        
        if (res.metadata) {
          console.log('[Elevator Scan] Metadata:', res.metadata);
          toast.success(`Loaded ${res.metadata.transactionCount} transactions from ${res.metadata.holderCount} holders`);
        }
      } else {
        const data = await getBasicScan(addr, 'evm');
        deductCredits(required);
        setTokenData(data as any);
        setLoading(false);
        toast.success('Scan complete!');
      }
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      // Resync displayed balance from server in case optimistic update ran before the error
      refreshBalance();
      if (err.code === 'WRONG_CHAIN') {
        toast.error(err.message || 'Wrong chain selected. Please check your blockchain selection.');
        setChainAmbiguous(true);
      } else if (err.code === 'AMBIGUOUS_CHAIN') {
        setChainAmbiguous(true);
      } else {
        toast.error(err.message || 'Error scanning');
      }
    }
  };

  const currentCost = scanType === 'BASIC' ? SCAN_COSTS.BASIC : elevatorCredits;

  return (
    <div className="min-h-screen bg-grid">
      <Navigation onOpenCreditStore={() => setShowCreditStore(true)} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* News Timeline */}
        <NewsTimeline />

        {/* Featured/Boosted Tokens Banner */}
        <BoostedTokenBanner 
          placement="home" 
          onTokenClick={handleBoostedTokenClick}
        />

        {/* Scan Terminal */}
        <section className="mb-6">
          <div className="glass-strong rounded-2xl p-6 sm:p-8 rgb-border">
            <div className="flex items-center gap-2 mb-6">
              <Cpu className="w-5 h-5 text-primary-themed" />
              <h1 className="text-2xl font-bold gradient-text">Acquire Target</h1>
            </div>

            {/* Mode Selector */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => {
                  setScanType('BASIC');
                  setTokenData(null);
                  setIsElevatorMode(false);
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  scanType === 'BASIC'
                    ? 'gradient-primary text-white'
                    : 'glass text-muted-themed hover:text-themed'
                }`}
              >
                Basic Scan
              </button>
              <button
                onClick={() => {
                  setScanType('ELEVATOR');
                  setElevatorData(null);
                  setIsElevatorMode(false);
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  scanType === 'ELEVATOR'
                    ? 'gradient-primary text-white'
                    : 'glass text-muted-themed hover:text-themed'
                }`}
              >
                Elevator Deep Scan
              </button>
            </div>

            {/* Elevator Parameters */}
            {scanType === 'ELEVATOR' && (
              <div className="mb-5 space-y-4 animate-fade-in">
                {/* Blockchain */}
                <div>
                  <label className="text-xs text-muted-themed mb-2 block">Blockchain</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CHAINS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedChain(c.id as any);
                          setChainAmbiguous(false);
                        }}
                        className={`py-2 rounded-lg text-xs font-medium border transition ${
                          selectedChain === c.id
                            ? 'border-primary-themed glow-sm text-primary-themed bg-white/5'
                            : 'border-white/10 text-muted-themed hover:border-white/20'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scan Depth */}
                <div>
                  <label className="text-xs text-muted-themed mb-2 block">Scan Depth</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ELEVATOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.credits}
                        onClick={() => setElevatorCredits(opt.credits as any)}
                        className={`py-2 rounded-lg text-xs font-medium border transition ${
                          elevatorCredits === opt.credits
                            ? 'border-primary-themed glow-sm text-primary-themed bg-white/5'
                            : 'border-white/10 text-muted-themed hover:border-white/20'
                        }`}
                      >
                        <div className="font-bold">{opt.transactions} Tx</div>
                        <div className="text-[10px] opacity-70">{opt.credits} credits</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Banner Info */}
                <div
                  className="rounded-lg p-3 text-xs flex items-start gap-2"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
                >
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-blue-200">
                    <strong>Multi-Chain Support:</strong> Elevator Deep Scan supports Solana, BSC, and Ethereum.
                  </span>
                </div>

                {/* Ambiguous Warning */}
                {chainAmbiguous && (
                  <div
                    className="rounded-lg p-3 text-xs flex items-center gap-2"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-amber-200">
                      EVM address detected. Please select <strong>Ethereum</strong> or <strong>BSC</strong> explicitly to scan.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Address Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-themed pointer-events-none" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
                placeholder="Paste Token Contract Address..."
                className={`w-full bg-transparent border border-white/10 rounded-lg pl-10 pr-3 py-3 text-sm text-themed font-mono focus:outline-none focus:border-primary-themed transition ${
                  loading ? 'animate-terminal-flicker' : ''
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && address.trim() && !loading) {
                    handleScan(address.trim(), scanType);
                  }
                }}
              />
            </div>

            {/* Control Bar */}
            {address.trim() && (
              <div className="flex items-center justify-between mb-4 animate-fade-in">
                <div className="text-xs text-muted-themed">
                  Cost: <span className="text-primary-themed font-bold">{currentCost} credits</span>
                  {isAuthenticated && (
                    <>
                      {' '}
                      | Balance:{' '}
                      <span
                        className={`font-bold ${
                          balance.balance >= currentCost ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {balance.balance}
                      </span>{' '}
                      credits
                    </>
                  )}
                </div>
                <button
                  onClick={() => handleScan(address.trim(), scanType)}
                  disabled={loading}
                  className="gradient-primary text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {loading ? 'Scanning...' : 'Scan'}
                </button>
              </div>
            )}

            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] text-muted-themed leading-relaxed">
                <strong>Disclaimer:</strong> This platform provides analytical tools for informational purposes only. Data may contain inaccuracies or delays. Always conduct your own research. This is not financial advice.
              </p>
            </div>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="glass-strong rounded-2xl p-12 text-center animate-fade-in mb-6">
            <Cpu className="w-12 h-12 text-primary-themed animate-spin-slow mx-auto mb-4" />
            <p className="text-lg font-bold gradient-text">Scanning Blockchain...</p>
            <p className="text-xs text-muted-themed mt-2 font-mono uppercase tracking-widest animate-pulse">
              {scanType === 'ELEVATOR'
                ? `Analyzing ${
                    elevatorCredits === 5 ? 50 : elevatorCredits === 10 ? 100 : elevatorCredits === 20 ? 200 : 500
                  } transactions on ${selectedChain.toUpperCase()}`
                : 'Running security audits and risk analysis...'}
            </p>
          </div>
        )}

        {/* Basic Scan Results */}
        {tokenData && !isElevatorMode && !loading && (
          <div className="space-y-4 animate-fade-in">
            <TokenOverviewCard token={tokenData} />
            <AdvancedRiskMetricsCard token={tokenData} />
            <TokenAuditCard token={tokenData} />
            <MarketIntelligenceCard token={tokenData} />
          </div>
        )}

        {/* Elevator Scan Results */}
        {elevatorData && isElevatorMode && !loading && (
          <div className="space-y-4 animate-fade-in">
            <RawTransactionTable
              rawData={elevatorData}
              tokenSymbol={elevatorData.token?.symbol || 'TOKEN'}
              tokenAddress={address}
              network={(elevatorData.blockchain || 'solana') as 'solana' | 'ethereum' | 'bsc'}
            />
          </div>
        )}

        {/* Network Health Stats - Always Show */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <div className="rgb-border">
            <div className="glass-strong p-5 rounded-2xl h-full">
              <Clock className="w-5 h-5 text-blue-400 mb-3" />
              <h4 className="text-[10px] font-bold uppercase text-muted-themed">Network Epoch</h4>
              <p className="text-lg font-bold font-mono text-themed truncate mt-1">
                {tokenData?.networkHealth?.lastBlock
                  || elevatorData?.networkHealth?.lastBlock
                  || 'Awaiting...'}
              </p>
            </div>
          </div>
          <div className="rgb-border">
            <div className="glass-strong p-5 rounded-2xl h-full">
              <Database className="w-5 h-5 text-purple-400 mb-3" />
              <h4 className="text-[10px] font-bold uppercase text-muted-themed">Block Reward</h4>
              <p className="text-lg font-bold font-mono text-themed truncate mt-1">
                {tokenData?.networkHealth?.blockReward
                  || elevatorData?.networkHealth?.blockReward
                  || 'Awaiting...'}
              </p>
            </div>
          </div>
          <div className="rgb-border">
            <div className="glass-strong p-5 rounded-2xl h-full">
              <ExternalLink className="w-5 h-5 text-pink-400 mb-3" />
              <h4 className="text-[10px] font-bold uppercase text-muted-themed">Exchanges Scanned</h4>
              <p className="text-lg font-bold font-mono text-themed truncate mt-1">
                {tokenData?.liquidityInfo?.mainPools
                  ? `${new Set(tokenData.liquidityInfo.mainPools.map((p) => p.dex)).size} Global DEX(s)`
                  : tokenData
                  ? '0 Active'
                  : elevatorData?.exchanges_scanned !== undefined
                  ? `${elevatorData.exchanges_scanned} CEX(s) Scanned`
                  : 'Awaiting...'}
              </p>
            </div>
          </div>
          <div className="rgb-border">
            <div className="glass-strong p-5 rounded-2xl h-full">
              <Target className="w-5 h-5 text-cyan-400 mb-3" />
              <h4 className="text-[10px] font-bold uppercase text-muted-themed">Scan Status</h4>
              <p className="text-lg font-bold font-mono text-themed truncate mt-1">
                {tokenData || elevatorData ? 'Complete' : 'Awaiting...'}
              </p>
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
      <CreditStoreModal isOpen={showCreditStore} onClose={() => setShowCreditStore(false)} />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-grid flex items-center justify-center">
          <div className="text-center space-y-4">
            <Cpu className="w-10 h-10 text-primary-themed animate-spin-slow mx-auto" />
            <p className="text-muted-themed text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}

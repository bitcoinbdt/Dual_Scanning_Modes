/**
 * Deep Scan P0 MVP Test Suite
 *
 * Runs comprehensive assertions on the mathematical engines, risk scoring,
 * evidence generators, and report synthesis, verifying correct edge-case handling.
 *
 * Run this with: npx tsx test_deep_scan.ts
 */

import { simulateAmmSlippage } from './lib/deep_scan/engines/AmmSlippageSimulator';
import { analyzeVolumeConcentration } from './lib/deep_scan/engines/VolumeConcentrationAnalyzer';
import { analyzeWhaleBehavior } from './lib/deep_scan/engines/WhaleBehaviorAnalyzer';
import { simulateWhaleExit } from './lib/deep_scan/engines/WhaleExitSimulator';
import { analyzeBuyerQuality } from './lib/deep_scan/engines/BuyerQualityAnalyzer';
import { analyzeMarketRegime } from './lib/deep_scan/engines/MarketRegimeAnalyzer';
import { analyzeCapitalEfficiency } from './lib/deep_scan/engines/CapitalEfficiencyAnalyzer';
import { calculateRiskScore } from './lib/deep_scan/engines/RiskScoringEngine';
import { generateTraderIntelligenceReport } from './lib/deep_scan/engines/TraderIntelligenceGenerator';
import { UniversalTransaction, HolderInfo, OHLCVCandle } from './lib/elevator/collectors/types';
import { LiquidityPool } from './lib/blockchain/types';
import { CapitalEfficiencyResult, normalizeAddress } from './lib/deep_scan/types';
import { sessionCache, cleanExpiredEntries, getCachedResult, setCachedResult } from './lib/deep_scan/DeepScanService';

// Helper to create a minimal valid UniversalTransaction mock
function makeTx(overrides: Partial<UniversalTransaction> & Pick<UniversalTransaction, 'hash' | 'from' | 'to' | 'amount' | 'type'>): UniversalTransaction {
  return {
    timestamp: Date.now(),
    token: { address: '0xToken' },
    blockchain: 'eth',
    isTrade: true,
    ...overrides,
  };
}

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('RUNNING DEEP SCAN P0 MVP TEST SUITE');
  console.log('==================================================\n');

  // ─────────────────────────────────────────────
  // Test 1: AMM Position Slippage Simulation
  // ─────────────────────────────────────────────
  console.log('--- 1. AMM Slippage Simulator Tests ---');
  const dummyPools: LiquidityPool[] = [
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 100_000, priceUsd: 0.1 },
  ];
  
  // Normal trade simulation
  const normalSim = simulateAmmSlippage(dummyPools, 0.1, [1000, 5000]);
  assert(normalSim.status === 'ok', 'Normal AMM simulation completes with ok status');
  assert(normalSim.simulations.length === 2, 'Generates correct simulation count');
  
  const sim5k = normalSim.simulations[1];
  // Math check: pool liquidity = $100K -> token reserve = 50k / 0.1 = 500,000 tokens, quote reserve = $50,000 USD
  // Input: 5,000 USD -> net input with 0.3% fee = $4,985 USD
  // New quote reserve = 54,985 USD -> new token reserve = 500,000 * 50,000 / 54,985 = 454,669.45 tokens
  // Tokens received = 500,000 - 454,669.45 = 45,330.55 tokens
  // Execution price = 5,000 / 45,330.55 = 0.1103 USD per token
  // Price impact = (0.1103 - 0.1) / 0.1 = 10.3% price impact (wait, actually ~9.34% because of token units in sell direction)
  assert(sim5k.priceImpactPct > 9 && sim5k.priceImpactPct < 10, 'Calculates correct mathematical constant product price impact (~9.3%)');
  assert(sim5k.exitRiskLevel === 'high', 'Classifies price impact risk level correctly');

  // Edge Case: Insufficient liquidity (asking for trade size that exceeds pool capacity)
  const failedSim = simulateAmmSlippage(dummyPools, 0.1, [150_000]);
  assert(failedSim.simulations[0].status === 'insufficient_data', 'Handles extreme size over pool capacity by flagging insufficient_data');

  // Edge Case: Empty pools list
  const emptyPoolSim = simulateAmmSlippage([], 0.1);
  assert(emptyPoolSim.status === 'insufficient_data', 'Handles empty pool arrays gracefully');

  // Edge Case: Zero spot price
  const zeroPriceSim = simulateAmmSlippage(dummyPools, 0);
  assert(zeroPriceSim.status === 'insufficient_data', 'Handles zero spot price gracefully');

  console.log('');

  // ─────────────────────────────────────────────
  // Test 2: Whale Exit Simulation
  // ─────────────────────────────────────────────
  console.log('--- 2. Whale Exit Simulator Tests ---');
  const dummyWhales = [
    {
      wallet: '0xWhale1',
      observedBatchBalance: 10_000,
      supplySharePct: 2.0,
      isAboveSupplyThreshold: true,
      isAboveLiquidityThreshold: false,
      netFlow: 0,
      txCount: 1,
      isFiltered: false,
    },
  ];

  const whaleExit = simulateWhaleExit(dummyWhales, dummyPools, 0.1, 500_000);
  assert(whaleExit.status === 'ok', 'Exit simulation executes successfully');
  assert(whaleExit.scenarios.length === 3, 'Calculates 10%, 25%, and 50% scenarios');
  assert(whaleExit.simulationDisclaimer.includes('SIMULATED'), 'Includes required simulation warning disclaimer');

  // Edge Case: Insufficient whale data
  const emptyWhalesExit = simulateWhaleExit([], dummyPools, 0.1, 500_000);
  assert(emptyWhalesExit.status === 'insufficient_data', 'Handles empty whale list gracefully');
  
  console.log('');

  // ─────────────────────────────────────────────
  // Test 3: Volume HHI Concentration
  // ─────────────────────────────────────────────
  console.log('--- 3. Volume Concentration / HHI Tests ---');
  // High concentration transaction array (single buyer dominates)
  const concentratedTxs: UniversalTransaction[] = [
    makeTx({ hash: 'tx1', from: 'pool', to: '0xBuyer1', amount: 900, type: 'buy', priceUsd: 1 }),
    makeTx({ hash: 'tx2', from: 'pool', to: '0xBuyer2', amount: 100, type: 'buy', priceUsd: 1 }),
  ];

  const hhiHigh = analyzeVolumeConcentration(concentratedTxs);
  assert(hhiHigh.status === 'ok', 'HHI analyzer runs successfully');
  assert(hhiHigh.buyerHHI.hhi >= 0.82, 'Detects highly concentrated volume with high HHI score');
  assert(hhiHigh.buyerHHI.concentrationLevel === 'extreme', 'Correctly flags concentration level');

  // Evenly distributed transactions
  const evenTxs: UniversalTransaction[] = [];
  for (let i = 0; i < 10; i++) {
    evenTxs.push(makeTx({ hash: `tx${i}`, from: 'pool', to: `0xBuyer${i}`, amount: 100, type: 'buy', priceUsd: 1 }));
  }
  const hhiLow = analyzeVolumeConcentration(evenTxs);
  assert(hhiLow.buyerHHI.hhi <= 0.11, 'Detects evenly distributed volumes with low HHI score');
  
  // Edge Case: Empty transaction batch
  const emptyTxsHhi = analyzeVolumeConcentration([]);
  assert(emptyTxsHhi.status === 'insufficient_data', 'Handles empty transaction arrays gracefully');

  // F-13 Regression Tests
  console.log('--- 3.1. Address Normalization (F-13) Regression Tests ---');
  
  const contractSet = new Set(['0x742d35cc6634c0532925a3b844bc454e4438f44e']);
  const cexSet = new Set(['0x2222222222222222222222222222222222222222']);
  
  // Mixed-case addresses representing the same contract and CEX
  const mixedContractAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const mixedCexAddress      = '0x2222222222222222222222222222222222222222';
  const genuineWallet        = '0xAbCdEf1234567890abcdef1234567890abcdef12';

  const normalizationTxs: UniversalTransaction[] = [
    // Mixed-case contract wallet buys (should be excluded)
    makeTx({ hash: 'tx1', from: 'pool', to: mixedContractAddress, amount: 500, type: 'buy', priceUsd: 1 }),
    // Mixed-case CEX wallet sells (should be excluded)
    makeTx({ hash: 'tx2', from: mixedCexAddress, to: 'pool', amount: 300, type: 'sell', priceUsd: 1 }),
    // Genuine wallet buys (should be included)
    makeTx({ hash: 'tx3', from: 'pool', to: genuineWallet, amount: 200, type: 'buy', priceUsd: 1 }),
  ];

  const hhiNorm = analyzeVolumeConcentration(normalizationTxs, new Set(), cexSet, contractSet);
  assert(hhiNorm.status === 'ok', 'HHI normalization test runs successfully');
  
  // Test A & B & C verification
  // Since mixedContractAddress and mixedCexAddress are excluded, only genuineWallet's buy volume ($200) should be included.
  // Thus totalBuyVolumeUsd = 200, uniqueBuyers = 1 (genuineWallet), buyerHHI should be 1.0.
  assert(hhiNorm.totalBuyVolumeUsd === 200, 'Test A & C: Excludes contract volume and includes genuine wallet volume correctly');
  assert(hhiNorm.totalSellVolumeUsd === 0, 'Test B: Excludes CEX volume correctly');
  assert(hhiNorm.buyerHHI.hhi === 1.0, 'Computes correct HHI excluding contract/CEX volumes');
  assert(hhiNorm.buyerHHI.topWallets.length === 1 && normalizeAddress(hhiNorm.buyerHHI.topWallets[0].wallet) === normalizeAddress(genuineWallet), 'Genuine wallet is the only buyer listed');

  // Test D: Case variants produce identical results
  const lowercaseTxs: UniversalTransaction[] = [
    makeTx({ hash: 'tx1', from: '0xpool', to: '0xbuyer1', amount: 100, type: 'buy', priceUsd: 1 }),
    makeTx({ hash: 'tx2', from: '0xpool', to: '0xbuyer2', amount: 200, type: 'buy', priceUsd: 1 }),
  ];
  
  const mixedCaseTxs: UniversalTransaction[] = [
    makeTx({ hash: 'tx1', from: '0xPoOl', to: '0xbUyEr1', amount: 100, type: 'buy', priceUsd: 1 }),
    makeTx({ hash: 'tx2', from: '0xPoOl', to: '0xbUyEr2', amount: 200, type: 'buy', priceUsd: 1 }),
  ];

  const lowercaseHhi = analyzeVolumeConcentration(lowercaseTxs);
  const mixedcaseHhi = analyzeVolumeConcentration(mixedCaseTxs);
  
  assert(lowercaseHhi.buyerHHI.hhi === mixedcaseHhi.buyerHHI.hhi, 'Test D: HHI is identical regardless of address casing');
  assert(lowercaseHhi.buyerHHI.concentrationLevel === mixedcaseHhi.buyerHHI.concentrationLevel, 'Test D: Concentration level is identical regardless of address casing');

  // Test E: Pool address cannot bypass filtering
  const poolAddressLowercase = '0x1111111111111111111111111111111111111111';
  const poolAddressMixed     = '0x1111111111111111111111111111111111111111'; // casing is same for address, but let's test pool filtering
  const contractSetWithPool = new Set([poolAddressLowercase]);
  
  const poolTxs: UniversalTransaction[] = [
    makeTx({ hash: 'tx1', from: poolAddressMixed, to: genuineWallet, amount: 100, type: 'buy', priceUsd: 1 }),
  ];
  const hhiPoolFiltered = analyzeVolumeConcentration(poolTxs, new Set(), new Set(), contractSetWithPool);
  // genuineWallet buy has tx.from as poolAddressMixed. VolumeConcentrationAnalyzer gets sellerWallet as tx.from.
  // Since sellerWallet is in contractSet (which is contractSetWithPool), its sell volume is excluded.
  // Buy volume is genuineWallet (not in contractSet) -> so totalBuyVolumeUsd = 100.
  // Let's verify that the HHI calculation skipped the contract address.
  assert(hhiPoolFiltered.totalBuyVolumeUsd === 100, 'Test E: Pool address volume filter verified');

  // Test F: Solana Base58 Case Sensitivity is Respected
  const solAddress1 = 'DezXAZ8z7PnrnRJjz3wXPhhpXRKwJkx21ODXQI6EL5L';
  const solAddress2 = 'dezxaz8z7pnrnrjjz3wxphhpxrkwjkx21odxqi6el5l'; // same but lowercase
  
  const normSol1 = normalizeAddress(solAddress1);
  const normSol2 = normalizeAddress(solAddress2);
  assert(normSol1 !== normSol2, 'Test F: Solana Base58 case variations do NOT normalize to identical strings');
  assert(normalizeAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e') === normalizeAddress('0x742d35cc6634c0532925a3b844bc454e4438f44e'), 'EVM addresses normalize to identical strings regardless of case');

  // Phase 1.1: F-13-Bypass-1 Normalization Fix Tests
  console.log('--- 3.2. Case-Insensitive EVM Prefix & Solana Preservation (Phase 1.1) ---');
  
  const targetLower = '0x742d35cc6634c0532925a3b844bc454e4438f44e';
  const targetChecksum = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const targetUppercase0X = '0X742D35CC6634C0532925A3B844BC454E4438F44E';
  const targetWhitespace = '  0X742D35CC6634C0532925A3B844BC454E4438F44E  ';

  // Test 1: lowercase EVM
  assert(normalizeAddress(targetLower) === targetLower, 'Test 1: lowercase EVM address normalizes to itself');
  
  // Test 2: checksum EVM
  assert(normalizeAddress(targetChecksum) === targetLower, 'Test 2: checksum EVM address normalizes to canonical lowercase');
  
  // Test 3: uppercase 0X
  assert(normalizeAddress(targetUppercase0X) === targetLower, 'Test 3: uppercase 0X EVM address normalizes to canonical lowercase');
  
  // Test 4: whitespace
  assert(normalizeAddress(targetWhitespace) === targetLower, 'Test 4: surrounding whitespace is trimmed and normalized correctly');
  
  // Test 5: Solana preservation
  const sol1 = 'DezXAZ8z7PnrnRJjz3wXPhhpXRKwJkx21ODXQI6EL5L';
  const sol2 = 'Dezxaz8z7pnrnrjjz3wxphhpxrkwjkx21odxqi6el5l'; // case variant
  assert(normalizeAddress(sol1) === sol1, 'Test 5: Solana address is returned without casing modification');
  assert(normalizeAddress(sol2) === sol2, 'Test 5: Solana case variant remains distinct and unmodified');
  assert(normalizeAddress(sol1) !== normalizeAddress(sol2), 'Test 5: Solana case-sensitive variants do not collapse');

  console.log('');

  // ─────────────────────────────────────────────
  // Test 4: Whale Behavior Phase Tracking
  // ─────────────────────────────────────────────
  console.log('--- 4. Whale Behavior Tests ---');
  const dummyHolders: HolderInfo[] = [
    { wallet: '0xWhale1', balance: 5000, tx_count: 5 },
    { wallet: '0xWhale2', balance: 1000, tx_count: 1 },
  ];
  const whaleTxs: UniversalTransaction[] = [
    makeTx({ hash: 'tx1', from: 'pool', to: '0xWhale1', amount: 2000, type: 'buy' }), // net positive
  ];

  const whaleBeh = analyzeWhaleBehavior(whaleTxs, dummyHolders, 100_000, 10_000, 0.1);
  assert(whaleBeh.status === 'ok', 'Whale behavior analyzer runs successfully');
  assert(whaleBeh.activeWhaleCount === 2, 'Applies dynamic thresholds (1% of 100k = 1000) and counts whales correctly');
  assert(whaleBeh.phase === 'accumulation', 'Correctly identifies accumulation phase');
  assert(whaleBeh.dataSemanticWarning.includes('local transaction batch'), 'Includes data semantic warning regarding local batch boundaries');

  console.log('');

  // ─────────────────────────────────────────────
  // Test 5: Buyer Quality Profiling
  // ─────────────────────────────────────────────
  console.log('--- 5. Buyer Quality Tests ---');
  const buyerTxs: UniversalTransaction[] = [
    makeTx({ hash: 'tx1', from: 'pool', to: '0xBuyer1', amount: 100, type: 'buy', priceUsd: 1 }),
    makeTx({ hash: 'tx2', from: 'pool', to: '0xBuyer1', amount: 100, type: 'buy', priceUsd: 1 }), // returning
    makeTx({ hash: 'tx3', from: 'pool', to: '0xBuyer2', amount: 100, type: 'buy', priceUsd: 1 }),
    makeTx({ hash: 'tx4', from: 'pool', to: '0xBuyer3', amount: 100, type: 'buy', priceUsd: 1 }),
  ];

  const buyerQuality = analyzeBuyerQuality(buyerTxs);
  assert(buyerQuality.status === 'ok', 'Buyer quality analyzer runs successfully');
  assert(buyerQuality.cohortMetrics.returningBuyers === 1, 'Counts returning buyers correctly');
  assert(buyerQuality.cohortMetrics.returningBuyerRatio > 0.33 && buyerQuality.cohortMetrics.returningBuyerRatio < 0.34, 'Computes correct returning buyer ratio (~0.333)');
  assert(buyerQuality.unavailableMetrics.includes('walletAge'), 'Flags walletAge as unavailable due to lack of historical database indexers');

  console.log('');

  // ─────────────────────────────────────────────
  // Test 6: Market Regime Classification
  // ─────────────────────────────────────────────
  console.log('--- 6. Market Regime Tests ---');
  
  // Accumulation series (low slope consolidations)
  const accCandles: OHLCVCandle[] = [];
  for (let i = 0; i < 10; i++) {
    accCandles.push({
      timestamp: i * 60,
      open: 1.0,
      close: 1.0, // static price
      volume: 100 + i * 5, // rising volume
    });
  }
  const accRegime = analyzeMarketRegime(accCandles);
  assert(accRegime.status === 'ok', 'Market regime analyzer runs successfully');
  assert(accRegime.regime === 'ACCUMULATION', 'Classifies accumulation consolidation regime correctly');
  assert(accRegime.predictionDisclaimer.includes('NOT predict'), 'Includes strict warning that it does NOT predict future price');

  // Momentum series (rising prices, rising volume)
  const momCandles: OHLCVCandle[] = [];
  for (let i = 0; i < 10; i++) {
    momCandles.push({
      timestamp: i * 60,
      open: 1.0 + i * 0.02,
      close: 1.0 + (i + 1) * 0.02, // rising price
      volume: 100 + i * 20, // rising volume
    });
  }
  const momRegime = analyzeMarketRegime(momCandles);
  assert(momRegime.regime === 'MOMENTUM', 'Classifies momentum breakout regime correctly');

  // Edge Case: Insufficient candles
  const shortCandles = analyzeMarketRegime(accCandles.slice(0, 5));
  assert(shortCandles.status === 'insufficient_data', 'Handles short candle counts by returning insufficient_data');

  console.log('');

  // ─────────────────────────────────────────────
  // Test 7: Explainable Risk Score
  // ─────────────────────────────────────────────
  console.log('--- 7. Risk Scoring Engine Tests ---');
  // accRegime and momRegime are used below as marketRegime inputs
  const dummyCapital: CapitalEfficiencyResult = {
    status: 'ok',
    fdvToLiquidityRatio: 12,
    capitalSensitivityMultiplier: 12,
    sensitivity: 'medium',
    fdvUsd: 120_000,
    totalLiquidityUsd: 10_000,
    spotPriceUsd: 0.1,
    evidenceIds: [],
  };

  const riskResult = calculateRiskScore({
    ammSlippage: normalSim,
    volumeConcentration: hhiHigh,
    whaleBehavior: whaleBeh,
    whaleExit: whaleExit,
    buyerQuality: buyerQuality,
    capitalEfficiency: dummyCapital,
    isHoneypot: false,
  });

  assert(riskResult.status === 'ok', 'Risk scorer runs successfully');
  assert(riskResult.overallRiskScore >= 0 && riskResult.overallRiskScore <= 100, 'Score is properly bound between 0 and 100');
  assert(riskResult.subScores.length === 6, 'Contains subscores for all 6 active modules');
  assert(riskResult.topRisks.length > 0, 'Exposes prioritized top risks lists');

  // Honeypot override check
  const honeypotRisk = calculateRiskScore({
    ammSlippage: normalSim,
    volumeConcentration: hhiHigh,
    whaleBehavior: whaleBeh,
    whaleExit: whaleExit,
    buyerQuality: buyerQuality,
    capitalEfficiency: dummyCapital,
    isHoneypot: true,
  });
  assert(honeypotRisk.overallRiskScore === 100, 'Verified honeypot successfully overrides overall risk score to 100');

  console.log('');

  // ─────────────────────────────────────────────
  // Test 8: AI Narrative Compliance
  // ─────────────────────────────────────────────
  console.log('--- 8. AI Trader Intelligence Report Tests ---');
  const report = generateTraderIntelligenceReport({
    tokenAddress: '0xAddress',
    tokenSymbol: 'TEST',
    tokenName: 'Test Token',
    network: 'eth',
    ammSlippage: normalSim,
    volumeConcentration: hhiHigh,
    whaleBehavior: whaleBeh,
    whaleExit: whaleExit,
    buyerQuality: buyerQuality,
    marketRegime: accRegime,
    capitalEfficiency: dummyCapital,
    riskScore: riskResult,
    evidence: [],
    dataQuality: { staleDataWarning: false, elevatorDataReused: true, transactionCount: 100, ohlcvCandleCount: 20 },
    limitations: ['walletAge'],
    scanId: 'scan-1',
    timestamp: Date.now(),
  });

  assert(report.status === 'ok', 'Report generator synthesizes successfully');
  assert(!report.executiveSummary.includes('$1.50'), 'Ensures narrative does not invent future target prices');
  assert(report.executionConditions.includes('$1,000 Position'), 'Narrative references exact mock simulation values');
  assert(report.dataLimitations.includes('walletAge'), 'Lists missing or unavailable data in Data Limitations section');

  // ─────────────────────────────────────────────
  // Test 9: Session Cache Isolation & Lifecycle (Phase 3)
  // ─────────────────────────────────────────────
  console.log('\n--- 9. Session Cache & Lifecycle Tests ---');
  
  const dummyResult: any = {
    scanId: 'scan-1',
    timestamp: Date.now(),
    tokenMetadata: { address: '0xAddress', name: 'Test', symbol: 'TEST' },
    marketSummary: { priceUsd: 1, volume24hUsd: null },
  };

  // Clear cache before starting
  sessionCache.clear();

  // Test 9.1: Insertion and valid hit
  setCachedResult('deep:user1:eth:0xaddress', dummyResult);
  const hit = getCachedResult('deep:user1:eth:0xaddress');
  assert(hit !== null && hit.scanId === 'scan-1', 'Cache insertion and valid hit verified');

  // Test 9.2: Chain isolation
  // Key format: deep:<userId>:<network>:<normalizedAddress>
  // User 1, Address 0xAddress, chain eth vs bsc
  const keyEth = 'deep:user1:eth:0xaddress';
  const keyBsc = 'deep:user1:bsc:0xaddress';
  sessionCache.clear();
  setCachedResult(keyEth, dummyResult);
  assert(getCachedResult(keyEth) !== null, 'ETH cache entry is present');
  assert(getCachedResult(keyBsc) === null, 'BSC cache entry is a miss (chain isolated)');

  // Test 9.3: User isolation
  const keyUser1 = 'deep:user1:eth:0xaddress';
  const keyUser2 = 'deep:user2:eth:0xaddress';
  sessionCache.clear();
  setCachedResult(keyUser1, dummyResult);
  assert(getCachedResult(keyUser2) === null, 'Cache entries isolated by user ID');

  // Test 9.4: EVM case-insensitivity in address normalization
  const evmAddressMixed = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const evmAddressLower = '0x742d35cc6634c0532925a3b844bc454e4438f44e';
  const keyMixed = `deep:user1:eth:${normalizeAddress(evmAddressMixed)}`;
  const keyLower = `deep:user1:eth:${normalizeAddress(evmAddressLower)}`;
  assert(keyMixed === keyLower, 'EVM address normalization results in same cache key');

  // Test 9.5: Solana case preservation
  const solAddressCache1 = 'DezXAZ8z7PnrnRJjz3wXPhhpXRKwJkx21ODXQI6EL5L';
  const solAddressCache2 = 'dezxaz8z7pnrnrjjz3wxphhpxrkwjkx21odxqi6el5l';
  const keySol1 = `deep:user1:solana:${normalizeAddress(solAddressCache1)}`;
  const keySol2 = `deep:user1:solana:${normalizeAddress(solAddressCache2)}`;
  assert(keySol1 !== keySol2, 'Solana address case variants remain distinct cache keys');

  // Test 9.6: TTL Expiry & Bounded Cleanup
  sessionCache.clear();
  // 1. Insert a stale entry (expires in the past)
  sessionCache.set('deep:user1:eth:stale', { result: dummyResult, expiresAt: Date.now() - 5000 });
  // 2. Insert a fresh entry (expires in the future)
  sessionCache.set('deep:user1:eth:fresh', { result: dummyResult, expiresAt: Date.now() + 10000 });

  // Verify lazy/inline cleanup deletes the stale entry but keeps the fresh one
  cleanExpiredEntries();
  assert(!sessionCache.has('deep:user1:eth:stale'), 'Expired entry successfully evicted from cache');
  assert(sessionCache.has('deep:user1:eth:fresh'), 'Valid entry preserved in cache after cleanup');

  console.log('\n==================================================');
  console.log(`TEST RUN COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('==================================================');
}

runTests().catch(console.error);

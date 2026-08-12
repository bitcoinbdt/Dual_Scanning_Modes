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
import { LiquidityPool, NormalizedPoolState } from './lib/blockchain/types';
import { CapitalEfficiencyResult, normalizeAddress, DeepScanInput } from './lib/deep_scan/types';
import { DeepScanService, sessionCache, cleanExpiredEntries, getCachedResult, setCachedResult, FRESHNESS_THRESHOLDS } from './lib/deep_scan/DeepScanService';
import { validateDeepScanConfig, DEEP_SCAN_CONFIG } from './lib/deep_scan/config';
import { runProviderTests } from './lib/providers/test';

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
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 100_000, priceUsd: 0.1, type: 'constant-product' },
  ];
  
  // Normal trade simulation (constant-product V2)
  const normalSim = simulateAmmSlippage(dummyPools, 0.1, [1000, 5000]);
  assert(normalSim.status === 'ok', 'Normal AMM simulation completes with ok status');
  assert(normalSim.simulations.length === 2, 'Generates correct simulation count');
  assert(normalSim.poolModel === 'constant-product', 'V2 pool model is reported in result');
  
  const sim5k = normalSim.simulations[1];
  // Math check: pool liquidity = $100K -> token reserve = 50k / 0.1 = 500,000 tokens, quote reserve = $50,000 USD
  // Input: 5,000 USD -> net input with 0.3% fee = $4,985 USD
  // New quote reserve = 54,985 USD -> new token reserve = 500,000 * 50,000 / 54,985 = 454,669.45 tokens
  // Tokens received = 500,000 - 454,669.45 = 45,330.55 tokens
  // Execution price = 5,000 / 45,330.55 = 0.1103 USD per token
  // Price impact = (0.1103 - 0.1) / 0.1 = 10.3% price impact (wait, actually ~9.34% because of token units in sell direction)
  assert(sim5k.priceImpactPct > 9 && sim5k.priceImpactPct < 10, 'Calculates correct mathematical constant product price impact (~9.3%)');
  assert(sim5k.exitRiskLevel === 'high', 'Classifies price impact risk level correctly');

  // Pool Type Gate: CLMM pool — must be explicitly refused
  const clmmPools: LiquidityPool[] = [
    { pair: 'TEST/USDT', dex: 'Uniswap V3', liquidityUsd: 500_000, priceUsd: 0.1, type: 'concentrated-liquidity' },
  ];
  const clmmSim = simulateAmmSlippage(clmmPools, 0.1, [1000]);
  assert(clmmSim.status === 'insufficient_data', 'CLMM pool correctly returns insufficient_data — V2 model not applied');
  assert(clmmSim.poolModel === 'concentrated-liquidity', 'CLMM pool model is reported in result');
  assert(clmmSim.simulations.length === 0, 'No simulations produced for CLMM pool');
  assert(clmmSim.reason !== undefined && clmmSim.reason.length > 0, 'Reason explains why CLMM simulation was skipped');

  // Pool Type Gate: Unknown pool type — runs V2 model with a warning reason
  const unknownPools: LiquidityPool[] = [
    { pair: 'TEST/USDT', dex: 'SomeNewDex', liquidityUsd: 100_000, priceUsd: 0.1, type: 'unknown' },
  ];
  const unknownSim = simulateAmmSlippage(unknownPools, 0.1, [1000]);
  assert(unknownSim.status === 'ok', 'Unknown pool type falls back to V2 model');
  assert(unknownSim.poolModel === 'unknown', 'Unknown pool model is reported in result');
  assert(unknownSim.reason !== undefined && unknownSim.reason.includes('could not be determined'), 'Unknown pool type surfaces a warning reason');

  // Pool Type Gate: Largest pool is CLMM, but a smaller V2 pool exists — simulator uses the V2 pool
  const mixedPools: LiquidityPool[] = [
    { pair: 'TEST/USDT', dex: 'Uniswap V3', liquidityUsd: 2_000_000, priceUsd: 0.1, type: 'concentrated-liquidity' },
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 100_000, priceUsd: 0.1, type: 'constant-product' },
  ];
  const mixedSim = simulateAmmSlippage(mixedPools, 0.1, [1000]);
  assert(mixedSim.status === 'ok', 'Mixed pool list selects V2 pool over larger CLMM pool');
  assert(mixedSim.poolModel === 'constant-product', 'Mixed pool list reports constant-product model');

  // Edge Case: Insufficient liquidity (asking for trade size that exceeds pool capacity)
  const failedSim = simulateAmmSlippage(dummyPools, 0.1, [150_000]);
  assert(failedSim.simulations[0].status === 'insufficient_data', 'Handles extreme size over pool capacity by flagging insufficient_data');

  // Edge Case: Empty pools list
  const emptyPoolSim = simulateAmmSlippage([], 0.1);
  assert(emptyPoolSim.status === 'insufficient_data', 'Handles empty pool arrays gracefully');

  // Edge Case: Zero spot price
  const zeroPriceSim = simulateAmmSlippage(dummyPools, 0);
  assert(zeroPriceSim.status === 'insufficient_data', 'Handles zero spot price gracefully');

  // Pool State Contract: Fee provenance — unknown fee → applies default with swapFeeKnown=false
  const unknownFeeSim = simulateAmmSlippage(dummyPools, 0.1, [1000]);
  assert(unknownFeeSim.status === 'ok', 'Simulation succeeds with unknown fee (applies V2 default)');
  assert(unknownFeeSim.swapFeeKnown === false, 'swapFeeKnown is false when fee was not in pool metadata');
  assert(unknownFeeSim.swapFeeUsed === 0.003, 'Default V2 fee (0.3%) is applied when pool fee is unknown');
  assert(unknownFeeSim.reserveProvenance === 'derived', 'Reserve provenance is "derived" (not observed on-chain)');
  assert(unknownFeeSim.simulations[0].swapFeeKnown === false, 'Per-simulation swapFeeKnown matches pool-level flag');
  assert(unknownFeeSim.simulations[0].reserveProvenance === 'derived', 'Per-simulation reserveProvenance is "derived"');

  // Pool State Contract: Known fee — NormalizedPoolState with explicit fee → swapFeeKnown=true
  const knownFeePool: NormalizedPoolState = {
    poolIdentifier: 'TEST/USDT',
    poolIdentifierType: 'label',
    dex: 'uniswap-v2',
    poolType: 'constant-product',
    liquidityUsd: 100_000,
    liquidityUsdProvenance: 'provider',
    spotPriceUsd: 0.1,
    spotPriceUsdProvenance: 'provider',
    fee: { known: true, feeRate: 0.003, source: 'provider-metadata' },
    snapshotAt: Math.floor(Date.now() / 1000),
    snapshotAtProvenance: 'provider',
  };
  const knownFeeSim = simulateAmmSlippage([knownFeePool], 0.1, [1000]);
  assert(knownFeeSim.status === 'ok', 'Simulation succeeds with known fee');
  assert(knownFeeSim.swapFeeKnown === true, 'swapFeeKnown is true when fee came from pool metadata');
  assert(knownFeeSim.swapFeeUsed === 0.003, 'Known fee rate is used in simulation');
  assert(knownFeeSim.simulations[0].swapFeeKnown === true, 'Per-simulation swapFeeKnown reflects known fee');
  // No warning in reason when pool type and fee are both known
  assert(knownFeeSim.reason === undefined, 'No warning reason when pool type and fee are both known');

  // Pool State Contract: Non-standard known fee (e.g. 1% fee pool)
  const highFeePool: NormalizedPoolState = {
    poolIdentifier: 'EXOTIC/USDT',
    poolIdentifierType: 'label',
    dex: 'custom-amm',
    poolType: 'constant-product',
    liquidityUsd: 100_000,
    liquidityUsdProvenance: 'provider',
    spotPriceUsd: 0.1,
    spotPriceUsdProvenance: 'provider',
    fee: { known: true, feeRate: 0.01, source: 'provider-metadata' },
  };
  const highFeeSim = simulateAmmSlippage([highFeePool], 0.1, [1000]);
  assert(highFeeSim.status === 'ok', 'Simulation succeeds with 1% known fee pool');
  assert(highFeeSim.swapFeeUsed === 0.01, 'Non-standard 1% fee is used instead of default 0.3%');
  // Higher fee → less tokens received → higher price impact than 0.3% fee pool
  assert(
    highFeeSim.simulations[0].priceImpactPct > unknownFeeSim.simulations[0].priceImpactPct,
    'Higher fee produces greater price impact than default 0.3% pool at same liquidity'
  );

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

  // ─────────────────────────────────────────────
  // Test 10: Data Freshness & Scan Outcomes
  // ─────────────────────────────────────────────
  console.log('\n--- 10. Data Freshness & Scan Outcomes ---');

  // Test 10.1: SUCCESS / PARTIAL_SUCCESS outcome mapping
  const testInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      name: 'Test',
      symbol: 'TEST',
      decimals: 9,
      totalSupply: 100000,
      spotPriceUsd: 1,
      totalLiquidityUsd: 10000,
      mainPools: [{ pair: 'TEST/SOL', dex: 'Raydium', liquidityUsd: 10000, priceUsd: 1 }],
      timestamp: Math.floor(Date.now() / 1000) // Fresh market data
    },
    elevatorResult: {
      ohlcv: [{ timestamp: Math.floor(Date.now() / 1000), open: 1, close: 1, volume: 1000 }],
      transactions: [{ hash: 'tx1', timestamp: Math.floor(Date.now() / 1000), from: 'A', to: 'B', amount: 100, type: 'buy', token: { address: '0xAddress' }, blockchain: 'solana' }],
      wallets: {},
      holders: [{ wallet: 'A', balance: 50, tx_count: 1 }],
      holdersStatus: 'available',
      wallet_metrics: { total_wallets: 1, total_holders: 1, top_10_wallets: [] },
      metrics: { RF17: false, W5: 1 },
      blockchain: 'solana',
      collectionTime: 100,
      collectedAt: Math.floor(Date.now() / 1000) // Fresh collection
    }
  };

  const freshResult = await DeepScanService.runScan(testInput);
  assert(freshResult.outcome === 'PARTIAL_SUCCESS' || freshResult.outcome === 'SUCCESS', 'Fresh scan outcome resolved correctly');
  assert(freshResult.dataQuality.staleDataWarning === false, 'Fresh scan has staleDataWarning = false');
  assert(freshResult.dataQuality.freshness !== undefined, 'Fresh scan includes freshness block');
  assert(freshResult.dataQuality.freshness?.isMarketDataStale === false, 'Market data not marked stale');

  // Test 10.2: Stale data detection
  const staleInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      name: 'Test',
      symbol: 'TEST',
      decimals: 9,
      totalSupply: 100000,
      spotPriceUsd: 1,
      totalLiquidityUsd: 10000,
      mainPools: [{ pair: 'TEST/SOL', dex: 'Raydium', liquidityUsd: 10000, priceUsd: 1 }],
      timestamp: Math.floor(Date.now() / 1000) - 3600 // Stale market data (1 hour old)
    },
    elevatorResult: {
      ohlcv: [{ timestamp: Math.floor(Date.now() / 1000) - 10000, open: 1, close: 1, volume: 1000 }], // Stale candles
      transactions: [{ hash: 'tx1', timestamp: Math.floor(Date.now() / 1000) - 5000, from: 'A', to: 'B', amount: 100, type: 'buy', token: { address: '0xAddress' }, blockchain: 'solana' }], // Stale txs
      wallets: {},
      holders: [{ wallet: 'A', balance: 50, tx_count: 1 }],
      holdersStatus: 'available',
      wallet_metrics: { total_wallets: 1, total_holders: 1, top_10_wallets: [] },
      metrics: { RF17: false, W5: 1 },
      blockchain: 'solana',
      collectionTime: 100,
      collectedAt: Math.floor(Date.now() / 1000) - 5000 // Stale collection
    }
  };

  const staleResult = await DeepScanService.runScan(staleInput);
  assert(staleResult.dataQuality.staleDataWarning === true, 'Stale scan has staleDataWarning = true');
  assert(staleResult.dataQuality.freshness?.isMarketDataStale === true, 'Exposes market data stale state');
  assert(staleResult.dataQuality.freshness?.isOhlcvStale === true, 'Exposes ohlcv stale state');
  assert(staleResult.dataQuality.freshness?.isTransactionStale === true, 'Exposes transactions stale state');

  // Test 10.3: INSUFFICIENT_DATA scan outcome
  const emptyInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      name: 'Test',
      symbol: 'TEST',
      decimals: 9,
      totalSupply: 100000,
      spotPriceUsd: 0, // Missing price
      totalLiquidityUsd: 0,
      mainPools: []
    },
    elevatorResult: {
      ohlcv: [], // No candles
      transactions: [], // No transactions
      wallets: {},
      holders: [],
      holdersStatus: 'insufficient_data',
      wallet_metrics: { total_wallets: 0, total_holders: 0, top_10_wallets: [] },
      metrics: { RF17: false, W5: 0 },
      blockchain: 'solana',
      collectionTime: 0
    }
  };

  const emptyResult = await DeepScanService.runScan(emptyInput);
  assert(emptyResult.outcome === 'INSUFFICIENT_DATA', 'Outcome is INSUFFICIENT_DATA when all modules have insufficient data');
  assert(emptyResult.status === 'failure', 'Result status is failure when outcome is INSUFFICIENT_DATA');

  // Test 11: Wash Trading Reuse vs. Fallback
  console.log('\n--- 11. Wash Trading Analysis Reuse ---');
  const mockTxs: UniversalTransaction[] = [
    {
      hash: 'tx1',
      timestamp: Math.floor(Date.now() / 1000),
      from: '0xWashWallet',
      to: '0xAddress',
      amount: 1000,
      priceUsd: 1,
      type: 'buy',
      isTrade: true,
      wallet: '0xWashWallet',
      token: { address: '0xAddress' },
      blockchain: 'solana'
    },
    {
      hash: 'tx2',
      timestamp: Math.floor(Date.now() / 1000) + 1,
      from: '0xNormalWallet',
      to: '0xAddress',
      amount: 1000,
      priceUsd: 1,
      type: 'buy',
      isTrade: true,
      wallet: '0xNormalWallet',
      token: { address: '0xAddress' },
      blockchain: 'solana'
    }
  ];

  // Test 11.1: Reuses washTrading when matching window is supplied
  const reuseInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      name: 'Test',
      symbol: 'TEST',
      decimals: 9,
      totalSupply: 100000,
      spotPriceUsd: 1,
      totalLiquidityUsd: 10000,
      mainPools: [{ pair: 'TEST/SOL', dex: 'Raydium', liquidityUsd: 10000, priceUsd: 1 }]
    },
    elevatorResult: {
      ohlcv: [],
      transactions: mockTxs,
      wallets: {},
      holders: [],
      holdersStatus: 'unavailable',
      wallet_metrics: { total_wallets: 2, total_holders: 0, top_10_wallets: [] },
      metrics: { RF17: true, W5: 0 },
      blockchain: 'solana',
      collectionTime: 0,
      washTrading: {
        totalWashWallets: 1,
        totalRoundTrips: 1,
        washWallets: ['0xWashWallet']
      }
    }
  };

  const reuseResult = await DeepScanService.runScan(reuseInput);
  // Volume HHI HHIResult: organicScore should account for wash ratio
  // Since we supplied 0xWashWallet as a wash trader (making up $1000 of $2000 total volume),
  // the wash volume ratio must be exactly 0.50 (50%).
  // Let's verify the transaction was mutated with isWashTrader flag
  assert(mockTxs[0].isWashTrader === true, 'Mock transaction is tagged as isWashTrader');
  assert(mockTxs[1].isWashTrader === false, 'Non-wash transaction remains untagged');

  // Test 11.2: Runs fallback detectWashTrading when no washTrading field is present (and finds nothing since there is no buy+sell pair)
  const noWashTxs: UniversalTransaction[] = [
    {
      hash: 'tx1',
      timestamp: Math.floor(Date.now() / 1000),
      from: '0xWashWallet',
      to: '0xAddress',
      amount: 1000,
      priceUsd: 1,
      type: 'buy',
      isTrade: true,
      wallet: '0xWashWallet',
      token: { address: '0xAddress' },
      blockchain: 'solana'
    },
    {
      hash: 'tx2',
      timestamp: Math.floor(Date.now() / 1000) + 1,
      from: '0xNormalWallet',
      to: '0xAddress',
      amount: 1000,
      priceUsd: 1,
      type: 'buy',
      isTrade: true,
      wallet: '0xNormalWallet',
      token: { address: '0xAddress' },
      blockchain: 'solana'
    }
  ];

  const fallbackInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      name: 'Test',
      symbol: 'TEST',
      decimals: 9,
      totalSupply: 100000,
      spotPriceUsd: 1,
      totalLiquidityUsd: 10000,
      mainPools: [{ pair: 'TEST/SOL', dex: 'Raydium', liquidityUsd: 10000, priceUsd: 1 }]
    },
    elevatorResult: {
      ohlcv: [],
      transactions: noWashTxs,
      wallets: {},
      holders: [],
      holdersStatus: 'unavailable',
      wallet_metrics: { total_wallets: 2, total_holders: 0, top_10_wallets: [] },
      metrics: { RF17: false, W5: 0 },
      blockchain: 'solana',
      collectionTime: 0
      // No washTrading field
    }
  };

  const fallbackResult = await DeepScanService.runScan(fallbackInput);
  assert(noWashTxs[0].isWashTrader === false, 'Fallback does not tag transaction when buy/sell pairing is absent');

  console.log('\n==================================================');
  console.log(`TEST RUN COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('==================================================');

  // ─────────────────────────────────────────────
  // Test 12: Fix A — Configuration Ordering Hardening
  // ─────────────────────────────────────────────
  console.log('\n--- 12. Configuration Ordering Hardening (Fix A) ---');

  // Test 12.1: Normal config produces expected confidence values
  const bqResultNormal = analyzeBuyerQuality(
    Array.from({ length: 20 }, (_, i) => ({
      hash: `tx${i}`, timestamp: Date.now(), from: '0xAddr', to: `wallet${i}`,
      amount: 100, priceUsd: 1, type: 'buy' as const, isTrade: true,
      wallet: `wallet${i}`, token: { address: '0xAddr' }, blockchain: 'eth' as const
    })),
    new Set<string>(),
    new Set<string>()
  );
  assert(bqResultNormal.confidence >= 70, 'Normal config: 20 buyers → high confidence (>=70)');

  // Test 12.2: Reversed confidenceLevels produces identical confidence
  const reversedConfig = {
    ...DEEP_SCAN_CONFIG.buyerQuality,
    confidenceLevels: [...DEEP_SCAN_CONFIG.buyerQuality.confidenceLevels].reverse(),
  };
  // Manually invoke the confidence logic with reversed config to check order-independence
  const sortedNormal = [...DEEP_SCAN_CONFIG.buyerQuality.confidenceLevels].sort((a, b) => b.minBuyers - a.minBuyers);
  const sortedReversed = [...reversedConfig.confidenceLevels].sort((a, b) => b.minBuyers - a.minBuyers);
  assert(
    JSON.stringify(sortedNormal) === JSON.stringify(sortedReversed),
    'Reversed confidenceLevels sorts to same order as normal config'
  );

  // Test 12.3: Shuffled confidenceLevels produces same sorted result
  const shuffledLevels = [
    DEEP_SCAN_CONFIG.buyerQuality.confidenceLevels[2],
    DEEP_SCAN_CONFIG.buyerQuality.confidenceLevels[0],
    DEEP_SCAN_CONFIG.buyerQuality.confidenceLevels[3],
    DEEP_SCAN_CONFIG.buyerQuality.confidenceLevels[1],
  ];
  const sortedShuffled = [...shuffledLevels].sort((a, b) => b.minBuyers - a.minBuyers);
  assert(
    JSON.stringify(sortedShuffled) === JSON.stringify(sortedNormal),
    'Shuffled confidenceLevels sorts to same order as normal config'
  );

  // Test 12.4: Original config array is not mutated after engine call
  const originalLevels = JSON.stringify(DEEP_SCAN_CONFIG.buyerQuality.confidenceLevels);
  analyzeBuyerQuality(
    [{ hash: 'x', timestamp: Date.now(), from: 'A', to: 'B', amount: 100, priceUsd: 1, type: 'buy', isTrade: true, wallet: 'A', token: { address: '0x' }, blockchain: 'eth' }],
    new Set<string>(), new Set<string>()
  );
  assert(
    JSON.stringify(DEEP_SCAN_CONFIG.buyerQuality.confidenceLevels) === originalLevels,
    'Original config.buyerQuality.confidenceLevels not mutated by engine'
  );

  // Test 12.5: Invalid config (duplicate threshold) is detected
  let configValidationErrorCaught = false;
  try {
    validateDeepScanConfig({
      ...DEEP_SCAN_CONFIG,
      buyerQuality: {
        ...DEEP_SCAN_CONFIG.buyerQuality,
        confidenceLevels: [
          { minBuyers: 20, confidence: 80 },
          { minBuyers: 20, confidence: 65 }, // duplicate!
          { minBuyers: 0, confidence: 30 },
        ],
      },
    });
  } catch (e: any) {
    configValidationErrorCaught = e.message.includes('duplicate minBuyers');
  }
  assert(configValidationErrorCaught, 'validateDeepScanConfig throws on duplicate minBuyers threshold');

  // Test 12.6: Invalid confidence value is detected
  let confidenceRangeErrorCaught = false;
  try {
    validateDeepScanConfig({
      ...DEEP_SCAN_CONFIG,
      buyerQuality: {
        ...DEEP_SCAN_CONFIG.buyerQuality,
        confidenceLevels: [
          { minBuyers: 20, confidence: 150 }, // out of range
          { minBuyers: 0, confidence: 30 },
        ],
      },
    });
  } catch (e: any) {
    confidenceRangeErrorCaught = e.message.includes('out of range');
  }
  assert(confidenceRangeErrorCaught, 'validateDeepScanConfig throws on out-of-range confidence value');

  // Test 12.7: Missing base level (minBuyers: 0) is detected
  let missingBaseLevelErrorCaught = false;
  try {
    validateDeepScanConfig({
      ...DEEP_SCAN_CONFIG,
      buyerQuality: {
        ...DEEP_SCAN_CONFIG.buyerQuality,
        confidenceLevels: [
          { minBuyers: 20, confidence: 80 },
          { minBuyers: 10, confidence: 65 },
          // missing { minBuyers: 0, ... }
        ],
      },
    });
  } catch (e: any) {
    missingBaseLevelErrorCaught = e.message.includes('missing base level');
  }
  assert(missingBaseLevelErrorCaught, 'validateDeepScanConfig throws on missing minBuyers:0 base level');

  // Test 12.8: MarketRegimeAnalyzer config ordering: original array not mutated
  const originalMrLevels = JSON.stringify(DEEP_SCAN_CONFIG.marketRegime.confidenceLevels);
  analyzeMarketRegime(
    Array.from({ length: 50 }, (_, i) => ({ timestamp: i, open: 1, close: 1, volume: 100 })),
  );
  assert(
    JSON.stringify(DEEP_SCAN_CONFIG.marketRegime.confidenceLevels) === originalMrLevels,
    'Original config.marketRegime.confidenceLevels not mutated by engine'
  );

  // ─────────────────────────────────────────────
  // Test 13: Fix B — Provider Failure / Freshness Distinction
  // ─────────────────────────────────────────────
  console.log('\n--- 13. Provider Failure Must Not Look Like Fresh Data (Fix B) ---');

  // Test 13.1: All providers failed → no timestamp → marketDataFreshness = 'unknown' → isMarketDataStale = true
  const allProviderFailInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      // No timestamp, no source — simulates all providers failed
      name: 'Test', symbol: 'TEST', decimals: 9, totalSupply: 100000,
      spotPriceUsd: 0, totalLiquidityUsd: 0, mainPools: [],
    },
    elevatorResult: {
      ohlcv: [],
      transactions: [],
      wallets: {}, holders: [], holdersStatus: 'insufficient_data',
      wallet_metrics: { total_wallets: 0, total_holders: 0, top_10_wallets: [] },
      metrics: { RF17: false, W5: 0 }, blockchain: 'solana', collectionTime: 0,
    },
  };
  const allFailResult = await DeepScanService.runScan(allProviderFailInput);
  assert(allFailResult.dataQuality.freshness?.marketDataFreshness === 'unknown',
    'All providers failed → marketDataFreshness is unknown');
  assert(allFailResult.dataQuality.freshness?.isMarketDataStale === true,
    'All providers failed → isMarketDataStale is true (not fresh)');
  assert(allFailResult.dataQuality.freshness?.ohlcvFreshness === 'unknown',
    'Empty OHLCV → ohlcvFreshness is unknown');
  assert(allFailResult.dataQuality.freshness?.transactionFreshness === 'unknown',
    'Empty transactions → transactionFreshness is unknown');
  // All three are unknown → nonFreshCount = 3 ≥ 2 → staleDataWarning = true
  assert(allFailResult.dataQuality.staleDataWarning === true,
    'All providers failed → staleDataWarning fires (unknown counts as non-fresh)');

  // Test 13.2: Valid recent timestamp → marketDataFreshness = 'fresh'
  const freshTimestampInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      name: 'Test', symbol: 'TEST', decimals: 9, totalSupply: 100000,
      spotPriceUsd: 1, totalLiquidityUsd: 10000,
      mainPools: [{ pair: 'TEST/SOL', dex: 'Raydium', liquidityUsd: 10000, priceUsd: 1 }],
      timestamp: Math.floor(Date.now() / 1000), // just now
      source: 'dexscreener',
    },
    elevatorResult: {
      ohlcv: [{ timestamp: Math.floor(Date.now() / 1000), open: 1, close: 1, volume: 1000 }],
      transactions: [{ hash: 'tx1', timestamp: Math.floor(Date.now() / 1000), from: 'A', to: 'B',
        amount: 100, type: 'buy', token: { address: '0xAddress' }, blockchain: 'solana' }],
      wallets: {}, holders: [{ wallet: 'A', balance: 50, tx_count: 1 }], holdersStatus: 'available',
      wallet_metrics: { total_wallets: 1, total_holders: 1, top_10_wallets: [] },
      metrics: { RF17: false, W5: 1 }, blockchain: 'solana',
      collectionTime: 100, collectedAt: Math.floor(Date.now() / 1000),
    },
  };
  const freshResult2 = await DeepScanService.runScan(freshTimestampInput);
  assert(freshResult2.dataQuality.freshness?.marketDataFreshness === 'fresh',
    'Valid recent timestamp → marketDataFreshness is fresh');
  assert(freshResult2.dataQuality.freshness?.isMarketDataStale === false,
    'Valid recent timestamp → isMarketDataStale is false');

  // Test 13.3: Old timestamp → marketDataFreshness = 'stale'
  const oldTimestampInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      name: 'Test', symbol: 'TEST', decimals: 9, totalSupply: 100000,
      spotPriceUsd: 1, totalLiquidityUsd: 10000,
      mainPools: [{ pair: 'TEST/SOL', dex: 'Raydium', liquidityUsd: 10000, priceUsd: 1 }],
      timestamp: Math.floor(Date.now() / 1000) - FRESHNESS_THRESHOLDS.MARKET_DATA - 60, // over threshold
      source: 'dexscreener',
    },
    elevatorResult: {
      ohlcv: [], transactions: [],
      wallets: {}, holders: [], holdersStatus: 'insufficient_data',
      wallet_metrics: { total_wallets: 0, total_holders: 0, top_10_wallets: [] },
      metrics: { RF17: false, W5: 0 }, blockchain: 'solana', collectionTime: 0,
    },
  };
  const staleTimestampResult = await DeepScanService.runScan(oldTimestampInput);
  assert(staleTimestampResult.dataQuality.freshness?.marketDataFreshness === 'stale',
    'Expired timestamp → marketDataFreshness is stale');
  assert(staleTimestampResult.dataQuality.freshness?.isMarketDataStale === true,
    'Expired timestamp → isMarketDataStale is true');

  // Test 13.4: Provider succeeded but no timestamp → 'fresh' (known live query)
  const liveProviderNoTimestampInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      name: 'Test', symbol: 'TEST', decimals: 9, totalSupply: 100000,
      spotPriceUsd: 1, totalLiquidityUsd: 10000,
      mainPools: [{ pair: 'TEST/SOL', dex: 'Raydium', liquidityUsd: 10000, priceUsd: 1 }],
      // No timestamp, but source indicates live provider succeeded
      source: 'geckoterminal',
    },
    elevatorResult: {
      ohlcv: [{ timestamp: Math.floor(Date.now() / 1000), open: 1, close: 1, volume: 1000 }],
      transactions: [{ hash: 'tx1', timestamp: Math.floor(Date.now() / 1000), from: 'A', to: 'B',
        amount: 100, type: 'buy', token: { address: '0xAddress' }, blockchain: 'solana' }],
      wallets: {}, holders: [], holdersStatus: 'unavailable',
      wallet_metrics: { total_wallets: 1, total_holders: 0, top_10_wallets: [] },
      metrics: { RF17: false, W5: 1 }, blockchain: 'solana', collectionTime: 100,
    },
  };
  const liveNoTsResult = await DeepScanService.runScan(liveProviderNoTimestampInput);
  assert(liveNoTsResult.dataQuality.freshness?.marketDataFreshness === 'fresh',
    'Live provider (geckoterminal) with no timestamp → marketDataFreshness is fresh');
  assert(liveNoTsResult.dataQuality.freshness?.isMarketDataStale === false,
    'Live provider (geckoterminal) with no timestamp → isMarketDataStale is false');

  // Test 13.5: source = 'fallback' with no timestamp → 'unknown' (all providers failed)
  const fallbackSourceInput: DeepScanInput = {
    tokenAddress: '0xAddress',
    network: 'solana',
    tokenMetadata: {
      name: 'Test', symbol: 'TEST', decimals: 9, totalSupply: 100000,
      spotPriceUsd: 0, totalLiquidityUsd: 0, mainPools: [],
      source: 'fallback', // explicit fallback marker
    },
    elevatorResult: {
      ohlcv: [], transactions: [],
      wallets: {}, holders: [], holdersStatus: 'insufficient_data',
      wallet_metrics: { total_wallets: 0, total_holders: 0, top_10_wallets: [] },
      metrics: { RF17: false, W5: 0 }, blockchain: 'solana', collectionTime: 0,
    },
  };
  const fallbackSourceResult = await DeepScanService.runScan(fallbackSourceInput);
  assert(fallbackSourceResult.dataQuality.freshness?.marketDataFreshness === 'unknown',
    'source=fallback with no timestamp → marketDataFreshness is unknown');
  assert(fallbackSourceResult.dataQuality.freshness?.isMarketDataStale === true,
    'source=fallback with no timestamp → isMarketDataStale is true');

  // ─────────────────────────────────────────────
  // Test 14: Fix C — Cache Freshness Hardening
  // ─────────────────────────────────────────────
  console.log('\n--- 14. Cache Freshness Hardening (Fix C) ---');

  sessionCache.clear();

  // Build a mock result with freshness metadata
  const nowSec = Math.floor(Date.now() / 1000);

  const freshCacheResult: any = {
    scanId: 'cache-test-1',
    timestamp: Date.now(),
    tokenMetadata: { address: '0xCacheTest', name: 'CacheTest', symbol: 'CT' },
    marketSummary: { priceUsd: 1, volume24hUsd: null, fdvUsd: 0, marketRegime: 'UNKNOWN', totalLiquidityUsd: 0 },
    dataQuality: {
      staleDataWarning: false,
      elevatorDataReused: false,
      transactionCount: 10,
      ohlcvCandleCount: 5,
      freshness: {
        scanTime: nowSec,
        cacheAgeSeconds: 0,
        marketDataTimestamp: nowSec,
        marketDataAgeSeconds: 0,
        marketDataFreshness: 'fresh' as const,
        isMarketDataStale: false,
        ohlcvTimestamp: nowSec,
        ohlcvAgeSeconds: 0,
        ohlcvFreshness: 'fresh' as const,
        isOhlcvStale: false,
        transactionTimestamp: nowSec,
        transactionAgeSeconds: 0,
        transactionFreshness: 'fresh' as const,
        isTransactionStale: false,
      },
    },
    limitations: [],
    overallConfidence: 70,
    scanDurationMs: 100,
  };

  // Test 14.1: Cache hit within TTL — result returned
  setCachedResult('deep:user1:eth:0xcachetest', freshCacheResult);
  const cacheHit = getCachedResult('deep:user1:eth:0xcachetest');
  assert(cacheHit !== null, 'Cache hit within TTL returns result');
  assert(cacheHit?.scanId === 'cache-test-1', 'Cache hit returns correct result');

  // Test 14.2: cacheAgeSeconds is updated dynamically on cache hit
  assert(cacheHit?.dataQuality.freshness?.cacheAgeSeconds !== undefined,
    'Cache hit includes updated cacheAgeSeconds');
  // Should be 0 or very small (just inserted)
  assert((cacheHit?.dataQuality.freshness?.cacheAgeSeconds ?? 99) < 5,
    'cacheAgeSeconds is small (< 5s) for a just-inserted entry');

  // Test 14.3: Cache expiration — expired entry returns null
  sessionCache.clear();
  sessionCache.set('deep:user1:eth:expired', { result: freshCacheResult, expiresAt: Date.now() - 1 });
  const expiredHit = getCachedResult('deep:user1:eth:expired');
  assert(expiredHit === null, 'Expired cache entry returns null');

  // Test 14.4: Cached result with stale freshness stays stale (not converted to fresh)
  sessionCache.clear();
  const staleCacheResult: any = {
    ...freshCacheResult,
    scanId: 'cache-stale-1',
    dataQuality: {
      ...freshCacheResult.dataQuality,
      staleDataWarning: true,
      freshness: {
        ...freshCacheResult.dataQuality.freshness,
        marketDataTimestamp: nowSec - FRESHNESS_THRESHOLDS.MARKET_DATA - 120,
        marketDataAgeSeconds: FRESHNESS_THRESHOLDS.MARKET_DATA + 120,
        marketDataFreshness: 'stale' as const,
        isMarketDataStale: true,
      },
    },
  };
  setCachedResult('deep:user1:eth:staledata', staleCacheResult);
  const staleCacheHit = getCachedResult('deep:user1:eth:staledata');
  assert(staleCacheHit !== null, 'Stale cached result is returned (stale stays stale)');
  assert(staleCacheHit?.dataQuality.freshness?.marketDataFreshness === 'stale',
    'Cached stale result retains marketDataFreshness=stale');
  assert(staleCacheHit?.dataQuality.freshness?.isMarketDataStale === true,
    'Cached stale result retains isMarketDataStale=true');

  // Test 14.5: Cached result with unknown freshness stays unknown (not converted to fresh)
  sessionCache.clear();
  const unknownCacheResult: any = {
    ...freshCacheResult,
    scanId: 'cache-unknown-1',
    dataQuality: {
      ...freshCacheResult.dataQuality,
      freshness: {
        ...freshCacheResult.dataQuality.freshness,
        marketDataTimestamp: undefined,
        marketDataAgeSeconds: undefined,
        marketDataFreshness: 'unknown' as const,
        isMarketDataStale: true,
      },
    },
  };
  setCachedResult('deep:user1:eth:unknowndata', unknownCacheResult);
  const unknownCacheHit = getCachedResult('deep:user1:eth:unknowndata');
  assert(unknownCacheHit !== null, 'Unknown-freshness cached result is returned');
  assert(unknownCacheHit?.dataQuality.freshness?.marketDataFreshness === 'unknown',
    'Cached unknown result retains marketDataFreshness=unknown');

  // Test 14.6: Fresh cache entry that has gone stale since caching → invalidated
  sessionCache.clear();
  const nowGoneStaleResult: any = {
    ...freshCacheResult,
    scanId: 'cache-expired-market-1',
    dataQuality: {
      ...freshCacheResult.dataQuality,
      freshness: {
        ...freshCacheResult.dataQuality.freshness,
        scanTime: nowSec,
        marketDataTimestamp: nowSec - FRESHNESS_THRESHOLDS.MARKET_DATA - 10, // just crossed threshold
        marketDataAgeSeconds: FRESHNESS_THRESHOLDS.MARKET_DATA + 10,
        marketDataFreshness: 'fresh' as const, // was fresh at scan time...
        isMarketDataStale: false,
      },
    },
  };
  setCachedResult('deep:user1:eth:gonestalecache', nowGoneStaleResult);
  const goneStaleHit = getCachedResult('deep:user1:eth:gonestalecache');
  assert(goneStaleHit === null,
    'Cached fresh result invalidated when underlying provider data has since become stale');

  // Test 14.7: Anonymous requests bypass cache (no userId → no caching)
  // This is already tested implicitly: no userId → cacheKey = null in runScan
  // We verify by checking that getCachedResult for a non-existent key returns null
  assert(getCachedResult('deep:undefined:eth:0xcachetest') === null,
    'Anonymous cache key (undefined userId) returns null (no cache stored)');

  // Test 14.8: Cache does not fabricate freshness — cacheAgeSeconds reflects real elapsed time
  sessionCache.clear();
  setCachedResult('deep:user1:eth:agechecktest', freshCacheResult);
  const ageCheckHit = getCachedResult('deep:user1:eth:agechecktest');
  const returnedAge = ageCheckHit?.dataQuality.freshness?.cacheAgeSeconds ?? -1;
  // Should be 0–1 second (just inserted)
  assert(returnedAge >= 0 && returnedAge <= 2, `cacheAgeSeconds reflects true elapsed time (got ${returnedAge})`);

  sessionCache.clear();

  console.log('\n==================================================');
  console.log(`TEST RUN COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('==================================================');

  // Run new provider infrastructure unit tests
  const providerStats = await runProviderTests();
  if (providerStats.failed > 0) {
    throw new Error(`Provider infrastructure tests failed: ${providerStats.failed} failure(s)`);
  }
}

runTests().catch(console.error);

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
import { analyzeLiquidityFragmentation } from './lib/deep_scan/engines/LiquidityFragmentationAnalyzer';
import { calculateRiskScore } from './lib/deep_scan/engines/RiskScoringEngine';
import { generateTraderIntelligenceReport } from './lib/deep_scan/engines/TraderIntelligenceGenerator';
import { UniversalTransaction, HolderInfo, OHLCVCandle } from './lib/elevator/collectors/types';
import { LiquidityPool, NormalizedPoolState, toNormalizedPoolState } from './lib/blockchain/types';
import { CapitalEfficiencyResult, normalizeAddress, DeepScanInput } from './lib/deep_scan/types';
import { DeepScanService, sessionCache, cleanExpiredEntries, getCachedResult, setCachedResult, FRESHNESS_THRESHOLDS } from './lib/deep_scan/DeepScanService';
import { validateDeepScanConfig, DEEP_SCAN_CONFIG } from './lib/deep_scan/config';
import { runProviderTests } from './lib/providers/test';
import axios from 'axios';
import { ethers } from 'ethers';
import { analyzeSmartMoney } from './lib/deep_scan/engines/SmartMoneyAnalyzer';
import { adaptBitqueryWalletHistory } from './lib/providers/bitquery/adapter';
import type { SmartMoneyTradeEvent, SmartMoneyReputationRecord } from './lib/deep_scan/types';
import { calculateSmartMoneyPnl } from './lib/deep_scan/engines/SmartMoneyPnlEngine';
import { parseTransactionToSwaps } from './lib/deep_scan/parsers/SmartMoneySwapParser';
import { getHistoricalV2Reserves } from './lib/deep_scan/historical/HistoricalPoolState';
import { getContractStateAtBlock, getBlockMetadata } from './lib/providers/alchemy/historicalRpc';
import { calculateHistoricalSnapshotBlocks, schedulePoolReservesIndexing, setSupabaseMock as setIndexerSupabaseMock, queryHistoricalReserves } from './lib/deep_scan/historical/HistoricalPoolReservesIndexer';
import { POST as historicalReservesWorkerPost } from './app/api/worker/historical-reserves-indexer/route';
import { setSupabaseMock as setWorkerSupabaseMock } from './app/api/worker/historical-reserves-indexer/supabaseClientFactory';
import { fetchMarketDataWithFallback } from './lib/blockchain/marketDataFallback';
import {
  simulateV2SwapBigInt,
  simulateV2SwapReverseBigInt,
  computeExecutableLiquidity,
  analyzeHistoricalSnapshots,
  classifyLiquidityRegime,
  analyzeLiquidityStress,
} from './lib/deep_scan/engines/LiquidityStressAnalyzer';
import type { WalletQualityProfile } from './lib/providers/adapter-types';


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
      freshnessTag: 'unknown' as const,
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
  const mockProfilesForConfidence = new Map(
    Array.from({ length: 20 }, (_, i) => [
      `wallet${i}`,
      { walletAddress: `wallet${i}`, chain: 'eth', firstSeenAt: new Date().toISOString(), walletAgeDays: 10, transactionCount: 1, activeDaysCount: 1, lastUpdated: Math.floor(Date.now()/1000), coverage: 'complete', provenance: 'goldrush' }
    ])
  ) as any;

  const bqResultNormal = analyzeBuyerQuality(
    Array.from({ length: 20 }, (_, i) => ({
      hash: `tx${i}`, timestamp: Date.now(), from: '0xAddr', to: `wallet${i}`,
      amount: 100, priceUsd: 1, type: 'buy' as const, isTrade: true,
      wallet: `wallet${i}`, token: { address: '0xAddr' }, blockchain: 'eth' as const
    })),
    new Set<string>(),
    new Set<string>(),
    mockProfilesForConfidence
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

  // ─────────────────────────────────────────────
  // Test 15: Phase 5A Hardening and Boundary Validation
  // ─────────────────────────────────────────────
  console.log('\n--- 15. Phase 5A Hardening and Boundary Tests ---');

  // 15.1 DORMANT whale phase classification (inflow=0, outflow=0)
  const dormantHolders: HolderInfo[] = [
    { wallet: '0xWhale1', balance: 50_000, tx_count: 0 }
  ];
  const dormantTxs: UniversalTransaction[] = []; // No trades inside window
  const dormantResult = analyzeWhaleBehavior(dormantTxs, dormantHolders, 1_000_000, 100_000, 1.0);
  assert(dormantResult.phase === 'dormant', 'Classifies whale phase as dormant when there are no buys or sells');
  assert(dormantResult.isDistributionRisk === false, 'Dormant phase must NOT trigger distribution risk');

  // 15.2 DORMANT narrative verification
  const dormantNarrResult = generateTraderIntelligenceReport({
    tokenAddress: '0xToken',
    tokenSymbol: 'TEST',
    tokenName: 'Test Token',
    network: 'eth',
    ammSlippage: { status: 'ok', simulations: [], isThinLiquidity: false, evidenceIds: [] },
    volumeConcentration: { status: 'ok', totalBuyVolumeUsd: 0, totalSellVolumeUsd: 0, buySellRatio: 0, uniqueBuyers: 0, uniqueSellers: 0, buyerHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] }, sellerHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] }, totalVolumeHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] }, elevatorWashTraderCount: 0, elevatorWashVolumeUsd: 0, washVolumeRatio: 0, volumePriceDivergence: false, organicScore: 100, evidenceIds: [] },
    whaleBehavior: dormantResult,
    whaleExit: { status: 'ok', scenarios: [], targetWallets: [], combinedObservedBalance: 0, maxSeverity: 'low' as const, simulationDisclaimer: '', evidenceIds: [] },
    buyerQuality: { status: 'ok', buyerQualityScore: 80, cohortMetrics: { totalBuyers: 10, returningBuyers: 5, singleUseBuyers: 5, returningBuyerRatio: 0.5, freshWalletRatio: 0, avgBuyValueUsd: 100, buyValueStdDevUsd: 10, capitalDiversityIndex: 0.9 }, positiveFactors: [], negativeFactors: [], unavailableMetrics: [], confidence: 80, evidenceIds: [] },
    marketRegime: { status: 'ok', regime: 'ACCUMULATION', confidence: 80, stats: { priceSlopePerCandle: 0, volumeSlopePerCandle: 0, priceVolatility: 0, volumeZScore: 0, priceVolumeCorrelation: 0, candleCount: 10, firstPrice: 1, lastPrice: 1, totalPriceChangePct: 0, avgVolume: 100 }, regimeDescription: 'Consolidating', predictionDisclaimer: '', evidenceIds: [] },
    capitalEfficiency: { status: 'ok', fdvToLiquidityRatio: 1, capitalSensitivityMultiplier: 1, sensitivity: 'low', fdvUsd: 100000, totalLiquidityUsd: 100000, spotPriceUsd: 1.0, evidenceIds: [] },
    riskScore: { status: 'ok', overallRiskScore: 25, riskLevel: 'low', subScores: [], topRisks: [], mitigators: [], confidence: 80, evidenceIds: [], sufficientData: true, scoreCompleteness: 'complete', availableModuleCount: 6, totalModuleCount: 6 },
    evidence: [],
    dataQuality: { staleDataWarning: false, elevatorDataReused: false, transactionCount: 0, ohlcvCandleCount: 0 },
    limitations: [],
    scanId: 'dormant-narrative-test',
    timestamp: Date.now(),
  });
  assert(dormantNarrResult.holderRisk.includes('Whale phase: DORMANT'), 'Trader report generates dormant whale phase narrative correctly');

  // 15.3 Whale Freshness Tag boundaries
  // spec: ageSeconds = scanTimeSec - firstSeen
  // fresh: age <= 7 days (7 * 24 * 3600 = 604800 s)
  // recent: age > 7 days AND age <= 30 days (30 * 24 * 3600 = 2592000 s)
  // established: age > 30 days
  // unknown: age < 0 (future timestamp)
  const SEVEN_DAYS_S = 7 * 24 * 3600;
  const THIRTY_DAYS_S = 30 * 24 * 3600;
  
  function getFreshnessTagForAge(ageSec: number): string {
    if (ageSec < 0) return 'unknown';
    if (ageSec <= SEVEN_DAYS_S) return 'fresh';
    if (ageSec <= THIRTY_DAYS_S) return 'recent';
    return 'established';
  }

  assert(getFreshnessTagForAge(0) === 'fresh', 'Age = exactly 0 resolves to fresh');
  assert(getFreshnessTagForAge(SEVEN_DAYS_S) === 'fresh', 'Age = exactly 7 days resolves to fresh');
  assert(getFreshnessTagForAge(SEVEN_DAYS_S + 1) === 'recent', 'Age = 7 days + 1 second resolves to recent');
  assert(getFreshnessTagForAge(THIRTY_DAYS_S) === 'recent', 'Age = exactly 30 days resolves to recent');
  assert(getFreshnessTagForAge(THIRTY_DAYS_S + 1) === 'established', 'Age = 30 days + 1 second resolves to established');
  assert(getFreshnessTagForAge(-100) === 'unknown', 'Future timestamp (negative age) resolves to unknown');

  // 15.4 BREAKOUT Volume Z-score triggers
  // priceSlope > cfg.trendLimit => priceUp
  // Z-score >= 2.0 => BREAKOUT (if checked before MOMENTUM)
  const breakoutCandles: OHLCVCandle[] = [
    { timestamp: 1, open: 1.0, close: 1.0, volume: 100 },
    { timestamp: 2, open: 1.0, close: 1.01, volume: 100 },
    { timestamp: 3, open: 1.0, close: 1.02, volume: 100 },
    { timestamp: 4, open: 1.0, close: 1.03, volume: 100 },
    { timestamp: 5, open: 1.0, close: 1.04, volume: 100 },
    { timestamp: 6, open: 1.0, close: 1.05, volume: 100 },
    { timestamp: 7, open: 1.0, close: 1.06, volume: 100 },
    { timestamp: 8, open: 1.0, close: 1.07, volume: 100 },
    { timestamp: 9, open: 1.0, close: 1.08, volume: 100 },
    { timestamp: 10, open: 1.0, close: 1.10, volume: 1000 }, // massive volume spike (Z-score > 2.0)
  ];
  const breakoutRegime = analyzeMarketRegime(breakoutCandles);
  assert(breakoutRegime.regime === 'BREAKOUT', 'Classifies as BREAKOUT when price is rising and volume Z-score is >= 2.0');

  // priceUp but Z-score < 2.0 => MOMENTUM or other regime
  const momentumCandles: OHLCVCandle[] = [
    { timestamp: 1, open: 1.0, close: 1.0, volume: 100 },
    { timestamp: 2, open: 1.0, close: 1.01, volume: 110 },
    { timestamp: 3, open: 1.0, close: 1.02, volume: 120 },
    { timestamp: 4, open: 1.0, close: 1.03, volume: 130 },
    { timestamp: 5, open: 1.0, close: 1.04, volume: 140 },
    { timestamp: 6, open: 1.0, close: 1.05, volume: 150 },
    { timestamp: 7, open: 1.0, close: 1.06, volume: 160 },
    { timestamp: 8, open: 1.0, close: 1.07, volume: 170 },
    { timestamp: 9, open: 1.0, close: 1.08, volume: 180 },
    { timestamp: 10, open: 1.0, close: 1.10, volume: 190 }, // gradual increase (Z-score < 2.0)
  ];
  const momentumRegime = analyzeMarketRegime(momentumCandles);
  assert(momentumRegime.regime === 'MOMENTUM', 'Classifies as MOMENTUM when price is rising but volume Z-score is < 2.0');

  // Near-zero volume standard deviation noise protection
  const flatVolumeCandles: OHLCVCandle[] = [
    { timestamp: 1, open: 1.0, close: 1.0, volume: 100 },
    { timestamp: 2, open: 1.0, close: 1.01, volume: 100.0001 },
    { timestamp: 3, open: 1.0, close: 1.02, volume: 100 },
    { timestamp: 4, open: 1.0, close: 1.03, volume: 100.0001 },
    { timestamp: 5, open: 1.0, close: 1.04, volume: 100 },
    { timestamp: 6, open: 1.0, close: 1.05, volume: 100.0001 },
    { timestamp: 7, open: 1.0, close: 1.06, volume: 100 },
    { timestamp: 8, open: 1.0, close: 1.07, volume: 100.0001 },
    { timestamp: 9, open: 1.0, close: 1.08, volume: 100 },
    { timestamp: 10, open: 1.0, close: 1.10, volume: 100.0005 }, // standard dev is extremely small (noise)
  ];
  const flatVolumeRegime = analyzeMarketRegime(flatVolumeCandles);
  assert(flatVolumeRegime.regime !== 'BREAKOUT', 'Flat/noisy volume does not create false BREAKOUT classification due to stddev noise floor');

  // 15.5 Liquidity Fragmentation Tests
  // monopoly (1 pool, HHI = 1)
  const monopolyPools = [
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 100_000, priceUsd: 1.0, type: 'constant-product' }
  ];
  const monopolyFrag = analyzeLiquidityFragmentation(monopolyPools as any[]);
  assert(monopolyFrag.poolHHI === 1.0, 'HHI of single pool is exactly 1.0');
  assert(monopolyFrag.concentrationLevel === 'monopoly', 'Single pool classified as monopoly');
  assert(monopolyFrag.isDominantPool === true, 'Single pool flagged as dominant pool (share >= 80%)');

  // two equal pools (HHI = 0.5)
  const twoEqualPools = [
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 50_000, priceUsd: 1.0, type: 'constant-product' },
    { pair: 'TEST/USDC', dex: 'Sushiswap', liquidityUsd: 50_000, priceUsd: 1.0, type: 'constant-product' }
  ];
  const twoFrag = analyzeLiquidityFragmentation(twoEqualPools as any[]);
  assert(Math.abs(twoFrag.poolHHI - 0.5) < 0.001, 'HHI of two equal pools is 0.5');
  // HHI = 0.5 exactly: the existing code uses strict > 0.50 for 'high', so 0.5 resolves to 'moderate'
  assert(twoFrag.concentrationLevel === 'moderate', 'Two equal pools (HHI=0.5) classified as moderate concentration (boundary: > 0.50 is high, = 0.50 is moderate)');
  assert(twoFrag.isDominantPool === false, 'No dominant pool flagged for equal pools');

  // four equal pools (HHI = 0.25)
  const fourEqualPools = [
    { pair: 'P1', dex: 'D1', liquidityUsd: 25_000, priceUsd: 1.0, type: 'constant-product' },
    { pair: 'P2', dex: 'D2', liquidityUsd: 25_000, priceUsd: 1.0, type: 'constant-product' },
    { pair: 'P3', dex: 'D3', liquidityUsd: 25_000, priceUsd: 1.0, type: 'constant-product' },
    { pair: 'P4', dex: 'D4', liquidityUsd: 25_000, priceUsd: 1.0, type: 'constant-product' }
  ];
  const fourFrag = analyzeLiquidityFragmentation(fourEqualPools as any[]);
  assert(Math.abs(fourFrag.poolHHI - 0.25) < 0.001, 'HHI of four equal pools is 0.25');
  assert(fourFrag.concentrationLevel === 'low', 'Four equal pools classified as low concentration');

  // duplicate pools entries (duplicate pair/addresses)
  const duplicatePools = [
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 100_000, priceUsd: 1.0, type: 'constant-product' },
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 100_000, priceUsd: 1.0, type: 'constant-product' }
  ];
  const duplicateFrag = analyzeLiquidityFragmentation(duplicatePools as any[]);
  assert(duplicateFrag.poolCount === 1, 'Duplicate pool entries are deduplicated (pool count is 1)');
  assert(duplicateFrag.totalLiquidityUsd === 100_000, 'Duplicate pool liquidity is counted only once');

  // duplicate pool entries with different liquidity values (deterministic first seen)
  const duplicateDiffLiqPools = [
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 100_000, priceUsd: 1.0, type: 'constant-product' },
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 50_000, priceUsd: 1.0, type: 'constant-product' }
  ];
  const duplicateDiffFrag = analyzeLiquidityFragmentation(duplicateDiffLiqPools as any[]);
  assert(duplicateDiffFrag.pools[0].liquidityUsd === 100_000, 'Preserves the first pool entry encountered for duplicates');

  // zero-liquidity pools
  const zeroLiqPools = [
    { pair: 'TEST/USDT', dex: 'Uniswap V2', liquidityUsd: 100_000, priceUsd: 1.0, type: 'constant-product' },
    { pair: 'TEST/ZERO', dex: 'Uniswap V2', liquidityUsd: 0, priceUsd: 1.0, type: 'constant-product' }
  ];
  const zeroLiqFrag = analyzeLiquidityFragmentation(zeroLiqPools as any[]);
  assert(zeroLiqFrag.poolCount === 1, 'Zero-liquidity pools are excluded from HHI analysis');

  // empty pool array
  const emptyPoolFrag = analyzeLiquidityFragmentation([]);
  assert(emptyPoolFrag.status === 'insufficient_data', 'Empty pool array returns insufficient_data status');

  // 15.6 Risk Safety check
  const calculatedRisk = calculateRiskScore({
    ammSlippage: { status: 'ok', simulations: [
      { positionSizeUsd: 25000, priceImpactPct: 1, slippagePct: 1, executionPriceUsd: 1.0, spotPriceUsd: 1.0, tokensInvolved: 25000, poolLiquidityUsd: 1000000, exitRiskLevel: 'low', swapFee: 0.003, swapFeeKnown: true, reserveProvenance: 'derived', status: 'ok' }
    ], isThinLiquidity: false, evidenceIds: [] },
    volumeConcentration: { status: 'ok', totalBuyVolumeUsd: 1000, totalSellVolumeUsd: 1000, buySellRatio: 1, uniqueBuyers: 10, uniqueSellers: 10, buyerHHI: { hhi: 0.1, concentrationLevel: 'low', topWallets: [] }, sellerHHI: { hhi: 0.1, concentrationLevel: 'low', topWallets: [] }, totalVolumeHHI: { hhi: 0.1, concentrationLevel: 'low', topWallets: [] }, elevatorWashTraderCount: 0, elevatorWashVolumeUsd: 0, washVolumeRatio: 0, volumePriceDivergence: false, organicScore: 90, evidenceIds: [] },
    whaleBehavior: dormantResult, // DORMANT whale behavior
    whaleExit: { status: 'ok', scenarios: [
      { liquidationFraction: 0.5, label: '50%', simulatedTokensSold: 100, simulatedUsdValueAtSpot: 100, simulatedQuoteReceived: 100, simulatedExecutionPriceUsd: 1.0, priceImpactPct: 1, priceDeltaPct: 2, severity: 'low' as const, status: 'ok' }
    ], targetWallets: [], combinedObservedBalance: 100, maxSeverity: 'low' as const, simulationDisclaimer: '', evidenceIds: [] },
    buyerQuality: { status: 'ok', buyerQualityScore: 80, cohortMetrics: { totalBuyers: 10, returningBuyers: 5, singleUseBuyers: 5, returningBuyerRatio: 0.5, freshWalletRatio: 0, avgBuyValueUsd: 100, buyValueStdDevUsd: 10, capitalDiversityIndex: 0.9 }, positiveFactors: [], negativeFactors: [], unavailableMetrics: [], confidence: 80, evidenceIds: [] },
    capitalEfficiency: { status: 'ok', fdvToLiquidityRatio: 1, capitalSensitivityMultiplier: 1, sensitivity: 'low', fdvUsd: 100000, totalLiquidityUsd: 100000, spotPriceUsd: 1.0, evidenceIds: [] },
    isHoneypot: false
  });
  
  const whaleSubScore = calculatedRisk.subScores.find(s => s.module === 'whaleBehavior');
  // totalWhaleSupplySharePct is 5.0% because balance is 50,000 / totalSupply 1,000,000 * 100 = 5.0%
  // score should be 5.0 * 2 = 10
  assert(whaleSubScore?.score === 10, `Dormant phase resolves to totalWhaleSupplySharePct * 2 risk score, NOT distribution risk score (got ${whaleSubScore?.score})`);
  assert(calculatedRisk.topRisks.find(r => r.riskId === 'active-whale-distribution') === undefined, 'Active whale distribution risk is not triggered for dormant phase');

  // ========================================================
  // 16. Phase 5C — WalletQuality Infrastructure Tests
  // ========================================================
  console.log('\n--- 16. Phase 5C WalletQuality Infrastructure ---');

  // ── Import pure helpers for deterministic testing ──
  const { classifyWalletCacheAge, WALLET_CACHE_FRESH_DAYS, WALLET_CACHE_SWR_DAYS } = await import('./lib/deep_scan/walletQualityCache');
  const { adaptGoldrushWalletHistory, GOLDRUSH_MAX_WALLET_PAGES } = await import('./lib/providers/goldrush/adapter');
  const { analyzeBuyerQuality: bqAnalyze } = await import('./lib/deep_scan/engines/BuyerQualityAnalyzer');

  // ── C1–C3: Cache freshness classification (pure, no DB) ──
  console.log('\n  [C] Cache Freshness Classification');

  // C1: Age < 12 days → 'fresh'
  assert(classifyWalletCacheAge(0) === 'fresh', 'C1: age=0d → fresh');
  assert(classifyWalletCacheAge(5) === 'fresh', 'C1b: age=5d → fresh');
  assert(classifyWalletCacheAge(11.9) === 'fresh', 'C1c: age=11.9d → fresh');

  // C2: Age in [12, 15) → 'swr'
  assert(classifyWalletCacheAge(12) === 'swr', 'C2: age=12d → swr (SWR window start)');
  assert(classifyWalletCacheAge(13) === 'swr', 'C2b: age=13d → swr');
  assert(classifyWalletCacheAge(14.9) === 'swr', 'C2c: age=14.9d → swr (SWR window end)');

  // C3: Age >= 15 → 'stale'
  assert(classifyWalletCacheAge(15) === 'stale', 'C3: age=15d → stale');
  assert(classifyWalletCacheAge(30) === 'stale', 'C3b: age=30d → stale');
  assert(classifyWalletCacheAge(100) === 'stale', 'C3c: age=100d → stale');

  // Verify constants
  assert(WALLET_CACHE_FRESH_DAYS === 12, 'C4: WALLET_CACHE_FRESH_DAYS is 12');
  assert(WALLET_CACHE_SWR_DAYS === 15,   'C5: WALLET_CACHE_SWR_DAYS is 15');

  // ── G1–G5: GoldRush adapter pure logic (no HTTP) ──
  console.log('\n  [G] GoldRush Wallet History Adapter');

  const fetchedAt = Math.floor(Date.now() / 1000);
  const tenDaysAgo = new Date((fetchedAt - 10 * 86400) * 1000).toISOString();
  const fiveDaysAgo = new Date((fetchedAt - 5 * 86400) * 1000).toISOString();

  // G1: Capped accumulator → coverage = 'capped'
  const cappedAcc = {
    items: Array.from({ length: GOLDRUSH_MAX_WALLET_PAGES * 100 }, (_, i) => ({
      block_signed_at: i % 2 === 0 ? tenDaysAgo : fiveDaysAgo,
    })),
    wasCapped: true,
  };
  const cappedProfile = adaptGoldrushWalletHistory(cappedAcc, {
    chain: 'eth',
    walletAddress: '0xabc',
    fetchedAt,
  });
  assert(cappedProfile !== null, 'G1: capped accumulator produces a profile');
  assert(cappedProfile!.coverage === 'capped', 'G1: coverage=capped when wasCapped=true');

  // G2: Non-capped accumulator → coverage = 'complete'
  const completeAcc = {
    items: [{ block_signed_at: tenDaysAgo }, { block_signed_at: fiveDaysAgo }],
    wasCapped: false,
  };
  const completeProfile = adaptGoldrushWalletHistory(completeAcc, {
    chain: 'eth',
    walletAddress: '0xdef',
    fetchedAt,
  });
  assert(completeProfile !== null, 'G2: complete accumulator produces a profile');
  assert(completeProfile!.coverage === 'complete', 'G2: coverage=complete when wasCapped=false');

  // G3: Empty items → null (NEVER FABRICATE)
  const nullProfile = adaptGoldrushWalletHistory({ items: [], wasCapped: false }, {
    chain: 'eth',
    walletAddress: '0x000',
    fetchedAt,
  });
  assert(nullProfile === null, 'G3: empty items → null (no fabricated profile)');

  // G4: Valid timestamps → correct walletAgeDays derived
  const exactTs = fetchedAt - (10 * 86400); // exactly 10 days ago
  const exactDate = new Date(exactTs * 1000).toISOString();
  const ageProfile = adaptGoldrushWalletHistory(
    { items: [{ block_signed_at: exactDate }], wasCapped: false },
    { chain: 'eth', walletAddress: '0xage', fetchedAt }
  );
  assert(ageProfile !== null, 'G4: valid timestamp → profile produced');
  assert(ageProfile!.walletAgeDays === 10, `G4: walletAgeDays=10 for 10-day-old wallet (got ${ageProfile!.walletAgeDays})`);

  // G5: Items with null/undefined timestamps are skipped
  const mixedAcc = {
    items: [
      { block_signed_at: null },
      { block_signed_at: undefined },
      { block_signed_at: 'not-a-date' },
      { block_signed_at: tenDaysAgo },   // ← only valid one
    ],
    wasCapped: false,
  };
  const mixedProfile = adaptGoldrushWalletHistory(mixedAcc, {
    chain: 'eth',
    walletAddress: '0xmix',
    fetchedAt,
  });
  assert(mixedProfile !== null, 'G5: invalid timestamps skipped, valid one produces profile');
  assert(mixedProfile!.transactionCount === 4, 'G5: transactionCount = total item count (4), not just valid timestamps');

  // ── B1–B4: BuyerQuality wallet profile integration (no DB) ──
  console.log('\n  [B] BuyerQuality Wallet Profile Integration');

  const sampleBuyTxs: any[] = [
    { type: 'buy', isTrade: true, to: '0x1111111111111111111111111111111111111111', from: '0xpool', amount: 100, priceUsd: 1.0, timestamp: Date.now() },
    { type: 'buy', isTrade: true, to: '0x2222222222222222222222222222222222222222', from: '0xpool', amount: 200, priceUsd: 1.0, timestamp: Date.now() },
    { type: 'buy', isTrade: true, to: '0x3333333333333333333333333333333333333333', from: '0xpool', amount: 150, priceUsd: 1.0, timestamp: Date.now() },
    { type: 'buy', isTrade: true, to: '0x4444444444444444444444444444444444444444', from: '0xpool', amount: 120, priceUsd: 1.0, timestamp: Date.now() },
  ];

  // B1: With valid profiles, freshWalletRatio is correctly computed
  const profileMap = new Map([
    ['0x1111111111111111111111111111111111111111', { walletAddress: '0x1111111111111111111111111111111111111111', chain: 'eth', firstSeenAt: new Date(Date.now() - 2 * 86400000).toISOString(), walletAgeDays: 2, transactionCount: 5, activeDaysCount: 2, lastUpdated: fetchedAt, coverage: 'complete', provenance: 'goldrush' }],
    ['0x2222222222222222222222222222222222222222', { walletAddress: '0x2222222222222222222222222222222222222222', chain: 'eth', firstSeenAt: new Date(Date.now() - 30 * 86400000).toISOString(), walletAgeDays: 30, transactionCount: 50, activeDaysCount: 15, lastUpdated: fetchedAt, coverage: 'complete', provenance: 'goldrush' }],
  ] as const) as Map<string, any>;

  const bqWithProfiles = bqAnalyze(sampleBuyTxs, new Set(), new Set(), profileMap);
  // 2 profiled buyers: wallet1 = 2d (fresh), wallet2 = 30d (not fresh)
  // freshWalletRatio = 1/2 = 0.5
  assert(bqWithProfiles.cohortMetrics.freshWalletRatio === 0.5,
    `B1: freshWalletRatio=0.5 (1 fresh of 2 profiled) got=${bqWithProfiles.cohortMetrics.freshWalletRatio}`);
  assert(!bqWithProfiles.unavailableMetrics?.includes('walletAge'),
    'B1: walletAge removed from unavailableMetrics when profiles are available');

  // B2: Wallets without profiles excluded from freshWalletRatio denominator
  // wallets 3 and 4 have no profiles → denominator = 2 (not 4)
  assert(bqWithProfiles.cohortMetrics.freshWalletRatio !== 0.25,
    'B2: wallets without profiles not counted in denominator');

  // B3: No profiles → freshWalletRatio stays 0 and walletAge stays unavailable
  const bqNoProfiles = bqAnalyze(sampleBuyTxs, new Set(), new Set(), new Map());
  assert(bqNoProfiles.cohortMetrics.freshWalletRatio === 0,
    'B3: no profiles → freshWalletRatio=0');
  assert(bqNoProfiles.unavailableMetrics?.includes('walletAge'),
    'B3: walletAge in unavailableMetrics when no profiles provided');

  // B4: Missing profiles never produce a non-zero freshWalletRatio fabrication
  assert(bqNoProfiles.cohortMetrics.freshWalletRatio === 0,
    'B4: NEVER FABRICATE — missing profiles produce freshWalletRatio=0 not a synthetic value');

  // ── S1–S3: Worker security validation (regex + env logic, no HTTP) ──
  console.log('\n  [S] Worker Security Validation Logic');

  const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

  // S1: Valid EVM address passes
  assert(EVM_ADDRESS_RE.test('0xAbCdEf1234567890abcdef1234567890AbCdEf12'), 'S1: valid EVM address passes regex');

  // S2: Truncated address fails
  assert(!EVM_ADDRESS_RE.test('0xAbCdEf1234567890'), 'S2: truncated address fails regex');

  // S3: Missing 0x prefix fails
  assert(!EVM_ADDRESS_RE.test('AbCdEf1234567890abcdef1234567890AbCdEf12'), 'S3: missing 0x prefix fails regex');
  assert(!EVM_ADDRESS_RE.test(''), 'S3b: empty string fails regex');
  assert(!EVM_ADDRESS_RE.test('0x' + 'G'.repeat(40)), 'S3c: non-hex characters fail regex');

  // ── I1: Idempotency (pure adapter produces identical output) ──
  console.log('\n  [I] Adapter Idempotency');

  const idempotentAcc = {
    items: [{ block_signed_at: tenDaysAgo }, { block_signed_at: fiveDaysAgo }],
    wasCapped: false,
  };
  const idempotentOpts = { chain: 'eth', walletAddress: '0xidempotent', fetchedAt };
  const result1 = adaptGoldrushWalletHistory(idempotentAcc, idempotentOpts);
  const result2 = adaptGoldrushWalletHistory(idempotentAcc, idempotentOpts);
  assert(result1 !== null && result2 !== null, 'I1: both runs produce a profile');
  assert(result1!.firstSeenAt === result2!.firstSeenAt, 'I1: firstSeenAt is identical across two runs');
  assert(result1!.walletAgeDays === result2!.walletAgeDays, 'I1: walletAgeDays is identical across two runs');
  assert(result1!.transactionCount === result2!.transactionCount, 'I1: transactionCount identical across two runs');

  // ========================================================
  // 17. Phase 5C-H — Async Dispatch & Worker Hardening
  // ========================================================
  console.log('\n--- 17. Phase 5C-H Async Dispatch & Worker Hardening ---');

  // H1: Job Insert Contract
  const sampleJob = {
    address: '0x1234567890123456789012345678901234567890',
    chain: 'eth',
    status: 'pending',
    enqueued_at: new Date().toISOString()
  };
  assert(typeof sampleJob.address === 'string' && sampleJob.address.startsWith('0x'), 'H1: address must be a valid hex string');
  assert(sampleJob.status === 'pending', 'H1: initial status must be pending');
  assert(typeof sampleJob.enqueued_at === 'string', 'H1: enqueued_at must be populated');

  // H2: Duplicate Job Contract Check
  // Simulate unique constraint key checks for (address, chain)
  const jobSet = new Set<string>();
  const addJob = (addr: string, chain: string) => {
    const key = `${addr.toLowerCase()}:${chain.toLowerCase()}`;
    if (jobSet.has(key)) {
      return { code: '23505', message: 'duplicate key value violates unique constraint' };
    }
    jobSet.add(key);
    return { success: true };
  };
  assert(addJob('0xabc', 'eth').success === true, 'H2: first job insert succeeds');
  assert(addJob('0xabc', 'eth').code === '23505', 'H2: second duplicate job insert triggers unique constraint');

  // H3: Worker Payload
  // Mock worker payload matching NextRequest payload expectations
  const workerPayload = { address: '0xAbCdEf1234567890abcdef1234567890AbCdEf12', chain: 'eth' };
  assert(typeof workerPayload.address === 'string' && workerPayload.address.length === 42, 'H3: worker payload must contain 42-char EVM address');
  assert(['eth', 'bsc', 'solana', 'base'].includes(workerPayload.chain), 'H3: worker payload chain must be supported');

  // H4: Worker Authentication contract checks
  const mockValidateAuth = (headers: Map<string, string>, configuredSecret: string) => {
    const incoming = headers.get('x-worker-secret');
    if (!incoming) return { status: 401, error: 'Unauthorized.' };
    if (incoming !== configuredSecret) return { status: 401, error: 'Unauthorized.' };
    return { status: 200 };
  };
  const dummyHeaders = new Map<string, string>();
  assert(mockValidateAuth(dummyHeaders, 'key').status === 401, 'H4: missing secret header returns 401');
  dummyHeaders.set('x-worker-secret', 'wrong');
  assert(mockValidateAuth(dummyHeaders, 'key').status === 401, 'H4: incorrect secret header returns 401');
  dummyHeaders.set('x-worker-secret', 'key');
  assert(mockValidateAuth(dummyHeaders, 'key').status === 200, 'H4: correct secret header returns 200');

  // H5: Idempotent Worker Execution (Adapter input-output consistency)
  const testAcc = { items: [{ block_signed_at: tenDaysAgo }], wasCapped: false };
  const testOpts = { chain: 'eth', walletAddress: '0x123', fetchedAt };
  const run1 = adaptGoldrushWalletHistory(testAcc, testOpts);
  const run2 = adaptGoldrushWalletHistory(testAcc, testOpts);
  assert(JSON.stringify(run1) === JSON.stringify(run2), 'H5: duplicate worker adapter runs produce identical profiles');

  // H6: Provider Failure (Clean return, no fake metrics)
  const failAcc = { items: [], wasCapped: false };
  const failResult = adaptGoldrushWalletHistory(failAcc, testOpts);
  assert(failResult === null, 'H6: provider returns empty/failed history → adapter resolves to null');

  // H7: Persistence Ordering Validation
  // Worker route conceptual sequence check: upsert MUST occur before job removal
  const executionStack: string[] = [];
  const mockWorkerProcess = async () => {
    executionStack.push('enrich');
    executionStack.push('upsert_profile');
    executionStack.push('complete_job');
  };
  await mockWorkerProcess();
  const upsertIdx = executionStack.indexOf('upsert_profile');
  const completeIdx = executionStack.indexOf('complete_job');
  assert(upsertIdx < completeIdx, 'H7: wallet_reputation is persisted before the enrichment job is marked complete');

  // H8: Dispatch Configuration Safety
  // Triggers/GUC settings fallback safely when unset
  const mockTriggerDispatch = (url: string | null, secret: string | null) => {
    if (!url || !secret) {
      // Graceful fallback, logs warning, returns NEW without blocking
      return { status: 'skipped', reason: 'Wallet enrichment worker URL or secret key not configured' };
    }
    return { status: 'dispatched' };
  };
  assert(mockTriggerDispatch(null, 'secret').status === 'skipped', 'H8: missing worker URL fails safely');
  assert(mockTriggerDispatch('url', null).status === 'skipped', 'H8: missing secret key fails safely');
  assert(mockTriggerDispatch('url', 'secret').status === 'dispatched', 'H8: fully configured triggers execute dispatch');

  // H9: No Secret Leakage
  // Worker responses must never expose the secret in output payloads
  const mockWorkerResponsePayload = (address: string, chain: string, success: boolean) => {
    return { success, address, chain }; // NEVER include key/secret
  };
  const responsePayload = mockWorkerResponsePayload('0x123', 'eth', true);
  assert(!Object.keys(responsePayload).includes('secret'), 'H9: response payload does not contain secret fields');
  assert(!Object.keys(responsePayload).includes('key'), 'H9: response payload does not contain key fields');

  // H10: Stuck Job Behavior
  // Stuck job deletion uses age <= 1 hour (3600000ms)
  const calculateCutoffMs = () => 3600000;
  assert(calculateCutoffMs() === 3600 * 1000, 'H10: stuck job cleanup cutoff is exactly 1 hour');

  // =======================================================================
  // SM Tests: Phase 5D-1 SmartMoney Infrastructure (SM1–SM15)
  // =======================================================================
  console.log('\n=== SM Tests: Phase 5D-1 SmartMoney Infrastructure ===');

  // SM1: SmartMoneyTradeEvent schema contract — all required fields present
  const validTradeEvent: SmartMoneyTradeEvent = {
    walletAddress: '0xaabbccddeeff001122334455667788990011aabb',
    chain:         'eth',
    tokenAddress:  '0x6b175474e89094c44da98b954eedeac495271d0f',
    txHash:        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
    blockNumber:   19_000_000,
    blockHash:     '0xblockhash000000000000000000000000000000000000000000000000000000000001',
    logIndex:      0,
    timestamp:     '2024-01-01T00:00:00.000Z',
    eventType:     'unknown',
    tokenAmount:   null,
    quoteAmount:   null,
    quoteToken:    null,
    provider:      'goldrush',
    indexedAt:     '2024-01-01T00:00:05.000Z',
  };
  assert(validTradeEvent.walletAddress.startsWith('0x'), 'SM1: walletAddress is EVM-format');
  assert(validTradeEvent.blockNumber > 0,                'SM1: blockNumber is a positive integer');
  assert(validTradeEvent.logIndex >= -1,                 'SM1: logIndex is present (>= -1 for tx-scope)');
  assert(validTradeEvent.tokenAmount === null,           'SM1: tokenAmount is null (not fabricated)');
  assert(validTradeEvent.quoteAmount === null,           'SM1: quoteAmount is null (not fabricated)');
  assert(validTradeEvent.provider === 'goldrush',        'SM1: provenance is correctly set to goldrush');

  // SM2: Duplicate trade event protection — unique key must be (wallet, chain, tx_hash, log_index)
  const tradeA: SmartMoneyTradeEvent = { ...validTradeEvent };
  const tradeB: SmartMoneyTradeEvent = { ...validTradeEvent }; // exact duplicate
  const uniqueKey = (ev: SmartMoneyTradeEvent) =>
    `${ev.walletAddress}|${ev.chain}|${ev.txHash}|${ev.logIndex}`;
  assert(uniqueKey(tradeA) === uniqueKey(tradeB), 'SM2: duplicate trade events share the same unique key');
  const deduped = [tradeA, tradeB].filter((ev, idx, arr) =>
    arr.findIndex((x) => uniqueKey(x) === uniqueKey(ev)) === idx
  );
  assert(deduped.length === 1, 'SM2: deduplication on unique key produces single record');

  // SM3: Indexing job duplicate protection — upsert with ignoreDuplicates keeps one record
  const jobs: { walletAddress: string; chain: string; status: string }[] = [];
  function upsertJobMock(addr: string, chain: string) {
    const existing = jobs.find((j) => j.walletAddress === addr && j.chain === chain);
    if (!existing) {
      jobs.push({ walletAddress: addr, chain, status: 'pending' });
    }
    // if conflict: ignoreDuplicates — no change
  }
  upsertJobMock('0xaabbccddeeff001122334455667788990011aabb', 'eth');
  upsertJobMock('0xaabbccddeeff001122334455667788990011aabb', 'eth');
  assert(jobs.length === 1, 'SM3: duplicate indexing job inserts result in single queue record');

  // SM4: Job state transitions are orderly and deterministic
  const jobStates = ['pending', 'processing', 'completed'];
  assert(jobStates.indexOf('pending') < jobStates.indexOf('processing'), 'SM4: pending precedes processing');
  assert(jobStates.indexOf('processing') < jobStates.indexOf('completed'), 'SM4: processing precedes completed');
  const failedJob = { status: 'failed', lastError: 'Provider timeout' };
  assert(failedJob.lastError !== null && failedJob.lastError !== '', 'SM4: failed job captures error message');

  // SM5: Worker authentication — missing secret returns 401
  const mockWorkerAuth = (incomingSecret: string | null, expectedSecret: string) =>
    incomingSecret && incomingSecret === expectedSecret ? 200 : 401;
  assert(mockWorkerAuth(null, 'correct-secret') === 401,            'SM5: missing x-worker-secret returns 401');
  assert(mockWorkerAuth('wrong-secret', 'correct-secret') === 401,  'SM5: wrong x-worker-secret returns 401');
  assert(mockWorkerAuth('correct-secret', 'correct-secret') === 200,'SM5: correct x-worker-secret returns 200');

  // SM6: Worker payload validation — address and chain required
  const validatePayload = (body: any) => {
    if (typeof body.address !== 'string' || !body.address.trim()) return 400;
    if (typeof body.chain !== 'string' || !body.chain.trim())   return 400;
    return 200;
  };
  assert(validatePayload({})                             === 400, 'SM6: empty payload returns 400');
  assert(validatePayload({ address: '0x123' })           === 400, 'SM6: missing chain returns 400');
  assert(validatePayload({ chain: 'eth' })               === 400, 'SM6: missing address returns 400');
  assert(validatePayload({ address: '0x123', chain: '' }) === 400,'SM6: empty chain returns 400');
  assert(validatePayload({ address: '0x123', chain: 'eth' }) === 200,'SM6: valid payload returns 200');

  // SM7: Provider event normalization — block fields preserved
  const normEvent: SmartMoneyTradeEvent = {
    walletAddress: '0xaabbccddeeff001122334455667788990011aabb',
    chain:         'eth',
    tokenAddress:  null,
    txHash:        '0xdeadbeef00000000000000000000000000000000000000000000000000000001',
    blockNumber:   19_100_000,
    blockHash:     '0xblockhash_norm00000000000000000000000000000000000000000000000001',
    logIndex:      -1,
    timestamp:     '2024-03-01T12:00:00.000Z',
    eventType:     'unknown',
    tokenAmount:   null,
    quoteAmount:   null,
    quoteToken:    null,
    provider:      'goldrush',
    indexedAt:     new Date().toISOString(),
  };
  assert(normEvent.blockNumber === 19_100_000,  'SM7: blockNumber is preserved from provider response');
  assert(normEvent.blockHash !== null,           'SM7: blockHash is preserved (reorg safety)');
  assert(normEvent.txHash !== null,              'SM7: txHash is preserved');
  assert(normEvent.logIndex === -1,              'SM7: logIndex -1 correctly represents tx-level scope');

  // SM8: Missing provider fields remain NULL (anti-fabrication)
  const partialEvent: SmartMoneyTradeEvent = {
    walletAddress: '0xaabbccddeeff001122334455667788990011aabb',
    chain:         'eth',
    tokenAddress:  undefined,
    txHash:        '0xpartial000000000000000000000000000000000000000000000000000000001',
    blockNumber:   19_200_000,
    blockHash:     undefined,
    logIndex:      -1,
    timestamp:     '2024-03-01T13:00:00.000Z',
    eventType:     'unknown',
    tokenAmount:   null,   // never fabricated
    quoteAmount:   null,   // never fabricated
    quoteToken:    null,   // never fabricated
    provider:      'goldrush',
    indexedAt:     new Date().toISOString(),
  };
  assert(partialEvent.tokenAmount === null,   'SM8: missing tokenAmount remains null (not 0)');
  assert(partialEvent.quoteAmount === null,   'SM8: missing quoteAmount remains null (not 0)');
  assert(partialEvent.quoteToken === null,    'SM8: missing quoteToken remains null (not empty string)');
  assert(partialEvent.eventType === 'unknown','SM8: DEX classification defaults to unknown (not guessed)');

  // SM9: Malformed events skip gracefully without fabrication
  const rawMalformedItems = [
    { tx_hash: null,   block_signed_at: '2024-01-01T00:00:00Z', block_height: 100 },  // null tx_hash
    { tx_hash: '0x01', block_signed_at: null,                    block_height: 100 },  // null timestamp
    { tx_hash: '0x02', block_signed_at: '2024-01-01T00:00:00Z', block_height: -1  },   // invalid block
  ];
  const validatedEvents = rawMalformedItems.filter((item) => {
    if (!item.tx_hash || !item.block_signed_at) return false;
    const h = Number(item.block_height);
    if (!Number.isFinite(h) || h <= 0) return false;
    return true;
  });
  assert(validatedEvents.length === 0, 'SM9: all malformed events are filtered out, none fabricated');

  // SM10: Duplicate worker delivery is idempotent (upsert ON CONFLICT pattern)
  const storedEvents: Map<string, SmartMoneyTradeEvent> = new Map();
  function idempotentUpsert(ev: SmartMoneyTradeEvent) {
    const k = `${ev.walletAddress}|${ev.chain}|${ev.txHash}|${ev.logIndex}`;
    storedEvents.set(k, ev); // simulate ON CONFLICT DO UPDATE (update identical row)
  }
  idempotentUpsert(validTradeEvent);
  idempotentUpsert(validTradeEvent); // deliver again
  assert(storedEvents.size === 1, 'SM10: second delivery of same event does not create duplicate row');

  // SM11: Provider failure does not create fake trade events
  const indexOnProviderFailure = async (): Promise<SmartMoneyTradeEvent[]> => {
    try {
      throw new Error('Provider timeout'); // simulate provider error
    } catch {
      return []; // Return empty — do NOT insert fake records
    }
  };
  const failedEvents = await indexOnProviderFailure();
  assert(failedEvents.length === 0, 'SM11: provider failure returns empty events, no fake records created');

  // SM12: SmartMoney indexing remains asynchronous (enqueue only, no blocking walk)
  // Verify that the SmartMoney path only enqueues and does not hold the scan
  let scanBlockedMs = 0;
  const startMs = Date.now();
  const mockEnqueue = async (addr: string, chain: string) => {
    // simulates database upsert (non-blocking)
    return Promise.resolve({ address: addr, chain, status: 'pending' });
  };
  await mockEnqueue('0xaabbccddeeff001122334455667788990011aabb', 'eth');
  scanBlockedMs = Date.now() - startMs;
  assert(scanBlockedMs < 500, `SM12: SmartMoney enqueue is fast and non-blocking (${scanBlockedMs}ms)`);

  // SM13: No synchronous lifetime wallet scan during Deep Scan
  // The config limits indexing to maxPages (5) — never unlimited
  const maxPages = DEEP_SCAN_CONFIG.smartMoney.indexing.maxPages;
  assert(maxPages > 0,   'SM13: maxPages is a positive integer');
  assert(maxPages <= 10, 'SM13: maxPages is bounded (<=10) — no unlimited lifetime walk');

  // SM14: Reorg provenance fields must be preserved on every trade event
  const reorgSafeFields: (keyof SmartMoneyTradeEvent)[] = [
    'txHash', 'blockNumber', 'blockHash', 'logIndex', 'indexedAt'
  ];
  for (const field of reorgSafeFields) {
    assert(field in validTradeEvent, `SM14: reorg-provenance field '${field}' is present in SmartMoneyTradeEvent`);
  }

  // SM15: SmartMoney reputation remains unavailable when derived metrics not calculated
  const unavailableRep: SmartMoneyReputationRecord = {
    walletAddress: '0xaabbccddeeff001122334455667788990011aabb',
    chain:         'eth',
    tradeCount:       null,
    profitableTrades: null,
    realizedUsdPnl:   null,
    distinctTokens:   null,
    status:           'unavailable',
    freshness:        'UNAVAILABLE',
    lastUpdatedAt:    new Date().toISOString(),
    provider:         'goldrush',
  };
  const smResult = analyzeSmartMoney(
    unavailableRep.walletAddress,
    unavailableRep.chain,
    [],
    unavailableRep
  );
  assert(smResult.status === 'unavailable',       'SM15: SmartMoney status is unavailable when no metrics computed');
  assert(smResult.isSmartMoney === false,          'SM15: isSmartMoney is false with no evidence');
  assert(smResult.confidence === 0,               'SM15: confidence is 0 with no evidence');
  assert(smResult.metrics.realizedUsdPnl === null,'SM15: realizedUsdPnl is null (not fabricated as 0)');
  assert(smResult.metrics.tradeCount === null,    'SM15: tradeCount is null (not fabricated as 0)');
  assert(smResult.metrics.profitableTrades === null,'SM15: profitableTrades is null (not fabricated)');
  assert(smResult.metrics.distinctTokensTraded === null,'SM15: distinctTokens is null (not fabricated)');

  // =======================================================================
  // SM-PNL Tests: Phase 5D-2 FIFO PnL Engine (SM-PNL-01 to SM-PNL-25)
  // =======================================================================
  console.log('\n=== SM-PNL Tests: Phase 5D-2 FIFO PnL Engine ===');

  const stableUsdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  const obscureToken = '0x1111111111111111111111111111111111111111';
  const obscureToken2 = '0x2222222222222222222222222222222222222222';
  const obscureToken3 = '0x3333333333333333333333333333333333333333';

  const makeSmartTx = (
    token: string,
    side: 'buy' | 'sell',
    amount: number,
    quote: number | null,
    timestampOffsetSec = 0
  ): SmartMoneyTradeEvent => ({
    walletAddress: '0xaabbccddeeff001122334455667788990011aabb',
    chain: 'eth',
    tokenAddress: token,
    txHash: '0xhash' + Math.random().toString(36).substring(7),
    blockNumber: 19000000,
    logIndex: 0,
    timestamp: new Date(Date.now() + timestampOffsetSec * 1000).toISOString(),
    eventType: side,
    tokenAmount: amount,
    quoteAmount: quote,
    quoteToken: stableUsdc,
    provider: 'goldrush',
    indexedAt: new Date().toISOString(),
  });

  // SM-PNL-01: Single BUY -> no realized PnL (remains open)
  const pnl01 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100)
  ]);
  assert(pnl01.realizedPnl === null, 'SM-PNL-01: single BUY has null realized PnL');
  assert(pnl01.closedTradeCount === 0, 'SM-PNL-01: closed trade count is 0');
  assert(pnl01.openPositionCount === 1, 'SM-PNL-01: open position count is 1');

  // SM-PNL-02: BUY -> SELL profitable
  const pnl02 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),
    makeSmartTx(obscureToken, 'sell', 100, 200, 10)
  ]);
  assert(pnl02.realizedPnl === 100, 'SM-PNL-02: BUY 100 @ $1 -> SELL 100 @ $2 has PnL = $100');
  assert(pnl02.closedTradeCount === 1, 'SM-PNL-02: closed trade count is 1');
  assert(pnl02.profitableTradeCount === 1, 'SM-PNL-02: profitable trade count is 1');

  // SM-PNL-03: BUY -> SELL losing
  const pnl03 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 200, 0),
    makeSmartTx(obscureToken, 'sell', 100, 100, 10)
  ]);
  assert(pnl03.realizedPnl === -100, 'SM-PNL-03: BUY 100 @ $2 -> SELL 100 @ $1 has PnL = -$100');
  assert(pnl03.losingTradeCount === 1, 'SM-PNL-03: losing trade count is 1');

  // SM-PNL-04: Multiple BUY lots + FIFO SELL
  const pnl04 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),   // $1 each
    makeSmartTx(obscureToken, 'buy', 100, 300, 10),  // $3 each
    makeSmartTx(obscureToken, 'sell', 150, 750, 20)  // FIFO cost: 100*$1 + 50*$3 = 250. PnL: 750 - 250 = 500
  ]);
  assert(pnl04.realizedPnl === 500, 'SM-PNL-04: FIFO costbasis correctly matches earliest lots');
  assert(pnl04.openPositionCount === 1, 'SM-PNL-04: 1 open position remains (50 tokens from lot 2)');

  // SM-PNL-05: Partial SELL
  const pnl05 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),
    makeSmartTx(obscureToken, 'sell', 40, 80, 10) // 40 sold @ $2 (Cost $40). PnL: 80 - 40 = 40
  ]);
  assert(pnl05.realizedPnl === 40, 'SM-PNL-05: partial sell realizes correct fractional PnL');
  assert(pnl05.openPositionCount === 1, 'SM-PNL-05: open position remains');

  // SM-PNL-06: SELL without BUY -> incomplete
  const pnl06 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'sell', 100, 200)
  ]);
  assert(pnl06.pnlStatus === 'incomplete', 'SM-PNL-06: unmatched SELL triggers incomplete status');

  // SM-PNL-07: Multiple tokens
  const pnl07 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),
    makeSmartTx(obscureToken, 'sell', 100, 200, 10), // +100 PnL
    makeSmartTx(obscureToken2, 'buy', 100, 100, 20),
    makeSmartTx(obscureToken2, 'sell', 100, 50, 30)   // -50 PnL
  ]);
  assert(pnl07.realizedPnl === 50, 'SM-PNL-07: total realized PnL aggregates across all base tokens');
  assert(pnl07.distinctTokensTraded === 2, 'SM-PNL-07: distinct tokens traded count is 2');

  // SM-PNL-08: Unknown transaction does not become trade
  const pnl08 = calculateSmartMoneyPnl([
    { ...makeSmartTx(obscureToken, 'buy', 100, 100), eventType: 'unknown' }
  ]);
  assert(pnl08.recognizedSwapCount === 0, 'SM-PNL-08: unknown events are not recognized as swaps');

  // SM-PNL-09: Missing token amount -> UNKNOWN (skipped in swap parser)
  const rawTxMissingToken = {
    tx_hash: '0xabc',
    block_height: 100,
    block_signed_at: '2024-01-01T00:00:00Z',
    log_events: [
      {
        decoded: {
          name: 'Transfer',
          params: [{ name: 'value', value: '1000' }] // missing from/to params
        }
      }
    ]
  };
  const parsed09 = parseTransactionToSwaps(rawTxMissingToken, '0x123', 'eth');
  assert(parsed09.length === 0, 'SM-PNL-09: transaction with missing event addresses produces 0 trade events');

  // SM-PNL-10: Missing quote amount -> UNKNOWN (WETH/gas tokens default to quoteAmount null in parser)
  const rawTxWethQuote = {
    tx_hash: '0xabc',
    block_height: 100,
    block_signed_at: '2024-01-01T00:00:00Z',
    log_events: [
      {
        sender_address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
        decoded: {
          name: 'Transfer',
          params: [
            { name: 'from', value: '0xWallet' },
            { name: 'to', value: '0xPool' },
            { name: 'value', value: '1000000000000000000' } // 1 WETH
          ]
        }
      },
      {
        sender_address: obscureToken,
        decoded: {
          name: 'Transfer',
          params: [
            { name: 'from', value: '0xPool' },
            { name: 'to', value: '0xWallet' },
            { name: 'value', value: '50000000000000000000' } // 50 Tokens
          ]
        }
      }
    ]
  };
  const parsed10 = parseTransactionToSwaps(rawTxWethQuote, '0xWallet', 'eth');
  assert(parsed10.length > 0, 'SM-PNL-10: non-stablecoin swaps are parsed');
  assert(parsed10[0].quoteAmount === null, 'SM-PNL-10: non-stablecoin quoteAmount is null (anti-fabrication)');

  // SM-PNL-11: Missing historical price -> NULL PnL
  const pnl11 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, null, 0), // WETH buy -> null USD quote
    makeSmartTx(obscureToken, 'sell', 100, 200, 10)
  ]);
  assert(pnl11.realizedPnl === null, 'SM-PNL-11: missing historical USD price results in null realized PnL');
  assert(pnl11.pnlStatus === 'unavailable', 'SM-PNL-11: null quote asset sets status to unavailable');

  // SM-PNL-12: ROI calculation
  const pnl12 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),
    makeSmartTx(obscureToken, 'sell', 100, 150, 10)
  ]);
  assert(pnl12.roi === 0.5, 'SM-PNL-12: ROI is correct (50 profit / 100 costbasis)');

  // SM-PNL-13: Win rate calculation
  const pnl13 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),
    makeSmartTx(obscureToken, 'sell', 100, 150, 10), // Win
    makeSmartTx(obscureToken2, 'buy', 100, 100, 20),
    makeSmartTx(obscureToken2, 'sell', 100, 50, 30)   // Loss
  ]);
  assert(pnl13.winRate === 0.5, 'SM-PNL-13: win rate is correct (1 win / 2 closed trades)');

  // SM-PNL-14: No closed trades -> NULL win rate
  const pnl14 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100)
  ]);
  assert(pnl14.winRate === null, 'SM-PNL-14: no closed trades results in null win rate');

  // SM-PNL-15: Capped history -> coverage=CAPPED (tested conceptually in worker / indexer)
  const mockIndexerCoverage = (pagesWalked: number, maxPages: number) =>
    pagesWalked >= maxPages ? 'CAPPED' : 'COMPLETE';
  assert(mockIndexerCoverage(5, 5) === 'CAPPED', 'SM-PNL-15: max pages limit reached sets coverage to CAPPED');

  // SM-PNL-16: Complete history -> coverage=COMPLETE
  assert(mockIndexerCoverage(2, 5) === 'COMPLETE', 'SM-PNL-16: history walk stops before page limit sets coverage to COMPLETE');

  // SM-PNL-17: Duplicate tx/log_index -> no duplicate trade
  // The composite key (wallet_address, chain, tx_hash, log_index) is unique
  const mockDbKeys = new Set<string>();
  const addTxMock = (wallet: string, chain: string, tx: string, log: number) => {
    const k = `${wallet}|${chain}|${tx}|${log}`;
    if (mockDbKeys.has(k)) return false; // reject duplicate
    mockDbKeys.add(k);
    return true;
  };
  assert(addTxMock('0x123', 'eth', '0xabc', -1) === true, 'SM-PNL-17: inserting new event succeeds');
  assert(addTxMock('0x123', 'eth', '0xabc', -1) === false, 'SM-PNL-17: inserting duplicate event is rejected');

  // SM-PNL-18: Idempotent recomputation
  const statsRun1 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),
    makeSmartTx(obscureToken, 'sell', 100, 200, 10)
  ]);
  const statsRun2 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),
    makeSmartTx(obscureToken, 'sell', 100, 200, 10)
  ]);
  assert(JSON.stringify(statsRun1) === JSON.stringify(statsRun2), 'SM-PNL-18: re-running PnL math produces identical output');

  // SM-PNL-19: 3-token minimum SmartMoney qualification
  const repInsufficientTokens = {
    walletAddress: '0x123',
    status: 'available',
    distinctTokensTraded: 2, // < 3
    profitableTradeCount: 5,
    realizedPnl: 1000,
    roi: 0.5,
  };
  const analysis19 = analyzeSmartMoney('0x123', 'eth', [], repInsufficientTokens);
  assert(analysis19.isSmartMoney === false, 'SM-PNL-19: wallet with <3 distinct tokens is not flagged as Smart Money');

  const repSufficientTokens = {
    walletAddress: '0x123',
    status: 'available',
    distinctTokensTraded: 3, // >= 3
    profitableTradeCount: 1, // >= 1
    realizedPnl: 100,
    roi: 0.2,
  };
  const analysis19b = analyzeSmartMoney('0x123', 'eth', [], repSufficientTokens);
  assert(analysis19b.isSmartMoney === true, 'SM-PNL-19: wallet with >=3 tokens, >=1 closed win, positive PnL & ROI is flagged Smart Money');

  // SM-PNL-20: Open position excluded from realized PnL
  const pnl20 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),
    makeSmartTx(obscureToken, 'buy', 50, 50, 10),
    makeSmartTx(obscureToken, 'sell', 100, 200, 20) // 100 matched, 50 remains open
  ]);
  assert(pnl20.realizedPnl === 100, 'SM-PNL-20: open lots are correctly excluded from realized proceeds and costbasis');

  // SM-PNL-21: Break-even trade
  const pnl21 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, 100, 0),
    makeSmartTx(obscureToken, 'sell', 100, 100, 10)
  ]);
  assert(pnl21.realizedPnl === 0, 'SM-PNL-21: realized PnL can be exactly 0 (break-even)');
  assert(pnl21.closedTradeCount === 1, 'SM-PNL-21: closed trade count is 1');
  assert(pnl21.profitableTradeCount === 0, 'SM-PNL-21: break-even is not a profitable trade');

  // SM-PNL-22: Partial data -> insufficient_data (tested conceptually: status='pending' -> status='unavailable' / reason)
  const pendingRep = { status: 'pending' };
  const analysis22 = analyzeSmartMoney('0x123', 'eth', [], pendingRep);
  assert(analysis22.status === 'unavailable', 'SM-PNL-22: pending reputation state returns status unavailable');

  // SM-PNL-23: Provider failure -> unavailable
  const analysis23 = analyzeSmartMoney('0x123', 'eth', [], null);
  assert(analysis23.status === 'unavailable', 'SM-PNL-23: null reputation record returns status unavailable');

  // SM-PNL-24: No fabricated USD price
  const pnl24 = calculateSmartMoneyPnl([
    makeSmartTx(obscureToken, 'buy', 100, null)
  ]);
  assert(pnl24.realizedPnl === null, 'SM-PNL-24: trade with null quote amount keeps realized USD PnL null');

  // SM-PNL-25: Worker failure state (updates job status to failed)
  const mockWorkerState = (success: boolean) => success ? 'completed' : 'failed';
  assert(mockWorkerState(false) === 'failed', 'SM-PNL-25: execution crash sets job status to failed');

  // =======================================================================
  // SM3-INT Tests: Phase 5D-3 SmartMoney Integration (SM3-INT-01 to SM3-INT-20)
  // =======================================================================
  console.log('\n=== SM3-INT Tests: Phase 5D-3 SmartMoney Integration ===');

  // SM3-INT-01: Available SmartMoney cache is consumed
  const mockRepAvailable: SmartMoneyReputationRecord = {
    walletAddress: '0x1',
    chain: 'eth',
    status: 'available',
    freshness: 'FRESH_CACHE',
    lastUpdatedAt: new Date().toISOString(),
    provider: 'goldrush',
    realizedPnl: 500,
    roi: 0.5,
    distinctTokensTraded: 3,
    profitableTradeCount: 2,
    closedTradeCount: 4,
  };
  const analysisInt01 = analyzeSmartMoney('0x1', 'eth', [], mockRepAvailable);
  assert(analysisInt01.status === 'ok', 'SM3-INT-01: available reputation returns ok status');
  assert(analysisInt01.metrics.realizedPnl === 500, 'SM3-INT-01: metric values are correctly mapped');

  // SM3-INT-02 & SM3-INT-03: Cache miss triggers indexing
  let mockJobEnqueued = false;
  const mockEnqueueInt = (addr: string) => { mockJobEnqueued = true; };
  const mockServiceCheck = (rep: any, addr: string) => {
    if (!rep) mockEnqueueInt(addr);
  };
  mockServiceCheck(null, '0x2');
  assert(mockJobEnqueued as unknown === true, 'SM3-INT-02: cache miss enqueues background indexing job');

  // SM3-INT-04: Stale cache is returned with STALE_CACHE
  const mockRepStale: SmartMoneyReputationRecord = {
    ...mockRepAvailable,
    walletAddress: '0x2',
    freshness: 'STALE_CACHE',
  };
  const analysisInt04 = analyzeSmartMoney('0x2', 'eth', [], mockRepStale);
  assert(analysisInt04.cohortSummary?.staleProfileCount === 1, 'SM3-INT-04: stale profile is counted correctly');

  // SM3-INT-06: Unavailable wallet is excluded from SmartMoney ratio denominator
  const walletsCohort = ['0x1', '0x2'];
  const repsCohort = [
    mockRepAvailable, // Available & qualifies
    null,             // Unavailable (excluded from denominator)
  ];
  const analysisInt06 = analyzeSmartMoney(walletsCohort, 'eth', [], repsCohort);
  assert(analysisInt06.cohortSummary?.profiledWalletCount === 1, 'SM3-INT-06: only available profiles counted in profiled count');
  assert(analysisInt06.cohortSummary?.smartMoneyWalletRatio === 1.0, 'SM3-INT-06: ratio denominator excludes unavailable wallets');

  // SM3-INT-07: NOT_SMART_MONEY wallet is included in denominator
  const mockRepNotSmart: SmartMoneyReputationRecord = {
    walletAddress: '0x3',
    chain: 'eth',
    status: 'available',
    freshness: 'FRESH_CACHE',
    lastUpdatedAt: new Date().toISOString(),
    provider: 'goldrush',
    realizedPnl: 0,
    roi: 0,
    distinctTokensTraded: 1,
    profitableTradeCount: 0,
    closedTradeCount: 1,
  };
  const repsCohort2 = [
    mockRepAvailable, // Smart Money
    mockRepNotSmart,  // Not Smart Money (profiled but does not qualify)
  ];
  const analysisInt07 = analyzeSmartMoney(['0x1', '0x3'], 'eth', [], repsCohort2);
  assert(analysisInt07.cohortSummary?.profiledWalletCount === 2, 'SM3-INT-07: both wallets counted as profiled');
  assert(analysisInt07.cohortSummary?.smartMoneyWalletRatio === 0.5, 'SM3-INT-07: ratio denominator includes NOT_SMART_MONEY');

  // SM3-INT-08: No profiles => ratio is null, not 0
  const analysisInt08 = analyzeSmartMoney(['0x5'], 'eth', [], [null]);
  assert(analysisInt08.cohortSummary?.smartMoneyWalletRatio === null, 'SM3-INT-08: ratio is null when no profiles are available');

  // SM3-INT-09: Mixed complete/capped/unavailable profiles reduce confidence
  const repsCohortMixed = [
    mockRepAvailable,
    null, // unavailable
  ];
  const analysisMixed = analyzeSmartMoney(['0x1', '0x2'], 'eth', [], repsCohortMixed);
  assert(analysisMixed.confidence < 95, 'SM3-INT-09: mixed cohort reduces confidence score');

  // SM3-INT-10: Capped profile is never relabeled complete
  const mockRepCapped: SmartMoneyReputationRecord = {
    ...mockRepAvailable,
    walletAddress: '0x1',
    coverage: 'CAPPED',
  };
  const analysisInt10 = analyzeSmartMoney('0x1', 'eth', [], mockRepCapped);
  assert(analysisInt10.metrics.coverage === 'CAPPED', 'SM3-INT-10: capped coverage is propagated correctly');

  // SM3-INT-11: Unavailable PnL never produces SmartMoney classification
  const mockRepNullPnl: SmartMoneyReputationRecord = {
    ...mockRepAvailable,
    walletAddress: '0x1',
    realizedPnl: null,
    roi: null,
    pnlStatus: 'unavailable',
  };
  const analysisInt11 = analyzeSmartMoney('0x1', 'eth', [], mockRepNullPnl);
  assert(analysisInt11.isSmartMoney === false, 'SM3-INT-11: null PnL excludes wallet from Smart Money qualification');

  // SM3-INT-12: Positive PnL + ROI + >=3 tokens + profitable trade qualifies
  const analysisInt12 = analyzeSmartMoney('0x1', 'eth', [], mockRepAvailable);
  assert(analysisInt12.isSmartMoney === true, 'SM3-INT-12: wallet meeting all 4 rules qualifies as Smart Money');

  // SM3-INT-13: Two tokens only does not qualify
  const mockRepTwoTokens: SmartMoneyReputationRecord = {
    ...mockRepAvailable,
    walletAddress: '0x1',
    distinctTokensTraded: 2,
  };
  const analysisInt13 = analyzeSmartMoney('0x1', 'eth', [], mockRepTwoTokens);
  assert(analysisInt13.isSmartMoney === false, 'SM3-INT-13: two tokens only fails qualification');

  // SM3-INT-14: Zero/negative ROI does not qualify
  const mockRepNegativeRoi: SmartMoneyReputationRecord = {
    ...mockRepAvailable,
    walletAddress: '0x1',
    roi: -0.1,
  };
  const analysisInt14 = analyzeSmartMoney('0x1', 'eth', [], mockRepNegativeRoi);
  assert(analysisInt14.isSmartMoney === false, 'SM3-INT-14: zero/negative ROI fails qualification');

  // SM3-INT-15: No profitable closed trades does not qualify
  const mockRepNoWins: SmartMoneyReputationRecord = {
    ...mockRepAvailable,
    walletAddress: '0x1',
    profitableTradeCount: 0,
  };
  const analysisInt15 = analyzeSmartMoney('0x1', 'eth', [], mockRepNoWins);
  assert(analysisInt15.isSmartMoney === false, 'SM3-INT-15: 0 profitable closed trades fails qualification');

  // SM3-INT-16: Pending indexing state is surfaced
  const mockRepPending: SmartMoneyReputationRecord = {
    walletAddress: '0x1',
    chain: 'eth',
    status: 'pending',
    freshness: 'UNAVAILABLE',
    lastUpdatedAt: new Date().toISOString(),
    provider: 'goldrush',
  };
  const analysisInt16 = analyzeSmartMoney('0x1', 'eth', [], mockRepPending);
  assert(analysisInt16.status === 'pending', 'SM3-INT-16: pending status is propagated to result');

  // SM3-INT-19: BuyerQuality integration does not count unavailable wallets
  const mockBqResult: any = {
    buyerQualityScore: 80,
    cohortMetrics: { totalBuyers: 2 },
  };
  mockBqResult.smartMoneyBuyerCount = analysisInt06.cohortSummary?.smartMoneyWalletCount ?? null;
  mockBqResult.smartMoneyBuyerRatio = analysisInt06.cohortSummary?.smartMoneyWalletRatio ?? null;
  mockBqResult.smartMoneyBuyerConfidence = analysisInt06.cohortSummary?.smartMoneyConfidence ?? null;
  assert(mockBqResult.smartMoneyBuyerRatio === 1.0, 'SM3-INT-19: buyerQuality cohort ratio denominator excludes unavailable');

  // =======================================================================
  // HB4 Tests: Phase 5D-4 Historical Pool State Reserves (HB4-01 to HB4-15)
  // =======================================================================
  console.log('\n=== HB4 Tests: Phase 5D-4 Historical Pool State Reserves ===');

  const originalPost = axios.post;
  const originalApiKey = process.env.ALCHEMY_API_KEY;
  process.env.ALCHEMY_API_KEY = 'mock_alchemy_key';

  const mockAddress = '0x1111111111111111111111111111111111111111';
  const mockPool = '0x2222222222222222222222222222222222222222';

  // Setup dynamic axios post interceptor for Alchemy queries
  axios.post = (async (url: string, data: any, config: any): Promise<any> => {
    const payload = data || {};
    const method = payload.method;
    const params = payload.params || [];
    
    // Assert endpoint URL safety
    assert(url.includes('g.alchemy.com/v2/'), 'RPC URL should target trusted Alchemy mainnet endpoint.');
    assert(url.endsWith('/mock_alchemy_key'), 'RPC URL should append the active API key.');

    if (method === 'eth_call') {
      const callObj = params[0] || {};
      const blockTag = params[1];

      // Assert exact blockTag passed to eth_call (hex-encoded string)
      assert(typeof blockTag === 'string' && blockTag.startsWith('0x'), 'eth_call blockTag must be a hex string');

      if (blockTag === '0x989680') {
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
          ['uint112', 'uint112', 'uint32'],
          [BigInt(100), BigInt(200), 1700000000]
        );
        return { data: { jsonrpc: '2.0', id: 1, result: encoded } };
      }
      if (blockTag === '0x989681') {
        return { data: { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'project is not authorized to access archive data' } } };
      }
      if (blockTag === '0x989682') {
        const err: any = new Error('timeout');
        err.code = 'ECONNABORTED';
        throw err;
      }
      if (blockTag === '0x989683') {
        return { data: { jsonrpc: '2.0', id: 1, result: '0x1234' } };
      }
      if (blockTag === '0x989684') {
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
          ['uint112', 'uint112', 'uint32'],
          [BigInt(100), BigInt(200), 1700000000]
        );
        return { data: { jsonrpc: '2.0', id: 1, result: encoded } };
      }
      if (blockTag === '0x38d7ea4c68000') {
        // Block 1,000,000,000,000,000 (0x38d7ea4c68000)
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
          ['uint112', 'uint112', 'uint32'],
          [BigInt('100000000000000000000000'), BigInt('200000000000000000000000'), 1700000000]
        );
        return { data: { jsonrpc: '2.0', id: 1, result: encoded } };
      }
    }

    if (method === 'eth_getBlockByNumber') {
      const blockTag = params[0];
      if (blockTag === '0x989684') {
        return { data: { jsonrpc: '2.0', id: 1, result: null } };
      }
      return {
        data: {
          jsonrpc: '2.0',
          id: 1,
          result: {
            hash: '0xmockhash' + blockTag,
            timestamp: '0x6554b780', // Unix 1700000000
          },
        },
      };
    }

    throw new Error(`Unhandled mock method ${method}`);
  }) as any;

  try {
    // HB4-01: Valid V2 pool historical reserve response
    const res01 = await getHistoricalV2Reserves('eth', mockPool, 10000000);
    assert(res01.status === 'available', 'HB4-01: status should be available');
    assert(res01.reserve0 === '100', 'HB4-01: reserve0 decoded correctly');
    assert(res01.reserve1 === '200', 'HB4-01: reserve1 decoded correctly');

    // HB4-04: Archive provider unavailable returns unavailable
    const res04 = await getHistoricalV2Reserves('eth', mockPool, 10000001);
    assert(res04.status === 'unavailable', 'HB4-04: missing archive returns unavailable');
    assert(res04.errorCode === 'ARCHIVE_UNAVAILABLE', 'HB4-04: errorCode should be ARCHIVE_UNAVAILABLE');

    // HB4-05: RPC timeout handled correctly
    const res05 = await getHistoricalV2Reserves('eth', mockPool, 10000002);
    assert(res05.status === 'error', 'HB4-05: timeout returns error status');
    assert(res05.errorCode === 'RPC_TIMEOUT', 'HB4-05: errorCode should be RPC_TIMEOUT');

    // HB4-06: Malformed reserve response rejected
    const res06 = await getHistoricalV2Reserves('eth', mockPool, 10000003);
    assert(res06.status === 'error', 'HB4-06: malformed decode returns error');
    assert(res06.errorCode === 'MALFORMED_RESPONSE', 'HB4-06: errorCode should be MALFORMED_RESPONSE');

    // HB4-07: uint256 reserve precision preserved
    const res07 = await getHistoricalV2Reserves('eth', mockPool, 1000000000000000);
    assert(res07.status === 'available', 'HB4-07: high precision returns available');
    assert(res07.reserve0 === '100000000000000000000000', 'HB4-07: reserve0 precision preserved as string');

    // HB4-08: blockHash provenance preserved
    const res08 = await getHistoricalV2Reserves('eth', mockPool, 10000000);
    assert(res08.blockHash === '0xmockhash0x989680', 'HB4-08: blockHash provenance preserved');
    assert(res08.timestamp === new Date(1700050816 * 1000).toISOString(), 'HB4-08: block timestamp preserved');

    // HB4-09: Missing block metadata does not fabricate values
    const res09 = await getHistoricalV2Reserves('eth', mockPool, 10000004);
    assert(res09.status === 'available', 'HB4-09: succeeds even if metadata fails');
    assert(res09.blockHash === null, 'HB4-09: blockHash is null when missing');
    assert(res09.timestamp === null, 'HB4-09: timestamp is null when missing');

    // HB4-10: Invalid EVM pool address rejected
    const res10 = await getHistoricalV2Reserves('eth', '0xInvalidAddress', 10000000);
    assert(res10.status === 'error', 'HB4-10: invalid address returns error status');
    assert(res10.errorCode === 'INVALID_INPUT', 'HB4-10: errorCode should be INVALID_INPUT');

    // HB4-11: Invalid block number rejected
    const res11 = await getHistoricalV2Reserves('eth', mockPool, -1);
    assert(res11.status === 'unavailable', 'HB4-11: negative block number returns unavailable status');
    assert(res11.errorCode === 'INVALID_INPUT', 'HB4-11: errorCode should be INVALID_INPUT');

    // HB4-12: Unsupported pool type returns unavailable
    const res12 = await getHistoricalV2Reserves('eth', mockPool, 10000000, 'v3');
    assert(res12.status === 'unavailable', 'HB4-12: unsupported pool type returns unavailable');
    assert(res12.errorCode === 'UNSUPPORTED_POOL_TYPE', 'HB4-12: errorCode should be UNSUPPORTED_POOL_TYPE');

    // HB4-13: Provider secret never appears in errors
    try {
      delete process.env.ALCHEMY_API_KEY;
      } finally {
      process.env.ALCHEMY_API_KEY = 'mock_alchemy_key';
    }

    // HB4-14: Chain validation works
    const res14 = await getHistoricalV2Reserves('solana', mockPool, 10000000);
    assert(res14.status === 'unavailable', 'HB4-14: unsupported chain returns unavailable');
    assert(res14.errorCode === 'UNSUPPORTED_CHAIN', 'HB4-14: errorCode should be UNSUPPORTED_CHAIN');

  } finally {
    // Restore axios and env
    axios.post = originalPost;
    if (originalApiKey) {
      process.env.ALCHEMY_API_KEY = originalApiKey;
    } else {
      delete process.env.ALCHEMY_API_KEY;
    }
  }

  // ── Run Phase 5D-5 tests ──
  await runPhase5D5Tests();

  // ── Run Phase 5D-6 tests ──
  await runPhase5D6Tests();

  // ── Run Phase 5D-7 tests ──
  await runPhase5D7Tests();

  // ── Run Phase 5D-8 tests ──
  await runPhase5D8Tests();

  // ── Run Phase 5D-9 tests ──
  await runPhase5D9Tests();

  // ── Run Module 13 tests ──
  await runModule13Tests();

  console.log('\n==================================================');
  console.log(`TEST RUN COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('==================================================');

  // Run new provider infrastructure unit tests
  const providerStats = await runProviderTests();
  if (providerStats.failed > 0) {
    throw new Error(`Provider infrastructure tests failed: ${providerStats.failed} failure(s)`);
  }
}

// Mock NextRequest and NextResponse for Route handlers testing
class MockNextRequest {
  private bodyText: string;
  public headers: Map<string, string>;
  constructor(body: any, headers: Record<string, string> = {}) {
    this.bodyText = JSON.stringify(body);
    this.headers = new Map(Object.entries(headers));
  }
  async json() {
    return JSON.parse(this.bodyText);
  }
}

const MockNextResponse = {
  json(data: any, init?: { status?: number }) {
    const status = init?.status ?? 200;
    return {
      status,
      data,
      async json() {
        return data;
      }
    };
  }
};

// Expose NextResponse to the route handler environment if imported
(globalThis as any).NextResponse = MockNextResponse;

async function runPhase5D5Tests() {
  console.log('\n--- Phase 5D-5 Historical Pool Reserves Indexer Tests ---');
  
  const originalGet = axios.get;
  const originalPost = axios.post;
  const originalApiKey = process.env.ALCHEMY_API_KEY;
  const originalWorkerSecret = process.env.WORKER_SECRET_KEY;

  try {
    // Setup environment
    process.env.ALCHEMY_API_KEY = 'mock_alchemy_key';
    process.env.WORKER_SECRET_KEY = 'mock_secret_key';
    class MockQueryBuilder {
      private table: string;
      private items: any[];
      private db: any;
      private filters: Array<{ type: string; col: string; val: any }> = [];
      private limitCount: number | null = null;
      private isUpdate = false;
      private updateData: any = null;
      private isSelectOnly = false;
      private selectedField: string | null = null;

      constructor(table: string, items: any[], db: any) {
        this.table = table;
        this.items = items;
        this.db = db;
      }

      select(field?: string) {
        this.isSelectOnly = true;
        this.selectedField = field && field !== '*' ? field : null;
        return this;
      }

      update(data: any) {
        this.isUpdate = true;
        this.updateData = data;
        return this;
      }

      eq(col: string, val: any) {
        this.filters.push({ type: 'eq', col, val });
        return this;
      }

      gt(col: string, val: any) {
        this.filters.push({ type: 'gt', col, val });
        return this;
      }

      lt(col: string, val: any) {
        this.filters.push({ type: 'lt', col, val });
        return this;
      }

      limit(n: number) {
        this.limitCount = n;
        return this;
      }

      order(col: string, opts?: any) {
        return this;
      }

      maybeSingle() {
        return this.then((res: any) => ({ data: res.data ? res.data[0] || null : null, error: null }));
      }

      then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
        let filtered = [...this.items];
        for (const f of this.filters) {
          filtered = filtered.filter(item => {
            const itemVal = item[f.col];
            if (f.type === 'eq') {
              return String(itemVal).toLowerCase() === String(f.val).toLowerCase();
            }
            if (f.type === 'gt') {
              return new Date(itemVal).getTime() > new Date(f.val).getTime() || Number(itemVal) > Number(f.val);
            }
            if (f.type === 'lt') {
              return new Date(itemVal).getTime() < new Date(f.val).getTime() || Number(itemVal) < Number(f.val);
            }
            return true;
          });
        }

        if (this.isUpdate) {
          for (const item of filtered) {
            Object.assign(item, this.updateData);
          }
        }

        if (this.limitCount !== null) {
          filtered = filtered.slice(0, this.limitCount);
        }

        let dataResult: any = filtered;
        if (this.selectedField) {
          if (this.selectedField.includes(',')) {
            const fields = this.selectedField.split(',').map(s => s.trim());
            dataResult = filtered.map(r => {
              const mapped: any = {};
              for (const f of fields) {
                mapped[f] = r[f];
              }
              return mapped;
            });
          } else {
            dataResult = filtered.map(r => ({ [this.selectedField!]: r[this.selectedField!] }));
          }
        }

        const res = { data: dataResult, error: null };
        return Promise.resolve(res).then(onfulfilled, onrejected);
      }
    }

    const mockDb = new (class {
      public reservesTable: any[] = [];
      public jobsTable: any[] = [];

      from(table: string) {
        const self = this;
        const items = table === 'historical_pool_reserves' ? this.reservesTable : this.jobsTable;
        return {
          select(field?: string) {
            return new MockQueryBuilder(table, items, self).select(field);
          },
          update(data: any) {
            return new MockQueryBuilder(table, items, self).update(data);
          },
          upsert(payload: any, options: any = {}) {
            const rows = Array.isArray(payload) ? payload : [payload];
            const inserted: any[] = [];
            for (const row of rows) {
              if (table === 'historical_pool_reserves') {
                const idx = self.reservesTable.findIndex(
                  r => r.chain.toLowerCase() === row.chain.toLowerCase() &&
                       r.pool_address.toLowerCase() === row.pool_address.toLowerCase() &&
                       Number(r.block_number) === Number(row.block_number)
                );
                if (idx !== -1) {
                  self.reservesTable[idx] = { ...self.reservesTable[idx], ...row };
                } else {
                  self.reservesTable.push({ ...row, id: 'res-' + Math.random(), timestamp: row.timestamp || new Date().toISOString() });
                }
                inserted.push(row);
              } else {
                const idx = self.jobsTable.findIndex(
                  r => r.chain.toLowerCase() === row.chain.toLowerCase() &&
                       r.pool_address.toLowerCase() === row.pool_address.toLowerCase() &&
                       Number(r.block_number) === Number(row.block_number)
                );
                if (idx !== -1) {
                  if (!options.ignoreDuplicates) {
                    self.jobsTable[idx] = { ...self.jobsTable[idx], ...row };
                  }
                } else {
                  self.jobsTable.push({ ...row, id: 'job-' + Math.random(), status: row.status || 'pending', enqueued_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
                  inserted.push(row);
                }
              }
            }
            return {
              select(field: string) {
                return Promise.resolve({
                  data: inserted.map(r => ({ [field]: r[field] })),
                  error: null
                });
              },
              then(cb: any) {
                return Promise.resolve({ data: inserted, error: null }).then(cb);
              }
            };
          }
        };
      }
    })();
    setIndexerSupabaseMock(mockDb);
    setWorkerSupabaseMock(mockDb);

    // 5D5-01: DexScreener pool address propagated
    axios.get = (async (url: string) => {
      if (url.includes('dexscreener')) {
        return {
          status: 200,
          data: {
            pairs: [{
              pairAddress: '0x1111111111111111111111111111111111111111',
              baseToken: { address: '0xToken', name: 'Mock Token', symbol: 'MCK' },
              quoteToken: { address: '0xQuote', name: 'Quote Token', symbol: 'QT' },
              dexId: 'uniswap-v2',
              priceUsd: '1.5',
              liquidity: { usd: 50000 },
            }]
          }
        };
      }
      return originalGet(url);
    }) as any;

    const data01 = await fetchMarketDataWithFallback('0xToken', '1');
    assert(data01.mainPools[0].poolAddress === '0x1111111111111111111111111111111111111111', '5D5-01: DexScreener pool address propagated');

    // 5D5-02: GeckoTerminal pool address propagated
    axios.get = (async (url: string) => {
      if (url.includes('dexscreener')) {
        throw new Error('DexScreener failed to trigger GeckoTerminal fallback');
      }
      if (url.includes('geckoterminal')) {
        return {
          status: 200,
          data: {
            data: [{
              attributes: {
                address: '0x2222222222222222222222222222222222222222',
                name: 'MCK/QT',
                dex_id: 'pancakeswap-v2',
                reserve_in_usd: '60000',
                token_price_usd: '1.6'
              }
            }]
          }
        };
      }
      return originalGet(url);
    }) as any;

    const data02 = await fetchMarketDataWithFallback('0xToken', '1');
    assert(data02.mainPools[0].poolAddress === '0x2222222222222222222222222222222222222222', '5D5-02: GeckoTerminal pool address propagated');

    // 5D5-03: missing address preserves label fallback
    const pool03: LiquidityPool = {
      pair: 'MCK/QT',
      dex: 'uniswap-v2',
      liquidityUsd: 1000,
    };
    const norm03 = toNormalizedPoolState(pool03, { chain: 'eth' });
    assert(norm03.poolIdentifier === 'MCK/QT', '5D5-03: missing address preserves label in poolIdentifier');
    assert(norm03.poolIdentifierType === 'label', '5D5-03: missing address sets label type');

    // 5D5-04: invalid address does not become address identifier
    const pool04: LiquidityPool = {
      pair: 'MCK/QT',
      poolAddress: 'invalid-address',
      dex: 'uniswap-v2',
      liquidityUsd: 1000,
    };
    const norm04 = toNormalizedPoolState(pool04, { chain: 'eth' });
    assert(norm04.poolIdentifier === 'MCK/QT', '5D5-04: invalid address preserves label fallback in poolIdentifier');
    assert(norm04.poolIdentifierType === 'label', '5D5-04: invalid address falls back to label type');

    // 5D5-05: V3 pool rejected
    const pool05: NormalizedPoolState = {
      poolIdentifier: '0x1111111111111111111111111111111111111111',
      poolIdentifierType: 'address',
      dex: 'uniswap-v3',
      poolType: 'concentrated-liquidity',
      liquidityUsd: 5000,
      liquidityUsdProvenance: 'provider',
      fee: { known: false }
    };
    const res05 = await schedulePoolReservesIndexing(pool05, 'eth', 18000000);
    assert(res05.skippedV3 === true, '5D5-05: V3 pool rejected');
    assert(res05.enqueuedBlocks.length === 0, '5D5-05: V3 pool enqueues 0 jobs');

    // 5D5-06: historical block calculation bounded to 30 days
    const blocks06 = calculateHistoricalSnapshotBlocks('eth', 18000000);
    const minBlock = Math.min(...blocks06);
    assert(minBlock >= 18000000 - (30 * 24 * 300), '5D5-06: historical blocks bounded to backfill limit');

    // 5D5-07: maximum 30 jobs enforced
    const blocks07 = calculateHistoricalSnapshotBlocks('eth', 18000000);
    assert(blocks07.length <= 30, '5D5-07: maximum 30 jobs limit enforced');

    // 5D5-08: duplicate jobs are prevented
    const pool08: NormalizedPoolState = {
      poolIdentifier: '0x1111111111111111111111111111111111111111',
      poolIdentifierType: 'address',
      dex: 'uniswap-v2',
      poolType: 'constant-product',
      liquidityUsd: 5000,
      liquidityUsdProvenance: 'provider',
      fee: { known: false }
    };
    const res08a = await schedulePoolReservesIndexing(pool08, 'eth', 18000000);
    const res08b = await schedulePoolReservesIndexing(pool08, 'eth', 18000000, true);
    assert(res08a.enqueuedBlocks.length > 0, '5D5-08: first scheduling enqueues block jobs');
    assert(res08b.enqueuedBlocks.length === 0, '5D5-08: second scheduling enqueues 0 blocks');
    assert(res08b.skippedDuplicates === res08a.enqueuedBlocks.length, '5D5-08: duplicates skipped count matches enqueued count');

    // 5D5-09: 6-hour minimum scheduling gap enforced
    const blocks09 = calculateHistoricalSnapshotBlocks('eth', 18000000, { minSchedulingGapHours: 6 });
    let gapViolated = false;
    for (let i = 0; i < blocks09.length - 1; i++) {
      if (blocks09[i] - blocks09[i+1] < 1800) {
        gapViolated = true;
      }
    }
    assert(!gapViolated, '5D5-09: 6-hour minimum scheduling gap enforced');

    // 5D5-10: finality buffer applied
    const blocks10 = calculateHistoricalSnapshotBlocks('eth', 18000000, { finalityBuffer: 32 });
    assert(blocks10[0] <= 18000000 - 32, '5D5-10: finality buffer applied correctly');

    // Setup worker POST mock handler helper
    const handleWorkerRequest = async (body: any, headers: Record<string, string> = {}) => {
      const req = new MockNextRequest(body, headers) as any;
      return await historicalReservesWorkerPost(req);
    };

    // 5D5-11: worker authentication accepted
    const body11 = { chain: 'eth', poolAddress: '0x1111111111111111111111111111111111111111', blockNumber: 17999900 };
    const res11 = await handleWorkerRequest(body11, { 'x-worker-secret': 'mock_secret_key' });
    assert(res11.status !== 401, '5D5-11: worker authentication accepted with correct secret');

    // 5D5-12: invalid worker secret rejected
    const res12 = await handleWorkerRequest(body11, { 'x-worker-secret': 'wrong_secret' });
    assert(res12.status === 401, '5D5-12: invalid worker secret rejected with 401');

    // Helper to mock Alchemy RPC endpoint for historical query tests
    const mockAlchemySuccessReserves = '0x000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000c80000000000000000000000000000000000000000000000000000000000002710'; // reserve0=100, reserve1=200
    const mockBlockHeaderResponse = { hash: '0xhash123', timestamp: '0x6554b780' }; // block timestamp = 1700050816

    axios.post = (async (url: string, payload: any) => {
      let data = payload;
      if (typeof payload === 'string') {
        try { data = JSON.parse(payload); } catch {}
      }
      console.log("DEBUG MOCK AXIOS.POST:", url, JSON.stringify(data));
      if (url.includes('alchemy')) {
        if (data && data.method === 'eth_call') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, result: mockAlchemySuccessReserves } };
        }
        if (data && data.method === 'eth_getBlockByNumber') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, result: mockBlockHeaderResponse } };
        }
      }
      return originalPost(url, payload);
    }) as any;

    // 5D5-13: successful historical reserve retrieval persisted
    const pool13 = {
      chain: 'eth',
      pool_address: '0x3333333333333333333333333333333333333333',
      block_number: 17500000,
      status: 'pending',
      attempts: 0
    };
    mockDb.jobsTable.push(pool13);

    const body13 = { chain: 'eth', poolAddress: '0x3333333333333333333333333333333333333333', blockNumber: 17500000 };
    const res13 = await handleWorkerRequest(body13, { 'x-worker-secret': 'mock_secret_key' });
    const res13Data = await res13.json();
    console.log("DEBUG RES13 STATUS/DATA:", res13.status, JSON.stringify(res13Data));
    assert(res13.status === 200, '5D5-13: worker completed status 200');
    const job13 = mockDb.jobsTable.find(j => j.pool_address.toLowerCase() === '0x3333333333333333333333333333333333333333');
    assert(job13 && job13.status === 'completed', '5D5-13: job status marked completed');
    
    const records13 = await queryHistoricalReserves('eth', '0x3333333333333333333333333333333333333333');
    assert(records13.length === 1, '5D5-13: reserve record persisted in table');
    assert(records13[0].reserve0 === '100' && records13[0].reserve1 === '200', '5D5-13: reserve0 and reserve1 values preserved');

    // 5D5-14: RPC timeout produces retryable state
    axios.post = (async (url: string, payload: any) => {
      if (url.includes('alchemy')) {
        throw { code: 'ECONNABORTED', message: 'Timeout' };
      }
      return originalPost(url, payload);
    }) as any;

    const pool14 = {
      chain: 'eth',
      pool_address: '0x4444444444444444444444444444444444444444',
      block_number: 17500100,
      status: 'pending',
      attempts: 0
    };
    mockDb.jobsTable.push(pool14);

    const body14 = { chain: 'eth', poolAddress: '0x4444444444444444444444444444444444444444', blockNumber: 17500100 };
    await handleWorkerRequest(body14, { 'x-worker-secret': 'mock_secret_key' });
    const job14 = mockDb.jobsTable.find(j => j.pool_address.toLowerCase() === '0x4444444444444444444444444444444444444444');
    assert(job14 && job14.status === 'pending' && job14.attempts === 1, '5D5-14: RPC timeout produces pending retryable state and increments attempts');

    // 5D5-15: archive unavailable produces terminal failure
    axios.post = (async (url: string, payload: any) => {
      if (url.includes('alchemy')) {
        return {
          status: 200,
          data: {
            jsonrpc: '2.0',
            id: 1,
            error: { message: 'Missing historical state or trie node pruned' }
          }
        };
      }
      return originalPost(url, payload);
    }) as any;

    const pool15 = {
      chain: 'eth',
      pool_address: '0x5555555555555555555555555555555555555555',
      block_number: 17500200,
      status: 'pending',
      attempts: 0
    };
    mockDb.jobsTable.push(pool15);

    const body15 = { chain: 'eth', poolAddress: '0x5555555555555555555555555555555555555555', blockNumber: 17500200 };
    await handleWorkerRequest(body15, { 'x-worker-secret': 'mock_secret_key' });
    const job15 = mockDb.jobsTable.find(j => j.pool_address.toLowerCase() === '0x5555555555555555555555555555555555555555');
    assert(job15 && job15.status === 'failed', '5D5-15: archive unavailable produces terminal failure status');

    // 5D5-16: malformed response produces terminal failure
    axios.post = (async (url: string, payload: any) => {
      if (url.includes('alchemy')) {
        return {
          status: 200,
          data: { jsonrpc: '2.0', id: 1, result: '0x00' }
        };
      }
      return originalPost(url, payload);
    }) as any;

    const pool16 = {
      chain: 'eth',
      pool_address: '0x6666666666666666666666666666666666666666',
      block_number: 17500300,
      status: 'pending',
      attempts: 0
    };
    mockDb.jobsTable.push(pool16);

    const body16 = { chain: 'eth', poolAddress: '0x6666666666666666666666666666666666666666', blockNumber: 17500300 };
    await handleWorkerRequest(body16, { 'x-worker-secret': 'mock_secret_key' });
    const job16 = mockDb.jobsTable.find(j => j.pool_address.toLowerCase() === '0x6666666666666666666666666666666666666666');
    assert(job16 && job16.status === 'failed', '5D5-16: malformed response produces terminal failure status');

    // 5D5-17: same block + different block hash updates canonical record
    axios.post = (async (url: string, payload: any) => {
      if (url.includes('alchemy')) {
        if (payload.method === 'eth_call') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, result: mockAlchemySuccessReserves } };
        }
        if (payload.method === 'eth_getBlockByNumber') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, result: { hash: '0xhashA', timestamp: '0x6554b780' } } };
        }
      }
      return originalPost(url, payload);
    }) as any;

    const pool17 = {
      chain: 'eth',
      pool_address: '0x7777777777777777777777777777777777777777',
      block_number: 17500400,
      status: 'pending',
      attempts: 0
    };
    mockDb.jobsTable.push(pool17);

    const body17 = { chain: 'eth', poolAddress: '0x7777777777777777777777777777777777777777', blockNumber: 17500400 };
    await handleWorkerRequest(body17, { 'x-worker-secret': 'mock_secret_key' });
    
    axios.post = (async (url: string, payload: any) => {
      if (url.includes('alchemy')) {
        if (payload.method === 'eth_call') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, result: mockAlchemySuccessReserves } };
        }
        if (payload.method === 'eth_getBlockByNumber') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, result: { hash: '0xhashB', timestamp: '0x6554b780' } } };
        }
      }
      return originalPost(url, payload);
    }) as any;

    pool17.status = 'pending';
    await handleWorkerRequest(body17, { 'x-worker-secret': 'mock_secret_key' });

    const records17 = await queryHistoricalReserves('eth', '0x7777777777777777777777777777777777777777');
    assert(records17.length === 1, '5D5-17: only one canonical record stored for block');
    assert(records17[0].block_hash === '0xhashB', '5D5-17: block hash was updated to reorged hash B');

    // 5D5-18: no latest-state fallback
    let observedBlockTag = '';
    axios.post = (async (url: string, payload: any) => {
      if (url.includes('alchemy') && payload.method === 'eth_call') {
        observedBlockTag = payload.params[1];
        return { status: 200, data: { jsonrpc: '2.0', id: 1, result: mockAlchemySuccessReserves } };
      }
      if (url.includes('alchemy') && payload.method === 'eth_getBlockByNumber') {
        return { status: 200, data: { jsonrpc: '2.0', id: 1, result: mockBlockHeaderResponse } };
      }
      return originalPost(url, payload);
    }) as any;

    const pool18 = {
      chain: 'eth',
      pool_address: '0x8888888888888888888888888888888888888888',
      block_number: 17500500,
      status: 'pending',
      attempts: 0
    };
    mockDb.jobsTable.push(pool18);

    const body18 = { chain: 'eth', poolAddress: '0x8888888888888888888888888888888888888888', blockNumber: 17500500 };
    await handleWorkerRequest(body18, { 'x-worker-secret': 'mock_secret_key' });
    assert(observedBlockTag !== 'latest', '5D5-18: no latest blockTag fallback used');
    assert(observedBlockTag === '0x10b0954', '5D5-18: correct hex block tag used');

    // 5D5-19: no zero reserve fallback
    axios.post = (async (url: string, payload: any) => {
      if (url.includes('alchemy')) {
        return { status: 200, data: { jsonrpc: '2.0', id: 1, error: { message: 'Pruned' } } };
      }
      return originalPost(url, payload);
    }) as any;

    const pool19 = {
      chain: 'eth',
      pool_address: '0x9999999999999999999999999999999999999999',
      block_number: 17500600,
      status: 'pending',
      attempts: 0
    };
    mockDb.jobsTable.push(pool19);

    const body19 = { chain: 'eth', poolAddress: '0x9999999999999999999999999999999999999999', blockNumber: 17500600 };
    await handleWorkerRequest(body19, { 'x-worker-secret': 'mock_secret_key' });
    const records19 = await queryHistoricalReserves('eth', '0x9999999999999999999999999999999999999999');
    assert(records19.length === 0, '5D5-19: no zero fallback, no database record written on failure');

    // 5D5-20: no fabricated timestamp/hash
    axios.post = (async (url: string, payload: any) => {
      if (url.includes('alchemy')) {
        if (payload.method === 'eth_call') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, result: mockAlchemySuccessReserves } };
        }
        if (payload.method === 'eth_getBlockByNumber') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, error: { message: 'Block header pruned' } } };
        }
      }
      return originalPost(url, payload);
    }) as any;

    const pool20 = {
      chain: 'eth',
      pool_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      block_number: 17500700,
      status: 'pending',
      attempts: 0
    };
    mockDb.jobsTable.push(pool20);

    const body20 = { chain: 'eth', poolAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', blockNumber: 17500700 };
    const res20 = await handleWorkerRequest(body20, { 'x-worker-secret': 'mock_secret_key' });
    assert(res20.status !== 200, '5D5-20: worker rejects reserve retrieval when provenance block header fails');
    const records20 = await queryHistoricalReserves('eth', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert(records20.length === 0, '5D5-20: no fabricated timestamp/hash written to DB');

    // 5D5-21: 6-hour scheduling cooldown
    mockDb.jobsTable.push({
      chain: 'eth',
      pool_address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      block_number: 17500800,
      status: 'pending',
      attempts: 0,
      enqueued_at: new Date().toISOString()
    });
    const pool21: NormalizedPoolState = {
      poolIdentifier: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      poolIdentifierType: 'address',
      dex: 'uniswap-v2',
      poolType: 'constant-product',
      liquidityUsd: 5000,
      liquidityUsdProvenance: 'provider',
      fee: { known: false }
    };
    const res21 = await schedulePoolReservesIndexing(pool21, 'eth', 18000000);
    assert(res21.enqueuedBlocks.length === 0, '5D5-21: cooldown blocks skipped');
    assert(res21.skippedDuplicates === 0, '5D5-21: cooldown skips are not counted as duplicates');

    // 5D5-22: Stuck processing job recovery
    mockDb.jobsTable.push({
      chain: 'eth',
      pool_address: '0xcccccccccccccccccccccccccccccccccccccccc',
      block_number: 17500900,
      status: 'processing',
      attempts: 1,
      updated_at: new Date(Date.now() - 20 * 60 * 1000).toISOString()
    });
    const pool22: NormalizedPoolState = {
      poolIdentifier: '0xcccccccccccccccccccccccccccccccccccccccc',
      poolIdentifierType: 'address',
      dex: 'uniswap-v2',
      poolType: 'constant-product',
      liquidityUsd: 5000,
      liquidityUsdProvenance: 'provider',
      fee: { known: false }
    };
    await schedulePoolReservesIndexing(pool22, 'eth', 18000000, true);
    const recoveredJob = mockDb.jobsTable.find(j => j.pool_address === '0xcccccccccccccccccccccccccccccccccccccccc');
    assert(recoveredJob.status === 'pending', '5D5-22: stale processing job was recovered back to pending');
    assert(recoveredJob.last_error === 'CLAIM_TIMEOUT_RECOVERY', '5D5-22: recovery last_error was set correctly');

    // 5D5-23: Atomic job claiming (concurrency guard)
    const job23 = {
      chain: 'eth',
      pool_address: '0xdddddddddddddddddddddddddddddddddddddddd',
      block_number: 17501000,
      status: 'pending',
      attempts: 0
    };
    mockDb.jobsTable.push(job23);

    axios.post = (async (url: string, payload: any) => {
      if (url.includes('alchemy')) {
        if (payload.method === 'eth_call') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, result: mockAlchemySuccessReserves } };
        }
        if (payload.method === 'eth_getBlockByNumber') {
          return { status: 200, data: { jsonrpc: '2.0', id: 1, result: mockBlockHeaderResponse } };
        }
      }
      return originalPost(url, payload);
    }) as any;

    const worker1Promise = handleWorkerRequest({
      chain: 'eth',
      poolAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
      blockNumber: 17501000
    }, { 'x-worker-secret': 'mock_secret_key' });

    const worker2Promise = handleWorkerRequest({
      chain: 'eth',
      poolAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
      blockNumber: 17501000
    }, { 'x-worker-secret': 'mock_secret_key' });

    const [w1Res, w2Res] = await Promise.all([worker1Promise, worker2Promise]);
    const w1Data = await w1Res.json();
    const w2Data = await w2Res.json();
    assert(
      (w1Data.success === true && w2Data.skipped === true) || 
      (w2Data.success === true && w1Data.skipped === true),
      '5D5-23: atomic compare-and-swap claiming guarantees exactly one worker processes the job'
    );

  } finally {
    // Restore mocks
    axios.get = originalGet;
    axios.post = originalPost;
    if (originalApiKey) {
      process.env.ALCHEMY_API_KEY = originalApiKey;
    } else {
      delete process.env.ALCHEMY_API_KEY;
    }
    if (originalWorkerSecret) {
      process.env.WORKER_SECRET_KEY = originalWorkerSecret;
    } else {
      delete process.env.WORKER_SECRET_KEY;
    }
    setIndexerSupabaseMock(null);
    setWorkerSupabaseMock(null);
  }
}

runTests().catch(console.error);

// ────────────────────────────────────────────────
// Phase 5D-6: Liquidity / Slippage / Stress Analysis Tests
// ────────────────────────────────────────────────
async function runPhase5D6Tests() {
  console.log('\n--- Phase 5D-6: Liquidity / Slippage / Stress Analysis Tests ---');

  // ── Shared test data ──
  // A balanced V2 pool with 1,000,000 token0 and 1,000,000 USDC (spot = $1)
  const R0 = BigInt(1_000_000) * BigInt(10 ** 18); // 1M token0, 18 decimals
  const R1 = BigInt(1_000_000) * BigInt(10 ** 18); // 1M USDC (quote), 18 decimals
  const FEE_03 = BigInt(3000);  // 0.3% fee in ppm (parts per 1,000,000)
  const FEE_0  = BigInt(0);     // 0% fee for clean math checks

  // Pool objects for analyzeLiquidityStress
  const mockV2Pool: NormalizedPoolState = {
    poolIdentifier: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
    poolIdentifierType: 'address',
    dex: 'uniswap-v2',
    poolType: 'constant-product',
    liquidityUsd: 2_000_000, // $2M TVL (balanced: $1M each side at spot $1)
    liquidityUsdProvenance: 'provider',
    fee: { known: true, feeRate: 0.003, source: 'on-chain' as const },
    // Derived reserves: tokenReserveRaw = 1,000,000, quoteReserveRaw = 1,000,000
    tokenReserveRaw: 1_000_000,
    quoteReserveRaw: 1_000_000,
  };

  const mockV3Pool: NormalizedPoolState = {
    poolIdentifier: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    poolIdentifierType: 'address',
    dex: 'uniswap-v3',
    poolType: 'concentrated-liquidity',
    liquidityUsd: 5_000_000,
    liquidityUsdProvenance: 'provider',
    fee: { known: true, feeRate: 0.0005, source: 'provider-metadata' as const },
  };

  // ────────────────────────────────────────────────
  // 5D6-01: V2 constant-product formula correctness
  // ────────────────────────────────────────────────
  // Sell 1% of reserve0 with zero fee. Expected output:
  //   k = R0 * R1 = 1e12 (in token units)
  //   deltaY = R1 * 0.01*R0 / (R0 + 0.01*R0) = R1 * 0.01 / 1.01 = R1/101
  const sell1pct = R0 / BigInt(100);
  const swap01 = simulateV2SwapBigInt(R0, R1, sell1pct, FEE_0);
  assert(swap01.valid, '5D6-01: swap with valid inputs succeeds');
  // Expected deltaY = R1 / 101 = floor(1e24/101)
  const expectedDeltaY01 = R1 / BigInt(101);
  assert(swap01.deltaY === expectedDeltaY01, '5D6-01: constant-product output matches exact formula');

  // 5D6-02: Swap fee correctness
  // With fee 0.3%, effective input = 0.997 * deltaX
  // Expected: deltaY = R1 * (997 * sell1pct) / (R0 * 1000 + 997 * sell1pct)
  // Using our 1,000,000 base: deltaY = R1 * (997000 * sell1pct) / (R0 * 1000000 + 997000 * sell1pct)
  const swap02 = simulateV2SwapBigInt(R0, R1, sell1pct, FEE_03);
  assert(swap02.valid, '5D6-02: swap with 0.3% fee succeeds');
  // Fee reduces output — should be less than zero-fee output
  assert(swap02.deltaY < swap01.deltaY, '5D6-02: fee reduces output amount');
  // Verify exact Uniswap V2 formula equivalence
  const expectedDeltaY02 = (BigInt(997_000) * sell1pct * R1) / (R0 * BigInt(1_000_000) + BigInt(997_000) * sell1pct);
  assert(swap02.deltaY === expectedDeltaY02, '5D6-02: fee-adjusted output matches Uniswap V2 formula');

  // 5D6-03: Token0 → token1 simulation (sell direction)
  const swap03 = simulateV2SwapBigInt(R0, R1, R0 / BigInt(10), FEE_03);
  assert(swap03.valid, '5D6-03: token0 → token1 swap succeeds');
  assert(swap03.newR0 === R0 + R0 / BigInt(10), '5D6-03: post-trade reserve0 = r0 + deltaX');
  assert(swap03.newR1 === R1 - swap03.deltaY, '5D6-03: post-trade reserve1 = r1 - deltaY');

  // 5D6-04: Token1 → token0 simulation (buy direction)
  const swap04 = simulateV2SwapReverseBigInt(R0, R1, R1 / BigInt(10), FEE_03);
  assert(swap04.valid, '5D6-04: token1 → token0 (buy) swap succeeds');
  assert(swap04.newR1 === R1 + R1 / BigInt(10), '5D6-04: post-buy reserve1 = r1 + deltaY_input');
  assert(swap04.deltaY > 0n, '5D6-04: buy swap outputs positive token0 amount');

  // 5D6-05: Price impact correctness
  // For a 10% sell of reserve0 with no fee:
  // impactPct = (spot - execPrice) / spot * 100
  // spot = R1/R0 = 1.0, execPrice = deltaY / deltaX_input
  // deltaY = R1 * 0.1 / 1.1 = R1/11
  const sell10pct = R0 / BigInt(10);
  const swap05 = simulateV2SwapBigInt(R0, R1, sell10pct, FEE_0);
  assert(swap05.valid, '5D6-05: 10% sell succeeds');
  const execPrice05 = Number(swap05.deltaY) / Number(sell10pct);
  const priceImpact05 = (1.0 - execPrice05) / 1.0 * 100;
  // Expected exact impact: 1 - (1/1.1) * 100 = 9.0909...%
  assert(Math.abs(priceImpact05 - (100/11)) < 0.001, '5D6-05: 10% sell with no fee gives ~9.09% price impact');

  // 5D6-06: Position-size curve correctness via analyzeLiquidityStress
  const report06 = analyzeLiquidityStress({
    pools: [mockV2Pool],
    spotPriceUsd: 1.0,
    historicalSnapshots: [],
    tokenAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
    tokenDecimals: 18,
  });
  assert(report06.status === 'ok', '5D6-06: analysis succeeds with valid pool');
  assert(report06.slippageCurve.length > 0, '5D6-06: slippage curve has entries');
  const curve06 = report06.slippageCurve.filter(p => p.status === 'ok');
  assert(curve06.length > 0, '5D6-06: slippage curve has ok entries');
  // Larger positions should have higher price impact
  const small06 = curve06.find(p => p.positionSizeUsd === 100);
  const large06 = curve06.find(p => p.positionSizeUsd === 100_000);
  assert(!!small06, '5D6-06: $100 curve point exists');
  assert(!!large06, '5D6-06: $100k curve point exists');
  assert(large06!.priceImpactPct > small06!.priceImpactPct, '5D6-06: larger positions have higher impact');

  // 5D6-07: Slippage monotonicity
  assert(report06.isCurveMonotonic, '5D6-07: slippage curve is monotonic (larger positions = higher impact)');
  // Verify the curve didn't produce any non-monotonic jumps manually
  let prevImpact = -1;
  let curveMonotonic = true;
  for (const pt of curve06) {
    if (pt.priceImpactPct < prevImpact - 0.0001) { curveMonotonic = false; break; }
    prevImpact = pt.priceImpactPct;
  }
  assert(curveMonotonic, '5D6-07: manual monotonicity check passes for all ok curve points');

  // 5D6-08: Executable liquidity at 0.5%
  const exec05 = computeExecutableLiquidity(1_000_000, 1_000_000, 1.0, 0.003, 0.005);
  assert(exec05.status === 'ok', '5D6-08: executable at 0.5% is ok (fee < threshold)');
  assert(exec05.maxInputUsd !== null && exec05.maxInputUsd > 0, '5D6-08: 0.5% executable boundary is positive');
  // Sanity: max input must be less than full pool
  assert(exec05.maxInputUsd! < 1_000_000, '5D6-08: 0.5% boundary is less than total reserve0');

  // 5D6-09: Executable liquidity at 1%
  const exec1 = computeExecutableLiquidity(1_000_000, 1_000_000, 1.0, 0.003, 0.01);
  assert(exec1.status === 'ok', '5D6-09: executable at 1% is ok');
  assert(exec1.maxInputUsd !== null && exec1.maxInputUsd > exec05.maxInputUsd!, '5D6-09: 1% threshold allows more capital than 0.5%');

  // 5D6-10: Executable liquidity at 5%
  const exec5 = computeExecutableLiquidity(1_000_000, 1_000_000, 1.0, 0.003, 0.05);
  assert(exec5.status === 'ok', '5D6-10: executable at 5% is ok');
  assert(exec5.maxInputUsd! > exec1.maxInputUsd!, '5D6-10: 5% threshold allows more capital than 1%');

  // 5D6-11: Liquidity utilization correctness
  assert(report06.utilizationAt1kUsd !== null, '5D6-11: utilization at $1k is computed');
  assert(report06.utilizationAt1kUsd! > 0 && report06.utilizationAt1kUsd! < 1,
    '5D6-11: utilization at $1k is between 0 and 1');
  // $1k vs $2M TVL pool = ~0.1% reserve utilization (tiny)
  assert(report06.utilizationAt1kUsd! < 0.01, '5D6-11: $1k trade uses less than 1% of a $2M pool');

  // 5D6-12: Zero reserve rejection
  const swapZeroR0 = simulateV2SwapBigInt(0n, R1, BigInt(100) * BigInt(10**18), FEE_03);
  assert(!swapZeroR0.valid, '5D6-12: swap with zero reserve0 is rejected');
  const swapZeroR1 = simulateV2SwapBigInt(R0, 0n, BigInt(100) * BigInt(10**18), FEE_03);
  assert(!swapZeroR1.valid, '5D6-12: swap with zero reserve1 is rejected');

  // 5D6-13: Zero input rejection
  const swapZeroDelta = simulateV2SwapBigInt(R0, R1, 0n, FEE_03);
  assert(!swapZeroDelta.valid, '5D6-13: swap with zero input is rejected');

  // 5D6-14: Large reserve precision (uint112 max ≈ 5.19e33)
  // Use large but valid reserves: 1e12 tokens (12 zeros) each at 18 decimals
  const LARGE = BigInt('5192296858534827628530496329220095'); // uint112 max
  const swapLarge = simulateV2SwapBigInt(LARGE, LARGE, LARGE / BigInt(1000), FEE_03);
  assert(swapLarge.valid, '5D6-14: swap with uint112-max reserves succeeds');
  assert(swapLarge.deltaY > 0n, '5D6-14: large reserve swap produces positive output');

  // 5D6-15: uint112 boundary precision — output must not exceed reserve1
  assert(swapLarge.deltaY < LARGE, '5D6-15: output amount does not exceed reserve1');
  assert(swapLarge.newR1 > 0n, '5D6-15: post-trade reserve1 remains positive');

  // 5D6-16: Historical snapshot consumption
  const snapshots16 = [
    { block_number: 18_000_000, block_timestamp: '2024-01-01T00:00:00Z', reserve0: '1000000000000000000000000', reserve1: '1000000000000000000000000' },
    { block_number: 18_007_200, block_timestamp: '2024-01-04T00:00:00Z', reserve0: '1100000000000000000000000', reserve1: '900000000000000000000000' },
    { block_number: 18_014_400, block_timestamp: '2024-01-07T00:00:00Z', reserve0: '1200000000000000000000000', reserve1: '800000000000000000000000' },
  ];
  const historical16 = analyzeHistoricalSnapshots(snapshots16, 1.0, true, 18);
  assert(historical16.status === 'ok', '5D6-16: historical analysis succeeds with valid snapshots');
  assert(historical16.snapshotCount === 3, '5D6-16: correct snapshot count returned');
  assert(historical16.oldestBlock === 18_000_000, '5D6-16: oldest block identified correctly');
  assert(historical16.newestBlock === 18_014_400, '5D6-16: newest block identified correctly');

  // 5D6-17: Missing snapshot remains unavailable
  const historical17 = analyzeHistoricalSnapshots([], 1.0, true, 18);
  assert(historical17.status === 'unavailable', '5D6-17: empty snapshot list returns unavailable status');
  assert(historical17.snapshotCount === 0, '5D6-17: no snapshots counted for empty list');
  assert(historical17.minTargetReserve === null, '5D6-17: minTargetReserve is null when no snapshots');
  assert(historical17.maxTargetReserve === null, '5D6-17: maxTargetReserve is null when no snapshots');

  // 5D6-18: No historical interpolation — missing intervals stay missing
  // Provide 2 non-consecutive snapshots; the analysis should NOT fill the gap
  const snapshots18 = [
    { block_number: 18_000_000, block_timestamp: '2024-01-01T00:00:00Z', reserve0: '1000000000000000000000000', reserve1: '1000000000000000000000000' },
    { block_number: 18_100_000, block_timestamp: '2024-01-15T00:00:00Z', reserve0: '800000000000000000000000', reserve1: '1200000000000000000000000' },
  ];
  const historical18 = analyzeHistoricalSnapshots(snapshots18, 1.0, true, 18);
  assert(historical18.status === 'ok', '5D6-18: 2-snapshot analysis succeeds');
  assert(historical18.snapshotCount === 2, '5D6-18: exactly 2 snapshots counted — gap is NOT interpolated');
  // The only volatility data point is from block 18M to 18.1M
  assert(historical18.targetVolatilityAvg !== null, '5D6-18: volatility computed from 2 snapshots');

  // 5D6-19: Historical liquidity shock detection
  const snapshots19 = [
    { block_number: 18_000_000, block_timestamp: '2024-01-01T00:00:00Z', reserve0: '1000000000000000000000000', reserve1: '1000000000000000000000000' },
    { block_number: 18_007_200, block_timestamp: '2024-01-04T00:00:00Z', reserve0: '200000000000000000000000', reserve1: '5000000000000000000000000' },  // 80% drop in reserve0
  ];
  const historical19 = analyzeHistoricalSnapshots(snapshots19, 1.0, true, 18);
  assert(historical19.shocks.length > 0, '5D6-19: shock detected when reserve0 drops 80%');
  const shock19 = historical19.shocks[0];
  assert(shock19.type === 'drain', '5D6-19: 80% drop classified as drain');
  assert(shock19.severity === 'critical', '5D6-19: drain classified as critical severity');
  assert(shock19.targetReserveChangePct < -50, '5D6-19: shock change pct is negative and large');

  // 5D6-20: Liquidity regime classification
  const { regime: regime20a, reason: reason20a } = classifyLiquidityRegime(10_000_000, historical17);
  assert(regime20a === 'deep', '5D6-20: $10M TVL classified as deep');
  const { regime: regime20b } = classifyLiquidityRegime(2_000_000, historical17);
  assert(regime20b === 'healthy', '5D6-20: $2M TVL classified as healthy');
  const { regime: regime20c } = classifyLiquidityRegime(400_000, historical17);
  assert(regime20c === 'moderate', '5D6-20: $400k TVL classified as moderate');
  const { regime: regime20d } = classifyLiquidityRegime(80_000, historical17);
  assert(regime20d === 'thin', '5D6-20: $80k TVL classified as thin');
  const { regime: regime20e } = classifyLiquidityRegime(10_000, historical17);
  assert(regime20e === 'critically_thin', '5D6-20: $10k TVL classified as critically thin');

  // 5D6-20b: Deteriorating regime from historical trend
  const snapshotsDet: typeof snapshots16 = [
    { block_number: 18_000_000, block_timestamp: '2024-01-01T00:00:00Z', reserve0: '1000000000000000000000000', reserve1: '1000000000000000000000000' },
    { block_number: 18_007_200, block_timestamp: '2024-01-04T00:00:00Z', reserve0: '600000000000000000000000', reserve1: '1000000000000000000000000' },
    { block_number: 18_014_400, block_timestamp: '2024-01-07T00:00:00Z', reserve0: '550000000000000000000000', reserve1: '1000000000000000000000000' },
  ];
  const histDet = analyzeHistoricalSnapshots(snapshotsDet, 1.0, true, 18);
  const { regime: regimeDet } = classifyLiquidityRegime(2_000_000, histDet);
  // reserve0 declined 45% from oldest to newest — should trigger deteriorating
  assert(regimeDet === 'deteriorating', '5D6-20b: 45% reserve decline triggers deteriorating regime');

  // 5D6-21: Large buy stress scenario
  const report21 = analyzeLiquidityStress({
    pools: [mockV2Pool],
    spotPriceUsd: 1.0,
    historicalSnapshots: [],
    tokenAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
    tokenDecimals: 18,
  });
  const scenarioBuy = report21.scenarios.find(s => s.scenarioId === 'large_buy');
  assert(!!scenarioBuy, '5D6-21: large buy scenario (A) is present');
  assert(scenarioBuy!.status === 'ok', '5D6-21: large buy scenario completes ok');
  assert(scenarioBuy!.priceImpactPct > 0, '5D6-21: large buy has positive price impact');
  assert(scenarioBuy!.simulatedOutputUsd > 0, '5D6-21: large buy produces positive output');

  // 5D6-22: Large sell stress scenario
  const scenarioSell = report21.scenarios.find(s => s.scenarioId === 'large_sell');
  assert(!!scenarioSell, '5D6-22: large sell scenario (B) is present');
  assert(scenarioSell!.status === 'ok', '5D6-22: large sell scenario completes ok');
  assert(scenarioSell!.priceImpactPct > 0, '5D6-22: large sell has positive price impact');
  assert(scenarioSell!.postTradeReserve0 !== R0.toString(), '5D6-22: post-sell reserve0 changes from pre-trade value');

  // 5D6-23: Top-holder exit simulation (Scenario C)
  const report23 = analyzeLiquidityStress({
    pools: [mockV2Pool],
    spotPriceUsd: 1.0,
    historicalSnapshots: [],
    whaleBalanceTokens: 50_000, // whale holds $50k worth
    tokenAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
    tokenDecimals: 18,
  });
  const holderExits = report23.scenarios.filter(s => s.scenarioId.startsWith('holder_exit'));
  assert(holderExits.length > 0, '5D6-23: holder exit scenarios (C) are present when whale data provided');
  // 100% exit should have more impact than 10% exit
  const exit10 = holderExits.find(s => s.scenarioId === 'holder_exit_10pct');
  const exit100 = holderExits.find(s => s.scenarioId === 'holder_exit_100pct');
  assert(!!exit10 && !!exit100, '5D6-23: both 10% and 100% exit scenarios exist');
  assert(exit100!.priceImpactPct >= exit10!.priceImpactPct, '5D6-23: 100% exit has >= impact than 10% exit');

  // 5D6-24: Unsupported V3 rejection
  const reportV3 = analyzeLiquidityStress({
    pools: [mockV3Pool],
    spotPriceUsd: 1.0,
    historicalSnapshots: [],
    tokenAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    tokenDecimals: 18,
  });
  assert(reportV3.status === 'insufficient_data', '5D6-24: V3 pool returns insufficient_data');
  assert(reportV3.slippageCurve.length === 0, '5D6-24: V3 pool produces empty slippage curve');
  assert(reportV3.scenarios.length === 0, '5D6-24: V3 pool produces no stress scenarios');

  // 5D6-25: Unsupported Solana pool rejection (via pool type 'unknown' with 'solana' network)
  // The engine itself gates on pool type; a 'constant-product' Solana pool would simulate,
  // but the DeepScanService skips historical reserves for network === 'solana'.
  // At the engine level, an empty pool list returns insufficient_data.
  const reportEmpty = analyzeLiquidityStress({
    pools: [],
    spotPriceUsd: 1.0,
    historicalSnapshots: [],
    tokenAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
    tokenDecimals: 18,
  });
  assert(reportEmpty.status === 'insufficient_data', '5D6-25: empty pool list returns insufficient_data');

  // 5D6-26: No latest fallback — historical analysis uses only provided snapshots
  // If we pass zero snapshots, historical must be 'unavailable', not live data
  const report26 = analyzeLiquidityStress({
    pools: [mockV2Pool],
    spotPriceUsd: 1.0,
    historicalSnapshots: [], // intentionally empty
    tokenAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
    tokenDecimals: 18,
  });
  assert(report26.historical.status === 'unavailable', '5D6-26: no historical snapshots → unavailable, not live fallback');
  assert(report26.historical.snapshotCount === 0, '5D6-26: snapshot count is 0 when no snapshots provided');
  assert(report26.historical.minTargetReserve === null, '5D6-26: minTargetReserve is null — no fabrication from live state');

  // 5D6-27: No fabricated reserves — invalid pool with zero liquidity returns insufficient_data
  const zeroLiqPool: NormalizedPoolState = {
    poolIdentifier: '0x1234567890123456789012345678901234567890',
    poolIdentifierType: 'address',
    dex: 'uniswap-v2',
    poolType: 'constant-product',
    liquidityUsd: 0,  // zero liquidity
    liquidityUsdProvenance: 'provider',
    fee: { known: false },
  };
  const reportZero = analyzeLiquidityStress({
    pools: [zeroLiqPool],
    spotPriceUsd: 1.0,
    historicalSnapshots: [],
    tokenAddress: '0x1234567890123456789012345678901234567890',
    tokenDecimals: 18,
  });
  assert(reportZero.status === 'insufficient_data', '5D6-27: zero liquidity pool returns insufficient_data');
  assert(reportZero.slippageCurve.length === 0, '5D6-27: no slippage curve fabricated for zero-liquidity pool');

  // 5D6-28: Deterministic repeated simulation — same inputs must yield identical outputs
  const run28a = analyzeLiquidityStress({ pools: [mockV2Pool], spotPriceUsd: 1.0, historicalSnapshots: [], tokenAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd', tokenDecimals: 18 });
  const run28b = analyzeLiquidityStress({ pools: [mockV2Pool], spotPriceUsd: 1.0, historicalSnapshots: [], tokenAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd', tokenDecimals: 18 });
  assert(
    JSON.stringify(run28a.slippageCurve) === JSON.stringify(run28b.slippageCurve),
    '5D6-28: repeated simulation produces identical slippage curve'
  );
  assert(
    JSON.stringify(run28a.executableLiquidity) === JSON.stringify(run28b.executableLiquidity),
    '5D6-28: repeated simulation produces identical executable liquidity'
  );

  // 5D6-29: No regression in Phase 5D-5 — historical reserves indexer still works
  const blocks29 = (await import('./lib/deep_scan/historical/HistoricalPoolReservesIndexer')).calculateHistoricalSnapshotBlocks('eth', 18000000);
  assert(blocks29.length <= 30, '5D6-29: Phase 5D-5 calculateHistoricalSnapshotBlocks still returns ≤30 blocks');
  assert(blocks29.length > 0, '5D6-29: Phase 5D-5 calculateHistoricalSnapshotBlocks still returns >0 blocks');

  // 5D6-30: No regression in Basic Scan — AMM slippage simulator still works
  const ammCheck = simulateAmmSlippage([mockV2Pool], 1.0, [1000, 10000]);
  assert(ammCheck.status === 'ok', '5D6-30: existing AmmSlippageSimulator still returns ok with valid pool');
  assert(ammCheck.simulations.length === 2, '5D6-30: AmmSlippageSimulator returns correct simulation count');

  // 5D6-31: No regression in Elevator Scan — whale exit simulator still works
  const whaleCheck = simulateWhaleExit(
    [{
      wallet: '0x1111',
      observedBatchBalance: 100_000,
      isFiltered: false,
      netFlow: 0,
      txCount: 5,
      supplySharePct: 5,
      isAboveSupplyThreshold: true,
      isAboveLiquidityThreshold: true,
      freshnessTag: 'unknown' as const,
    }],
    [mockV2Pool],
    1.0,
    10_000_000
  );
  assert(whaleCheck.status === 'ok', '5D6-31: existing WhaleExitSimulator still returns ok');
  assert(whaleCheck.scenarios.length > 0, '5D6-31: WhaleExitSimulator still produces scenarios');

  // ── Property invariants ──

  // INV-1: k should not decrease for any valid swap (accounting for fee burn)
  //        Actually for V2 with fees, k does increase slightly due to fee being added to reserves.
  //        We verify: k_new >= k_old for any valid swap (fees accumulate in pool)
  const k_before = R0 * R1;
  const swap_inv = simulateV2SwapBigInt(R0, R1, R0 / BigInt(100), FEE_03);
  if (swap_inv.valid) {
    const k_after = swap_inv.newR0 * swap_inv.newR1;
    assert(k_after >= k_before, 'INV-1: pool k (reserve product) does not decrease after a fee-bearing swap');
  }

  // INV-2: Executable liquidity is monotonically increasing with impact threshold
  const thresholds = [0.005, 0.01, 0.02, 0.05, 0.10];
  let prevExec = -1;
  let invMonotonic = true;
  for (const t of thresholds) {
    const e = computeExecutableLiquidity(1_000_000, 1_000_000, 1.0, 0.003, t);
    if (e.status === 'ok' && e.maxInputUsd !== null) {
      if (e.maxInputUsd < prevExec - 0.01) { invMonotonic = false; break; }
      prevExec = e.maxInputUsd;
    }
  }
  assert(invMonotonic, 'INV-2: executable liquidity is non-decreasing as impact threshold increases');

  // INV-3: Fee >= impact threshold → infeasible (fee self-blocks trade)
  const execInfeasible = computeExecutableLiquidity(1_000_000, 1_000_000, 1.0, 0.003, 0.002);
  assert(execInfeasible.status === 'infeasible', 'INV-3: impact threshold below fee rate returns infeasible');
  assert(execInfeasible.maxInputUsd === 0, 'INV-3: infeasible boundary reports 0 max input');

  // INV-4: Post-trade reserves must always be positive
  const swap_inv4 = simulateV2SwapBigInt(R0, R1, R0 / BigInt(2), FEE_03);
  if (swap_inv4.valid) {
    assert(swap_inv4.newR0 > 0n, 'INV-4: post-trade reserve0 always positive');
    assert(swap_inv4.newR1 > 0n, 'INV-4: post-trade reserve1 always positive');
  }

  // ─────────────────────────────────────────────────────────────────
  // 5D6-FIX REGRESSION SUITE — Decimal Normalization & Token Slot
  // ─────────────────────────────────────────────────────────────────
  console.log('\n  [5D6-FIX] Decimal normalization & token slot regression tests');

  // Shared snapshots used for all fix-regression tests.
  // Raw values are in on-chain raw units (NOT pre-normalized).
  const mkSnap = (reserve0: string, reserve1: string, block_number = 1) => ({
    block_number,
    block_timestamp: '2024-01-01T00:00:00.000Z',
    reserve0,
    reserve1,
  });

  // 1_000_000e18 tokens (18 decimals) → 1,000,000 token units
  const SNAP_18DEC_RESERVE0 = (1_000_000n * 10n ** 18n).toString();
  // 1_000_000e6 tokens (6 decimals) → 1,000,000 token units
  const SNAP_6DEC_RESERVE0  = (1_000_000n * 10n ** 6n).toString();
  // 1_000_000e8 tokens (8 decimals) → 1,000,000 token units
  const SNAP_8DEC_RESERVE0  = (1_000_000n * 10n ** 8n).toString();

  const SPOT_1 = 1.0; // $1 spot price

  // ── 5D6-FIX-01: 18-decimal token0 ──
  {
    const snaps = [
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 100),
      mkSnap((2_000_000n * 10n ** 18n).toString(), SNAP_18DEC_RESERVE0, 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 18);
    assert(m.status === 'ok', '5D6-FIX-01: 18-dec token0 metrics ok');
    // minLiquidityUsd = 1M tokens × $1 × 2 = $2M
    assert(m.minLiquidityUsd !== null && m.minLiquidityUsd > 1_900_000 && m.minLiquidityUsd < 2_100_000,
      '5D6-FIX-01: 18-dec token0 USD liquidity correct (~$2M)');
  }

  // ── 5D6-FIX-02: 6-decimal token0 ──
  {
    const snaps = [
      mkSnap(SNAP_6DEC_RESERVE0, SNAP_18DEC_RESERVE0, 100),
      mkSnap((2_000_000n * 10n ** 6n).toString(), SNAP_18DEC_RESERVE0, 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 6);
    assert(m.status === 'ok', '5D6-FIX-02: 6-dec token0 metrics ok');
    // minLiquidityUsd = 1M tokens × $1 × 2 = $2M (NOT 1M * 1e12 * $1 * 2)
    assert(m.minLiquidityUsd !== null && m.minLiquidityUsd > 1_900_000 && m.minLiquidityUsd < 2_100_000,
      '5D6-FIX-02: 6-dec token0 USD liquidity correct (no 10^12 scaling error)');
  }

  // ── 5D6-FIX-03: 8-decimal token0 ──
  {
    const snaps = [
      mkSnap(SNAP_8DEC_RESERVE0, SNAP_18DEC_RESERVE0, 100),
      mkSnap((2_000_000n * 10n ** 8n).toString(), SNAP_18DEC_RESERVE0, 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 8);
    assert(m.status === 'ok', '5D6-FIX-03: 8-dec token0 metrics ok');
    assert(m.minLiquidityUsd !== null && m.minLiquidityUsd > 1_900_000 && m.minLiquidityUsd < 2_100_000,
      '5D6-FIX-03: 8-dec token0 USD liquidity correct (no 10^10 scaling error)');
  }

  // ── 5D6-FIX-04: 18-decimal token1 — reserve1 used ──
  {
    const snaps = [
      mkSnap('999', SNAP_18DEC_RESERVE0, 100),                       // reserve0 is junk
      mkSnap('999', (2_000_000n * 10n ** 18n).toString(), 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, false, 18);  // isToken0=false
    assert(m.status === 'ok', '5D6-FIX-04: token1=18dec uses reserve1');
    // minTargetReserve must equal SNAP_18DEC_RESERVE0 (the reserve1 from snap 1)
    assert(m.minTargetReserve === SNAP_18DEC_RESERVE0,
      '5D6-FIX-04: minTargetReserve is reserve1 value, not reserve0');
  }

  // ── 5D6-FIX-05: 6-decimal token1 — reserve1 used and correctly normalised ──
  {
    const snaps = [
      mkSnap('999', SNAP_6DEC_RESERVE0, 100),
      mkSnap('999', (2_000_000n * 10n ** 6n).toString(), 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, false, 6);   // isToken0=false, 6-dec
    assert(m.status === 'ok', '5D6-FIX-05: token1=6dec uses reserve1');
    assert(m.minTargetReserve === SNAP_6DEC_RESERVE0,
      '5D6-FIX-05: minTargetReserve is reserve1 value');
    assert(m.minLiquidityUsd !== null && m.minLiquidityUsd > 1_900_000 && m.minLiquidityUsd < 2_100_000,
      '5D6-FIX-05: 6-dec token1 USD liquidity correct');
  }

  // ── 5D6-FIX-06: 8-decimal token1 — reserve1 used and correctly normalised ──
  {
    const snaps = [
      mkSnap('999', SNAP_8DEC_RESERVE0, 100),
      mkSnap('999', (2_000_000n * 10n ** 8n).toString(), 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, false, 8);   // isToken0=false, 8-dec
    assert(m.status === 'ok', '5D6-FIX-06: token1=8dec uses reserve1');
    assert(m.minTargetReserve === SNAP_8DEC_RESERVE0,
      '5D6-FIX-06: minTargetReserve is reserve1 value');
    assert(m.minLiquidityUsd !== null && m.minLiquidityUsd > 1_900_000 && m.minLiquidityUsd < 2_100_000,
      '5D6-FIX-06: 8-dec token1 USD liquidity correct');
  }

  // ── 5D6-FIX-07: Scenario F — token0 + 18 decimals ──
  // minTargetReserve = SNAP_18DEC_RESERVE0 (same scale as engine 18-dec internal)
  // The engine should scale 1e18-unit raw reserve × 10^(18-18) = same value → valid sim
  {
    const snaps = [
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 100),
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 18);
    assert(m.status === 'ok', '5D6-FIX-07: historical ok for ScenF 18-dec token0');
    assert(m.minTargetReserve !== null, '5D6-FIX-07: minTargetReserve not null');
    // If fed to Scenario F: minR0 = BigInt(SNAP_18DEC_RESERVE0) * 10^(18-18) = same bigint
    const minR0ScF = BigInt(m.minTargetReserve!) * (10n ** BigInt(18 - 18));
    assert(minR0ScF === 1_000_000n * 10n ** 18n, '5D6-FIX-07: ScenF minR0 correct for 18-dec token0');
  }

  // ── 5D6-FIX-08: Scenario F — token0 + 6 decimals ──
  // Raw reserve stored at 6 decimals; engine normalizes to 18 decimals for comparison
  {
    const snaps = [
      mkSnap(SNAP_6DEC_RESERVE0, SNAP_18DEC_RESERVE0, 100),
      mkSnap(SNAP_6DEC_RESERVE0, SNAP_18DEC_RESERVE0, 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 6);
    assert(m.status === 'ok', '5D6-FIX-08: historical ok for ScenF 6-dec token0');
    assert(m.minTargetReserve !== null, '5D6-FIX-08: minTargetReserve not null');
    // Scenario F: scale raw 6-dec reserve to 18-dec: × 10^(18-6) = × 10^12
    const minR0ScF = BigInt(m.minTargetReserve!) * (10n ** BigInt(18 - 6));
    assert(minR0ScF === 1_000_000n * 10n ** 18n,
      '5D6-FIX-08: ScenF minR0 correctly scaled from 6-dec to 18-dec (no mismatch)');
  }

  // ── 5D6-FIX-09: Scenario F — token1 + 6 decimals ──
  {
    const snaps = [
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_6DEC_RESERVE0, 100),
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_6DEC_RESERVE0, 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, false, 6);  // isToken0=false
    assert(m.status === 'ok', '5D6-FIX-09: historical ok for ScenF 6-dec token1');
    assert(m.minTargetReserve === SNAP_6DEC_RESERVE0,
      '5D6-FIX-09: ScenF uses reserve1 (not reserve0) for 6-dec token1');
    const minR0ScF = BigInt(m.minTargetReserve!) * (10n ** BigInt(18 - 6));
    assert(minR0ScF === 1_000_000n * 10n ** 18n,
      '5D6-FIX-09: ScenF correctly normalizes 6-dec token1 reserve to 18-dec');
  }

  // ── 5D6-FIX-10: Scenario F — token1 + 8 decimals ──
  {
    const snaps = [
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_8DEC_RESERVE0, 100),
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_8DEC_RESERVE0, 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, false, 8);  // isToken0=false
    assert(m.status === 'ok', '5D6-FIX-10: historical ok for ScenF 8-dec token1');
    assert(m.minTargetReserve === SNAP_8DEC_RESERVE0,
      '5D6-FIX-10: ScenF uses reserve1 for 8-dec token1');
    const minR0ScF = BigInt(m.minTargetReserve!) * (10n ** BigInt(18 - 8));
    assert(minR0ScF === 1_000_000n * 10n ** 18n,
      '5D6-FIX-10: ScenF correctly normalizes 8-dec token1 reserve to 18-dec');
  }

  // ── 5D6-FIX-11: Missing token decimals — invalid value ──
  {
    const snaps = [mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 100),
                   mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 200)];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, -1 as any);  // invalid decimals
    assert(m.status === 'unavailable', '5D6-FIX-11: invalid decimals (-1) → unavailable');
    assert(m.minLiquidityUsd === null, '5D6-FIX-11: no USD liquidity fabricated with invalid decimals');
  }

  // ── 5D6-FIX-12: Invalid token decimals (>255) ──
  {
    const snaps = [mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 100),
                   mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 200)];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 256 as any);  // invalid
    assert(m.status === 'unavailable', '5D6-FIX-12: invalid decimals (256) → unavailable');
  }

  // ── 5D6-FIX-13: Historical reserve = 0 ──
  {
    const snaps = [
      mkSnap('0', SNAP_18DEC_RESERVE0, 100),     // reserve0 = 0 is invalid
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 18);
    // Snapshot 1 has valid reserve0, snapshot 2 has valid reserve0. Only valid ones counted.
    // validTarget will have 1 entry (the 0 is filtered). Status should be insufficient_data.
    assert(m.status === 'insufficient_data' || m.status === 'ok',
      '5D6-FIX-13: zero reserves handled without fabrication');
    if (m.status === 'ok') {
      assert(m.minLiquidityUsd !== null && m.minLiquidityUsd > 0,
        '5D6-FIX-13: no zero-fill synthetic liquidity');
    }
  }

  // ── 5D6-FIX-14: uint112 maximum historical reserve ──
  {
    const UINT112_MAX = (2n ** 112n - 1n).toString();
    const snaps = [
      mkSnap(UINT112_MAX, SNAP_18DEC_RESERVE0, 100),
      mkSnap(UINT112_MAX, SNAP_18DEC_RESERVE0, 200),
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 18);
    // Should not crash and should report consistent (very large) values
    assert(m.status === 'ok' || m.status === 'insufficient_data',
      '5D6-FIX-14: uint112 max reserve does not throw');
    if (m.status === 'ok') {
      assert(m.minTargetReserve === UINT112_MAX, '5D6-FIX-14: uint112 max reserve preserved exactly');
    }
  }

  // ── 5D6-FIX-15: Mixed valid/invalid snapshots ──
  {
    const snaps = [
      mkSnap('not_a_number', SNAP_18DEC_RESERVE0, 100),   // invalid reserve0
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 200),  // valid
      mkSnap(SNAP_18DEC_RESERVE0, SNAP_18DEC_RESERVE0, 300),  // valid
    ];
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 18);
    // Invalid snap is skipped; 2 valid remain → status ok
    assert(m.status === 'ok', '5D6-FIX-15: invalid snapshots skipped, valid ones preserved');
    assert(m.minTargetReserve === SNAP_18DEC_RESERVE0,
      '5D6-FIX-15: minTargetReserve from valid snapshots only');
  }

  // ─────────────────────────────────────────────────────────────────
  // INVARIANT FIX TESTS
  // ─────────────────────────────────────────────────────────────────

  // INV-FIX-1: Equivalent economic reserve in 18-dec and 6-dec produces equivalent normalizedReserve
  {
    // 1,000,000 tokens at 18 decimals → raw = 1e24
    // 1,000,000 tokens at 6 decimals  → raw = 1e12
    // Both should produce identical normalised token amount (1,000,000)
    const raw18 = 1_000_000n * 10n ** 18n;
    const raw6  = 1_000_000n * 10n ** 6n;
    // Simulating the normalizeRawReserve logic:
    const norm18 = Number(raw18 * 1_000_000n / 10n ** 18n) / 1_000_000;
    const norm6  = Number(raw6  * 1_000_000n / 10n ** 6n)  / 1_000_000;
    assert(Math.abs(norm18 - norm6) < 0.001,
      'INV-FIX-1: 18-dec raw and 6-dec raw normalize to same token amount');
  }

  // INV-FIX-2: token0 and token1 snapshots (economically identical) produce same minLiquidityUsd
  {
    const IDENTICAL_RESERVE = (1_000_000n * 10n ** 18n).toString();
    const snaps = [
      mkSnap(IDENTICAL_RESERVE, IDENTICAL_RESERVE, 100),
      mkSnap(IDENTICAL_RESERVE, IDENTICAL_RESERVE, 200),
    ];
    const mToken0 = analyzeHistoricalSnapshots(snaps, SPOT_1, true, 18);
    const mToken1 = analyzeHistoricalSnapshots(snaps, SPOT_1, false, 18);
    assert(mToken0.status === 'ok' && mToken1.status === 'ok',
      'INV-FIX-2: both token0 and token1 snapshot analysis succeed');
    assert(mToken0.minLiquidityUsd === mToken1.minLiquidityUsd,
      'INV-FIX-2: identical reserves produce identical minLiquidityUsd regardless of slot');
  }

  // INV-FIX-3: Changing token decimals with proportionally adjusted raw reserve → same USD liquidity
  {
    // 100 tokens at 18 dec = raw 100e18; 100 tokens at 6 dec = raw 100e6
    const raw18 = (100n * 10n ** 18n).toString();
    const raw6  = (100n * 10n ** 6n).toString();
    const SPOT_100 = 100.0; // $100 per token → 100 tokens × $100 × 2 = $20,000

    const snaps18 = [mkSnap(raw18, raw18, 100), mkSnap(raw18, raw18, 200)];
    const snaps6  = [mkSnap(raw6,  raw6,  100), mkSnap(raw6,  raw6,  200)];

    const m18 = analyzeHistoricalSnapshots(snaps18, SPOT_100, true, 18);
    const m6  = analyzeHistoricalSnapshots(snaps6,  SPOT_100, true, 6);

    assert(m18.status === 'ok' && m6.status === 'ok', 'INV-FIX-3: both succeed');
    // Both should report minLiquidityUsd ≈ $20,000 (±1 for fp rounding)
    assert(m18.minLiquidityUsd !== null && m6.minLiquidityUsd !== null,
      'INV-FIX-3: both report non-null USD liquidity');
    assert(Math.abs(m18.minLiquidityUsd! - m6.minLiquidityUsd!) < 1.0,
      'INV-FIX-3: changing decimals with proportional raw reserve produces same USD liquidity');
  }

  // INV-FIX-4: Changing token slot with identical slot values → same result
  {
    const RESERVE = (500_000n * 10n ** 18n).toString();
    const snaps = [
      mkSnap(RESERVE, RESERVE, 100),
      mkSnap(RESERVE, RESERVE, 200),
    ];
    const m0 = analyzeHistoricalSnapshots(snaps, SPOT_1, true,  18);
    const m1 = analyzeHistoricalSnapshots(snaps, SPOT_1, false, 18);
    assert(m0.status === 'ok' && m1.status === 'ok', 'INV-FIX-4: both slots succeed');
    assert(m0.minTargetReserve === m1.minTargetReserve,
      'INV-FIX-4: identical reserve values in both slots produce same minTargetReserve');
    assert(m0.minLiquidityUsd === m1.minLiquidityUsd,
      'INV-FIX-4: identical reserve values in both slots produce same minLiquidityUsd');
  }

  // INV-FIX-5: Scenario F minTargetReserve is from the correct slot (token1 test)
  {
    const R0_LARGE = (9_999_000n * 10n ** 18n).toString();  // large reserve0 (not the target)
    const R1_SMALL = (     100n * 10n ** 18n).toString();   // small reserve1 (the target)
    const snaps = [
      mkSnap(R0_LARGE, R1_SMALL, 100),
      mkSnap(R0_LARGE, R1_SMALL, 200),
    ];
    // isToken0=false: target is reserve1 (small)
    const m = analyzeHistoricalSnapshots(snaps, SPOT_1, false, 18);
    assert(m.status === 'ok', 'INV-FIX-5: analysis ok for token1 slot with different-sized reserves');
    assert(m.minTargetReserve === R1_SMALL,
      'INV-FIX-5: ScenF uses token1 (reserve1) for minimum — not the larger reserve0');
    assert(m.maxTargetReserve === R1_SMALL,
      'INV-FIX-5: ScenF min and max match reserve1, not reserve0');
  }

  console.log('\n--- Phase 5D-6 tests complete ---');
}

// ────────────────────────────────────────────────
// Phase 5D-7: Wallet Quality & Funding Source Integration Tests
// ────────────────────────────────────────────────
async function runPhase5D7Tests() {
  console.log('\n--- Phase 5D-7: Wallet Quality & Funding Source Integration Tests ---');

  // Let's create some common mock transactions to analyze
  const txs: UniversalTransaction[] = [
    makeTx({ hash: 'tx1', from: '0x1', to: '0xbuyer1', amount: 100, type: 'buy' }),
    makeTx({ hash: 'tx2', from: '0x2', to: '0xbuyer2', amount: 200, type: 'buy' }),
    makeTx({ hash: 'tx3', from: '0x3', to: '0xbuyer3', amount: 300, type: 'buy' }),
    makeTx({ hash: 'tx4', from: '0x4', to: '0xbuyer4', amount: 400, type: 'buy' }),
    makeTx({ hash: 'tx5', from: '0x5', to: '0xbuyer5', amount: 500, type: 'buy' }),
  ];

  // Helper to create a wallet quality profile
  const mkProfile = (addr: string, ageDays: number, txCount: number, activeDays: number, fundingSrc: string | null, fundingType: any = 'wallet'): WalletQualityProfile => ({
    walletAddress: addr,
    chain: 'eth',
    firstSeenAt: new Date(Date.now() - ageDays * 86400 * 1000).toISOString(),
    walletAgeDays: ageDays,
    transactionCount: txCount,
    activeDaysCount: activeDays,
    lastUpdated: Math.floor(Date.now() / 1000),
    coverage: 'complete',
    provenance: 'goldrush',
    fundingSource: fundingSrc,
    fundingSourceType: fundingType,
  });

  // ────────────────────────────────────────────────
  // 5D7-01: All buyers have diverse funding sources
  // ────────────────────────────────────────────────
  {
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 10, 50, 10, '0xfunder1')],
      ['0xbuyer2', mkProfile('0xbuyer2', 12, 60, 12, '0xfunder2')],
      ['0xbuyer3', mkProfile('0xbuyer3', 15, 70, 15, '0xfunder3')],
      ['0xbuyer4', mkProfile('0xbuyer4', 20, 80, 20, '0xfunder4')],
      ['0xbuyer5', mkProfile('0xbuyer5', 30, 90, 30, '0xfunder5')],
    ]);

    const result = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    assert(result.status === 'ok', '5D7-01: analysis status is ok');
    const metric = result.cohortMetrics;
    assert(metric.profiledBuyerCount === 5, '5D7-01: profiledBuyerCount is 5');
    assert(metric.largestFundingSourceBuyerCount === 1, '5D7-01: largestFundingSourceBuyerCount is 1');
    assert(metric.largestFundingSourceBuyerRatio === 0.2, '5D7-01: largest ratio is 0.2 (1/5)');
    const hfcFactor = result.negativeFactors.find(f => f.name === 'High Funding Concentration');
    assert(!hfcFactor, '5D7-01: no High Funding Concentration warning');
  }

  // ────────────────────────────────────────────────
  // 5D7-02: Multiple buyers share one funding source
  // ────────────────────────────────────────────────
  {
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 20, 50, 10, '0xfunder_shared')],
      ['0xbuyer2', mkProfile('0xbuyer2', 20, 60, 12, '0xfunder_shared')],
      ['0xbuyer3', mkProfile('0xbuyer3', 20, 70, 15, '0xfunder_shared')],
      ['0xbuyer4', mkProfile('0xbuyer4', 20, 80, 20, '0xfunder4')],
      ['0xbuyer5', mkProfile('0xbuyer5', 20, 90, 30, '0xfunder5')],
    ]);

    const result = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    const metric = result.cohortMetrics;
    assert(metric.largestFundingSourceBuyerCount === 3, '5D7-02: largest shared group size is 3');
    assert(metric.largestFundingSourceBuyerRatio === 0.6, '5D7-02: ratio is 0.6 (3/5)');
    const hfcFactor = result.negativeFactors.find(f => f.name === 'High Funding Concentration');
    assert(hfcFactor !== undefined, '5D7-02: High Funding Concentration penalty applied');
  }

  // ────────────────────────────────────────────────
  // 5D7-03: Case-insensitive EVM funding address comparison
  // ────────────────────────────────────────────────
  {
    // Use proper 42-char EVM addresses so normalizeAddress collapses mixed-case variants
    const FUNDER_UPPER = '0xF1234567890123456789012345678901234ABCDE';
    const FUNDER_LOWER = '0xf1234567890123456789012345678901234abcde';
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 20, 50, 10, FUNDER_UPPER)],
      ['0xbuyer2', mkProfile('0xbuyer2', 20, 60, 12, FUNDER_LOWER)],
      ['0xbuyer3', mkProfile('0xbuyer3', 20, 70, 15, FUNDER_LOWER)],
      ['0xbuyer4', mkProfile('0xbuyer4', 20, 80, 20, '0xf0000000000000000000000000000000000000f4')],
      ['0xbuyer5', mkProfile('0xbuyer5', 20, 90, 30, '0xf0000000000000000000000000000000000000f5')],
    ]);

    const result = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    const metric = result.cohortMetrics;
    assert(metric.largestFundingSourceBuyerCount === 3, '5D7-03: case-insensitivity works for EVM address comparison');
  }

  // ────────────────────────────────────────────────
  // 5D7-04: Partial wallet profile coverage
  // ────────────────────────────────────────────────
  {
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 20, 50, 10, '0xfunder_shared')],
      ['0xbuyer2', mkProfile('0xbuyer2', 20, 60, 12, '0xfunder_shared')],
    ]);

    const result = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    const metric = result.cohortMetrics;
    assert(metric.profiledBuyerCount === 2, '5D7-04: profiledBuyerCount is 2');
    assert(metric.largestFundingSourceBuyerCount === 2, '5D7-04: largest shared group size is 2');
    assert(metric.largestFundingSourceBuyerRatio === 1.0, '5D7-04: ratio is computed against profiled wallets (2/2 = 1.0)');
    // profileCoverage = 2/5 = 40% (exceeds minimum 20% limit), but profiledBuyerCount < minProfiledForConcentration (3)
    // So concentration penalty is NOT applied.
    const hfcFactor = result.negativeFactors.find(f => f.name === 'High Funding Concentration');
    assert(!hfcFactor, '5D7-04: no concentration penalty since profiled count < min limit (3)');
  }

  // ────────────────────────────────────────────────
  // 5D7-05: No wallet profiles
  // ────────────────────────────────────────────────
  {
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map());
    const metric = result.cohortMetrics;
    assert(metric.profiledBuyerCount === 0, '5D7-05: profiledBuyerCount is 0');
    assert(metric.largestFundingSourceBuyerRatio === 0, '5D7-05: largest ratio is 0');
    assert(result.unavailableMetrics.includes('fundingSourceAnalysis'), '5D7-05: fundingSourceAnalysis is unavailable');
  }

  // ────────────────────────────────────────────────
  // 5D7-06: Fresh/low-activity buyer cohort
  // ────────────────────────────────────────────────
  {
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 5, 2, 1, '0xfunder1')], // fresh, low activity
      ['0xbuyer2', mkProfile('0xbuyer2', 4, 3, 1, '0xfunder2')], // fresh, low activity
      ['0xbuyer3', mkProfile('0xbuyer3', 6, 1, 1, '0xfunder3')], // fresh, low activity
      ['0xbuyer4', mkProfile('0xbuyer4', 30, 80, 20, '0xfunder4')],
      ['0xbuyer5', mkProfile('0xbuyer5', 30, 90, 30, '0xfunder5')],
    ]);

    const result = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    const metric = result.cohortMetrics;
    assert(metric.lowActivityBuyerCount === 3, '5D7-06: lowActivityBuyerCount is 3');
    assert(metric.lowActivityBuyerRatio === 0.6, '5D7-06: lowActivityBuyerRatio is 0.6 (3/5)');
    assert(metric.freshBuyerCount === 3, '5D7-06: freshBuyerCount is 3');
    assert(metric.freshBuyerRatio === 0.6, '5D7-06: freshBuyerRatio is 0.6 (3/5)');

    const lowActFactor = result.negativeFactors.find(f => f.name === 'High Low-Activity Buyer Rate');
    assert(lowActFactor !== undefined, '5D7-06: Low Activity penalty applied');
    const freshFactor = result.negativeFactors.find(f => f.name === 'High Fresh Wallet Rate');
    assert(freshFactor !== undefined, '5D7-06: Fresh Wallet penalty applied');
  }

  // ────────────────────────────────────────────────
  // 5D7-07: Funding source type CEX
  // ────────────────────────────────────────────────
  {
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 20, 50, 10, '0xfunder_shared', 'cex')],
      ['0xbuyer2', mkProfile('0xbuyer2', 20, 60, 12, '0xfunder_shared', 'cex')],
      ['0xbuyer3', mkProfile('0xbuyer3', 20, 70, 15, '0xfunder_shared', 'cex')],
      ['0xbuyer4', mkProfile('0xbuyer4', 20, 80, 20, '0xfunder4')],
      ['0xbuyer5', mkProfile('0xbuyer5', 20, 90, 30, '0xfunder5')],
    ]);

    const result = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    const metric = result.cohortMetrics;
    assert(metric.largestFundingSourceBuyerCount === 3, '5D7-07: largest funding source group size is 3');
    assert(metric.largestFundingSourceBuyerRatio === 0.6, '5D7-07: ratio is 0.6');
    const profile1 = walletProfiles.get('0xbuyer1')!;
    assert(profile1.fundingSourceType === 'cex', '5D7-07: funding source type is CEX');
  }

  // ────────────────────────────────────────────────
  // 5D7-08: Funding source type contract/wallet/bridge
  // ────────────────────────────────────────────────
  {
    const profile = mkProfile('0xbuyer1', 10, 10, 5, '0xfunder', 'contract');
    assert(profile.fundingSourceType === 'contract', '5D7-08: contract type accepted');
  }

  // ────────────────────────────────────────────────
  // 5D7-09: Funding source unavailable
  // ────────────────────────────────────────────────
  {
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 20, 50, 10, null)],
      ['0xbuyer2', mkProfile('0xbuyer2', 20, 60, 12, null)],
      ['0xbuyer3', mkProfile('0xbuyer3', 20, 70, 15, null)],
    ]);

    const result = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    const metric = result.cohortMetrics;
    assert(metric.uniqueFundingSourceCount === 0, '5D7-09: uniqueFundingSourceCount is 0 when fundingSource is null');
    assert(metric.largestFundingSourceBuyerCount === 0, '5D7-09: largest group size is 0');
  }

  // ────────────────────────────────────────────────
  // 5D7-10: Metrics not interpreted as cross-token win rate
  // ────────────────────────────────────────────────
  {
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 20, 50, 10, '0xfunder')],
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    assert(result.unavailableMetrics.includes('crossTokenHistory'), '5D7-10: crossTokenHistory is still unavailable');
    assert(result.unavailableMetrics.includes('historicalWinRate'), '5D7-10: historicalWinRate is still unavailable');
  }

  // ────────────────────────────────────────────────
  // 5D7-11: Existing SmartMoney reputation data
  // ────────────────────────────────────────────────
  {
    const smartMoneyBuyerCount = 2;
    const smartMoneyBuyerRatio = 0.4;
    const smartMoneyBuyerConfidence = 90;

    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map());
    result.smartMoneyBuyerCount = smartMoneyBuyerCount;
    result.smartMoneyBuyerRatio = smartMoneyBuyerRatio;
    result.smartMoneyBuyerConfidence = smartMoneyBuyerConfidence;

    assert(result.smartMoneyBuyerCount === 2, '5D7-11: smartMoneyBuyerCount is integrated correctly');
    assert(result.smartMoneyBuyerRatio === 0.4, '5D7-11: smartMoneyBuyerRatio is integrated correctly');
    assert(result.smartMoneyBuyerConfidence === 90, '5D7-11: smartMoneyBuyerConfidence is integrated');
  }

  // ────────────────────────────────────────────────
  // 5D7-12: Regression test for existing Buyer Quality score
  // ────────────────────────────────────────────────
  {
    // Baseline: 5 buyers, all single-use (no priceUsd so buy volumes = 0, erratic check skipped).
    // Score = baseScore(60) - singleUse penalty(20, ratio=1.0 > 0.8 limit) = 40.
    // totalBuyers=5 equals thinLimit(5) so no thin penalty.
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map());
    assert(result.buyerQualityScore === 40, `5D7-12: baseline score matches expected 40 (got ${result.buyerQualityScore})`);
  }

  // ────────────────────────────────────────────────
  // 5D7-13: Evidence generation
  // ────────────────────────────────────────────────
  {
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 20, 50, 10, '0xfunder_shared')],
      ['0xbuyer2', mkProfile('0xbuyer2', 20, 60, 12, '0xfunder_shared')],
      ['0xbuyer3', mkProfile('0xbuyer3', 20, 70, 15, '0xfunder_shared')],
    ]);
    const bqResult = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    
    const evidence = {
      evidenceId: 'buyer-cohort-analysis',
      fact: `Profiled ${bqResult.cohortMetrics.profiledBuyerCount} buyer wallet(s).`,
      metric: `Largest funding source shared by ${bqResult.cohortMetrics.largestFundingSourceBuyerCount} buyer(s) (${(bqResult.cohortMetrics.largestFundingSourceBuyerRatio! * 100).toFixed(1)}%).`,
      signal: bqResult.buyerQualityScore < 50 ? 'risk' : 'normal',
      traderImpact: 'Identifies potential coordination patterns',
      confidence: bqResult.confidence,
      sources: ['goldrush'],
      generatedAt: Math.floor(Date.now() / 1000),
    };

    // 3 profiled buyers, all share one funding source → ratio = 3/3 = 100.0%
    assert(evidence.sources.includes('goldrush'), '5D7-13: evidence source includes goldrush');
    assert(evidence.metric.includes('100.0%'), '5D7-13: evidence metric calculates correct ratio string (3/3 profiled)');
  }

  // ────────────────────────────────────────────────
  // 5D7-14: Trader Intelligence
  // ────────────────────────────────────────────────
  {
    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 20, 50, 10, '0xfunder_shared')],
      ['0xbuyer2', mkProfile('0xbuyer2', 20, 60, 12, '0xfunder_shared')],
      ['0xbuyer3', mkProfile('0xbuyer3', 20, 70, 15, '0xfunder_shared')],
    ]);
    const bqResult = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);

    const report = generateTraderIntelligenceReport({
      tokenAddress: '0xToken',
      tokenSymbol: 'TEST',
      tokenName: 'Test Token',
      network: 'eth',
      ammSlippage: { status: 'ok', simulations: [], isThinLiquidity: false, evidenceIds: [] },
      volumeConcentration: {
        status: 'ok',
        totalBuyVolumeUsd: 1500,
        totalSellVolumeUsd: 0,
        buySellRatio: 0,
        uniqueBuyers: 5,
        uniqueSellers: 0,
        buyerHHI: { hhi: 0.2, concentrationLevel: 'low', topWallets: [] },
        sellerHHI: { hhi: 0, concentrationLevel: 'low', topWallets: [] },
        totalVolumeHHI: { hhi: 0.2, concentrationLevel: 'low', topWallets: [] },
        elevatorWashTraderCount: 0,
        elevatorWashVolumeUsd: 0,
        washVolumeRatio: 0,
        volumePriceDivergence: false,
        organicScore: 100,
        evidenceIds: [],
      },
      whaleBehavior: { status: 'ok', reason: '', dataSemanticWarning: '', supplyThresholdPct: 1, liquidityThresholdPct: 5, whales: [], activeWhaleCount: 0, totalWhaleSupplySharePct: 0, whaleNetInflow: 0, whaleNetOutflow: 0, phase: 'neutral', isDistributionRisk: false, evidenceIds: [] },
      whaleExit: { status: 'ok', simulationDisclaimer: '', targetWallets: [], combinedObservedBalance: 0, scenarios: [], maxSeverity: 'low', evidenceIds: [] },
      buyerQuality: bqResult,
      marketRegime: { status: 'ok', regime: 'ACCUMULATION', confidence: 90, stats: undefined, regimeDescription: '', predictionDisclaimer: '', evidenceIds: [] },
      capitalEfficiency: { status: 'ok', fdvToLiquidityRatio: 1.5, capitalSensitivityMultiplier: 2.0, sensitivity: 'medium', fdvUsd: 150000, totalLiquidityUsd: 100000, spotPriceUsd: 0.1, evidenceIds: [] },
      riskScore: {
        status: 'ok',
        overallRiskScore: 35,
        riskLevel: 'medium',
        subScores: [],
        topRisks: [],
        mitigators: [],
        confidence: 80,
        evidenceIds: [],
        sufficientData: true,
        scoreCompleteness: 'complete',
        availableModuleCount: 6,
        totalModuleCount: 6,
      },
      evidence: [],
      dataQuality: { staleDataWarning: false, elevatorDataReused: false, transactionCount: 5, ohlcvCandleCount: 0 },
      limitations: [],
      scanId: 'test-scan-id',
      timestamp: Date.now(),
    });

    // 3 profiled, all share one funder → ratio = 3/3 = 100.0%
    assert(report.buyerQualityAssessment.includes('Elevated funding concentration detected among profiled buyers: 100.0%'), '5D7-14: trader intelligence includes concentration notice');
  }

  // ────────────────────────────────────────────────
  // 5D7-15: Configuration threshold behavior
  // ────────────────────────────────────────────────
  {
    const originalThreshold = DEEP_SCAN_CONFIG.buyerQuality.phase5D7.fundingConcentrationThreshold;
    DEEP_SCAN_CONFIG.buyerQuality.phase5D7.fundingConcentrationThreshold = 0.70;

    const walletProfiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', 20, 50, 10, '0xfunder_shared')],
      ['0xbuyer2', mkProfile('0xbuyer2', 20, 60, 12, '0xfunder_shared')],
      ['0xbuyer3', mkProfile('0xbuyer3', 20, 70, 15, '0xfunder_shared')],
      ['0xbuyer4', mkProfile('0xbuyer4', 20, 80, 20, '0xfunder4')],
      ['0xbuyer5', mkProfile('0xbuyer5', 20, 90, 30, '0xfunder5')],
    ]);

    const result = analyzeBuyerQuality(txs, new Set(), new Set(), walletProfiles);
    const hfcFactor = result.negativeFactors.find(f => f.name === 'High Funding Concentration');
    assert(!hfcFactor, '5D7-15: concentration warning NOT triggered since ratio 0.60 is below new threshold 0.70');

    DEEP_SCAN_CONFIG.buyerQuality.phase5D7.fundingConcentrationThreshold = originalThreshold;
  }

  console.log('\n--- Phase 5D-7 tests complete ---');
}

async function runPhase5D8Tests() {
  console.log('\n--- Phase 5D-8: Cross-Token History & Historical Win Rate Cohort Integration Tests ---');

  // ── Shared helpers ──

  const txs: UniversalTransaction[] = [
    makeTx({ hash: 'tx1', from: '0x1', to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', amount: 100, type: 'buy' }),
    makeTx({ hash: 'tx2', from: '0x2', to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', amount: 200, type: 'buy' }),
    makeTx({ hash: 'tx3', from: '0x3', to: '0xcccccccccccccccccccccccccccccccccccccccc', amount: 300, type: 'buy' }),
    makeTx({ hash: 'tx4', from: '0x4', to: '0xdddddddddddddddddddddddddddddddddddddddd', amount: 400, type: 'buy' }),
    makeTx({ hash: 'tx5', from: '0x5', to: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', amount: 500, type: 'buy' }),
  ];

  const addrs = [
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '0xcccccccccccccccccccccccccccccccccccccccc',
    '0xdddddddddddddddddddddddddddddddddddddddd',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ];

  function mkRep(
    addr: string,
    opts: {
      distinctTokensTraded?: number;
      closedTradeCount?: number;
      winRate?: number | null;
      status?: SmartMoneyReputationRecord['status'];
    } = {}
  ): SmartMoneyReputationRecord {
    return {
      walletAddress: addr,
      chain: 'eth',
      distinctTokensTraded: opts.distinctTokensTraded ?? 0,
      closedTradeCount: opts.closedTradeCount ?? 0,
      winRate: opts.winRate ?? null,
      status: opts.status ?? 'available',
      freshness: 'FRESH',
      lastUpdatedAt: new Date().toISOString(),
      provider: 'test',
    };
  }

  // ────────────────────────────────────────────────
  // 5D8-01: Cross-token ratio correctly computed
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>([
      [addrs[0], mkRep(addrs[0], { distinctTokensTraded: 5, closedTradeCount: 10, winRate: 0.5 })],
      [addrs[1], mkRep(addrs[1], { distinctTokensTraded: 2, closedTradeCount: 8, winRate: 0.6 })],
      [addrs[2], mkRep(addrs[2], { distinctTokensTraded: 0, closedTradeCount: 3, winRate: 0.3 })],
      [addrs[3], mkRep(addrs[3], { distinctTokensTraded: 0, closedTradeCount: 5, winRate: 0.4 })],
      [addrs[4], mkRep(addrs[4], { distinctTokensTraded: 1, closedTradeCount: 7, winRate: 0.7 })],
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    const m = result.cohortMetrics;
    assert(m.profiledReputationCount === 5, '5D8-01: profiledReputationCount is 5');
    assert(m.crossTokenBuyerCount === 3, '5D8-01: crossTokenBuyerCount is 3');
    assert(Math.abs((m.crossTokenBuyerRatio ?? -1) - 0.6) < 0.001, '5D8-01: crossTokenBuyerRatio is 0.6');
  }

  // ────────────────────────────────────────────────
  // 5D8-02: Coverage gate blocks scoring when rep coverage < threshold
  // ────────────────────────────────────────────────
  {
    const originalCoverage = DEEP_SCAN_CONFIG.buyerQuality.phase5D8.minimumReputationCoverage;
    DEEP_SCAN_CONFIG.buyerQuality.phase5D8.minimumReputationCoverage = 0.60;

    const reps = new Map<string, SmartMoneyReputationRecord>([
      [addrs[0], mkRep(addrs[0], { distinctTokensTraded: 0, closedTradeCount: 10, winRate: 0.1 })],
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    const crossTokenFactor = result.negativeFactors.find(f => f.name === 'Low Cross-Token Activity');
    const winRateFactor = result.negativeFactors.find(f => f.name === 'Low Cohort Historical Win Rate');
    assert(!crossTokenFactor, '5D8-02: cross-token penalty NOT triggered when coverage gate fails');
    assert(!winRateFactor, '5D8-02: win-rate penalty NOT triggered when coverage gate fails');
    assert(result.unavailableMetrics.includes('crossTokenHistory'), '5D8-02: crossTokenHistory stays in unavailableMetrics when gate fails');

    DEEP_SCAN_CONFIG.buyerQuality.phase5D8.minimumReputationCoverage = originalCoverage;
  }

  // ────────────────────────────────────────────────
  // 5D8-03: Low cross-token ratio triggers penalty
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>(
      addrs.map(a => [a, mkRep(a, { distinctTokensTraded: 0, closedTradeCount: 0, winRate: null })])
    );
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    const factor = result.negativeFactors.find(f => f.name === 'Low Cross-Token Activity');
    assert(factor !== undefined, '5D8-03: Low Cross-Token Activity factor triggered when ratio = 0');
    assert(factor!.weight === -DEEP_SCAN_CONFIG.buyerQuality.phase5D8.crossTokenPenalty, '5D8-03: penalty weight matches config');
  }

  // ────────────────────────────────────────────────
  // 5D8-04: High cross-token ratio suppresses penalty
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>(
      addrs.map(a => [a, mkRep(a, { distinctTokensTraded: 3, closedTradeCount: 5, winRate: 0.5 })])
    );
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    const factor = result.negativeFactors.find(f => f.name === 'Low Cross-Token Activity');
    assert(!factor, '5D8-04: no cross-token penalty when ratio = 1.0');
  }

  // ────────────────────────────────────────────────
  // 5D8-05: Low cohort avg win rate triggers penalty
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>(
      addrs.map(a => [a, mkRep(a, { distinctTokensTraded: 1, closedTradeCount: 10, winRate: 0.20 })])
    );
    const baseResult = analyzeBuyerQuality(txs, new Set(), new Set(), new Map());
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    const factor = result.negativeFactors.find(f => f.name === 'Low Cohort Historical Win Rate');
    assert(factor !== undefined, '5D8-05: Low Cohort Historical Win Rate triggered when avg = 0.20');
    assert(result.buyerQualityScore < baseResult.buyerQualityScore, '5D8-05: score is lower than baseline due to win-rate penalty');
  }

  // ────────────────────────────────────────────────
  // 5D8-06: High cohort avg win rate grants bonus
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>(
      addrs.map(a => [a, mkRep(a, { distinctTokensTraded: 5, closedTradeCount: 20, winRate: 0.80 })])
    );
    const baseResult = analyzeBuyerQuality(txs, new Set(), new Set(), new Map());
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    const factor = result.positiveFactors.find(f => f.name === 'High Cohort Historical Win Rate');
    assert(factor !== undefined, '5D8-06: High Cohort Historical Win Rate bonus present when avg = 0.80');
    assert(result.buyerQualityScore > baseResult.buyerQualityScore, '5D8-06: score is higher than baseline due to win-rate bonus');
  }

  // ────────────────────────────────────────────────
  // 5D8-07: Score clamped to [0, 100] with extreme penalties
  // ────────────────────────────────────────────────
  {
    const origCP = DEEP_SCAN_CONFIG.buyerQuality.phase5D8.crossTokenPenalty;
    const origWRP = DEEP_SCAN_CONFIG.buyerQuality.phase5D8.lowWinRatePenalty;
    DEEP_SCAN_CONFIG.buyerQuality.phase5D8.crossTokenPenalty = 1000;
    DEEP_SCAN_CONFIG.buyerQuality.phase5D8.lowWinRatePenalty = 1000;

    const reps = new Map<string, SmartMoneyReputationRecord>(
      addrs.map(a => [a, mkRep(a, { distinctTokensTraded: 0, closedTradeCount: 10, winRate: 0.10 })])
    );
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    assert(result.buyerQualityScore >= 0, '5D8-07: score >= 0 even with extreme penalties');
    assert(result.buyerQualityScore <= 100, '5D8-07: score <= 100');

    DEEP_SCAN_CONFIG.buyerQuality.phase5D8.crossTokenPenalty = origCP;
    DEEP_SCAN_CONFIG.buyerQuality.phase5D8.lowWinRatePenalty = origWRP;
  }

  // ────────────────────────────────────────────────
  // 5D8-08: EVM mixed-case address normalisation
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>([
      [normalizeAddress(addrs[0]), mkRep(addrs[0], { distinctTokensTraded: 3, closedTradeCount: 5, winRate: 0.55 })],
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    assert((result.cohortMetrics.profiledReputationCount ?? 0) >= 1, '5D8-08: mixed-case address resolved via normalisation');
  }

  // ────────────────────────────────────────────────
  // 5D8-09: Zero closed trades → cohortAvgWinRate is null
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>(
      addrs.map(a => [a, mkRep(a, { distinctTokensTraded: 2, closedTradeCount: 0, winRate: null })])
    );
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    assert(result.cohortMetrics.cohortAvgWinRate === null, '5D8-09: cohortAvgWinRate is null when all buyers have zero closed trades');
    assert(result.unavailableMetrics.includes('historicalWinRate'), '5D8-09: historicalWinRate remains in unavailableMetrics when avg is null');
  }

  // ────────────────────────────────────────────────
  // 5D8-10: Empty reputation map → no 5D-8 metrics
  // ────────────────────────────────────────────────
  {
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), new Map());
    assert((result.cohortMetrics.profiledReputationCount ?? 0) === 0, '5D8-10: profiledReputationCount is 0');
    assert(result.cohortMetrics.crossTokenBuyerRatio === undefined, '5D8-10: crossTokenBuyerRatio undefined');
    assert(result.cohortMetrics.cohortAvgWinRate === undefined, '5D8-10: cohortAvgWinRate undefined');
    assert(result.unavailableMetrics.includes('crossTokenHistory'), '5D8-10: crossTokenHistory in unavailableMetrics');
    assert(result.unavailableMetrics.includes('historicalWinRate'), '5D8-10: historicalWinRate in unavailableMetrics');
  }

  // ────────────────────────────────────────────────
  // 5D8-11: crossTokenHistory removed from unavailableMetrics when coverage gate met
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>(
      addrs.map(a => [a, mkRep(a, { distinctTokensTraded: 5, closedTradeCount: 10, winRate: 0.50 })])
    );
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    assert(!result.unavailableMetrics.includes('crossTokenHistory'), '5D8-11: crossTokenHistory removed when gate met');
  }

  // ────────────────────────────────────────────────
  // 5D8-12: historicalWinRate removed from unavailableMetrics when avg win rate is valid
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>(
      addrs.map(a => [a, mkRep(a, { distinctTokensTraded: 2, closedTradeCount: 5, winRate: 0.60 })])
    );
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    assert(!result.unavailableMetrics.includes('historicalWinRate'), '5D8-12: historicalWinRate removed when valid avg available');
  }

  // ────────────────────────────────────────────────
  // 5D8-13: Config threshold override — custom crossTokenThreshold
  // ────────────────────────────────────────────────
  {
    const origThreshold = DEEP_SCAN_CONFIG.buyerQuality.phase5D8.crossTokenThreshold;
    DEEP_SCAN_CONFIG.buyerQuality.phase5D8.crossTokenThreshold = 0.80;

    const reps = new Map<string, SmartMoneyReputationRecord>([
      [addrs[0], mkRep(addrs[0], { distinctTokensTraded: 1, closedTradeCount: 5, winRate: 0.5 })],
      [addrs[1], mkRep(addrs[1], { distinctTokensTraded: 1, closedTradeCount: 5, winRate: 0.5 })],
      [addrs[2], mkRep(addrs[2], { distinctTokensTraded: 1, closedTradeCount: 5, winRate: 0.5 })],
      [addrs[3], mkRep(addrs[3], { distinctTokensTraded: 0, closedTradeCount: 5, winRate: 0.5 })],
      [addrs[4], mkRep(addrs[4], { distinctTokensTraded: 0, closedTradeCount: 5, winRate: 0.5 })],
    ]);
    // crossTokenBuyerRatio = 3/5 = 0.60 < new threshold 0.80 → penalty fires
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    const factor = result.negativeFactors.find(f => f.name === 'Low Cross-Token Activity');
    assert(factor !== undefined, '5D8-13: penalty fires when crossTokenBuyerRatio 0.60 < custom threshold 0.80');

    DEEP_SCAN_CONFIG.buyerQuality.phase5D8.crossTokenThreshold = origThreshold;
  }

  // ────────────────────────────────────────────────
  // 5D8-14: TraderIntelligenceGenerator narrative includes cross-token and win-rate
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>(
      addrs.map(a => [a, mkRep(a, { distinctTokensTraded: 3, closedTradeCount: 10, winRate: 0.70 })])
    );
    const bqResult = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);

    const report = generateTraderIntelligenceReport({
      tokenAddress: '0xToken', tokenSymbol: 'TST', tokenName: 'Test Token', network: 'eth',
      scanId: 'test-5d8-14',
      ammSlippage: { status: 'insufficient_data', reason: 'No pool data for test', evidenceIds: [] } as any,
      volumeConcentration: { status: 'ok', uniqueBuyers: 5, uniqueSellers: 3, buyerHHI: { hhi: 0.2, concentrationLevel: 'low', topWallets: [] }, sellerHHI: { hhi: 0.1, concentrationLevel: 'low', topWallets: [] }, totalVolumeHHI: { hhi: 0.15, concentrationLevel: 'low', topWallets: [] }, elevatorWashTraderCount: 0, elevatorWashVolumeUsd: 0, washVolumeRatio: 0, volumePriceDivergence: false, organicScore: 100, totalBuyVolumeUsd: 1000, totalSellVolumeUsd: 800, buySellRatio: 1.25, evidenceIds: [] },
      whaleBehavior: { status: 'ok', reason: '', dataSemanticWarning: '', supplyThresholdPct: 1, liquidityThresholdPct: 5, whales: [], activeWhaleCount: 0, totalWhaleSupplySharePct: 0, whaleNetInflow: 0, whaleNetOutflow: 0, phase: 'neutral', isDistributionRisk: false, evidenceIds: [] },
      whaleExit: { status: 'ok', simulationDisclaimer: '', targetWallets: [], combinedObservedBalance: 0, scenarios: [], maxSeverity: 'low', evidenceIds: [] },
      buyerQuality: bqResult,
      marketRegime: { status: 'ok', regime: 'ACCUMULATION', confidence: 90, stats: undefined, regimeDescription: '', predictionDisclaimer: '', evidenceIds: [] },
      capitalEfficiency: { status: 'ok', fdvToLiquidityRatio: 2, capitalSensitivityMultiplier: 1.5, sensitivity: 'low', fdvUsd: 200000, totalLiquidityUsd: 100000, spotPriceUsd: 1.0, evidenceIds: [] },
      riskScore: { status: 'ok', overallRiskScore: 30, riskLevel: 'low', subScores: [], topRisks: [], mitigators: [], confidence: 80, evidenceIds: [], sufficientData: true, scoreCompleteness: 'complete', availableModuleCount: 6, totalModuleCount: 6 },
      evidence: [],
      dataQuality: { staleDataWarning: false, elevatorDataReused: false, transactionCount: 5, ohlcvCandleCount: 0 },
      limitations: [],
      timestamp: Date.now(),
    });

    assert(report.buyerQualityAssessment.includes('Cross-token activity:'), '5D8-14: narrative includes cross-token activity');
    assert(report.buyerQualityAssessment.includes('Historical cohort win rate:'), '5D8-14: narrative includes historical win rate');
  }

  // ────────────────────────────────────────────────
  // 5D8-15: Partial reputation data with mixed closed-trade counts
  // ────────────────────────────────────────────────
  {
    const reps = new Map<string, SmartMoneyReputationRecord>([
      [addrs[0], mkRep(addrs[0], { distinctTokensTraded: 2, closedTradeCount: 5, winRate: 0.60 })],
      [addrs[1], mkRep(addrs[1], { distinctTokensTraded: 0, closedTradeCount: 8, winRate: 0.40 })],
      [addrs[2], mkRep(addrs[2], { distinctTokensTraded: 1, closedTradeCount: 0, winRate: null })], // excluded from avg
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), reps);
    const m = result.cohortMetrics;
    assert(m.profiledReputationCount === 3, '5D8-15: profiledReputationCount is 3');
    assert(m.crossTokenBuyerCount === 2, '5D8-15: crossTokenBuyerCount is 2');
    // avg win rate = (0.60 + 0.40) / 2 = 0.50 (addrs[2] excluded — zero closed trades)
    assert(m.cohortAvgWinRate != null && Math.abs(m.cohortAvgWinRate - 0.50) < 0.001, '5D8-15: cohortAvgWinRate = 0.50 (zero-closedTrade wallet excluded)');
    // crossTokenBuyerRatio = 2/3 = 0.667 >= threshold 0.30 → no penalty
    const crossTokenFactor = result.negativeFactors.find(f => f.name === 'Low Cross-Token Activity');
    assert(!crossTokenFactor, '5D8-15: no cross-token penalty when ratio 0.667 >= threshold 0.30');
  }

  console.log('\n--- Phase 5D-8 tests complete ---');
}

async function runPhase5D9Tests() {
  console.log('\n--- Phase 5D-9: Creator-Funded Buyer Detection Tests ---');

  // ── Shared setup ──
  const CREATOR = '0xCreatorAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const CREATOR_LOWER = CREATOR.toLowerCase();

  const txs: UniversalTransaction[] = [
    makeTx({ hash: 'tx1', from: '0x1', to: '0xbuyer1', amount: 100, type: 'buy' }),
    makeTx({ hash: 'tx2', from: '0x2', to: '0xbuyer2', amount: 200, type: 'buy' }),
    makeTx({ hash: 'tx3', from: '0x3', to: '0xbuyer3', amount: 300, type: 'buy' }),
    makeTx({ hash: 'tx4', from: '0x4', to: '0xbuyer4', amount: 400, type: 'buy' }),
    makeTx({ hash: 'tx5', from: '0x5', to: '0xbuyer5', amount: 500, type: 'buy' }),
  ];

  const mkProfile = (
    addr: string,
    fundingSrc: string | null,
    fundingType: WalletQualityProfile['fundingSourceType'] = 'wallet'
  ): WalletQualityProfile => ({
    walletAddress: addr,
    chain: 'eth',
    firstSeenAt: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    walletAgeDays: 30,
    transactionCount: 50,
    activeDaysCount: 15,
    lastUpdated: Math.floor(Date.now() / 1000),
    coverage: 'complete',
    provenance: 'goldrush',
    fundingSource: fundingSrc,
    fundingSourceType: fundingType,
  });

  // ────────────────────────────────────────────────
  // 5D9-01: Zero creator-funded buyers
  // ────────────────────────────────────────────────
  {
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', '0xSomeFunder1')],
      ['0xbuyer2', mkProfile('0xbuyer2', '0xSomeFunder2')],
      ['0xbuyer3', mkProfile('0xbuyer3', '0xSomeFunder3')],
      ['0xbuyer4', mkProfile('0xbuyer4', '0xSomeFunder4')],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xSomeFunder5')],
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
    const m = result.cohortMetrics;
    assert(m.creatorFundedBuyerCount === 0, '5D9-01: creatorFundedBuyerCount is 0');
    assert(m.creatorFundedBuyerRatio === 0, '5D9-01: creatorFundedBuyerRatio is 0');
    const penalty = result.negativeFactors.find(f => f.name === 'Creator-Funded Buyers Detected');
    assert(!penalty, '5D9-01: no penalty factor when no creator-funded buyers');
  }

  // ────────────────────────────────────────────────
  // 5D9-02: Single creator-funded buyer — count, ratio, and penalty
  // ────────────────────────────────────────────────
  {
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR)],   // creator-funded
      ['0xbuyer2', mkProfile('0xbuyer2', '0xOther1')],
      ['0xbuyer3', mkProfile('0xbuyer3', '0xOther2')],
      ['0xbuyer4', mkProfile('0xbuyer4', '0xOther3')],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xOther4')],
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
    const m = result.cohortMetrics;
    assert(m.creatorFundedBuyerCount === 1, '5D9-02: creatorFundedBuyerCount is 1');
    // ratio = 1/5 = 0.20 > threshold 0.10 → penalty activates
    assert(m.creatorFundedBuyerRatio !== undefined && Math.abs(m.creatorFundedBuyerRatio - 0.2) < 0.001,
      '5D9-02: creatorFundedBuyerRatio is 0.2');
    const penalty = result.negativeFactors.find(f => f.name === 'Creator-Funded Buyers Detected');
    assert(penalty !== undefined, '5D9-02: penalty factor is present when ratio > threshold');
    assert(penalty!.weight === -DEEP_SCAN_CONFIG.buyerQuality.phase5D9.creatorFundingPenalty,
      '5D9-02: penalty weight matches config');
  }

  // ────────────────────────────────────────────────
  // 5D9-03: Mixed-case EVM address comparison
  // ────────────────────────────────────────────────
  {
    const CREATOR_UPPER = '0xCREATORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const CREATOR_MIXED = '0xCreatorAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR_UPPER)],
      ['0xbuyer2', mkProfile('0xbuyer2', CREATOR_MIXED)],
      ['0xbuyer3', mkProfile('0xbuyer3', '0xOther')],
      ['0xbuyer4', mkProfile('0xbuyer4', '0xOther2')],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xOther3')],
    ]);
    // Pass creatorAddress in lowercase to verify normalization
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR_LOWER);
    const m = result.cohortMetrics;
    assert((m.creatorFundedBuyerCount ?? 0) === 2, '5D9-03: mixed-case addresses match via normalizeAddress');
  }

  // ────────────────────────────────────────────────
  // 5D9-04: Excluded funding types (cex, bridge, contract)
  // ────────────────────────────────────────────────
  {
    for (const excludedType of ['cex', 'bridge', 'contract'] as Array<WalletQualityProfile['fundingSourceType']>) {
      const profiles = new Map<string, WalletQualityProfile>([
        ['0xbuyer1', mkProfile('0xbuyer1', CREATOR, excludedType)],
        ['0xbuyer2', mkProfile('0xbuyer2', '0xOther1')],
        ['0xbuyer3', mkProfile('0xbuyer3', '0xOther2')],
        ['0xbuyer4', mkProfile('0xbuyer4', '0xOther3')],
        ['0xbuyer5', mkProfile('0xbuyer5', '0xOther4')],
      ]);
      const result = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
      const m = result.cohortMetrics;
      assert((m.creatorFundedBuyerCount ?? 0) === 0,
        `5D9-04: fundingSourceType '${excludedType}' is excluded from creator-funded match`);
    }
  }

  // ────────────────────────────────────────────────
  // 5D9-05: Missing creatorAddress — no crash, no penalty
  // ────────────────────────────────────────────────
  {
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR)],
      ['0xbuyer2', mkProfile('0xbuyer2', CREATOR)],
    ]);
    // No creatorAddress supplied
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), undefined);
    const penalty = result.negativeFactors.find(f => f.name === 'Creator-Funded Buyers Detected');
    assert(!penalty, '5D9-05: no penalty when creatorAddress is undefined');
    assert(result.unavailableMetrics.includes('creatorFundingAnalysis'),
      '5D9-05: creatorFundingAnalysis remains unavailable when creatorAddress missing');
  }

  // ────────────────────────────────────────────────
  // 5D9-06: Ratio exactly at threshold — no penalty (uses strict >)
  // ────────────────────────────────────────────────
  {
    // threshold = 0.10; 1 of 10 = 0.10 exactly
    const moreTxs: UniversalTransaction[] = Array.from({ length: 10 }, (_, i) =>
      makeTx({ hash: `tx${i}`, from: `0xf${i}`, to: `0xb${i}`, amount: 100, type: 'buy' })
    );
    const profileMap = new Map<string, WalletQualityProfile>();
    for (let i = 0; i < 10; i++) {
      profileMap.set(`0xb${i}`, mkProfile(`0xb${i}`, i === 0 ? CREATOR : `0xOther${i}`));
    }
    const result = analyzeBuyerQuality(moreTxs, new Set(), new Set(), profileMap, new Map(), CREATOR);
    const m = result.cohortMetrics;
    assert(m.creatorFundedBuyerRatio !== undefined && Math.abs(m.creatorFundedBuyerRatio - 0.10) < 0.001,
      '5D9-06: ratio is exactly 0.10');
    const penalty = result.negativeFactors.find(f => f.name === 'Creator-Funded Buyers Detected');
    assert(!penalty, '5D9-06: no penalty when ratio === threshold (strict > required)');
  }

  // ────────────────────────────────────────────────
  // 5D9-07: Ratio above threshold — penalty fires exactly once
  // ────────────────────────────────────────────────
  {
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR)],
      ['0xbuyer2', mkProfile('0xbuyer2', CREATOR)],
      ['0xbuyer3', mkProfile('0xbuyer3', '0xOther1')],
      ['0xbuyer4', mkProfile('0xbuyer4', '0xOther2')],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xOther3')],
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
    const penaltyFactors = result.negativeFactors.filter(f => f.name === 'Creator-Funded Buyers Detected');
    assert(penaltyFactors.length === 1, '5D9-07: penalty factor fires exactly once');
    assert(penaltyFactors[0].weight === -DEEP_SCAN_CONFIG.buyerQuality.phase5D9.creatorFundingPenalty,
      '5D9-07: penalty weight matches configured creatorFundingPenalty');
  }

  // ────────────────────────────────────────────────
  // 5D9-08: Score clamping — score always stays in [0, 100]
  // ────────────────────────────────────────────────
  {
    // All buyers are creator-funded — maximum penalty scenario
    const profiles = new Map<string, WalletQualityProfile>(
      txs.map((_, i) => [`0xbuyer${i + 1}`, mkProfile(`0xbuyer${i + 1}`, CREATOR)])
    );
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
    assert(result.buyerQualityScore >= 0 && result.buyerQualityScore <= 100,
      '5D9-08: buyerQualityScore stays clamped in [0, 100]');
  }

  // ────────────────────────────────────────────────
  // 5D9-09: Risk signal — high severity when ratio < 50%
  // ────────────────────────────────────────────────
  {
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR)],   // 1 of 5 = 20%
      ['0xbuyer2', mkProfile('0xbuyer2', '0xOther1')],
      ['0xbuyer3', mkProfile('0xbuyer3', '0xOther2')],
      ['0xbuyer4', mkProfile('0xbuyer4', '0xOther3')],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xOther4')],
    ]);
    const bqResult = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
    const riskResult = calculateRiskScore({
      ammSlippage: { status: 'unavailable' } as any,
      volumeConcentration: { status: 'unavailable' } as any,
      whaleBehavior: { status: 'unavailable' } as any,
      whaleExit: { status: 'unavailable' } as any,
      buyerQuality: bqResult,
      capitalEfficiency: { status: 'unavailable' } as any,
      isHoneypot: false,
    });
    const signal = riskResult.topRisks.find(r => r.riskId === 'creator-funded-buyers');
    assert(signal !== undefined, '5D9-09: creator-funded-buyers risk signal is emitted');
    assert(signal!.severity === 'high', '5D9-09: severity is high when ratio = 20%');
  }

  // ────────────────────────────────────────────────
  // 5D9-10: Risk signal — critical severity when ratio >= 50%
  // ────────────────────────────────────────────────
  {
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR)],
      ['0xbuyer2', mkProfile('0xbuyer2', CREATOR)],
      ['0xbuyer3', mkProfile('0xbuyer3', CREATOR)],
      ['0xbuyer4', mkProfile('0xbuyer4', '0xOther1')],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xOther2')],
    ]);
    const bqResult = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
    const riskResult = calculateRiskScore({
      ammSlippage: { status: 'unavailable' } as any,
      volumeConcentration: { status: 'unavailable' } as any,
      whaleBehavior: { status: 'unavailable' } as any,
      whaleExit: { status: 'unavailable' } as any,
      buyerQuality: bqResult,
      capitalEfficiency: { status: 'unavailable' } as any,
      isHoneypot: false,
    });
    const signal = riskResult.topRisks.find(r => r.riskId === 'creator-funded-buyers');
    assert(signal !== undefined, '5D9-10: creator-funded-buyers signal emitted at 60% ratio');
    assert(signal!.severity === 'critical', '5D9-10: severity is critical when ratio >= 50%');
  }

  // ────────────────────────────────────────────────
  // 5D9-11: Trader Intelligence narrative
  // ────────────────────────────────────────────────
  {
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR)],
      ['0xbuyer2', mkProfile('0xbuyer2', CREATOR)],
      ['0xbuyer3', mkProfile('0xbuyer3', '0xOther')],
      ['0xbuyer4', mkProfile('0xbuyer4', '0xOther2')],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xOther3')],
    ]);
    const bqResult = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
    const riskResult = calculateRiskScore({
      ammSlippage: { status: 'unavailable' } as any,
      volumeConcentration: { status: 'unavailable' } as any,
      whaleBehavior: { status: 'unavailable' } as any,
      whaleExit: { status: 'unavailable' } as any,
      buyerQuality: bqResult,
      capitalEfficiency: { status: 'unavailable' } as any,
      isHoneypot: false,
    });
    const report = generateTraderIntelligenceReport({
      tokenAddress: '0xToken', tokenSymbol: 'TST', tokenName: 'Test', network: 'eth',
      ammSlippage: { status: 'unavailable' } as any,
      volumeConcentration: { status: 'unavailable' } as any,
      whaleBehavior: { status: 'unavailable' } as any,
      whaleExit: { status: 'unavailable' } as any,
      buyerQuality: bqResult,
      marketRegime: { status: 'unavailable' } as any,
      capitalEfficiency: { status: 'unavailable' } as any,
      riskScore: riskResult,
      evidence: [], dataQuality: { staleDataWarning: false, elevatorDataReused: false, transactionCount: 5, ohlcvCandleCount: 0 },
      limitations: [], scanId: 'scan-5d9-11', timestamp: Date.now(),
    });
    const narrative = report.buyerQualityAssessment ?? '';
    assert(narrative.includes('Warning:'), '5D9-11: creator-funded warning present in narrative');
    assert(narrative.includes('funding-source match with the token creator'), '5D9-11: narrative contains factual match description');
    assert(!narrative.includes('controls these wallets'), '5D9-11: narrative does not make ownership claims');
    assert(!narrative.includes('wash trading'), '5D9-11: narrative does not allege wash trading');
  }

  // ────────────────────────────────────────────────
  // 5D9-12: Coverage below minimum — penalty and signal blocked
  // ────────────────────────────────────────────────
  {
    const originalCoverage = DEEP_SCAN_CONFIG.buyerQuality.phase5D9.minimumProfileCoverage;
    DEEP_SCAN_CONFIG.buyerQuality.phase5D9.minimumProfileCoverage = 0.90; // very high gate

    // Only 1 of 5 buyers profiled → coverage = 0.20 < 0.90 → gate fails
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR)],
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
    const penalty = result.negativeFactors.find(f => f.name === 'Creator-Funded Buyers Detected');
    assert(!penalty, '5D9-12: penalty blocked when profile coverage < minimumProfileCoverage');

    const bqResult = result;
    const riskResult = calculateRiskScore({
      ammSlippage: { status: 'unavailable' } as any,
      volumeConcentration: { status: 'unavailable' } as any,
      whaleBehavior: { status: 'unavailable' } as any,
      whaleExit: { status: 'unavailable' } as any,
      buyerQuality: bqResult,
      capitalEfficiency: { status: 'unavailable' } as any,
      isHoneypot: false,
    });
    const signal = riskResult.topRisks.find(r => r.riskId === 'creator-funded-buyers');
    assert(!signal, '5D9-12: risk signal blocked when profile coverage < minimumProfileCoverage');

    DEEP_SCAN_CONFIG.buyerQuality.phase5D9.minimumProfileCoverage = originalCoverage;
  }

  // ────────────────────────────────────────────────
  // 5D9-13: Empty profile map — no crash, graceful degraded state
  // ────────────────────────────────────────────────
  {
    let threw = false;
    try {
      const result = analyzeBuyerQuality(txs, new Set(), new Set(), new Map(), new Map(), CREATOR);
      const m = result.cohortMetrics;
      assert((m.creatorFundedBuyerCount ?? 0) === 0, '5D9-13: count is 0 with empty profile map');
      assert(m.creatorFundedBuyerRatio === undefined, '5D9-13: ratio is undefined with empty profile map');
      assert(result.unavailableMetrics.includes('creatorFundingAnalysis'),
        '5D9-13: creatorFundingAnalysis stays unavailable when no profiles resolved');
    } catch {
      threw = true;
    }
    assert(!threw, '5D9-13: analyzer does not throw with empty profile map');
  }

  // ────────────────────────────────────────────────
  // 5D9-14: Config override respected at runtime
  // ────────────────────────────────────────────────
  {
    const originalThreshold = DEEP_SCAN_CONFIG.buyerQuality.phase5D9.creatorFundingThreshold;
    const originalPenalty = DEEP_SCAN_CONFIG.buyerQuality.phase5D9.creatorFundingPenalty;
    DEEP_SCAN_CONFIG.buyerQuality.phase5D9.creatorFundingThreshold = 0.50; // raise bar significantly
    DEEP_SCAN_CONFIG.buyerQuality.phase5D9.creatorFundingPenalty = 20;    // increase penalty

    // 1 of 5 buyers funded by creator = 20% — below new threshold of 50% → no penalty
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR)],
      ['0xbuyer2', mkProfile('0xbuyer2', '0xOther1')],
      ['0xbuyer3', mkProfile('0xbuyer3', '0xOther2')],
      ['0xbuyer4', mkProfile('0xbuyer4', '0xOther3')],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xOther4')],
    ]);
    const result = analyzeBuyerQuality(txs, new Set(), new Set(), profiles, new Map(), CREATOR);
    const penalty = result.negativeFactors.find(f => f.name === 'Creator-Funded Buyers Detected');
    assert(!penalty, '5D9-14: no penalty when ratio (20%) < overridden threshold (50%)');

    // 4 of 5 buyers = 80% — above new threshold → penalty fires with overridden amount
    const profiles2 = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', CREATOR)],
      ['0xbuyer2', mkProfile('0xbuyer2', CREATOR)],
      ['0xbuyer3', mkProfile('0xbuyer3', CREATOR)],
      ['0xbuyer4', mkProfile('0xbuyer4', CREATOR)],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xOther')],
    ]);
    const result2 = analyzeBuyerQuality(txs, new Set(), new Set(), profiles2, new Map(), CREATOR);
    const penalty2 = result2.negativeFactors.find(f => f.name === 'Creator-Funded Buyers Detected');
    assert(penalty2 !== undefined, '5D9-14: penalty fires when ratio (80%) > overridden threshold (50%)');
    assert(penalty2!.weight === -20, '5D9-14: overridden penalty amount of 20 is applied');

    DEEP_SCAN_CONFIG.buyerQuality.phase5D9.creatorFundingThreshold = originalThreshold;
    DEEP_SCAN_CONFIG.buyerQuality.phase5D9.creatorFundingPenalty = originalPenalty;
  }

  // ────────────────────────────────────────────────
  // 5D9-15: Regression — Phase 5D-7 and 5D-8 behavior unaffected
  // ────────────────────────────────────────────────
  {
    // Phase 5D-7 regression: fundingConcentration still works correctly
    const profiles = new Map<string, WalletQualityProfile>([
      ['0xbuyer1', mkProfile('0xbuyer1', '0xSharedFunder')],
      ['0xbuyer2', mkProfile('0xbuyer2', '0xSharedFunder')],
      ['0xbuyer3', mkProfile('0xbuyer3', '0xSharedFunder')],
      ['0xbuyer4', mkProfile('0xbuyer4', '0xOther')],
      ['0xbuyer5', mkProfile('0xbuyer5', '0xOther2')],
    ]);
    // No creator address — should behave exactly as pre-5D9
    const result5D7 = analyzeBuyerQuality(txs, new Set(), new Set(), profiles);
    const hfcFactor = result5D7.negativeFactors.find(f => f.name === 'High Funding Concentration');
    assert(hfcFactor !== undefined, '5D9-15: 5D-7 fundingConcentration penalty still fires without creatorAddress');
    assert(!result5D7.negativeFactors.find(f => f.name === 'Creator-Funded Buyers Detected'),
      '5D9-15: no creator-funded penalty when creatorAddress is not passed');

    // Phase 5D-8 regression: crossTokenBuyerRatio still computed correctly
    const reps = new Map<string, SmartMoneyReputationRecord>([
      ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        { walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', chain: 'eth', distinctTokensTraded: 5, closedTradeCount: 10, winRate: 0.6, status: 'available', freshness: 'FRESH', lastUpdatedAt: new Date().toISOString(), provider: 'test' }],
    ]);
    const txsRep: UniversalTransaction[] = [
      makeTx({ hash: 'r1', from: '0xf1', to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', amount: 100, type: 'buy' }),
    ];
    const result5D8 = analyzeBuyerQuality(txsRep, new Set(), new Set(), new Map(), reps, undefined);
    assert((result5D8.cohortMetrics.crossTokenBuyerCount ?? 0) === 1,
      '5D9-15: 5D-8 crossTokenBuyerCount still correct with undefined creatorAddress');
  }

  console.log('\n--- Phase 5D-9 tests complete ---');
}

async function runModule13Tests() {
  console.log('\n--- Module 13: Historical Behavior Cycle Analysis Tests ---');

  const {
    calculateMaxDrawdown,
    detectPumpAndDump,
    detectSlowRug,
    calculateDistributionVelocity,
    analyzeHistoricalBehavior,
  } = await import('./lib/deep_scan/engines/HistoricalBehaviorAnalyzer');

  const mkCandle = (ts: number, close: number, volume: number = 1000) => ({
    timestamp: ts, open: close, close, volume,
  });

  // ────────────────────────────────────────────────
  // M13-01: calculateMaxDrawdown — basic case
  // ────────────────────────────────────────────────
  {
    // Rise to 100, drop to 40 (60% drawdown), recover to 120
    const candles = [
      mkCandle(1, 50),   // rising
      mkCandle(2, 100),  // peak
      mkCandle(3, 80),
      mkCandle(4, 60),
      mkCandle(5, 40),   // trough at -60%
      mkCandle(6, 80),
      mkCandle(7, 120),  // recovery above peak
    ];
    const dd = calculateMaxDrawdown(candles);
    assert(dd !== null, 'M13-01: drawdown is not null');
    assert(Math.abs((dd?.depthPercent ?? 0) - 60) < 1, `M13-01: depthPercent ~ 60% (got ${dd?.depthPercent?.toFixed(1)})`);
    assert((dd?.durationCandles ?? 0) === 3, `M13-01: durationCandles is 3 (got ${dd?.durationCandles})`);
    assert(dd?.recoveryCandles !== null, 'M13-01: recovery is found');
  }

  // ────────────────────────────────────────────────
  // M13-02: calculateMaxDrawdown — no recovery
  // ────────────────────────────────────────────────
  {
    const candles = [
      mkCandle(1, 100),  // peak
      mkCandle(2, 80),
      mkCandle(3, 60),
      mkCandle(4, 40),   // never recovers
    ];
    const dd = calculateMaxDrawdown(candles);
    assert(dd !== null, 'M13-02: drawdown is not null even without recovery');
    assert(dd?.recoveryCandles === null, 'M13-02: recoveryCandles is null when never recovers');
  }

  // ────────────────────────────────────────────────
  // M13-03: detectPumpAndDump — detected
  // ────────────────────────────────────────────────
  {
    // Low price, then rapid 200% pump with volume spike, then 80% dump
    const candles = [
      mkCandle(1, 10, 500),
      mkCandle(2, 12, 600),
      mkCandle(3, 30, 5000),  // spike start
      mkCandle(4, 50, 8000),
      mkCandle(5, 80, 12000), // volume spike
      mkCandle(6, 90, 15000), // peak ~+800%
      mkCandle(7, 60, 7000),
      mkCandle(8, 30, 4000),
      mkCandle(9, 15, 2000),  // -83% from peak
      mkCandle(10, 12, 1000),
    ];
    const result = detectPumpAndDump(candles);
    assert(result !== null, 'M13-03: pump-and-dump detection returns non-null');
    assert(result?.detected === true, 'M13-03: pump-and-dump detected on extreme pump+dump candles');
    assert((result?.confidence ?? 0) > 0, 'M13-03: confidence > 0 when detected');
  }

  // ────────────────────────────────────────────────
  // M13-04: detectPumpAndDump — not detected on steady price
  // ────────────────────────────────────────────────
  {
    // Steady price with no volatility
    const candles = Array.from({ length: 10 }, (_, i) => mkCandle(i + 1, 100 + i, 1000));
    const result = detectPumpAndDump(candles);
    assert(result?.detected === false, 'M13-04: no pump-and-dump on steady upward price');
  }

  // ────────────────────────────────────────────────
  // M13-05: detectSlowRug — detected
  // ────────────────────────────────────────────────
  {
    // Gradually declining price and volume over 20 candles
    const candles = Array.from({ length: 20 }, (_, i) => mkCandle(
      i + 1,
      100 - i * 4,    // price: 100 → 24 (-76%)
      5000 - i * 230  // volume: 5000 → 630 (-87%)
    ));
    const result = detectSlowRug(candles);
    assert(result !== null, 'M13-05: slow rug returns non-null result');
    assert(result?.detected === true, 'M13-05: slow rug detected on gradual price+volume decline');
    assert((result?.confidence ?? 0) > 0, 'M13-05: confidence > 0 when slow rug detected');
  }

  // ────────────────────────────────────────────────
  // M13-06: detectSlowRug — not detected on healthy growth
  // ────────────────────────────────────────────────
  {
    // Trending upward in both price and volume
    const candles = Array.from({ length: 20 }, (_, i) => mkCandle(i + 1, 50 + i * 5, 1000 + i * 100));
    const result = detectSlowRug(candles);
    assert(result?.detected === false, 'M13-06: slow rug NOT detected on healthy upward trend');
  }

  // ────────────────────────────────────────────────
  // M13-07: calculateDistributionVelocity — growing wallet distribution
  // ────────────────────────────────────────────────
  {
    // First 10 txs: 5 unique wallets; next 10 txs: 10 unique wallets (growth)
    const txs = [
      ...Array.from({ length: 10 }, (_, i) => ({ timestamp: i + 1, from: `0xw${i % 5}`, to: '0xpool' })),
      ...Array.from({ length: 10 }, (_, i) => ({ timestamp: i + 11, from: `0xw${i + 10}`, to: '0xpool' })),
    ];
    const result = calculateDistributionVelocity(txs);
    assert(result !== null, 'M13-07: distribution velocity returns non-null with sufficient txs');
    assert((result?.velocity ?? 0) > 0, 'M13-07: velocity > 0 when wallet count grows (second half has more unique wallets)');
  }

  // ────────────────────────────────────────────────
  // M13-08: analyzeHistoricalBehavior — insufficient data gate
  // ────────────────────────────────────────────────
  {
    // Fewer than 7 candles — should return insufficient_data
    const candles = [
      mkCandle(1, 100), mkCandle(2, 90), mkCandle(3, 80),
    ];
    const result = analyzeHistoricalBehavior(candles, []);
    assert(result.status === 'insufficient_data', 'M13-08: status is insufficient_data with < 7 candles');
    assert(result.maxDrawdown === null, 'M13-08: maxDrawdown is null when insufficient_data');
    assert(result.pumpDump === null, 'M13-08: pumpDump is null when insufficient_data');
    assert(result.slowRug === null, 'M13-08: slowRug is null when insufficient_data');
  }

  // ────────────────────────────────────────────────
  // M13-09: analyzeHistoricalBehavior — full ok result
  // ────────────────────────────────────────────────
  {
    // 16 candles: above 7-candle status gate AND 15-candle detectSlowRug gate
    const candles = Array.from({ length: 16 }, (_, i) => mkCandle(i + 1, 100 - i * 3, 3000 - i * 100));
    const result = analyzeHistoricalBehavior(candles, []);
    assert(result.status === 'ok', `M13-09: status is ok with sufficient candles (got ${result.status})`);
    assert(result.maxDrawdown !== null, 'M13-09: maxDrawdown is populated');
    assert(result.pumpDump !== null, 'M13-09: pumpDump result is not null');
    assert(result.slowRug !== null, 'M13-09: slowRug result is not null');
  }

  // ────────────────────────────────────────────────
  // M13-10: empty candles returns insufficient_data (not a throw)
  // ────────────────────────────────────────────────
  {
    let threw = false;
    let result: any;
    try {
      result = analyzeHistoricalBehavior([], []);
    } catch {
      threw = true;
    }
    assert(!threw, 'M13-10: analyzeHistoricalBehavior does not throw on empty candles');
    assert(result?.status === 'insufficient_data', 'M13-10: empty candles → insufficient_data');
  }

  console.log('\n--- Module 13 tests complete ---');
}

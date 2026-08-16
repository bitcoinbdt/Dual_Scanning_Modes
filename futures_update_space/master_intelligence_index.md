# Professional Trader Intelligence: Master Index & Gap Register

This file serves as the **single source of truth** for all planned
intelligence modules. It maps every gap found in the source code to a
specific spec file in `futures_update_space/`. Use this as the project
checklist before implementation begins.

---

## Module Map: What Exists vs. What Is Planned

### TIER 1 — Core Scan Engine (Already in Code)

| Module | File | Status | Notes |
|---|---|---|---|
| EVM Token Scanner | `lib/blockchain/evmScanner.ts` | ✅ Live | Auto-detects chain ID |
| Solana Token Scanner | `lib/blockchain/solanaScanner.ts` | ✅ Live | Pre-graduation gap exists |
| Market Data Fallback | `lib/blockchain/marketDataFallback.ts` | ✅ Live | DexScreener → GeckoTerminal → DefiLlama |
| GoPlus Security (EVM) | `lib/blockchain/goPlusSecurity.ts` | ✅ Live | Risk weights not connected — see below |
| Elevator Collectors (Solana/BSC/ETH) | `lib/elevator/collectors/` | ✅ Live | 100-tx cap (see deep_scan_update.md) |
| Wash Trading Detector | `lib/elevator/washTradingDetector.ts` | ✅ Live | Flags RF17 metric |

### TIER 2 — Deep Scan Analytical Engines (Already in Code)

| Module | Engine File | Status | Gap |
|---|---|---|---|
| AMM Slippage Simulator | `AmmSlippageSimulator.ts` | ✅ Live | Only 2 position sizes — needs 5-tier ladder |
| Volume Concentration (HHI) | `VolumeConcentrationAnalyzer.ts` | ✅ Live | Needs Gini supplement |
| Whale Behavior | `WhaleBehaviorAnalyzer.ts` | ✅ Live | Batch-window scoped, not authoritative balances |
| Whale Exit Simulator | `WhaleExitSimulator.ts` | ✅ Live | Skipped for large-caps — see deep_scan_update.md |
| Buyer Quality Analyzer | `BuyerQualityAnalyzer.ts` | ✅ Live | Wallet age/cross-token history flagged as `UNAVAILABLE` |
| Market Regime Analyzer | `MarketRegimeAnalyzer.ts` | ✅ Live | OHLCV-based only, no volume vs. 24h total |
| Capital Efficiency | `CapitalEfficiencyAnalyzer.ts` | ✅ Live | — |
| Liquidity Fragmentation | `LiquidityFragmentationAnalyzer.ts` | ✅ Live | — |
| Risk Scoring Engine | `RiskScoringEngine.ts` | ✅ Live | CTR signals not connected (GoPlus gap) |
| Trader Intelligence Generator | `TraderIntelligenceGenerator.ts` | ✅ Live | No deployer profile or social context |
| Evidence Mapper | `EvidenceMapper.ts` | ✅ Live | — |
| Smart Money Analyzer | `SmartMoneyAnalyzer.ts` | ✅ Live | — |
| Historical Behavior Analyzer | `HistoricalBehaviorAnalyzer.ts` | ✅ Live | — |
| Liquidity Stress Analyzer | `LiquidityStressAnalyzer.ts` | ✅ Live | EVM V2 only, Solana returns insufficient_data |
| Smart Money PnL Engine | `SmartMoneyPnlEngine.ts` | ✅ Live | FIFO realized PnL only |

### TIER 3 — Planned Modules (Spec Files in futures_update_space/)

| Module | Spec File | Priority | Status |
|---|---|---|---|
| Dual-Path Router (Curve vs AMM) | `both_scan_update.md` | P0 | 🟡 Spec written |
| Bonding Curve Funnel (3-stage) | `bonding_curve_funnel.md` | P0 | 🟡 Spec written |
| Pre-Graduation Detection Fix | `current_state_gap_analysis.md` | P0 | 🟡 Spec written |
| Deep Scan Transaction Scaling (10k) | `deep_scan_update.md` | P0 | 🟡 Spec written |
| CEX Exit Heuristic | `deep_scan_update.md` | P0 | 🟡 Spec written |
| Large-Cap vs Micro-Cap Router | `deep_scan_update.md` | P1 | 🟡 Spec written |
| Deployer Wallet Profiling | `deployer_profiling.md` | P0 | 🟡 Spec written |
| Token Unlock / Vesting Tracking | `token_unlock_airdrop_tracking.md` | P1 | 🟡 Spec written |
| Airdrop / ICO Origin Detection | `token_unlock_airdrop_tracking.md` | P1 | 🟡 Spec written |
| Volume Capture % (Buy vs Sell) | `both_scan_update.md §2.8` | P1 | 🟡 Spec written |
| Transaction Spacing / Density | `both_scan_update.md §2.8` | P1 | 🟡 Spec written |
| Social Links Validation | `social_signals_tracking.md` | P1 | 🟡 Spec written |
| Social Link Consistency Check | `social_signals_tracking.md` | P1 | 🟡 Spec written |
| Domain / Account Age Detection | `social_signals_tracking.md` | P2 | 🟡 Spec written |
| GoPlus CTR Signal Wiring | `contract_risk_analysis.md` | P1 | 🟡 Spec written |
| Solana Authority Risk Signals | `contract_risk_analysis.md` | P1 | 🟡 Spec written |
| Gini Coefficient (Holder Distribution) | `contract_risk_analysis.md` | P1 | 🟡 Spec written |
| 5-Tier Slippage Ladder | `contract_risk_analysis.md` | P2 | 🟡 Spec written |
| Shareable Scan Result URLs | `shareable_scan_results.md` | P1 | 🟡 Spec written |
| Solana Raydium Liquidity Stress | `solana_liquidity_stress.md` | P2 | 🟡 Spec written |
| Historical Rug Pattern Matching | `rug_pattern_matching.md` | P2 | 🟡 Spec written |
| Insider Accumulation Detection | `insider_accumulation.md` | P3 | 🟡 Spec written |

---

## Critical Code Gaps Summary

The following are the highest-severity gaps found by cross-referencing the
source code against planned specs. Each is a confirmed code-level issue:

### GAP-001 — Pre-graduation Zero-Liquidity False Positive  
**File**: `lib/blockchain/solanaScanner.ts` line 65  
**Problem**: `fetchMarketDataWithFallback()` called unconditionally. For tokens
still in the Pump.fun bonding curve, DexScreener returns no pool, causing the
scanner to report `totalLiquidityUsd: 0` and `"Unknown Solana Token"`.  
**Spec**: `both_scan_update.md §2 Path A`, `bonding_curve_funnel.md`  
**Severity**: CRITICAL — Generates completely wrong reports for new tokens.

### GAP-002 — Transaction Sample Cap at 100  
**File**: `lib/deep_scan/DeepScanService.ts` line 573  
**Code**: `const maxTxCap = input.maxTransactions ?? 100;`  
**Problem**: 100 transactions is statistically insufficient. The HHI, Gini,
and whale exit calculations produce unreliable results at this sample size.  
**Spec**: `deep_scan_update.md §2`  
**Severity**: HIGH — Produces unreliable concentration metrics.

### GAP-003 — GoPlus Risk Fields Not Connected to Risk Score  
**File**: `lib/deep_scan/engines/RiskScoringEngine.ts`  
**Problem**: GoPlus returns `is_proxy`, `transfer_pausable`, `is_blacklisted`,
`owner_change_balance`, `can_take_back_ownership`. None of these contribute
to the final risk score calculation.  
**Spec**: `contract_risk_analysis.md §2`  
**Severity**: HIGH — Proxy/pausable/blacklist contracts score identically to clean ones.

### GAP-004 — No Deployer Historical Profile  
**Files**: All engines in `lib/deep_scan/engines/`  
**Problem**: No engine checks the deployer's history (previous tokens, rug
pulls, success rate). A serial rugger's new token scores the same as a
legitimate project.  
**Spec**: `deployer_profiling.md`  
**Severity**: HIGH — Most damaging false-positive scenario for traders.

### GAP-005 — No Token Unlock / Vesting Awareness  
**Files**: All engines in `lib/deep_scan/engines/`  
**Problem**: A token can receive a "good" scan today while 40% of supply
unlocks in 12 hours. The engine has zero awareness of this.  
**Spec**: `token_unlock_airdrop_tracking.md`  
**Severity**: HIGH — Creates false "safe" signals before scheduled dumps.

### GAP-006 — No Launchpad / Curve Detection at Route Layer  
**File**: `lib/blockchain/tokenScanner.ts` line 69  
**Code**: `detectNetwork()` only checks `0x` prefix. No launchpad detection.  
**Problem**: All tokens take the same path regardless of whether they are on
a bonding curve, AMM pool, or CEX.  
**Spec**: `both_scan_update.md §1.5`, `current_state_gap_analysis.md §4`  
**Severity**: HIGH — Incorrect engine is selected for curve-phase tokens.

### GAP-007 — Solana Mint/Freeze Authority Not Risk-Weighted  
**File**: `lib/blockchain/solanaScanner.ts`  
**Problem**: `mintAuthority` and `freezeAuthority` are fetched from
`getParsedAccountInfo` but never wired into any risk signal or score.  
**Spec**: `contract_risk_analysis.md §3`  
**Severity**: MEDIUM — Mintable/freezable Solana tokens appear same as safe ones.

### GAP-008 — Liquidity Stress Analyzer Skips Solana  
**File**: `lib/deep_scan/engines/LiquidityStressAnalyzer.ts` line 52–57  
**Problem**: Returns `status: 'insufficient_data'` for all Solana tokens —
meaning the entire Solana deep scan has zero liquidity stress analysis.  
**Spec**: Not yet documented — see Section 3 below.  
**Severity**: MEDIUM — Solana users get partial deep scan.

### GAP-009 — Large-Cap Tokens Not Differentiated  
**Files**: `lib/deep_scan/DeepScanService.ts`, all engines  
**Problem**: Running sniper detection, HHI concentration warnings, and whale
exit penalties against Pepe, Uniswap, or USDC generates false "dangerous"
reports and damages site credibility.  
**Spec**: `deep_scan_update.md §4`  
**Severity**: MEDIUM — Reputation risk for the scanner product.

---

## 3. All Gaps Documented

All identified intelligence gaps now have spec files. The table in Section 1
(Tier 3) is the authoritative list. No gaps remain without a spec file.

If new gaps are discovered during implementation, add them to the Tier 3
table and create a corresponding spec file in `futures_update_space/`.

---

## 4. Priority Execution Order for Implementation

When implementation begins (source code changes), execute in this order:

```
Phase 1 — Critical Fixes (No new features, just fixes)
  1. GAP-001: Fix pre-graduation false zero-liquidity (solanaScanner.ts)
  2. GAP-002: Raise transaction cap to dynamic 10k (DeepScanService.ts)
  3. GAP-006: Add launchpad detection at route layer (tokenScanner.ts)

Phase 2 — Risk Score Completeness
  4. GAP-003: Wire GoPlus CTR signals to RiskScoringEngine
  5. GAP-007: Wire Solana authority signals to RiskScoringEngine
  6. GAP-009: Add Large-Cap vs Micro-Cap router gate

Phase 3 — New Intelligence Modules
  7. GAP-004: Deployer Wallet Profiling module
  8. GAP-005: Token Unlock / Vesting Tracking module
  9. Social Signals module (social_signals_tracking.md)
 10. Volume Capture % + Transaction Density (both_scan_update.md §2.8)

Phase 4 — Advanced Professional Features
 11. 5-Tier Slippage Ladder (contract_risk_analysis.md §5)
 12. Gini Coefficient supplement to HHI
 13. Solana Raydium Liquidity Stress (3A above — needs spec first)
 14. Historical Rug Pattern Matching (3B above — needs spec first)
 15. Insider Accumulation Detection (3C above — needs spec first)
```

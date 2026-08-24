/**
 * Deep Scan — TypeScript Type Definitions
 *
 * All interfaces and enums for the Deep Scan intelligence engine.
 * Reuses CollectorResult from Elevator where appropriate.
 *
 * Semantic taxonomy (per DEEP_SCAN_SCOPE.md):
 *   DATA           — raw blockchain observations
 *   METRIC         — mathematical result
 *   ANALYSIS       — interpretation of metrics
 *   SIGNAL         — detected condition / threshold breach
 *   DECISION_SUPPORT — trader-oriented implication
 */
import type { WalletHistoryRecord } from '../providers/adapter-types';

// ─────────────────────────────────────────────
// 1. Status / quality sentinels
// ─────────────────────────────────────────────

export type ModuleStatus =
  | 'ok'
  | 'partial'
  | 'insufficient_data'
  | 'error'
  | 'unavailable'
  | 'pending';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type CapitalSensitivity = 'low' | 'medium' | 'high';

// ─────────────────────────────────────────────
// 2. Evidence node (matches evidence.json schema)
// ─────────────────────────────────────────────

export interface EvidenceNode {
  /** Unique identifier for cross-referencing in risk signals */
  evidenceId: string;
  /** Raw observation: address, tx hash, reserve snapshot, timestamp */
  fact: string;
  /** Mathematical representation of significance */
  metric: string;
  /** Comparison against baseline */
  pattern?: string;
  /** Inferred market condition */
  signal: string;
  /** Trader-oriented implication */
  traderImpact: string;
  /** 0–100 confidence based on source quality and sample size */
  confidence: number;
  /** Transaction hashes, pool addresses, API endpoints used */
  sources: string[];
  /** Timestamp the evidence was generated (Unix seconds) */
  generatedAt: number;
}

// ─────────────────────────────────────────────
// 3. Risk signal (matches risk_signal.json schema)
// ─────────────────────────────────────────────

export interface RiskSignal {
  riskId: string;
  riskName: string;
  severity: SeverityLevel;
  status: 'active' | 'mitigated' | 'inactive';
  evidenceIds: string[];
  description: string;
  timeframeRelevance?: string;
  confidence: number;
}

// ─────────────────────────────────────────────
// 4. AMM Slippage Simulation (Module 3 / Module 7)
// ─────────────────────────────────────────────

export interface PositionSizeResult {
  /** INPUT: Position size in USD to simulate */
  positionSizeUsd: number;
  /** METRIC: % price moved by the trade vs. spot */
  priceImpactPct: number;
  /** METRIC: Slippage = (executionPrice − spotPrice) / spotPrice * 100 */
  slippagePct: number;
  /** METRIC: The actual per-token price achieved after the trade */
  executionPriceUsd: number;
  /** METRIC: Current spot price used as baseline */
  spotPriceUsd: number;
  /** DATA: Token amount implied by this position size */
  tokensInvolved: number;
  /** DATA: Total pool liquidity used for the calculation */
  poolLiquidityUsd: number;
  /** SIGNAL: Execution risk classification */
  exitRiskLevel: RiskLevel;
  /**
   * DATA: Swap fee rate applied to this simulation (e.g. 0.003 = 0.3%).
   * Read swapFeeKnown to determine whether this was observed or assumed.
   */
  swapFee: number;
  /**
   * DATA: Whether the swap fee was obtained from pool metadata (true)
   * or is a hardcoded default assumption (false).
   * When false, simulation accuracy depends on the pool actually using the
   * assumed fee, which may not be the case for non-standard AMMs.
   */
  swapFeeKnown: boolean;
  /**
   * DATA: How the token/quote reserves used for this simulation were obtained.
   * - 'derived'  : Virtual reserves calculated from liquidityUsd and spotPrice
   *                using the balanced 50/50 assumption. Not directly observed.
   * - 'observed' : Reserves were read directly from an on-chain source (future).
   */
  reserveProvenance: 'derived' | 'observed';
  /** Whether simulation was possible */
  status: ModuleStatus;
  /** If status ≠ 'ok', why */
  reason?: string;
}

export interface AmmSlippageResult {
  status: ModuleStatus;
  reason?: string;
  /** Pool identifier (address or provider label) used for the simulation */
  poolAddress?: string;
  /** Pool liquidity snapshot timestamp */
  poolSnapshotAt?: number;
  /** Spot price used */
  spotPriceUsd?: number;
  /** Total pool liquidity */
  poolLiquidityUsd?: number;
  /**
   * The AMM model applied for this simulation.
   * - 'constant-product' : V2-style x*y=k model was used (reliable)
   * - 'concentrated-liquidity' : Pool is CLMM/V3 — simulation was skipped (not yet supported)
   * - 'unknown' : Pool type could not be determined — V2 model applied with warning
   */
  poolModel?: 'constant-product' | 'concentrated-liquidity' | 'unknown';
  /**
   * The swap fee rate that was applied across all position simulations.
   * Check swapFeeKnown to know whether this was observed or assumed.
   */
  swapFeeUsed?: number;
  /**
   * Whether swapFeeUsed came from pool metadata (true) or was a default assumption (false).
   * When false, read result.reason for the assumption disclosure.
   */
  swapFeeKnown?: boolean;
  /**
   * How reserves used for this simulation were obtained.
   * - 'observed': token reserve read from on-chain and quote reserve derived from it
   * - 'derived' : both reserves derived using the 50/50 virtual approximation
   */
  reserveProvenance?: 'derived' | 'observed';
  /** One entry per position size */
  simulations: PositionSizeResult[];
  /** The minimum liquidity required to execute $1K with <10% impact */
  minimumViableLiquidityUsd?: number;
  /** SIGNAL: whether this pool is thin relative to typical positions */
  isThinLiquidity: boolean;
  evidenceIds: string[];
}


// ─────────────────────────────────────────────
// 5. Volume Concentration / HHI (Module 2)
// ─────────────────────────────────────────────

export interface WalletVolumeEntry {
  wallet: string;
  volumeUsd: number;
  txCount: number;
  shareOfTotal: number;
}

export interface HHIResult {
  /** 0–1: 0 = perfectly distributed, 1 = monopoly */
  hhi: number;
  /** Interpretation of HHI level */
  concentrationLevel: 'low' | 'moderate' | 'high' | 'extreme';
  /** Top contributors (max 5 for evidence) */
  topWallets: WalletVolumeEntry[];
}

export interface VolumeConcentrationResult {
  status: ModuleStatus;
  reason?: string;
  /** Total buy volume in USD observed in the batch */
  totalBuyVolumeUsd: number;
  /** Total sell volume in USD observed in the batch */
  totalSellVolumeUsd: number;
  /** Buy/Sell volume ratio (buy/sell) */
  buySellRatio: number;
  /** Unique buyer wallet count */
  uniqueBuyers: number;
  /** Unique seller wallet count */
  uniqueSellers: number;
  /** HHI computed over buyer volumes */
  buyerHHI: HHIResult;
  /** HHI computed over seller volumes */
  sellerHHI: HHIResult;
  /** HHI computed over total volume (buyers + sellers combined) */
  totalVolumeHHI: HHIResult;
  /** Wallets already flagged by Elevator's wash detector */
  elevatorWashTraderCount: number;
  /**
   * Volume contributed by Elevator-flagged wash traders.
   * This reuses Elevator's batch wash detection — Deep does NOT re-implement it.
   */
  elevatorWashVolumeUsd: number;
  /** Estimated wash volume ratio from Elevator flags */
  washVolumeRatio: number;
  /** SIGNAL: Is the price rising while unique buyers are declining? */
  volumePriceDivergence: boolean;
  /** 0–100 organic score (100 = fully organic distribution) */
  organicScore: number;
  /**
   * Gini coefficient over the holder balance array (0 = perfect equality, 1 = total inequality).
   * Only present when holdersStatus is 'available' and holder data was supplied.
   */
  giniCoefficient?: number;
  /** Human-readable label for gini level: 'distributed' | 'moderate' | 'concentrated' | 'extreme' */
  giniLevel?: 'distributed' | 'moderate' | 'concentrated' | 'extreme';
  evidenceIds: string[];
}

// ─────────────────────────────────────────────
// 6. Whale Behavior (Module 4)
// ─────────────────────────────────────────────

export interface WhaleEntry {
  /** IMPORTANT: This is a local batch observation, NOT authoritative on-chain balance */
  wallet: string;
  /** Net balance from the scanned transaction window only (local observation) */
  observedBatchBalance: number;
  /** observedBatchBalance / totalSupply * 100 */
  supplySharePct: number;
  /** Liquidity share if pool reserve data is available */
  liquiditySharePct?: number;
  isAboveSupplyThreshold: boolean;
  isAboveLiquidityThreshold: boolean;
  /** Net flow over the batch: positive = accumulating, negative = distributing */
  netFlow: number;
  txCount: number;
  /** Whether this address was filtered as a contract/system address */
  isFiltered: boolean;
  /**
   * Freshness classification derived from Bitquery wallet intelligence.
   * Window-scoped to the 90-day lookback — NOT an absolute wallet age.
   * 'unknown' when wallet is outside the top-10 enrichment cap or data unavailable.
   */
  freshnessTag: WhaleFreshnessTag;
}

export type WhalePhase = 'accumulation' | 'distribution' | 'neutral' | 'dormant' | 'insufficient_data';

/**
 * Freshness classification for a whale wallet, based on its earliest observed
 * activity within the Bitquery 90-day query window.
 *
 * IMPORTANT: 'fresh'/'recent'/'established' are window-scoped — they reflect how
 * recently the wallet was first seen within the 90-day lookback, NOT its true
 * on-chain age since deployment.
 *
 * Values:
 *   'fresh'       — first activity within last 7 days of the scan window
 *   'recent'      — first activity 7–30 days ago
 *   'established' — first activity >30 days ago within the window
 *   'unknown'     — wallet not in top-10 enrichment cap, or Bitquery data unavailable
 */
export type WhaleFreshnessTag = 'fresh' | 'recent' | 'established' | 'unknown';

export interface WhaleBehaviorResult {
  status: ModuleStatus;
  reason?: string;
  /**
   * IMPORTANT DATA SEMANTIC:
   * All whale balances are derived from the local transaction batch window.
   * They are LOCAL OBSERVATIONS, not authoritative on-chain holder balances.
   */
  dataSemanticWarning: string;
  /** Dynamic threshold: 1% of total supply */
  supplyThresholdPct: number;
  /** Dynamic threshold: 5% of total pool liquidity */
  liquidityThresholdPct: number;
  whales: WhaleEntry[];
  activeWhaleCount: number;
  /** Total supply % held by identified whales (batch observation) */
  totalWhaleSupplySharePct: number;
  /** Net tokens flowing IN to whale wallets over the batch */
  whaleNetInflow: number;
  /** Net tokens flowing OUT of whale wallets over the batch */
  whaleNetOutflow: number;
  /** Overall phase derived from aggregate whale net flow */
  phase: WhalePhase;
  /** SIGNAL: Is whale distribution dominant? */
  isDistributionRisk: boolean;
  evidenceIds: string[];
  /** Phase 3 additive: wallet history intelligence from Bitquery */
  walletIntelligence?: WalletIntelligenceSummary;
}

export interface WalletIntelligenceSummary {
  recordCount: number;
  available: number;
  unavailable: number;
  records: WalletHistoryRecord[];
}

// ─────────────────────────────────────────────
// 7. Whale Exit Simulation (Module 7)
// ─────────────────────────────────────────────

export interface WhaleExitScenario {
  /** 0.10, 0.25, or 0.50 */
  liquidationFraction: number;
  /** Display label */
  label: '10%' | '25%' | '50%';
  /** Token amount being sold in this SIMULATED scenario */
  simulatedTokensSold: number;
  /** USD value of tokens sold (at spot price, before impact) */
  simulatedUsdValueAtSpot: number;
  /** Quote received after AMM impact */
  simulatedQuoteReceived: number;
  /** Effective execution price per token */
  simulatedExecutionPriceUsd: number;
  /** Price impact on the pool */
  priceImpactPct: number;
  /** METRIC: % price decline from spot */
  priceDeltaPct: number;
  /** SIGNAL: severity of the scenario */
  severity: SeverityLevel;
  status: ModuleStatus;
  reason?: string;
}

export interface WhaleExitResult {
  status: ModuleStatus;
  reason?: string;
  /**
   * CRITICAL DISCLAIMER:
   * These are SIMULATED scenarios, not actual transactions.
   * They represent what WOULD happen if top whales liquidated.
   */
  simulationDisclaimer: string;
  /** The whale(s) used as the basis for the simulation */
  targetWallets: string[];
  /** Combined observed batch balance of target whales (local observation) */
  combinedObservedBalance: number;
  scenarios: WhaleExitScenario[];
  /** Highest severity scenario (for risk roll-up) */
  maxSeverity: SeverityLevel;
  evidenceIds: string[];
}

// ─────────────────────────────────────────────
// 8. Buyer Quality (Module 6)
// ─────────────────────────────────────────────

export interface BuyerCohortMetrics {
  totalBuyers: number;
  /** Wallets that appeared in multiple buy transactions (batch-level recurrence) */
  returningBuyers: number;
  /** Wallets with only a single buy transaction in the batch */
  singleUseBuyers: number;
  returningBuyerRatio: number;
  freshWalletRatio: number; // UNKNOWN if cross-token history unavailable
  /** Average USD value per buy transaction */
  avgBuyValueUsd: number;
  /** Std dev of buy values — low = concentrated, high = diverse */
  buyValueStdDevUsd: number;
  /** Normalized diversity index 0–1 (1 = perfectly diverse) */
  capitalDiversityIndex: number;
  // Phase 5D-7 extension fields
  profiledBuyerCount?: number;
  knownFundingSourceBuyerCount?: number;
  uniqueFundingSourceCount?: number;
  largestFundingSourceBuyerCount?: number;
  largestFundingSourceBuyerRatio?: number;
  lowActivityBuyerCount?: number;
  lowActivityBuyerRatio?: number;
  freshBuyerCount?: number;
  freshBuyerRatio?: number;
  // Phase 5D-8 extension fields
  /** Number of reputation records resolved for the cohort (≤ topBuyerWallets count) */
  profiledReputationCount?: number;
  /** Buyers with at least 1 distinct token traded (cross-token history present) */
  crossTokenBuyerCount?: number;
  /** Fraction of reputation-profiled buyers with cross-token history (0–1) */
  crossTokenBuyerRatio?: number;
  /** Reputation-weighted average win rate across cohort (null when insufficient data) */
  cohortAvgWinRate?: number | null;
  // Phase 5D-9 extension fields
  creatorFundedBuyerCount?: number;
  creatorFundedBuyerRatio?: number;
}

export interface BuyerQualityFactor {
  name: string;
  value: number | string;
  isPositive: boolean;
  weight: number;
  description: string;
}

export interface BuyerQualityResult {
  status: ModuleStatus;
  reason?: string;
  /** 0–100: 100 = highest quality organic demand */
  buyerQualityScore: number;
  cohortMetrics: BuyerCohortMetrics;
  positiveFactors: BuyerQualityFactor[];
  negativeFactors: BuyerQualityFactor[];
  /**
   * Wallet age / cross-token history is UNAVAILABLE without a historical indexer.
   * Metrics that require it are explicitly marked below.
   */
  unavailableMetrics: string[];
  evidenceIds: string[];
  confidence: number;
  // Phase 5D-3 SmartMoney Integration fields
  smartMoneyBuyerCount?: number | null;
  smartMoneyBuyerRatio?: number | null;
  smartMoneyBuyerConfidence?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// E. Smart Money Types (Phase 5D-1 & 5D-2 Infrastructure)
// ─────────────────────────────────────────────────────────────────────────────

export interface SmartMoneyTradeEvent {
  walletAddress: string;
  chain: string;
  tokenAddress?: string | null;
  txHash: string;
  blockNumber: number;
  blockHash?: string | null;
  logIndex: number;
  timestamp: string;
  eventType: 'buy' | 'sell' | 'swap' | 'unknown';
  tokenAmount?: number | null;
  quoteAmount?: number | null;
  quoteToken?: string | null;
  provider: string;
  indexedAt: string;
}

export interface SmartMoneyIndexingJob {
  walletAddress: string;
  chain: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lastError?: string | null;
  enqueuedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmartMoneyReputationRecord {
  walletAddress: string;
  chain: string;
  tradeCount?: number | null; // Deprecated/kept for backwards compat
  profitableTrades?: number | null; // Deprecated/kept for backwards compat
  realizedUsdPnl?: number | null; // Deprecated/kept for backwards compat
  distinctTokens?: number | null; // Deprecated/kept for backwards compat
  totalIndexedEvents?: number | null;
  recognizedSwapCount?: number | null;
  closedTradeCount?: number | null;
  profitableTradeCount?: number | null;
  losingTradeCount?: number | null;
  distinctTokensTraded?: number | null;
  realizedPnl?: number | null;
  realizedCostBasis?: number | null;
  roi?: number | null;
  winRate?: number | null;
  openPositionCount?: number | null;
  coverage?: 'COMPLETE' | 'CAPPED' | 'UNAVAILABLE' | null;
  pnlStatus?: 'complete' | 'incomplete' | 'unavailable' | null;
  confidence?: number | null;
  status: 'pending' | 'available' | 'partial' | 'unavailable';
  freshness: string;
  lastUpdatedAt: string;
  provider: string;
}

export interface SmartMoneyCohortSummary {
  profiledWalletCount: number;
  smartMoneyWalletCount: number;
  smartMoneyWalletRatio: number | null;
  smartMoneyConfidence: number;
  incompleteProfileCount: number;
  unavailableProfileCount: number;
  pendingProfileCount: number;
  staleProfileCount: number;
}

export interface SmartMoneyResult {
  status: ModuleStatus;
  reason?: string;
  isSmartMoney: boolean;
  confidence: number;
  metrics: {
    totalIndexedEvents: number | null;
    recognizedSwapCount: number | null;
    closedTradeCount: number | null;
    profitableTradeCount: number | null;
    losingTradeCount: number | null;
    distinctTokensTraded: number | null;
    realizedPnl: number | null;
    realizedCostBasis: number | null;
    roi: number | null;
    winRate: number | null;
    openPositionCount: number | null;
    coverage: 'COMPLETE' | 'CAPPED' | 'UNAVAILABLE' | null;
    pnlStatus: 'complete' | 'incomplete' | 'unavailable' | null;
    tradeCount: number | null; // Backwards compatibility
    profitableTrades: number | null; // Backwards compatibility
    realizedUsdPnl: number | null; // Backwards compatibility
  };
  cohortSummary?: SmartMoneyCohortSummary;
  evidenceIds: string[];
}

// ─────────────────────────────────────────────
// 9. Market Regime (Module 8)
// ─────────────────────────────────────────────

export type RegimeLabel =
  | 'ACCUMULATION'
  | 'MOMENTUM'
  | 'BREAKOUT'
  | 'DISTRIBUTION'
  | 'LIQUIDITY_EXIT'
  | 'RECOVERY'
  | 'DEAD'
  | 'INSUFFICIENT_DATA';

export interface OHLCVStats {
  /** Price slope: positive = uptrend */
  priceSlopePerCandle: number;
  /** Volume slope: positive = increasing volume */
  volumeSlopePerCandle: number;
  /** Price volatility (std dev of % changes) */
  priceVolatility: number;
  /** Z-score of most recent candle volume vs. historical mean */
  volumeZScore: number;
  /** Correlation between price direction and volume direction */
  priceVolumeCorrelation: number;
  candleCount: number;
  firstPrice: number;
  lastPrice: number;
  totalPriceChangePct: number;
  avgVolume: number;
}

export interface MarketRegimeResult {
  status: ModuleStatus;
  reason?: string;
  regime: RegimeLabel;
  /** 0–100: confidence in the regime classification */
  confidence: number;
  stats?: OHLCVStats;
  /** Narrative description of the detected pattern */
  regimeDescription: string;
  /**
   * IMPORTANT: This classifies CURRENT behavior only.
   * It does NOT predict future price direction.
   */
  predictionDisclaimer: string;
  evidenceIds: string[];
}

// ─────────────────────────────────────────────
// 9b. Liquidity Fragmentation (Phase 4)
// ─────────────────────────────────────────────

export interface PoolLiquidityShare {
  /** Pool identifier (pair address or provider label) */
  poolId: string;
  /** Liquidity in this pool (USD) */
  liquidityUsd: number;
  /** Fraction of total liquidity in this pool (0–1) */
  share: number;
}

export interface LiquidityFragmentationResult {
  status: ModuleStatus;
  reason?: string;
  /**
   * Herfindahl–Hirschman Index of pool liquidity distribution (0–1).
   * 0 = perfectly distributed across pools, 1 = single-pool monopoly.
   */
  poolHHI: number;
  /** HHI interpretation */
  concentrationLevel: 'low' | 'moderate' | 'high' | 'monopoly';
  /** Total USD liquidity across all pools */
  totalLiquidityUsd: number;
  /** Number of pools included in the analysis */
  poolCount: number;
  /** Per-pool liquidity share breakdown */
  pools: PoolLiquidityShare[];
  /**
   * SIGNAL: Is a dominant fraction of liquidity concentrated in a single pool?
   * True when the largest pool holds ≥80% of total liquidity.
   */
  isDominantPool: boolean;
  evidenceIds: string[];
}

// ─────────────────────────────────────────────
// 10. Capital Efficiency (Module 12)
// ─────────────────────────────────────────────

export interface CapitalEfficiencyResult {
  status: ModuleStatus;
  reason?: string;
  /** FDV / total pool liquidity (NOT market cap — uses Fully Diluted Valuation) */
  fdvToLiquidityRatio: number;
  /** How much market cap changes per $1 of net capital flow */
  capitalSensitivityMultiplier: number;
  sensitivity: CapitalSensitivity;
  /** FDV used (USD) */
  fdvUsd: number;
  /** Total pool liquidity used (USD) */
  totalLiquidityUsd: number;
  /** Spot price used (USD) */
  spotPriceUsd: number;
  evidenceIds: string[];
}

// ─────────────────────────────────────────────
// 11. Risk Score (Module 14 / Module 9)
// ─────────────────────────────────────────────

export interface SubScore {
  module: string;
  label: string;
  /** Raw score 0–100 where higher = more risk. Only valid when dataAvailability === 'measured'. */
  score: number;
  weight: number;
  /** score * weight. Zero when dataAvailability !== 'measured' so no synthetic contribution. */
  weightedContribution: number;
  confidence: number;
  evidenceIds: string[];
  /**
   * 'measured'           – module ran successfully and produced a real score.
   * 'insufficient_data'  – module ran but lacked sufficient data to score reliably.
   * 'unavailable'        – module could not run at all (e.g. EVM holder data not collected).
   */
  dataAvailability: 'measured' | 'insufficient_data' | 'unavailable';
}

export interface RiskMitigator {
  name: string;
  description: string;
  /** How much this mitigator reduces the overall score */
  reductionPoints: number;
}

export interface ExplainableRiskScore {
  status: ModuleStatus;
  /** 0–100: weighted aggregate risk score (normalized over available modules only). */
  overallRiskScore: number;
  riskLevel: RiskLevel;
  subScores: SubScore[];
  topRisks: RiskSignal[];
  mitigators: RiskMitigator[];
  confidence: number;
  evidenceIds: string[];
  /**
   * false when ALL input modules returned insufficient_data or unavailable.
   * In this case overallRiskScore is 0 and MUST NOT be presented as a meaningful risk assessment.
   */
  sufficientData: boolean;
  /**
   * 'complete'           – all modules produced measured scores.
   * 'partial'            – at least one module measured; one or more unavailable/insufficient.
   * 'insufficient_data'  – no module produced a measured score.
   */
  scoreCompleteness: 'complete' | 'partial' | 'insufficient_data';
  /** How many of the total modules produced a measured score. */
  availableModuleCount: number;
  /** Total number of scoring modules. */
  totalModuleCount: number;
}

// ─────────────────────────────────────────────
// 12. Trader Intelligence Report (Module 15)
// ─────────────────────────────────────────────

export interface TraderIntelligenceReport {
  status: ModuleStatus;
  /** Unique scan ID (UUID) */
  scanId: string;
  /** ISO timestamp */
  generatedAt: string;
  /** Overall one-sentence executive summary */
  executiveSummary: string;
  /** Regime section narrative */
  regimeNarrative: string;
  /** Liquidity and execution conditions */
  executionConditions: string;
  /** Whale and holder risk */
  holderRisk: string;
  /** Volume quality assessment */
  volumeQuality: string;
  /** Buyer quality assessment */
  buyerQualityAssessment: string;
  /** Capital efficiency assessment */
  capitalEfficiencyAssessment: string;
  /** Top risks list (human-readable) */
  topRisksSummary: string[];
  /** Overall confidence of the report */
  confidence: number;
  /**
   * Data limitations and missing fields.
   * Every field that could not be computed is listed here.
   */
  dataLimitations: string[];
}

// ─────────────────────────────────────────────
// 13. Deep Scan Input
// ─────────────────────────────────────────────

export interface DeepScanInput {
  tokenAddress: string;
  network: string;
  chainId?: string;
  /**
   * Scenario A: Elevator data exists → consumed directly.
   * Scenario B: not provided → DeepScanService fetches internally.
   */
  elevatorResult?: import('../elevator/collectors/types').CollectorResult;
  /** From Basic Scan / shared cache */
  tokenMetadata?: {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: number;
    fdvUsd?: number;
    spotPriceUsd?: number;
    totalLiquidityUsd?: number;
    volume24hUsd?: number | null;
    mainPools?: import('../blockchain/types').LiquidityPool[];
    creatorAddress?: string;
    securityFlags?: {
      isHoneypot?: boolean;
      hasMintFunction?: boolean;
      canBePaused?: boolean;
    };
    timestamp?: number; // Unix timestamp of when the metadata/market data was retrieved (seconds)
    source?: string; // Provider source (e.g. 'dexscreener', 'geckoterminal', 'fallback')
  };
  /** Custom position sizes for AMM simulation (USD). Defaults to [1000,5000,10000,25000,50000,100000] */
  simulatedPositionSizes?: number[];
  /** Max transactions to fetch if Scenario B */
  maxTransactions?: number;
  /** Passed from the session for tracing */
  sessionId?: string;
  /**
   * Authenticated user ID from Supabase (UUID string).
   * Used to scope the session cache so one user's results are never served to another.
   * Required for correct cache isolation — omitting this disables caching.
   */
  userId?: string;
}

export type ScanOutcome = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'INSUFFICIENT_DATA' | 'FAILED';

// ─────────────────────────────────────────────
// 14. Deep Scan Output (matches scan_output.json schema)
// ─────────────────────────────────────────────

export type DataFreshnessStatus = 'fresh' | 'stale' | 'unknown';

export interface DeepScanResult {
  /** 'success' | 'partial_failure' | 'failure' */
  status: 'success' | 'partial_failure' | 'failure';
  outcome?: ScanOutcome;
  scanId: string;
  timestamp: number;
  criticalBlocker?: boolean;
  tokenMetadata: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply?: number;
    creatorAddress?: string;
  };
  marketSummary: {
    priceUsd: number;
    volume24hUsd: number | null;  // null = not collected from data source; do NOT render as $0 in UI
    fdvUsd: number;
    marketRegime: RegimeLabel;
    totalLiquidityUsd: number;
    totalCrossChainLiquidityUsd?: number;
    crossChainPools?: import('../blockchain/types').CrossChainPoolInfo[];
  };
  // ── P0 Modules ──
  ammSlippage: AmmSlippageResult;
  volumeConcentration: VolumeConcentrationResult;
  whaleBehavior: WhaleBehaviorResult;
  whaleExit: WhaleExitResult;
  buyerQuality: BuyerQualityResult;
  marketRegime: MarketRegimeResult;
  capitalEfficiency: CapitalEfficiencyResult;
  // ── P5 Modules ──
  smartMoney?: SmartMoneyResult;
  // ── P4 Modules ──
  /** Multi-pool liquidity fragmentation analysis (Phase 4) */
  liquidityFragmentation?: LiquidityFragmentationResult;
  // ── P5D-6 Modules ──
  /** Liquidity / Slippage / Stress Analysis (Phase 5D-6) */
  liquidityStress?: LiquidityStressReport;
  /** Historical behavior analysis (Module 13) */
  historicalBehavior?: HistoricalBehaviorResult;
  // ── Phase 4 Reputation & Traceability Modules ──
  deployerProfile?: import('../reputation/DeployerProfiler').DeployerProfile;
  tokenUnlockSchedule?: import('../traceability/TokenUnlockTracker').UnlockSchedule;
  rugPatternMatch?: import('../reputation/RugPatternMatcher').RugMatchResult;
  insiderAccumulation?: import('./engines/InsiderAccumulationDetector').InsiderAccumulationResult;
  // ── Phase 5: AI Agents ──
  exchangeListing?: import('../ai/ExchangeListingAgent').ExchangeListingResult;
  news?: import('../ai/NewsAgent').NewsResult;
  // ── Social Signals Module ──
  socials?: import('../social/SocialMetadataCollector').SocialMetadataResult;
  riskScore: ExplainableRiskScore;
  // ── Synthesis ──
  topRisks: RiskSignal[];
  evidence: EvidenceNode[];
  traderIntelligence: TraderIntelligenceReport;
  // ── Data quality ──
  dataQuality: {
    staleDataWarning: boolean;
    blockLatency?: number;
    elevatorDataReused: boolean;
    transactionCount: number;
    ohlcvCandleCount: number;
    freshness?: {
      scanTime: number;
      cacheAgeSeconds?: number;
      marketDataTimestamp?: number;
      marketDataAgeSeconds?: number;
      marketDataFreshness: DataFreshnessStatus;
      isMarketDataStale: boolean;
      ohlcvTimestamp?: number;
      ohlcvAgeSeconds?: number;
      ohlcvFreshness: DataFreshnessStatus;
      isOhlcvStale: boolean;
      transactionTimestamp?: number;
      transactionAgeSeconds?: number;
      transactionFreshness: DataFreshnessStatus;
      isTransactionStale: boolean;
    };
  };
  limitations: string[];
  /** Overall confidence across all modules */
  overallConfidence: number;
  /** Wall-clock ms for the scan */
  scanDurationMs: number;
  snapshotId?: string;
}

export interface HistoricalPoolStateResult {
  status: 'available' | 'unavailable' | 'error';
  freshness: 'LIVE' | 'UNAVAILABLE';
  chain: string;
  poolAddress: string;
  blockNumber: number;
  blockHash: string | null;
  timestamp: string | null;
  reserve0: string | null;
  reserve1: string | null;
  provider: string;
  fetchedAt: string;
  errorCode?: string;
}

/**
 * Normalizes a blockchain address to guarantee case-insensitive comparison for EVM,
 * while preserving base58 casing for Solana.
 */
export function normalizeAddress(address: string | undefined | null): string {
  if (!address) return '';
  const trimmed = address.trim();
  // EVM addresses start with '0x' or '0X' and have length 42
  if (trimmed.toLowerCase().startsWith('0x') && trimmed.length === 42) {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5D-6: Liquidity / Slippage / Stress Analysis Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single point on the slippage curve: a position size and its resulting
 * price impact from the constant-product AMM formula.
 * All values are exact — never fabricated or interpolated.
 */
export interface SlippagePoint {
  /** Position size in USD */
  positionSizeUsd: number;
  /** Number of tokens involved in the swap */
  tokensIn: number;
  /** USD received from the swap */
  quoteOut: number;
  /** Effective execution price (USD per token) */
  executionPriceUsd: number;
  /** Spot price at time of simulation (USD per token) */
  spotPriceUsd: number;
  /** Price impact as a percentage (0–100) */
  priceImpactPct: number;
  /** Fraction of reserve0 consumed by this trade (0–1) */
  reserveUtilization: number;
  /** Swap fee applied (as a decimal fraction, e.g. 0.003) */
  feeRate: number;
  /** Whether the reserves used were observed on-chain (true) or derived from TVL (false) */
  observedReserves: boolean;
  /** 'ok' if simulation succeeded; 'exceeds_pool' if trade larger than pool; 'invalid_input' if inputs bad */
  status: 'ok' | 'exceeds_pool' | 'invalid_input';
  reason?: string;
}

/**
 * Result of computing the maximum executable input amount for a given
 * price impact threshold. Uses an exact analytical formula — no search loops.
 */
export interface ExecutableLiquidityResult {
  /** Price impact threshold used (e.g. 0.01 = 1%) */
  impactThreshold: number;
  /** Human-readable label (e.g. '1%') */
  impactThresholdLabel: string;
  /** Maximum USD input before impact exceeds threshold; null when infeasible */
  maxInputUsd: number | null;
  /** Maximum token input before impact exceeds threshold; null when infeasible */
  maxInputTokens: number | null;
  /** Expected USD output at the boundary */
  expectedOutputUsd: number | null;
  /** Reserve utilization at the boundary (0–1) */
  reserveUtilization: number | null;
  /** 'ok' | 'infeasible' (fee >= threshold) | 'invalid' (bad reserves) */
  status: 'ok' | 'infeasible' | 'invalid';
  reason?: string;
}

/** Deterministic severity classification for stress scenarios */
export type StressSeverity = 'negligible' | 'low' | 'moderate' | 'high' | 'critical';

/**
 * A single deterministic stress scenario result. All values computed
 * from the constant-product AMM formula — never fabricated.
 */
export interface LiquidityStressScenario {
  /** Identifier for this scenario (e.g. 'large_buy', 'top_holder_exit') */
  scenarioId: string;
  /** Human-readable label */
  label: string;
  /** Description of what this scenario simulates */
  description: string;
  /** Input amount simulated in USD */
  simulatedInputUsd: number;
  /** Token amount simulated */
  simulatedInputTokens: number;
  /** Expected USD output */
  simulatedOutputUsd: number;
  /** Execution price at this stress level */
  executionPriceUsd: number;
  /** Price impact percentage */
  priceImpactPct: number;
  /** Post-trade reserve0 (in raw token units, as string to preserve uint112 precision) */
  postTradeReserve0: string;
  /** Post-trade reserve1 (in raw quote units, as string) */
  postTradeReserve1: string;
  /** Fraction of reserve consumed (0–1) */
  reserveUtilization: number;
  /** Remaining executable liquidity at 1% impact after this stress */
  remainingExecutableUsd: number | null;
  /** Deterministic severity classification */
  severity: StressSeverity;
  /** 'ok' | 'exceeds_pool' | 'invalid' | 'unsupported' */
  status: 'ok' | 'exceeds_pool' | 'invalid' | 'unsupported';
  reason?: string;
}

/** A detected historical liquidity shock event */
export interface LiquidityShock {
  /** Block number where the shock was detected */
  blockNumber: number;
  /** Estimated UTC timestamp of the shock */
  blockTimestamp: string | null;
  /** Target token reserve before the shock */
  targetReserveBefore: string;
  /** Target token reserve after the shock */
  targetReserveAfter: string;
  /** Percentage change in target reserve (negative = withdrawal) */
  targetReserveChangePct: number;
  /** Percentage change in liquidity USD (negative = withdrawal) */
  liquidityChangePct: number;
  /** Shock type classification */
  type: 'sudden_withdrawal' | 'sudden_addition' | 'ratio_shift' | 'drain';
  /** Severity of this shock */
  severity: StressSeverity;
}

/** Liquidity regime classification */
export type LiquidityRegime =
  | 'deep'
  | 'healthy'
  | 'moderate'
  | 'thin'
  | 'critically_thin'
  | 'deteriorating'
  | 'recovering';

/** Historical liquidity metrics computed from Phase 5D-5 snapshots */
export interface HistoricalLiquidityMetrics {
  /** Number of snapshots available */
  snapshotCount: number;
  /** Block number of oldest snapshot */
  oldestBlock: number | null;
  /** Block number of newest snapshot */
  newestBlock: number | null;
  /** Minimum target reserve observed (as string, raw units) */
  minTargetReserve: string | null;
  /** Maximum target reserve observed (as string, raw units) */
  maxTargetReserve: string | null;
  /** Minimum liquidity USD observed (from snapshots where both reserves and price are available) */
  minLiquidityUsd: number | null;
  /** Maximum liquidity USD observed */
  maxLiquidityUsd: number | null;
  /** Target reserve growth from oldest to newest snapshot (fractional, positive = growth) */
  targetGrowthFraction: number | null;
  /**
   * Volatility of target reserve measured as the average absolute fractional change
   * between consecutive snapshots. Missing gaps remain missing — no interpolation.
   */
  targetVolatilityAvg: number | null;
  /** Detected liquidity shocks */
  shocks: LiquidityShock[];
  /** Whether the reserve trend is net-positive, net-negative, or flat */
  trend: 'growing' | 'declining' | 'flat' | 'insufficient_data';
  /** Whether there are missing snapshots in the expected schedule */
  hasMissingSnapshots: boolean;
  /** Status of historical data availability */
  status: 'ok' | 'insufficient_data' | 'unavailable';
}

/**
 * Complete liquidity stress report produced by the LiquidityStressAnalyzer.
 * This is the top-level Phase 5D-6 output attached to DeepScanResult.
 */
export interface LiquidityStressReport {
  /** Module status */
  status: ModuleStatus;
  reason?: string;

  // ── Pool identification ──
  /** Pool address used for simulation */
  poolAddress: string | null;
  /** Pool model used ('constant-product' | 'concentrated-liquidity' | 'unknown') */
  poolModel: string | null;
  /** Whether observed on-chain reserves were used (true) or derived from TVL (false) */
  observedReserves: boolean;
  /** Spot price used for USD conversions */
  spotPriceUsd: number;
  /** Current total liquidity USD */
  totalLiquidityUsd: number;

  // ── Slippage curve ──
  /** Full slippage curve across position sizes. Monotonic by construction. */
  slippageCurve: SlippagePoint[];
  /** Whether the curve is monotonic (sanity check result) */
  isCurveMonotonic: boolean;

  // ── Executable liquidity ──
  /** Executable liquidity at each configured impact threshold */
  executableLiquidity: ExecutableLiquidityResult[];

  // ── Liquidity utilization at current position sizes ──
  /**
   * How much of reserve0 would be consumed by a $1k trade.
   * Provided as a convenience metric; full details are in slippageCurve.
   */
  utilizationAt1kUsd: number | null;

  // ── Stress scenarios ──
  scenarios: LiquidityStressScenario[];
  /** Worst severity across all scenarios */
  maxScenarioSeverity: StressSeverity;

  // ── Historical analysis ──
  historical: HistoricalLiquidityMetrics;

  // ── Regime ──
  /** Deterministic liquidity regime classification */
  liquidityRegime: LiquidityRegime;
  /** Regime reasoning (enumerated, never LLM-generated) */
  liquidityRegimeReason: string;
}

export interface DrawdownInfo {
  depthPercent: number;
  durationCandles: number;
  recoveryCandles: number | null;
}

export interface PumpDumpAnalysis {
  detected: boolean;
  confidence: number;
  details?: string;
}

export interface SlowRugAnalysis {
  detected: boolean;
  confidence: number;
  details?: string;
}

export interface DistributionVelocityResult {
  velocity: number;
  countT0: number;
  countT1: number;
}

export interface HistoricalBehaviorResult {
  status: 'ok' | 'insufficient_data' | 'unavailable';
  reason?: string;
  maxDrawdown: DrawdownInfo | null;
  pumpDump: PumpDumpAnalysis | null;
  slowRug: SlowRugAnalysis | null;
  distributionVelocity: DistributionVelocityResult | null;
}


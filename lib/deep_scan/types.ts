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

// ─────────────────────────────────────────────
// 1. Status / quality sentinels
// ─────────────────────────────────────────────

export type ModuleStatus =
  | 'ok'
  | 'partial'
  | 'insufficient_data'
  | 'error';

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
  /** DATA: Swap fee applied (e.g. 0.003 = 0.3%) */
  swapFee: number;
  /** Whether simulation was possible */
  status: ModuleStatus;
  /** If status ≠ 'ok', why */
  reason?: string;
}

export interface AmmSlippageResult {
  status: ModuleStatus;
  reason?: string;
  /** Pool address used for the simulation */
  poolAddress?: string;
  /** Pool liquidity snapshot timestamp */
  poolSnapshotAt?: number;
  /** Spot price used */
  spotPriceUsd?: number;
  /** Total pool liquidity */
  poolLiquidityUsd?: number;
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
}

export type WhalePhase = 'accumulation' | 'distribution' | 'neutral' | 'insufficient_data';

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
}

// ─────────────────────────────────────────────
// 9. Market Regime (Module 8)
// ─────────────────────────────────────────────

export type RegimeLabel =
  | 'ACCUMULATION'
  | 'MOMENTUM'
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
  /** Raw score 0–100 where higher = more risk */
  score: number;
  weight: number;
  /** score * weight */
  weightedContribution: number;
  confidence: number;
  evidenceIds: string[];
}

export interface RiskMitigator {
  name: string;
  description: string;
  /** How much this mitigator reduces the overall score */
  reductionPoints: number;
}

export interface ExplainableRiskScore {
  status: ModuleStatus;
  /** 0–100: weighted aggregate risk score */
  overallRiskScore: number;
  riskLevel: RiskLevel;
  subScores: SubScore[];
  topRisks: RiskSignal[];
  mitigators: RiskMitigator[];
  confidence: number;
  evidenceIds: string[];
  /**
   * false when ALL input modules returned insufficient_data.
   * In this case overallRiskScore is based entirely on defaults and
   * MUST NOT be presented to the trader as a meaningful risk assessment.
   */
  sufficientData: boolean;
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

// ─────────────────────────────────────────────
// 14. Deep Scan Output (matches scan_output.json schema)
// ─────────────────────────────────────────────

export interface DeepScanResult {
  /** 'success' | 'partial_failure' | 'failure' */
  status: 'success' | 'partial_failure' | 'failure';
  scanId: string;
  timestamp: number;
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
  };
  // ── P0 Modules ──
  ammSlippage: AmmSlippageResult;
  volumeConcentration: VolumeConcentrationResult;
  whaleBehavior: WhaleBehaviorResult;
  whaleExit: WhaleExitResult;
  buyerQuality: BuyerQualityResult;
  marketRegime: MarketRegimeResult;
  capitalEfficiency: CapitalEfficiencyResult;
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
  };
  limitations: string[];
  /** Overall confidence across all modules */
  overallConfidence: number;
  /** Wall-clock ms for the scan */
  scanDurationMs: number;
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

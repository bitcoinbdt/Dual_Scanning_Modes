# Insider Accumulation Detection

This document specifies how the scanner detects coordinated, pre-information
buying patterns in a token's transaction history. Insider accumulation is
distinct from sniper detection (block-0 buyers) and from CEX exit heuristics
(`deep_scan_update.md §3`). It specifically targets **wallets that buy in a
narrow time window before a significant price move**, which is the on-chain
fingerprint of insider trading.

---

## 1. Definitions

| Term | Definition |
|---|---|
| **Sniper** | Buys in block 0–5 of token creation. Detected by the existing `BuyerQualityAnalyzer`. |
| **CEX Exit** | Insider transfers tokens to a centralized exchange to sell off-chain. Covered in `deep_scan_update.md §3`. |
| **Insider Accumulation** | Multiple wallets buy quietly within a narrow window (e.g. 60–300 seconds) **before** a large price or volume event. Not at launch — later in the token's life. |

---

## 2. Detection Algorithm

### Step 1 — Identify Price Spike Events
From the OHLCV candle data (already collected by Elevator), find all candles
where:
```
candle.volume > mean_volume * 3.0   AND   |close - open| / open > 0.15
```
These are candidate "event" candles — high-volume, high-movement moments that
could be organic or information-driven.

### Step 2 — Look Back 5–10 Minutes Before Each Event
For each identified event candle, scan the transaction batch for buys that
occurred in the **preceding 300 seconds** (5 minutes):

```typescript
const preEventBuys = transactions.filter(tx =>
  tx.type === 'buy' &&
  tx.isTrade === true &&
  tx.timestamp >= (eventTimestamp - 300) &&
  tx.timestamp < eventTimestamp
);
```

### Step 3 — Cluster Wallets by Time Window
Group the pre-event buys into narrow time windows (60-second buckets). A
**cluster** is ≥3 different wallets that all buy within the same 60-second window:

```typescript
interface InsiderCluster {
  windowStart: number;          // Unix timestamp
  windowEnd: number;
  wallets: string[];            // Unique wallet addresses
  totalBuyVolumeUsd: number;    // Sum of all buys in window
  avgBuyUsd: number;
  priceAtBuy: number;           // Avg price during window
  priceAtEventPeak: number;     // Peak price at event candle
  impliedPnlPct: number;        // (peakPrice - buyPrice) / buyPrice * 100
}
```

### Step 4 — Apply Suspicion Filters
A cluster is flagged as **suspicious insider accumulation** only if ALL of
the following are true:

| Filter | Condition |
|---|---|
| **Wallet freshness** | ≥50% of wallets in the cluster have no buy history for this token prior to this window |
| **No prior sniper flag** | These wallets are not already in the block-0 sniper list (avoid double-counting) |
| **Profitability** | `impliedPnlPct > 20%` — they profited meaningfully from the event |
| **Cluster uniqueness** | Wallets are not all funded by the same CEX hot wallet (that's the CEX exit heuristic, not insider accumulation) |

### Step 5 — Calculate Insider Score
```
Insider Score (0–100):
  Base = 0
  + 20 per confirmed cluster
  + 15 if any cluster wallet appears in ≥2 separate events
  + 10 if cluster total buy volume > 3% of 24h volume
  Cap at 100
```

---

## 3. Risk Signal

| Signal ID | Condition | Severity | Score Contribution |
|---|---|---|---|
| `INS-001` | 1 confirmed insider cluster detected | `medium` | +12 points |
| `INS-002` | 2+ confirmed insider clusters detected | `high` | +20 points |
| `INS-003` | A wallet appears as insider in 2+ separate events | `high` | +15 additional |
| `INS-004` | Cluster buy volume > 5% of 24h volume | `critical` | +20 additional |

---

## 4. Data Requirements

This module depends entirely on data **already collected** by the Elevator:
- `transactions: UniversalTransaction[]` — needs `timestamp`, `type`, `wallet`,
  `priceUsd`, `amount`
- `ohlcv: OHLCVCandle[]` — needs `timestamp`, `volume`, `open`, `close`

**Transaction window requirement**: Insider accumulation detection requires
a minimum of **500 transactions** spanning at least **6 hours** of history to
produce meaningful event detection. If the token has fewer transactions or
shorter history, return `status: 'insufficient_data'`.

This reinforces the need for the 10k transaction cap upgrade in
`deep_scan_update.md §2`.

---

## 5. Large-Cap Exception

Per `deep_scan_update.md §4`, large-cap tokens (>$50M market cap) skip
micro-cap-style metrics. Insider accumulation detection **does run** for
large-cap tokens — insider trading is more serious, not less, for established
tokens. This is one case where the Large-Cap engine runs a micro-cap metric.

---

## 6. UI Display Rules

The insider accumulation section is displayed only when at least one cluster
is detected (`INS-001` or above). Display objective data only:

```
Insider Accumulation Analysis:
  Clusters Detected:    2 suspicious buy clusters
  Cluster 1:
    Time:             14 Aug 2026, 09:12–09:13 UTC
    Wallets:          4 wallets bought simultaneously
    Buy Volume:       $3,420 combined
    Price at buy:     $0.0000412
    Price at peak:    $0.0000761  (+84.7% in 8 minutes)
  Cluster 2:
    Time:             15 Aug 2026, 16:44–16:45 UTC
    Wallets:          3 wallets bought simultaneously
    Buy Volume:       $1,180 combined
    Price at buy:     $0.0000890
    Price at peak:    $0.0001230  (+38.2% in 12 minutes)

  Repeat Actor:  Wallet 7Xk...mQ2 appeared in both clusters.
```

**Do not say "insider trading confirmed"** — this is detected correlation, not
proof. The display uses neutral language: *"suspicious buy clusters"*,
*"coordinated accumulation pattern"*.

---

## 7. Confidence & Limitations

Always include a confidence note in the report:

> *"Cluster detection is based on timing and price correlation only. Coordinated
> buying before a price move may reflect public information, bots, or
> coincidence. This is a signal, not confirmation of wrongdoing."*

---

## 8. Codebase Integration Points

| File | Change |
|---|---|
| `lib/deep_scan/engines/InsiderAccumulationDetector.ts` | **[NEW]** Full detection algorithm (Steps 1–5) |
| `lib/deep_scan/engines/RiskScoringEngine.ts` | Add INS-001 → INS-004 signals with score weights |
| `lib/deep_scan/DeepScanService.ts` | Call `InsiderAccumulationDetector` after OHLCV + transaction data are loaded |
| `lib/deep_scan/types.ts` | Add `insiderAccumulation: InsiderAccumulationResult` to `DeepScanResult` |

**Minimum viable data**: 500+ transactions, 6+ hours of OHLCV history.
If not met → `status: 'insufficient_data'` with reason string.

# Historical Rug Pattern Matching

This document specifies how the scanner should identify tokens whose deployer
wallet matches the on-chain signature of known rug-pull operators — using a
combination of self-maintained reputation data, third-party security APIs, and
behavioral heuristics derived from the deployer's on-chain history.

---

## 1. The Core Problem

Deployer profiling (`deployer_profiling.md`) tracks a specific deployer's past
projects to build a reputation score. But this only works for deployers the
scanner has already seen.

Rug Pattern Matching solves a different problem: **cross-referencing every new
deployer against known-bad patterns and public rug registries**, even on first
encounter. The goal is to catch serial ruggers who use fresh wallets by
recognizing their behavioral fingerprint.

---

## 2. Data Sources (Priority Order)

### Source 1: TokenSniffer API (Free Tier)
TokenSniffer maintains a reputation database of scam tokens:
```
GET https://tokensniffer.com/api/v2/tokens/{chain_id}/{address}
```
Returns: `score`, `is_scam`, `behaviors[]` (list of detected scam behaviors).

- **Rate limit**: 1 req/sec on free tier
- **Cache TTL**: 24 hours (results are stable for known scams)
- **Chains supported**: ETH, BSC, Polygon, Arbitrum, Base

### Source 2: GoPlus Token Security (Already Integrated)
GoPlus returns `creator_address` — this creator can be queried against GoPlus's
own bad actor registry via a separate endpoint:
```
GET https://api.gopluslabs.io/api/v1/address_security/{address}
```
Returns: `malicious_address`, `phishing_activities`, `blackmail_activities`,
`contract_address` (known malicious contracts deployed).

### Source 3: Internal `known_ruggers` Table (Self-Maintained)
A Supabase table of confirmed rug operators, populated from:
- Admin-flagged entries (manual curation)
- Auto-populated when a deployer's token is confirmed as a rug via
  community reports or post-fact analysis

```sql
CREATE TABLE known_ruggers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deployer_address TEXT NOT NULL,
  chain           TEXT NOT NULL,

  confirmed_rugs  INTEGER NOT NULL DEFAULT 1,
  total_tokens    INTEGER NOT NULL DEFAULT 1,

  -- Evidence
  rug_token_addresses  TEXT[],        -- List of tokens that rugged
  rug_confirmed_at     TIMESTAMPTZ[],  -- When each rug was confirmed
  rug_methods          TEXT[],         -- e.g. ['lp_drain', 'mint_dump', 'honeypot']

  -- Source of entry
  source          TEXT NOT NULL,      -- 'admin', 'tokensniffer', 'community'
  first_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(deployer_address, chain)
);

CREATE INDEX idx_ruggers_address ON known_ruggers(deployer_address, chain);
```

### Source 4: Behavioral Fingerprint Matching (On-Chain Heuristics)
Even without a registry hit, certain on-chain patterns strongly indicate a
serial rugger using a fresh wallet:

| Pattern | Description | Signal Weight |
|---|---|---|
| **Dev wallet funded from mixer** | Deployer wallet received SOL/ETH from Tornado Cash, Railgun, or similar | `high` |
| **Wallet age < 24h at deploy time** | Deployer wallet created the same day as the token | `medium` |
| **LP removed within 7 days** | Liquidity pulled in the first week (retroactive check) | `critical` |
| **Honeypot + immediate LP drain** | Standard honeypot execution sequence | `critical` |
| **>80% supply to deployer, then dump** | Deployer held majority, sold within 48h | `high` |
| **Multiple tokens, all failed** | Deployer made 3+ tokens all with <100 holders | `medium` |

---

## 3. Risk Signals Generated

| Signal ID | Source | Condition | Severity |
|---|---|---|---|
| `RUG-001` | Internal DB | Deployer in `known_ruggers` with ≥1 confirmed rug | `critical` |
| `RUG-002` | Internal DB | Deployer in `known_ruggers` with ≥3 confirmed rugs | `critical` |
| `RUG-003` | TokenSniffer | `is_scam: true` returned for this token address | `critical` |
| `RUG-004` | GoPlus address security | `malicious_address: true` for deployer | `critical` |
| `RUG-005` | On-chain heuristic | Deployer wallet funded from known mixer | `high` |
| `RUG-006` | On-chain heuristic | Deployer wallet created < 24h before token launch | `medium` |
| `RUG-007` | On-chain heuristic | LP removed within 7 days of launch | `critical` |

**Score Impact**: Any `critical` signal adds +25 points to the overall risk score.
Multiple `critical` signals stack (no cap at individual signal level — the
overall score is still capped at 100).

---

## 4. UI Display Rules

Results must be displayed as objective facts. The system reports **what
happened**, not judgments:

```
Deployer Risk Assessment:
  Registry Check:    Known to TokenSniffer (is_scam: true)
  Confirmed Rugs:    2 previous tokens (via known_ruggers DB)
  Wallet Age:        Deployed 6 hours before this token
  LP Status:         LP removed 4 days after launch on prior token "FAKETOKEN"
```

No "RUG ALERT" badge in a red flashing box. The facts speak for themselves.
The risk score rise communicates the severity.

**Exception**: A `RUG-001` or `RUG-003` hit (confirmed scam) shows a
non-flashing, clearly visible warning panel at the top of the Deep Scan result:
```
⚠️ Deployer is associated with a previously confirmed scam token.
   See Deployer Risk section below for full details.
```

---

## 5. Caching Strategy

| Lookup Type | Cache TTL | Key |
|---|---|---|
| `known_ruggers` DB lookup | No cache needed — direct DB read | — |
| TokenSniffer API | 24 hours | `tokensniffer:<chain>:<address>` |
| GoPlus address security | 12 hours | `goplus_addr:<address>` |
| On-chain heuristic (LP removed) | 6 hours | `lp_check:<poolAddress>` |

---

## 6. Codebase Integration Points

| File | Change |
|---|---|
| `lib/deep_scan/engines/RiskScoringEngine.ts` | Add RUG-001 → RUG-007 signal ingestion and score weighting |
| `lib/reputation/RugPatternMatcher.ts` | **[NEW]** Orchestrates all 4 data sources, returns `RugMatchResult` |
| `lib/reputation/TokenSnifferClient.ts` | **[NEW]** Typed client for TokenSniffer API with 24h cache |
| `lib/reputation/GoPlusAddressSecurity.ts` | **[NEW]** Extend existing GoPlus integration for address security endpoint |
| `lib/deep_scan/DeepScanService.ts` | Call `RugPatternMatcher` using deployer address from basic scan result |
| `known_ruggers` | **[NEW DB TABLE]** See schema in §2 Source 3 |

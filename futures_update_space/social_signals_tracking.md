# Social Signals & Off-Chain Presence Tracking

This document specifies how the scanner should collect, verify, and surface
social/off-chain metadata for tokens — **without** surfacing speculative
sentiment scores in the UI. The goal is to give professional traders objective
credibility signals, not hype indicators.

---

## 1. Why Social Signals Matter to a Professional Trader

Social metadata is **not** sentiment analysis. It answers objective questions:

| Question | Why It Matters |
|---|---|
| Does the project have a verifiable website? | Rug-pulls typically skip documentation. |
| Is the Twitter account authentic (old account vs new account)? | New accounts are cloned from rugged projects. |
| Is the Telegram invite still alive? | Abandoned communities precede exit scams. |
| Are social links consistent across sources? | Phishing clones use different URLs. |

**Critical UI Rule (Reiterated from `both_scan_update.md`):**
> Social data is displayed as **objective facts** only (e.g. "Twitter account age: 12 days", "Telegram: Active — 4,200 members"). The UI will **never** show "Strong Community" or "Weak Sentiment" badges, which are speculative and damage scanner credibility.

---

## 2. Data Sources & Priority Chain

```
Priority 1: DexScreener metadata  (links already returned in /pairs response)
Priority 2: CoinGecko API         (free /coins/{id} endpoint, includes socials)
Priority 3: Codex API             (metadata block includes socialLinks)
Priority 4: GeckoTerminal         (network/token endpoint, partial socials)
Fallback:   null fields           (never fabricate missing social data)
```

**No web scraping of Twitter/Telegram.** Only query public APIs that return
social links as part of their token metadata response.

---

## 3. Metrics to Extract

### 3A. Link Existence Check (Basic Scan — 2 credits)
Extract and validate the existence of:

```typescript
interface SocialPresenceLinks {
  website: string | null;         // e.g. "https://pepe.vip"
  twitter: string | null;         // e.g. "https://twitter.com/pepecoineth"
  telegram: string | null;        // e.g. "https://t.me/pepecoin"
  discord: string | null;
  github: string | null;
  // Source of these links (which API returned them)
  source: 'dexscreener' | 'coingecko' | 'codex' | 'geckoterminal';
}
```

**Validation Rules:**
- `website`: Must pass HTTP HEAD request (non-4xx). If the domain resolves but
  returns 403/404, mark as `DEAD`.
- `twitter` / `telegram`: Record link existence only — do NOT probe for
  follower count (requires authenticated API).
- `github`: If present, check if the repo has had a commit in the last 90 days
  (GitHub public API, no auth required). Stale repos are a risk signal.

### 3B. Cross-Link Consistency Check (Deep Scan — 10 credits)
Compare social links returned by different providers. If DexScreener returns
`twitter: twitter.com/realPepe` but Codex returns `twitter: twitter.com/pepeclone`,
flag as **INCONSISTENT SOCIAL LINKS** — a strong phishing/clone indicator.

```typescript
interface SocialConsistencyResult {
  consistent: boolean;
  conflicts: Array<{
    field: 'website' | 'twitter' | 'telegram';
    values: Record<string, string>; // { dexscreener: "...", codex: "..." }
  }>;
}
```

### 3C. Creator/Project Activity Age (Deep Scan)
For the deployer wallet's associated social accounts (if retrievable from
Codex or CoinGecko):
- **Twitter Account Age**: Days since account creation.
  - `< 7 days`: BRAND NEW ACCOUNT — extremely high rug risk.
  - `7–30 days`: NEW ACCOUNT.
  - `> 30 days`: Display age in days/months.
- **Website Domain Age**: Query WHOIS API (e.g. `who-dat.as93.net` public endpoint)
  for domain registration date.
  - Domain registered same week as token launch: Flag as `NEW DOMAIN`.

---

## 4. Risk Signals Generated (Backend Only)

These signals feed into `RiskScoringEngine.ts` but are **not labeled** in the UI:

| Signal ID | Condition | Severity |
|---|---|---|
| `SOC-001` | No website AND no Twitter AND no Telegram | `high` |
| `SOC-002` | Twitter account < 7 days old | `high` |
| `SOC-003` | Website domain registered < 7 days ago | `medium` |
| `SOC-004` | Social links inconsistent across providers | `high` |
| `SOC-005` | GitHub repo exists but no commit in 90 days | `low` |
| `SOC-006` | Dead website (HTTP 404/down) | `medium` |

---

## 5. Database Caching Schema

To avoid hammering WHOIS and metadata APIs on every scan, cache social data:

```sql
CREATE TABLE token_social_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_address   TEXT NOT NULL,
  chain           TEXT NOT NULL,

  website         TEXT,
  twitter         TEXT,
  telegram        TEXT,
  discord         TEXT,
  github          TEXT,

  website_alive         BOOLEAN,
  twitter_account_age_days INTEGER,
  website_domain_age_days  INTEGER,
  github_last_commit_days  INTEGER,
  social_consistent     BOOLEAN,
  social_conflicts      JSONB,

  source          TEXT,
  cached_at       TIMESTAMP DEFAULT NOW(),

  UNIQUE(token_address, chain)
);

-- TTL: Refresh social data every 24 hours (not every scan).
-- Index for cleanup job:
CREATE INDEX idx_social_cache_staleness ON token_social_cache(cached_at ASC);
```

**Cache TTL Rule**: Social links are stable. Refresh every **24 hours**, not
every scan. A background job should re-validate `website_alive` every 6 hours
for tokens that are actively being scanned.

---

## 6. UI Display Rules

### Basic Scan Card
```
Social: [Website] [Twitter] [Telegram]
        (greyed out if link is null or dead)
```

### Deep Scan Panel — "Project Presence" Section
```
Website:  https://example.com   Live  (domain: 142 days old)
Twitter:  @exampletoken         Found (account: 23 days old)  -- age shown, not "new"
Telegram: t.me/example          Found
GitHub:   github.com/example    Stale (last commit: 98 days ago)

Link Consistency: All sources agree
```

**No follower counts. No "community score". No sentiment.** Only verifiable facts.

---

## 7. Codebase Integration Points

| File | Change Required |
|---|---|
| `lib/blockchain/tokenScanner.ts` | Add `socialLinks` field to `OnChainData` return type |
| `lib/blockchain/marketDataFallback.ts` | Extract `info.socials` block from DexScreener `/pairs` response |
| `lib/social/SocialMetadataCollector.ts` | **[NEW]** Service that runs priority-chain collection + validation |
| `lib/social/SocialRiskMapper.ts` | **[NEW]** Maps social facts to risk signals (SOC-001 through SOC-006) |
| `lib/deep_scan/DeepScanService.ts` | Call `SocialMetadataCollector` and inject result into `EvidenceMapper` |
| `token_social_cache` | **[NEW DB TABLE]** See schema above |

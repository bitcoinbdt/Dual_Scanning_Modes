# Shareable Scan Results

This document specifies the architecture for generating permanent, shareable
URLs for Basic Scan, Elevator Scan, and Deep Scan results. Each scan result
is snapshotted at the moment it is run, stored in the database, and accessible
via a unique public link — no login required to view a shared result.

---

## 1. The Problem This Solves

Currently, scan results exist only in the user's browser session. There is
no way to:
- Share a token analysis with a trading partner or community
- Reference a scan result at a later time (results disappear on refresh)
- Prove what the scanner showed at a specific point in time (e.g. before a rug)

The shareable link feature turns every scan into a **permanent, timestamped
public record**.

---

## 2. How It Works (User Flow)

```
User runs a scan (Basic / Elevator / Deep)
         │
         ▼
Result is rendered in the UI as normal
         │
         ▼
"Copy Share Link" button appears in the result card
         │
         ▼
User clicks → URL is copied to clipboard:
  https://scanner.app/scan/bs-K9mX2pQr   ← ✅ C-013 RESOLVED (was: /scan/tokenname)

         │
Recipient clicks the link
         ▼
Page loads the stored snapshot from the DB
Renders the exact same result with a banner:
  "Scanned on 16 Aug 2026 at 12:34 UTC"
```


---

## 3. Scan ID & URL Structure

### 3A. Scan ID Format
Each saved scan result receives a **short unique ID** (not a raw UUID — keep
the URL clean and shareable):

```
Format:  [scan_type_prefix]-[8-char nanoid]
Examples:
  bs-K9mX2pQr    (basic scan)
  ev-T4nH8wYz    (elevator scan)
  ds-R2vL5cNj    (deep scan)
```

Use `nanoid` (URL-safe, 8 characters) for the ID segment.

### 3B. Public URL Pattern
```
/scan/[scan-id]
```

Examples:
```
https://scanner.app/scan/bs-K9mX2pQr
https://scanner.app/scan/ev-T4nH8wYz
https://scanner.app/scan/ds-R2vL5cNj
```

### 3C. Referral Code Integration (Viral Loop)
To drive virality and engagement, the generated share link will include the logged-in user's referral code.

* **URL Pattern with Referral**:
  ```
  /scan/[scan-id]?ref=[referral-code]
  ```
  Example: `https://scanner.app/scan/ds-R2vL5cNj?ref=ALPHA123`

* **Click Tracking Logic**:
  1. When a visitor lands on a shared scan page, Next.js server/middleware checks for the `ref` query parameter.
  2. If the parameter is present and matches a valid user referral code in the database, the server sets a **30-day cookie**: `ref_code = [referral-code]`.
  3. When the visitor subsequently creates an account, the sign-up API reads this cookie to credit the referrer automatically, updating the `referrals` and `referral_rewards` tables.

* **No auth required** to view a shared link result.
* If the scan ID does not exist, render a clear 404 page: *"This scan result
  does not exist or has expired."*

---

## 4. What Is Stored (Snapshot Schema)

The snapshot must capture everything needed to re-render the result without
re-running the scan. It is a **frozen point-in-time record**.

```sql
CREATE TABLE scan_snapshots (
  id              TEXT PRIMARY KEY,        -- e.g. "ds-R2vL5cNj"
  scan_type       TEXT NOT NULL,           -- 'basic' | 'elevator' | 'deep'
  token_address   TEXT NOT NULL,
  chain           TEXT NOT NULL,           -- 'solana' | 'eth' | 'bsc' | etc.
  token_symbol    TEXT,
  token_name      TEXT,

  -- The complete result payload, serialized
  result_json     JSONB NOT NULL,          -- Full scan result (as returned by API)

  -- Ownership (optional — for "my scans" history later)
  user_id         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Timestamps
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,             -- NULL = never expires (see §5)

  -- Sharing metadata
  view_count      INTEGER NOT NULL DEFAULT 0,
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT valid_scan_type CHECK (scan_type IN ('basic', 'elevator', 'deep'))
);

-- Fast lookup by token for "recent scans on this token" feature (future)
CREATE INDEX idx_snapshot_token ON scan_snapshots(token_address, chain, scanned_at DESC);

-- Fast lookup by user for "my scan history" feature (future)
CREATE INDEX idx_snapshot_user ON scan_snapshots(user_id, scanned_at DESC);
```

---

## 5. Expiry Policy

| Scan Type | Retention Period | Reason |
|---|---|---|
| Basic Scan | 7 days | Lightweight, run frequently |
| Elevator Scan | 30 days | Mid-weight, more contextual |
| Deep Scan | 90 days | High-value, expensive to run — users expect to reference it |

> After expiry, the snapshot row is soft-deleted (set `is_public = false`).
> The ID remains in the table for 30 additional days so the URL returns
> *"This scan has expired"* rather than a generic 404.

---

## 6. UI Design

### 6A. Share Button Location
The share button appears in the **result header** of each scan type,
immediately after the scan completes:

```
┌─────────────────────────────────────────────────────┐
│  PEPE / 0x6982...f5d2          [Ethereum]           │
│  Basic Scan Result                                  │
│                           [ 📋 Copy Share Link ]   │
│  Scanned: 16 Aug 2026, 12:34 UTC                   │
└─────────────────────────────────────────────────────┘
```

### 6B. Shared Result Banner
When a visitor opens a shared URL (not the scan owner), a non-intrusive
banner appears at the top of the result:

```
┌─────────────────────────────────────────────────────┐
│  📸  Snapshot  ·  Scanned on 16 Aug 2026 at 12:34  │
│  UTC by a user of OnChain Alpha Scanner             │
│  This result reflects data at the time of scanning. │
└─────────────────────────────────────────────────────┘
```

Key details:
- **Timestamp is always shown** on shared views (UTC, ISO-readable format)
- No "Run New Scan" CTA inside the banner — this is placed separately in the
  page footer to avoid distracting from the shared result
- A subtle "View live data →" link next to the token name lets the viewer
  run a fresh scan on the same token

### 6C. Copy Behavior
```
User clicks "Copy Share Link"
  ├── URL copied to clipboard
  ├── Button text changes to "✅ Copied!" for 2 seconds
  └── Button reverts to "📋 Copy Share Link"
```

No modal, no popup. Immediate clipboard action.

---

## 7. API Endpoints

### 7A. Save Snapshot (called internally after scan completes)
```
POST /api/scan/snapshot
Body: {
  scan_type: 'basic' | 'elevator' | 'deep',
  token_address: string,
  chain: string,
  result: object  // Full scan result
}
Response: {
  snapshot_id: string,  // e.g. "ds-R2vL5cNj"
  share_url: string     // Full absolute URL
}
```

This endpoint is called **automatically** whenever a scan completes. The user
does not need to manually "save" a result. The share button is always ready.

> ✅ **NEW-010 RESOLVED — Snapshot Save Resilience**
>
> **Problem**: No spec for what happens if `saveSnapshot()` fails (DB down, timeout, etc).
>
> **Resolution**: `saveSnapshot()` is always called inside a non-blocking `try/catch`.
> A snapshot failure **never prevents the scan result from being returned to the user**.
> ```typescript
> // In scan API routes (basic, elevator, deep):
> const scanResult = await runScan(input);
>
> // Fire-and-forget snapshot — result is returned immediately regardless
> void saveSnapshot(scanType, scanResult).catch(err => {
>   console.error('[SNAPSHOT] Save failed (non-fatal):', err.message);
>   // Do not rethrow — never block the user response
> });
>
> return NextResponse.json(scanResult); // Always returned
> ```
> - If the snapshot save fails, the share button is hidden on the frontend (since no ID was returned).
> - The scan result itself is always shown to the user.
> - Snapshot failures are logged for ops monitoring but require no user-facing error message.


### 7B. Fetch Snapshot (public, no auth)
```
GET /api/scan/snapshot/[id]
Response: {
  snapshot_id: string,
  scan_type: string,
  token_address: string,
  token_symbol: string,
  token_name: string,
  chain: string,
  scanned_at: string,   // ISO 8601 UTC
  expires_at: string | null,
  result: object        // Same shape as live scan result
}
```

### 7C. Page Route (Next.js)
```
app/scan/[id]/page.tsx    -- Server-side rendered shared result page
```

The page must:
1. Fetch the snapshot server-side (SSR) for SEO and fast load
2. Render the shared result banner
3. Render the standard result UI components in a read-only mode
4. Include Open Graph meta tags for link preview when shared on Telegram/Twitter

---

## 8. Open Graph Meta Tags (Link Preview)

When a shared scan URL is posted in Telegram or Twitter, the link unfurls
with a meaningful preview:

```html
<meta property="og:title"       content="PEPE Deep Scan — OnChain Alpha" />
<meta property="og:description" content="Deep Scan result for PEPE (Ethereum). Risk Score: 24/100 · Scanned 16 Aug 2026 12:34 UTC" />
<meta property="og:image"       content="/api/og/scan/ds-R2vL5cNj" />
<meta property="og:url"         content="https://scanner.app/scan/ds-R2vL5cNj" />
```

The OG image (`/api/og/scan/[id]`) is a dynamically generated image using
`@vercel/og` or `satori` — renders a clean card showing:
- Token name + symbol + chain
- Scan type
- Key metrics (e.g. Risk Score, Liquidity, Holders)
- Timestamp

---

## 9. Codebase Integration Points

| File | Change |
|---|---|
| `app/api/scan/basic/route.ts` | After `scanToken()` resolves, call `saveSnapshot('basic', result)` |
| `app/api/scan/elevator/route.ts` | After elevator scan resolves, call `saveSnapshot('elevator', result)` |
| `app/api/scan/deep/route.ts` | After deep scan resolves, call `saveSnapshot('deep', result)` |
| `app/api/scan/snapshot/route.ts` | **[NEW]** POST handler to save snapshot |
| `app/api/scan/snapshot/[id]/route.ts` | **[NEW]** GET handler to retrieve snapshot |
| `app/scan/[id]/page.tsx` | **[NEW]** SSR page for shared scan result |
| `app/api/og/scan/[id]/route.ts` | **[NEW]** Dynamic OG image generator |
| `lib/snapshots/snapshotService.ts` | **[NEW]** `saveSnapshot()` and `getSnapshot()` helpers |
| `lib/snapshots/nanoid.ts` | **[NEW]** Prefix-aware ID generator (`bs-`, `ev-`, `ds-`) |
| `scan_snapshots` | **[NEW DB TABLE]** See schema in §4 |

---

## 10. Important Design Decisions

### No Re-execution on Shared Links
The shared URL **never re-runs the scan**. It loads the stored snapshot.
This is intentional:
- Reproducibility: the viewer sees exactly what the sharer saw
- Cost: no credits are consumed when viewing a shared result
- Trust: the result cannot change between share and view

### Credits Are NOT Charged for Viewing Shared Results
Only the original scan execution costs credits. Viewing a shared URL is free
for anyone, including unauthenticated visitors.

### Timestamps Always in UTC
Never show relative time (e.g. "3 hours ago") on shared results, because the
recipient may view the link days later — relative time becomes misleading.

---

## 11. Technical Feasibility, Cost & Implementation Details

### A. Database Storage & Cost
- **Storage Profile**: A basic scan payload is ~3KB. An elevator scan payload is ~15KB. A deep scan payload is ~40KB.
  - If we run 500 deep scans/day, that is $500 \times 40\text{KB} = 20\text{MB}$ of database storage per day, or ~$600\text{MB}$ per month.
  - **Feasibility**: **Highly Feasible**. Supabase's free tier provides 500MB, and the $5/month Pro tier provides 8GB (which is enough for over a year of active scan records).
  - **Pruning**: A simple PostgreSQL cron job can prune expired basic and elevator scans (e.g., `DELETE FROM scan_snapshots WHERE expires_at < NOW()`) to keep DB size compact.

### B. Nanoid Collision Analysis
- **Mechanism**: Using a custom alphabet (`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`) with length 8.
- **Collision probability**: With 8 characters, there are $62^8 \approx 218\text{ trillion}$ unique combinations. At 1,000 scans per second, it would take roughly 100 years to have a 1% chance of a single collision. Adding prefix identifiers (`bs-`, `ev-`, `ds-`) reduces this to zero.
  - **Feasibility**: **Highly Feasible**.

### C. Server-Side Rendering (SSR) Latency & OG Generation
- **SSR Page**: Next.js Server Components query the `scan_snapshots` table via primary key indexing. Primary key index hits retrieve in $<5\text{ms}$.
  - **Feasibility**: **Highly Feasible**. The page will load as fast as a static page (under 100ms total network roundtrip).
- **Open Graph API**: `@vercel/og` uses Satori to render HTML/CSS to SVG/PNG at the edge. The first request takes ~150ms, and subsequent requests are cached via CDN (Edge Cache) for 0ms backend load.
  - **Feasibility**: **Highly Feasible**.
  - **Cost**: $0 (Runs within free-tier serverless limits).


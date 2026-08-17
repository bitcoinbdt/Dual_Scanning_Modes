# AI Intelligence Layer for Deep Scan

This document specifies the AI sub-system that enhances Deep Scan with two
capabilities: **Exchange Listing Intelligence** (scraping exchange announcement
feeds to detect past and upcoming listings) and **News Aggregation with
AI-written Summaries** (finding recent coverage and distilling it into a
single structured briefing).

AI is introduced here as an isolated, optional intelligence layer — it does not
replace any existing engine, and its outputs are clearly labeled as
AI-generated in the UI. This architecture also lays the foundation for the
future **Agent** feature, where the same AI layer will operate autonomously.

---

## 1. AI Provider Configuration

### 1A. Model Hierarchy

Two providers are configured. The system always attempts the primary first.
If the primary rate-limits, times out, or returns an error, it falls back to
the secondary automatically:

| Role | Provider | Model | Free Tier Limit |
|---|---|---|---|
| **Primary** | Google Gemini | `gemini-2.0-flash` | 1,500 requests/day, 1M tokens/min |
| **Fallback** | Groq | `llama-3.3-70b-versatile` | 14,400 requests/day, 30K tokens/min |

**Why these two**:
- **Gemini 2.0 Flash** has the most generous free tier of any frontier model,
  fast response times, strong web-grounded reasoning, and native Google Search
  tool use — ideal for news and announcement research.
- **Groq + Llama 3.3 70B** provides near-instant inference on a very large
  free quota. It does not have native web search but handles structured
  extraction and summarization tasks extremely well.

### 1B. Environment Variables

```bash
# Primary — Google Gemini
GEMINI_API_KEY=<your_key>

# Fallback — Groq
GROQ_API_KEY=<your_key>
```

Both keys must be in `.env.local` and accessed via `process.env` only.
Never hardcode or log these values.

### 1C. AI Provider Abstraction Layer

All AI calls go through a single abstraction so the rest of the codebase
never knows which provider was used:

```typescript
// lib/ai/aiProvider.ts

export interface AIMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  provider: 'gemini' | 'groq';
  modelUsed: string;
  tokensUsed?: number;
}

export async function runAIQuery(
  messages: AIMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
    useWebSearch?: boolean;  // Gemini only — Groq fallback ignores this
  }
): Promise<AIResponse> {
  // 1. Try Gemini primary
  // 2. On failure, try Groq fallback
  // 3. On both failures, return { text: '', provider: 'none', modelUsed: 'none' }
  //    — AI failure must NEVER crash the Deep Scan result
}
```

**Non-blocking guarantee**: If both providers fail, the Deep Scan result is
returned as normal without AI sections. The UI shows:
```
AI Intelligence: Unavailable (provider error — please try again later)
```

---

## 2. Feature 1 — Exchange Listing Intelligence

### 2A. What This Does

When a user runs a Deep Scan, the AI sub-system searches major exchange
announcement feeds for any mention of the scanned token (by **name** or
**contract address**). It returns:

- Whether the token is **listed** and on which exchange(s)
- The **listing date** for each exchange
- The **opening price, day-low, and day-high** on listing day
- If the token is **not yet listed but an announcement exists** — an
  "Upcoming Listing" card with the announced date

### 2B. Exchange Announcement URL Registry

Maintain a static, versioned registry of exchange announcement feed URLs.
These are public RSS feeds, blog listing pages, or structured announcement
endpoints:

```typescript
// lib/ai/exchangeRegistry.ts

export const EXCHANGE_ANNOUNCEMENT_FEEDS: ExchangeFeed[] = [
  {
    name: 'Binance',
    logoUrl: '/logos/exchanges/binance.png',
    announcementUrl: 'https://www.binance.com/en/support/announcement/new-cryptocurrency-listing',
    feedType: 'html_list',   // Parse article links from HTML
  },
  {
    name: 'Coinbase',
    logoUrl: '/logos/exchanges/coinbase.png',
    announcementUrl: 'https://www.coinbase.com/blog/listing-category',
    feedType: 'html_list',
  },
  {
    name: 'OKX',
    logoUrl: '/logos/exchanges/okx.png',
    announcementUrl: 'https://www.okx.com/help/en/section/announcements-new-listings',
    feedType: 'html_list',
  },
  {
    name: 'Bybit',
    logoUrl: '/logos/exchanges/bybit.png',
    announcementUrl: 'https://announcements.bybit.com/en/?category=new_crypto',
    feedType: 'html_list',
  },
  {
    name: 'KuCoin',
    logoUrl: '/logos/exchanges/kucoin.png',
    announcementUrl: 'https://www.kucoin.com/news/categories/listing',
    feedType: 'html_list',
  },
  {
    name: 'Gate.io',
    logoUrl: '/logos/exchanges/gate.png',
    announcementUrl: 'https://www.gate.io/en/article/listing',
    feedType: 'html_list',
  },
  {
    name: 'MEXC',
    logoUrl: '/logos/exchanges/mexc.png',
    announcementUrl: 'https://www.mexc.com/en-US/support/categories/360000178252',
    feedType: 'html_list',
  },
  {
    name: 'HTX (Huobi)',
    logoUrl: '/logos/exchanges/htx.png',
    announcementUrl: 'https://www.htx.com/support/en-us/list/360000070121',
    feedType: 'html_list',
  },
  {
    name: 'BingX',
    logoUrl: '/logos/exchanges/bingx.png',
    announcementUrl: 'https://bingx.com/en/support/articles/listing/',
    feedType: 'html_list',
  },
  {
    name: 'LBank',
    logoUrl: '/logos/exchanges/lbank.png',
    announcementUrl: 'https://support.lbank.com/hc/en-gb/categories/360000051842-New-Listings',
    feedType: 'html_list',
  },
  {
    name: 'Bitget',
    logoUrl: '/logos/exchanges/bitget.png',
    announcementUrl: 'https://www.bitget.com/en/support/articles/listing',
    feedType: 'html_list',
  },
  {
    name: 'Crypto.com Exchange',
    logoUrl: '/logos/exchanges/cryptocom.png',
    announcementUrl: 'https://help.crypto.com/en/collections/3571874-crypto-com-exchange-new-listings',
    feedType: 'html_list',
  },
];
```

**Registry is versioned** — stored in a TypeScript constant (not DB) so it can
be maintained via code review. Add new exchanges by appending to this array.

### 2C. AI Prompt: Exchange Listing Search

The AI receives the announcement URL list and the token details, then performs
a focused web search using Gemini's Google Search grounding:

```
System:
  You are a crypto exchange listing researcher. Your job is to find factual
  listing information for a specific token on major cryptocurrency exchanges.
  Only return information you can verify from official exchange announcement
  pages or financial data sources. Do not speculate or fabricate data.

User:
  Token Name: {tokenName}
  Token Symbol: {tokenSymbol}
  Contract Address: {tokenAddress}
  Chain: {chain}

  Search the following exchange announcement pages for this token:
  {exchangeAnnouncementUrls}

  For each exchange where you find a listing, return:
  1. Exchange name
  2. Listing date (exact date in YYYY-MM-DD format, UTC if available)
  3. Opening price on listing day (USD)
  4. Day-low on listing day (USD)
  5. Day-high on listing day (USD)
  6. Announcement URL (the specific article URL, not the category page)
  7. Status: 'listed' or 'upcoming'
  8. If 'upcoming': the announced listing date

  If the token is not mentioned on any of these exchanges, return an empty
  exchanges array.

  Return ONLY valid JSON in this exact shape:
  {
    "exchanges": [
      {
        "name": "Binance",
        "status": "listed",
        "listingDate": "2024-11-15",
        "openPrice": 0.000412,
        "dayLow": 0.000380,
        "dayHigh": 0.000521,
        "announcementUrl": "https://..."
      }
    ]
  }
```

**Groq fallback**: Groq does not have web search. When Groq is used, the
system pre-fetches announcement page content (via server-side HTTP fetch) and
passes the raw text to Groq for extraction. The AI prompt becomes an
extraction task rather than a search task.

#### ✅ C-010 RESOLVED — Groq Fallback Fails on JS-Rendered Exchange Pages

**Problem was**: Most exchange announcement pages (Binance, Coinbase, Bybit)
are JavaScript SPA applications. Plain `axios.get()` returns an empty HTML
shell without any listing articles — the content is populated client-side
by JavaScript, which server-side fetch cannot execute.

**Resolution — Gemini-Only for Listing Search**:
- **Exchange listing search is Gemini-only**. Groq does NOT serve as a fallback
  for listing searches — it cannot reliably scrape JS-rendered pages.
- If Gemini is unavailable, the Exchange Listing section returns:
  ```
  CEX Listings: Unavailable (AI provider error — please retry)
  ```
- This is acceptable because listing data is cached for 6 hours. If the cache
  is warm, the user gets cached data. Only a cache miss + Gemini failure shows
  the unavailable message.

**Groq fallback scope is limited to**:
- **News aggregation only** — news articles are indexed by Google and return
  in Gemini's search grounding. For Groq, we fetch RSS feeds from crypto news
  sites (CoinDesk, CoinTelegraph, Decrypt all provide public RSS) — RSS is
  plain XML, not JS-rendered.
  ```typescript
  // Groq fallback: fetch public RSS feeds instead of exchange HTML pages
  const RSS_FEEDS = [
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'https://cointelegraph.com/rss',
    'https://decrypt.co/feed',
  ];
  // Filter RSS articles by token name/symbol — no JS rendering needed
  ```


### 2D. UI Display: Exchange Listing Section (Deep Scan)

```
CEX Listings:
┌─────────────────────────────────────────────────────────────┐
│  [Binance logo]  Binance                Listed              │
│  Listed: 15 Nov 2024                                        │
│  Open: $0.000412   Low: $0.000380   High: $0.000521        │
│  [View Announcement →]                                      │
├─────────────────────────────────────────────────────────────┤
│  [OKX logo]  OKX                        Upcoming            │
│  Announced: Listing on 22 Aug 2026                          │
│  [View Announcement →]                                      │
└─────────────────────────────────────────────────────────────┘

  AI-generated · Sourced from official exchange announcements
  Last searched: 16 Aug 2026, 20:39 UTC
```

Key UI rules:
- Exchange logo is displayed alongside the exchange name
- **Listed** status: shows date + OHLCV data from listing day
- **Upcoming** status: shows "Upcoming Listing" badge + announced date
- "AI-generated" label is always shown — transparency about data source
- If no listings found: *"No CEX listings detected on searched exchanges."*
- Never display listing data without a verifiable announcement URL

---

## 3. Feature 2 — Recent News Aggregation (7-Day Window)

### 3A. What This Does

The AI searches for recent news coverage of the token published within the
**last 7 days**. For each news item found, it provides:
- Article title
- Source domain (e.g. `coindesk.com`)
- Publication date
- Direct URL

Then, **the AI itself writes a single structured briefing** summarizing all
found articles — so the user does not need to open each link individually.

### 3B. AI Prompt: News Search

```
System:
  You are a crypto news researcher. Your job is to find real, published news
  articles about a specific token from the last 7 days. Only return articles
  that are genuinely about this specific token, not tangentially related.
  Do not fabricate articles. If no news exists, say so clearly.

User:
  Token Name: {tokenName}
  Token Symbol: {tokenSymbol}
  Contract Address: {tokenAddress}
  Date Range: {today - 7 days} to {today} (UTC)

  Search for recent news articles about this token published in the last 7 days.

  Return:
  1. A JSON array of all articles found, in this exact shape:
  {
    "articles": [
      {
        "title": "Article headline exactly as published",
        "source": "coindesk.com",
        "publishedAt": "2026-08-14T10:30:00Z",
        "url": "https://..."
      }
    ],
    "summary": "A 3–5 sentence summary written by you covering the main
                themes across all found articles. Be factual and neutral.
                If articles conflict with each other, note the conflict.
                Do not recommend buying or selling. End with one sentence
                identifying the most important risk or development for
                a trader to be aware of."
  }

  If no articles are found, return:
  {
    "articles": [],
    "summary": "No news coverage found for this token in the last 7 days."
  }
```

### 3C. News Summary Rules (AI Writing Guidelines in Prompt)

The `summary` field must follow these rules (enforced in the prompt):
- **3–5 sentences** — no longer, no shorter
- **Factual and neutral** — no price predictions, no buy/sell language
- **Conflict disclosure** — if two articles say opposite things, note it
- **Trader-relevant close** — final sentence identifies the single most
  important development or risk a trader should know right now
- **No hyperlinks inside the summary** — raw prose only

### 3D. UI Display: News Intelligence Section (Deep Scan)

```
News Intelligence  ·  Last 7 days  ·  4 articles found

  AI Summary:
  ┌──────────────────────────────────────────────────────────┐
  │  PEPE saw renewed mainstream media coverage this week    │
  │  following a partnership announcement with a payments    │
  │  platform on 13 Aug. Three separate outlets reported     │
  │  the development positively, though one noted concerns   │
  │  about the partnership's unverified on-chain activity.   │
  │  The most important development for traders: team wallet │
  │  movement of 2B tokens was flagged by Lookonchain on     │
  │  15 Aug — this has not yet been publicly addressed.      │
  └──────────────────────────────────────────────────────────┘

  Sources (tap to open):
  ├── "Pepe Partners With PayLink for Merchant Payments"
  │     coindesk.com · 13 Aug 2026  [→]
  ├── "Meme Coins Surge: PEPE Leads Weekly Gains"
  │     cointelegraph.com · 14 Aug 2026  [→]
  ├── "Analysis: PEPE Team Wallet Shows Unusual Movement"
  │     decrypt.co · 15 Aug 2026  [→]
  └── "PEPE Listing Confirmed for KuCoin"
        cryptonews.com · 16 Aug 2026  [→]

  AI-generated summary · Article links are sourced, not fabricated
  Searched: 16 Aug 2026, 20:39 UTC
```

Key UI rules:
- AI Summary is shown **above** the links (saves the user from reading
  articles to understand the landscape)
- Each link shows: **title** (exact as published) + **source domain** + **date**
- "AI-generated summary" label always present
- Articles are sorted by date, newest first
- If 0 articles found: show the summary ("No news coverage...") without the
  sources list
- Maximum 10 articles displayed in the UI. If AI returns more, truncate to
  the 10 most recent and show: *"+N more articles not shown"*

---

## 4. AI Module Architecture

### 4A. Module Directory Structure

```
lib/
└── ai/
    ├── aiProvider.ts           # Primary/fallback orchestrator
    ├── geminiClient.ts         # Google Gemini API client
    ├── groqClient.ts           # Groq API client (fallback)
    ├── exchangeRegistry.ts     # Static exchange URL registry
    ├── ExchangeListingAgent.ts # Feature 1: listing research
    ├── NewsAgent.ts            # Feature 2: news aggregation + summary
    └── types.ts                # Shared AI result types
```

### 4B. Shared Types

```typescript
// lib/ai/types.ts

export interface ExchangeListing {
  name: string;
  logoUrl: string;
  status: 'listed' | 'upcoming';
  listingDate: string | null;         // YYYY-MM-DD
  upcomingDate: string | null;        // YYYY-MM-DD if upcoming
  openPrice: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  announcementUrl: string;
}

export interface NewsArticle {
  title: string;
  source: string;                     // domain only, e.g. "coindesk.com"
  publishedAt: string;                // ISO 8601 UTC
  url: string;
}

export interface AINewsResult {
  articles: NewsArticle[];
  summary: string;
  provider: 'gemini' | 'groq' | 'none';
  searchedAt: number;                 // Unix timestamp
  status: 'ok' | 'no_results' | 'error';
}

export interface AIExchangeResult {
  exchanges: ExchangeListing[];
  provider: 'gemini' | 'groq' | 'none';
  searchedAt: number;
  status: 'ok' | 'no_results' | 'error';
}
```

### 4C. Integration with DeepScanService

AI results are appended to the Deep Scan result **after** all deterministic
engines complete. AI runs **concurrently** with the risk scoring post-processing
to avoid adding latency:

```typescript
// In DeepScanService.ts (conceptual — no code change yet)
const [deterministicResult, aiResults] = await Promise.allSettled([
  runDeterministicEngines(input),
  Promise.all([
    ExchangeListingAgent.run(tokenName, tokenSymbol, tokenAddress, chain),
    NewsAgent.run(tokenName, tokenSymbol, tokenAddress),
  ])
]);
```

AI failures (rejected promise) are caught and set to the error state —
they never block the deterministic Deep Scan result from being returned.

### 4D. Caching

AI queries are expensive and slow. Cache aggressively:

```sql
CREATE TABLE ai_scan_cache (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_address TEXT NOT NULL,
  chain         TEXT NOT NULL,
  query_type    TEXT NOT NULL,   -- 'exchange_listing' | 'news'

  result_json   JSONB NOT NULL,
  provider_used TEXT NOT NULL,   -- 'gemini' | 'groq'

  cached_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,

  UNIQUE(token_address, chain, query_type)
);

CREATE INDEX idx_ai_cache_expiry ON ai_scan_cache(expires_at ASC);
```

| Query Type | Cache TTL | Reason |
|---|---|---|
| Exchange Listing | 6 hours | Listings are announced in advance; data is stable |
| Upcoming Listing | 1 hour | Status can change closer to listing date |
| News | 2 hours | News is time-sensitive but not second-by-second |

---

## 5. Agent Feature Foundation

This AI layer is designed to be **Agent-ready**. The same `ExchangeListingAgent`
and `NewsAgent` can later be invoked autonomously by an Agent orchestrator
without modification. To support this:

- Every agent function is **stateless** and accepts explicit input parameters
  (no reliance on HTTP request context)
- Every agent returns a typed, serializable result object
- Agents report their own `status` ('ok' / 'error') — no exceptions bubble up
- The `aiProvider.ts` abstraction means the agent can be swapped to any model
  without changing agent logic

Future agent capabilities that will use this same infrastructure:
- Portfolio monitoring agent (watches a set of tokens and alerts on news/listings)
- Pre-launch research agent (autonomous pre-scan of trending launchpad tokens)
- Unlock calendar agent (monitors vesting schedules and surfaces alerts)

---

## 6. Codebase Integration Points

| File | Change |
|---|---|
| `lib/ai/aiProvider.ts` | **[NEW]** Primary/fallback orchestrator |
| `lib/ai/geminiClient.ts` | **[NEW]** Gemini 2.0 Flash client with Google Search grounding |
| `lib/ai/groqClient.ts` | **[NEW]** Groq Llama 3.3 70B client |
| `lib/ai/exchangeRegistry.ts` | **[NEW]** Static exchange announcement URL registry |
| `lib/ai/ExchangeListingAgent.ts` | **[NEW]** Exchange listing research agent |
| `lib/ai/NewsAgent.ts` | **[NEW]** News aggregation + summary agent |
| `lib/ai/types.ts` | **[NEW]** Shared AI result types |
| `lib/deep_scan/DeepScanService.ts` | **[MODIFY]** Add concurrent AI call after deterministic engines |
| `lib/deep_scan/types.ts` | **[MODIFY]** Add `aiIntelligence: AIIntelligenceResult` to `DeepScanResult` |
| `ai_scan_cache` | **[NEW DB TABLE]** See schema in §4D |
| `.env.local` | Add `GEMINI_API_KEY` and `GROQ_API_KEY` |

---

## 7. Technical Feasibility, Cost & Implementation Details

### A. API Call Costs (Token Math)
Running AI models is often perceived as expensive. Let's calculate the exact token costs:

1. **Gemini 2.0 Flash (Primary)**:
   - **Free tier**: 15 RPM (Requests Per Minute), 1,500 requests per day.
   - **Paid tier**: $0.075 per 1M input tokens, $0.30 per 1M output tokens.
   - **Usage per scan**:
     - Input: 2,000 tokens (prompts + schemas) $\approx \$0.00015$
     - Output: 350 tokens (structured JSON result) $\approx \$0.00010$
     - Total: **$0.00025** per scan. This means $4,000$ scans cost exactly **$1.00**.
   - **Feasibility**: **Highly Feasible**. Extremely cost-effective.

2. **Groq Llama 3.3 70B (Fallback)**:
   - **Usage**: Free for standard developer API keys (subject to standard daily limits).
   - **Cost**: **$0.00** per scan.

### B. Latency & Run Heuristics
- **Gemini Search Grounding Latency**: When Gemini runs web search, the API request takes between **1.8s to 3.0s** to resolve.
- **Deep Scan Runtime**: The standard deterministic Deep Scan completes in ~1.5s.
- **Optimization**: To prevent AI from slowing down the user experience:
  - We run AI queries asynchronously using `Promise.allSettled` in the backend.
  - We use the `ai_scan_cache` table to store results (TTL 2 hours for news, 6 hours for listings). If a token has been scanned recently, the cache returns the AI result in $<5\text{ms}$.
  - If a cache miss occurs, the page renders the deterministic metrics first, and the AI panel updates dynamically via a client-side polling/WebSocket connection, keeping the initial load fast.
- **Feasibility**: **Highly Feasible**.


# UI Specification Prompt - Crypto Token Intelligence Dashboard

## 🎯 Project Overview

Create a modern web-based dashboard for analyzing early-stage cryptocurrency tokens. The system displays intelligence data collected from blockchain APIs, showing wallet distributions, transaction patterns, whale behavior, and manipulation detection signals.

---

## 📊 Core Data Structure

The UI will consume JSON files with this structure:

```json
{
  "token": {
    "name": "BONK",
    "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "chain": "SOL"
  },
  "wallets": [
    {
      "address": "4TYF8iW8bXET9C8aFgJoiUHhNtpBg5bqRsxSptCExvz7",
      "balance": 17944937828,
      "total_in": 17944937828,
      "total_out": 0,
      "tx_count": 1
    }
  ],
  "holders": [...],
  "transactions": [...],
  "metrics": {
    "W5_whale_count": 15,
    "RF17_wash_trading": true
  }
}
```

---

## 🎨 UI Components Required

### 1. **Dashboard Header**
**Purpose**: Token identification and quick stats

**Elements**:
- Token name (large, bold)
- Token address (truncated with copy button)
- Chain badge (SOL/ETH)
- Last updated timestamp
- Refresh button

**Design**:
```
┌─────────────────────────────────────────────────────┐
│  🪙 BONK                          Chain: [SOL]      │
│  DezXAZ8z7...B1pPB263  📋                          │
│  Last updated: 2 hours ago        🔄 Refresh       │
└─────────────────────────────────────────────────────┘
```

---

### 2. **Key Metrics Cards**
**Purpose**: At-a-glance intelligence summary

**Cards** (4 cards in a row):

**Card 1: Wallet Stats**
- Total wallets
- Total holders (balance > 0)
- Holder percentage

**Card 2: Whale Activity**
- Whale count (W5 metric)
- Top holder percentage
- Whale concentration indicator

**Card 3: Transaction Volume**
- Total transactions
- Unique traders
- Avg transactions per wallet

**Card 4: Risk Signals**
- Wash trading flag (RF17)
- Risk level badge (LOW/MEDIUM/HIGH)
- Red flags count

**Design**:
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 1,294    │ │ 15       │ │ 5,041    │ │ ⚠️ HIGH  │
│ Wallets  │ │ Whales   │ │ Txs      │ │ Risk     │
│ 394 hold │ │ 17.9B    │ │ 1,319    │ │ RF17: ✓  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

### 3. **Whale Tracker Table**
**Purpose**: Identify and monitor large holders

**Columns**:
1. Rank (#1, #2, #3...)
2. Wallet Address (truncated, clickable)
3. Balance (formatted with token symbol)
4. % of Supply
5. Total In (formatted)
6. Total Out (formatted)
7. Net Flow (In - Out)
8. Transaction Count
9. Behavior Tag (Accumulator/Distributor/Trader/Bot)

**Features**:
- Sortable columns
- Search/filter by address
- Export to CSV
- Color coding:
  - 🟢 Green: Net buyers (total_in > total_out)
  - 🔴 Red: Net sellers (total_out > total_in)
  - 🟡 Yellow: Balanced (similar in/out)

**Design**:
```
┌────────────────────────────────────────────────────────────────┐
│ Top Whales                                    [Search] [Export]│
├────┬──────────────┬─────────────┬──────┬──────────┬───────────┤
│ #  │ Address      │ Balance     │ %    │ Net Flow │ Behavior  │
├────┼──────────────┼─────────────┼──────┼──────────┼───────────┤
│ 1  │ 4TYF8iW8...  │ 17.9B BONK  │ 1.8% │ +17.9B   │ 🟢 Accum  │
│ 2  │ 6oFWm7KPL... │ 8.5B BONK   │ 0.9% │ +2.1B    │ 🟡 Trader │
│ 3  │ MfDuWeqSH... │ 1.4B BONK   │ 0.1% │ +1.4B    │ 🟢 Accum  │
└────┴──────────────┴─────────────┴──────┴──────────┴───────────┘
```

---

### 4. **Transaction Timeline**
**Purpose**: Visualize trading activity over time

**Chart Type**: Line chart with dual Y-axis
- Left Y-axis: Transaction count
- Right Y-axis: Volume (in tokens)
- X-axis: Time (hourly buckets)

**Features**:
- Hover tooltip showing exact values
- Zoom/pan controls
- Toggle between transaction count and volume
- Highlight suspicious spikes (>3 std dev)

**Design**:
```
Transactions Over Time
┌─────────────────────────────────────────────┐
│                                    ╱╲       │
│                                   ╱  ╲      │
│                      ╱╲          ╱    ╲     │
│         ╱╲          ╱  ╲        ╱      ╲    │
│        ╱  ╲        ╱    ╲      ╱        ╲   │
│  ─────╱────╲──────╱──────╲────╱──────────╲──│
│  0h   6h   12h   18h    24h   30h       36h │
└─────────────────────────────────────────────┘
```

---

### 5. **Holder Distribution Chart**
**Purpose**: Visualize token concentration

**Chart Type**: Pie chart or Donut chart

**Segments**:
- Top 1 holder
- Top 2-10 holders
- Top 11-50 holders
- Top 51-100 holders
- Others

**Features**:
- Hover to see exact percentages
- Click segment to filter whale table
- Gini coefficient display (concentration metric)

**Design**:
```
Token Distribution
┌─────────────────────┐
│        ╱─────╲      │
│       │   1   │     │  🔴 Top 1: 17.9%
│       │  ╱─╲  │     │  🟠 Top 2-10: 35.2%
│       │ │ 2 │ │     │  🟡 Top 11-50: 28.1%
│       │  ╲─╱  │     │  🟢 Others: 18.8%
│        ╲─────╱      │
│                     │  Gini: 0.72 (High)
└─────────────────────┘
```

---

### 6. **Wash Trading Detector Panel**
**Purpose**: Display manipulation detection results

**Elements**:
- RF17 Status Badge (✓ Detected / ✗ Not Detected)
- Confidence Score (0-100%)
- Evidence List:
  - Round-trip patterns detected
  - Wallet pairs involved
  - Volume cycled
  - Time windows

**Features**:
- Expandable evidence details
- Link to involved wallet addresses
- Export evidence report

**Design**:
```
┌─────────────────────────────────────────────────────┐
│ 🚨 Wash Trading Detection                           │
├─────────────────────────────────────────────────────┤
│ Status: [DETECTED] ✓        Confidence: 87%         │
│                                                      │
│ Evidence:                                            │
│ • 3 round-trip patterns found                        │
│ • Wallets: 93U65rT9t ↔ 6oFWm7KPL                    │
│ • Volume cycled: 1.2B BONK                           │
│ • Time window: 6h - 18h                              │
│                                                      │
│ [View Details] [Export Report]                      │
└─────────────────────────────────────────────────────┘
```

---

### 7. **Transaction Feed**
**Purpose**: Real-time transaction list

**Columns**:
1. Timestamp (relative: "2h ago")
2. Type (BUY/SELL badge)
3. From Address (truncated)
4. To Address (truncated)
5. Amount (formatted)
6. Transaction Hash (link to explorer)

**Features**:
- Infinite scroll or pagination
- Filter by type (buy/sell)
- Filter by wallet address
- Search by transaction hash
- Color coding: 🟢 Buy / 🔴 Sell

**Design**:
```
┌────────────────────────────────────────────────────────────┐
│ Recent Transactions                    [Filter ▼] [Search] │
├──────────┬──────┬──────────────┬──────────────┬───────────┤
│ Time     │ Type │ From         │ To           │ Amount    │
├──────────┼──────┼──────────────┼──────────────┼───────────┤
│ 2h ago   │ 🟢BUY│ 93U65rT9t... │ 6oFWm7KPL... │ 500M BONK │
│ 3h ago   │ 🔴SEL│ 6oFWm7KPL... │ 93U65rT9t... │ 500M BONK │
│ 4h ago   │ 🟢BUY│ ARu4n5mFd... │ 3GS1mZzht... │ 120M BONK │
└──────────┴──────┴──────────────┴──────────────┴───────────┘
```

---

### 8. **Risk Assessment Panel**
**Purpose**: Comprehensive risk analysis

**Sections**:

**A. Risk Score**
- Overall risk level (LOW/MEDIUM/HIGH/CRITICAL)
- Score out of 100
- Visual gauge/meter

**B. Red Flags List**
- RF17: Wash Trading (✓/✗)
- RF1: Single Wallet Dominance (✓/✗)
- RF2: Top 3 Concentration (✓/✗)
- RF19: Rug Pull Signature (✓/✗)
- (All 25 red flags)

**C. Risk Breakdown**
- Ownership Risk: 7/10
- Volume Risk: 8/10
- Growth Risk: 3/10
- Price Risk: 5/10
- Behavioral Risk: 9/10

**Design**:
```
┌─────────────────────────────────────────────────────┐
│ Risk Assessment                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│        ┌─────────────────┐                          │
│        │   HIGH RISK     │                          │
│        │      72/100     │                          │
│        └─────────────────┘                          │
│                                                      │
│ Red Flags Detected: 5/25                            │
│ ✓ RF17: Wash Trading                                │
│ ✓ RF1: Single Wallet Dominance                      │
│ ✗ RF2: Top 3 Concentration                          │
│ ✗ RF19: Rug Pull Signature                          │
│                                                      │
│ Risk Breakdown:                                      │
│ Ownership:  ████████░░ 8/10                         │
│ Volume:     ███████░░░ 7/10                         │
│ Behavioral: █████████░ 9/10                         │
└─────────────────────────────────────────────────────┘
```

---

### 9. **Wallet Detail Modal**
**Purpose**: Deep dive into individual wallet

**Triggered by**: Clicking wallet address anywhere

**Content**:
- Full wallet address (with copy button)
- Balance (current)
- Total In / Total Out / Net Flow
- Transaction count
- First seen / Last seen timestamps
- Transaction history (filtered to this wallet)
- Connected wallets (frequent trading partners)
- Behavior classification (Bot/Whale/Trader/Holder)
- Risk flags specific to this wallet

**Design**:
```
┌─────────────────────────────────────────────────────┐
│ Wallet Details                              [Close] │
├─────────────────────────────────────────────────────┤
│ Address: 4TYF8iW8bXET9C8aFgJoiUHhNtpBg5bqRsxS... 📋 │
│                                                      │
│ Balance: 17,944,937,828 BONK                        │
│ Total In: 17,944,937,828 BONK                       │
│ Total Out: 0 BONK                                   │
│ Net Flow: +17,944,937,828 BONK                      │
│                                                      │
│ Activity:                                            │
│ • Transactions: 1                                    │
│ • First Seen: 2024-04-28 14:23:15                   │
│ • Last Seen: 2024-04-28 14:23:15                    │
│                                                      │
│ Classification: 🐋 MEGA WHALE (Accumulator)         │
│                                                      │
│ Connected Wallets:                                   │
│ • None detected                                      │
│                                                      │
│ [View All Transactions] [Export Data]               │
└─────────────────────────────────────────────────────┘
```

---

### 10. **Token Comparison View** (Optional)
**Purpose**: Compare multiple tokens side-by-side

**Features**:
- Load multiple JSON files
- Side-by-side metric comparison
- Highlight differences
- Export comparison report

**Design**:
```
┌─────────────────────────────────────────────────────┐
│ Token Comparison                    [Add Token +]   │
├──────────────┬──────────────┬──────────────────────┤
│ Metric       │ BONK         │ BEE                  │
├──────────────┼──────────────┼──────────────────────┤
│ Wallets      │ 1,294        │ 1,319                │
│ Holders      │ 394          │ 264                  │
│ Whales       │ 15           │ 8                    │
│ Wash Trading │ ✓ Detected   │ ✗ Not Detected       │
│ Risk Level   │ HIGH         │ MEDIUM               │
└──────────────┴──────────────┴──────────────────────┘
```

---

## 🎨 Design System

### Color Palette

**Primary Colors**:
- Background: `#0F1419` (dark)
- Surface: `#1A1F26` (card background)
- Border: `#2D3748` (subtle borders)

**Accent Colors**:
- Primary: `#3B82F6` (blue - info)
- Success: `#10B981` (green - positive)
- Warning: `#F59E0B` (yellow - caution)
- Danger: `#EF4444` (red - risk)

**Text Colors**:
- Primary: `#F9FAFB` (white)
- Secondary: `#9CA3AF` (gray)
- Muted: `#6B7280` (dark gray)

### Typography

- **Headings**: Inter, Bold, 24px-32px
- **Body**: Inter, Regular, 14px-16px
- **Monospace** (addresses, hashes): Fira Code, 12px-14px

### Spacing

- Card padding: 24px
- Section gap: 32px
- Element gap: 16px

---

## 🔧 Technical Requirements

### Frontend Stack (Recommended)

**Option 1: React + Vite**
- React 18+
- Vite for build
- TailwindCSS for styling
- Recharts or Chart.js for visualizations
- React Table for data tables

**Option 2: Next.js**
- Next.js 14+
- TailwindCSS
- Recharts
- Server-side rendering support

**Option 3: Vue + Vite**
- Vue 3
- Vite
- TailwindCSS
- Chart.js

### Key Libraries

1. **Charts**: Recharts, Chart.js, or D3.js
2. **Tables**: TanStack Table (React Table)
3. **Icons**: Heroicons or Lucide
4. **Animations**: Framer Motion
5. **Date formatting**: date-fns or dayjs
6. **Number formatting**: numeral.js

### Data Loading

- Load JSON files from `/output` directory
- Support drag-and-drop JSON upload
- Auto-refresh when new files detected
- Cache loaded data in localStorage

---

## 📱 Responsive Design

### Desktop (1920px+)
- 4-column grid for metric cards
- Side-by-side charts
- Full table view

### Tablet (768px - 1919px)
- 2-column grid for metric cards
- Stacked charts
- Scrollable tables

### Mobile (< 768px)
- Single column layout
- Collapsible sections
- Simplified tables (show key columns only)
- Bottom navigation

---

## 🚀 Features Priority

### MVP (Phase 1)
✅ Dashboard header
✅ Key metrics cards
✅ Whale tracker table
✅ Transaction feed
✅ Risk assessment panel

### Phase 2
✅ Transaction timeline chart
✅ Holder distribution chart
✅ Wash trading detector panel
✅ Wallet detail modal

### Phase 3
✅ Token comparison view
✅ Export functionality
✅ Advanced filtering
✅ Real-time updates

---

## 📊 Sample Data Files

The UI should be able to load these files:
- `output/result.json` (BONK data)
- `output/bee_result.json` (BEE data)
- Any JSON file matching the schema

---

## 🎯 User Flows

### Flow 1: Quick Token Analysis
1. User opens dashboard
2. Loads token JSON file
3. Views key metrics cards
4. Checks risk assessment
5. Reviews top whales

### Flow 2: Whale Investigation
1. User sees high whale count
2. Clicks on whale tracker table
3. Sorts by balance
4. Clicks on top whale address
5. Views wallet detail modal
6. Checks transaction history
7. Identifies accumulation pattern

### Flow 3: Wash Trading Detection
1. User sees RF17 flag
2. Opens wash trading panel
3. Reviews evidence
4. Clicks on involved wallets
5. Verifies round-trip patterns
6. Exports evidence report

---

## 🔐 Security Considerations

- No private keys or sensitive data
- Read-only data display
- No blockchain write operations
- Sanitize all user inputs
- Validate JSON schema before loading

---

## 📝 Documentation Needed

1. **User Guide**: How to use the dashboard
2. **Data Schema**: JSON structure explanation
3. **Metrics Glossary**: What each metric means
4. **Risk Flags Guide**: Explanation of all 25 red flags
5. **FAQ**: Common questions

---

## 🎨 UI/UX Best Practices

1. **Loading States**: Show skeletons while loading data
2. **Error Handling**: Clear error messages for invalid files
3. **Empty States**: Helpful messages when no data
4. **Tooltips**: Explain complex metrics on hover
5. **Accessibility**: Keyboard navigation, screen reader support
6. **Performance**: Virtualize long lists, lazy load charts

---

## 🚀 Deployment

### Hosting Options
- Vercel (recommended for Next.js)
- Netlify (for static sites)
- GitHub Pages (for simple React apps)
- Self-hosted (Docker container)

### Build Process
```bash
npm run build
npm run preview  # Test production build
npm run deploy   # Deploy to hosting
```

---

## 📦 Deliverables

1. ✅ Fully functional web dashboard
2. ✅ Responsive design (desktop + mobile)
3. ✅ JSON file loader
4. ✅ All 10 UI components implemented
5. ✅ Documentation (user guide + developer docs)
6. ✅ Deployment instructions

---

## 🎯 Success Criteria

- ✅ Load and display BONK data correctly
- ✅ Load and display BEE data correctly
- ✅ All metrics calculated and displayed
- ✅ Charts render properly
- ✅ Tables sortable and filterable
- ✅ Responsive on all devices
- ✅ Fast performance (<2s load time)
- ✅ No console errors

---

## 📞 Support

For questions or issues:
- Check documentation first
- Review sample data files
- Test with provided JSON files (BONK, BEE)

---

**END OF SPECIFICATION**

This prompt provides everything needed to build a professional crypto token intelligence dashboard. Share this with your UI developer or use it to build the frontend yourself!

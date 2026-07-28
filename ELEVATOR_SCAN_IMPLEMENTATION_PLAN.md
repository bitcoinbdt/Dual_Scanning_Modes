# Elevator Scan Implementation Plan
## Variable Credit-Based Deep Analysis System

**Status:** Planning Phase  
**Created:** 2026-07-28  
**Feature Type:** Premium Variable-Cost Analysis

---

## 🎯 Overview

The Elevator Scan will be a **completely separate** scanning system from Basic Scan, where users can spend **variable amounts of credits** to receive **proportional analysis depth**. This creates a flexible, pay-as-you-go model for advanced blockchain intelligence.

### Key Concept
- **More Credits = More Results**
- **Less Credits = Focused Analysis**
- Minimum: 5 credits → Basic insights
- Maximum: 100+ credits → Full deep-dive analysis
- Users choose their budget before scanning

---

## 📊 Credit Tier System

### Proposed Tiers

| Tier | Credits | Analysis Depth | Data Sources | Results |
|------|---------|----------------|--------------|---------|
| **Quick Peek** | 5-10 | Surface level | 2-3 sources | Basic metrics only |
| **Standard** | 11-25 | Moderate depth | 4-6 sources | Most features unlocked |
| **Professional** | 26-50 | Deep analysis | 7-10 sources | All features + history |
| **Institutional** | 51-100+ | Maximum depth | All sources | Full intel + predictions |

### What Changes with Credit Amount

**Transaction Analysis:**
- 5 credits: Last 50 transactions
- 10 credits: Last 200 transactions
- 25 credits: Last 1,000 transactions
- 50 credits: Last 5,000 transactions
- 100 credits: Last 10,000+ transactions

**Trader Profiling:**
- 5 credits: Top 3 buyers/sellers (basic tags)
- 10 credits: Top 5 buyers/sellers (basic tags)
- 25 credits: Top 10 each (detailed tags + win rates)
- 50 credits: Top 20 each (full intelligence + history)
- 100 credits: Top 50 each (predictive scoring)

**Time-Series Analysis:**
- 5 credits: Last 6 hours (5-minute intervals)
- 10 credits: Last 24 hours (15-minute intervals)
- 25 credits: Last 7 days (1-hour intervals)
- 50 credits: Last 30 days (4-hour intervals)
- 100 credits: Full history (custom intervals)

**Advanced Features Unlock:**
- 5 credits: Basic wash trading detection
- 10 credits: + Holder concentration (Gini)
- 25 credits: + Creator funding trace
- 50 credits: + Insider threat detection + Momentum heatmap
- 100 credits: + Predictive risk scoring + Similar token comparison

---

## 🏗️ Architecture

### 1. Database Schema

#### New Table: `elevator_scans`
```sql
CREATE TABLE elevator_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    
    -- Scan Details
    token_address VARCHAR(255) NOT NULL,
    chain_id VARCHAR(10) NOT NULL,
    
    -- Credit Configuration
    credits_spent INTEGER NOT NULL,
    tier VARCHAR(50) NOT NULL, -- 'quick_peek', 'standard', 'professional', 'institutional'
    
    -- Job Management
    job_id VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
    
    -- Progress Tracking
    progress_percentage INTEGER DEFAULT 0,
    current_step VARCHAR(100),
    estimated_completion_time TIMESTAMP,
    
    -- Results
    result_data JSONB, -- Stores the complete analysis result
    analysis_summary TEXT,
    risk_score DECIMAL(5,2),
    confidence_score DECIMAL(5,2),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    processing_time_ms INTEGER,
    
    -- Caching
    cache_hit BOOLEAN DEFAULT false,
    cached_from UUID REFERENCES elevator_scans(id),
    
    CONSTRAINT valid_credits CHECK (credits_spent >= 5 AND credits_spent <= 1000),
    CONSTRAINT valid_status CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_elevator_scans_user ON elevator_scans(user_id);
CREATE INDEX idx_elevator_scans_job ON elevator_scans(job_id);
CREATE INDEX idx_elevator_scans_token ON elevator_scans(token_address, chain_id);
CREATE INDEX idx_elevator_scans_status ON elevator_scans(status);
CREATE INDEX idx_elevator_scans_created ON elevator_scans(created_at DESC);
```

#### New Table: `elevator_scan_steps`
```sql
CREATE TABLE elevator_scan_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES elevator_scans(id) ON DELETE CASCADE,
    
    step_name VARCHAR(100) NOT NULL,
    step_order INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped'
    
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    processing_time_ms INTEGER,
    
    error_message TEXT,
    result_data JSONB,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_elevator_steps_scan ON elevator_scan_steps(scan_id);
```

#### Update: `credit_transactions` table
```sql
-- Add new transaction types
ALTER TABLE credit_transactions 
    ADD COLUMN scan_type VARCHAR(20) CHECK (scan_type IN ('basic', 'elevator')),
    ADD COLUMN elevator_scan_id UUID REFERENCES elevator_scans(id),
    ADD COLUMN credits_amount INTEGER; -- For elevator scans with variable costs
```

### 2. API Routes

#### `POST /api/scan/elevator/start`
**Request:**
```typescript
{
  address: string;
  chain: string;
  creditsToSpend: number; // User selects this
  options?: {
    priorityProcessing?: boolean; // Extra cost
    includeHistorical?: boolean;
    customDepth?: number;
  }
}
```

**Response:**
```typescript
{
  success: true;
  jobId: string;
  estimatedTime: number; // in seconds
  tier: string;
  creditsCharged: number;
  queuePosition?: number;
}
```

#### `GET /api/scan/elevator/status/:jobId`
**Response:**
```typescript
{
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  estimatedTimeRemaining: number;
  stepsCompleted: number;
  stepsTotal: number;
}
```

#### `GET /api/scan/elevator/result/:jobId`
**Response:**
```typescript
{
  success: true;
  data: ElevatorScanResult;
  metadata: {
    scanId: string;
    creditsSpent: number;
    tier: string;
    processingTime: number;
    completedAt: string;
  }
}
```

#### `GET /api/scan/elevator/history`
**Response:**
```typescript
{
  scans: Array<{
    id: string;
    tokenAddress: string;
    tokenSymbol: string;
    creditsSpent: number;
    status: string;
    createdAt: string;
    riskScore?: number;
  }>;
  total: number;
  page: number;
}
```

#### `POST /api/scan/elevator/cancel/:jobId`
**Response:**
```typescript
{
  success: true;
  refundedCredits: number; // Partial refund based on progress
}
```

### 3. Backend Processing Engine

#### File Structure
```
lib/
  elevator/
    engine.ts              # Main orchestrator
    tiers.ts               # Tier configuration and rules
    steps/
      txAnalyzer.ts        # Transaction analysis
      traderProfiler.ts    # Wallet classification
      threatDetector.ts    # Insider/sniper detection
      creatorTracer.ts     # Funding source analysis
      washTrading.ts       # Artificial volume detection
      holderAnalysis.ts    # Gini coefficient calculation
      momentum.ts          # Time-series pressure analysis
      riskScoring.ts       # Overall risk calculation
    queue/
      jobManager.ts        # Job queue management
      worker.ts            # Background processor
    cache/
      elevatorCache.ts     # Smart caching for elevator scans
```

#### Core Engine Interface
```typescript
// lib/elevator/engine.ts

export interface ElevatorScanConfig {
  creditsSpent: number;
  tier: ElevatorTier;
  enabledSteps: string[];
  limits: {
    maxTransactions: number;
    maxTraders: number;
    historyDepth: number; // in hours
    dataPoints: number;
  };
}

export interface ElevatorScanResult {
  // Core Data
  tokenAddress: string;
  tokenName: string;
  symbol: string;
  
  // Market Behavior (always included)
  marketBehavior: {
    totalBuyVolume: number;
    totalSellVolume: number;
    netFlow: number;
    transactionCount: number;
    timeframe: string;
  };
  
  // Advanced Analytics (credit-dependent)
  advancedAnalytics?: {
    insiderThreat?: InsiderThreatData;
    creatorFunding?: CreatorFundingData;
    washTrading?: WashTradingData;
    giniCoefficient?: GiniData;
    holdingVelocity?: HoldingVelocityData;
    momentumHeatmap?: MomentumData[];
  };
  
  // Trader Intelligence (credit-dependent)
  topBuyers?: TraderProfile[];
  topSellers?: TraderProfile[];
  
  // Risk Assessment
  riskScore: number; // 0-100
  confidenceScore: number; // 0-100
  warnings: string[];
  insights: string[];
  
  // Metadata
  tier: string;
  creditsSpent: number;
  processingTime: number;
  dataQuality: number;
}

export class ElevatorScanEngine {
  async executeScan(
    address: string,
    chainId: string,
    config: ElevatorScanConfig,
    onProgress?: (step: string, progress: number) => void
  ): Promise<ElevatorScanResult>;
  
  async estimateProcessingTime(config: ElevatorScanConfig): Promise<number>;
  
  async checkCache(address: string, config: ElevatorScanConfig): Promise<ElevatorScanResult | null>;
}
```

### 4. Job Queue System

**Options:**
- **Simple:** In-memory queue with database persistence (for MVP)
- **Scalable:** Bull Queue with Redis (for production)

**Queue Strategy:**
```typescript
// lib/elevator/queue/jobManager.ts

export class ElevatorJobManager {
  async createJob(
    userId: string,
    address: string,
    chainId: string,
    creditsSpent: number
  ): Promise<string>; // Returns jobId
  
  async getJobStatus(jobId: string): Promise<JobStatus>;
  
  async cancelJob(jobId: string, userId: string): Promise<number>; // Returns refund
  
  async processNextJob(): Promise<void>;
}

// Priority system: Higher credits = Higher priority
// Jobs with 100+ credits jump the queue
```

---

## 🎨 Frontend Components

### 1. Credit Slider Component
**File:** `components/elevator/CreditSliderInput.tsx`

```typescript
interface CreditSliderInputProps {
  minCredits: number;
  maxCredits: number;
  currentBalance: number;
  onCreditsChange: (credits: number) => void;
}

// Shows:
// - Slider to select credit amount
// - Tier name and badge
// - What features unlock at this tier
// - Estimated processing time
// - Preview of results depth
```

### 2. Elevator Configuration Modal
**File:** `components/elevator/ElevatorConfigModal.tsx`

```typescript
// User selects:
// - Credit amount (slider)
// - Priority processing (optional, +20% cost)
// - Historical depth
// - Sees live preview of what they'll get
// - Confirmation before starting
```

### 3. Live Progress Component
**File:** `components/elevator/ElevatorProgress.tsx`

```typescript
// Shows:
// - Current step being processed
// - Progress bar with percentage
// - Estimated time remaining
// - Steps completed vs total
// - Option to cancel (with refund info)
```

### 4. Elevator History Page
**File:** `app/elevator/history/page.tsx`

```typescript
// Shows:
// - All past elevator scans
// - Filter by status, date, credits spent
// - Quick re-scan option
// - Download results as JSON/PDF
```

### 5. Enhanced Results Display
**File:** `components/elevator/ElevatorResultCard.tsx` (enhanced)

```typescript
// Dynamically shows/hides sections based on tier
// Displays "Unlock with X more credits" for unavailable features
// Shows data quality score
// Option to "Upgrade Scan" (spend more credits for deeper analysis)
```

---

## 🔄 User Flow

### Complete Journey

```
1. User clicks "Elevator Scan" from homepage
   ↓
2. Opens Elevator Configuration Modal
   - Sees credit slider (5-100+)
   - Real-time tier preview
   - Feature comparison table
   ↓
3. Selects credit amount (e.g., 25 credits)
   - Tier: "Professional"
   - ETA: 45 seconds
   - Features: All except predictions
   ↓
4. Confirms and starts scan
   - Credits deducted immediately
   - Job created in queue
   - Redirected to progress page
   ↓
5. Live Progress Display
   - "Fetching transactions... 25%"
   - "Profiling traders... 50%"
   - "Analyzing threats... 75%"
   - Option to cancel for partial refund
   ↓
6. Scan completes
   - Redirected to results page
   - Full ElevatorResultCard display
   - All purchased features visible
   - Option to upgrade scan
   ↓
7. Results saved to history
   - Can revisit anytime
   - Can export/share
```

---

## 📱 UI/UX Mockup Structure

### Elevator Configuration Screen

```
┌─────────────────────────────────────────────────────────────┐
│  🎚️  ELEVATOR SCAN CONFIGURATION                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Token: 0x1234...5678                                        │
│  Your Balance: 150 ⚡                                         │
│                                                               │
│  How many credits do you want to spend?                      │
│                                                               │
│  5 ●━━━━━━━━━●━━━━━━━━━●━━━━━━━━━● 100+                    │
│       Quick     Standard    Professional    Institutional     │
│                                                               │
│  Currently Selected: 25 Credits                              │
│  Tier: 🔷 Professional                                       │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ✅ Last 1,000 transactions analyzed                   │  │
│  │ ✅ Top 10 buyers & sellers profiled                   │  │
│  │ ✅ 7-day momentum heatmap                             │  │
│  │ ✅ Wash trading detection                             │  │
│  │ ✅ Holder concentration (Gini)                        │  │
│  │ ✅ Creator funding trace                              │  │
│  │ 🔒 Predictive risk scoring (Unlock with 50 credits)  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Estimated Time: ~45 seconds                                 │
│                                                               │
│  [ Cancel ]                      [ Start Scan → ] (25 ⚡)     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Progress Screen

```
┌─────────────────────────────────────────────────────────────┐
│  🔄 ELEVATOR SCAN IN PROGRESS                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Job ID: ev_1234abcd                                         │
│  Credits: 25 ⚡                                               │
│                                                               │
│  ████████████████████░░░░░░░░░  75%                          │
│                                                               │
│  Current Step: Analyzing insider threats...                  │
│  Time Remaining: ~12 seconds                                 │
│                                                               │
│  ✅ Fetched 1,000 transactions (5s)                          │
│  ✅ Profiled top traders (8s)                                │
│  ✅ Detected wash trading (12s)                              │
│  🔄 Analyzing insider threats... (in progress)               │
│  ⏳ Calculating risk score... (pending)                      │
│  ⏳ Generating insights... (pending)                         │
│                                                               │
│  [ Cancel Scan ] (Refund: ~6 ⚡)                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Database schema creation
- [ ] Credit tier system definition
- [ ] Basic API routes structure
- [ ] Job queue setup (simple in-memory)
- [ ] Credit deduction/refund logic

### Phase 2: Core Engine (Week 2-3)
- [ ] Transaction analyzer (variable depth)
- [ ] Trader profiler (basic tagging)
- [ ] Wash trading detector
- [ ] Holder concentration calculator
- [ ] Risk scoring algorithm

### Phase 3: Advanced Features (Week 4)
- [ ] Insider threat detection
- [ ] Creator funding tracer
- [ ] Momentum heatmap generator
- [ ] Holding velocity analyzer
- [ ] Smart caching system

### Phase 4: Frontend (Week 5)
- [ ] Credit slider component
- [ ] Configuration modal
- [ ] Progress tracking UI
- [ ] Enhanced results display
- [ ] History page

### Phase 5: Polish & Testing (Week 6)
- [ ] Performance optimization
- [ ] Queue management refinement
- [ ] Error handling & retry logic
- [ ] User testing & feedback
- [ ] Documentation

### Phase 6: Production (Week 7)
- [ ] Bull Queue + Redis migration
- [ ] Rate limiting
- [ ] Monitoring & alerts
- [ ] Analytics tracking
- [ ] Launch 🚀

---

## 🎯 Success Metrics

**Technical:**
- Scan completion time < 60s for 25-credit scans
- 99% accuracy on trader classification
- <5% false positives on threat detection
- Cache hit rate > 40%

**Business:**
- Average credits spent per elevator scan: 20-30
- User satisfaction score: >4.5/5
- Conversion rate (basic → elevator): >15%
- Repeat usage rate: >60%

**User Experience:**
- Time to first insight: <10s
- Progress updates every 2-3s
- Cancel/refund success rate: 100%
- Mobile responsiveness score: >95

---

## 💡 Future Enhancements

1. **Bulk Scanning:** Scan multiple tokens with discount
2. **Alerts:** Set up monitoring for specific tokens
3. **API Access:** Developer API for elevator scans
4. **Team Plans:** Shared credit pools
5. **AI Insights:** GPT-powered risk explanations
6. **Comparison Mode:** Compare 2+ tokens side-by-side
7. **Historical Analysis:** Time-travel to past states
8. **Subscription Tiers:** Monthly credits + unlimited basic

---

## 📋 Open Questions

1. **Pricing Balance:** What's the sweet spot for credit-to-value ratio?
2. **Queue Priority:** Should institutional tier bypass the queue entirely?
3. **Partial Results:** If scan fails at 80%, deliver partial results?
4. **Caching Strategy:** How long should elevator results be cached?
5. **Refund Policy:** Full refund if failed? Partial refund if cancelled?
6. **Rate Limiting:** Max scans per user per hour?

---

## 🔐 Security Considerations

- [ ] Rate limiting per user (prevent abuse)
- [ ] Job cancellation authentication (only creator can cancel)
- [ ] Result data encryption at rest
- [ ] No PII in transaction logs
- [ ] Credit balance validation before deduction
- [ ] Audit trail for all elevator scans

---

**Next Steps:** Review this plan, provide feedback on credit tiers and features, then proceed with Phase 1 implementation.

# Referral System Implementation Plan

## Overview

Implement a tiered referral system where users can invite others to the platform. When a referred user purchases credits, the referrer receives bonus credits based on the purchase tier.

**Key Features:**
- Unique referral codes for each user
- Shareable referral links
- Tiered bonus structure (higher purchase = higher bonus)
- Referral tracking and history
- Fraud prevention mechanisms

---

## 1. Referral Bonus Tier Structure

| Package | Credits Purchased | Price (SOL) | Referrer Bonus | Bonus Percentage |
|---------|------------------|-------------|----------------|------------------|
| Starter | 50               | 0.5 SOL     | 5 credits      | 10%             |
| Basic   | 100              | 0.9 SOL     | 15 credits     | 15%             |
| Pro     | 200              | 1.6 SOL     | 40 credits     | 20%             |
| Premium | 500              | 3.5 SOL     | 125 credits    | 25%             |

**Rationale:**
- Progressive bonus structure incentivizes referring high-value users
- Higher tiers offer better rewards to encourage quality referrals
- Bonuses are percentage-based for simplicity and fairness

---

## 2. Database Schema (Supabase)

### Table: `referral_codes`
Stores unique referral codes for each user.

```sql
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(12) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  total_referrals INTEGER DEFAULT 0,
  total_earned_credits INTEGER DEFAULT 0,
  UNIQUE(user_id)
);

-- Index for fast code lookups
CREATE INDEX idx_referral_code ON referral_codes(code);
CREATE INDEX idx_user_id ON referral_codes(user_id);
```

### Table: `referrals`
Tracks all referral relationships and rewards.

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id),
  referred_user_id UUID NOT NULL REFERENCES auth.users(id),
  referral_code VARCHAR(12) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  -- Status: pending, confirmed, rewarded
  created_at TIMESTAMP DEFAULT NOW(),
  first_purchase_at TIMESTAMP,
  first_purchase_amount DECIMAL(10,2),
  bonus_credits_awarded INTEGER DEFAULT 0,
  UNIQUE(referred_user_id)
);

-- Indexes
CREATE INDEX idx_referrer ON referrals(referrer_user_id);
CREATE INDEX idx_referred ON referrals(referred_user_id);
CREATE INDEX idx_status ON referrals(status);
```

### Table: `referral_rewards`
Detailed log of all referral bonuses awarded.

```sql
CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id UUID NOT NULL REFERENCES referrals(id),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id),
  referred_user_id UUID NOT NULL REFERENCES auth.users(id),
  purchase_package_id VARCHAR(50) NOT NULL,
  credits_purchased INTEGER NOT NULL,
  bonus_credits INTEGER NOT NULL,
  bonus_percentage DECIMAL(5,2) NOT NULL,
  credited_at TIMESTAMP DEFAULT NOW()
);

-- Index for user reward history
CREATE INDEX idx_reward_referrer ON referral_rewards(referrer_user_id);
```

---

## 3. Referral Code Generation

**Format:** `ABC-DEF-GH12`
- 12 characters with hyphens
- Alphanumeric, uppercase
- Excludes confusing characters (0, O, I, 1, l)
- URL-safe and easy to share

**Algorithm:**
```typescript
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCode(): string {
  const segments = [3, 3, 4]; // ABC-DEF-GH12
  return segments
    .map(length => {
      let segment = '';
      for (let i = 0; i < length; i++) {
        segment += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
      }
      return segment;
    })
    .join('-');
}
```

**Features:**
- Auto-generate on user registration
- Check uniqueness before saving
- Regenerate if collision detected (highly unlikely)

---

## 4. Backend API Endpoints (Render)

### GET `/api/referral/code`
Get current user's referral code (create if doesn't exist).

**Response:**
```json
{
  "code": "ABC-DEF-GH12",
  "shareUrl": "https://yourapp.com?ref=ABC-DEF-GH12",
  "stats": {
    "totalReferrals": 5,
    "totalEarned": 150,
    "pendingReferrals": 2
  }
}
```

### GET `/api/referral/history`
Get user's referral activity history.

**Query Parameters:**
- `limit` (default: 20)
- `offset` (default: 0)

**Response:**
```json
{
  "referrals": [
    {
      "id": "uuid",
      "referredUsername": "user123",
      "status": "rewarded",
      "joinedAt": "2026-07-15T10:30:00Z",
      "firstPurchaseAt": "2026-07-16T14:20:00Z",
      "packageName": "Pro",
      "bonusEarned": 40
    }
  ],
  "total": 5
}
```

### POST `/api/referral/apply`
Apply a referral code during registration or first login.

**Request Body:**
```json
{
  "code": "ABC-DEF-GH12"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Referral code applied successfully",
  "referrerUsername": "john_doe"
}
```

**Validation Rules:**
- User must not already have been referred
- Code must exist and be active
- Cannot use own referral code
- Must be applied before first purchase

### POST `/api/credits/purchase` (UPDATED)
Modify existing purchase endpoint to handle referral bonuses.

**New Logic:**
1. Process payment as usual
2. Check if user was referred (lookup in `referrals` table)
3. If referred AND first purchase:
   - Calculate bonus based on tier
   - Credit referrer's account
   - Update referral status to 'rewarded'
   - Log reward in `referral_rewards` table
4. Return transaction details including referral bonus if applicable

---

## 5. Frontend Components

### 5.1 Referral Dashboard Section (New Component)

**File:** `components/referral/ReferralDashboard.tsx`

**Features:**
- Display user's unique referral code
- Copy-to-clipboard button
- Share buttons (Twitter, Telegram, Email)
- Referral stats (total referrals, earned credits, pending)
- Recent referrals list

**UI Layout:**
```
┌─────────────────────────────────────┐
│ 🎁 Your Referral Code               │
│                                     │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃  ABC-DEF-GH12     [Copy] [Share]┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                     │
│ Stats:                              │
│ • Total Referrals: 5                │
│ • Credits Earned: ⚡ 150            │
│ • Pending: 2                        │
└─────────────────────────────────────┘
```

### 5.2 Referral Input (Credit Store Page)

**File:** `app/credits/page.tsx` (UPDATE)

Add referral code input field above package selection:

```tsx
<div className="mb-8 bg-slate-900/30 rounded-xl p-6 border border-primary-500/30">
  <label className="block text-sm font-medium mb-3 text-slate-300">
    Have a referral code? Enter it here:
  </label>
  <div className="flex gap-3">
    <input
      type="text"
      placeholder="ABC-DEF-GH12"
      className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-4 py-3"
      value={referralCode}
      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
    />
    <button
      onClick={handleApplyReferral}
      className="px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-lg"
    >
      Apply
    </button>
  </div>
  {referralApplied && (
    <p className="mt-3 text-green-400 text-sm">
      ✓ Referral code applied! Your referrer will receive bonus credits on your first purchase.
    </p>
  )}
</div>
```

### 5.3 Referral History Modal (New Component)

**File:** `components/referral/ReferralHistoryModal.tsx`

Displays detailed history of all referrals and earned bonuses.

**Features:**
- List of all referred users
- Purchase status and bonus earned
- Filter by status (all, pending, rewarded)
- Pagination

### 5.4 Navigation Menu Update

**File:** `components/layout/Navigation.tsx` (UPDATE)

Add "Referrals" link to navigation menu:

```tsx
<Link
  href="/referrals"
  className="text-slate-300 hover:text-white transition-colors"
>
  🎁 Referrals
</Link>
```

### 5.5 Referrals Page (New Route)

**File:** `app/referrals/page.tsx`

Full-page referral management interface combining:
- ReferralDashboard component
- How it works section
- Referral history table
- Tier bonus breakdown

---

## 6. Type Definitions

**File:** `types/referral.ts` (NEW)

```typescript
export interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  createdAt: string;
  isActive: boolean;
  totalReferrals: number;
  totalEarnedCredits: number;
}

export interface ReferralStats {
  totalReferrals: number;
  totalEarned: number;
  pendingReferrals: number;
}

export interface Referral {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referredUsername?: string;
  referralCode: string;
  status: 'pending' | 'confirmed' | 'rewarded';
  createdAt: string;
  firstPurchaseAt?: string;
  firstPurchaseAmount?: number;
  bonusCreditsAwarded: number;
}

export interface ReferralReward {
  id: string;
  packageName: string;
  creditsPurchased: number;
  bonusCredits: number;
  bonusPercentage: number;
  creditedAt: string;
}

export interface ApplyReferralRequest {
  code: string;
}

export interface ApplyReferralResponse {
  success: boolean;
  message: string;
  referrerUsername?: string;
}
```

---

## 7. API Service Layer

**File:** `services/referralApi.ts` (NEW)

```typescript
import axios from 'axios';
import type {
  ReferralCode,
  ReferralStats,
  Referral,
  ApplyReferralRequest,
  ApplyReferralResponse,
} from '@/types/referral';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const referralApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token interceptor
referralApiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export async function getReferralCode(): Promise<{
  code: string;
  shareUrl: string;
  stats: ReferralStats;
}> {
  const response = await referralApiClient.get('/api/referral/code');
  return response.data;
}

export async function getReferralHistory(
  limit = 20,
  offset = 0
): Promise<{ referrals: Referral[]; total: number }> {
  const response = await referralApiClient.get('/api/referral/history', {
    params: { limit, offset },
  });
  return response.data;
}

export async function applyReferralCode(
  code: string
): Promise<ApplyReferralResponse> {
  const response = await referralApiClient.post<ApplyReferralResponse>(
    '/api/referral/apply',
    { code }
  );
  return response.data;
}

export function formatReferralUrl(code: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${baseUrl}/?ref=${code}`;
}

export function calculateReferralBonus(packageId: string, credits: number): number {
  const bonusMap: Record<string, number> = {
    starter: 0.10,  // 10%
    basic: 0.15,    // 15%
    pro: 0.20,      // 20%
    premium: 0.25,  // 25%
  };
  
  const bonusPercentage = bonusMap[packageId] || 0.10;
  return Math.floor(credits * bonusPercentage);
}
```

---

## 8. Context Provider (Optional)

**File:** `contexts/ReferralContext.tsx` (NEW)

Manages referral state globally across the app:

```typescript
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReferralCode, ReferralStats } from '@/types/referral';
import { getReferralCode } from '@/services/referralApi';
import { useAuth } from './AuthContext';

interface ReferralContextType {
  code: string | null;
  shareUrl: string | null;
  stats: ReferralStats | null;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const ReferralContext = createContext<ReferralContextType | undefined>(undefined);

export function ReferralProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = async () => {
    if (!isAuthenticated) return;
    
    try {
      const data = await getReferralCode();
      setCode(data.code);
      setShareUrl(data.shareUrl);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [isAuthenticated]);

  return (
    <ReferralContext.Provider value={{ code, shareUrl, stats, isLoading, refreshData }}>
      {children}
    </ReferralContext.Provider>
  );
}

export function useReferrals() {
  const context = useContext(ReferralContext);
  if (!context) throw new Error('useReferrals must be used within ReferralProvider');
  return context;
}
```

**Note:** Add `<ReferralProvider>` to `app/layout.tsx` alongside other providers.

---

## 9. URL Parameter Handling

When users visit the app via a referral link (`?ref=ABC-DEF-GH12`), automatically capture and store the code.

**File:** `app/page.tsx` (UPDATE)

```typescript
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function HomePage() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      // Store in localStorage for later use during registration/purchase
      localStorage.setItem('pendingReferralCode', refCode);
      
      // Show toast notification
      toast.info(`Referral code ${refCode} will be applied!`);
    }
  }, [searchParams]);

  // ... rest of component
}
```

**Auto-apply Logic:**
1. User clicks referral link
2. Code stored in localStorage
3. When user signs up → apply code automatically
4. When user purchases → bonus credited to referrer

---

## 10. Fraud Prevention Mechanisms

### 10.1 Validation Rules

**Backend Checks:**
- ✅ User cannot refer themselves
- ✅ User can only be referred once (UNIQUE constraint on `referred_user_id`)
- ✅ Referral code must be applied before first purchase
- ✅ Bonus only awarded on first purchase (check `first_purchase_at`)
- ✅ IP address tracking to detect abuse patterns
- ✅ Email domain validation (block temporary email services)

### 10.2 Rate Limiting

**Endpoint Protection:**
- `/api/referral/apply`: Max 5 attempts per hour per IP
- `/api/credits/purchase`: Max 10 transactions per day per user

### 10.3 Monitoring & Alerts

**Red Flags:**
- Multiple referrals from same IP in short time
- Referrer and referred user sharing payment methods
- Abnormally high referral count from single user
- Rapid purchase-refund patterns

**Action:**
- Flag suspicious accounts for manual review
- Temporary hold on bonus credits
- Email verification requirement for high-value bonuses

---

## 11. Notification System

### 11.1 Email Notifications (Optional)

**Trigger Events:**
- ✉️ Referrer: Someone used your code
- ✉️ Referrer: Referred user made first purchase (bonus awarded)
- ✉️ Referred user: Welcome email with referral details

### 11.2 In-App Notifications

**File:** `components/notifications/ReferralNotification.tsx`

Toast notifications for:
- Referral code copied to clipboard
- Referral code applied successfully
- Bonus credits received

Example:
```typescript
toast.success('🎉 Your referral made a purchase! +40 credits earned', {
  duration: 5000,
  icon: '⚡',
});
```

---

## 12. Analytics & Reporting

### 12.1 Admin Dashboard Metrics

Track key referral program metrics:
- Total active referral codes
- Total bonuses distributed
- Conversion rate (referred users → purchasers)
- Top referrers (leaderboard)
- Average bonus per referral
- Revenue attributed to referrals

### 12.2 SQL Queries for Analytics

**Top Referrers Query:**
```sql
SELECT 
  u.email,
  rc.code,
  rc.total_referrals,
  rc.total_earned_credits,
  COUNT(r.id) as successful_referrals
FROM referral_codes rc
JOIN auth.users u ON rc.user_id = u.id
LEFT JOIN referrals r ON r.referrer_user_id = rc.user_id AND r.status = 'rewarded'
GROUP BY u.email, rc.code, rc.total_referrals, rc.total_earned_credits
ORDER BY rc.total_earned_credits DESC
LIMIT 10;
```

**Conversion Rate Query:**
```sql
SELECT 
  COUNT(*) as total_referrals,
  COUNT(CASE WHEN status = 'rewarded' THEN 1 END) as converted,
  ROUND(
    (COUNT(CASE WHEN status = 'rewarded' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as conversion_rate
FROM referrals;
```

---

## 13. Implementation Phases

### Phase 1: Backend Foundation (Week 1)
**Priority: HIGH**

- [ ] Create Supabase database tables (`referral_codes`, `referrals`, `referral_rewards`)
- [ ] Implement referral code generation function
- [ ] Create API endpoint: `GET /api/referral/code`
- [ ] Create API endpoint: `POST /api/referral/apply`
- [ ] Update purchase endpoint to handle referral bonuses
- [ ] Add validation and fraud prevention logic
- [ ] Write unit tests for referral logic

**Deliverables:**
- Working backend API
- Database migrations
- API documentation

### Phase 2: Frontend Core (Week 2)
**Priority: HIGH**

- [ ] Create `types/referral.ts` with TypeScript definitions
- [ ] Create `services/referralApi.ts` API service layer
- [ ] Create `ReferralDashboard` component
- [ ] Update `app/credits/page.tsx` with referral input
- [ ] Implement URL parameter capture logic
- [ ] Add referral code copy/share functionality
- [ ] Integrate toast notifications

**Deliverables:**
- Referral code display and sharing
- Referral application during purchase
- User-facing UI components

### Phase 3: History & Tracking (Week 3)
**Priority: MEDIUM**

- [ ] Create API endpoint: `GET /api/referral/history`
- [ ] Create `ReferralHistoryModal` component
- [ ] Create dedicated `/referrals` page
- [ ] Add referral stats to user profile
- [ ] Implement `ReferralContext` provider
- [ ] Add navigation menu link

**Deliverables:**
- Full referral history view
- Referral statistics dashboard
- Dedicated referrals page

### Phase 4: Polish & Optimization (Week 4)
**Priority: LOW**

- [ ] Add email notifications (optional)
- [ ] Implement admin analytics dashboard
- [ ] Add referral leaderboard
- [ ] Optimize SQL queries for performance
- [ ] Add comprehensive error handling
- [ ] Write end-to-end tests
- [ ] Create user documentation

**Deliverables:**
- Production-ready system
- Admin tools
- Complete documentation

---

## 14. Testing Strategy

### 14.1 Unit Tests

**Backend (Node.js/Jest):**
- Referral code generation uniqueness
- Bonus calculation for each tier
- Fraud validation rules
- Database constraint enforcement

**Frontend (React Testing Library):**
- Component rendering
- Copy-to-clipboard functionality
- Form validation
- API integration

### 14.2 Integration Tests

**Scenarios to Test:**
1. **Happy Path:**
   - User A generates referral code
   - User B signs up with code
   - User B makes first purchase
   - User A receives bonus credits

2. **Edge Cases:**
   - Applying invalid referral code
   - User tries to use own code
   - User already referred tries to apply another code
   - Referral applied after first purchase

3. **Fraud Prevention:**
   - Multiple signups from same IP
   - Rapid purchase patterns
   - Self-referral attempts

### 14.3 Manual QA Checklist

- [ ] Referral code displays correctly
- [ ] Copy button works on all browsers
- [ ] Share links open correct platforms
- [ ] URL parameter captures code correctly
- [ ] Referral applies on purchase
- [ ] Bonus credits reflect immediately
- [ ] History shows accurate data
- [ ] Mobile responsive design
- [ ] Error messages are user-friendly

---

## 15. Environment Variables

Add to `.env.local` and `.env.production.template`:

```bash
# Referral System (Optional - has defaults)
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

**Note:** Used for generating shareable referral URLs.

---

## 16. Documentation Updates

### 16.1 User-Facing Documentation

Create `docs/REFERRAL_PROGRAM.md`:
- How to find your referral code
- How to share your code
- Bonus tier breakdown
- Terms and conditions

### 16.2 Developer Documentation

Update `README.md`:
- Add referral system to features list
- Document new API endpoints
- Update database schema section
- Add environment variables

---

## 17. Success Metrics

**KPIs to Track:**
- Referral sign-up rate (referred users / total referrals)
- Purchase conversion rate (purchases / referred users)
- Average bonus per referrer
- Viral coefficient (new referrals / existing users)
- Revenue per referred user

**Target Goals (3 months):**
- 20% of new users from referrals
- 40% conversion rate (referred → purchaser)
- Average 3 referrals per active referrer

---

## 18. Security Considerations

### 18.1 Data Protection

- ✅ Referral codes are non-sensitive (can be public)
- ✅ Store referral relationships in Supabase (GDPR compliant)
- ✅ User IDs are UUIDs (non-guessable)
- ✅ API endpoints require authentication
- ✅ Rate limiting on sensitive endpoints

### 18.2 Access Control

**Supabase Row Level Security (RLS):**

```sql
-- Users can only read their own referral code
CREATE POLICY "Users can view own referral code"
ON referral_codes FOR SELECT
USING (auth.uid() = user_id);

-- Users can view their own referral history
CREATE POLICY "Users can view own referrals"
ON referrals FOR SELECT
USING (auth.uid() = referrer_user_id);

-- Only backend can insert/update referral data
CREATE POLICY "Service role can manage referrals"
ON referrals FOR ALL
USING (auth.role() = 'service_role');
```

---

## 19. Future Enhancements (Optional)

### 19.1 Gamification

- **Referral Milestones:** Unlock badges for 5, 10, 25 referrals
- **Leaderboard:** Top referrers of the month
- **Bonus Multipliers:** 2x bonus during special events

### 19.2 Social Sharing

- **Pre-filled Tweet:** "Join me on OnChain Alpha Scanner! Use my code: ABC-DEF-GH12"
- **Instagram Story Template:** Custom shareable image
- **WhatsApp Quick Share:** Deep link for mobile

### 19.3 Advanced Tracking

- **Attribution Analytics:** Track which platforms drive most conversions
- **A/B Testing:** Test different bonus structures
- **Cohort Analysis:** Referred vs non-referred user behavior

---

## 20. Rollout Plan

### Soft Launch (Week 1-2)
- Deploy to staging environment
- Internal team testing
- Invite 20 beta users
- Monitor for bugs

### Limited Release (Week 3-4)
- Enable for 20% of users
- Monitor system performance
- Collect user feedback
- Fix edge cases

### Full Launch (Week 5+)
- Enable for all users
- Announcement email campaign
- Social media promotion
- Monitor KPIs daily

---

## 21. Cost Estimation

### Development Time
- Backend: 20-25 hours
- Frontend: 25-30 hours
- Testing: 10-15 hours
- **Total:** ~60 hours

### Infrastructure
- Supabase: $0 (within free tier for <50k users)
- Render Backend: $0 (existing)
- No additional hosting costs

### Potential ROI
- If 10% of users refer 2 people each → 20% user growth
- If referred users convert at 40% → significant revenue increase
- Cost of implementation < 1 week of developer time

---

## Summary

This referral system provides a **complete, production-ready solution** with:

✅ **Tiered bonus structure** (10-25% based on purchase tier)  
✅ **Unique referral codes** for every user  
✅ **Fraud prevention** mechanisms  
✅ **Full tracking and analytics**  
✅ **Mobile-responsive UI**  
✅ **Backend API integration**  
✅ **Supabase database schema**  

**Next Steps:**
1. Review and approve this plan
2. Set up Supabase tables (Phase 1)
3. Implement backend API endpoints (Phase 1)
4. Build frontend components (Phase 2)
5. Test and deploy (Phase 3-4)

**Estimated Timeline:** 4 weeks for full implementation  
**Priority:** Start with Phase 1 (Backend Foundation)

---

**Questions or modifications needed?** Let me know and I'll adjust the plan accordingly! 🚀

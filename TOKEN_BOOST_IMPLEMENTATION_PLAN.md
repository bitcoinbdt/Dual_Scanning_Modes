# Token Boost/Advertising Feature - Implementation Plan

## Overview
A credit-based token advertising system where users can submit tokens for featured placement across the platform. Admin approval is required before ads go live. Credits are deducted upfront and refunded if rejected.

---

## 1. Feature Placement Locations

### Current Locations Identified:
Based on the screenshot provided and codebase analysis:

1. **Home Page (Scanner Page) - Top Boosted Section**
   - Location: Above the scan terminal
   - Display: Horizontal scrolling carousel of boosted tokens
   - Shows: Token logo, name, symbol, price, boost indicator
   - Priority: HIGH (Most visible)

2. **Agent Page - Featured Tokens Banner**
   - Location: Below control panel, above results
   - Display: Featured token cards
   - Shows: Logo, symbol, performance metrics
   - Priority: MEDIUM

3. **Pricing Page - Sponsored Tokens Section**
   - Location: Between pricing cards and footer
   - Display: Grid of featured tokens
   - Priority: LOW

4. **Navigation Bar - Rotating Featured Token**
   - Location: Between navigation links and credit badge
   - Display: Small rotating token badge
   - Shows: Logo + symbol
   - Priority: LOW

---

## 2. Database Schema

### New Tables Required:

#### `token_boost_requests`
```sql
CREATE TABLE public.token_boost_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Token Information
  token_logo_url TEXT NOT NULL,
  token_contract_address TEXT NOT NULL,
  token_name TEXT,
  token_symbol TEXT,
  blockchain VARCHAR(20) NOT NULL, -- 'solana', 'ethereum', 'bsc'
  
  -- Boost Details
  duration_hours INTEGER NOT NULL, -- 6, 12, 24, 36
  credits_cost INTEGER NOT NULL,
  
  -- Status & Timestamps
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'active', 'expired'
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Admin Review
  rejection_reason TEXT,
  admin_notes TEXT,
  
  -- Metadata
  metadata JSONB, -- Additional info (impressions, clicks, etc.)
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'expired')),
  CONSTRAINT valid_duration CHECK (duration_hours IN (6, 12, 24, 36)),
  CONSTRAINT valid_blockchain CHECK (blockchain IN ('solana', 'ethereum', 'bsc')),
  CONSTRAINT valid_credits CHECK (credits_cost > 0)
);

CREATE INDEX idx_boost_user_id ON public.token_boost_requests(user_id);
CREATE INDEX idx_boost_status ON public.token_boost_requests(status);
CREATE INDEX idx_boost_active ON public.token_boost_requests(status, expires_at) 
  WHERE status = 'active' AND expires_at > NOW();
CREATE INDEX idx_boost_pending ON public.token_boost_requests(status, requested_at DESC) 
  WHERE status = 'pending';
```

#### `token_boost_analytics` (Optional - Phase 2)
```sql
CREATE TABLE public.token_boost_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boost_request_id UUID REFERENCES public.token_boost_requests(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  scans_triggered INTEGER DEFAULT 0,
  UNIQUE(boost_request_id, date)
);
```

---

## 3. Pricing Structure

### Credit Costs Based on Duration:
```javascript
const BOOST_PRICING = {
  6: 50,   // 6 hours = 50 credits
  12: 90,  // 12 hours = 90 credits (10% discount)
  24: 160, // 24 hours = 160 credits (20% discount)
  36: 220, // 36 hours = 220 credits (25% discount)
};
```

### Placement Priority:
- All approved boosts rotate equally
- FIFO (First In, First Out) for same-time approvals
- Expired boosts automatically removed

---

## 4. User Flow

### Step 1: Access Advertising Page
- **Entry Point**: New "Advertising" link in navigation menu
- **Route**: `/advertising` or `/boost`
- **Protection**: Requires authentication

### Step 2: Submit Boost Request
**Form Fields:**
1. Token Logo URL (required)
   - Validation: Valid image URL (jpg, png, webp, gif)
   - Preview shown
   
2. Token Contract Address (required)
   - Validation: Valid blockchain address format
   - Auto-detect blockchain if possible
   
3. Blockchain Selection (required)
   - Dropdown: Solana, Ethereum, BSC
   
4. Duration (required)
   - Dropdown: 6 hrs, 12 hrs, 24 hrs, 36 hrs
   - Shows credit cost next to each option
   
5. Additional Info (optional)
   - Token name
   - Token symbol
   - Website
   - Description (max 200 chars)

**Submission Process:**
1. Check if user has enough credits
2. Show confirmation modal with cost breakdown
3. Deduct credits on confirmation
4. Create `token_boost_requests` entry with status='pending'
5. Create credit transaction record (type='boost_purchase')
6. Show success message: "Request submitted! Awaiting admin approval."

### Step 3: Admin Review
- Admin navigates to `/admin/boost-requests`
- Views pending requests in a table/card grid
- For each request, can:
  - **Approve**: Sets status='approved', starts_at=NOW(), expires_at=NOW() + duration
  - **Reject**: Sets status='rejected', prompts for rejection_reason
  
### Step 4: Credit Refund (if rejected)
- Automatic refund transaction created
- User receives notification
- Credits returned to balance

### Step 5: Active Display
- Approved boosts shown in designated locations
- Auto-expire when `expires_at` is reached (cron job or on-query check)

---

## 5. API Endpoints

### User Endpoints:

#### `POST /api/boost/submit`
**Request:**
```json
{
  "tokenLogoUrl": "https://...",
  "tokenContractAddress": "0x...",
  "blockchain": "ethereum",
  "durationHours": 12,
  "tokenName": "MyToken",
  "tokenSymbol": "MTK",
  "website": "https://...",
  "description": "..."
}
```
**Response:**
```json
{
  "success": true,
  "boostId": "uuid",
  "creditsDeducted": 90,
  "newBalance": 410,
  "message": "Boost request submitted for admin review"
}
```

#### `GET /api/boost/my-requests`
**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "status": "pending",
      "durationHours": 12,
      "creditsSpent": 90,
      "requestedAt": "2024-...",
      "tokenInfo": {...}
    }
  ]
}
```

#### `GET /api/boost/active`
**Response:**
```json
{
  "boosts": [
    {
      "id": "uuid",
      "tokenLogoUrl": "...",
      "tokenContractAddress": "...",
      "tokenName": "...",
      "tokenSymbol": "...",
      "blockchain": "ethereum",
      "expiresAt": "2024-..."
    }
  ]
}
```

### Admin Endpoints:

#### `GET /api/admin/boost-requests`
**Query Params:** `?status=pending|approved|rejected`
**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userEmail": "user@example.com",
      "status": "pending",
      "tokenInfo": {...},
      "durationHours": 12,
      "creditsSpent": 90,
      "requestedAt": "2024-..."
    }
  ]
}
```

#### `POST /api/admin/boost-requests/:id/approve`
**Response:**
```json
{
  "success": true,
  "boostId": "uuid",
  "startsAt": "2024-...",
  "expiresAt": "2024-..."
}
```

#### `POST /api/admin/boost-requests/:id/reject`
**Request:**
```json
{
  "reason": "Token logo is inappropriate"
}
```
**Response:**
```json
{
  "success": true,
  "creditsRefunded": 90,
  "message": "Request rejected and credits refunded"
}
```

---

## 6. Frontend Components

### New Pages:

#### `/app/advertising/page.tsx`
- Main advertising submission page
- Shows:
  - Boost request form
  - Pricing table
  - User's active/pending boosts
  - FAQ section

#### `/app/admin/boost-requests/page.tsx`
- Admin review dashboard
- Tabs: Pending / Approved / Rejected / Active / Expired
- Filterable table/grid
- Quick approve/reject actions

### New Components:

#### `components/boost/BoostRequestForm.tsx`
- Controlled form with validation
- Real-time credit cost calculation
- Image URL preview
- Confirmation modal

#### `components/boost/BoostedTokenBanner.tsx`
- Displays active boosted tokens
- Responsive carousel/grid
- Used in multiple pages
- Props: `placement` ('home' | 'agent' | 'pricing')

#### `components/boost/MyBoostRequests.tsx`
- User's boost history
- Status badges
- Countdown timer for active boosts

#### `components/admin/BoostRequestCard.tsx`
- Single boost request review card
- Token preview
- User info
- Approve/Reject buttons

---

## 7. Backend Logic

### Credit Deduction Function:
```sql
CREATE OR REPLACE FUNCTION deduct_boost_credits(
  p_user_id UUID,
  p_boost_id UUID,
  p_credits INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  -- Calculate current balance
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('purchase', 'bonus', 'refund') THEN amount
      WHEN type IN ('scan_deduction', 'boost_purchase') THEN amount
      ELSE 0
    END
  ), 0) INTO v_current_balance
  FROM public.credit_transactions
  WHERE user_id = p_user_id;
  
  -- Check sufficient balance
  IF v_current_balance < p_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient credits'
    );
  END IF;
  
  -- Create deduction transaction
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'boost_purchase',
    -p_credits,
    v_current_balance - p_credits,
    'Token boost advertising fee',
    jsonb_build_object('boost_id', p_boost_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'newBalance', v_current_balance - p_credits
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Credit Refund Function:
```sql
CREATE OR REPLACE FUNCTION refund_boost_credits(
  p_boost_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_boost RECORD;
  v_current_balance INTEGER;
BEGIN
  -- Get boost details
  SELECT * INTO v_boost
  FROM public.token_boost_requests
  WHERE id = p_boost_id;
  
  IF v_boost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Boost not found');
  END IF;
  
  -- Calculate current balance
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('purchase', 'bonus', 'refund') THEN amount
      WHEN type IN ('scan_deduction', 'boost_purchase') THEN amount
      ELSE 0
    END
  ), 0) INTO v_current_balance
  FROM public.credit_transactions
  WHERE user_id = v_boost.user_id;
  
  -- Create refund transaction
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    v_boost.user_id,
    'refund',
    v_boost.credits_cost,
    v_current_balance + v_boost.credits_cost,
    'Boost request rejected - credits refunded',
    jsonb_build_object('boost_id', p_boost_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'refundedCredits', v_boost.credits_cost,
    'newBalance', v_current_balance + v_boost.credits_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 8. Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Database schema creation
- [ ] Credit deduction/refund functions
- [ ] API endpoints (user submission, admin review)
- [ ] Admin dashboard page

### Phase 2: User Interface (Week 2)
- [ ] Advertising submission page
- [ ] Boost request form component
- [ ] My boost requests component
- [ ] Navigation link addition

### Phase 3: Display Integration (Week 3)
- [ ] BoostedTokenBanner component
- [ ] Integration on Home page
- [ ] Integration on Agent page
- [ ] Integration on Pricing page

### Phase 4: Polish & Testing (Week 4)
- [ ] Validation improvements
- [ ] Error handling
- [ ] Loading states
- [ ] Email notifications (optional)
- [ ] Analytics tracking (optional)

---

## 9. Security Considerations

1. **Image URL Validation**
   - Check valid image formats
   - Prevent XSS via data URIs
   - Optional: Store images on own CDN

2. **Rate Limiting**
   - Max 5 boost submissions per user per day
   - Prevent spam

3. **Admin Authentication**
   - Verify admin role before approval/rejection
   - Log all admin actions

4. **Credit Transaction Integrity**
   - Use database transactions
   - Prevent double-spending
   - Audit trail via credit_transactions table

---

## 10. Future Enhancements (Phase 2)

1. **Analytics Dashboard**
   - Track impressions, clicks, scans
   - ROI metrics for advertisers

2. **Auto-renewal**
   - Option to auto-renew boosts
   - Pre-authorize credit deductions

3. **Premium Placements**
   - Different pricing tiers
   - Guaranteed top position

4. **Bulk Discounts**
   - Package deals for multiple boosts
   - Monthly subscriptions

5. **Targeting Options**
   - Geographic targeting
   - Time-of-day targeting
   - User segment targeting

---

## 11. Success Metrics

- Number of boost submissions per week
- Approval/rejection rate
- Average boost duration purchased
- Credits spent on boosts vs other features
- User retention after first boost

---

## Implementation Status: NOT STARTED
**Next Step:** Review and approve this plan, then begin Phase 1 implementation.

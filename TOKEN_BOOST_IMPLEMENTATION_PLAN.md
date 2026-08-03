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
   - Shows: Token logo, name, symbol, **live price from CoinGecko**, boost indicator
   - Interaction: **Click to auto-populate scanner input field** (no auto-scan)
   - Priority: HIGH (Most visible)

2. **Agent Page - Featured Tokens Banner**
   - Location: Below control panel, above results
   - Display: Featured token cards
   - Shows: Logo, symbol, live price, performance metrics
   - Interaction: **Click to navigate to home page with pre-filled address**
   - Priority: MEDIUM

3. **Pricing Page - Sponsored Tokens Section**
   - Location: Between pricing cards and footer
   - Display: Grid of featured tokens
   - Shows: Logo, symbol, live price
   - Interaction: **Click to navigate to home page with pre-filled address**
   - Priority: LOW

4. **Navigation Bar - Rotating Featured Token**
   - Location: Between navigation links and credit badge
   - Display: Small rotating token badge
   - Shows: Logo + symbol + live price
   - Interaction: **Click to navigate to home page with pre-filled address**
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
  token_name TEXT NOT NULL, -- REQUIRED: User-provided token name
  token_symbol TEXT NOT NULL, -- REQUIRED: User-provided token symbol
  token_logo_url TEXT NOT NULL,
  token_contract_address TEXT NOT NULL,
  blockchain VARCHAR(20) NOT NULL, -- 'solana', 'ethereum', 'bsc'
  coingecko_id TEXT, -- CoinGecko API token ID for live price fetching
  
  -- Live Price Data (cached)
  current_price_usd DECIMAL(20, 10),
  price_change_24h DECIMAL(10, 2),
  last_price_update TIMESTAMP WITH TIME ZONE,
  
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

#### `token_boost_analytics` (Simplified)
```sql
CREATE TABLE public.token_boost_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boost_request_id UUID REFERENCES public.token_boost_requests(id) ON DELETE CASCADE,
  
  -- Analytics Data (Simplified - only scan count)
  total_scans INTEGER DEFAULT 0, -- Total number of scans triggered from this boost
  last_scan_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(boost_request_id)
);

CREATE INDEX idx_boost_analytics_boost_id ON public.token_boost_analytics(boost_request_id);
```

**Note:** We track only the **total scan count** without differentiating between Basic and Elevator scans. This keeps analytics simple and focused on advertiser ROI.

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
1. Token Name (required)
   - Validation: 1-50 characters
   - Example: "Giga Cat"
   
2. Token Symbol (required)
   - Validation: 1-10 characters, uppercase recommended
   - Example: "GICAT"
   
3. Token Logo URL (required)
   - Validation: Valid image URL (jpg, png, webp, gif)
   - Preview shown
   
4. Token Contract Address (required)
   - Validation: Valid blockchain address format
   - Auto-detect blockchain if possible
   
5. Blockchain Selection (required)
   - Dropdown: Solana, Ethereum, BSC
   
6. Duration (required)
   - Dropdown: 6 hrs, 12 hrs, 24 hrs, 36 hrs
   - Shows credit cost next to each option
   
7. Additional Info (optional)
   - Website
   - Description (max 200 chars)
   - CoinGecko ID (for automatic price fetching)

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
  "tokenName": "Giga Cat",
  "tokenSymbol": "GICAT",
  "tokenLogoUrl": "https://...",
  "tokenContractAddress": "0x...",
  "blockchain": "ethereum",
  "durationHours": 12,
  "website": "https://...",
  "description": "...",
  "coingeckoId": "giga-cat" // optional
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

**Validation Rules:**
- `tokenName`: Required, 1-50 characters
- `tokenSymbol`: Required, 1-10 characters
- `tokenLogoUrl`: Required, valid image URL
- `tokenContractAddress`: Required, valid blockchain address format
- `blockchain`: Required, one of ['solana', 'ethereum', 'bsc']
- `durationHours`: Required, one of [6, 12, 24, 36]

#### `GET /api/boost/my-requests`
**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "status": "active",
      "durationHours": 12,
      "creditsSpent": 90,
      "requestedAt": "2024-...",
      "expiresAt": "2024-...",
      "tokenInfo": {
        "name": "Giga Cat",
        "symbol": "GICAT",
        "logoUrl": "...",
        "contractAddress": "0x..."
      },
      "analytics": {
        "totalScans": 47,
        "lastScanAt": "2024-..."
      }
    }
  ]
}
```

**Note:** Analytics only shows `totalScans` - no breakdown by scan type (Basic vs Elevator).

#### `GET /api/boost/active`
**Description:** Fetch all active boosted tokens with live price data
**Response:**
```json
{
  "boosts": [
    {
      "id": "uuid",
      "tokenLogoUrl": "...",
      "tokenContractAddress": "0x1234...",
      "tokenName": "MyToken",
      "tokenSymbol": "MTK",
      "blockchain": "ethereum",
      "currentPriceUsd": 0.00045,
      "priceChange24h": 15.3,
      "lastPriceUpdate": "2024-...",
      "expiresAt": "2024-..."
    }
  ]
}
```

#### `GET /api/boost/price/:boostId`
**Description:** Fetch fresh price data from CoinGecko for a specific boost
**Response:**
```json
{
  "success": true,
  "priceUsd": 0.00045,
  "priceChange24h": 15.3,
  "updatedAt": "2024-..."
}
```

#### `POST /api/boost/track-scan`
**Description:** Track when a boosted token is scanned (called after user clicks "Scan" button)
**Request:**
```json
{
  "boostId": "uuid",
  "contractAddress": "0x...",
  "scanType": "BASIC" // or "ELEVATOR" - logged but not differentiated in analytics
}
```
**Response:**
```json
{
  "success": true,
  "totalScans": 48
}
```

**Note:** This endpoint increments the scan counter but does NOT differentiate between Basic and Elevator scans in the analytics display. The scan type is logged for potential future use but not shown to advertisers.

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
- **Required fields:** Token Name, Token Symbol, Logo URL, Contract Address, Blockchain, Duration
- Real-time credit cost calculation
- Image URL preview
- Optional CoinGecko ID field for automatic price fetching
- Form validation with error messages
- Confirmation modal showing all submitted data before credit deduction

#### `components/boost/BoostedTokenBanner.tsx`
- Displays active boosted tokens with **live prices**
- Responsive carousel/grid
- **Click handler: Populates scanner input with contract address**
- Displays: Logo, Symbol, Name, Live Price, 24h Change
- Price refresh every 60 seconds
- Used in multiple pages
- Props: `placement` ('home' | 'agent' | 'pricing'), `onTokenClick?: (address: string) => void`

#### `components/boost/BoostedTokenCard.tsx`
- Single boosted token display card
- Shows: Logo, Name, Symbol, Live Price (with up/down indicator), 24h % change
- Hover effect with glow
- Click handler to populate scanner or navigate
- Skeleton loading state while fetching prices

#### `components/boost/MyBoostRequests.tsx`
- User's boost history
- Status badges (pending, active, approved, rejected, expired)
- Countdown timer for active boosts
- **Analytics section showing total scans** (no breakdown by scan type)
- Current price for active boosts
- Time remaining display
- Quick action buttons (extend duration, etc. - Phase 2)

#### `components/admin/BoostRequestCard.tsx`
- Single boost request review card
- Token preview
- User info
- **Price lookup tool** to verify token exists on CoinGecko
- Approve/Reject buttons

---

## 7. Live Price Integration (CoinGecko API)

### Price Fetching Strategy:

#### On Boost Approval:
1. Admin approves boost request
2. Backend attempts to fetch token price from CoinGecko API
3. If found, stores `coingecko_id` and initial price data
4. If not found, price shows as "N/A" (boost still displays)

#### Ongoing Price Updates:
**Option A: Server-Side Cron Job (Recommended)**
- Run every 5 minutes
- Update all active boosts' price data
- Prevents API rate limiting
- Users see cached prices (max 5min stale)

**Option B: Client-Side Fetch**
- Each component fetches prices on mount
- Cache in React context for 60 seconds
- Higher API usage, more real-time

#### CoinGecko API Endpoints:

**Get Token Price by Contract Address:**
```javascript
// Ethereum example
GET https://api.coingecko.com/api/v3/simple/token_price/ethereum
?contract_addresses=0x...
&vs_currencies=usd
&include_24hr_change=true

// Solana example
GET https://api.coingecko.com/api/v3/simple/token_price/solana
?contract_addresses=TOKEN_ADDRESS
&vs_currencies=usd
&include_24hr_change=true

// BSC example
GET https://api.coingecko.com/api/v3/simple/token_price/binance-smart-chain
?contract_addresses=0x...
&vs_currencies=usd
&include_24hr_change=true
```

**Response Example:**
```json
{
  "0x1234...": {
    "usd": 0.00045,
    "usd_24h_change": 15.3
  }
}
```

### Backend Service:

#### `services/coingeckoService.ts`
```typescript
interface TokenPrice {
  priceUsd: number | null;
  priceChange24h: number | null;
  lastUpdated: Date;
}

async function fetchTokenPrice(
  contractAddress: string, 
  blockchain: 'solana' | 'ethereum' | 'bsc'
): Promise<TokenPrice> {
  const platformMap = {
    ethereum: 'ethereum',
    bsc: 'binance-smart-chain',
    solana: 'solana'
  };
  
  const platform = platformMap[blockchain];
  const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}`;
  
  try {
    const response = await fetch(
      `${url}?contract_addresses=${contractAddress}&vs_currencies=usd&include_24hr_change=true`
    );
    
    const data = await response.json();
    const tokenData = data[contractAddress.toLowerCase()];
    
    if (!tokenData) {
      return { priceUsd: null, priceChange24h: null, lastUpdated: new Date() };
    }
    
    return {
      priceUsd: tokenData.usd,
      priceChange24h: tokenData.usd_24h_change,
      lastUpdated: new Date()
    };
  } catch (error) {
    console.error('CoinGecko fetch error:', error);
    return { priceUsd: null, priceChange24h: null, lastUpdated: new Date() };
  }
}

// Batch update function for cron job
async function updateAllActiveBoostPrices() {
  const activeBoosts = await db.query(`
    SELECT id, token_contract_address, blockchain 
    FROM token_boost_requests 
    WHERE status = 'active' AND expires_at > NOW()
  `);
  
  for (const boost of activeBoosts) {
    const priceData = await fetchTokenPrice(
      boost.token_contract_address, 
      boost.blockchain
    );
    
    await db.query(`
      UPDATE token_boost_requests 
      SET 
        current_price_usd = $1,
        price_change_24h = $2,
        last_price_update = $3
      WHERE id = $4
    `, [
      priceData.priceUsd,
      priceData.priceChange24h,
      priceData.lastUpdated,
      boost.id
    ]);
  }
}
```

### Rate Limiting Considerations:
- **CoinGecko Free Tier:** 10-50 calls/minute
- **Solution:** Cache prices for 5 minutes minimum
- **Fallback:** If API fails, show last known price with "stale" indicator

---

## 8. Click-to-Scan Functionality

### User Interaction Flow:

#### On Home Page (Scanner Page):
1. User sees boosted token banner above scan terminal
2. User clicks on a boosted token card
3. **Scanner input field is auto-populated** with token contract address
4. **No automatic scan is triggered**
5. User can review the address and click "Scan" button manually
6. User retains full control over when to spend credits

#### On Other Pages (Agent, Pricing, Navigation):
1. User clicks on boosted token
2. **Redirects to home page** with query parameter: `/?address=0x1234...`
3. Home page component reads query param and populates input field
4. User can scan when ready

### Implementation:

#### Home Page Component Update:
```typescript
// app/page.tsx (HomePageContent component)

const router = useRouter();
const searchParams = useSearchParams();

// Auto-populate from query param or boosted token click
useEffect(() => {
  const addressParam = searchParams.get('address');
  if (addressParam) {
    setAddress(addressParam);
    toast.info('Token address loaded. Click "Scan" when ready.');
  }
}, [searchParams]);

// Handler for boosted token click
const handleBoostedTokenClick = (contractAddress: string) => {
  setAddress(contractAddress);
  // Scroll to scanner input
  document.getElementById('scanner-input')?.scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center' 
  });
  toast.info('Token address loaded. Review and scan when ready.');
};
```

#### BoostedTokenBanner Component:
```typescript
// components/boost/BoostedTokenBanner.tsx

interface Props {
  placement: 'home' | 'agent' | 'pricing';
  onTokenClick?: (address: string) => void;
}

export function BoostedTokenBanner({ placement, onTokenClick }: Props) {
  const router = useRouter();
  const [boosts, setBoosts] = useState<BoostedToken[]>([]);
  
  const handleClick = (boost: BoostedToken) => {
    // Track click analytics
    trackBoostClick(boost.id);
    
    if (placement === 'home' && onTokenClick) {
      // Direct populate on home page
      onTokenClick(boost.tokenContractAddress);
    } else {
      // Navigate to home with address param
      router.push(`/?address=${boost.tokenContractAddress}`);
    }
  };
  
  return (
    <div className="boosted-tokens-banner">
      {boosts.map(boost => (
        <BoostedTokenCard 
          key={boost.id}
          boost={boost}
          onClick={() => handleClick(boost)}
        />
      ))}
    </div>
  );
}
```

#### BoostedTokenCard Component:
```typescript
// components/boost/BoostedTokenCard.tsx

interface BoostedToken {
  id: string;
  tokenLogoUrl: string;
  tokenContractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  currentPriceUsd: number | null;
  priceChange24h: number | null;
  blockchain: string;
}

export function BoostedTokenCard({ 
  boost, 
  onClick 
}: { 
  boost: BoostedToken; 
  onClick: () => void;
}) {
  const priceUp = (boost.priceChange24h ?? 0) >= 0;
  
  return (
    <button
      onClick={onClick}
      className="glass-strong rounded-xl p-4 hover:glow-primary transition cursor-pointer text-left"
    >
      <div className="flex items-center gap-3">
        <img 
          src={boost.tokenLogoUrl} 
          alt={boost.tokenSymbol}
          className="w-12 h-12 rounded-full"
        />
        <div className="flex-1">
          <div className="font-bold text-themed">{boost.tokenSymbol}</div>
          <div className="text-xs text-muted-themed">{boost.tokenName}</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-themed">
            {boost.currentPriceUsd 
              ? `$${boost.currentPriceUsd.toFixed(6)}`
              : 'N/A'
            }
          </div>
          {boost.priceChange24h !== null && (
            <div className={`text-xs ${priceUp ? 'text-green-400' : 'text-red-400'}`}>
              {priceUp ? '▲' : '▼'} {Math.abs(boost.priceChange24h).toFixed(2)}%
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 text-[10px] text-primary-themed flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-primary-themed animate-pulse" />
        Featured • Click to scan
      </div>
    </button>
  );
}
```

### **IMPORTANT: Compact Card Design Note**

⚠️ **Keep cards compact to maximize ad space!** 

Based on user feedback, the boosted token cards should be **small and horizontal** to fit more ads in the carousel. Reference design:

```
┌─────────────────────────────────────┐
│ [Logo] TOKEN_SYMBOL 🚀 100         │
│        $0.002861                    │
└─────────────────────────────────────┘
```

**Dimensions:**
- Height: ~60-70px (compact)
- Width: ~180-220px (narrow)
- Layout: Horizontal (logo + text + price side-by-side)
- No extra spacing or padding beyond essentials

**Compact Design Benefits:**
- More tokens visible in carousel without scrolling
- Faster visual scanning for users
- Cleaner, less cluttered interface
- Mobile-friendly

**Implementation:**
```tsx
// Compact version
<div className="flex items-center gap-2 p-2 rounded-lg glass hover:glow-primary cursor-pointer">
  <img src={logo} className="w-10 h-10 rounded-full" />
  <div className="flex-1 min-w-0">
    <div className="font-bold text-sm truncate flex items-center gap-1">
      {symbol} 
      {boost && <span className="text-xs">🚀 {boost}</span>}
    </div>
    <div className="text-xs text-themed">${price}</div>
  </div>
</div>
```

This compact design allows **5-7 tokens visible at once** in the horizontal carousel vs **2-3 with larger cards**.

### Scanner Input Field Update:
```typescript
// Add ID for scroll targeting
<input
  id="scanner-input"
  type="text"
  value={address}
  onChange={(e) => setAddress(e.target.value)}
  placeholder="Paste Token Contract Address..."
  className="..."
/>
```

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
- [ ] Database schema creation (with price fields)
- [ ] Credit deduction/refund functions
- [ ] API endpoints (user submission, admin review)
- [ ] Admin dashboard page
- [ ] **CoinGecko service integration**
- [ ] **Price fetching cron job setup**

### Phase 2: User Interface (Week 2)
- [ ] Advertising submission page
- [ ] Boost request form component (with CoinGecko ID field)
- [ ] My boost requests component
- [ ] Navigation link addition
- [ ] **BoostedTokenCard component with live prices**

### Phase 3: Display Integration (Week 3)
- [ ] BoostedTokenBanner component
- [ ] **Click-to-populate functionality on Home page**
- [ ] **Query param handling for address pre-fill**
- [ ] Integration on Home page (above scanner)
- [ ] Integration on Agent page
- [ ] Integration on Pricing page
- [ ] **Price refresh mechanism (polling or WebSocket)**

### Phase 4: Polish & Testing (Week 4)
- [ ] Validation improvements
- [ ] Error handling for CoinGecko API failures
- [ ] Loading states and skeleton screens
- [ ] **Price staleness indicators**
- [ ] **Scan tracking verification and testing**
- [ ] **Analytics display in user dashboard**
- [ ] Email notifications (optional)
- [ ] **Test scan tracking accuracy**

---

## 9. Scan Tracking & Analytics

### How Scan Tracking Works:

#### When User Scans a Boosted Token:

1. User clicks on boosted token card
2. Contract address is populated in scanner input field
3. User clicks "Scan" button (Basic or Elevator mode)
4. **Before scan executes**, frontend calls `/api/boost/track-scan`
5. Backend increments `total_scans` counter in `token_boost_analytics`
6. Scan proceeds normally

#### Implementation in Scanner:

```typescript
// app/page.tsx - Updated handleScan function

const handleScan = async (addr: string, type: 'BASIC' | 'ELEVATOR') => {
  if (!isAuthenticated) {
    toast.error('Please login to scan tokens');
    return;
  }

  // Check if this address came from a boosted token
  const boostId = sessionStorage.getItem('lastClickedBoostId');
  
  if (boostId) {
    // Track the scan for analytics
    try {
      await fetch('/api/boost/track-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boostId,
          contractAddress: addr,
          scanType: type // Logged but not shown in analytics
        })
      });
      // Clear the boost tracking
      sessionStorage.removeItem('lastClickedBoostId');
    } catch (err) {
      console.error('Failed to track boost scan:', err);
      // Don't block the scan if tracking fails
    }
  }

  // Continue with normal scan logic...
  const required = type === 'ELEVATOR' ? elevatorCredits : SCAN_COSTS[type];
  if (!hasEnoughCredits(required)) {
    setShowInsufficientCredits(true);
    return;
  }
  
  // ... rest of scan logic
};
```

#### Tracking Setup in BoostedTokenBanner:

```typescript
// components/boost/BoostedTokenBanner.tsx

const handleClick = (boost: BoostedToken) => {
  // Store boost ID for scan tracking
  sessionStorage.setItem('lastClickedBoostId', boost.id);
  
  if (placement === 'home' && onTokenClick) {
    onTokenClick(boost.tokenContractAddress);
  } else {
    router.push(`/?address=${boost.tokenContractAddress}`);
  }
};
```

### Analytics Display (Simplified):

#### For Advertisers (in MyBoostRequests component):

```
┌──────────────────────────────────────────────────────┐
│  Your Boost: GICAT                                   │
│  Status: Active (8 hours remaining)                  │
│  ──────────────────────────────────────────────────  │
│  📊 Performance                                       │
│  Total Scans: 47                                     │
│  Last Scan: 2 minutes ago                            │
└──────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ Shows total scan count only
- ❌ No breakdown by Basic vs Elevator
- ❌ No impressions (too complex to track reliably)
- ❌ No clicks (clicks = scans in our simplified model)
- ✅ Shows last scan timestamp
- ✅ Simple, clear, and actionable

### Database Function for Tracking:

```sql
CREATE OR REPLACE FUNCTION increment_boost_scan_count(
  p_boost_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_current_count INTEGER;
BEGIN
  -- Check if boost is active
  IF NOT EXISTS (
    SELECT 1 FROM public.token_boost_requests
    WHERE id = p_boost_id 
      AND status = 'active'
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Boost is not active or has expired'
    );
  END IF;
  
  -- Insert or update analytics record
  INSERT INTO public.token_boost_analytics (
    boost_request_id,
    total_scans,
    last_scan_at
  ) VALUES (
    p_boost_id,
    1,
    NOW()
  )
  ON CONFLICT (boost_request_id) 
  DO UPDATE SET
    total_scans = token_boost_analytics.total_scans + 1,
    last_scan_at = NOW(),
    updated_at = NOW()
  RETURNING total_scans INTO v_current_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'totalScans', v_current_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Why Only Total Scans?

1. **Simplicity**: Easy to understand for advertisers
2. **Clarity**: One clear metric = better decision making
3. **Privacy**: Don't expose detailed user behavior
4. **Performance**: Less database overhead
5. **Focus**: Scans are the primary conversion metric

---

## 10. Security Considerations

1. **Image URL Validation**
   - Check valid image formats
   - Prevent XSS via data URIs
   - Optional: Store images on own CDN

2. **Input Validation & Sanitization**
   - **Token Name:** Required, sanitize HTML/scripts, 1-50 chars
   - **Token Symbol:** Required, sanitize, 1-10 chars, alphanumeric only
   - **Logo URL:** Required, validate image format, check for malicious URLs
   - **Contract Address:** Required, validate format per blockchain
   - Prevent SQL injection, XSS, and other attacks

3. **Rate Limiting**
   - Max 5 boost submissions per user per day
   - Prevent spam
   - **CoinGecko API rate limiting (cache responses)**

4. **Admin Authentication**
   - Verify admin role before approval/rejection
   - Log all admin actions

5. **Credit Transaction Integrity**
   - Use database transactions
   - Prevent double-spending
   - Audit trail via credit_transactions table

6. **Click Fraud Prevention**
   - Track IP addresses for click analytics
   - Rate limit clicks per user/IP
   - Detect bot patterns

7. **Contract Address Validation**
   - Validate address format for each blockchain
   - Prevent injection attacks
   - Sanitize before database storage

---

## 11. Future Enhancements (Phase 2)

1. **Extended Analytics** (Optional)
   - Daily scan trends (chart showing scans per day)
   - Peak scan hours
   - Geographic distribution (if available)
   - **Still no Basic vs Elevator breakdown** - keep it simple

2. **Auto-renewal**
   - Option to auto-renew boosts
   - Pre-authorize credit deductions

3. **Premium Placements**
   - Different pricing tiers
   - Guaranteed top position
   - **Sticky header placement**

4. **Bulk Discounts**
   - Package deals for multiple boosts
   - Monthly subscriptions

5. **Targeting Options**
   - Geographic targeting
   - Time-of-day targeting
   - User segment targeting

6. **Enhanced Price Display**
   - **Price charts (sparkline)**
   - **Volume indicators**
   - **Market cap data**
   - **Integration with more price APIs** (DexScreener, CoinMarketCap)

7. **Smart Recommendations**
   - **"Users who scanned this also scanned..."**
   - **Related tokens carousel**

---

## 12. UI/UX Design Specifications

### Boosted Token Card Design (Compact Version)

**Visual Reference:**
```
┌────────────────────────────────┐
│ 🪙 GICAT 🚀 100                │
│    $0.002861                   │
└────────────────────────────────┘
```

**Specifications:**
- **Card Dimensions:** 180-220px width × 60-70px height
- **Layout:** Horizontal (not vertical stacked)
- **Logo Size:** 40px × 40px (circular)
- **Padding:** 8-12px all sides
- **Gaps:** 8px between elements
- **Font Sizes:**
  - Token Symbol: 14px, bold
  - Boost Indicator: 10px
  - Price: 12px, medium weight
  - 24h Change: 10px (optional, can be removed to save space)

**Carousel Layout:**
- **Container:** Horizontal scrolling carousel
- **Visible Cards:** 5-7 tokens at once on desktop, 2-3 on mobile
- **Spacing:** 12px gap between cards
- **Scroll:** Smooth horizontal scroll, no vertical
- **Arrows:** Optional left/right navigation arrows
- **Auto-play:** Optional 5-second auto-advance

**Why Compact Design:**
1. **More Ad Inventory:** Fit 3x more tokens in same space
2. **Better ROI:** More advertisers can be featured simultaneously
3. **User Experience:** Less scrolling, faster browsing
4. **Mobile-First:** Works better on small screens
5. **Revenue:** More ad slots = more revenue potential

**Components to Keep Minimal:**
- ❌ No large token name/description
- ❌ No chart/sparkline (Phase 2 feature)
- ❌ No extra badges/labels beyond boost indicator
- ✅ Logo + Symbol + Price only
- ✅ Optional small boost count indicator (🚀 100)

### Placement-Specific Layouts:

#### Home Page (Above Scanner):
```
┌─────────────────────────────────────────────────────────┐
│  ← [Token1] [Token2] [Token3] [Token4] [Token5] →      │
│     Horizontal scrolling carousel, 5-7 visible          │
└─────────────────────────────────────────────────────────┘
```

#### Agent Page (Below Control Panel):
```
┌─────────────────────────────────────────────────────────┐
│  Featured Tokens: [T1] [T2] [T3] [T4]                   │
│  Static row, no scrolling needed                        │
└─────────────────────────────────────────────────────────┘
```

#### Pricing Page (Between Cards):
```
┌─────────────────────────────────────────────────────────┐
│  Sponsored Tokens                                        │
│  [T1] [T2] [T3] [T4] [T5] [T6]                          │
│  Grid layout, 2 rows × 3 columns                        │
└─────────────────────────────────────────────────────────┘
```

#### Navigation Bar:
```
┌─────────────────────────────────────────────────────────┐
│  Logo | Scanner | Pricing | [🪙 TOKEN $0.001] | Credits │
│  Single rotating token between nav items                │
└─────────────────────────────────────────────────────────┘
```

---

## 13. Success Metrics

- Number of boost submissions per week
- Approval/rejection rate
- Average boost duration purchased
- Credits spent on boosts vs other features
- User retention after first boost
- **Total scans per boost** (primary KPI)
- **Average scans per boost**
- **Scan conversion rate** (clicks → scans)
- **Revenue per boosted token**
- **Repeat advertiser rate**
- **Average time from click to scan**

---

## Implementation Status: NOT STARTED
**Next Step:** Review and approve this plan, then begin Phase 1 implementation.

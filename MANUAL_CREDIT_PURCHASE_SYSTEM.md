# Manual Credit Purchase System

## Overview
Replace the automated Phantom wallet payment system with a manual payment verification system where admins approve credit purchases after users submit transaction proofs.

## System Flow

### User Flow
1. **User selects credit package** (e.g., 100 credits, 500 credits, etc.)
2. **User chooses payment method**:
   - Binance Pay
   - USDT (BEP-20)
   - USDT (TRC-20)
   - Other cryptocurrencies
   - Other payment methods
3. **User sees payment addresses** (configured by admin for each payment method)
4. **User sends payment manually** to the displayed address
5. **User submits transaction hash** via input field
6. **User waits for admin approval**
7. **Credits added to account** after admin approval

### Admin Flow
1. **Admin configures payment addresses** in admin panel
   - Add/edit payment methods (Binance Pay, USDT BEP-20, etc.)
   - Set wallet addresses for each method
   - Enable/disable payment methods
2. **Admin views pending credit requests**
   - See all pending transactions
   - View user details, amount, payment method, transaction hash
3. **Admin verifies transaction**
   - Check transaction hash on blockchain/payment platform
   - Verify amount matches requested credits
4. **Admin approves or rejects request**
   - Approve: Credits added to user account automatically
   - Reject: User notified with reason

## Database Schema

### Tables Needed

#### 1. `payment_methods` table
```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,              -- e.g., "Binance Pay", "USDT BEP-20"
  network VARCHAR(50),                      -- e.g., "BEP-20", "TRC-20", "SOL"
  address TEXT NOT NULL,                    -- Payment address/ID
  qr_code_url TEXT,                         -- Optional QR code image URL
  instructions TEXT,                        -- Payment instructions for users
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `credit_purchase_requests` table
```sql
CREATE TABLE credit_purchase_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_package_id VARCHAR(50) NOT NULL,   -- e.g., "package_100", "package_500"
  credits_amount INTEGER NOT NULL,
  price_usd DECIMAL(10, 2) NOT NULL,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
  transaction_hash TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',     -- pending, approved, rejected
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_requests_status ON credit_purchase_requests(status);
CREATE INDEX idx_credit_requests_user ON credit_purchase_requests(user_id);
```

## Pages to Create

### 1. User-Facing Pages
- **`/credits/purchase`** - Credit purchase page (already exists, needs modification)
  - Select credit package
  - Choose payment method
  - View payment address
  - Submit transaction hash
  - View request status

- **`/credits/history`** - Purchase history (optional)
  - View all credit purchase requests
  - See status (pending, approved, rejected)

### 2. Admin Pages (New)
- **`/admin`** - Admin dashboard (route protection needed)
- **`/admin/payment-methods`** - Manage payment methods
  - Add/edit/delete payment addresses
  - Enable/disable payment methods
- **`/admin/credit-requests`** - Review credit purchase requests
  - List pending/all requests
  - View transaction details
  - Approve/reject requests

## Implementation Steps

### Phase 1: Database Setup
1. Create `payment_methods` table
2. Create `credit_purchase_requests` table
3. Add RLS (Row Level Security) policies
4. Create database triggers for credit addition on approval

### Phase 2: Admin Panel
1. Create admin route `/admin`
2. Create admin authentication/role check middleware
3. Implement payment methods management UI
4. Implement credit request review UI
5. Add approve/reject functionality

### Phase 3: User Purchase Flow
1. Modify existing credit store modal
2. Remove Phantom wallet integration
3. Add payment method selection
4. Add transaction hash submission form
5. Add request status tracking

### Phase 4: Backend APIs
1. `/api/admin/payment-methods` - CRUD for payment methods
2. `/api/admin/credit-requests` - Get pending/all requests
3. `/api/admin/credit-requests/[id]/approve` - Approve request
4. `/api/admin/credit-requests/[id]/reject` - Reject request
5. `/api/credits/submit-request` - User submits purchase request
6. `/api/credits/my-requests` - User views their requests

## Security Considerations
- Admin role check on all admin routes
- Rate limiting on transaction hash submission
- Validate transaction hash format
- Prevent duplicate transaction hash submissions
- RLS policies to protect sensitive data

## Status Workflow
```
User submits → PENDING → Admin reviews → APPROVED ✓
                                      ↘ REJECTED ✗
```

## Notes
- Remove all Phantom wallet connection code
- Remove Solana payment processing
- Keep credit packages configuration
- Admin user identification via Supabase role or email whitelist

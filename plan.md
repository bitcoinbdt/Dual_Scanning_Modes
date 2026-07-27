# Scanner Credit System - Implementation Plan

## 🎯 Overview

Transform the Scanner from a subscription-based model to a **pay-per-scan credit system** with Phantom wallet integration. Users purchase credit packages and consume them based on scan complexity.

---

## 💳 Credit System Economics

### Pricing Structure

| Package | Credits | Price (SOL) | Price (USD) | Bonus | Value/Credit |
|---------|---------|-------------|-------------|-------|--------------|
| Starter | 50      | 0.5 SOL     | ~$10        | -     | $0.20        |
| Basic   | 100     | 0.9 SOL     | ~$18        | 10%   | $0.18        |
| Pro     | 200     | 1.6 SOL     | ~$32        | 20%   | $0.16        |
| Premium | 500     | 3.5 SOL     | ~$70        | 30%   | $0.14        |

### Scan Costs

- **Basic Scan**: 2 credits
  - Fast on-chain analysis
  - Core metrics and security audit
  - ~50 scans with Starter package

- **Elevator Scan**: 10 credits
  - Deep blockchain analysis
  - Threat intelligence and trader profiling
  - ~10 scans with Starter package

### Credit Economics
- **No expiration**: Credits never expire
- **No subscription**: One-time purchases only
- **Transparent**: Clear credit balance always visible
- **Fair pricing**: Discount scaling with larger packages

---

## 🎨 Professional UI Design Specification

### 1. Navigation Bar Enhancement

**Current State**: Basic auth + theme selector  
**New State**: Add credit balance display

```
┌─────────────────────────────────────────────────────────────────────┐
│ [OnChain Alpha Logo]              [50 ⚡]  [👤 Profile ▼] [🎨 Theme] │
└─────────────────────────────────────────────────────────────────────┘
         ↑
    Credit Balance Badge (animated, pulse on change)
```

**Credit Balance Badge Design:**
- Pill-shaped container with glass-morphism
- Lightning bolt icon (⚡) + credit count
- Color-coded based on balance:
  - Green (≥100 credits)
  - Yellow (20-99 credits)
  - Orange (10-19 credits)
  - Red (<10 credits) + pulse animation
- Hover tooltip: "X credits remaining"
- Click to open Credit Store modal

---

### 2. Scan Terminal Cost Display

**Enhancement**: Show real-time cost preview in scan terminal

```
┌───────────────────────────────────────────────────────────────┐
│  Acquire Target                                                │
│  Enter a Token Contract Address to initiate reconnaissance.    │
│                                                                 │
│  [Basic Scan] [Elevator Deep Scan]                             │
│                                                                 │
│  🔍 [Input: 0x...________________]  [Scan Button]              │
│                                                                 │
│  Cost: 2 credits ⚡  |  Your Balance: 50 credits               │
│       ↑ dynamic based on scan type                             │
└───────────────────────────────────────────────────────────────┘
```

**Features:**
- Real-time cost indicator below input
- Balance check before scan
- If insufficient credits:
  - Disable scan button
  - Show "Insufficient Credits" message
  - "Buy Credits" CTA button
  - Red glow on credit badge

---

### 3. Credit Store Modal (Primary UI Component)

**Trigger Points:**
- Click credit balance badge in nav
- Click "Buy Credits" from insufficient credits warning
- First-time user onboarding
- Profile dropdown menu option

**Modal Design: "Get Credits"**

```
┌──────────────────────────────────────────────────────────────────────┐
│  [X]                                                                  │
│                                                                       │
│  ⚡ Get Credits                                                       │
│  Choose a package to power your scans                                │
│                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │  STARTER   │  │   BASIC    │  │    PRO     │  │  PREMIUM   │   │
│  │            │  │            │  │  🔥 HOT    │  │  ⭐ BEST   │   │
│  │  50 ⚡     │  │  100 ⚡    │  │  200 ⚡    │  │  500 ⚡    │   │
│  │            │  │            │  │            │  │            │   │
│  │  0.5 SOL   │  │  0.9 SOL   │  │  1.6 SOL   │  │  3.5 SOL   │   │
│  │  ~$10      │  │  ~$18      │  │  ~$32      │  │  ~$70      │   │
│  │            │  │  +10 Bonus │  │  +20 Bonus │  │  +30 Bonus │   │
│  │            │  │            │  │            │  │            │   │
│  │ 25 Basic   │  │ 50 Basic   │  │ 100 Basic  │  │ 250 Basic  │   │
│  │ 5 Elevator │  │ 10 Elevator│  │ 20 Elevator│  │ 50 Elevator│   │
│  │            │  │            │  │            │  │            │   │
│  │ [Select]   │  │ [Select]   │  │ [Select]   │  │ [Select]   │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
│                                                                       │
│  💡 Credits never expire • No subscription • Instant delivery         │
│                                                                       │
│  Selected: Pro Package (200 credits)                                 │
│  Payment: 1.6 SOL (~$32)                                             │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🟣 [Connect Phantom Wallet]                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  🔒 Secure payment via Solana blockchain                             │
└──────────────────────────────────────────────────────────────────────┘
```

**Card Design Details:**

Each credit package card:
- Glass-morphism background
- RGB animated border (theme-based)
- Hover effect: scale(1.05) + glow
- Selected state: thicker border + checkmark
- Badge for "Hot" (Pro) and "Best Value" (Premium)
- Discount percentage badge (e.g., "+20% Bonus")

**Visual Hierarchy:**
1. Package name (small, uppercase, tracking-widest)
2. Credit amount (LARGE, bold, with ⚡ icon)
3. SOL price (medium, primary color)
4. USD equivalent (small, muted)
5. Bonus indicator (if applicable, green badge)
6. Scan examples (small text, helpful context)
7. Select button (full-width, primary themed)

---

### 4. Phantom Wallet Integration UI

**State 1: Wallet Not Connected**
```
┌──────────────────────────────────────────────────────────────┐
│ 🟣 Connect Phantom Wallet                                     │
│                                                               │
│ • Fast & secure Solana payment                                │
│ • Credits delivered instantly                                 │
│ • No email or signup required                                 │
└──────────────────────────────────────────────────────────────┘
```

**State 2: Wallet Connected**
```
┌──────────────────────────────────────────────────────────────┐
│ ✅ Wallet Connected: 7k4d...Hn2m                             │
│                                                               │
│ Balance: 12.5 SOL (~$250)                                     │
│                                                               │
│ [🟣 Pay 1.6 SOL to Purchase 200 Credits]                     │
└──────────────────────────────────────────────────────────────┘
```

**State 3: Processing Transaction**
```
┌──────────────────────────────────────────────────────────────┐
│ ⏳ Processing Transaction...                                  │
│                                                               │
│ [●●●●●●○○○○] 60%                                             │
│                                                               │
│ Confirming on Solana blockchain                               │
│ Tx: 5Kx7...Bm9w                                               │
└──────────────────────────────────────────────────────────────┘
```

**State 4: Success**
```
┌──────────────────────────────────────────────────────────────┐
│ ✅ Purchase Successful!                                       │
│                                                               │
│ +200 credits added to your account                            │
│                                                               │
│ New Balance: 250 ⚡                                            │
│                                                               │
│ [Start Scanning] [View Transaction]                           │
└──────────────────────────────────────────────────────────────┘
```

---

### 5. Credit History & Management (Profile Dropdown)

**New Profile Menu Options:**
```
┌─────────────────────────────┐
│ 👤 John Doe                 │
│ john@example.com            │
│ ─────────────────────────── │
│ ⚡ Credits: 50              │
│ ─────────────────────────── │
│ 💳 Buy Credits              │
│ 📊 Usage History            │
│ 🔗 Transaction History      │
│ ⚙️  Settings                │
│ 🌈 Theme: Dark Blue         │
│ 🚪 Logout                   │
└─────────────────────────────┘
```

**Usage History Modal:**
```
┌──────────────────────────────────────────────────────────────────┐
│  📊 Credit Usage History                                          │
│                                                                   │
│  Current Balance: 50 ⚡                                           │
│  Total Purchased: 200 credits                                    │
│  Total Spent: 150 credits                                        │
│                                                                   │
│  ┌─────────┬───────────────────────┬────────┬──────────────┐    │
│  │ Date    │ Activity              │ Cost   │ Balance      │    │
│  ├─────────┼───────────────────────┼────────┼──────────────┤    │
│  │ Today   │ Elevator Scan         │ -10 ⚡ │ 50 ⚡        │    │
│  │ Today   │ Basic Scan            │ -2 ⚡  │ 60 ⚡        │    │
│  │ Today   │ Basic Scan            │ -2 ⚡  │ 62 ⚡        │    │
│  │ Jan 20  │ Credit Purchase (+50) │ +50 ⚡ │ 64 ⚡        │    │
│  │ Jan 18  │ Elevator Scan         │ -10 ⚡ │ 14 ⚡        │    │
│  └─────────┴───────────────────────┴────────┴──────────────┘    │
│                                                                   │
│  [Export CSV] [Close]                                             │
└──────────────────────────────────────────────────────────────────┘
```

---

### 6. First-Time User Onboarding

**Welcome Overlay (After First Login):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│  🎉 Welcome to OnChain Alpha Scanner!                            │
│                                                                   │
│  To get started, you'll need credits to power your scans.        │
│                                                                   │
│  ⚡ Basic Scan: 2 credits                                        │
│     Fast token analysis with core metrics                        │
│                                                                   │
│  ⚡ Elevator Scan: 10 credits                                    │
│     Deep analysis with threat intelligence                       │
│                                                                   │
│  🎁 Special Offer: Get 50 credits for only 0.5 SOL              │
│                                                                   │
│  [Get Started with Credits] [Maybe Later]                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

### 7. Low Credit Warning System

**Trigger**: When credits fall below 10

**Banner at top of page:**
```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️  Low Credit Warning                                           │
│ You have 8 credits remaining (4 Basic scans or 0 Elevator scans) │
│ [Buy More Credits]                                                │
└──────────────────────────────────────────────────────────────────┘
```

**In-Scan Warning (Before clicking scan):**
```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️  After this scan, you'll have 6 credits left                  │
│ Consider purchasing more to continue scanning                    │
│ [Continue Anyway] [Buy Credits First]                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Database Schema Changes

**New Table: `user_credits`**
```sql
CREATE TABLE user_credits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  balance INTEGER DEFAULT 0,
  total_purchased INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**New Table: `credit_transactions`**
```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type ENUM('purchase', 'spend', 'refund'),
  amount INTEGER,
  description TEXT,
  balance_after INTEGER,
  solana_tx_signature TEXT, -- For purchases
  created_at TIMESTAMP
);
```

**New Table: `credit_packages`**
```sql
CREATE TABLE credit_packages (
  id UUID PRIMARY KEY,
  name VARCHAR(50),
  credits INTEGER,
  price_sol DECIMAL(10, 4),
  price_usd DECIMAL(10, 2),
  bonus_percentage INTEGER,
  active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP
);
```

**New Table: `scan_costs`**
```sql
CREATE TABLE scan_costs (
  id UUID PRIMARY KEY,
  scan_type ENUM('BASIC', 'ELEVATOR'),
  cost_credits INTEGER,
  active BOOLEAN DEFAULT true,
  effective_from TIMESTAMP
);
```

---

### API Endpoints

#### Credit Management

**GET `/api/credits/balance`**
```typescript
Response: {
  balance: number;
  totalPurchased: number;
  totalSpent: number;
}
```

**GET `/api/credits/packages`**
```typescript
Response: {
  packages: Array<{
    id: string;
    name: string;
    credits: number;
    priceSol: number;
    priceUsd: number;
    bonusPercentage: number;
  }>;
}
```

**POST `/api/credits/purchase`**
```typescript
Request: {
  packageId: string;
  walletAddress: string;
  txSignature: string; // Phantom wallet tx
}

Response: {
  success: boolean;
  newBalance: number;
  transactionId: string;
}
```

**GET `/api/credits/history`**
```typescript
Query: {
  limit?: number;
  offset?: number;
  type?: 'all' | 'purchase' | 'spend';
}

Response: {
  transactions: Array<{
    id: string;
    type: 'purchase' | 'spend' | 'refund';
    amount: number;
    description: string;
    balanceAfter: number;
    createdAt: string;
  }>;
  total: number;
}
```

#### Scan Integration

**POST `/api/scanner/scan`** (Modified)
```typescript
Request: {
  address: string;
  chain: 'evm' | 'sol';
  scanType: 'BASIC' | 'ELEVATOR';
}

Response (if insufficient credits): {
  error: 'INSUFFICIENT_CREDITS';
  required: number;
  current: number;
  message: string;
}

Response (success): {
  // ... existing scan response
  creditsCharged: number;
  newBalance: number;
}
```

---

### Phantom Wallet Integration

**SDK**: `@solana/wallet-adapter-react`

```typescript
// Example integration
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const PurchaseCredits = () => {
  const { publicKey, sendTransaction } = useWallet();
  
  const handlePurchase = async (packageData) => {
    // 1. Create transaction
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey!,
        toPubkey: new PublicKey(TREASURY_WALLET),
        lamports: packageData.priceSol * LAMPORTS_PER_SOL,
      })
    );
    
    // 2. Send transaction
    const signature = await sendTransaction(transaction, connection);
    
    // 3. Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    // 4. Call backend to credit user
    await fetch('/api/credits/purchase', {
      method: 'POST',
      body: JSON.stringify({
        packageId: packageData.id,
        walletAddress: publicKey!.toString(),
        txSignature: signature,
      }),
    });
  };
};
```

---

### Frontend Components to Create

```
src/components/credits/
├── CreditBadge.tsx              # Nav bar credit balance display
├── CreditStoreModal.tsx         # Main purchase modal
├── CreditPackageCard.tsx        # Individual package card
├── PhantomConnectButton.tsx     # Phantom wallet connection
├── PurchaseFlow.tsx             # Transaction flow handler
├── CreditHistoryModal.tsx       # Usage history viewer
├── LowCreditBanner.tsx          # Warning banner
├── InsufficientCreditsModal.tsx # Blocking modal when out of credits
└── CreditContext.tsx            # Global credit state management
```

---

## 🎨 Design System Tokens

### Colors

**Credit-Related Colors:**
- Credit Icon: `#FFD700` (Gold)
- Sufficient Balance: `#22c55e` (Green)
- Low Balance Warning: `#f59e0b` (Orange)
- Critical Warning: `#ef4444` (Red)
- Package Hot Badge: `#f97316` (Orange)
- Package Best Badge: `#8b5cf6` (Purple)
- Phantom Purple: `#AB9FF2`

### Typography

**Credit Display:**
- Font: Inter, system-ui (monospace for numbers)
- Weight: 700 (bold) for credit amounts
- Size: 14px (nav badge), 32px (modal headers), 18px (package cards)

### Animations

**Credit Balance Change:**
```css
@keyframes creditPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

@keyframes creditAdd {
  0% { opacity: 0; transform: translateY(-20px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

**Low Credit Pulse:**
```css
@keyframes lowCreditPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
}
```

---

## 📊 User Flow Diagrams

### Purchase Flow
```
User Lands on Site
    ↓
Sees Credit Balance (0 credits)
    ↓
Clicks "Buy Credits" or tries to scan
    ↓
Credit Store Modal Opens
    ↓
Selects Package (e.g., Pro - 200 credits)
    ↓
Clicks "Connect Phantom Wallet"
    ↓
Phantom Extension Opens
    ↓
User Approves Connection
    ↓
Wallet Connected - Shows Balance
    ↓
Clicks "Pay X SOL to Purchase"
    ↓
Phantom Asks for Transaction Approval
    ↓
User Approves Payment
    ↓
Transaction Sent to Blockchain
    ↓
Backend Monitors Transaction
    ↓
Transaction Confirmed (15-30 seconds)
    ↓
Backend Credits User Account
    ↓
Success Modal Shows "+200 credits"
    ↓
User Can Start Scanning
```

### Scan Flow (With Credits)
```
User Enters Token Address
    ↓
Selects Scan Type (BASIC or ELEVATOR)
    ↓
System Shows: "Cost: X credits"
    ↓
User Clicks "Scan"
    ↓
Backend Checks Credit Balance
    ↓
    ├─→ Insufficient Credits
    │       ↓
    │   Show "Insufficient Credits" Modal
    │       ↓
    │   User Buys More Credits
    │       ↓
    │   Returns to Scan
    │
    └─→ Sufficient Credits
            ↓
        Deduct Credits
            ↓
        Run Scan
            ↓
        Show Results
            ↓
        Update Credit Balance in Nav
```

---

## 🔐 Security Considerations

### Backend Validation
1. **Transaction Verification**: Always verify Solana transaction on-chain before crediting
2. **Signature Validation**: Check tx signature matches wallet address
3. **Amount Verification**: Confirm payment amount matches package price
4. **Duplicate Prevention**: Check for duplicate transaction signatures
5. **Rate Limiting**: Prevent credit purchase spam

### Wallet Security
1. Never store private keys
2. Only request transaction signing permissions
3. Clear instructions about what transaction does
4. Show exact SOL amount before signing

### Credit Balance Integrity
1. Use database transactions for credit updates
2. Audit log all credit changes
3. Implement balance reconciliation checks
4. Monitor for anomalies (sudden large changes)

---

## 📈 Analytics & Tracking

### Key Metrics to Track
- **Conversion Rate**: Visitors → Credit Purchasers
- **Average Package Size**: Which packages sell most
- **Credit Consumption Rate**: How fast users consume credits
- **Refill Rate**: Time between first purchase and second
- **Scan Type Ratio**: BASIC vs ELEVATOR usage
- **Abandonment Rate**: Cart abandonment at wallet connection

### Events to Log
```typescript
// Purchase Events
trackEvent('credit_package_viewed', { packageId, credits, price });
trackEvent('credit_package_selected', { packageId });
trackEvent('wallet_connect_initiated');
trackEvent('wallet_connected', { walletAddress });
trackEvent('purchase_initiated', { packageId, amount });
trackEvent('purchase_completed', { packageId, amount, txSignature });
trackEvent('purchase_failed', { packageId, reason });

// Usage Events
trackEvent('scan_attempted', { scanType, creditsAvailable });
trackEvent('scan_blocked_insufficient_credits', { scanType, creditsNeeded, creditsHave });
trackEvent('credits_depleted', { lastAction });

// UI Events
trackEvent('low_credit_warning_shown', { balance });
trackEvent('credit_store_opened', { source: 'nav' | 'warning' | 'onboarding' });
```

---

## 🚀 Phased Rollout

### Phase 1: Core Infrastructure (Week 1)
- Database schema setup
- Credit management API endpoints
- Credit balance tracking
- Basic UI: Credit badge in nav

### Phase 2: Purchase Flow (Week 2)
- Credit Store modal design & implementation
- Phantom wallet integration
- Transaction processing
- Success/error handling

### Phase 3: Scan Integration (Week 3)
- Modify scanner endpoints to check/deduct credits
- Insufficient credits handling
- Cost preview in scan terminal
- Post-scan balance update

### Phase 4: User Experience (Week 4)
- Credit history viewer
- Low credit warnings
- First-time user onboarding
- Analytics integration

### Phase 5: Testing & Launch (Week 5)
- End-to-end testing on Solana devnet
- Load testing credit system
- Security audit
- Mainnet deployment

---

## 🎁 Optional Enhancements (Future)

### 1. Credit Gifting
- Allow users to gift credits to friends
- Referral system: "Give 10, Get 10"
- Shareable gift links

### 2. Enterprise Packages
- Bulk packages (1000+ credits) at deeper discounts
- Multi-user team accounts
- Shared credit pools

### 3. Promotional Campaigns
- Seasonal discounts (e.g., 20% extra on holidays)
- First-time buyer bonus (e.g., extra 10 credits)
- Email marketing for inactive users

### 4. Credit Expiry (Optional)
- Add expiry dates for specific promotional credits
- Separate "bonus" credits that expire
- Notifications before expiry

### 5. Alternative Payment Methods
- Support USDC stablecoin payments
- Multi-chain support (Ethereum, Polygon)
- Credit card payments via Stripe (convert to SOL internally)

---

## ✅ Success Criteria

### Technical
- ✅ 100% transaction verification rate
- ✅ <2 second credit balance update after purchase
- ✅ Zero credit balance discrepancies
- ✅ 99.9% uptime for payment processing

### Business
- ✅ 20%+ conversion rate (visitors to purchasers)
- ✅ $50+ average transaction value
- ✅ 70%+ users refill within 30 days
- ✅ <5% cart abandonment rate

### User Experience
- ✅ <3 clicks from "Buy Credits" to payment
- ✅ Clear pricing and credit visibility
- ✅ Instant credit delivery (<30 seconds)
- ✅ Zero user confusion about costs

---

## 📝 Documentation Needed

1. **User Guide**: "How to Buy Credits"
2. **FAQ**: Common questions about credit system
3. **Developer Docs**: API integration guide
4. **Support Guide**: Handling failed transactions
5. **Admin Panel**: Credit management tools

---

## 🎉 Launch Checklist

- [ ] Database migrations executed
- [ ] All API endpoints tested
- [ ] Phantom wallet integration working on devnet
- [ ] UI components match design spec
- [ ] Credit balance updates in real-time
- [ ] Transaction verification working
- [ ] Error handling for all edge cases
- [ ] Analytics events firing correctly
- [ ] User documentation published
- [ ] Support team trained
- [ ] Monitoring dashboards set up
- [ ] Backup treasury wallet configured
- [ ] Legal review of payment terms
- [ ] Mainnet deployment completed
- [ ] Marketing materials ready

---

*This credit system transforms the scanner into a flexible, user-friendly platform where users pay only for what they use, with transparent pricing and instant delivery powered by the Solana blockchain.*

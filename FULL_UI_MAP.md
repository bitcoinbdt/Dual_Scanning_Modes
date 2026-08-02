# Full UI Map - OnChain Alpha Token Scanner

This document provides a comprehensive map of all pages and interfaces in the application.

---

## 📊 Application Overview

The application is divided into three main sections:
1. **User-Facing Pages** (Public & Authenticated Users)
2. **Admin Panel** (Admin Only)
3. **System Pages** (Authentication & Callbacks)

---

## 🌐 USER-FACING PAGES

### 1. **Home / Scanner Page**
- **Route:** `/`
- **File:** `app/page.tsx`
- **Access:** Public (Login required for scanning)
- **Description:** Main token scanning interface with Basic and Elevator scan modes

#### UI Components:
- **Navigation Bar** (Top)
  - Logo and branding
  - Navigation menu (Scanner, Pricing, Referral, Agent)
  - Credit balance badge
  - Login/Signup buttons (unauthenticated)
  - User profile dropdown (authenticated)

- **Scan Terminal Section**
  - Title: "Acquire Target"
  - Mode Selector: Basic Scan / Elevator Deep Scan toggle buttons
  - **For Elevator Mode:**
    - Blockchain selector (Auto-detect, Solana, BSC, Ethereum)
    - Credit cost selector (5, 10, 20, 30 credits for 50, 100, 200, 500 transactions)
    - Multi-chain support info banner
    - Ambiguous chain warning (for EVM addresses)
  - Address input field with search icon
  - Scan button (appears when address entered)
  - Cost display showing credit cost and user balance
  - Disclaimer text

- **Loading State**
  - Animated spinner with CPU icon
  - "Scanning Blockchain..." message
  - Selected chain indicator

- **Basic Scan Results** (When Complete)
  - Token Overview Card
  - Advanced Risk Metrics Card
  - Token Audit Card
  - Market Intelligence Card

- **Elevator Scan Results** (When Complete)
  - Raw Transaction Table with P&L analysis
  - Wallet breakdown by transactions
  - Buy/Sell indicators
  - Profit/Loss calculations (FIFO/LIFO)
  - Token info (symbol, address, network)

- **Network Health Stats** (Always Visible at Bottom)
  - Network Epoch
  - Block Reward
  - Exchanges Scanned
  - Scan Status

- **Modals:**
  - Insufficient Credits Modal (opens when balance too low)
  - Credit Store Modal (opens to buy credits)

#### Features:
- Referral code detection from URL (?ref=CODE)
- Auto-redirect to signup with referral code
- Credit deduction before scanning
- Multi-chain support (Solana, BSC, Ethereum)
- Auto chain detection
- Real-time transaction analysis
- P&L calculation for wallets

---

### 2. **Pricing Page**
- **Route:** `/pricing`
- **File:** `app/pricing/page.tsx`
- **Access:** Public
- **Description:** Credit packages and pricing information

#### UI Components:
- **Header Section**
  - Title: "Buy Credits, Scan Tokens"
  - Subtitle: "No subscriptions, no hidden fees. Pay only for what you use."

- **Credit Packages Grid** (4 cards)
  - Each package card shows:
    - Package name (Starter, Basic, Pro, Premium)
    - Credit amount
    - Price in USD
    - Bonus percentage (if applicable)
    - "🔥 MOST POPULAR" badge for hot packages
    - "Buy Now" button
  - Gradient styling for hot packages
  - Hover effects with scale animation

- **Scan Costs Section**
  - Title: "How Credits Work"
  - Cost breakdown cards:
    - Basic Scan: 2 credits
    - Elevator Deep Scan (50 Tx): 5 credits
    - Elevator Deep Scan (100 Tx): 10 credits
    - Elevator Deep Scan (200 Tx): 20 credits
    - Elevator Deep Scan (500 Tx): 30 credits
  - Each with description

- **Benefits Section**
  - Title: "Why Choose OnChain Alpha?"
  - 8 benefits in 2-column grid:
    - Credits never expire
    - No monthly subscription
    - Pay only for what you use
    - Instant scan results
    - Multi-chain support
    - Advanced security metrics
    - Real-time market data
    - Priority support
  - Checkmark icons for each

- **CTA Button**
  - "Get Started Now" with lightning icon
  - Gradient purple to pink styling

- **Modals:**
  - Credit Store Modal (opens on "Buy Now" or CTA click)

#### Features:
- Package selection from grid
- Pre-selected package passing to credit store
- Animated cards with motion effects
- Responsive grid layout

---

### 3. **Referral Dashboard**
- **Route:** `/referrals`
- **File:** `app/referrals/page.tsx`
- **Access:** Authenticated Users Only
- **Description:** User referral system with referral code and earnings tracking

#### UI Components:
- **Page Header**
  - Title: "Referral Program"
  - Subtitle: "Earn bonus credits by inviting friends to OnChain Alpha Scanner"

- **Referral Dashboard Card**
  - User's unique referral code (large display with copy button)
  - Referral link with copy functionality
  - Statistics:
    - Total referrals count
    - Total earned credits
  - Share buttons (optional)

- **View History Button**
  - Opens Referral History Modal

- **Bonus Tier Structure Table**
  - Title: "Bonus Tier Structure"
  - Description of bonus system
  - **Desktop Table** with columns:
    - Package name
    - Credits purchased
    - Price (SOL)
    - Your bonus
    - Bonus percentage
  - **Mobile Cards** (responsive)
  - 4 tiers:
    - Starter: 50 credits / 0.5 SOL / 5 bonus / 10%
    - Basic: 100 credits / 0.9 SOL / 15 bonus / 15%
    - Pro: 200 credits / 1.6 SOL / 40 bonus / 20% (HOT badge)
    - Premium: 500 credits / 3.5 SOL / 125 bonus / 25% (BEST VALUE badge)
  - Lightning icons for bonus display

- **Terms & Conditions Section**
  - Expandable card with 6 key terms:
    - Bonus only on first purchase
    - Instant credit addition
    - Cannot use own referral code
    - Code must be applied before first purchase
    - Fraud prevention warning
    - Terms modification rights

- **Modals:**
  - Referral History Modal showing all referral earnings

#### Features:
- Copy referral code to clipboard
- Copy referral link to clipboard
- View detailed referral history
- Real-time bonus calculation preview
- Responsive table/card layout

---

### 4. **Credits Page**
- **Route:** `/credits`
- **File:** `app/credits/page.tsx`
- **Access:** Authenticated Users
- **Description:** Credit management and manual payment submission

#### UI Components:
- **Header**
  - Title: "Complete Payment"
  - Subtitle: "Your credits will be added as soon as the transaction hash is verified by admin."

- **3-Column Layout:**

  **Column 1: Order Summary Card**
  - Package name
  - Credits amount with lightning icon
  - Price in USD
  - Glass card styling

  **Column 2-3: Payment Process**
  
  - **Step 1: Select Payment Method**
    - Grid of payment method cards (2 columns)
    - Each card shows:
      - Brand logo (Binance, KuCoin, USDT, USDC, TRX)
      - Method name
      - Network (uppercase)
    - Visual selection state (purple border when selected)
    - Hover effects
  
  - **Step 2: Transfer Details**
    - Payment address with copy button
    - QR code display (if available)
    - Payment instructions text
    - Address displayed in monospace font
  
  - **Step 3: Submit Transaction Hash**
    - Input field for transaction hash/signature
    - Placeholder: "Paste transaction signature / tx hash here"
    - "Confirm Payment Info" button (locked icon)

- **Success State**
  - Green checkmark icon
  - "Request Submitted!" message
  - Transaction hash display
  - "Go to Dashboard" button

- **Loading State**
  - Spinner animation
  - "Submitting transaction info..." message

#### Features:
- Dynamic payment method logos (SVG brand icons)
- Copy address to clipboard
- Transaction hash validation
- Success/error toast notifications
- Query parameter package pre-selection
- Payment method filtering by active status

---

### 5. **Agent Page**
- **Route:** `/agent`
- **File:** `app/agent/page.jsx`
- **Access:** Public/Authenticated
- **Description:** Crypto Hype Agent - fetches and displays boosted token profiles from DexScreener

#### UI Components:
- **Header Section**
  - Breadcrumb: "OnChain Alpha Scanner / Crypto Hype Agent"
  - Title: "🔍 Crypto Hype Agent" (gradient text)
  - Description text
  - Status indicator: "Agent ready" or "Scanning..."

- **Scan Control Panel** (Glass card)
  - Title: "Scan Control"
  - Description: "Pulls top 20 boosted profiles · enriches with live pair data"
  - **"Run Agent" Button**
    - Rocket emoji 🚀
    - Purple gradient when ready
    - Spinner animation when scanning
  - **Progress Bar** (visible during scan)
    - Shows X / 20 progress
    - Animated gradient fill
  - **Stats Strip** (3 metrics)
    - Tokens Found
    - Status
    - Last Scan time

- **Results Section**
  - Header: "X hype tokens found"
  - Sort indicator: "Sorted by boost rank"
  
  **Token Cards** (Grid layout)
  Each card displays:
  - Token logo (with fallback emoji 🪙)
  - Token name and symbol
  - Chain badge (color-coded for: Ethereum, Solana, BSC, Base, Arbitrum, Polygon, Avalanche, Tron, Robinhood, Sui, Optimism, Fantom)
  - Current price
  - 24h price change (with ▲/▼ indicator)
  - Market cap
  - Locked liquidity (with animated pulse dot)
  - Contract address (truncated with copy button)
  - Description (truncated to 120 chars)
  - Hover effects with glow

- **Empty State**
  - Robot emoji 🤖
  - Animated pulse border
  - "No results yet" message
  - Ghost skeleton cards (3) for atmosphere

- **Loading State**
  - 6 skeleton loader cards with animation

- **Error Banner**
  - Red gradient with warning icon ⚠️
  - Error message display

#### Features:
- Fetches top 20 boosted tokens from DexScreener API
- Parallel enrichment with live price data
- Real-time progress tracking
- Logo error handling with fallback
- Clipboard copy for contract addresses
- Deterministic locked liquidity calculation
- Chain-specific color coding and badges
- Responsive grid layout
- Ambient background effects

---

### 6. **Sign Up Page**
- **Route:** `/signup`
- **File:** `app/signup/page.tsx`
- **Access:** Public (Unauthenticated Users)
- **Description:** User registration page with optional referral code

#### UI Components:
- **Back Button**
  - Arrow left icon
  - Returns to previous page

- **Header**
  - Title: "Create Account"
  - Subtitle: "Join OnChain Alpha Scanner and start analyzing tokens"
  - **Referral Badge** (if code detected)
    - Gift icon 🎁
    - "Referral code detected! You'll earn bonus credits."
    - Green styling with glow

- **Signup Form** (Glass card with RGB border)
  
  **Error Alert** (if error exists)
  - Red background
  - Alert circle icon
  - Error message

  **Form Fields:**
  1. **Full Name**
     - User icon
     - Text input
     - Required field
  
  2. **Email Address**
     - Mail icon
     - Email input
     - Required field
  
  3. **Password**
     - Lock icon
     - Password input
     - Minimum 6 characters
     - Hint text below
  
  4. **Referral Code (Optional)**
     - Gift icon
     - Text input (max 8 chars, uppercase)
     - **If locked (from URL):**
       - Read-only field
       - Green checkmark icon
       - "Code applied from referral link" placeholder
       - Confirmation text below
     - **If not locked:**
       - Optional field
       - Editable
       - Help text below

  **Create Account Button**
  - Primary gradient styling
  - Full width
  - Loading state: "Creating Account..."
  - Disabled state when processing

- **Divider**
  - "OR" text with horizontal lines

- **Google Sign Up Button**
  - Google logo (colored SVG)
  - "Continue with Google" text
  - White background
  - Full width

- **Login Link**
  - "Already have an account?"
  - Link to homepage (login)

- **Terms Text**
  - Small gray text
  - "By signing up, you agree to our Terms of Service and Privacy Policy"

#### Features:
- Referral code detection from URL (?ref=CODE)
- Referral code storage in localStorage
- Auto-uppercase referral code input
- Read-only referral field when locked
- Google OAuth signup
- Form validation (email, password length, referral format)
- Error handling with detailed messages
- Auto-redirect on successful signup
- Toast notifications
- Loading states on all interactive elements

---

## 🔐 ADMIN PANEL

### 7. **Admin Dashboard**
- **Route:** `/admin`
- **File:** `app/admin/page.tsx`
- **Access:** Admin Only (admin@anamul.com)
- **Description:** Main admin dashboard with overview and navigation

#### UI Components:
- **Top Navigation Bar** (Sticky)
  - Left side:
    - Admin console logo with gradient
    - "Admin Console" title
    - System status indicator: "System Operational" (green dot)
  - Right side:
    - "Refresh" button with icon
    - "Back to App" link
    - Admin avatar circle (first letter of email)

- **Hero Header**
  - Greeting: "Good morning/afternoon/evening, Admin"
  - Title: "Dashboard Overview"
  - Admin email and current date

- **Stats Grid** (4 cards)
  Each stat card shows:
  - Icon with colored background
  - Label text
  - Value (large number)
  - "Action Needed" badge (for pending items)
  
  Stats displayed:
  1. **Pending Requests** (Orange)
     - Clock icon
     - Shows count of pending credit requests
  2. **Total Requests** (Purple)
     - Document icon
     - All credit requests count
  3. **Active Gateways** (Green)
     - Credit card icon
     - Active payment methods count
  4. **Total Gateways** (Pink)
     - Dollar icon
     - All payment methods count

- **Quick Actions Section**
  Two action cards:
  
  1. **Review Credit Requests**
     - Checkmark icon
     - Description: "Approve or reject pending credit purchase requests from users"
     - Badge showing pending count (if > 0)
     - Orange accent
     - Links to `/admin/credit-requests`
  
  2. **Manage Payment Methods**
     - Credit card icon
     - Description: "Configure wallet addresses for Binance, KuCoin, USDT, USDC, and TRX"
     - Purple accent
     - Links to `/admin/payment-methods`
  
  - Hover effects: glow and elevation

- **System Status Section**
  - Title: "System Status"
  - "All Systems Operational" badge (green)
  - 4 status items in grid:
    1. **Admin Account** - Shows admin email (green indicator)
    2. **Database** - "Connected (Supabase)" (green indicator)
    3. **Credit System** - "Active & Operational" (green indicator)
    4. **Payment Processing** - "Manual Review Mode" (green indicator)

#### Design Features:
- Dark gradient background (purple/blue tones)
- Glass-morphism cards with subtle borders
- Ambient glow effects on hover
- Color-coded stat cards
- Real-time stats loading
- Auto-refresh every 60 seconds for time display
- Responsive grid layouts
- Loading skeleton states

---

### 8. **Payment Methods Management**
- **Route:** `/admin/payment-methods`
- **File:** `app/admin/payment-methods/page.tsx`
- **Access:** Admin Only
- **Description:** Manage payment methods (Binance Pay, USDT addresses, etc.)

#### UI Components:
- **Header Section**
  - Title: "Configure Gateways"
  - Subtitle: "Set addresses for the 5 default payment methods below"
  - "← Back to Admin" button (top right)

- **Payment Method Cards Grid** (2 columns, responsive)
  
  Each card displays:
  - **Header:**
    - Brand logo (dynamic SVG):
      - Binance (yellow diamond)
      - KuCoin (blue square with K)
      - USDT (green circle with T)
      - USDC (blue circle)
      - TRX (red triangle)
    - Payment method name
    - Network badge (e.g., "TRC-20 Network")
    - **Toggle Switch:**
      - Active/Inactive label
      - Green when active
      - Controls is_active status
  
  - **Configuration Form:**
    1. **Wallet Address / Pay ID**
       - Text input
       - Placeholder: "Enter {method} identifier"
       - Focus border changes to purple
    
    2. **QR Code Image URL** (Optional)
       - Text input
       - Monospace font
       - Placeholder: "https://example.com/qr.png"
    
    3. **Payment Instructions**
       - Textarea (2 rows)
       - Placeholder: "Step by step instructions for the buyer..."
    
    4. **Save Configuration Button**
       - Full width
       - Purple-pink gradient
       - "Saving changes..." loading state

  - **Brand-Specific Styling:**
    - Each card has color-coded borders and glow effects:
      - Binance: Yellow
      - KuCoin: Sky blue
      - USDT: Emerald green
      - USDC: Blue
      - TRX: Red
    - Hover effects with brand-colored shadows
    - Inactive cards have reduced opacity

#### Features:
- Real-time form updates
- Brand logo component with SVG rendering
- Toggle active/inactive status
- QR code URL support
- Custom instructions per method
- Auto-save on button click
- Toast notifications for success/error
- Sorted by display_order
- Loading spinner during data fetch
- Glass-morphism card design

---

### 9. **Credit Purchase Requests**
- **Route:** `/admin/credit-requests`
- **File:** `app/admin/credit-requests/page.tsx`
- **Access:** Admin Only
- **Description:** Review and approve/reject user credit purchase requests

#### UI Components:
- **Header Section**
  - Title: "Credit Purchase Requests"
  - Pending count badge (yellow, if > 0)
  - Subtitle: "Review and approve credit purchase requests"
  - "← Back to Admin" button (top right)

- **Filter Tabs** (4 tabs)
  - Pending (with count badge if > 0)
  - Approved
  - Rejected
  - All
  - Active tab highlighted in purple
  - Gray tabs with hover effect

- **Empty State** (when no requests)
  - 📋 Clipboard emoji
  - Title: "No {filter} requests"
  - Message varies by filter
  - Gray card with backdrop blur

- **Request Cards Grid**
  Each request card shows:
  
  **Card Header:**
  - Credits amount (large text)
  - Status badge (color-coded):
    - Pending: Yellow
    - Approved: Green
    - Rejected: Red
  - User email
  - Submission date/time
  - **"Review" button** (for pending only, purple)

  **Card Details Grid (2 columns):**
  1. **Payment Method**
     - Method name
     - Network in gray (if available)
  
  2. **Amount (USD)**
     - Price with 2 decimal places
  
  3. **Transaction Hash** (full width)
     - Monospace font in dark box
     - "Copy" button
  
  **For Reviewed Requests:**
  - Reviewed at timestamp
  - Admin notes (if provided)

- **Review Modal** (when reviewing)
  
  **Request Summary Box:**
  - User email
  - Credits amount
  - USD amount
  - Payment method
  - Transaction hash (full, monospace)

  **Decision Section:**
  - 2 large buttons:
    - ✓ Approve (green when selected)
    - ✗ Reject (red when selected)
  
  **Admin Notes:**
  - Textarea input
  - Required for rejection
  - Optional for approval
  
  **Warning Boxes:**
  - Green box for approval: Shows credits to be added
  - Red box for rejection: Reminds to provide reason
  
  **Action Buttons:**
  - Cancel (gray)
  - Approve & Add Credits (green) / Reject Request (red)
  - Loading state: "Processing..."

#### Features:
- Filter by status (pending, approved, rejected, all)
- Real-time request count
- Status-based color coding
- Copy transaction hash to clipboard
- Modal review interface
- Automatic credit addition on approval
- Admin notes for approval/rejection history
- Toast notifications
- Date/time formatting
- Loading states
- Responsive grid layout

---

## 🔄 SYSTEM PAGES

### 10. **Authentication Callback**
- **Route:** `/auth/callback`
- **File:** `app/auth/callback/page.tsx`
- **Access:** System (Supabase OAuth)
- **Description:** OAuth callback handler for Supabase authentication

#### UI Components:
- Minimal page with loading state
- Processes OAuth tokens from Supabase
- Handles referral code application for OAuth signups
- Auto-redirects to home after processing

#### Features:
- OAuth token exchange
- Session establishment
- Referral code application (from localStorage)
- Error handling with redirects
- No visible UI (system page)

---

## 🧭 NAVIGATION STRUCTURE

### Desktop Navigation (Top Bar)
1. **Scanner** (/) - Home page with token scanning
2. **Pricing** (/pricing) - Credit packages
3. **Referral** (/referrals) - Only visible when authenticated
4. **Agent** (/agent) - AI Agent functionality

### User Account Menu (Authenticated)
- Credit Balance Badge (click to go to /pricing)
- Profile dropdown:
  - User name and email
  - Theme selector (Dark Blue, Cyber Green, Neon Purple)
  - Logout button

### Unauthenticated User Actions
- **Sign Up** button → `/signup`
- **Login** button → Opens AuthModal

### Mobile Navigation
- Hamburger menu with same navigation links
- Responsive slide-out menu

---

## 📱 MODAL COMPONENTS (Not Pages)

These are overlay components, not separate pages:

1. **AuthModal** - Login/Signup modal overlay
2. **CreditStoreModal** - Credit purchase request submission
3. **InsufficientCreditsModal** - Low credit warning
4. **ReferralHistoryModal** - Referral earning history

---

## 🔑 ACCESS CONTROL SUMMARY

| Page | Access Level | Notes |
|------|-------------|-------|
| `/` | Public | Login required to scan |
| `/pricing` | Public | |
| `/referrals` | Authenticated | Hidden from nav if not logged in |
| `/credits` | Authenticated | |
| `/agent` | Public/Authenticated | |
| `/signup` | Unauthenticated | Redirects if logged in |
| `/admin` | Admin Only | admin@anamul.com |
| `/admin/payment-methods` | Admin Only | |
| `/admin/credit-requests` | Admin Only | |
| `/auth/callback` | System | OAuth callback |

---

## 📝 DOCUMENTATION STATUS

**Document Status:** ✅ Complete - All pages documented with full UI details  
**Last Updated:** January 2025  
**Total Pages:** 10 (6 User Pages + 3 Admin Pages + 1 System Page)
**Total Components Documented:** 100+ UI components and features

---

## 🎨 COMMON UI PATTERNS ACROSS PAGES

### Navigation Components
- Consistent header across all user pages
- Responsive mobile menu (hamburger)
- Logo with gradient branding
- Credit balance badge (authenticated users only)
- Profile dropdown with theme selector
- Conditional rendering based on auth state

### Design System
- **Color Scheme:**
  - Primary: Purple gradient (#7c3aed to #db2777)
  - Success: Green (#22c55e)
  - Warning: Yellow/Orange (#f59e0b)
  - Error: Red (#ef4444)
  - Background: Dark slate (#0a0118, #0d0520)

- **Card Styles:**
  - Glass-morphism effects
  - RGB borders (animated gradients)
  - Backdrop blur
  - Hover effects with glow
  - Subtle shadows

- **Typography:**
  - Headers: Bold, italic, uppercase
  - Monospace: Transaction hashes, addresses
  - Gradient text for titles
  - Size hierarchy for readability

- **Animations:**
  - Framer Motion for page transitions
  - Pulse animations for status indicators
  - Skeleton loaders during data fetch
  - Hover scale effects on cards
  - Spinner animations for loading states

### Form Patterns
- Icon-prefixed input fields
- RGB borders on focus
- Validation states (error, success)
- Loading states on submit buttons
- Placeholder text for guidance
- Required field indicators

### Button Styles
- Primary: Purple gradient
- Secondary: Gray with hover
- Danger: Red for destructive actions
- Success: Green for approvals
- Ghost: Transparent with border
- Disabled states with reduced opacity

### Modal Patterns
- Full-screen overlay with backdrop blur
- Centered content cards
- Close button or click-outside to dismiss
- Success/error states with icons
- Action buttons at bottom
- Responsive sizing

---

## 🔄 USER FLOWS

### 1. New User Signup Flow
1. Click "Sign Up" button on navigation
2. Fill out signup form (name, email, password)
3. Optional: Enter referral code (or auto-filled from URL)
4. Submit form or use Google OAuth
5. Auto-redirect to home page
6. Receive 20 free credits automatically

### 2. Token Scan Flow
1. User lands on home page
2. Select scan type (Basic or Elevator)
3. For Elevator: Choose chain and credit depth
4. Enter token contract address
5. Click "Scan" button
6. Credits deducted automatically
7. View scan results in cards/tables
8. Analyze data (P&L, transactions, metrics)

### 3. Credit Purchase Flow
1. Click credit badge or "Buy Credits" button
2. Select credit package from pricing/credits page
3. Choose payment method
4. Copy payment address
5. Make payment externally
6. Submit transaction hash
7. Wait for admin approval
8. Credits added to account

### 4. Referral Flow
1. Navigate to Referrals page (authenticated)
2. Copy unique referral code or link
3. Share with friends
4. When friend signs up with code
5. Friend makes first purchase
6. User receives bonus credits (10-25%)
7. View history in referral dashboard

### 5. Admin Review Flow (Credit Requests)
1. Admin logs in to /admin
2. View pending requests count
3. Navigate to credit requests page
4. Filter by status (pending/approved/rejected)
5. Click "Review" on request
6. Verify transaction hash externally
7. Approve or reject with notes
8. Credits auto-added on approval
9. User notified (via system)

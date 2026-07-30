# Manual Credit Purchase System - Setup Guide

## Overview
This guide will help you set up and use the manual credit purchase system where users submit payment proofs and admins verify and approve credit requests.

---

## 🗄️ Step 1: Database Setup

### Run the SQL Script
1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy and paste the entire contents of `database/MANUAL_CREDIT_SYSTEM.sql`
4. Click **Run** to execute the script

### What This Creates:
- ✅ `payment_methods` table - stores payment addresses/IDs
- ✅ `credit_purchase_requests` table - stores user credit requests
- ✅ Row Level Security (RLS) policies for admin and users
- ✅ Database trigger to automatically add credits on approval
- ✅ Helper functions and views for admin operations

---

## 👤 Step 2: Admin Setup

### Admin Email
The admin email is hardcoded as: **`admin@anamul.com`**

### Create Admin Account
1. Sign up on your app using `admin@anamul.com`
2. Verify the email via Supabase
3. You now have full admin access

### Access Admin Panel
- Navigate to `/admin` to access the admin dashboard
- Or use the direct links:
  - `/admin/payment-methods` - Manage payment addresses
  - `/admin/credit-requests` - Review and approve requests

---

## 💳 Step 3: Configure Payment Methods

### Add Payment Methods
1. Go to `/admin/payment-methods`
2. Click **"+ Add Payment Method"**
3. Fill in the details:
   - **Name**: e.g., "Binance Pay", "USDT (BEP-20)"
   - **Network**: e.g., "BEP-20", "TRC-20", "Binance"
   - **Address/ID**: Your payment wallet address or Binance Pay ID
   - **QR Code URL** (optional): Link to QR code image
   - **Instructions** (optional): Payment instructions for users
   - **Display Order**: Lower numbers appear first
   - **Active**: Check to make it visible to users

4. Click **"Add"** to save

### Example Payment Methods

**Binance Pay:**
```
Name: Binance Pay
Network: Binance
Address: 123456789
Instructions: Send payment via Binance Pay to this ID
Active: ✓
Display Order: 1
```

**USDT BEP-20:**
```
Name: USDT (BEP-20)
Network: BEP-20
Address: 0x1234567890abcdef1234567890abcdef12345678
Instructions: Send USDT on Binance Smart Chain (BEP-20)
Active: ✓
Display Order: 2
```

**USDT TRC-20:**
```
Name: USDT (TRC-20)
Network: TRC-20
Address: TRX1234567890abcdef1234567890
Instructions: Send USDT on TRON network (TRC-20)
Active: ✓
Display Order: 3
```

---

## 🛒 Step 4: User Purchase Flow

### How Users Buy Credits

1. **User clicks "Buy Credits"**
   - Opens the credit store modal
   - Selects a credit package (100, 500, 1000, 5000 credits)

2. **Select Payment Method**
   - User sees all active payment methods
   - Chooses preferred method (Binance Pay, USDT, etc.)

3. **Complete Payment**
   - User sees payment address with copy button
   - User manually sends payment to the address
   - User submits transaction hash/ID

4. **Wait for Approval**
   - Request status shows "Pending Review"
   - User receives notification when approved/rejected

---

## ✅ Step 5: Admin Review Process

### Review Credit Requests

1. **Go to `/admin/credit-requests`**
2. **Filter by status:**
   - Pending (needs review)
   - Approved (completed)
   - Rejected (declined)
   - All (everything)

3. **Click "Review" on a pending request**

4. **Verify the transaction:**
   - Copy the transaction hash
   - Check it on the blockchain explorer or payment platform:
     - BEP-20: https://bscscan.com/
     - TRC-20: https://tronscan.org/
     - Binance Pay: Check in your Binance account
   - Verify the amount matches the requested credits

5. **Approve or Reject:**
   - **Approve**: Credits automatically added to user account
   - **Reject**: Optionally add admin notes explaining why

---

## 🔄 System Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ USER FLOW                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Select Credit Package                                   │
│     └─> Choose: 100, 500, 1000, or 5000 credits           │
│                                                              │
│  2. Choose Payment Method                                   │
│     └─> Binance Pay, USDT BEP-20, USDT TRC-20, etc.      │
│                                                              │
│  3. Send Payment Manually                                   │
│     └─> To admin-configured address                        │
│                                                              │
│  4. Submit Transaction Hash                                 │
│     └─> Paste transaction ID/hash                          │
│                                                              │
│  5. Wait for Approval (Status: Pending)                    │
│     └─> Admin reviews within 24 hours                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ADMIN FLOW                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. View Pending Requests                                   │
│     └─> /admin/credit-requests (filter: pending)          │
│                                                              │
│  2. Click "Review" on Request                               │
│     └─> See all details (user, amount, tx hash)           │
│                                                              │
│  3. Verify Transaction                                      │
│     └─> Check on blockchain/payment platform               │
│                                                              │
│  4. Approve or Reject                                       │
│     ├─> Approve: Credits added automatically               │
│     └─> Reject: User notified with reason                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

### Admin Pages
```
app/admin/
├── page.tsx                    # Admin dashboard
├── payment-methods/
│   └── page.tsx               # Payment methods management
└── credit-requests/
    └── page.tsx               # Credit requests review
```

### Admin APIs
```
app/api/admin/
├── payment-methods/
│   ├── route.ts               # GET, POST payment methods
│   └── [id]/route.ts          # PUT, DELETE payment method
└── credit-requests/
    ├── route.ts               # GET all requests
    └── [id]/review/route.ts   # POST approve/reject
```

### User APIs
```
app/api/credits/
├── payment-methods/
│   └── route.ts               # GET active payment methods
└── submit-request/
    └── route.ts               # POST submit credit request
```

### Components
```
components/
├── admin/
│   └── AdminProtectedRoute.tsx # Admin route protection
└── credits/
    └── CreditStoreModal.tsx    # Updated purchase modal
```

### Utilities
```
lib/auth/
└── adminAuth.ts               # Admin authentication

hooks/
└── useAdmin.ts                # Admin check hook

types/
└── creditPurchase.ts          # TypeScript types
```

---

## 🔒 Security Features

### Admin Protection
- ✅ Email-based admin check (`admin@anamul.com`)
- ✅ Row Level Security (RLS) on all tables
- ✅ Server-side validation on all admin endpoints
- ✅ Client-side route protection with `AdminProtectedRoute`

### User Protection
- ✅ Authenticated users only can submit requests
- ✅ Duplicate transaction hash prevention
- ✅ Payment method validation
- ✅ RLS ensures users only see their own requests

### Data Integrity
- ✅ Automatic credit addition via database trigger
- ✅ Transaction hash uniqueness constraint
- ✅ Status validation (pending → approved/rejected only)
- ✅ Foreign key constraints on all relationships

---

## 🧪 Testing the System

### Test as User
1. Sign up with a regular email (not admin@anamul.com)
2. Click "Buy Credits"
3. Select a package and payment method
4. Submit a test transaction hash (any string for testing)
5. Check status shows "Pending Review"

### Test as Admin
1. Log in as `admin@anamul.com`
2. Go to `/admin/credit-requests`
3. See the pending request
4. Click "Review" and approve it
5. Verify credits were added to user account

---

## 🚨 Troubleshooting

### Admin Can't Access Admin Panel
- Verify you're logged in as `admin@anamul.com`
- Check email is verified in Supabase Auth
- Clear browser cache and re-login

### Payment Methods Not Showing
- Check payment methods are marked as "Active"
- Verify RLS policies are installed correctly
- Check browser console for API errors

### Credits Not Added After Approval
- Check database trigger is installed: `handle_credit_approval()`
- Verify `user_profiles` table exists
- Check Supabase logs for errors

### Transaction Hash Already Exists
- Each transaction hash can only be used once
- This prevents duplicate submissions
- User must submit a different transaction hash

---

## 📊 Database Tables Reference

### `payment_methods`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | Payment method name |
| network | VARCHAR | Network (BEP-20, TRC-20, etc.) |
| address | TEXT | Payment address/ID |
| qr_code_url | TEXT | QR code image URL |
| instructions | TEXT | User instructions |
| is_active | BOOLEAN | Visible to users |
| display_order | INTEGER | Sort order |

### `credit_purchase_requests`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User who requested |
| credit_package_id | VARCHAR | Package ID |
| credits_amount | INTEGER | Credits to add |
| price_usd | DECIMAL | USD amount |
| payment_method_id | UUID | Payment method used |
| transaction_hash | TEXT | Transaction ID (unique) |
| status | VARCHAR | pending/approved/rejected |
| admin_notes | TEXT | Admin comments |
| reviewed_by | UUID | Admin who reviewed |
| reviewed_at | TIMESTAMP | Review timestamp |

---

## 🎯 Quick Commands

### Access Admin Panel
```
https://yourapp.com/admin
```

### Manage Payment Methods
```
https://yourapp.com/admin/payment-methods
```

### Review Credit Requests
```
https://yourapp.com/admin/credit-requests
```

---

## 📞 Support

For issues or questions:
1. Check this documentation first
2. Review Supabase logs for errors
3. Check browser console for client-side errors
4. Verify database triggers and RLS policies are installed

---

## ✨ Features

✅ **Manual Payment Verification** - No automated wallet integration needed
✅ **Multiple Payment Methods** - Support any payment method
✅ **Admin Dashboard** - Full-featured admin panel
✅ **Automatic Credit Addition** - Database trigger handles credit addition
✅ **Request History** - Track all credit purchases
✅ **Email Notifications** - Users notified of approval/rejection (can be added)
✅ **Security** - Row Level Security on all data
✅ **Duplicate Prevention** - Transaction hash uniqueness
✅ **Mobile Responsive** - Works on all devices

---

## 🔮 Future Enhancements

- 📧 Email notifications on approval/rejection
- 📱 SMS notifications option
- 🔔 Real-time updates using Supabase Realtime
- 📊 Analytics dashboard for admin
- 🌍 Multi-currency support
- 📑 Export credit request history
- 🎨 Custom branding per payment method

---

**System Ready! 🚀**

Your manual credit purchase system is now fully configured and ready to use.

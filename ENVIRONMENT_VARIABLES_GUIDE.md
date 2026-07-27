# 🔐 Environment Variables Guide

Complete guide to all environment variables needed for the OnChain Alpha Scanner.

---

## 📋 Required Environment Variables

### 1. Backend API URL
```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
```

**What it is**: The URL of your backend API (NestJS server)

**Options**:
- **Local Development**: `http://localhost:3000`
- **Production**: `https://your-backend.onrender.com`
- **Your Current Value**: `https://dual-scanning-modes.onrender.com`

**Used for**: All scanner API calls, credit system, transaction verification

---

### 2. Solana Treasury Wallet
```env
NEXT_PUBLIC_TREASURY_WALLET=YOUR_SOLANA_WALLET_ADDRESS_HERE
```

**What it is**: Your Solana wallet address where credit payments will be sent

**How to get**:
1. Install [Phantom Wallet](https://phantom.app/) browser extension
2. Create or import wallet
3. Copy your wallet address (starts with a letter, ~44 characters)
4. Example: `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

**Used for**: Receiving SOL payments when users purchase credits

**Important**: 
- This is a PUBLIC address (safe to share)
- Make sure you have access to this wallet
- Test with small amounts first

---

### 3. Supabase Project URL
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
```

**What it is**: Your Supabase project's unique URL

**How to get**:
1. Go to https://supabase.com/dashboard
2. Select your project (or create new one)
3. Go to **Settings** → **API**
4. Copy **Project URL**

**Your Current Value**: ✅ `https://sanpifotyozeinatpyki.supabase.co`

**Used for**: Authentication, database operations, user management

---

### 4. Supabase Anon/Public Key
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**What it is**: Public API key for client-side Supabase operations

**How to get**:
1. Same location as Project URL
2. Go to **Settings** → **API**
3. Copy **anon** **public** key (NOT service_role!)

**Your Current Value**: ✅ Already configured

**Used for**: Client-side authentication, database queries with Row Level Security

**Important**:
- ✅ Safe to expose in frontend (limited permissions)
- ✅ Protected by Row Level Security (RLS)
- ❌ NEVER use service_role key in frontend

---

## 📝 Complete Environment Variables List

### For `.env.local` (Local Development)
```env
# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

# Solana Wallet
NEXT_PUBLIC_TREASURY_WALLET=YOUR_SOLANA_WALLET_ADDRESS

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### For Vercel/Render (Production)
```env
# Backend API
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com

# Solana Wallet
NEXT_PUBLIC_TREASURY_WALLET=YOUR_SOLANA_WALLET_ADDRESS

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ✅ What You Have vs What You Need

### ✅ Already Configured:
- ✅ `NEXT_PUBLIC_BACKEND_URL` - Set to `https://dual-scanning-modes.onrender.com`
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Set to `https://sanpifotyozeinatpyki.supabase.co`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Already configured

### ⚠️ Needs Configuration:
- ⚠️ `NEXT_PUBLIC_TREASURY_WALLET` - Currently set to placeholder
  - **Action Required**: Replace with your actual Solana wallet address

---

## 🚀 How to Get Your Solana Wallet Address

### Option 1: Phantom Wallet (Recommended)

1. **Install Phantom**:
   - Go to https://phantom.app/
   - Click "Download"
   - Install browser extension

2. **Create Wallet**:
   - Open Phantom extension
   - Click "Create New Wallet"
   - Save your seed phrase (VERY IMPORTANT!)
   - Set a password

3. **Get Your Address**:
   - Click on wallet name at top
   - Click "Copy Address"
   - Paste into `.env.local`

**Example Address**: `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

### Option 2: Solflare Wallet

1. Install from https://solflare.com/
2. Create wallet
3. Copy address from dashboard

### Option 3: Use Existing Wallet

If you already have a Solana wallet:
- Just copy your public address
- Make sure you have access to receive funds

---

## 🔍 How to Verify Your Environment Variables

### Step 1: Check .env.local File

Open `d:\scanner\.env.local` and verify:
```env
NEXT_PUBLIC_BACKEND_URL=https://dual-scanning-modes.onrender.com ✅
NEXT_PUBLIC_TREASURY_WALLET=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU ⚠️
NEXT_PUBLIC_SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co ✅
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... ✅
```

### Step 2: Test in Browser

After starting your app:
```bash
npm run dev
```

Open browser console (F12) and type:
```javascript
console.log({
  backend: process.env.NEXT_PUBLIC_BACKEND_URL,
  wallet: process.env.NEXT_PUBLIC_TREASURY_WALLET,
  supabase: process.env.NEXT_PUBLIC_SUPABASE_URL
});
```

You should see all values printed.

### Step 3: Test Supabase Connection

Try logging in to your app. If successful, Supabase is configured correctly!

---

## 🛠️ Setting Environment Variables for Deployment

### For Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Click "Add New"
   - Enter Key: `NEXT_PUBLIC_BACKEND_URL`
   - Enter Value: `https://dual-scanning-modes.onrender.com`
   - Select: Production, Preview, Development
   - Click "Save"
5. Repeat for all 4 variables

### For Render

1. Go to https://dashboard.render.com
2. Select your web service
3. Go to **Environment** tab
4. Click "Add Environment Variable"
5. Add each variable:
   - Key: `NEXT_PUBLIC_BACKEND_URL`
   - Value: `https://dual-scanning-modes.onrender.com`
6. Click "Save Changes"
7. Render will automatically redeploy

---

## 🔒 Security Best Practices

### ✅ Safe to Expose (NEXT_PUBLIC_*)
- `NEXT_PUBLIC_BACKEND_URL` - Public API endpoint
- `NEXT_PUBLIC_TREASURY_WALLET` - Public Solana address
- `NEXT_PUBLIC_SUPABASE_URL` - Public Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Limited permissions, protected by RLS

### ❌ NEVER Expose
- Supabase `service_role` key - Full database access
- Private keys or seed phrases - Full wallet access
- API secrets - Backend authentication
- Database passwords - Direct database access

### 🛡️ Protection Mechanisms

**Supabase Anon Key is Safe Because**:
1. ✅ Row Level Security (RLS) limits access
2. ✅ Only allows operations defined in policies
3. ✅ Cannot bypass authentication
4. ✅ Rate limited by Supabase

**Treasury Wallet Address is Safe Because**:
1. ✅ It's just a receive address (public by design)
2. ✅ No private key exposed
3. ✅ Similar to sharing your email address
4. ✅ Users need it to send payments

---

## 🐛 Troubleshooting

### Issue: Environment variables not loading

**Symptoms**: App shows errors about missing variables

**Solutions**:
1. Restart development server after changing `.env.local`:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. Check variable names start with `NEXT_PUBLIC_`:
   - ✅ `NEXT_PUBLIC_SUPABASE_URL`
   - ❌ `SUPABASE_URL`

3. No quotes needed in `.env.local`:
   - ✅ `NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co`
   - ❌ `NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"`

### Issue: "Supabase environment variables are not set"

**Cause**: Missing Supabase configuration

**Solution**: Add both variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### Issue: Authentication not working

**Causes**:
1. Wrong Supabase URL or key
2. Supabase project not configured
3. OAuth redirect URLs not set

**Solutions**:
1. Verify Supabase credentials in dashboard
2. Enable Email provider in Supabase → Authentication → Providers
3. Add redirect URL: `http://localhost:5176/auth/callback`

### Issue: "Cannot connect to backend"

**Cause**: Backend URL incorrect or backend not running

**Solutions**:
1. Verify backend is running at specified URL
2. Check URL format (http:// or https://)
3. Test backend directly in browser

---

## 📊 Environment Variables Checklist

### Local Development (.env.local)
- [ ] `NEXT_PUBLIC_BACKEND_URL` set to `http://localhost:3000` or deployed backend
- [ ] `NEXT_PUBLIC_TREASURY_WALLET` set to your Solana wallet address
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set to your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to your Supabase anon key
- [ ] No quotes around values
- [ ] No trailing spaces
- [ ] File is in project root: `d:\scanner\.env.local`
- [ ] File is in `.gitignore` (already done ✅)

### Vercel Deployment
- [ ] All 4 variables added in Vercel dashboard
- [ ] Variables set for Production, Preview, Development
- [ ] No quotes around values in dashboard
- [ ] Deployment successful after adding variables

### Render Deployment
- [ ] All 4 variables added in Render environment tab
- [ ] Variables saved
- [ ] Service redeployed after adding variables

---

## 🎯 Quick Reference

| Variable | Current Status | What You Need |
|----------|---------------|---------------|
| `NEXT_PUBLIC_BACKEND_URL` | ✅ Configured | `https://dual-scanning-modes.onrender.com` |
| `NEXT_PUBLIC_TREASURY_WALLET` | ⚠️ Placeholder | **Your Solana Wallet Address** |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Configured | `https://sanpifotyozeinatpyki.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Configured | Already set |

---

## 🚀 Next Steps

1. **Get Solana Wallet Address**:
   - Install Phantom: https://phantom.app/
   - Copy your wallet address
   - Update `.env.local`

2. **Test Locally**:
   ```bash
   npm run dev
   # Open http://localhost:5176
   ```

3. **Deploy**:
   - Add same variables to Vercel/Render
   - Test authentication
   - Verify credit system works

---

## 📞 Need Help?

If you're stuck:
1. Check browser console for specific errors
2. Verify all 4 variables are set correctly
3. Restart development server after changes
4. Check deployment logs for errors

**Your environment is 75% configured!** Just need to add your Solana wallet address and you're ready to go! 🚀
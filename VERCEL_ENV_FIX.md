# 🔧 Vercel Environment Variables - Quick Fix

## ❌ Common Issue: Wrong Variable Names

If your Vercel deployment is showing errors related to environment variables, here's the fix.

---

## ✅ **Correct Environment Variable Names**

Your code uses these **exact** variable names (spelling and case matter!):

```env
NEXT_PUBLIC_BACKEND_URL         ← Correct ✅
NEXT_PUBLIC_TREASURY_WALLET     ← Correct ✅
NEXT_PUBLIC_SUPABASE_URL        ← Correct ✅
NEXT_PUBLIC_SUPABASE_ANON_KEY   ← Correct ✅
```

---

## ❌ **Common Mistakes**

### **Wrong Names** (Will NOT work):
```env
NEXT_PUBLIC_URL                 ❌ (missing "BACKEND_")
NEXT_PUBLIC_BACKEND             ❌ (missing "_URL")
NEXT_PUBLIC_API_URL             ❌ (wrong name)
SUPABASE_URL                    ❌ (missing "NEXT_PUBLIC_")
SUPABASE_ANON_KEY               ❌ (missing "NEXT_PUBLIC_")
```

---

## 🔍 **How to Check Your Vercel Variables**

### **Step 1: Go to Vercel Dashboard**
1. Visit https://vercel.com/dashboard
2. Select your project
3. Click **"Settings"** tab
4. Click **"Environment Variables"** in left sidebar

### **Step 2: Verify Each Variable**

You should see **exactly** these 4 variables:

| Key (Must Match Exactly) | Example Value |
|--------------------------|---------------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://dual-scanning-modes.onrender.com` |
| `NEXT_PUBLIC_TREASURY_WALLET` | `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://sanpifotyozeinatpyki.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

---

## 🛠️ **How to Fix**

### **If Variable Names Are Wrong**:

1. **Delete the incorrect variable**:
   - Find variable with wrong name (e.g., `NEXT_PUBLIC_URL`)
   - Click **"..."** menu
   - Click **"Remove"**

2. **Add with correct name**:
   - Click **"Add New"** button
   - Key: `NEXT_PUBLIC_BACKEND_URL` (copy exactly)
   - Value: Your backend URL
   - Environment: Check all (Production, Preview, Development)
   - Click **"Save"**

3. **Repeat for all 4 variables**

4. **Redeploy**:
   - Go to **"Deployments"** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**
   - ✅ **Check "Use existing Build Cache"**
   - Click **"Redeploy"**

---

## 📋 **Complete Setup Checklist**

Copy these **exactly** into Vercel:

### **1. Backend URL**
```
Key: NEXT_PUBLIC_BACKEND_URL
Value: https://dual-scanning-modes.onrender.com
```
*(Or your actual backend URL)*

### **2. Treasury Wallet**
```
Key: NEXT_PUBLIC_TREASURY_WALLET
Value: YOUR_SOLANA_WALLET_ADDRESS
```
*(Replace with your Phantom wallet address)*

### **3. Supabase URL**
```
Key: NEXT_PUBLIC_SUPABASE_URL
Value: https://sanpifotyozeinatpyki.supabase.co
```
*(Your Supabase project URL)*

### **4. Supabase Anon Key**
```
Key: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
*(Your full Supabase anon key - it's very long)*

---

## 🔍 **How to Verify Variable Names Are Correct**

### **Method 1: Check Build Logs**

After deployment, check build logs:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
```

If you see errors about environment variables, they're not set correctly.

### **Method 2: Check Runtime**

After deployment succeeds:
1. Visit your Vercel URL
2. Open browser console (F12)
3. Type:
   ```javascript
   console.log({
     backend: process.env.NEXT_PUBLIC_BACKEND_URL,
     wallet: process.env.NEXT_PUBLIC_TREASURY_WALLET,
     supabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
     supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
   })
   ```

**Expected Output**:
```javascript
{
  backend: "https://dual-scanning-modes.onrender.com",
  wallet: "YOUR_WALLET_ADDRESS",
  supabase: "https://sanpifotyozeinatpyki.supabase.co",
  supabaseKey: "Set"
}
```

**If you see `undefined`**: Variable name is wrong or not set!

---

## 🚨 **Important Notes**

### **Case Sensitivity**:
- ✅ `NEXT_PUBLIC_BACKEND_URL` (all caps)
- ❌ `next_public_backend_url` (won't work)
- ❌ `Next_Public_Backend_Url` (won't work)

### **Underscores Matter**:
- ✅ `NEXT_PUBLIC_BACKEND_URL` (underscores)
- ❌ `NEXT-PUBLIC-BACKEND-URL` (dashes won't work)
- ❌ `NEXTPUBLICBACKENDURL` (no separators won't work)

### **Prefix Required**:
All client-side variables **MUST** start with `NEXT_PUBLIC_`:
- ✅ `NEXT_PUBLIC_BACKEND_URL`
- ❌ `BACKEND_URL` (won't be accessible in browser)

### **No Quotes in Vercel Dashboard**:
When adding variables in Vercel:
- ✅ Value: `https://api.example.com`
- ❌ Value: `"https://api.example.com"` (don't add quotes)

---

## 🎯 **Quick Fix Steps**

1. **Go to Vercel Settings** → **Environment Variables**

2. **Check each variable name matches exactly**:
   ```
   NEXT_PUBLIC_BACKEND_URL        ✅
   NEXT_PUBLIC_TREASURY_WALLET    ✅
   NEXT_PUBLIC_SUPABASE_URL       ✅
   NEXT_PUBLIC_SUPABASE_ANON_KEY  ✅
   ```

3. **Fix any typos**:
   - Delete wrong variable
   - Add with correct name
   - Same value, different name

4. **Save and Redeploy**:
   - Go to Deployments
   - Redeploy latest
   - Wait 1-2 minutes

5. **Test**:
   - Visit your site
   - Open console
   - Check variables are loaded

---

## 📊 **Troubleshooting Decision Tree**

```
Deployment failing?
│
├─ Build fails?
│  ├─ Check build logs for error message
│  ├─ Usually not env variable issue
│  └─ See VERCEL_DEPLOYMENT_GUIDE.md
│
└─ Build succeeds but app broken?
   ├─ Check browser console for errors
   ├─ See "undefined" errors?
   │  └─ Environment variables wrong!
   │     └─ Follow steps above
   │
   └─ API connection fails?
      ├─ Check NEXT_PUBLIC_BACKEND_URL is correct
      ├─ Check backend is running
      └─ Check CORS on backend
```

---

## ✅ **After Fix**

Once variables are correct, you should see:

**Build**: ✅ Success  
**Homepage**: ✅ Loads  
**Console**: ✅ No undefined errors  
**Authentication**: ✅ Works  
**Backend connection**: ✅ Works  

---

## 📸 **Visual Guide**

### **Correct Setup in Vercel**:
```
Environment Variables (4)

┌────────────────────────────────┬──────────────────────────────┐
│ NEXT_PUBLIC_BACKEND_URL        │ https://dual-scanning...     │
├────────────────────────────────┼──────────────────────────────┤
│ NEXT_PUBLIC_TREASURY_WALLET    │ 7xKXtg2CW87d97...           │
├────────────────────────────────┼──────────────────────────────┤
│ NEXT_PUBLIC_SUPABASE_URL       │ https://sanpifotyoz...      │
├────────────────────────────────┼──────────────────────────────┤
│ NEXT_PUBLIC_SUPABASE_ANON_KEY  │ eyJhbGciOiJIUzI1Ni...       │
└────────────────────────────────┴──────────────────────────────┘

All checked for: ✅ Production ✅ Preview ✅ Development
```

---

## 🆘 **Still Not Working?**

### **1. Double-check spelling**:
Copy the correct names from this file (use Ctrl+C/Ctrl+V)

### **2. Check for extra spaces**:
- ✅ `NEXT_PUBLIC_BACKEND_URL` (no spaces)
- ❌ `NEXT_PUBLIC_BACKEND_URL ` (space at end)
- ❌ ` NEXT_PUBLIC_BACKEND_URL` (space at start)

### **3. Verify values are correct**:
- Backend URL should start with `https://`
- Supabase URL should be `.supabase.co`
- Anon key should be very long JWT token

### **4. Clear build cache and redeploy**:
- Deployments → Redeploy
- ❌ Uncheck "Use existing Build Cache"
- Redeploy (will take longer but ensures fresh build)

---

## 📞 **Need More Help?**

See these guides:
- [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md) - Full deployment guide
- [ENVIRONMENT_VARIABLES_GUIDE.md](ENVIRONMENT_VARIABLES_GUIDE.md) - Complete env var reference
- [ENVIRONMENT_STATUS.md](ENVIRONMENT_STATUS.md) - Current configuration status

---

**Remember**: Variable names must match **exactly** - even one character difference will cause failures! 🎯
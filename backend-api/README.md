# 🌐 Backend API Implementation (Phase 3)

This directory contains all backend API files for the referral system.

---

## 📁 Files Overview

| File | Description | Action Required |
|------|-------------|-----------------|
| `auth/auth.guard.ts` | JWT authentication middleware | **CREATE NEW FILE** |
| `referral/referral.controller.ts` | Referral API endpoints | **CREATE NEW FILE** |
| `referral/referral.service.ts` | Referral business logic | **CREATE NEW FILE** |
| `referral/referral.module.ts` | Referral module config | **CREATE NEW FILE** |
| `credits/credits.controller-UPDATE.ts` | Credit purchase with referrals | **UPDATE EXISTING** |
| `app.module-UPDATE.ts` | Main app module | **UPDATE EXISTING** |
| `.env-EXAMPLE` | Environment variables | **REFERENCE ONLY** |
| `package.json-UPDATE` | Dependencies | **REFERENCE ONLY** |

---

## 🚀 Installation Steps

### Step 1: Install Dependencies

```bash
cd your-backend-project
npm install @supabase/supabase-js
```

**That's it!** Only one new dependency needed.

### Step 2: Create Directory Structure

```bash
mkdir -p src/auth
mkdir -p src/referral
```

### Step 3: Copy New Files

Create these files in your backend:

**File 1:** `src/auth/auth.guard.ts`
- Copy content from: `auth/auth.guard.ts`

**File 2:** `src/referral/referral.controller.ts`
- Copy content from: `referral/referral.controller.ts`

**File 3:** `src/referral/referral.service.ts`
- Copy content from: `referral/referral.service.ts`

**File 4:** `src/referral/referral.module.ts`
- Copy content from: `referral/referral.module.ts`

### Step 4: Update Existing Files

**Update 1:** `src/credits/credits.controller.ts`
- Add referral bonus logic from: `credits/credits.controller-UPDATE.ts`
- Key changes:
  - Inject `ReferralService`
  - Call `awardReferralBonus()` after purchase

**Update 2:** `src/credits/credits.module.ts`
- Import `ReferralModule`
- Add to `imports` array

**Update 3:** `src/app.module.ts`
- Import `ReferralModule`
- Add to `imports` array

### Step 5: Add Environment Variables

Go to **Render Dashboard → Your Service → Environment**

Add these variables:

```env
SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co
SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
FRONTEND_URL=https://your-vercel-app.vercel.app
TREASURY_WALLET=49nAGueHXos8Ry2tn3NYLMAidgaQQQ4tHFUwAhZygYM5
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

**How to get `SUPABASE_SERVICE_ROLE_KEY`:**
1. Go to Supabase Dashboard → Settings → API
2. Copy "service_role" key under "Project API keys"
3. ⚠️ **Keep this secret!** Don't commit to Git

### Step 6: Deploy to Render

```bash
git add .
git commit -m "feat: Add referral system API endpoints"
git push origin main
```

Render will auto-deploy. Wait ~5 minutes.

---

## 🧪 Test the API

### Test 1: Get Referral Code

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://dual-scanning-modes.onrender.com/api/referral/code
```

**Expected Response:**
```json
{
  "code": "ABC-DEF-GH12",
  "shareUrl": "https://yourapp.vercel.app/?ref=ABC-DEF-GH12",
  "stats": {
    "totalReferrals": 0,
    "totalEarned": 0,
    "pendingReferrals": 0
  }
}
```

### Test 2: Get Referral History

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://dual-scanning-modes.onrender.com/api/referral/history?limit=10&offset=0
```

**Expected Response:**
```json
{
  "referrals": [],
  "total": 0
}
```

### Test 3: Apply Referral Code

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"ABC-DEF-GH12"}' \
  https://dual-scanning-modes.onrender.com/api/referral/apply
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Referral code applied successfully",
  "referrerUsername": "john_doe"
}
```

---

## 🔐 Security Features

✅ **JWT Authentication** - All endpoints protected by AuthGuard  
✅ **Row Level Security** - Supabase RLS enforced  
✅ **Service Role Key** - Used for admin operations only  
✅ **Input Validation** - All inputs sanitized  
✅ **Error Handling** - Graceful error responses  

---

## 📊 API Endpoints

### `GET /api/referral/code`
Get current user's referral code and stats.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Response:**
```json
{
  "code": "ABC-DEF-GH12",
  "shareUrl": "https://...",
  "stats": {
    "totalReferrals": 5,
    "totalEarned": 150,
    "pendingReferrals": 2
  }
}
```

### `GET /api/referral/history`
Get referral history with pagination.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Query Parameters:**
- `limit` (optional, default: 20, max: 100)
- `offset` (optional, default: 0)

**Response:**
```json
{
  "referrals": [
    {
      "id": "uuid",
      "referredUsername": "alice_crypto",
      "status": "rewarded",
      "bonusCreditsAwarded": 40
    }
  ],
  "total": 1
}
```

### `POST /api/referral/apply`
Apply a referral code.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Body:**
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

---

## 🐛 Troubleshooting

### Error: "Missing or invalid authorization header"

**Cause:** No JWT token or wrong format  
**Solution:** Check token format: `Bearer <token>`

### Error: "Invalid or expired token"

**Cause:** Token expired or invalid  
**Solution:** User needs to re-login

### Error: "Failed to fetch referral code"

**Cause:** Database connection issue  
**Solution:** Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Error: "Referral code not found"

**Cause:** User doesn't have a referral code yet  
**Solution:** Check if trigger `handle_new_user()` fired on signup

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Backend API is running on Render
- [ ] Environment variables configured
- [ ] JWT authentication working
- [ ] GET `/api/referral/code` returns data
- [ ] GET `/api/referral/history` returns empty array (initially)
- [ ] POST `/api/referral/apply` validates codes
- [ ] Credit purchase awards referral bonuses
- [ ] No errors in Render logs

---

## ⏭️ Next: Phase 4 - Frontend Integration

Once backend API is deployed and tested, we'll update the frontend to:

1. Remove mock data from `services/referralApi.ts`
2. Update `AuthContext.tsx` with token storage
3. Test end-to-end flow

---

**Backend API implementation complete! Ready for Phase 4.**

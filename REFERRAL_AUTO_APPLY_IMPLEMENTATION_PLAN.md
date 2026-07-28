# Referral Code Auto-Apply Implementation Plan

## Current State Analysis

### What's Currently Implemented

1. **Referral Code Capture** (`app/page.tsx`):
   - ✅ URL parameter `?ref=CODE` is captured
   - ✅ Code is stored in `localStorage` as `pendingReferralCode`
   - ✅ Toast notification shows when code is saved
   - ✅ Message says "will be applied on your first purchase"

2. **Signup Flow** (`contexts/AuthContext.tsx`):
   - ✅ Signup function accepts: `email`, `password`, `name`
   - ✅ After signup, it checks for `pendingReferralCode` in localStorage
   - ✅ Attempts to apply referral code automatically (2s delay)
   - ❌ NO UI FIELD for referral code during signup

3. **Auth Modal** (`components/AuthModal.tsx`):
   - ✅ Has login/signup modes
   - ✅ Signup form collects: `name`, `email`, `password`
   - ❌ NO referral code input field
   - ❌ NO indication if user has pending referral code
   - ❌ User cannot manually enter referral code

4. **Referral Dashboard**:
   - ✅ Shows user's referral code
   - ✅ Copy code button
   - ✅ Share link button with proper URL format
   - ✅ Social sharing (Twitter, Telegram, Email)

### Problems Identified

| Issue | Current Behavior | Expected Behavior |
|-------|------------------|-------------------|
| **1. No Signup Referral Field** | User cannot enter referral code during signup | User should see referral code field in signup form |
| **2. No Auto-Fill Indication** | If user comes via referral link, signup form doesn't show the code | Referral code should be pre-filled and locked (read-only) |
| **3. Session Persistence** | If user navigates away from homepage, referral code is lost from UI | Referral code should persist in UI throughout session |
| **4. No Manual Entry Path** | User without referral link cannot enter code | User should be able to manually enter code if no link used |
| **5. No Redirect to Signup** | Referral link goes to homepage, not signup | Should redirect to signup page with code pre-filled |
| **6. Post-Login Restriction Missing** | No enforcement preventing code entry after login | Should show "Already registered" message |

---

## Proposed Solution Architecture

### Flow Diagram

```
SCENARIO A: User comes with referral link
┌─────────────────────────────────────────────────────────────┐
│ User clicks: https://app.com/?ref=ABC12345                  │
└────────────┬────────────────────────────────────────────────┘
             │
             v
┌─────────────────────────────────────────────────────────────┐
│ 1. Capture ref=ABC12345 from URL                            │
│ 2. Store in localStorage: pendingReferralCode=ABC12345      │
│ 3. Store in sessionStorage: hasReferralCode=true            │
│ 4. Redirect to /signup?ref=ABC12345                         │
└────────────┬────────────────────────────────────────────────┘
             │
             v
┌─────────────────────────────────────────────────────────────┐
│ Signup Page Shows:                                           │
│ • Name field                                                 │
│ • Email field                                                │
│ • Password field                                             │
│ • Referral Code field (pre-filled, locked, with check icon) │
│ • Message: "Referral code ABC12345 will be applied"         │
└────────────┬────────────────────────────────────────────────┘
             │
             v
┌─────────────────────────────────────────────────────────────┐
│ User fills form and clicks "Sign Up"                         │
└────────────┬────────────────────────────────────────────────┘
             │
             v
┌─────────────────────────────────────────────────────────────┐
│ Backend:                                                     │
│ 1. Create user account in Supabase                          │
│ 2. Apply referral code ABC12345 to user profile             │
│ 3. Create referral link in database                         │
│ 4. Show success: "Account created! Referral code applied"   │
└─────────────────────────────────────────────────────────────┘

SCENARIO B: User comes without referral link
┌─────────────────────────────────────────────────────────────┐
│ User navigates to /signup directly                           │
└────────────┬────────────────────────────────────────────────┘
             │
             v
┌─────────────────────────────────────────────────────────────┐
│ Signup Page Shows:                                           │
│ • Name field                                                 │
│ • Email field                                                │
│ • Password field                                             │
│ • Referral Code field (empty, editable, optional)           │
│ • Placeholder: "Enter referral code (optional)"             │
└────────────┬────────────────────────────────────────────────┘
             │
             v
┌─────────────────────────────────────────────────────────────┐
│ User can:                                                    │
│ A) Leave blank and signup (no referral)                     │
│ B) Enter code manually and signup (with referral)           │
└─────────────────────────────────────────────────────────────┘

SCENARIO C: Already logged-in user tries to enter code
┌─────────────────────────────────────────────────────────────┐
│ Logged-in user visits /?ref=ABC12345                        │
└────────────┬────────────────────────────────────────────────┘
             │
             v
┌─────────────────────────────────────────────────────────────┐
│ System checks: user.isAuthenticated === true                │
│ Show toast: "You're already registered. Referral codes      │
│              can only be used during signup."               │
│ Do NOT store code in localStorage                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Create Dedicated Signup Page (NEW)

**File**: `app/signup/page.tsx` (NEW FILE)

**Features**:
- Dedicated signup page at `/signup`
- Accepts URL parameter `?ref=CODE`
- Shows referral code field (pre-filled or editable)
- Uses same Supabase auth as AuthModal
- Redirects to homepage after successful signup

**Components Needed**:
- Create new page component
- Reuse form fields from AuthModal
- Add referral code input field
- Add validation logic

---

### Phase 2: Update Referral Code Capture Logic

**File**: `app/page.tsx` (MODIFY)

**Changes**:
```typescript
// OLD CODE:
useEffect(() => {
  const refCode = searchParams.get('ref');
  if (refCode) {
    localStorage.setItem('pendingReferralCode', refCode);
    toast.success(`Referral code ${refCode} saved!`);
  }
}, [searchParams]);

// NEW CODE:
useEffect(() => {
  const refCode = searchParams.get('ref');
  if (refCode) {
    // Check if user is already logged in
    if (isAuthenticated) {
      toast.error('You\'re already registered. Referral codes can only be used during signup.', {
        duration: 5000,
        icon: '❌',
      });
      return;
    }

    // Store referral code
    localStorage.setItem('pendingReferralCode', refCode);
    sessionStorage.setItem('hasReferralCode', 'true');
    
    // Redirect to signup page with referral code
    router.push(`/signup?ref=${refCode}`);
  }
}, [searchParams, isAuthenticated, router]);
```

---

### Phase 3: Update AuthModal Component

**File**: `components/AuthModal.tsx` (MODIFY)

**Changes**:
1. Add referral code field to signup form
2. Check for `pendingReferralCode` in localStorage
3. If found, show pre-filled and locked field
4. If not found, show editable optional field
5. Pass referral code to signup function

**New Props/State**:
```typescript
const [referralCode, setReferralCode] = useState('');
const [isReferralLocked, setIsReferralLocked] = useState(false);

// Check for pending referral code on mount
useEffect(() => {
  if (mode === 'signup') {
    const pendingCode = localStorage.getItem('pendingReferralCode');
    if (pendingCode) {
      setReferralCode(pendingCode);
      setIsReferralLocked(true);
    }
  }
}, [mode]);
```

**New UI Field**:
```tsx
{mode === 'signup' && (
  <div>
    <label className="block text-sm font-bold text-slate-400 mb-2">
      Referral Code (Optional)
    </label>
    <div className="rgb-border">
      <div className="relative">
        <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          value={referralCode}
          onChange={(e) => !isReferralLocked && setReferralCode(e.target.value.toUpperCase())}
          placeholder="Enter referral code (optional)"
          className={`w-full bg-slate-900 rounded-lg py-3 pl-11 pr-11 text-white placeholder-slate-600 focus:outline-none border-0 ${
            isReferralLocked ? 'cursor-not-allowed opacity-75' : ''
          }`}
          readOnly={isReferralLocked}
          maxLength={8}
        />
        {isReferralLocked && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
        )}
      </div>
    </div>
    {isReferralLocked && (
      <p className="text-xs text-green-400 mt-1">
        ✓ Referral code will be applied after signup
      </p>
    )}
  </div>
)}
```

---

### Phase 4: Update AuthContext Signup Function

**File**: `contexts/AuthContext.tsx` (MODIFY)

**Changes**:
```typescript
// OLD SIGNATURE:
const signup = async (email: string, password: string, name: string) => { ... }

// NEW SIGNATURE:
const signup = async (
  email: string, 
  password: string, 
  name: string, 
  referralCode?: string
) => {
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
        referralCode: referralCode || null, // Store in user metadata
      },
    },
  });
  if (error) throw error;
  
  // Apply referral code if provided
  if (referralCode && data.user) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const { applyReferralCode } = await import('../services/referralApi');
      await applyReferralCode(referralCode);
      
      // Clear pending code from storage
      localStorage.removeItem('pendingReferralCode');
      sessionStorage.removeItem('hasReferralCode');
      
      toast.success('Referral code applied successfully!');
    } catch (error) {
      console.error('Failed to apply referral code:', error);
      toast.error('Account created, but referral code could not be applied.');
    }
  }
};
```

---

### Phase 5: Update Navigation to Show Signup Link

**File**: `components/layout/Navigation.tsx` (MODIFY)

**Changes**:
- Add "Sign Up" button next to Login button
- If user has `pendingReferralCode`, show badge on signup button
- Example: "Sign Up 🎁" or "Sign Up (Referral)"

---

### Phase 6: Add Session Persistence

**File**: `hooks/useReferralSession.ts` (NEW FILE)

**Purpose**: Track referral code throughout user session

```typescript
import { useState, useEffect } from 'react';

export function useReferralSession() {
  const [hasReferralCode, setHasReferralCode] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    // Check for pending referral code
    const code = localStorage.getItem('pendingReferralCode');
    const hasCode = sessionStorage.getItem('hasReferralCode') === 'true';
    
    if (code && hasCode) {
      setHasReferralCode(true);
      setReferralCode(code);
    }
  }, []);

  const clearReferralCode = () => {
    localStorage.removeItem('pendingReferralCode');
    sessionStorage.removeItem('hasReferralCode');
    setHasReferralCode(false);
    setReferralCode(null);
  };

  return {
    hasReferralCode,
    referralCode,
    clearReferralCode,
  };
}
```

---

### Phase 7: Update Referral Dashboard Share Links

**File**: `components/referral/ReferralDashboard.tsx` (ALREADY CORRECT)

**Current State**:
- ✅ Already generates proper share URLs with `?ref=CODE`
- ✅ `formatReferralUrl()` function works correctly
- ✅ No changes needed

---

## File Structure After Implementation

```
scanner/
├── app/
│   ├── signup/
│   │   └── page.tsx              (NEW - Dedicated signup page)
│   ├── page.tsx                  (MODIFY - Add redirect logic)
│   └── ...
├── components/
│   ├── AuthModal.tsx             (MODIFY - Add referral field)
│   ├── layout/
│   │   └── Navigation.tsx        (MODIFY - Add signup button)
│   └── referral/
│       └── ReferralDashboard.tsx (NO CHANGES)
├── contexts/
│   └── AuthContext.tsx           (MODIFY - Update signup function)
├── hooks/
│   └── useReferralSession.ts     (NEW - Session tracking)
└── services/
    └── referralApi.ts            (NO CHANGES)
```

---

## Testing Checklist

### Test Scenario 1: User with Referral Link
- [ ] User clicks `https://app.com/?ref=ABC12345`
- [ ] System captures code and redirects to `/signup?ref=ABC12345`
- [ ] Signup form shows pre-filled referral code (locked)
- [ ] User completes signup
- [ ] Referral code is applied to user profile
- [ ] User sees success message
- [ ] Referrer sees +1 referral in dashboard

### Test Scenario 2: User without Referral Link
- [ ] User navigates to `/signup` directly
- [ ] Signup form shows empty referral code field (editable)
- [ ] User leaves field blank and signs up
- [ ] Account created successfully (no referral)
- [ ] No referral code applied

### Test Scenario 3: Manual Referral Code Entry
- [ ] User navigates to `/signup` directly
- [ ] User enters referral code `XYZ99999`
- [ ] Code is validated (format check)
- [ ] User completes signup
- [ ] Code is applied to user profile
- [ ] Referrer sees +1 referral

### Test Scenario 4: Already Logged-In User
- [ ] Logged-in user visits `/?ref=ABC12345`
- [ ] System detects `isAuthenticated === true`
- [ ] Shows error toast: "Already registered"
- [ ] Code is NOT stored in localStorage
- [ ] User remains on current page

### Test Scenario 5: Session Persistence
- [ ] User clicks referral link
- [ ] User navigates to `/credits` page
- [ ] User clicks "Sign Up" button
- [ ] Signup form still shows pre-filled referral code
- [ ] Code persists throughout session

### Test Scenario 6: Invalid Referral Code
- [ ] User enters invalid code `INVALID1`
- [ ] System attempts to apply code
- [ ] Backend returns error (code doesn't exist)
- [ ] User sees: "Account created, but referral code invalid"
- [ ] User account is still created (partial success)

---

## Data Flow Summary

```
┌──────────────────────────────────────────────────────────────┐
│                    REFERRAL CODE FLOW                        │
└──────────────────────────────────────────────────────────────┘

1. CAPTURE
   └─> URL: /?ref=CODE
       └─> localStorage.setItem('pendingReferralCode', CODE)
           └─> sessionStorage.setItem('hasReferralCode', 'true')

2. DISPLAY
   └─> Signup Page
       └─> Check localStorage for pendingReferralCode
           ├─> Found: Pre-fill field (locked)
           └─> Not Found: Show empty field (editable)

3. SUBMIT
   └─> User submits signup form
       └─> Create Supabase account
           └─> Apply referral code via API
               ├─> Success: Clear localStorage + show success
               └─> Failure: Clear localStorage + show error

4. CLEANUP
   └─> After signup complete
       └─> localStorage.removeItem('pendingReferralCode')
           └─> sessionStorage.removeItem('hasReferralCode')
```

---

## Edge Cases to Handle

| Edge Case | Handling Strategy |
|-----------|-------------------|
| **User has code, clears browser storage** | Referral link is lost. This is expected behavior (user action). |
| **User tries to use own referral code** | Backend validates and rejects (API returns error). Show: "Cannot use your own code" |
| **User tries to use referral code twice** | Backend checks if user already has referral applied. Show: "Code already applied" |
| **Referral code doesn't exist** | Backend returns 404. Show: "Invalid referral code. Account created anyway." |
| **Backend is down during signup** | Account is created, but code isn't applied. Show warning. User can contact support. |
| **User opens multiple tabs with different codes** | Last code wins (overwrites localStorage). This is expected. |
| **User navigates away mid-signup** | Code persists in localStorage + sessionStorage until signup or logout |
| **User logs out and comes back** | Code is cleared on logout. New referral link needed. |

---

## API Integration Points

### Frontend → Backend
```typescript
// Apply referral code after signup
POST /api/referral/apply
Headers: { Authorization: "Bearer JWT_TOKEN" }
Body: { code: "ABC12345" }

Response 200:
{
  "success": true,
  "message": "Referral code applied",
  "referrerUsername": "john_doe"
}

Response 400:
{
  "success": false,
  "message": "Invalid referral code"
}

Response 409:
{
  "success": false,
  "message": "Referral code already applied"
}
```

---

## Implementation Priority

1. ✅ **HIGH PRIORITY** - Create `/signup` page (Phase 1)
2. ✅ **HIGH PRIORITY** - Update AuthModal with referral field (Phase 3)
3. ✅ **HIGH PRIORITY** - Update AuthContext signup function (Phase 4)
4. ✅ **MEDIUM PRIORITY** - Add redirect logic to homepage (Phase 2)
5. ✅ **MEDIUM PRIORITY** - Create session persistence hook (Phase 6)
6. ✅ **LOW PRIORITY** - Update Navigation with signup button (Phase 5)

---

## Timeline Estimate

| Phase | Estimated Time | Complexity |
|-------|----------------|------------|
| Phase 1: Create Signup Page | 1 hour | Medium |
| Phase 2: Update Homepage Redirect | 30 min | Low |
| Phase 3: Update AuthModal | 1 hour | Medium |
| Phase 4: Update AuthContext | 45 min | Medium |
| Phase 5: Update Navigation | 30 min | Low |
| Phase 6: Session Persistence Hook | 45 min | Medium |
| **Testing & Bug Fixes** | 1.5 hours | - |
| **TOTAL** | **~5-6 hours** | - |

---

## Success Metrics

After implementation, we should see:

1. ✅ 100% of users coming via referral link have code auto-applied
2. ✅ 0% confusion about "where to enter referral code"
3. ✅ Users can see referral code during signup (visual confirmation)
4. ✅ Referral code persists throughout entire session
5. ✅ Clear error messages for invalid codes
6. ✅ No way to apply code after account creation

---

## Questions for Review

Before implementation, confirm:

1. ✅ Should referral code be REQUIRED or OPTIONAL?
   - **Answer**: Optional (users can signup without code)

2. ✅ What happens if user tries to use expired code?
   - **Answer**: Backend validates, returns error, account still created

3. ✅ Should we allow code editing if pre-filled?
   - **Answer**: NO - locked/read-only if from referral link

4. ✅ Should we show referrer's name on signup?
   - **Answer**: YES - "Referred by @john_doe" for trust

5. ✅ What if user signs up via Google OAuth?
   - **Answer**: Same flow - check localStorage and apply code

---

**Status**: Ready for Implementation  
**Created**: July 27, 2026  
**Next Step**: Review plan, then proceed with Phase 1 (Create Signup Page)

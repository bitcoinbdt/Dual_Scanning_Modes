# Firebase to Supabase Migration Guide

## Overview
This document identifies all Firebase dependencies in the OnChain Alpha Scanner project that need to be replaced with Supabase. The tech stack is being updated from Firebase to:

- **Frontend**: Vercel (Next.js 15)
- **Backend**: Render (NestJS)
- **User Data**: Supabase (Authentication + PostgreSQL Database)

## 🔍 Firebase Dependencies Identified

### 1. Package Dependencies
**File**: `package.json`
```json
"dependencies": {
  "firebase": "^12.13.0",
  // ... other dependencies
}
```
**Action**: Remove `firebase` and install `@supabase/supabase-js`

### 2. Authentication Context
**File**: `contexts/AuthContext.tsx`

**Firebase Imports**:
```typescript
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../lib/firebase';
```

**Firebase Functions Used**:
- `signInWithEmailAndPassword(auth, email, password)`
- `createUserWithEmailAndPassword(auth, email, password)`
- `signOut(auth)`
- `onAuthStateChanged(auth, callback)`
- `signInWithPopup(auth, provider)`

**User Interface**:
```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  // ... other methods
}
```

**Replacement Plan**: Replace with Supabase Auth maintaining the same interface.

### 3. Firebase Configuration File
**File**: `lib/firebase.ts`
```typescript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBMddZkr8Dq5AEzO3yrwj3O7YfK7jnCcsE",
  authDomain: "onchain-alpha.firebaseapp.com",
  projectId: "onchain-alpha",
  storageBucket: "onchain-alpha.firebasestorage.app",
  messagingSenderId: "666575538581",
  appId: "1:666575538581:web:e8e44bac84b29b2f630e9c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

**Replacement**: Create `lib/supabase.ts` with Supabase client initialization.

### 4. Environment Variables
**File**: `.env.production.template`
```env
# Firebase Configuration (already set in lib/firebase.ts, but can override here)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBMddZkr8Dq5AEzO3yrwj3O7YfK7jnCcsE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=onchain-alpha.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=onchain-alpha
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=onchain-alpha.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=666575538581
NEXT_PUBLIC_FIREBASE_APP_ID=1:666575538581:web:e8e44bac84b29b2f630e9c
```

**Replacement Variables**:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 5. Documentation References

**Files that need updates**:
1. `goal.md` - Multiple Firebase references in authentication section
2. `plan.md` - Firebase mentions in technical implementation
3. `DEPLOYMENT_GUIDE.md` - Firebase configuration instructions
4. `README.md` - **Already updated**

**Specific sections to update**:
- Authentication system description
- Environment variable setup instructions
- Deployment checklist items
- Technology stack mentions

## 📋 Migration Steps

### Phase 1: Setup Supabase
1. **Create Supabase Project**
   - Sign up at [supabase.com](https://supabase.com)
   - Create new project
   - Note project URL and anon key

2. **Configure Authentication**
   - Enable email/password authentication
   - Configure Google OAuth provider
   - Set up redirect URLs

3. **Database Schema**
   - Create `users` table for user data
   - Create `credit_transactions` table
   - Set up proper relationships

### Phase 2: Update Codebase
1. **Remove Firebase Dependency**
   ```bash
   npm uninstall firebase
   npm install @supabase/supabase-js
   ```

2. **Create Supabase Configuration**
   - Create `lib/supabase.ts` with client initialization
   - Export Supabase client instance

3. **Update AuthContext**
   - Replace Firebase imports with Supabase imports
   - Update authentication methods
   - Maintain same interface for backward compatibility

4. **Update Environment Variables**
   - Remove Firebase variables from `.env.*` files
   - Add Supabase variables
   - Update any hardcoded references

### Phase 3: Update Documentation
1. **Update README.md** - ✅ **Already completed**
2. **Update goal.md** - Remove Firebase references
3. **Update plan.md** - Update authentication section
4. **Update DEPLOYMENT_GUIDE.md** - Update deployment instructions

### Phase 4: Testing
1. **Authentication Testing**
   - Test email/password login
   - Test Google OAuth login
   - Test user state persistence
   - Test logout functionality

2. **Integration Testing**
   - Test credit system with authenticated users
   - Test scanner functionality
   - Test all UI components

## 🔄 Supabase Implementation Details

### New File: `lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Updated AuthContext Interface
The interface should remain the same for backward compatibility:
```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  // ... other methods
}
```

### Supabase Auth Methods
```typescript
// Login with email/password
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
})

// Sign up with email/password
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      name: name
    }
  }
})

// Google OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
})

// Logout
await supabase.auth.signOut()

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
  // Handle auth state changes
})
```

## 🗂️ Database Schema for Supabase

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);
```

### Credit Balance Table
```sql
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  total_purchased INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Credit Transactions Table
```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('purchase', 'spend', 'refund')),
  amount INTEGER NOT NULL,
  description TEXT,
  balance_after INTEGER,
  solana_tx_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## ✅ Success Criteria

### Technical
- ✅ Firebase package removed from dependencies
- ✅ Supabase package installed and configured
- ✅ Authentication works with email/password
- ✅ Google OAuth authentication works
- ✅ User state persists across page reloads
- ✅ All existing functionality works unchanged

### User Experience
- ✅ Users can sign up with email/password
- ✅ Users can sign in with Google
- ✅ Credit system works with authenticated users
- ✅ Scanner functionality unaffected
- ✅ No breaking changes to existing user flows

### Security
- ✅ Environment variables properly configured
- ✅ Authentication tokens securely managed
- ✅ Database connections secured
- ✅ CORS policies maintained

## 🚨 Potential Issues & Solutions

### 1. User ID Mismatch
**Issue**: Firebase uses UIDs, Supabase uses UUIDs
**Solution**: Map Firebase UIDs to Supabase user records during migration

### 2. Google OAuth Configuration
**Issue**: Different configuration between Firebase and Supabase
**Solution**: Reconfigure Google OAuth in Supabase dashboard

### 3. Auth State Management
**Issue**: Different auth state handling patterns
**Solution**: Use Supabase's `onAuthStateChange` with similar patterns

### 4. Database Migration
**Issue**: Existing user data needs migration
**Solution**: Create migration script to transfer user data

## 📞 Support Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Migration Examples](https://supabase.com/docs/guides/migrations)

## 📅 Migration Timeline

1. **Week 1**: Setup Supabase project and database schema
2. **Week 2**: Update codebase and test authentication
3. **Week 3**: Update documentation and run integration tests
4. **Week 4**: Deploy to staging and perform user acceptance testing
5. **Week 5**: Deploy to production and monitor for issues

---

**Last Updated**: July 27, 2026  
**Migration Status**: Planning Phase  
**Assigned To**: Development Team
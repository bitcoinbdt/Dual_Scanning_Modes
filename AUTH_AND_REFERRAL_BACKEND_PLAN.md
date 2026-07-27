# Authentication & Referral System - Backend Integration Plan

## 🎯 Objective

Connect the existing UI (signup/login + referral system) to Supabase backend and Render API to create a fully functional authentication and referral system.

---

## 📋 Current State

### ✅ What's Already Done (Frontend)
- Supabase client configured (`lib/supabase.ts`)
- AuthContext with email/password + Google OAuth
- AuthModal component for login/signup UI
- Referral UI components (dashboard, history, input)
- Referral page (`/referrals`)
- URL parameter capture for referral codes
- Mock data for development testing

### ❌ What's Missing (Backend)
- Supabase database tables
- Supabase authentication policies
- Backend API endpoints for referrals
- Backend credit purchase integration with referrals
- User profile management
- Referral code generation on signup
- Bonus credit awarding logic

---

## 🗄️ Phase 1: Supabase Database Setup

### 1.1 User Profiles Table

**Purpose:** Store additional user data beyond Supabase Auth

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends auth.users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_scans INTEGER DEFAULT 0,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  
  -- Referral tracking
  referred_by UUID REFERENCES auth.users(id),
  referral_code_used TEXT,
  
  UNIQUE(id)
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: System can insert on signup
CREATE POLICY "System can insert profiles"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create index
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_referred_by ON public.user_profiles(referred_by);
```

### 1.2 Referral Codes Table

```sql
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(12) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  total_referrals INTEGER DEFAULT 0,
  total_earned_credits INTEGER DEFAULT 0,
  
  UNIQUE(user_id),
  UNIQUE(code)
);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own code
CREATE POLICY "Users can view own referral code"
  ON public.referral_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert codes
CREATE POLICY "System can insert referral codes"
  ON public.referral_codes
  FOR INSERT
  WITH CHECK (true);

-- Policy: System can update codes
CREATE POLICY "System can update referral codes"
  ON public.referral_codes
  FOR UPDATE
  USING (true);

-- Indexes
CREATE INDEX idx_referral_code ON public.referral_codes(code);
CREATE INDEX idx_referral_user_id ON public.referral_codes(user_id);
```

### 1.3 Referrals Table

```sql
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(12) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  -- Status: pending, confirmed, rewarded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_purchase_at TIMESTAMP WITH TIME ZONE,
  first_purchase_amount DECIMAL(10,2),
  bonus_credits_awarded INTEGER DEFAULT 0,
  
  UNIQUE(referred_user_id),
  CHECK (referrer_user_id != referred_user_id)
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their referrals
CREATE POLICY "Users can view own referrals"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

-- Policy: System can manage referrals
CREATE POLICY "System can manage referrals"
  ON public.referrals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_referred ON public.referrals(referred_user_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);
```

### 1.4 Referral Rewards Table

```sql
CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id),
  referred_user_id UUID NOT NULL REFERENCES auth.users(id),
  purchase_package_id VARCHAR(50) NOT NULL,
  credits_purchased INTEGER NOT NULL,
  bonus_credits INTEGER NOT NULL,
  bonus_percentage DECIMAL(5,2) NOT NULL,
  credited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_bonus CHECK (bonus_credits >= 0),
  CONSTRAINT valid_percentage CHECK (bonus_percentage >= 0 AND bonus_percentage <= 100)
);

-- Enable RLS
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their rewards
CREATE POLICY "Users can view own rewards"
  ON public.referral_rewards
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

-- Indexes
CREATE INDEX idx_rewards_referrer ON public.referral_rewards(referrer_user_id);
CREATE INDEX idx_rewards_referral ON public.referral_rewards(referral_id);
```

### 1.5 Credit Transactions Table (if not exists)

```sql
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  -- Types: purchase, bonus, scan_deduction, refund
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CHECK (type IN ('purchase', 'bonus', 'scan_deduction', 'refund'))
);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_tx_type ON public.credit_transactions(type);
```

---

## 🔧 Phase 2: Supabase Database Functions

### 2.1 Auto-Generate Referral Code on Signup

**Purpose:** Automatically create referral code when user signs up

```sql
-- Function to generate random referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate ABC-DEF-GH12 format
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to create profile and referral code on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  
  -- Generate unique referral code
  LOOP
    new_code := generate_referral_code();
    attempts := attempts + 1;
    
    -- Try to insert, exit loop if successful
    BEGIN
      INSERT INTO public.referral_codes (user_id, code)
      VALUES (NEW.id, new_code);
      EXIT; -- Success, exit loop
    EXCEPTION WHEN unique_violation THEN
      IF attempts >= max_attempts THEN
        RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', max_attempts;
      END IF;
      -- Try again with new code
    END;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

### 2.2 Apply Referral Code Function

```sql
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_result JSONB;
BEGIN
  -- Check if code exists
  SELECT user_id INTO v_referrer_id
  FROM public.referral_codes
  WHERE code = p_code AND is_active = true;
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid or inactive referral code'
    );
  END IF;
  
  -- Check if user is trying to use their own code
  IF v_referrer_id = p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You cannot use your own referral code'
    );
  END IF;
  
  -- Check if user already has a referrer
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You have already used a referral code'
    );
  END IF;
  
  -- Check if user already purchased (too late to apply)
  IF EXISTS (
    SELECT 1 FROM public.credit_transactions 
    WHERE user_id = p_user_id AND type = 'purchase'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Referral codes must be applied before your first purchase'
    );
  END IF;
  
  -- Create referral record
  INSERT INTO public.referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status
  ) VALUES (
    v_referrer_id,
    p_user_id,
    p_code,
    'confirmed'
  );
  
  -- Update user profile
  UPDATE public.user_profiles
  SET referred_by = v_referrer_id,
      referral_code_used = p_code
  WHERE id = p_user_id;
  
  -- Increment referrer's count
  UPDATE public.referral_codes
  SET total_referrals = total_referrals + 1
  WHERE user_id = v_referrer_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Referral code applied successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.3 Award Referral Bonus Function

```sql
CREATE OR REPLACE FUNCTION award_referral_bonus(
  p_buyer_user_id UUID,
  p_package_id TEXT,
  p_credits_purchased INTEGER,
  p_amount_paid DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_bonus_credits INTEGER;
  v_bonus_percentage DECIMAL;
BEGIN
  -- Check if this is a referred user's first purchase
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referred_user_id = p_buyer_user_id
    AND status = 'confirmed'
    AND first_purchase_at IS NULL;
  
  IF v_referral IS NULL THEN
    -- No referral or already rewarded
    RETURN jsonb_build_object(
      'awarded', false,
      'reason', 'No eligible referral found'
    );
  END IF;
  
  -- Calculate bonus based on package
  CASE p_package_id
    WHEN 'starter' THEN
      v_bonus_percentage := 10;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.10);
    WHEN 'basic' THEN
      v_bonus_percentage := 15;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.15);
    WHEN 'pro' THEN
      v_bonus_percentage := 20;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.20);
    WHEN 'premium' THEN
      v_bonus_percentage := 25;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.25);
    ELSE
      v_bonus_percentage := 10;
      v_bonus_credits := FLOOR(p_credits_purchased * 0.10);
  END CASE;
  
  -- Update referral record
  UPDATE public.referrals
  SET status = 'rewarded',
      first_purchase_at = NOW(),
      first_purchase_amount = p_amount_paid,
      bonus_credits_awarded = v_bonus_credits
  WHERE id = v_referral.id;
  
  -- Create reward record
  INSERT INTO public.referral_rewards (
    referral_id,
    referrer_user_id,
    referred_user_id,
    purchase_package_id,
    credits_purchased,
    bonus_credits,
    bonus_percentage
  ) VALUES (
    v_referral.id,
    v_referral.referrer_user_id,
    p_buyer_user_id,
    p_package_id,
    p_credits_purchased,
    v_bonus_credits,
    v_bonus_percentage
  );
  
  -- Add bonus credits to referrer's balance
  -- Get current balance
  DECLARE
    v_current_balance INTEGER;
  BEGIN
    SELECT COALESCE(SUM(
      CASE 
        WHEN type IN ('purchase', 'bonus', 'refund') THEN amount
        WHEN type = 'scan_deduction' THEN -amount
        ELSE 0
      END
    ), 0) INTO v_current_balance
    FROM public.credit_transactions
    WHERE user_id = v_referral.referrer_user_id;
    
    -- Create bonus transaction
    INSERT INTO public.credit_transactions (
      user_id,
      type,
      amount,
      balance_after,
      description,
      metadata
    ) VALUES (
      v_referral.referrer_user_id,
      'bonus',
      v_bonus_credits,
      v_current_balance + v_bonus_credits,
      'Referral bonus from ' || (SELECT email FROM auth.users WHERE id = p_buyer_user_id),
      jsonb_build_object(
        'referral_id', v_referral.id,
        'referred_user_id', p_buyer_user_id,
        'package_id', p_package_id,
        'bonus_percentage', v_bonus_percentage
      )
    );
  END;
  
  -- Update referral code stats
  UPDATE public.referral_codes
  SET total_earned_credits = total_earned_credits + v_bonus_credits
  WHERE user_id = v_referral.referrer_user_id;
  
  RETURN jsonb_build_object(
    'awarded', true,
    'referrer_user_id', v_referral.referrer_user_id,
    'bonus_credits', v_bonus_credits,
    'bonus_percentage', v_bonus_percentage
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🌐 Phase 3: Backend API Endpoints (Render - NestJS)

### 3.1 Authentication Middleware

**File:** `src/auth/auth.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AuthGuard implements CanActivate {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      
      if (error || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // Attach user to request
      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
```

### 3.2 Referral Controller

**File:** `src/referral/referral.controller.ts`

```typescript
import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ReferralService } from './referral.service';

@Controller('api/referral')
@UseGuards(AuthGuard)
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('code')
  async getReferralCode(@Req() req: any) {
    const userId = req.user.id;
    return this.referralService.getReferralCode(userId);
  }

  @Get('history')
  async getReferralHistory(
    @Req() req: any,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0
  ) {
    const userId = req.user.id;
    return this.referralService.getReferralHistory(userId, limit, offset);
  }

  @Post('apply')
  async applyReferralCode(
    @Req() req: any,
    @Body('code') code: string
  ) {
    const userId = req.user.id;
    return this.referralService.applyReferralCode(userId, code);
  }
}
```

### 3.3 Referral Service

**File:** `src/referral/referral.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class ReferralService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin operations
    );
  }

  async getReferralCode(userId: string) {
    // Get user's referral code
    const { data: codeData, error: codeError } = await this.supabase
      .from('referral_codes')
      .select('code, total_referrals, total_earned_credits')
      .eq('user_id', userId)
      .single();

    if (codeError) {
      throw new Error('Failed to fetch referral code');
    }

    // Get referral stats
    const { data: statsData } = await this.supabase
      .from('referrals')
      .select('status')
      .eq('referrer_user_id', userId);

    const stats = {
      totalReferrals: codeData.total_referrals,
      totalEarned: codeData.total_earned_credits,
      pendingReferrals: statsData?.filter(r => r.status === 'confirmed').length || 0,
    };

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5176'}/?ref=${codeData.code}`;

    return {
      code: codeData.code,
      shareUrl,
      stats,
    };
  }

  async getReferralHistory(userId: string, limit: number, offset: number) {
    const { data, error, count } = await this.supabase
      .from('referrals')
      .select(`
        id,
        referred_user_id,
        referral_code,
        status,
        created_at,
        first_purchase_at,
        first_purchase_amount,
        bonus_credits_awarded,
        user_profiles!referrals_referred_user_id_fkey(display_name, email)
      `, { count: 'exact' })
      .eq('referrer_user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch referral history');
    }

    const referrals = data.map(ref => ({
      id: ref.id,
      referredUserId: ref.referred_user_id,
      referredUsername: ref.user_profiles?.display_name || ref.user_profiles?.email?.split('@')[0] || 'Anonymous',
      referralCode: ref.referral_code,
      status: ref.status,
      createdAt: ref.created_at,
      firstPurchaseAt: ref.first_purchase_at,
      firstPurchaseAmount: ref.first_purchase_amount,
      bonusCreditsAwarded: ref.bonus_credits_awarded,
    }));

    return {
      referrals,
      total: count || 0,
    };
  }

  async applyReferralCode(userId: string, code: string) {
    const { data, error } = await this.supabase
      .rpc('apply_referral_code', {
        p_user_id: userId,
        p_code: code.toUpperCase(),
      });

    if (error) {
      throw new Error(error.message || 'Failed to apply referral code');
    }

    return data;
  }
}
```

### 3.4 Update Credit Purchase Endpoint

**File:** `src/credits/credits.controller.ts`

Add referral bonus logic to existing purchase endpoint:

```typescript
@Post('purchase')
async purchaseCredits(
  @Req() req: any,
  @Body() purchaseDto: PurchaseCreditsDto
) {
  const userId = req.user.id;
  const { packageId, walletAddress, txSignature } = purchaseDto;
  
  // 1. Verify Solana transaction
  const isValid = await this.creditsService.verifyTransaction(
    txSignature,
    walletAddress,
    packageId
  );
  
  if (!isValid) {
    throw new BadRequestException('Invalid transaction');
  }
  
  // 2. Credit user's account
  const result = await this.creditsService.addCredits(userId, packageId);
  
  // 3. Check and award referral bonus
  const referralResult = await this.referralService.awardReferralBonus(
    userId,
    packageId,
    result.creditsAdded,
    result.amountPaid
  );
  
  return {
    success: true,
    credits: result.creditsAdded,
    newBalance: result.newBalance,
    referralBonus: referralResult.awarded ? {
      awarded: true,
      referrerUserId: referralResult.referrer_user_id,
      bonusCredits: referralResult.bonus_credits,
    } : null,
  };
}
```

**Add to ReferralService:**

```typescript
async awardReferralBonus(
  buyerUserId: string,
  packageId: string,
  creditsPurchased: number,
  amountPaid: number
) {
  const { data, error } = await this.supabase
    .rpc('award_referral_bonus', {
      p_buyer_user_id: buyerUserId,
      p_package_id: packageId,
      p_credits_purchased: creditsPurchased,
      p_amount_paid: amountPaid,
    });

  if (error) {
    console.error('Failed to award referral bonus:', error);
    return { awarded: false };
  }

  return data;
}
```

---

## 🔧 Phase 4: Frontend Updates

### 4.1 Remove Mock Data from referralApi.ts

**File:** `services/referralApi.ts`

Replace mock data with real API calls:

```typescript
export async function getReferralCode(): Promise<ReferralCodeResponse> {
  const response = await referralApiClient.get<ReferralCodeResponse>('/api/referral/code');
  return response.data;
}

export async function getReferralHistory(
  limit = 20,
  offset = 0
): Promise<ReferralHistoryResponse> {
  const response = await referralApiClient.get<ReferralHistoryResponse>('/api/referral/history', {
    params: { limit, offset },
  });
  return response.data;
}

export async function applyReferralCode(
  code: string
): Promise<ApplyReferralResponse> {
  const response = await referralApiClient.post<ApplyReferralResponse>(
    '/api/referral/apply',
    { code }
  );
  return response.data;
}
```

### 4.2 Update AuthContext to Store Token

**File:** `contexts/AuthContext.tsx`

Ensure JWT token is stored in localStorage:

```typescript
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
      });
      // Store token for API calls
      if (session.access_token) {
        localStorage.setItem('authToken', session.access_token);
      }
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        });
        // Store token
        if (session.access_token) {
          localStorage.setItem('authToken', session.access_token);
        }
      } else {
        setUser(null);
        localStorage.removeItem('authToken');
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

### 4.3 Auto-Apply Referral Code on Signup

**File:** `contexts/AuthContext.tsx`

Add logic to apply pending referral code after signup:

```typescript
const signup = async (email: string, password: string, name: string) => {
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
      },
    },
  });
  if (error) throw error;
  
  // Check for pending referral code
  const pendingCode = localStorage.getItem('pendingReferralCode');
  if (pendingCode && data.user) {
    try {
      // Wait a bit for user profile to be created
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Apply referral code
      await applyReferralCode(pendingCode);
      localStorage.removeItem('pendingReferralCode');
      toast.success('Referral code applied successfully!');
    } catch (error) {
      console.error('Failed to apply referral code:', error);
    }
  }
};
```

---

## 🌍 Phase 5: Environment Variables

### 5.1 Backend Environment Variables (Render)

Add to your Render service environment variables:

```env
# Supabase Configuration
SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Frontend URL (for referral links)
FRONTEND_URL=https://your-vercel-app.vercel.app

# Solana Configuration
TREASURY_WALLET=49nAGueHXos8Ry2tn3NYLMAidgaQQQ4tHFUwAhZygYM5
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# JWT Secret (optional, if using custom JWT)
JWT_SECRET=your_jwt_secret_here
```

### 5.2 Frontend Environment Variables (Vercel)

Already configured in `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=https://dual-scanning-modes.onrender.com
NEXT_PUBLIC_TREASURY_WALLET=49nAGueHXos8Ry2tn3NYLMAidgaQQQ4tHFUwAhZygYM5
NEXT_PUBLIC_SUPABASE_URL=https://sanpifotyozeinatpyki.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📦 Phase 6: Testing Checklist

### 6.1 Authentication Testing

- [ ] User can sign up with email/password
- [ ] User receives verification email
- [ ] User can log in with email/password
- [ ] User can log in with Google OAuth
- [ ] User can log out
- [ ] JWT token is stored in localStorage
- [ ] Token is sent with API requests
- [ ] Expired token triggers re-authentication
- [ ] User profile is created automatically on signup
- [ ] Referral code is generated automatically on signup

### 6.2 Referral System Testing

- [ ] User can view their referral code on `/referrals` page
- [ ] Copy code button works
- [ ] Share buttons generate correct URLs
- [ ] URL with `?ref=CODE` captures code
- [ ] Referral code is stored in localStorage
- [ ] User can apply referral code on `/credits` page
- [ ] Cannot apply own referral code
- [ ] Cannot apply referral code twice
- [ ] Cannot apply referral code after first purchase
- [ ] Referral history displays correctly
- [ ] Filter buttons work in history modal
- [ ] First purchase triggers bonus credit award
- [ ] Bonus credits added to referrer's balance
- [ ] Referral stats update correctly
- [ ] Email notifications sent (optional)

### 6.3 Integration Testing

- [ ] Backend API endpoints return correct data
- [ ] Frontend displays real data (not mocks)
- [ ] Error handling works (invalid code, expired token, etc.)
- [ ] Loading states display correctly
- [ ] Toast notifications appear on success/error
- [ ] Credit balance updates after referral bonus
- [ ] Database transactions are atomic (no partial updates)
- [ ] Row Level Security policies work correctly

---

## 🚀 Phase 7: Deployment Steps

### Step 1: Set Up Supabase (30 minutes)

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste all SQL from Phase 1 & 2
3. Execute each section sequentially
4. Verify tables were created in Table Editor
5. Test database functions manually
6. Enable email confirmations in Auth settings
7. Configure Google OAuth provider

### Step 2: Deploy Backend to Render (20 minutes)

1. Add environment variables to Render service
2. Install dependencies: `npm install @supabase/supabase-js`
3. Create referral controller and service files
4. Update credit purchase endpoint
5. Deploy to Render
6. Test API endpoints with Postman/Insomnia

### Step 3: Update Frontend (15 minutes)

1. Remove mock data from `services/referralApi.ts`
2. Update `AuthContext.tsx` with token storage
3. Add auto-apply referral code on signup
4. Deploy to Vercel
5. Test on production URL

### Step 4: Verify End-to-End (20 minutes)

1. Sign up new user → Check referral code generated
2. Copy referral link → Open in incognito
3. Sign up with referral code → Check applied
4. Purchase credits → Check bonus awarded
5. View referral history → Check displayed correctly
6. Test error cases (invalid code, own code, etc.)

---

## ⚡ Quick Start Commands

### Supabase Setup

```bash
# Connect to Supabase via CLI (optional)
npx supabase login
npx supabase link --project-ref sanpifotyozeinatpyki

# Or use SQL Editor in Supabase Dashboard
# Copy-paste SQL from this document
```

### Backend Setup (NestJS on Render)

```bash
# Install dependencies
npm install @supabase/supabase-js

# Create files
mkdir -p src/referral
touch src/referral/referral.controller.ts
touch src/referral/referral.service.ts
touch src/referral/referral.module.ts
touch src/auth/auth.guard.ts

# Deploy to Render
git add .
git commit -m "feat: Add referral system backend"
git push origin main
```

### Frontend Update

```bash
cd d:\scanner

# Update referralApi.ts (remove mock data)
# Update AuthContext.tsx (add token storage)

# Test locally
npm run dev

# Deploy to Vercel
git add .
git commit -m "feat: Connect referral system to backend"
git push origin main
```

---

## 📊 Database Schema Diagram

```
auth.users (Supabase Auth)
    ↓
user_profiles
    ├── id (FK to auth.users)
    ├── referred_by (FK to auth.users)
    └── referral_code_used

referral_codes
    ├── id
    ├── user_id (FK to auth.users)
    ├── code (UNIQUE)
    └── total_earned_credits

referrals
    ├── id
    ├── referrer_user_id (FK to auth.users)
    ├── referred_user_id (FK to auth.users)
    ├── referral_code
    ├── status
    └── bonus_credits_awarded

referral_rewards
    ├── id
    ├── referral_id (FK to referrals)
    ├── referrer_user_id (FK to auth.users)
    └── bonus_credits

credit_transactions
    ├── id
    ├── user_id (FK to auth.users)
    ├── type (purchase, bonus, scan_deduction)
    └── amount
```

---

## 🔒 Security Considerations

### Row Level Security (RLS)

✅ All tables have RLS enabled  
✅ Users can only view their own data  
✅ Admin operations use service role key  
✅ Foreign key constraints prevent orphaned records

### API Security

✅ JWT token verification on all protected routes  
✅ Input validation (referral code format, email, etc.)  
✅ Rate limiting on referral apply endpoint  
✅ Prevent self-referral  
✅ Prevent duplicate referrals  
✅ Transaction verification before crediting

### Frontend Security

✅ Never expose service role key  
✅ Use anon key (safe for frontend)  
✅ Validate on backend, not just frontend  
✅ Sanitize user inputs  
✅ HTTPS only in production

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue:** "Invalid or expired token"  
**Solution:** Check if token is stored correctly, verify Supabase URL/keys

**Issue:** "Failed to generate unique referral code"  
**Solution:** Check if `generate_referral_code()` function exists, verify trigger

**Issue:** "Cannot apply referral code"  
**Solution:** Check RLS policies, verify user hasn't purchased yet

**Issue:** "Bonus not awarded"  
**Solution:** Check `award_referral_bonus()` function, verify transaction type

---

## ✅ Success Metrics

After implementation, you should see:

- ✅ Users signing up and auto-generating referral codes
- ✅ Referral codes being applied before first purchase
- ✅ Bonus credits automatically awarded on first purchase
- ✅ Referral history displaying accurate data
- ✅ No mock data in production
- ✅ All API calls authenticated with JWT
- ✅ Real-time stats updating correctly

---

## 🎉 Summary

**Total Implementation Time:** ~2-3 hours

**Phase 1:** Supabase Database (30 min)  
**Phase 2:** Database Functions (20 min)  
**Phase 3:** Backend API (40 min)  
**Phase 4:** Frontend Updates (20 min)  
**Phase 5:** Environment Setup (10 min)  
**Phase 6:** Testing (30 min)  
**Phase 7:** Deployment (20 min)

**Result:** Fully functional authentication and referral system with real data, bonus crediting, and complete user flow from signup to earning referral bonuses.

---

Ready to start? Begin with **Phase 1: Supabase Database Setup** 🚀

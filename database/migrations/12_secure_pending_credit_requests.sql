-- =====================================================
-- SECURITY FIX: Move pending_credit_requests out of public schema
-- Migration 12 — Exposed Auth Users Lint Fix
--
-- Problem: public.pending_credit_requests JOINs auth.users and
-- is fully accessible to anon and authenticated roles via PostgREST.
--
-- Fix: Create a private 'admin' schema not exposed to PostgREST,
-- recreate the view there, and drop the public one.
-- Access is restricted to service_role only.
-- =====================================================

-- Step 1: Create the admin schema (hidden from PostgREST)
CREATE SCHEMA IF NOT EXISTS admin;

-- Step 2: Revoke public access to the schema from untrusted roles
REVOKE ALL ON SCHEMA admin FROM anon, authenticated, public;

-- Step 3: Grant schema usage ONLY to service_role
GRANT USAGE ON SCHEMA admin TO service_role;

-- Step 4: Recreate the view inside admin schema
CREATE OR REPLACE VIEW admin.pending_credit_requests AS
  SELECT
    cpr.id,
    cpr.user_id,
    cpr.package_id,
    cpr.credits_amount,
    cpr.payment_method_id,
    cpr.transaction_hash,
    cpr.status,
    cpr.admin_notes,
    cpr.reviewed_by,
    cpr.reviewed_at,
    cpr.created_at,
    cpr.updated_at,
    u.email         AS user_email,
    pm.name         AS payment_method_name,
    pm.network      AS payment_network
  FROM public.credit_purchase_requests cpr
  JOIN auth.users u  ON cpr.user_id = u.id
  JOIN public.payment_methods pm ON cpr.payment_method_id = pm.id
  WHERE cpr.status = 'pending'
  ORDER BY cpr.created_at DESC;

-- Step 5: Grant SELECT on the admin view to service_role only
GRANT SELECT ON admin.pending_credit_requests TO service_role;

-- Step 6: Drop the insecure public view
DROP VIEW IF EXISTS public.pending_credit_requests;

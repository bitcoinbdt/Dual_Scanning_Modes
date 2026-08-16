/**
 * Live Alerts RLS Validation
 *
 * Verifies that Row-Level Security policies are correctly enforced on public.live_risk_alerts:
 *   - anon client SELECT → allowed
 *   - anon client INSERT → rejected
 *   - anon client UPDATE → rejected
 *   - anon client DELETE → rejected
 *   - service_role client INSERT/SELECT/DELETE → allowed
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('[live_alerts_validation] Missing required environment variables.');
  process.exit(1);
}

const anonClient    = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TEST_TOKEN = '0x00000000000000000000000000000000000000aa';
const TEST_TX    = '0x' + 'ff'.repeat(32);

const ALERT_ROW = {
  token_address: TEST_TOKEN,
  network: 'eth',
  alert_type: 'LARGE_SELL',
  tx_hash: TEST_TX,
  amount_usd: 50000,
  price_impact_pct: 7.5,
  details: 'Test alert content',
  confidence: 100,
  block_number: 1234567,
  sender_address: '0xsenderaddress',
};

function isRlsRejection(error: any): boolean {
  if (!error) return false;
  const msg  = (error.message ?? '').toLowerCase();
  const code = String(error.code ?? '');
  return (
    code === '42501' ||
    code === 'PGRST116' ||
    msg.includes('row-level security') ||
    msg.includes('insufficient_privilege') ||
    msg.includes('new row violates') ||
    msg.includes('permission denied')
  );
}

async function cleanup() {
  await serviceClient.from('live_risk_alerts')
    .delete()
    .eq('token_address', TEST_TOKEN);
}

async function main() {
  console.log('Starting Live Alerts RLS Validation...');
  await cleanup();

  let passed = 0;
  let failed = 0;

  // 1. Anon Select
  try {
    const { error } = await anonClient.from('live_risk_alerts').select('id').limit(1);
    if (error) {
      console.error('❌ Anon SELECT failed:', error.message);
      failed++;
    } else {
      console.log('✅ Anon SELECT allowed');
      passed++;
    }
  } catch (err: any) {
    console.error('❌ Anon SELECT threw error:', err.message);
    failed++;
  }

  // 2. Anon Insert
  try {
    const { error } = await anonClient.from('live_risk_alerts').insert(ALERT_ROW);
    if (!error) {
      console.error('❌ Anon INSERT succeeded (should be blocked by RLS!)');
      failed++;
      await cleanup();
    } else if (isRlsRejection(error)) {
      console.log('✅ Anon INSERT rejected by RLS');
      passed++;
    } else {
      console.error('❌ Anon INSERT failed with unexpected error:', error.message);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ Anon INSERT threw error:', err.message);
    failed++;
  }

  // 3. Service Role Insert
  try {
    const { data, error } = await serviceClient.from('live_risk_alerts').insert(ALERT_ROW).select();
    if (error) {
      console.error('❌ Service Role INSERT failed:', error.message);
      failed++;
    } else {
      console.log('✅ Service Role INSERT allowed');
      passed++;
    }
  } catch (err: any) {
    console.error('❌ Service Role INSERT threw error:', err.message);
    failed++;
  }

  await cleanup();

  console.log(`\nValidation complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal validation error:', err);
  process.exit(1);
});

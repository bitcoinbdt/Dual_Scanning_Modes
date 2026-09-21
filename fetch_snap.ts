import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse env variables manually from .env.local
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    // Strip leading/trailing quotes if present
    val = val.replace(/^['"]|['"]$/g, '');
    envVars[match[1].trim()] = val;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase env vars missing from .env.local');
  process.exit(1);
}

console.log('Parsed Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('scan_snapshots')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Supabase query error:', error.message);
    return;
  }

  console.log(`Found ${data.length} snapshots:`);
  for (const snap of data) {
    const res = snap.result_json as any;
    console.log(`- ID: ${snap.id}, ScanId: ${res?.scanId}, Symbol: ${snap.token_symbol}, Chain: ${snap.chain}`);
    console.log(`  contractSource present:`, !!res?.contractSource);
    if (res?.scanId === '15c479be-d03b-45d7-9a09-837a7e232dd8' || snap.id.includes('15c479be')) {
      console.log('--- FOUND TARGET SCAN ---');
      console.log('Result Keys:', Object.keys(res));
      console.log('Contract Source value:', res.contractSource);
      console.log('-------------------------');
    }
  }
}

run();

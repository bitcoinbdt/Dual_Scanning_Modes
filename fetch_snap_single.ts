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
    val = val.replace(/^['"]|['"]$/g, '');
    envVars[match[1].trim()] = val;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function run() {
  const { data, error } = await supabase
    .from('scan_snapshots')
    .select('*')
    .eq('id', 'ds-TsdXJdsb')
    .single();

  if (error) {
    console.error('Supabase query error:', error.message);
    return;
  }

  console.log(`Snapshot ${data.id}:`);
  console.log('Token address:', data.token_address);
  console.log('Chain:', data.chain);
  console.log('Scan type:', data.scan_type);
  console.log('Result Keys:', Object.keys(data.result_json || {}));
  console.log('contractSource:', (data.result_json as any)?.contractSource);
}

run();

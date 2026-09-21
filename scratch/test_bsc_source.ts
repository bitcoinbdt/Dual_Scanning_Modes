import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

import { fetchContractSource } from '../lib/blockchain/contractSourceService';

async function main() {
  const token = '0x8d345658a86b5bd145d5b522b80939ef8c8aae10';
  console.log('ETHERSCAN_API_KEY present:', !!process.env.ETHERSCAN_API_KEY);
  console.log('BSCSCAN_API_KEY present:', !!process.env.BSCSCAN_API_KEY);
  console.log('Testing fetchContractSource for BNBCAT on BSC (56)...');
  
  const res = await fetchContractSource(token, '56');
  console.log('fetchContractSource result:', res ? {
    contractName: res.contractName,
    compilerVersion: res.compilerVersion,
    filesCount: res.sourceFiles.length,
    firstFileName: res.sourceFiles[0]?.fileName
  } : null);

  // Let's also test direct Etherscan V2 call
  console.log('\nTesting direct Etherscan V2 API:');
  try {
    const v2Res = await axios.get('https://api.etherscan.io/v2/api', {
      params: {
        chainid: '56',
        module: 'contract',
        action: 'getsourcecode',
        address: token,
        apikey: process.env.ETHERSCAN_API_KEY || ''
      }
    });
    console.log('Etherscan V2 status:', v2Res.data.status, 'message:', v2Res.data.message);
    if (Array.isArray(v2Res.data.result)) {
      console.log('Result[0] ContractName:', v2Res.data.result[0]?.ContractName);
      console.log('Result[0] SourceCode length:', v2Res.data.result[0]?.SourceCode?.length);
    } else {
      console.log('Result raw:', v2Res.data.result);
    }
  } catch (err: any) {
    console.error('V2 error:', err.message);
  }

  // Let's also test direct BscScan API (api.bscscan.com)
  console.log('\nTesting direct BscScan API:');
  try {
    const bscRes = await axios.get('https://api.bscscan.com/api', {
      params: {
        module: 'contract',
        action: 'getsourcecode',
        address: token,
        apikey: process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || ''
      }
    });
    console.log('BscScan status:', bscRes.data.status, 'message:', bscRes.data.message);
    if (Array.isArray(bscRes.data.result)) {
      console.log('BscScan Result[0] ContractName:', bscRes.data.result[0]?.ContractName);
      console.log('BscScan Result[0] SourceCode length:', bscRes.data.result[0]?.SourceCode?.length);
    } else {
      console.log('BscScan Result raw:', bscRes.data.result);
    }
  } catch (err: any) {
    console.error('BscScan error:', err.message);
  }
}

main();

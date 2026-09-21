/**
 * Verification script for contractSourceService.ts
 * Run: npx tsx --env-file=.env.local scratch/test_source_fetch.ts
 */
import { fetchContractSource } from '../lib/blockchain/contractSourceService';

async function testSingleFile() {
  console.log('--- TEST 1: USDT (single-file verified contract) ---');
  // Tether USDT on Ethereum mainnet — small, single-file Solidity
  const result = await fetchContractSource('0xdac17f958d2ee523a2206206994597c13d831ec7', '1');
  if (!result) {
    console.log('❌  USDT: null returned (no API key or rate-limited — see warning above)');
    return;
  }
  console.log(`✅  Contract:   ${result.contractName}`);
  console.log(`    Compiler:   ${result.compilerVersion}`);
  console.log(`    Optimized:  ${result.optimizationUsed ? 'Yes' : 'No'} (${result.runs} runs)`);
  console.log(`    Files:      ${result.sourceFiles.length}`);
  console.log(`    First file: ${result.sourceFiles[0]?.fileName}`);
  console.log(`    Content[0-120]: ${result.sourceFiles[0]?.content.slice(0, 120).replace(/\n/g, ' ')}...`);
  console.log();
}

async function testMultiFile() {
  console.log('--- TEST 2: Uniswap V3 Factory (Standard JSON Input, multi-file) ---');
  // Uniswap V3 Factory — large multi-file Standard JSON input format
  const result = await fetchContractSource('0x1F98431c8aD98523631AE4a59f267346ea31F984', '1');
  if (!result) {
    console.log('❌  Uniswap V3: null returned (no API key or rate-limited)');
    return;
  }
  console.log(`✅  Contract:   ${result.contractName}`);
  console.log(`    Compiler:   ${result.compilerVersion}`);
  console.log(`    Files:      ${result.sourceFiles.length}`);
  result.sourceFiles.slice(0, 6).forEach(f =>
    console.log(`      - ${f.fileName} (${f.content.length} chars)`)
  );
  if (result.sourceFiles.length > 6) {
    console.log(`      ... and ${result.sourceFiles.length - 6} more`);
  }
  console.log();
}

async function testUnverified() {
  console.log('--- TEST 3: Unverified / non-existent address (should return null, not throw) ---');
  const result = await fetchContractSource('0x0000000000000000000000000000000000000001', '1');
  if (result === null) {
    console.log('✅  Correctly returned null for unverified address');
  } else {
    console.log('⚠️   Expected null but got:', result);
  }
  console.log();
}

async function testSolanaPassthrough() {
  console.log('--- TEST 4: Solana address (should skip immediately, return null) ---');
  // Solana address — contractSourceService only handles EVM (0x prefix)
  const result = await fetchContractSource('So11111111111111111111111111111111111111112', 'solana');
  if (result === null) {
    console.log('✅  Correctly returned null for Solana address (no EVM regex match)');
  } else {
    console.log('⚠️   Unexpected non-null result:', result);
  }
  console.log();
}

async function run() {
  try {
    await testSingleFile();
    await testMultiFile();
    await testUnverified();
    await testSolanaPassthrough();
    console.log('=== All tests complete ===');
  } catch (err: any) {
    console.error('Fatal test error:', err.message);
    process.exit(1);
  }
}

run();
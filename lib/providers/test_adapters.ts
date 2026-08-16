/**
 * Provider Adapter Unit Tests
 *
 * Tests all four provider adapters using mock payloads only.
 * NO real HTTP calls, NO real API keys, NO paid API usage.
 *
 * Run: npx tsx lib/providers/test_adapters.ts
 *
 * Coverage:
 *   Group 1: GoldRush holder adapter (8 tests)
 *   Group 2: Alchemy V2 reserve adapter (7 tests)
 *   Group 3: Bitquery wallet history adapter (8 tests)
 *   Group 4: Uniswap CLMM adapter (7 tests)
 *
 * Total: 30 tests
 */

import { adaptGoldrushHolders } from './goldrush/adapter';
import { adaptAlchemyV2Reserves } from './alchemy/adapter';
import { adaptBitqueryWalletHistory, buildWalletHistoryQuery } from './bitquery/adapter';
import { adaptUniswapV3PoolState } from './uniswap/adapter';
import { adaptHeliusWalletHistory } from './helius/adapter';
import { AbiCoder } from 'ethers';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal test harness
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    const msg = detail ? `${testName} — ${detail}` : testName;
    console.error(`  ✗ ${msg}`);
    failures.push(msg);
    failed++;
  }
}

function group(name: string, fn: () => void): void {
  console.log(`\n${name}`);
  fn();
}

// ─────────────────────────────────────────────────────────────────────────────
// ABI encoding helpers (for Alchemy tests)
// ─────────────────────────────────────────────────────────────────────────────

const abiCoder = AbiCoder.defaultAbiCoder();

/**
 * Encode a valid getReserves() response as the Alchemy RPC would return it.
 * Returns ABI-encoded (uint112, uint112, uint32).
 */
function encodeGetReserves(
  reserve0: bigint,
  reserve1: bigint,
  blockTimestampLast: number
): string {
  return abiCoder.encode(
    ['uint112', 'uint112', 'uint32'],
    [reserve0, reserve1, blockTimestampLast]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: GoldRush Holder Adapter
// ─────────────────────────────────────────────────────────────────────────────

group('Group 1: GoldRush Holder Adapter', () => {
  const BASE_OPTS = {
    chain: 'eth-mainnet',
    tokenAddress: '0xTokenAddress',
    tokenDecimals: 18,
    snapshotAt: 1700000000,
  };

  // Test 1.1: Valid payload with multiple holders
  {
    const raw = {
      items: [
        { address: '0xHolderA', balance: '2000000000000000000' }, // 2.0 tokens
        { address: '0xHolderB', balance: '1000000000000000000' }, // 1.0 tokens
      ],
      pagination: { total_count: 500 },
    };
    const result = adaptGoldrushHolders(raw, BASE_OPTS);
    assert(result.status === 'available', '1.1 Valid payload → status available');
    assert(result.holders.length === 2, '1.1 Valid payload → 2 holders returned');
    assert(result.holders[0].balance === 2.0, '1.1 Holders sorted descending by balance');
    assert(result.holders[0].tx_count === 0, '1.1 tx_count is 0 (GoldRush does not provide this)');
    assert(result.totalHolderCount === 500, '1.1 totalHolderCount from pagination');
    assert(result.provenance === 'goldrush', '1.1 Provenance is goldrush');
  }

  // Test 1.2: Non-standard decimals (USDC = 6)
  {
    const raw = {
      items: [{ address: '0xHolderC', balance: '5000000' }], // 5.0 USDC
      pagination: { total_count: 1 },
    };
    const result = adaptGoldrushHolders(raw, { ...BASE_OPTS, tokenDecimals: 6 });
    assert(
      Math.abs(result.holders[0].balance - 5.0) < 0.0001,
      '1.2 Non-standard decimals (USDC/6) normalized correctly'
    );
  }

  // Test 1.3: Zero address filtered out
  {
    const raw = {
      items: [
        { address: '0x0000000000000000000000000000000000000000', balance: '1000000000000000000' },
        { address: '0xRealHolder', balance: '1000000000000000000' },
      ],
      pagination: {},
    };
    const result = adaptGoldrushHolders(raw, BASE_OPTS);
    assert(result.holders.length === 1, '1.3 Zero address filtered out');
    assert(result.holders[0].wallet === '0xrealholder', '1.3 Remaining holder normalized to lowercase');
  }

  // Test 1.4: Dead address filtered out
  {
    const raw = {
      items: [
        { address: '0x000000000000000000000000000000000000dead', balance: '9000000000000000000' },
        { address: '0xHolder1', balance: '500000000000000000' },
      ],
      pagination: {},
    };
    const result = adaptGoldrushHolders(raw, BASE_OPTS);
    assert(result.holders.length === 1, '1.4 Dead address filtered out');
  }

  // Test 1.5: Empty items → insufficient_data
  {
    const raw = { items: [], pagination: { total_count: 0 } };
    const result = adaptGoldrushHolders(raw, BASE_OPTS);
    assert(result.status === 'insufficient_data', '1.5 Empty items → insufficient_data');
    assert(result.holders.length === 0, '1.5 Empty items → empty holders array');
  }

  // Test 1.6: null input → unavailable
  {
    const result = adaptGoldrushHolders(null, BASE_OPTS);
    assert(result.status === 'unavailable', '1.6 null input → unavailable');
    assert(result.holders.length === 0, '1.6 null input → empty holders array');
  }

  // Test 1.7: Missing items array → unavailable
  {
    const raw = { pagination: { total_count: 100 } }; // No items key
    const result = adaptGoldrushHolders(raw, BASE_OPTS);
    assert(result.status === 'unavailable', '1.7 Missing items array → unavailable');
  }

  // Test 1.8: All items filtered → insufficient_data
  {
    const raw = {
      items: [
        { address: '0x0000000000000000000000000000000000000000', balance: '1000' },
        { address: '0x000000000000000000000000000000000000dead', balance: '2000' },
      ],
      pagination: {},
    };
    const result = adaptGoldrushHolders(raw, BASE_OPTS);
    assert(result.status === 'insufficient_data', '1.8 All excluded addresses → insufficient_data');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Alchemy V2 Reserve Adapter
// ─────────────────────────────────────────────────────────────────────────────

group('Group 2: Alchemy V2 Reserve Adapter', () => {
  const BASE_OPTS = {
    poolAddress: '0xPoolAddress',
    snapshotBlock: 19000000,
    snapshotAt: 1700000000,
  };

  const R0 = BigInt('1000000000000000000'); // 1e18
  const R1 = BigInt('2000000000000000000'); // 2e18
  const TS = 1700000000;

  // Test 2.1: Valid ABI-encoded hex → available
  {
    const hex = encodeGetReserves(R0, R1, TS);
    const result = adaptAlchemyV2Reserves(hex, BASE_OPTS);
    assert(result.status === 'available', '2.1 Valid hex → status available');
    assert(result.tokenReserve === R0, '2.1 tokenReserve decoded correctly');
    assert(result.quoteReserve === R1, '2.1 quoteReserve decoded correctly');
    assert(result.blockTimestampLast === TS, '2.1 blockTimestampLast decoded correctly');
    assert(result.provenance === 'alchemy-v2', '2.1 Provenance is alchemy-v2');
    assert(result.snapshotBlock === 19000000, '2.1 snapshotBlock preserved');
  }

  // Test 2.2: null input → provider_unavailable
  {
    const result = adaptAlchemyV2Reserves(null, BASE_OPTS);
    assert(result.status === 'unavailable', '2.2 null input → unavailable');
    assert(result.failureKind === 'provider_unavailable', '2.2 null input → provider_unavailable kind');
  }

  // Test 2.3: undefined input → provider_unavailable
  {
    const result = adaptAlchemyV2Reserves(undefined, BASE_OPTS);
    assert(result.status === 'unavailable', '2.3 undefined input → unavailable');
    assert(result.failureKind === 'provider_unavailable', '2.3 undefined → provider_unavailable kind');
  }

  // Test 2.4: '0x' (empty hex) → pool_not_found
  {
    const result = adaptAlchemyV2Reserves('0x', BASE_OPTS);
    assert(result.status === 'unavailable', '2.4 0x → unavailable');
    assert(result.failureKind === 'pool_not_found', '2.4 empty hex → pool_not_found kind');
  }

  // Test 2.5: Garbage hex → decode_error
  {
    const result = adaptAlchemyV2Reserves('0xdeadbeef', BASE_OPTS);
    assert(result.status === 'unavailable', '2.5 Garbage hex → unavailable');
    assert(result.failureKind === 'decode_error', '2.5 Garbage hex → decode_error kind');
  }

  // Test 2.6: Non-string input → rpc_error
  {
    const result = adaptAlchemyV2Reserves(12345, BASE_OPTS);
    assert(result.status === 'unavailable', '2.6 Number input → unavailable');
    assert(result.failureKind === 'rpc_error', '2.6 Number input → rpc_error kind');
  }

  // Test 2.7: Pool address normalized to lowercase
  {
    const hex = encodeGetReserves(R0, R1, TS);
    const result = adaptAlchemyV2Reserves(hex, { ...BASE_OPTS, poolAddress: '0xPOOLADDRESS' });
    assert(result.poolAddress === '0xpooladdress', '2.7 Pool address normalized to lowercase');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Bitquery Wallet History Adapter
// ─────────────────────────────────────────────────────────────────────────────

group('Group 3: Bitquery Wallet History Adapter', () => {
  const WALLET = '0xWallet123';

  // Test 3.1: Valid response with transfers → available
  {
    const raw = {
      EVM: {
        Transfers: [
          { Block: { Time: '2023-06-15T10:30:00Z', Number: 17500000 } },
          { Block: { Time: '2023-07-01T12:00:00Z', Number: 17600000 } },
          { Block: { Time: '2023-05-01T08:00:00Z', Number: 17300000 } }, // Earliest
        ],
      },
    };
    const result = adaptBitqueryWalletHistory(raw, WALLET);
    assert(result.availability === 'available', '3.1 Valid transfers → available');
    assert(result.txCountObserved === 3, '3.1 txCountObserved = 3');
    // Earliest block is 17300000 (2023-05-01)
    assert(result.firstSeenBlock === 17300000, '3.1 firstSeenBlock is earliest block');
    assert(
      result.firstSeenTimestamp !== undefined && result.firstSeenTimestamp > 0,
      '3.1 firstSeenTimestamp is a positive number'
    );
    assert(result.provenance === 'bitquery', '3.1 Provenance is bitquery');
    assert(result.wallet === '0xwallet123', '3.1 Wallet normalized to lowercase');
  }

  // Test 3.2: Empty transfers array → no_history_found
  {
    const raw = { EVM: { Transfers: [] } };
    const result = adaptBitqueryWalletHistory(raw, WALLET);
    assert(result.availability === 'unavailable', '3.2 Empty transfers → unavailable');
    assert(result.failureKind === 'no_history_found', '3.2 Empty transfers → no_history_found kind');
  }

  // Test 3.3: null input → query_failure
  {
    const result = adaptBitqueryWalletHistory(null, WALLET);
    assert(result.availability === 'unavailable', '3.3 null input → unavailable');
    assert(result.failureKind === 'query_failure', '3.3 null → query_failure kind');
  }

  // Test 3.4: Missing EVM key → malformed_response
  {
    const raw = { SomeOtherKey: {} };
    const result = adaptBitqueryWalletHistory(raw, WALLET);
    assert(result.availability === 'unavailable', '3.4 Missing EVM key → unavailable');
    assert(result.failureKind === 'malformed_response', '3.4 Missing EVM key → malformed_response kind');
  }

  // Test 3.5: Transfers is not an array → malformed_response
  {
    const raw = { EVM: { Transfers: 'not-an-array' } };
    const result = adaptBitqueryWalletHistory(raw, WALLET);
    assert(result.availability === 'unavailable', '3.5 Transfers not array → unavailable');
    assert(result.failureKind === 'malformed_response', '3.5 Transfers not array → malformed_response kind');
  }

  // Test 3.6: Transfers with missing Block → partial
  {
    const raw = {
      EVM: {
        Transfers: [
          { Block: { Time: null, Number: null } }, // No parseable data
        ],
      },
    };
    const result = adaptBitqueryWalletHistory(raw, WALLET);
    assert(result.availability === 'partial', '3.6 Missing Block data → partial');
    assert(result.txCountObserved === 1, '3.6 txCountObserved still counted');
  }

  // Test 3.7: firstSeenTimestamp never undefined when available
  {
    const raw = {
      EVM: {
        Transfers: [
          { Block: { Time: '2023-01-01T00:00:00Z', Number: 16000000 } },
        ],
      },
    };
    const result = adaptBitqueryWalletHistory(raw, WALLET);
    assert(result.firstSeenTimestamp !== undefined, '3.7 firstSeenTimestamp populated when available');
    assert(result.firstSeenTimestamp !== 0, '3.7 firstSeenTimestamp is not epoch 0');
  }

  // Test 3.8: buildWalletHistoryQuery returns non-empty string with limit
  {
    const query = buildWalletHistoryQuery(50);
    assert(typeof query === 'string' && query.length > 50, '3.8 buildWalletHistoryQuery returns query string');
    assert(query.includes('50'), '3.8 buildWalletHistoryQuery includes limit');
    assert(query.includes('WalletFirstSeen'), '3.8 buildWalletHistoryQuery includes operation name');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Uniswap V3 CLMM Adapter
// ─────────────────────────────────────────────────────────────────────────────

group('Group 4: Uniswap V3 CLMM Adapter', () => {
  const BASE_OPTS = {
    poolAddress: '0xPoolV3Address',
    snapshotAt: 1700000000,
  };

  // Test 4.1: Full valid pool state → available
  {
    const raw = {
      sqrtPriceX96: '79228162514264337593543950336',
      tick: 197823,
      liquidity: '1234567890000',
      fee: 3000,
      tickSpacing: 60,
      token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      token1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    };
    const result = adaptUniswapV3PoolState(raw, BASE_OPTS);
    assert(result.status === 'available', '4.1 Full valid state → available');
    assert(result.sqrtPriceX96 !== undefined, '4.1 sqrtPriceX96 populated');
    assert(result.currentTick === 197823, '4.1 currentTick populated');
    assert(result.liquidity !== undefined, '4.1 liquidity populated');
    assert(result.tickSpacing === 60, '4.1 tickSpacing populated');
    assert(result.feeTier === 3000, '4.1 feeTier populated');
    assert(result.token0 === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', '4.1 token0 lowercased');
    assert(result.token1 === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', '4.1 token1 lowercased');
    assert(result.provenance === 'uniswap-v3', '4.1 Provenance is uniswap-v3');
  }

  // Test 4.2: null input → provider_unavailable
  {
    const result = adaptUniswapV3PoolState(null, BASE_OPTS);
    assert(result.status === 'unavailable', '4.2 null input → unavailable');
    assert(result.failureKind === 'provider_unavailable', '4.2 null → provider_unavailable kind');
  }

  // Test 4.3: Empty object → pool_not_found
  {
    const result = adaptUniswapV3PoolState({}, BASE_OPTS);
    assert(result.status === 'unavailable', '4.3 Empty object → unavailable');
    assert(result.failureKind === 'pool_not_found', '4.3 Empty object → pool_not_found kind');
  }

  // Test 4.4: Missing sqrtPriceX96 → field_unavailable
  {
    const raw = { tick: 100, liquidity: '1000000' };
    const result = adaptUniswapV3PoolState(raw, BASE_OPTS);
    assert(result.status === 'unavailable', '4.4 Missing sqrtPriceX96 → unavailable');
    assert(result.failureKind === 'field_unavailable', '4.4 Missing required field → field_unavailable kind');
    assert(
      result.reason?.includes('sqrtPriceX96') ?? false,
      '4.4 reason mentions missing field name'
    );
  }

  // Test 4.5: Missing all three required fields → field_unavailable (mentions all)
  {
    const raw = { fee: 3000, tickSpacing: 60 }; // Only optional fields
    const result = adaptUniswapV3PoolState(raw, BASE_OPTS);
    assert(result.status === 'unavailable', '4.5 Missing all required → unavailable');
    assert(result.failureKind === 'field_unavailable', '4.5 All missing → field_unavailable kind');
    assert(
      (result.reason?.includes('sqrtPriceX96') ?? false) &&
      (result.reason?.includes('liquidity') ?? false) &&
      (result.reason?.includes('tick') ?? false),
      '4.5 reason mentions all three missing fields'
    );
  }

  // Test 4.6: Array input → api_error
  {
    const result = adaptUniswapV3PoolState([], BASE_OPTS);
    assert(result.status === 'unavailable', '4.6 Array input → unavailable');
    assert(result.failureKind === 'api_error', '4.6 Array input → api_error kind');
  }

  // Test 4.7: bigint string fields parsed correctly
  {
    const raw = {
      sqrtPriceX96: '79228162514264337593543950336',
      tick: '197823',      // String tick
      liquidity: '9999999999999999999',
      fee: '500',          // String fee
      tickSpacing: '10',   // String tickSpacing
    };
    const result = adaptUniswapV3PoolState(raw, BASE_OPTS);
    assert(result.status === 'available', '4.7 String numeric fields → available');
    assert(result.currentTick === 197823, '4.7 String tick parsed to number');
    assert(result.feeTier === 500, '4.7 String fee parsed to number');
    assert(result.tickSpacing === 10, '4.7 String tickSpacing parsed to number');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Helius Solana Wallet History Adapter
// ─────────────────────────────────────────────────────────────────────────────

group('Group 5: Helius Solana Wallet History Adapter', () => {
  const targetWallet = 'SolanaWalletAddress11111111111111111111';
  const BASE_OPTS = {
    chain: 'solana',
    walletAddress: targetWallet,
    fetchedAt: 1700000000,
  };

  // Test 5.1: Bounded walk / complete coverage
  {
    const acc = {
      items: [
        { timestamp: 1700000000, signature: 'tx_new' },
        { timestamp: 1699900000, signature: 'tx_old' }
      ],
      wasCapped: false
    };
    const result = adaptHeliusWalletHistory(acc, BASE_OPTS);
    assert(result !== null, '5.1 Valid payload produces profile');
    assert(result?.coverage === 'complete', '5.1 wasCapped = false → coverage complete');
    assert(result?.transactionCount === 2, '5.1 transactionCount matches item length');
    assert(result?.provenance === 'helius', '5.1 Provenance is helius');
  }

  // Test 5.2: Bounded walk / capped coverage
  {
    const acc = {
      items: [
        { timestamp: 1700000000, signature: 'tx_1' }
      ],
      wasCapped: true
    };
    const result = adaptHeliusWalletHistory(acc, BASE_OPTS);
    assert(result?.coverage === 'capped', '5.2 wasCapped = true → coverage capped');
  }

  // Test 5.3: Wallet age calculation
  {
    // fetchedAt = 1700000000 (BASE_OPTS)
    // 5 days ago = 1700000000 - 5 * 86400 = 1699568000
    const acc = {
      items: [
        { timestamp: 1700000000 },
        { timestamp: 1699568000 }
      ],
      wasCapped: false
    };
    const result = adaptHeliusWalletHistory(acc, BASE_OPTS);
    assert(result?.walletAgeDays === 5, '5.3 Age calculation is correct');
  }

  // Test 5.4: Funding source detection (SOL native transfer)
  {
    const acc = {
      items: [
        {
          timestamp: 1700000000,
          signature: 'tx_new',
          nativeTransfers: []
        },
        {
          timestamp: 1699900000,
          signature: 'funding_tx_hash',
          nativeTransfers: [
            {
              fromUserAccount: 'FundingWalletAddress2222222222222222',
              toUserAccount: targetWallet,
              amount: 1000000000
            }
          ]
        }
      ],
      wasCapped: false
    };
    const result = adaptHeliusWalletHistory(acc, BASE_OPTS);
    assert(result?.fundingSource === 'FundingWalletAddress2222222222222222', '5.4 Funding source address detected');
    assert(result?.fundingTxHash === 'funding_tx_hash', '5.4 Funding transaction hash detected');
    assert(result?.fundingSourceType === 'wallet', '5.4 Funding source type classified as wallet');
  }

  // Test 5.5: Funding source detection (Token transfer)
  {
    const acc = {
      items: [
        {
          timestamp: 1699900000,
          signature: 'token_funding_tx',
          tokenTransfers: [
            {
              fromUserAccount: 'TokenFundingWalletAddress333333333',
              toUserAccount: targetWallet,
              tokenAmount: 50.0,
              mint: 'TokenMintAddress'
            }
          ]
        }
      ],
      wasCapped: false
    };
    const result = adaptHeliusWalletHistory(acc, BASE_OPTS);
    assert(result?.fundingSource === 'TokenFundingWalletAddress333333333', '5.5 Token funding source address detected');
    assert(result?.fundingSourceType === 'wallet', '5.5 Token funding type classified as wallet');
  }

  // Test 5.6: Funding source classification (known CEX)
  {
    // 5zpyutJu9ee6jFymDGoK7F6S5Kczqtc9FomP3ueKuyA9 is Binance in cex-addresses.json
    const acc = {
      items: [
        {
          timestamp: 1699900000,
          signature: 'cex_tx',
          nativeTransfers: [
            {
              fromUserAccount: '5zpyutJu9ee6jFymDGoK7F6S5Kczqtc9FomP3ueKuyA9',
              toUserAccount: targetWallet,
              amount: 5000000000
            }
          ]
        }
      ],
      wasCapped: false
    };
    const result = adaptHeliusWalletHistory(acc, BASE_OPTS);
    assert(result?.fundingSourceType === 'cex', '5.6 Funding source from known address classified as cex');
  }

  // Test 5.7: Empty transaction list
  {
    const result = adaptHeliusWalletHistory({ items: [], wasCapped: false }, BASE_OPTS);
    assert(result === null, '5.7 Empty items list → returns null');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`Provider Adapter Tests: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  console.error('\n[ADAPTER TESTS FAILED]');
  process.exit(1);
} else {
  console.log('\n[ADAPTER TESTS PASSED]');
  process.exit(0);
}

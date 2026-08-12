import axios from 'axios';
import { isGoldrushConfigured, fetchGoldrushTokenHolders } from './goldrush/client';
import { isAlchemyConfigured, queryAlchemyRpc } from './alchemy/client';
import { isBitqueryConfigured } from './bitquery/client';
import { PROVIDER_CONFIG } from './config';
import { EthCollector } from '../elevator/collectors/eth/EthCollector';
import { enrichPoolsWithAlchemyReserves, enrichClmmPoolsWithSlot0 } from '../deep_scan/poolEnrichment';
import { enrichWhaleWallets, WALLET_INTELLIGENCE_LOOKBACK_DAYS } from '../deep_scan/walletIntelligence';
import { simulateAmmSlippage } from '../deep_scan/engines/AmmSlippageSimulator';
import { NormalizedPoolState, LiquidityPool } from '../blockchain/types';
import { AbiCoder } from 'ethers';

const abiCoder = AbiCoder.defaultAbiCoder();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runIntegrationTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n==================================================');
  console.log('RUNNING PROVIDER INTEGRATION UNIT TESTS');
  console.log('==================================================');

  let passed = 0;
  let failed = 0;

  const testCase = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.log(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  };

  // Cache environment and provider configs
  const originalEnv = {
    GOLDRUSH_API_KEY: process.env.GOLDRUSH_API_KEY,
    ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
    BITQUERY_CLIENT_ID: process.env.BITQUERY_CLIENT_ID,
    BITQUERY_CLIENT_SECRET: process.env.BITQUERY_CLIENT_SECRET,
  };

  const originalConfig = {
    goldrushEnabled: PROVIDER_CONFIG.goldrush.enabled,
    alchemyEnabled: PROVIDER_CONFIG.alchemy.enabled,
    bitqueryEnabled: PROVIDER_CONFIG.bitquery.enabled,
  };

  const originalGet = axios.get;
  const originalPost = axios.post;

  const setupMockCredentials = () => {
    process.env.GOLDRUSH_API_KEY = 'mock_goldrush_key';
    process.env.ALCHEMY_API_KEY = 'mock_alchemy_key';
    process.env.BITQUERY_CLIENT_ID = 'mock_bitquery_id';
    process.env.BITQUERY_CLIENT_SECRET = 'mock_bitquery_secret';

    PROVIDER_CONFIG.goldrush.enabled = true;
    PROVIDER_CONFIG.alchemy.enabled = true;
    PROVIDER_CONFIG.bitquery.enabled = true;
  };

  const clearCredentials = () => {
    delete process.env.GOLDRUSH_API_KEY;
    delete process.env.ALCHEMY_API_KEY;
    delete process.env.BITQUERY_CLIENT_ID;
    delete process.env.BITQUERY_CLIENT_SECRET;

    PROVIDER_CONFIG.goldrush.enabled = false;
    PROVIDER_CONFIG.alchemy.enabled = false;
    PROVIDER_CONFIG.bitquery.enabled = false;
  };

  const restoreAll = () => {
    Object.assign(process.env, originalEnv);
    PROVIDER_CONFIG.goldrush.enabled = originalConfig.goldrushEnabled;
    PROVIDER_CONFIG.alchemy.enabled = originalConfig.alchemyEnabled;
    PROVIDER_CONFIG.bitquery.enabled = originalConfig.bitqueryEnabled;
    axios.get = originalGet;
    axios.post = originalPost;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // A. GoldRush Integration Tests
  // ───────────────────────────────────────────────────────────────────────────

  await testCase('GoldRush: unconfigured → holdersStatus = unavailable', async () => {
    clearCredentials();
    const collector = new EthCollector('mock_birdeye');
    const result = await collector.collect('0x123', 10);
    assert(result.holdersStatus === 'unavailable', 'Should remain unavailable when unconfigured');
    assert(result.holders.length === 0, 'Holders list must be empty');
  });

  await testCase('GoldRush: configured + success → holdersStatus = available', async () => {
    setupMockCredentials();
    axios.get = (async (url: string, config: any): Promise<any> => {
      if (url.includes('token_holders')) {
        return {
          status: 200,
          data: {
            data: {
              items: [
                { address: '0xabc', balance: '5000000000000000000' }, // 5.0
                { address: '0xdef', balance: '10000000000000000000' }, // 10.0
                { address: '0x0000000000000000000000000000000000000000', balance: '1000' }, // Filter zero
                { address: '0x000000000000000000000000000000000000dead', balance: '1000' }, // Filter dead
              ],
              pagination: { total_count: 4 }
            }
          }
        };
      }
      return { status: 200, data: {} };
    }) as any;

    const collector = new EthCollector('mock_birdeye');
    const result = await collector.collect('0x123', 10, 18);
    assert(result.holdersStatus === 'available', 'Should fetch and adapt holders successfully');
    assert(result.holders.length === 2, 'Should filter out zero/dead addresses, returning 2 holders');
    assert(result.holders[0].wallet === '0xdef', 'Should sort by balance descending (10.0 > 5.0)');
    assert(result.holders[0].balance === 10, 'Decimals normalization correct');
    assert(result.holders[0].tx_count === 0, 'tx_count must remain 0 per GoldRush contract');
  });

  await testCase('GoldRush: provider failure → holdersStatus = unavailable', async () => {
    setupMockCredentials();
    axios.get = (async (): Promise<any> => {
      throw new Error('Covalent API overloaded');
    }) as any;

    const collector = new EthCollector('mock_birdeye');
    const result = await collector.collect('0x123', 10, 18);
    assert(result.holdersStatus === 'unavailable', 'Should handle query errors gracefully');
    assert(result.holders.length === 0, 'No holders on fail');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B. Alchemy V2 reserves Integration Tests
  // ───────────────────────────────────────────────────────────────────────────

  await testCase('Alchemy V2: observed reserves populated correctly', async () => {
    setupMockCredentials();
    const mockToken = '0x1111111111111111111111111111111111111111';
    const mockQuote = '0x2222222222222222222222222222222222222222';
    const mockPool = '0x3333333333333333333333333333333333333333';

    // Mock Alchemy RPC calls
    axios.post = (async (url: string, data: any): Promise<any> => {
      if (data?.method === 'eth_call') {
        const to = data.params[0].to;
        const callData = data.params[0].data;
        if (to === mockPool) {
          if (callData === '0x0dfe1681') {
            // token0() -> mockToken (so mockToken is token0)
            return { status: 200, data: { result: abiCoder.encode(['address'], [mockToken]) } };
          }
          if (callData === '0x0902f1ac') {
            // getReserves() -> reserve0 = 1000 * 10^18, reserve1 = 5000 * 10^18
            return {
              status: 200,
              data: {
                result: abiCoder.encode(
                  ['uint112', 'uint112', 'uint32'],
                  [BigInt('1000000000000000000000'), BigInt('5000000000000000000000'), 1700000000]
                )
              }
            };
          }
        }
      }
      return { status: 200, data: {} };
    }) as any;

    const pools: NormalizedPoolState[] = [
      {
        poolIdentifier: mockPool,
        poolIdentifierType: 'address',
        dex: 'uniswap-v2',
        poolType: 'constant-product',
        liquidityUsd: 10000,
        fee: { known: false },
        liquidityUsdProvenance: 'provider'
      }
    ];

    const spotPrice = 5.0; // USD per token
    const enriched = await enrichPoolsWithAlchemyReserves(pools, mockToken, 18, spotPrice, 'eth');
    
    assert(enriched[0].tokenReserveRaw === 1000, 'Should match reserve0 divided by 10^18');
    assert(enriched[0].quoteReserveRaw === 1000 * spotPrice, 'quoteReserveRaw should be USD value of quote reserve');
    assert(enriched[0].tokenReserveProvenance === 'observed', 'tokenReserveProvenance should be observed');
    assert(enriched[0].quoteReserveProvenance === 'observed', 'quoteReserveProvenance should be observed');

    // Run AmmSlippageSimulator on this pool to ensure it prefers observed reserves
    const slippageResult = simulateAmmSlippage(enriched, spotPrice, [1000]);
    assert(slippageResult.reserveProvenance === 'observed', 'Simulator must use observed reserves');
    assert(slippageResult.simulations[0].reserveProvenance === 'observed', 'Simulations must inherit observed provenance');
  });

  await testCase('Alchemy V2: label-only pool skipped cleanly', async () => {
    setupMockCredentials();
    const pools: NormalizedPoolState[] = [
      {
        poolIdentifier: 'TOKEN/WETH',
        poolIdentifierType: 'label',
        dex: 'uniswap-v2',
        poolType: 'constant-product',
        liquidityUsd: 10000,
        fee: { known: false },
        liquidityUsdProvenance: 'provider'
      }
    ];

    const enriched = await enrichPoolsWithAlchemyReserves(pools, '0x111', 18, 5.0, 'eth');
    assert(enriched[0].tokenReserveRaw === undefined, 'Must skip pool lacking address');
    assert(enriched[0].quoteReserveRaw === undefined, 'Must skip pool lacking address');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // C. Bitquery Integration Tests
  // ───────────────────────────────────────────────────────────────────────────

  await testCase('Bitquery: whale wallets enrichment bounded and correct', async () => {
    setupMockCredentials();
    
    let callCount = 0;
    axios.post = (async (url: string, data: any): Promise<any> => {
      if (url.includes('oauth2.bitquery.io')) {
        return { status: 200, data: { access_token: 'mock_token' } };
      }
      if (data?.query && data.query.includes('WalletFirstSeen')) {
        callCount++;
        const wallet = data.variables.wallet;
        if (wallet === '0xfailed') {
          throw new Error('Bitquery rate limited');
        }
        return {
          status: 200,
          data: {
            data: {
              EVM: {
                Transfers: [
                  { Block: { Time: '2026-05-15T12:00:00Z', Number: 20000000 } }
                ]
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    }) as any;

    const wallets = ['0x1', '0x2', '0xfailed', '0x4'];
    const since = new Date().toISOString();
    const summary = await enrichWhaleWallets(wallets, since);

    assert(summary.recordCount === 4, 'Should query 4 wallets');
    assert(summary.available === 3, 'Should succeed on 3');
    assert(summary.unavailable === 1, 'Should fail on 1 (0xfailed)');
    assert(summary.records[2].wallet === '0xfailed', 'Should preserve failed wallet address');
    assert(summary.records[2].availability === 'unavailable', 'Failed wallet availability set to unavailable');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // D. Uniswap V3 slot0 Integration Tests
  // ───────────────────────────────────────────────────────────────────────────

  await testCase('Uniswap V3: valid slot0 and liquidity enrichment', async () => {
    setupMockCredentials();
    const mockPool = '0x3333333333333333333333333333333333333333';

    axios.post = (async (url: string, data: any): Promise<any> => {
      if (data?.method === 'eth_call') {
        const to = data.params[0].to;
        const callData = data.params[0].data;
        if (to === mockPool) {
          if (callData === '0x3850c7bd') {
            // slot0() -> sqrtPriceX96 = 79228162514264337593543950336, tick = 100
            return {
              status: 200,
              data: {
                result: abiCoder.encode(
                  ['uint160', 'int24', 'uint16', 'uint16', 'uint16', 'uint8', 'bool'],
                  [BigInt('79228162514264337593543950336'), 100, 0, 0, 0, 0, true]
                )
              }
            };
          }
          if (callData === '0x1a6865d5') {
            // liquidity() -> 500000
            return { status: 200, data: { result: abiCoder.encode(['uint128'], [BigInt(500000)]) } };
          }
          if (callData === '0x0dfe1681') {
            // token0()
            return { status: 200, data: { result: abiCoder.encode(['address'], ['0x1111111111111111111111111111111111111111']) } };
          }
          if (callData === '0xd21220a7') {
            // token1()
            return { status: 200, data: { result: abiCoder.encode(['address'], ['0x2222222222222222222222222222222222222222']) } };
          }
        }
      }
      return { status: 200, data: {} };
    }) as any;

    const pools: NormalizedPoolState[] = [
      {
        poolIdentifier: mockPool,
        poolIdentifierType: 'address',
        dex: 'uniswap-v3',
        poolType: 'concentrated-liquidity',
        liquidityUsd: 10000,
        fee: { known: false },
        liquidityUsdProvenance: 'provider'
      }
    ];

    const enriched = await enrichClmmPoolsWithSlot0(pools, 'eth');
    const profile = enriched[0].clmmProfile;
    assert(profile !== undefined, 'clmmProfile must be populated');
    assert(profile?.status === 'available', 'Profile status available');
    assert(profile?.sqrtPriceX96 === BigInt('79228162514264337593543950336'), 'Decoded sqrtPriceX96 correct');
    assert(profile?.currentTick === 100, 'Decoded tick correct');
    assert(profile?.liquidity === BigInt(500000), 'Decoded liquidity correct');

    // Verify AmmSlippageSimulator still returns insufficient_data for V3 CLMM pools
    const slippageResult = simulateAmmSlippage(enriched, 5.0, [1000]);
    assert(slippageResult.status === 'insufficient_data', 'Slippage simulation must be refused for V3 pools');
  });

  await testCase('Hardening: Test A — spotPriceUsd = 0', async () => {
    setupMockCredentials();
    const mockToken = '0x1111111111111111111111111111111111111111';
    const mockPool = '0x3333333333333333333333333333333333333333';

    axios.post = (async (url: string, data: any): Promise<any> => {
      if (data?.method === 'eth_call') {
        const callData = data.params[0].data;
        if (callData === '0x0dfe1681') {
          return { status: 200, data: { result: abiCoder.encode(['address'], [mockToken]) } };
        }
        if (callData === '0x0902f1ac') {
          return {
            status: 200,
            data: {
              result: abiCoder.encode(
                ['uint112', 'uint112', 'uint32'],
                [BigInt('1000000000000000000000'), BigInt('5000000000000000000000'), 1700000000]
              )
            }
          };
        }
      }
      return { status: 200, data: {} };
    }) as any;

    const pools: NormalizedPoolState[] = [
      {
        poolIdentifier: mockPool,
        poolIdentifierType: 'address',
        dex: 'uniswap-v2',
        poolType: 'constant-product',
        liquidityUsd: 10000,
        fee: { known: false },
        liquidityUsdProvenance: 'provider'
      }
    ];

    const enriched = await enrichPoolsWithAlchemyReserves(pools, mockToken, 18, 0, 'eth');
    assert(enriched[0].tokenReserveRaw === undefined, 'tokenReserveRaw must be undefined when spot price is 0');
    assert(enriched[0].quoteReserveRaw === undefined, 'quoteReserveRaw must be undefined when spot price is 0');
    assert(enriched[0].tokenReserveProvenance === undefined, 'Provenance must not be set');

    const slippageResult = simulateAmmSlippage(enriched, 5.0, [1000]);
    assert(slippageResult.reserveProvenance === 'derived', 'Must fallback to derived reserves');
  });

  await testCase('Hardening: Test B — zero token reserve', async () => {
    setupMockCredentials();
    const mockToken = '0x1111111111111111111111111111111111111111';
    const mockPool = '0x3333333333333333333333333333333333333333';

    axios.post = (async (url: string, data: any): Promise<any> => {
      if (data?.method === 'eth_call') {
        const callData = data.params[0].data;
        if (callData === '0x0dfe1681') {
          return { status: 200, data: { result: abiCoder.encode(['address'], [mockToken]) } };
        }
        if (callData === '0x0902f1ac') {
          return {
            status: 200,
            data: {
              result: abiCoder.encode(
                ['uint112', 'uint112', 'uint32'],
                [BigInt(0), BigInt(0), 1700000000]
              )
            }
          };
        }
      }
      return { status: 200, data: {} };
    }) as any;

    const pools: NormalizedPoolState[] = [
      {
        poolIdentifier: mockPool,
        poolIdentifierType: 'address',
        dex: 'uniswap-v2',
        poolType: 'constant-product',
        liquidityUsd: 10000,
        fee: { known: false },
        liquidityUsdProvenance: 'provider'
      }
    ];

    const enriched = await enrichPoolsWithAlchemyReserves(pools, mockToken, 18, 5.0, 'eth');
    assert(enriched[0].tokenReserveRaw === undefined, 'Must not populate reserves when raw value is 0');
    assert(enriched[0].quoteReserveRaw === undefined, 'Must not populate reserves when raw value is 0');

    const slippageResult = simulateAmmSlippage(enriched, 5.0, [1000]);
    assert(slippageResult.reserveProvenance === 'derived', 'Must fallback to derived reserves');
  });

  await testCase('Hardening: Test C — quote reserve provenance', async () => {
    setupMockCredentials();
    const mockToken = '0x1111111111111111111111111111111111111111';
    const mockPool = '0x3333333333333333333333333333333333333333';

    axios.post = (async (url: string, data: any): Promise<any> => {
      if (data?.method === 'eth_call') {
        const callData = data.params[0].data;
        if (callData === '0x0dfe1681') {
          return { status: 200, data: { result: abiCoder.encode(['address'], [mockToken]) } };
        }
        if (callData === '0x0902f1ac') {
          return {
            status: 200,
            data: {
              result: abiCoder.encode(
                ['uint112', 'uint112', 'uint32'],
                [BigInt('1000000000000000000000'), BigInt('5000000000000000000000'), 1700000000]
              )
            }
          };
        }
      }
      return { status: 200, data: {} };
    }) as any;

    const pools: NormalizedPoolState[] = [
      {
        poolIdentifier: mockPool,
        poolIdentifierType: 'address',
        dex: 'uniswap-v2',
        poolType: 'constant-product',
        liquidityUsd: 10000,
        fee: { known: false },
        liquidityUsdProvenance: 'provider'
      }
    ];

    const enriched = await enrichPoolsWithAlchemyReserves(pools, mockToken, 18, 5.0, 'eth');
    assert(enriched[0].tokenReserveProvenance === 'observed', 'tokenReserveProvenance must be observed');
    assert(enriched[0].quoteReserveProvenance === 'derived', 'quoteReserveProvenance must be derived (hardening requirement)');
  });

  await testCase('Hardening: Test D — duplicate whale wallets', async () => {
    setupMockCredentials();
    let queryCount = 0;
    const queriedWallets: string[] = [];

    axios.post = (async (url: string, data: any): Promise<any> => {
      if (url.includes('oauth2.bitquery.io')) {
        return { status: 200, data: { access_token: 'mock_token' } };
      }
      if (data?.query && data.query.includes('WalletFirstSeen')) {
        queryCount++;
        queriedWallets.push(data.variables.wallet);
        return {
          status: 200,
          data: {
            data: {
              EVM: {
                Transfers: [
                  { Block: { Time: '2026-05-15T12:00:00Z', Number: 20000000 } }
                ]
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    }) as any;

    // Pass duplicate and unnormalized wallets
    const inputWallets = [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x1111111111111111111111111111111111111111', // duplicate
      '0x2222222222222222222222222222222222222222', // duplicate
      '0X1111111111111111111111111111111111111111', // duplicate + upper case
    ];

    const summary = await enrichWhaleWallets(inputWallets, new Date().toISOString());
    assert(summary.recordCount === 2, 'Should only perform 2 queries (deduplicated)');
    assert(queryCount === 2, 'Should only request Bitquery twice');
    assert(queriedWallets[0] === '0x1111111111111111111111111111111111111111', 'Case normalised');
    assert(queriedWallets[1] === '0x2222222222222222222222222222222222222222', 'Case normalised');
  });

  await testCase('Hardening: Test E — Bitquery unconfigured', async () => {
    clearCredentials();
    let bitqueryCalled = false;
    axios.post = (async (url: string): Promise<any> => {
      if (url.includes('bitquery')) {
        bitqueryCalled = true;
      }
      return { status: 200, data: {} };
    }) as any;

    const wallets = ['0x1111111111111111111111111111111111111111'];
    const summary = await enrichWhaleWallets(wallets, new Date().toISOString());
    assert(!bitqueryCalled, 'Bitquery must not be called when unconfigured');
    assert(summary.recordCount === 0, 'No records attempted');
  });

  await testCase('Hardening: Test F — no wallets provided to Bitquery', async () => {
    setupMockCredentials();
    const summary = await enrichWhaleWallets([], new Date().toISOString());
    assert(summary.recordCount === 0, 'No records attempted when wallets list is empty');
  });

  await testCase('Hardening: Test G — configured Bitquery + wallets actually queried', async () => {
    setupMockCredentials();
    axios.post = (async (url: string, data: any): Promise<any> => {
      if (url.includes('oauth2.bitquery.io')) {
        return { status: 200, data: { access_token: 'mock_token' } };
      }
      return {
        status: 200,
        data: {
          data: {
            EVM: {
              Transfers: [
                { Block: { Time: '2026-05-15T12:00:00Z', Number: 20000000 } }
              ]
            }
          }
        }
      };
    }) as any;

    const summary = await enrichWhaleWallets(['0x1111111111111111111111111111111111111111'], new Date().toISOString());
    assert(summary.recordCount === 1, 'Attempted to query 1 wallet');
    assert(summary.available === 1, 'Availability is 1');
  });

  await testCase('Hardening: Test H — all providers disabled regression', async () => {
    clearCredentials();

    // 1. Goldrush disabled behavior check
    const collector = new EthCollector('mock_birdeye');
    const collectorResult = await collector.collect('0x123', 10, 18);
    assert(collectorResult.holdersStatus === 'unavailable', 'Goldrush status must be unavailable');

    // 2. Alchemy pool V2 enrichment skipped check
    const mockToken = '0x1111111111111111111111111111111111111111';
    const mockPool = '0x3333333333333333333333333333333333333333';
    const pools: NormalizedPoolState[] = [
      {
        poolIdentifier: mockPool,
        poolIdentifierType: 'address',
        dex: 'uniswap-v2',
        poolType: 'constant-product',
        liquidityUsd: 10000,
        fee: { known: false },
        liquidityUsdProvenance: 'provider'
      }
    ];
    const enrichedV2 = await enrichPoolsWithAlchemyReserves(pools, mockToken, 18, 5.0, 'eth');
    assert(enrichedV2[0].tokenReserveRaw === undefined, 'No reserves populated when unconfigured');

    // 3. Alchemy pool CLMM enrichment skipped check
    const clmmPools: NormalizedPoolState[] = [
      {
        poolIdentifier: mockPool,
        poolIdentifierType: 'address',
        dex: 'uniswap-v3',
        poolType: 'concentrated-liquidity',
        liquidityUsd: 10000,
        fee: { known: false },
        liquidityUsdProvenance: 'provider'
      }
    ];
    const enrichedCLMM = await enrichClmmPoolsWithSlot0(clmmPools, 'eth');
    assert(enrichedCLMM[0].clmmProfile === undefined, 'No CLMM profile populated when unconfigured');

    // 4. AmmSlippageSimulator derived fallback is still operational
    const slippageResult = simulateAmmSlippage(enrichedV2, 5.0, [1000]);
    assert(slippageResult.status === 'ok', 'Simulator succeeds using fallback');
    assert(slippageResult.reserveProvenance === 'derived', 'Reserves derived');

    // 5. CLMM slippage simulation remains insufficient_data
    const clmmSlippage = simulateAmmSlippage(enrichedCLMM, 5.0, [1000]);
    assert(clmmSlippage.status === 'insufficient_data', 'Concentrated liquidity slippage is blocked');
  });

  restoreAll();

  console.log('\n==================================================');
  console.log(`PROVIDER INTEGRATION TEST COMPLETE: ${passed}/${passed + failed} PASSED`);
  console.log('==================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runIntegrationTests().catch(console.error);
}


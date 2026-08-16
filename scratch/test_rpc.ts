import axios from 'axios';
import { getHistoricalV2Reserves } from '../lib/deep_scan/historical/HistoricalPoolState';
import { ethers } from 'ethers';

const mockPool = '0x2222222222222222222222222222222222222222';

process.env.ALCHEMY_API_KEY = 'mock_alchemy_key';

axios.post = (async (url: string, data: any, config: any): Promise<any> => {
  const payload = data || {};
  const method = payload.method;
  const params = payload.params || [];
  
  if (method === 'eth_call') {
    const blockTag = params[1];
    if (blockTag === '0x989680') {
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint112', 'uint112', 'uint32'],
        [BigInt(100), BigInt(200), 1700000000]
      );
      return { data: { jsonrpc: '2.0', id: 1, result: encoded } };
    }
  }

  if (method === 'eth_getBlockByNumber') {
    const blockTag = params[0];
    return {
      data: {
        jsonrpc: '2.0',
        id: 1,
        result: {
          hash: '0xmockhash' + blockTag,
          timestamp: '0x6554b780', // Unix 1700000000
        },
      },
    };
  }

  throw new Error(`Unhandled mock method ${method}`);
}) as any;

(async () => {
  try {
    const result = await getHistoricalV2Reserves('eth', mockPool, 10000000);
    console.log('DEBUG RESULT:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('CRASHED WITH:', err);
  }
})().catch(console.error);

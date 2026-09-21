import axios from 'axios';

async function test() {
  const token = '0x8d345658a86b5bd145d5b522b80939ef8c8aae10';
  
  console.log('1. Testing Etherscan V2 with NO api key:');
  try {
    const res = await axios.get('https://api.etherscan.io/v2/api', {
      params: {
        chainid: '56',
        module: 'contract',
        action: 'getsourcecode',
        address: token,
      }
    });
    console.log('No key status:', res.data.status, 'message:', res.data.message);
    if (res.data.status === '1') {
      console.log('Contract name:', res.data.result[0]?.ContractName);
    } else {
      console.log('Result:', res.data.result);
    }
  } catch (e: any) {
    console.error('Error no key:', e.message);
  }

  console.log('\n2. Testing with BSCSCAN_API_KEY only on Etherscan V2:');
  try {
    const res = await axios.get('https://api.etherscan.io/v2/api', {
      params: {
        chainid: '56',
        module: 'contract',
        action: 'getsourcecode',
        address: token,
        apikey: 'YourApiKeyToken'
      }
    });
    console.log('Dummy key status:', res.data.status, 'message:', res.data.message, 'result:', res.data.result);
  } catch (e: any) {
    console.error('Error dummy key:', e.message);
  }
}

test();

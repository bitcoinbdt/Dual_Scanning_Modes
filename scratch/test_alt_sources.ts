import axios from 'axios';

async function testPublicSources() {
  const token = '0x8d345658a86b5bd145d5b522b80939ef8c8aae10';
  const chainId = '56';

  console.log('Testing Sourcify API (No API key needed, free):');
  try {
    const res = await axios.get(`https://sourcify.dev/server/files/any/${chainId}/${token}`, { timeout: 5000 });
    console.log('Sourcify status:', res.status, 'files:', res.data.files?.length);
  } catch (err: any) {
    console.log('Sourcify response:', err.response?.status, err.message);
  }

  console.log('\nTesting Blockscout / Bscscan fallback:');
  try {
    // Blockscout API for BSC if available
    const bsRes = await axios.get(`https://binance.blockscout.com/api?module=contract&action=getsourcecode&address=${token}`, { timeout: 5000 });
    console.log('Blockscout BSC status:', bsRes.data.status, 'ContractName:', bsRes.data.result?.[0]?.ContractName);
  } catch (err: any) {
    console.log('Blockscout response:', err.response?.status, err.message);
  }
}

testPublicSources();

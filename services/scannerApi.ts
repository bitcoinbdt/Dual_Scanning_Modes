import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Backend server is not running. Please start the backend server at ' + BACKEND_URL);
    }
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
);

export interface BasicScanResponse {
  address: string;
  tokenName: string;
  symbol: string;
  totalSupply: number;
  contractVerified: boolean;
  network: string;
  taxBuy: string;
  taxSell: string;
  mintFunction: string;
  freezable: string;
  liquidityLocked: boolean;
  timestamp: string;
  recentTransactions: any[];
  liquidityInfo?: any;
}

export async function getBasicScan(address: string, chain: string = 'evm'): Promise<BasicScanResponse> {
  try {
    const res = await api.post(`/api/scanner/scan`, { address, chain, scanType: 'BASIC' });
    return res.data;
  } catch (error: any) {
    console.error('[Scanner API] Error:', error);
    throw error;
  }
}

export async function startElevatorScan(address: string, chain: string = 'evm', mood: string = 'neutral'): Promise<{ jobId: string, status: string, data?: any }> {
  try {
    const res = await api.post('/api/scanner/scan', { address, chain, mood, scanType: 'ELEVATOR' });
    return res.data;
  } catch (error: any) {
    console.error('[Scanner API] Error:', error);
    throw error;
  }
}

export async function getElevatorJobStatus(jobId: string): Promise<{ status: string, address?: string, data?: any }> {
  try {
    const res = await api.get(`/api/scanner/elevator/job/${jobId}`);
    return res.data;
  } catch (error: any) {
    console.error('[Scanner API] Error:', error);
    throw error;
  }
}

export async function validateBackendConnection() {
  try {
    await api.get('/api/health');
    return { connected: true, redis: true };
  } catch (error) {
    console.warn('[Scanner API] Backend not available');
    return { connected: false, redis: false };
  }
}

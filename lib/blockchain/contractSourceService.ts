import axios from 'axios';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ContractSourceFile {
  fileName: string;
  content: string;
}

export interface ContractSourceData {
  contractName: string;
  compilerVersion: string;
  optimizationUsed: boolean;
  runs: number;
  sourceFiles: ContractSourceFile[];
}

interface EtherscanResult {
  SourceCode: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
  SwarmSource: string;
}

interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanResult[] | string;
}

// ─── Explorer Config ──────────────────────────────────────────────────────────
//
// Etherscan V2 unified API (https://docs.etherscan.io/v2-migration)
// covers all chains via ?chainid=<n>.
// Each chain-alias maps to its numeric chain ID.

const CHAIN_ID_MAP: Record<string, string> = {
  '1': '1',
  'eth': '1',
  'ethereum': '1',
  '56': '56',
  'bsc': '56',
  'binance': '56',
  '137': '137',
  'polygon': '137',
  'matic': '137',
  '8453': '8453',
  'base': '8453',
  '42161': '42161',
  'arbitrum': '42161',
  'arb': '42161',
  '10': '10',
  'optimism': '10',
  'opt': '10',
};

const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api';

// ─── Source File Parser ───────────────────────────────────────────────────────

/**
 * Parses the raw SourceCode string returned by Etherscan into individual files.
 * Handles three formats:
 *   1. Plain Solidity string  (single file)
 *   2. Standard JSON input    ({sources: {...}})
 *   3. Double-brace wrapped   ({{sources: {...}}})
 */
export function parseSourceFiles(sourceCode: string, contractName: string): ContractSourceFile[] {
  const trimmed = sourceCode.trim();
  const files: ContractSourceFile[] = [];

  let rawJson = trimmed;

  // Unwrap double-brace wrapping (Etherscan Standard JSON input format)
  if (rawJson.startsWith('{{') && rawJson.endsWith('}}')) {
    rawJson = rawJson.slice(1, -1);
  }

  if (rawJson.startsWith('{') && rawJson.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawJson);

      // Sources may live at parsed.sources (Standard JSON Input)
      // or directly as the root object (legacy multi-file Etherscan format)
      const sources: Record<string, any> = parsed.sources ?? parsed;

      for (const [filePath, fileData] of Object.entries(sources)) {
        // Skip non-source keys like "settings", "language", "outputSelection"
        if (typeof fileData !== 'object' || fileData === null) continue;

        const content =
          'content' in fileData
            ? (fileData as any).content
            : '';

        if (typeof content === 'string' && content.trim()) {
          files.push({ fileName: filePath.replace(/\\/g, '/'), content });
        }
      }
    } catch {
      console.warn('[SOURCE SERVICE] Source code looked like JSON but failed to parse — treating as single file.');
    }
  }

  // Fallback: plain single Solidity file
  if (files.length === 0) {
    files.push({ fileName: `${contractName || 'Contract'}.sol`, content: sourceCode });
  }

  return files;
}

// ─── Core Service ────────────────────────────────────────────────────────────

/**
 * Fetches verified contract source code from Etherscan V2 unified API.
 * Returns null (never throws) if:
 *  - Address is not EVM format
 *  - Chain is not supported
 *  - Contract is unverified
 *  - API key is missing/invalid
 *  - Request times out
 */
export async function fetchContractSource(
  address: string,
  chainId: string
): Promise<ContractSourceData | null> {
  // 1. EVM-only: reject Solana addresses before making any network calls
  const cleanAddress = address.trim().toLowerCase();
  if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
    console.warn(`[SOURCE SERVICE] Address "${address}" is not a valid EVM address — skipping`);
    return null;
  }

  // 2. Resolve chain alias to numeric chainId
  const numericChainId = CHAIN_ID_MAP[chainId.toLowerCase()] || (chainId === 'evm' ? '56' : null);
  if (!numericChainId) {
    console.warn(`[SOURCE SERVICE] Unsupported chainId "${chainId}" — skipping`);
    return null;
  }

  // 3. Resolve API key with multiple fallbacks
  const apiKey =
    process.env.ETHERSCAN_API_KEY ||
    process.env.BSCSCAN_API_KEY ||
    process.env.POLYGONSCAN_API_KEY ||
    process.env.BASESCAN_API_KEY ||
    process.env.ARBISCAN_API_KEY ||
    process.env.EXPLORER_API_KEY ||
    process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
    '';

  if (!apiKey) {
    console.warn('[SOURCE SERVICE] No explorer API key configured in process.env (ETHERSCAN_API_KEY / BSCSCAN_API_KEY missing) — skipping contract source lookup');
    return null;
  }

  // 4. Fetch from Etherscan V2 unified API
  try {
    const response = await axios.get<EtherscanResponse>(ETHERSCAN_V2_BASE, {
      params: {
        chainid: numericChainId,
        module: 'contract',
        action: 'getsourcecode',
        address: cleanAddress,
        apikey: apiKey,
      },
      timeout: 7000,
    });

    const data = response.data;

    // Etherscan returns status '0' on errors (invalid key, no result, etc.)
    if (data.status !== '1' || !Array.isArray(data.result) || data.result.length === 0) {
      const errMsg = typeof data.result === 'string' ? data.result : data.message;
      console.warn(`[SOURCE SERVICE] Explorer API rejected for ${cleanAddress} (chain ${numericChainId}): ${errMsg}`);
      return null;
    }

    const contractData = data.result[0];

    // Empty source = unverified contract
    if (!contractData.SourceCode || contractData.SourceCode.trim() === '') {
      console.log(`[SOURCE SERVICE] Contract ${cleanAddress} is unverified (empty source)`);
      return null;
    }

    const contractName = contractData.ContractName || 'UnknownContract';
    const sourceFiles = parseSourceFiles(contractData.SourceCode, contractName);

    console.log(`[SOURCE SERVICE] ✅ Fetched ${sourceFiles.length} source file(s) for ${contractName} (${cleanAddress})`);

    return {
      contractName,
      compilerVersion: contractData.CompilerVersion,
      optimizationUsed: contractData.OptimizationUsed === '1',
      runs: parseInt(contractData.Runs || '200', 10),
      sourceFiles,
    };
  } catch (err: any) {
    console.warn(`[SOURCE SERVICE] Request failed for ${cleanAddress} on chainId ${numericChainId}: ${err.message}`);
    return null;
  }
}
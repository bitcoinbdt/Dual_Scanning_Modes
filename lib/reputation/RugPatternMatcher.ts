import { supabase } from '../supabase';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface RugMatchResult {
  isRugPull: boolean;
  rugMethod: string | null;
  similarityScore: number;
  similarTemplate: string | null;
  deployerBlacklisted: boolean;
  goPlusFlagged: boolean;
  walletBehaviorFlags: string[];
}

interface RugSignatureEntry {
  id: string;
  chain: string;
  label: string;
  functionSelectors: string[];
  bytecodeHash: string;
  addedAt: string;
}

export class RugPatternMatcher {
  /**
   * Match contract and deployer behavior against known rug signatures
   */
  static async analyze(
    tokenAddress: string,
    deployerAddress: string,
    bytecode: string | null,
    network: string
  ): Promise<RugMatchResult> {
    let similarityScore = 0;
    let similarTemplate: string | null = null;
    let deployerBlacklisted = false;
    let goPlusFlagged = false;
    const walletBehaviorFlags: string[] = [];

    // 1. Check bytecode similarity (EVM only)
    if (bytecode && bytecode !== '0x' && bytecode !== '0x0' && network.toLowerCase() !== 'solana') {
      try {
        const selectors = this.extractFunctionSelectors(bytecode);
        
        // Load signatures
        const signaturesPath = path.join(process.cwd(), 'lib/reputation/data/known_rug_signatures.json');
        if (fs.existsSync(signaturesPath)) {
          const rawSignatures = fs.readFileSync(signaturesPath, 'utf8');
          const templates: RugSignatureEntry[] = JSON.parse(rawSignatures);

          for (const t of templates) {
            const templateSet = new Set(t.functionSelectors);
            const score = this.jaccardSimilarity(selectors, templateSet);
            if (score > similarityScore) {
              similarityScore = score;
              similarTemplate = t.label;
            }
          }
        }
      } catch (err) {
        console.warn(`[RUG MATCHER] Bytecode similarity check failed:`, err);
      }
    }

    // 2. Query known_ruggers table for deployer
    try {
      const { data: rugger } = await supabase
        .from('known_ruggers')
        .select('*')
        .eq('deployer_address', deployerAddress)
        .maybeSingle();

      if (rugger) {
        deployerBlacklisted = true;
      }
    } catch (err) {
      console.warn(`[RUG MATCHER] known_ruggers database check failed:`, err);
    }

    // 3. Query GoPlus Address Security API (EVM only)
    if (network.toLowerCase() !== 'solana') {
      try {
        const goplusRes = await axios.get(
          `https://api.gopluslabs.io/api/v1/address_security/${deployerAddress}`,
          { timeout: 1500 }
        );
        const data = goplusRes.data?.result;
        if (data && (data.malicious_address === '1' || data.phishing_activities === '1')) {
          goPlusFlagged = true;
        }
      } catch (err) {
        console.warn(`[RUG MATCHER] GoPlus Address Security check failed:`, err);
      }
    }

    // 4. Evaluate behavioral rules
    // Flag if wallet has rapid LP removal or is a known malicious pattern
    if (deployerBlacklisted) {
      walletBehaviorFlags.push('blacklisted_deployer');
    }
    if (goPlusFlagged) {
      walletBehaviorFlags.push('goplus_flagged_deployer');
    }
    if (similarityScore >= 0.85) {
      walletBehaviorFlags.push('bytecode_match_to_known_rug');
    }

    const isRugPull = deployerBlacklisted || similarityScore >= 0.85 || goPlusFlagged;
    let rugMethod: string | null = null;
    if (deployerBlacklisted) rugMethod = 'Deployer address belongs to a known rug-pull operator';
    else if (similarityScore >= 0.85) rugMethod = `Bytecode similarity match with verified rug template (${similarTemplate})`;
    else if (goPlusFlagged) rugMethod = 'Deployer flagged as malicious by GoPlus address security';

    return {
      isRugPull,
      rugMethod,
      similarityScore,
      similarTemplate,
      deployerBlacklisted,
      goPlusFlagged,
      walletBehaviorFlags
    };
  }

  private static extractFunctionSelectors(bytecode: string): Set<string> {
    const selectors = new Set<string>();
    if (!bytecode || bytecode === '0x' || bytecode === '0x0') return selectors;
    
    const hex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    const regex = /63([a-fA-F0-9]{8})/g;
    let match;
    while ((match = regex.exec(hex)) !== null) {
      selectors.add('0x' + match[1].toLowerCase());
    }
    return selectors;
  }

  private static jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);
    return intersection.size / union.size;
  }
}

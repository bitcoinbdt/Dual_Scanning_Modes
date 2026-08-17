/**
 * Exchange Listing Agent — Phase 5
 *
 * Detects whether a token has been listed or is scheduled to be listed
 * on a major centralized exchange (CEX) within the next 30 days.
 *
 * Uses Gemini (Google Search grounding) as primary, Groq as fallback.
 * Output is structured and JSON-parseable.
 */

import { queryAI } from './aiProvider';

export interface ExchangeListing {
  exchange: string;           // e.g. "Binance", "Coinbase", "OKX"
  listingDate: string | null; // ISO date string, null if unknown
  listingType: 'spot' | 'futures' | 'unknown';
  priceAtListingUsd: number | null;
  listingStatus: 'confirmed' | 'rumored' | 'live';
  sourceUrl: string | null;
}

export interface ExchangeListingResult {
  status: 'ok' | 'not_found' | 'error';
  provider: string;
  tokenSymbol: string;
  listings: ExchangeListing[];
  summary: string;
  queriedAt: string;
}

const SYSTEM_INSTRUCTION = `You are a crypto market intelligence analyst specialized in CEX listing announcements. 
When given a token name and symbol, search for any confirmed or rumored centralized exchange (CEX) listings within the last 30 days or upcoming in the next 30 days.
Return ONLY a valid JSON object. Do not include markdown formatting or code blocks. Do not add commentary outside the JSON.`;

function buildPrompt(tokenName: string, tokenSymbol: string, tokenAddress: string): string {
  return `Search for centralized exchange (CEX) listing announcements for the following token:

Token Name: ${tokenName}
Token Symbol: ${tokenSymbol}
Contract Address: ${tokenAddress}

Look for any confirmed or rumored listings on major exchanges including: Binance, Coinbase, Kraken, OKX, Bybit, KuCoin, Gate.io, MEXC, Bitget, Huobi/HTX.

Return a JSON object with this exact schema:
{
  "listings": [
    {
      "exchange": "exchange name",
      "listingDate": "YYYY-MM-DD or null",
      "listingType": "spot|futures|unknown",
      "priceAtListingUsd": number or null,
      "listingStatus": "confirmed|rumored|live",
      "sourceUrl": "direct URL to announcement or null"
    }
  ],
  "summary": "1-3 sentence plain-text summary of listing status. If no listings found, say so explicitly."
}

If no listings are found, return: { "listings": [], "summary": "No confirmed or rumored CEX listings found for ${tokenSymbol} in the last 30 days." }`;
}

export class ExchangeListingAgent {
  /**
   * Search for CEX listings for the given token.
   * Non-blocking — returns an error result if AI is unavailable.
   */
  static async run(
    tokenName: string,
    tokenSymbol: string,
    tokenAddress: string
  ): Promise<ExchangeListingResult> {
    const queriedAt = new Date().toISOString();

    try {
      const prompt = buildPrompt(tokenName, tokenSymbol, tokenAddress);
      const aiResult = await queryAI(prompt, SYSTEM_INSTRUCTION, 12_000);

      if (aiResult.provider === 'none') {
        return {
          status: 'error',
          provider: 'none',
          tokenSymbol,
          listings: [],
          summary: `AI providers unavailable: ${aiResult.error}`,
          queriedAt,
        };
      }

      // Parse the JSON response
      const rawText = aiResult.text.trim();
      // Strip potential markdown wrappers if the model ignores instructions
      const jsonText = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(jsonText);

      const listings: ExchangeListing[] = (parsed.listings ?? []).map((l: any) => ({
        exchange: l.exchange ?? 'Unknown',
        listingDate: l.listingDate ?? null,
        listingType: ['spot', 'futures'].includes(l.listingType) ? l.listingType : 'unknown',
        priceAtListingUsd: typeof l.priceAtListingUsd === 'number' ? l.priceAtListingUsd : null,
        listingStatus: ['confirmed', 'rumored', 'live'].includes(l.listingStatus) ? l.listingStatus : 'rumored',
        sourceUrl: l.sourceUrl ?? null,
      }));

      return {
        status: listings.length > 0 ? 'ok' : 'not_found',
        provider: aiResult.provider,
        tokenSymbol,
        listings,
        summary: parsed.summary ?? '',
        queriedAt,
      };
    } catch (err: any) {
      console.warn(`[EXCHANGE LISTING AGENT] Failed for ${tokenSymbol}: ${err.message}`);
      return {
        status: 'error',
        provider: 'error',
        tokenSymbol,
        listings: [],
        summary: `Exchange listing lookup failed: ${err.message}`,
        queriedAt,
      };
    }
  }
}

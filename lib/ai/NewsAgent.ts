/**
 * News Agent — Phase 5
 *
 * Fetches and summarizes recent news (last 7 days) about a given token.
 * Uses Gemini (Google Search grounding) as primary, Groq as fallback.
 * Output is a structured list of recent news items with URLs and a summary.
 */

import { queryAI } from './aiProvider';

export interface NewsItem {
  title: string;
  url: string | null;
  publishedDate: string | null; // ISO date string or null
  sourceName: string | null;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface NewsResult {
  status: 'ok' | 'not_found' | 'error';
  provider: string;
  tokenSymbol: string;
  articles: NewsItem[];
  /** 3–5 sentence AI-written summary of recent news */
  summary: string;
  queriedAt: string;
}

const SYSTEM_INSTRUCTION = `You are a crypto news research analyst. 
When given a token name and symbol, find and summarize recent news from the last 7 days. 
Focus on protocol developments, partnerships, security incidents, regulatory actions, and major community events.
Return ONLY a valid JSON object. Do not include markdown formatting or code blocks.`;

function buildPrompt(tokenName: string, tokenSymbol: string): string {
  return `Search for recent news (last 7 days) about this cryptocurrency token:

Token Name: ${tokenName}
Token Symbol: ${tokenSymbol}

Find news articles, blog posts, official announcements, or social media events about this token. Include:
- Protocol updates or mainnet launches
- Partnership or integration announcements
- Security incidents, hacks, or exploits
- Regulatory news
- Major community controversies or FUD events

Return a JSON object with this exact schema:
{
  "articles": [
    {
      "title": "article headline",
      "url": "direct URL to article or null",
      "publishedDate": "YYYY-MM-DD or null",
      "sourceName": "publication name or null",
      "sentiment": "positive|negative|neutral"
    }
  ],
  "summary": "3-5 sentence plain-text summary of the token's recent news. Be factual and neutral."
}

If no news is found, return: { "articles": [], "summary": "No significant news found for ${tokenSymbol} in the last 7 days." }`;
}

export class NewsAgent {
  /**
   * Fetch and summarize news for the given token.
   * Non-blocking — returns an error result if AI is unavailable.
   */
  static async run(
    tokenName: string,
    tokenSymbol: string
  ): Promise<NewsResult> {
    const queriedAt = new Date().toISOString();

    try {
      const prompt = buildPrompt(tokenName, tokenSymbol);
      const aiResult = await queryAI(prompt, SYSTEM_INSTRUCTION, 4_000);

      if (aiResult.provider === 'none') {
        return {
          status: 'error',
          provider: 'none',
          tokenSymbol,
          articles: [],
          summary: `AI providers unavailable: ${aiResult.error}`,
          queriedAt,
        };
      }

      const rawText = aiResult.text.trim();
      const jsonText = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(jsonText);

      const articles: NewsItem[] = (parsed.articles ?? []).map((a: any) => ({
        title: a.title ?? 'Untitled',
        url: a.url ?? null,
        publishedDate: a.publishedDate ?? null,
        sourceName: a.sourceName ?? null,
        sentiment: ['positive', 'negative', 'neutral'].includes(a.sentiment)
          ? a.sentiment
          : 'neutral',
      }));

      return {
        status: articles.length > 0 ? 'ok' : 'not_found',
        provider: aiResult.provider,
        tokenSymbol,
        articles,
        summary: parsed.summary ?? '',
        queriedAt,
      };
    } catch (err: any) {
      console.warn(`[NEWS AGENT] Failed for ${tokenSymbol}: ${err.message}`);
      return {
        status: 'error',
        provider: 'error',
        tokenSymbol,
        articles: [],
        summary: `News lookup failed: ${err.message}`,
        queriedAt,
      };
    }
  }
}

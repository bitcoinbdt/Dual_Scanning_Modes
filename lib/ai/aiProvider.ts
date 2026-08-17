/**
 * AI Provider Wrapper — Phase 5
 *
 * Handles Gemini-primary / Groq-fallback routing transparently.
 * Errors in the primary provider are caught and the fallback is attempted.
 * Both errors produce a null result (non-blocking).
 */

import { queryGemini, GeminiResponse } from './geminiClient';
import { queryGroq, GroqResponse } from './groqClient';

export type AIProviderResult =
  | { provider: 'gemini'; text: string; raw: GeminiResponse }
  | { provider: 'groq'; text: string; raw: GroqResponse }
  | { provider: 'none'; text: ''; error: string };

/**
 * Execute a prompt through Gemini first.
 * If Gemini fails (network, quota, timeout), fall back to Groq.
 * If both fail, return a { provider: 'none' } result without throwing.
 */
export async function queryAI(
  prompt: string,
  systemInstruction?: string,
  timeoutMs = 10_000
): Promise<AIProviderResult> {
  let geminiError = '';

  // 1. Try Gemini (primary)
  try {
    const result = await queryGemini(prompt, systemInstruction, timeoutMs);
    if (result.text) {
      return { provider: 'gemini', text: result.text, raw: result };
    }
  } catch (err: any) {
    geminiError = err.message || 'Gemini returned an empty response';
    console.warn(`[AI PROVIDER] Gemini primary failed: ${geminiError}`);
  }

  // 2. Fallback to Groq (only if GROQ_API_KEY is explicitly configured)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.trim().length > 0) {
    try {
      console.log('[AI PROVIDER] Trying Groq fallback...');
      const result = await queryGroq(prompt, systemInstruction, timeoutMs);
      if (result.text) {
        return { provider: 'groq', text: result.text, raw: result };
      }
    } catch (err: any) {
      console.warn(`[AI PROVIDER] Groq fallback also failed: ${err.message}.`);
      return { provider: 'none', text: '', error: `Gemini: ${geminiError} | Groq: ${err.message}` };
    }
  }

  return { provider: 'none', text: '', error: geminiError || 'Gemini provider returned an empty response.' };
}

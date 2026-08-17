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
  // 1. Try Gemini (primary)
  try {
    const result = await queryGemini(prompt, systemInstruction, timeoutMs);
    if (result.text) {
      return { provider: 'gemini', text: result.text, raw: result };
    }
  } catch (err: any) {
    console.warn(`[AI PROVIDER] Gemini failed: ${err.message}. Falling back to Groq...`);
  }

  // 2. Fallback to Groq
  try {
    const result = await queryGroq(prompt, systemInstruction, timeoutMs);
    if (result.text) {
      return { provider: 'groq', text: result.text, raw: result };
    }
  } catch (err: any) {
    console.warn(`[AI PROVIDER] Groq fallback also failed: ${err.message}.`);
    return { provider: 'none', text: '', error: err.message };
  }

  return { provider: 'none', text: '', error: 'Both AI providers returned empty responses.' };
}

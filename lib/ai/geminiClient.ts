/**
 * Gemini AI Client — Phase 5
 *
 * Primary AI provider using Google's @google/genai SDK.
 * Targets gemini-2.0-flash with Google Search grounding enabled.
 * All calls are rate-limited and fail gracefully.
 */

import { GoogleGenAI, Tool } from '@google/genai';

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('[GEMINI] GEMINI_API_KEY is not set in environment variables.');
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

export interface GeminiResponse {
  text: string;
  groundingMetadata?: any;
  usageMetadata?: any;
}

/**
 * Run a single Gemini query with Google Search grounding enabled.
 * @param prompt - The user prompt to send.
 * @param systemInstruction - Optional system-level instruction.
 * @param timeoutMs - Maximum time to wait for a response. Default: 10 000 ms.
 */
export async function queryGemini(
  prompt: string,
  systemInstruction?: string,
  timeoutMs = 10_000
): Promise<GeminiResponse> {
  const client = getClient();

  const googleSearch: Tool = { googleSearch: {} };

  const request = {
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
    config: {
      tools: [googleSearch],
      ...(systemInstruction ? { systemInstruction } : {}),
    },
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('[GEMINI] Request timed out')), timeoutMs)
  );

  const responsePromise = client.models.generateContent(request);
  const response = await Promise.race([responsePromise, timeoutPromise]);

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return {
    text,
    groundingMetadata: response.candidates?.[0]?.groundingMetadata,
    usageMetadata: response.usageMetadata,
  };
}

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
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('[GEMINI] GEMINI_API_KEY (or GOOGLE_API_KEY) is not set in environment variables.');
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
 * Falls back to gemini-flash-lite-latest if gemini-flash-latest is unavailable,
 * and automatically retries without search tools if quota (429) limit is encountered.
 * @param prompt - The user prompt to send.
 * @param systemInstruction - Optional system-level instruction.
 * @param timeoutMs - Maximum time to wait for a response. Default: 15 000 ms.
 */
export async function queryGemini(
  prompt: string,
  systemInstruction?: string,
  timeoutMs = 15_000
): Promise<GeminiResponse> {
  const client = getClient();
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
  ];
  let lastError: any = null;

  for (const model of models) {
    // 1. Try with search grounding
    try {
      const result = await generateWithRetry(client, model, prompt, systemInstruction, true, timeoutMs);
      return result;
    } catch (err: any) {
      lastError = err;
      const errMsg = err.message || '';
      const isTimeout = errMsg.toLowerCase().includes('timed out') || errMsg.toLowerCase().includes('timeout');
      if (isTimeout) {
        console.warn(`[GEMINI] Request timed out for model ${model}. Aborting further model attempts to prevent gateway timeout.`);
        throw err;
      }
      
      // If quota (429) limit is hit or search grounding fails due to API restrictions, retry without it
      if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource_exhausted')) {
        console.warn(`[GEMINI] Search grounding quota hit for model ${model}. Retrying without search grounding...`);
        try {
          const result = await generateWithRetry(client, model, prompt, systemInstruction, false, timeoutMs);
          return result;
        } catch (retryErr: any) {
          lastError = retryErr;
          console.warn(`[GEMINI] Retry without grounding also failed for ${model}: ${retryErr.message}`);
          const isRetryTimeout = (retryErr.message || '').toLowerCase().includes('timed out') || (retryErr.message || '').toLowerCase().includes('timeout');
          if (isRetryTimeout) {
            throw retryErr;
          }
        }
      } else {
        console.warn(`[GEMINI] Model ${model} failed: ${errMsg}. Trying next model...`);
      }
    }
  }

  throw lastError || new Error('[GEMINI] All models failed to generate content.');
}

async function generateWithRetry(
  client: GoogleGenAI,
  model: string,
  prompt: string,
  systemInstruction?: string,
  useSearch = true,
  timeoutMs = 15_000
): Promise<GeminiResponse> {
  const request: any = {
    model,
    contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
    config: {},
  };

  if (useSearch) {
    const googleSearch: Tool = { googleSearch: {} };
    request.config.tools = [googleSearch];
  }
  if (systemInstruction) {
    request.config.systemInstruction = systemInstruction;
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`[GEMINI] Request timed out for model ${model}`)), timeoutMs)
  );

  const responsePromise = client.models.generateContent(request);
  const response: any = await Promise.race([responsePromise, timeoutPromise]);

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return {
    text,
    groundingMetadata: response.candidates?.[0]?.groundingMetadata,
    usageMetadata: response.usageMetadata,
  };
}

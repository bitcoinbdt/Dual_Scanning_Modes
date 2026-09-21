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
  timeoutMs = 15_000,
  opts?: { requireSearchGrounding?: boolean }
): Promise<GeminiResponse> {
  const client = getClient();
  // FIX-6.4: Only verified Google Gemini models. The previous 3.x-flash names
  // do not exist and caused 3 wasted requests per call.
  const models = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
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
        // FIX-6.5: When the caller requires search grounding, do NOT retry without it.
        // Retrying without search produces hallucinated URLs for news/listing queries.
        if (opts?.requireSearchGrounding === true) {
          console.warn(`[GEMINI] Search grounding quota hit for ${model}, but caller requires search. Aborting.`);
          throw new Error('[GEMINI] Search grounding unavailable (quota/error). No fallback per caller requirement.');
        }
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

  // FIX-5.1: Use AbortController so timeout actually cancels the SDK request.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: any;
  try {
    // The @google/genai SDK accepts `config.abortSignal`
    request.config.abortSignal = controller.signal;
    response = await client.models.generateContent(request);
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`[GEMINI] Request timed out for model ${model}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return {
    text,
    groundingMetadata: response.candidates?.[0]?.groundingMetadata,
    usageMetadata: response.usageMetadata,
  };
}

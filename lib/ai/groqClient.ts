/**
 * Groq AI Client — Phase 5
 *
 * Fallback AI provider using the Groq SDK.
 * Targets llama-3.3-70b-versatile for fast inference.
 * All calls are rate-limited and fail gracefully.
 */

import Groq from 'groq-sdk';

let _client: Groq | null = null;

function getClient(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('[GROQ] GROQ_API_KEY is not set in environment variables.');
    _client = new Groq({ apiKey });
  }
  return _client;
}

export interface GroqResponse {
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Run a single Groq inference call.
 * @param prompt - The user message to send.
 * @param systemInstruction - Optional system message prefix.
 * @param timeoutMs - Maximum time to wait for response. Default: 10 000 ms.
 */
export async function queryGroq(
  prompt: string,
  systemInstruction?: string,
  timeoutMs = 10_000
): Promise<GroqResponse> {
  const client = getClient();

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('[GROQ] Request timed out')), timeoutMs)
  );

  const responsePromise = client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 1024,
    temperature: 0.3,
  });

  const response = await Promise.race([responsePromise, timeoutPromise]);
  const text = response.choices?.[0]?.message?.content ?? '';

  return {
    text,
    model: response.model,
    usage: response.usage
      ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        }
      : undefined,
  };
}

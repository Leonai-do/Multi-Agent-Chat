/**
 * Minimal Groq REST client for chat completions using the OpenAI-compatible endpoint.
 * This client is intended for development or behind a server proxy. Avoid exposing
 * secrets in production builds.
 */

export interface GroqMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface GroqGenerateParams {
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  signal?: AbortSignal;
}

export async function generateGroqTextViaREST({ apiKey, model, system, prompt, signal }: GroqGenerateParams): Promise<string> {
  const msgs: GroqMessage[] = [];
  if (system) msgs.push({ role: 'system', content: system });
  msgs.push({ role: 'user', content: prompt });
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: msgs }),
    signal,
  });
  if (!resp.ok) {
    let detail = '';
    try { detail = await resp.text(); } catch {}
    throw new Error(`Groq API error: ${resp.status} ${resp.statusText} ${detail}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? '';
}


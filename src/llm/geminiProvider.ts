import type { LLMProvider, GenerateParams } from './provider';
import { getGeminiApiKey } from '../config';

async function proxyGenerate(body: any, signal?: AbortSignal): Promise<string> {
  const resp = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Proxy error: ${resp.status} ${resp.statusText} ${text}`);
  }
  const data = await resp.json();
  return data?.text || '';
}

async function* proxyGenerateStream(body: any, signal?: AbortSignal): AsyncIterable<string> {
  const resp = await fetch('/api/generateStream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Proxy stream error: ${resp.status} ${resp.statusText} ${text}`);
  }
  const reader = (resp.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) yield decoder.decode(value, { stream: true });
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

const GeminiProvider: LLMProvider = {
  name: 'gemini',
  capabilities: { streaming: true, vision: false, functionCalling: false },
  async generateText(params: GenerateParams): Promise<string> {
    const apiKey = getGeminiApiKey();
    return proxyGenerate({ provider: 'gemini', apiKey, ...params }, params.signal);
  },
  async *generateStream(params: GenerateParams) {
    const apiKey = getGeminiApiKey();
    yield* proxyGenerateStream({ provider: 'gemini', apiKey, ...params }, params.signal);
  },
};

export default GeminiProvider;

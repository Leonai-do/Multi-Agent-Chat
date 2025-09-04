import type { LLMProvider, GenerateParams } from './provider';

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

const GeminiProvider: LLMProvider = {
  name: 'gemini',
  capabilities: { streaming: false, vision: false, functionCalling: false },
  async generateText(params: GenerateParams): Promise<string> {
    return proxyGenerate({ provider: 'gemini', ...params }, params.signal);
  },
};

export default GeminiProvider;


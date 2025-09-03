/** Utilities to fetch model lists for supported providers. */

import { getGeminiApiKey, getGroqApiKey } from '../config';

export type ProviderName = 'gemini' | 'groq';
export interface ModelOption { id: string; label: string }

/** Fetch Gemini models via public REST (requires API key). */
export async function fetchGeminiModels(apiKey?: string, signal?: AbortSignal): Promise<ModelOption[]> {
  const key = apiKey || getGeminiApiKey();
  if (!key) return [];
  const urls = [
    `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`,
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url, { signal });
      if (!resp.ok) continue;
      const data = await resp.json();
      const models = (data.models || data?.data || []) as any[];
      // Filter to text/chat capable models (presence of supportedGenerationMethods or name pattern)
      const options: ModelOption[] = models
        .map((m) => ({
          id: m.name || m.id || '',
          label: m.displayName || m.description || m.name || m.id || '',
          methods: m.supportedGenerationMethods as string[] | undefined,
        }))
        .filter((m) => m.id)
        .filter((m) => {
          const id = m.id.toLowerCase();
          if (m.methods && Array.isArray(m.methods)) return m.methods.includes('generateContent');
          return id.includes('gemini');
        })
        .map((m) => ({ id: m.id, label: m.label || m.id }));
      if (options.length) return options;
    } catch {
      // try next endpoint
    }
  }
  return [];
}

/** Fetch Groq models via OpenAI-compatible REST (requires API key). */
export async function fetchGroqModels(apiKey?: string, signal?: AbortSignal): Promise<ModelOption[]> {
  const key = apiKey || getGroqApiKey();
  if (!key) return [];
  const resp = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal,
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  const items: any[] = data?.data || [];
  // Groq returns various model families; keep all but sort for readability
  const options: ModelOption[] = items
    .map((m) => ({ id: m.id as string, label: m.id as string }))
    .filter((m) => !!m.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return options;
}

export async function fetchModelsForProvider(provider: ProviderName, apiKey?: string, signal?: AbortSignal): Promise<ModelOption[]> {
  if (provider === 'gemini') return fetchGeminiModels(apiKey, signal);
  if (provider === 'groq') return fetchGroqModels(apiKey, signal);
  return [];
}


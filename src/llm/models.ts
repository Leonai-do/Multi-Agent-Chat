/** Utilities to fetch model lists for supported providers. */

import { getGeminiApiKey, getGroqApiKey } from '../config';

export type ProviderName = 'gemini' | 'groq';
export interface ModelOption { id: string; label: string }

/** Fetch Gemini models via public REST (requires API key). */
export async function fetchGeminiModels(apiKey?: string, signal?: AbortSignal): Promise<ModelOption[]> {
  const key = apiKey || getGeminiApiKey();
  if (!key) return [];

  // Helper to fetch all pages for a given base URL
  const listAll = async (baseUrl: string): Promise<any[]> => {
    const items: any[] = [];
    let pageToken = '';
    while (true) {
      const url = `${baseUrl}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}&pageSize=200`;
      const resp = await fetch(url, { signal });
      if (!resp.ok) break;
      const data = await resp.json();
      const models = (data.models || data?.data || []) as any[];
      if (Array.isArray(models)) items.push(...models);
      const next = (data.nextPageToken as string | undefined) || '';
      if (!next) break;
      pageToken = next;
    }
    return items;
  };

  // Query both v1 and v1beta and merge results
  const bases = [
    `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`,
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
  ];

  const collected: any[] = [];
  for (const b of bases) {
    try {
      const list = await listAll(b);
      if (list?.length) collected.push(...list);
    } catch {
      // continue to next base
    }
  }

  // Normalize, de-duplicate, and sort
  const seen = new Set<string>();
  const options: ModelOption[] = [];
  for (const m of collected) {
    const rawId = (m.name || m.id || '') as string;
    if (!rawId) continue;
    const id = rawId.replace(/^models\//, '');
    if (seen.has(id)) continue;
    seen.add(id);
    const label = (m.displayName || m.description || id) as string;
    options.push({ id, label });
  }
  options.sort((a, b) => a.id.localeCompare(b.id));
  return options;
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

import type { Tool, ToolExecuteParams, ToolResult, SearchInput, SearchOutput } from './index';

export default class SearchTool implements Tool<SearchInput, SearchOutput> {
  name = 'search';
  capabilities = { network: true } as const;

  async execute(params: ToolExecuteParams<SearchInput>): Promise<ToolResult<SearchOutput>> {
    const { input, signal } = params;
    try {
      const { query, maxResults = 3 } = input || ({} as SearchInput);
      if (!query || typeof query !== 'string') {
        return { ok: false, error: 'Missing query' };
      }
      const resp = await fetch('/api/tools/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          include_raw_content: true,
          max_results: Math.min(Math.max(1, maxResults), 10),
        }),
        signal,
      });
      if (!resp.ok) return { ok: false, error: `search failed: ${resp.status}` };
      const json = await resp.json();
      const results = Array.isArray(json?.results) ? json.results : [];
      return { ok: true, data: { results } };
    } catch (e: any) {
      if (e?.name === 'AbortError') return { ok: false, error: 'aborted' };
      return { ok: false, error: e?.message || 'error' };
    }
  }
}
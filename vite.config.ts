import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // External interface API (optional). When configured, all LLM requests
    // are forwarded to this API instead of using provider API keys here.
    const INTERFACE_API_BASE = (env.INTERFACE_API_URL || '').replace(/\/$/, '');
    const INTERFACE_GEN_PATH = env.INTERFACE_GENERATE_PATH || '/generate';
    const INTERFACE_STREAM_PATH = env.INTERFACE_STREAM_PATH || '/generateStream';
    const INTERFACE_MODELS_PATH = env.INTERFACE_MODELS_PATH || '/models';
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      plugins: [
        {
          name: 'logs-writer',
          configureServer(server) {
            server.middlewares.use('/api/logs', async (req, res) => {
              try {
                const url = new URL(req.url || '', 'http://localhost');
                const category = url.searchParams.get('category') || 'app';
                const chunks: any[] = [];
                for await (const c of req as any) chunks.push(c);
                const body = Buffer.concat(chunks as any).toString('utf-8') || '{}';
                const data = JSON.parse(body);
                const entries = Array.isArray(data?.entries) ? data.entries : [];
                const day = new Date().toISOString().slice(0,10);
                const dir = path.resolve(process.cwd(), 'logs', category);
                fs.mkdirSync(dir, { recursive: true });
                const file = path.join(dir, `${day}.ndjson`);
                const lines = entries.map((e: any) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '');
                fs.appendFileSync(file, lines, { encoding: 'utf-8' });
                res.statusCode = 200; res.end('ok');
              } catch (e: any) {
                res.statusCode = 500; res.end(e?.message || 'error');
              }
            });
            // Models discovery endpoint (provider-aware)
            server.middlewares.use('/api/models', async (req, res) => {
              try {
                const url = new URL(req.url || '', 'http://localhost');
                const provider = url.searchParams.get('provider') || '';
                if (!provider) { res.statusCode = 400; res.end('Missing provider'); return; }
                if (INTERFACE_API_BASE) {
                  const r: any = await fetch(`${INTERFACE_API_BASE}${INTERFACE_MODELS_PATH}?provider=${encodeURIComponent(provider)}`);
                  if (!r.ok) { res.statusCode = r.status; res.end(await r.text()); return; }
                  const json = await r.json();
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(json));
                  return;
                }
                // Fallback: minimal built-in list
                const fallback: Record<string, any[]> = {
                  gemini: [
                    { id: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
                    { id: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
                  ],
                  groq: [
                    { id: 'llama-3.1-70b-versatile', label: 'llama-3.1-70b-versatile' },
                    { id: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant' },
                  ],
                };
                const list = fallback[provider] || [];
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(list));
              } catch (e: any) {
                res.statusCode = 500; res.end(e?.message || 'error');
              }
            });
            // --- Tavily: server-side proxy (protects the API key) ---
            server.middlewares.use('/api/tavily-test', async (req, res) => {
              try {
                const TAVILY_API_KEY = process.env.TAVILY_API_KEY || env.TAVILY_API_KEY || '';
                if (!TAVILY_API_KEY) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'TAVILY_API_KEY not configured on server' }));
                  return;
                }
                // Optional live ping to verify the key:
                const r = await fetch('https://api.tavily.com/search', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    api_key: TAVILY_API_KEY,
                    query: 'ping',
                    search_depth: 'basic',
                    include_raw_content: false,
                    max_results: 1,
                  }),
                });
                if (!r.ok) {
                  res.statusCode = r.status;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(await r.text());
                  return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ message: 'Tavily API key is valid' }));
              } catch (e) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: (e as any)?.message || 'error' }));
              }
            });

            server.middlewares.use('/api/tools/search', async (req, res) => {
              try {
                if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
                const body = await new Promise<string>((resolve) => {
                  let data = ''; req.on('data', (c) => data += c); req.on('end', () => resolve(data));
                });
                const { query, search_depth = 'basic', include_raw_content = true, max_results = 3 } =
                  JSON.parse(body || '{}') || {};
                if (!query || typeof query !== 'string') { res.statusCode = 400; res.end('Missing query'); return; }
                const TAVILY_API_KEY = process.env.TAVILY_API_KEY || env.TAVILY_API_KEY || '';
                if (!TAVILY_API_KEY) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'TAVILY_API_KEY not configured on server' }));
                  return;
                }
                const r = await fetch('https://api.tavily.com/search', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    api_key: TAVILY_API_KEY,
                    query,
                    search_depth,
                    include_raw_content,
                    max_results,
                  }),
                });
                const text = await r.text();
                res.statusCode = r.status || 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(text);
              } catch (e) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: (e as any)?.message || 'error' }));
              }
            });
            server.middlewares.use('/api/generate', async (req, res) => {
              try {
                const chunks: any[] = [];
                for await (const c of req as any) chunks.push(c);
                const body = Buffer.concat(chunks as any).toString('utf-8') || '{}';
                const data = JSON.parse(body || '{}');
                const { provider, model, prompt, system, apiKey } = data || {};
                if (!provider || !model || !prompt) { res.statusCode = 400; res.end('Missing provider/model/prompt'); return; }

                // Retry helper with exponential backoff + jitter; honors Retry-After when present
                const parseRetryAfterMs = (h: string | null): number => {
                  if (!h) return 0;
                  const s = Number(h);
                  if (!Number.isNaN(s)) return s * 1000;
                  const when = Date.parse(h);
                  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
                  return 0;
                };
                const fetchWithRetry = async (make: () => Promise<any>, max = 3) => {
                  let last: any;
                  for (let attempt = 1; attempt <= max; attempt++) {
                    last = await make();
                    if (last.status !== 429 && last.status !== 503) return last;
                    const ra = parseRetryAfterMs(last.headers?.get?.('retry-after') || null);
                    const base = Math.min(2000, 300 * Math.pow(2, attempt - 1));
                    const waitMs = ra || (base + Math.floor(Math.random() * 200));
                    await new Promise((r) => setTimeout(r, waitMs));
                  }
                  return last;
                };

                // Forward to interface-provided API when configured
                if (INTERFACE_API_BASE) {
                  try {
                    const url = `${INTERFACE_API_BASE}${INTERFACE_GEN_PATH}`;
                    const r: any = await fetch(url, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ provider, model, prompt, system, apiKey }),
                    } as any);
                    if (!r.ok) { res.statusCode = r.status; res.end(await r.text()); return; }
                    const json: any = await r.json();
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(json));
                    return;
                  } catch (e: any) {
                    res.statusCode = 502; res.end(e?.message || 'Upstream interface error');
                    return;
                  }
                }
                if (provider === 'groq') {
                  const key = process.env.GROQ_API_KEY || apiKey;
                  if (!key) { res.statusCode = 500; res.end('GROQ_API_KEY missing'); return; }
                  const r: any = await fetchWithRetry(() => fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify({
                      model,
                      stream: true,
                      messages: [
                        ...(system ? [{ role: 'system', content: system }] : []),
                        { role: 'user', content: prompt },
                      ],
                    }),
                    signal: upstreamController.signal,
                  } as any));
                  if (!r.ok || !r.body) { res.statusCode = r.status || 500; res.end(await r.text().catch(()=>'')); return; }

                  let buffer = '';
                  for await (const chunk of r.body as any) {
                    buffer += Buffer.from(chunk).toString('utf-8');
                    // Process by newlines (SSE-style)
                    let idx;
                    while ((idx = buffer.indexOf('\n')) !== -1) {
                      const line = buffer.slice(0, idx).trim();
                      buffer = buffer.slice(idx + 1);
                      if (!line) continue;
                      if (line.startsWith(':')) continue; // comment/keepalive
                      const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
                      if (payload === '[DONE]') { try { res.end(); } catch {}; return; }
                      try {
                        const json = JSON.parse(payload);
                        const delta = json?.choices?.[0]?.delta;
                        const content = (typeof delta?.content === 'string') ? delta.content : '';
                        if (content) { wroteAnyChunk = true; res.write(content); }
                      } catch {
                        // Not JSON, ignore
                      }
                    }
                  }
                  try { res.end(); } catch {} // eslint-disable-line @typescript-eslint/no-explicit-any
                  clearTimeout(idleTimer);
                  return;
                }

                if (provider === 'gemini') {
                  const key = process.env.GEMINI_API_KEY || apiKey;
                  if (!key) return endError(500, 'GEMINI_API_KEY missing');
                  // Use streamGenerateContent endpoint
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?key=${encodeURIComponent(key)}`;
                  const r: any = await fetchWithRetry(() => fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      ...(system ? { systemInstruction: { role: 'system', parts: [{ text: system }] } } : {}),
                    }),
                    signal: upstreamController.signal,
                  } as any));
                  if (!r.ok || !r.body) { res.statusCode = r.status || 500; res.end(await r.text().catch(()=>'')); return; }

                  // Gemini streams JSON chunks separated by newlines
                  let buffer = '';
                  for await (const chunk of r.body as any) {
                    buffer += Buffer.from(chunk).toString('utf-8');
                    let idx;
                    while ((idx = buffer.indexOf('\n')) !== -1) {
                      const line = buffer.slice(0, idx).trim();
                      buffer = buffer.slice(idx + 1);
                      if (!line) continue;
                      // Some servers prefix with data:
                      const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
                      try {
                        const json = JSON.parse(payload);
                        const parts = json?.candidates?.[0]?.content?.parts || [];
                        const text = parts.map((p: any) => p?.text || '').join('');
                        if (text) { wroteAnyChunk = true; res.write(text); }
                      } catch {
                        // Not JSON or partial, ignore until complete line
                      }
                    }
                  }
                  try { res.end(); } catch {} // eslint-disable-line @typescript-eslint/no-explicit-any
                  clearTimeout(idleTimer);
                  return;
                }

                endError(400, 'Unsupported provider');
              } catch (e: any) {
                res.statusCode = 500; res.end(e?.message || 'error');
              }
            });
          },
        },
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

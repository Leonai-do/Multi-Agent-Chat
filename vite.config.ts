import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
            server.middlewares.use('/api/generate', async (req, res) => {
              try {
                const chunks: any[] = [];
                for await (const c of req as any) chunks.push(c);
                const body = Buffer.concat(chunks as any).toString('utf-8') || '{}';
                const data = JSON.parse(body || '{}');
                const { provider, model, prompt, system } = data || {};
                if (!provider || !model || !prompt) { res.statusCode = 400; res.end('Missing provider/model/prompt'); return; }
                if (provider === 'groq') {
                  const key = process.env.GROQ_API_KEY;
                  if (!key) { res.statusCode = 500; res.end('GROQ_API_KEY missing'); return; }
                  const r: any = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify({
                      model,
                      messages: [
                        ...(system ? [{ role: 'system', content: system }] : []),
                        { role: 'user', content: prompt },
                      ],
                    }),
                  } as any);
                  if (!r.ok) { res.statusCode = r.status; res.end(await r.text()); return; }
                  const json: any = await r.json();
                  const text = json?.choices?.[0]?.message?.content || '';
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ text }));
                  return;
                }
                if (provider === 'gemini') {
                  const key = process.env.GEMINI_API_KEY;
                  if (!key) { res.statusCode = 500; res.end('GEMINI_API_KEY missing'); return; }
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
                  const r: any = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      ...(system ? { systemInstruction: { role: 'system', parts: [{ text: system }] } } : {}),
                    }),
                  } as any);
                  if (!r.ok) { res.statusCode = r.status; res.end(await r.text()); return; }
                  const json: any = await r.json();
                  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ text }));
                  return;
                }
                res.statusCode = 400; res.end('Unsupported provider');
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

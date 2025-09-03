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

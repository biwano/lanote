import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import pronote from './routes/pronote.js';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env');
if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

const app = new Hono();

app.use(
  '/api/*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.get('/api/health', (c) => c.json({ ok: true }));

app.route('/api/pronote', pronote);

const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOST ?? '0.0.0.0';

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`LaNote API listening on http://${hostname}:${info.port}`);
});

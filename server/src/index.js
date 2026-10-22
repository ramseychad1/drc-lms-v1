import express from 'express';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from './migrate.js';
import { pool } from './db.js';
import { api } from './routes.js';

const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));
const CLIENT_DIR = fileURLToPath(new URL('../../client/dist', import.meta.url));

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '10kb' }));

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Extracted photos and slide renders never change for a given filename.
app.use('/content', express.static(CONTENT_DIR, { maxAge: '30d', immutable: true, fallthrough: false }));

if (existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR, { maxAge: '1h', index: false }));
  app.use((_req, res) => res.sendFile(`${CLIENT_DIR}/index.html`));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT) || 3000;
await migrate();
app.listen(port, '0.0.0.0', () => console.log(`Listening on :${port}`));

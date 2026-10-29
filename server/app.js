import express from 'express';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { migrate } from './db.js';
import authRoutes from './auth.js';
import catalog from './catalog.js';
import sales from './sales.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '200kb' }));

// Allow the separately hosted front end (comma-separated list). Leave unset when client and server share one domain.
const origins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
app.use('/api', cors({ origin: origins.length ? origins : false, maxAge: 86400 }));

app.get('/', (req, res) => res.json({ app: 'CeeEs API', ok: true }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Create tables on first request (works on serverless cold starts as well as on a normal server)
let ready;
export const init = () => (ready ||= migrate().catch(e => { ready = null; throw e; }));
app.use('/api', (req, res, next) => init().then(() => next(), next));
app.use('/api', authRoutes, catalog, sales);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
});

export default app;

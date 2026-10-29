import express from 'express';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { migrate } from './db.js';
import authRoutes from './auth.js';
import catalog from './catalog.js';
import sales from './sales.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '200kb' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));
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

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set'); process.exit(1); }
await migrate();
app.listen(process.env.PORT || 3000, () => console.log('CeeEs running on port ' + (process.env.PORT || 3000)));

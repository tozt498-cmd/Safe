import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { config } from './config.js';
import { initDb } from './db/index.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { messagesRouter } from './routes/messages.js';
import { attachWebSocket } from './ws/hub.js';

async function main() {
  await initDb();

  const app = express();
  app.set('trust proxy', 1); // derrière le proxy de Render → IP correcte pour le rate-limit
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'SafeMarket Optimiseur API' }));

  // Anti-brute-force sur l'authentification.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  });

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ressource introuvable.' }));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[api] erreur:', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  });

  const server = createServer(app);
  attachWebSocket(server);

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`\n  SafeMarket Optimiseur — API + WebSocket`);
    console.log(`  Port  : ${config.port}`);
    console.log(`  Base  : Postgres connecté\n`);
  });
}

main().catch((e) => {
  console.error('[fatal] démarrage impossible:', e);
  process.exit(1);
});

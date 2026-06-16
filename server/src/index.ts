import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { config } from './config.js';
import './db/index.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { messagesRouter } from './routes/messages.js';
import { attachWebSocket } from './ws/hub.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'SafeMarket Optimiseur API' }));

app.use('/api/auth', authRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/admin', adminRouter);

// 404 JSON
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ressource introuvable.' }));

// Gestionnaire d'erreurs JSON
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] erreur:', err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const server = createServer(app);
attachWebSocket(server);

// Écoute sur 0.0.0.0 (IPv4) pour que l'app (127.0.0.1) se connecte de façon fiable.
server.listen(config.port, '0.0.0.0', () => {
  console.log(`\n  SafeMarket Optimiseur — API + WebSocket`);
  console.log(`  HTTP  : http://127.0.0.1:${config.port}/api`);
  console.log(`  WS    : ws://127.0.0.1:${config.port}/ws\n`);
});

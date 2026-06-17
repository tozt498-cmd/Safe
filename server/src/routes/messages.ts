import { Router } from 'express';
import { one } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const messagesRouter = Router();

type BroadcastRow = {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'update' | 'important';
  blocking: number;
  created_at: string;
};

function toPayload(r: BroadcastRow) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    kind: r.type,
    blocking: !!r.blocking,
    createdAt: r.created_at,
  };
}

// GET /api/messages/latest — dernier message diffusé (rattrapage à la connexion).
messagesRouter.get('/latest', requireAuth, async (_req, res) => {
  const row = await one<BroadcastRow>(
    `SELECT id, title, body, type, blocking, created_at FROM broadcasts ORDER BY created_at DESC LIMIT 1`,
  );
  res.json({ message: row ? toPayload(row) : null });
});

// GET /api/messages/lockdown — état de blocage global (persistant, vérifié à chaque ouverture).
messagesRouter.get('/lockdown', requireAuth, async (_req, res) => {
  const row = await one<{ active: number; title: string; body: string; kind: string }>(
    `SELECT active, title, body, kind FROM lockdown WHERE id='current'`,
  );
  res.json({
    active: !!row?.active,
    title: row?.title ?? null,
    body: row?.body ?? null,
    kind: (row?.kind as 'info' | 'update' | 'important') ?? 'important',
  });
});

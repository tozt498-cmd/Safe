import { Router } from 'express';
import { db } from '../db/index.js';
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

// GET /api/messages/latest — dernier message diffusé (pour ceux qui se connectent après l'envoi).
messagesRouter.get('/latest', requireAuth, (_req, res) => {
  const row = db
    .prepare(`SELECT id, title, body, type, blocking, created_at FROM broadcasts ORDER BY created_at DESC LIMIT 1`)
    .get() as BroadcastRow | undefined;
  return res.json({ message: row ? toPayload(row) : null });
});

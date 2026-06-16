import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { generateKey } from '../utils/keys.js';
import { broadcast, onlineCount, type BroadcastPayload } from '../ws/hub.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// ---- Statistiques globales ------------------------------------------------
adminRouter.get('/stats', (_req, res) => {
  const users = db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number };
  const admins = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role='admin'`).get() as { n: number };
  const keysTotal = db.prepare(`SELECT COUNT(*) AS n FROM activation_keys`).get() as { n: number };
  const keysUsed = db.prepare(`SELECT COUNT(*) AS n FROM activation_keys WHERE status='used'`).get() as { n: number };
  const keysFree = db.prepare(`SELECT COUNT(*) AS n FROM activation_keys WHERE status='unused'`).get() as { n: number };
  return res.json({
    accounts: users.n,
    admins: admins.n,
    keysTotal: keysTotal.n,
    keysUsed: keysUsed.n,
    keysFree: keysFree.n,
    online: onlineCount(),
  });
});

// ---- Gestion des clés -----------------------------------------------------
adminRouter.get('/keys', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT k.id, k.key, k.type, k.status, k.note, k.created_at, k.used_at, u.email AS used_by_email
       FROM activation_keys k LEFT JOIN users u ON u.id = k.used_by
       ORDER BY k.created_at DESC`,
    )
    .all();
  return res.json({ keys: rows });
});

const genSchema = z.object({
  type: z.enum(['user', 'admin']).default('user'),
  count: z.number().int().min(1).max(100).default(1),
  note: z.string().max(200).optional(),
});

adminRouter.post('/keys', (req, res) => {
  const parsed = genSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' });
  const { type, count, note } = parsed.data;

  const insert = db.prepare(
    `INSERT INTO activation_keys (id, key, type, status, note) VALUES (?, ?, ?, 'unused', ?)`,
  );
  const created: string[] = [];
  const tx = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const key = generateKey();
      insert.run(crypto.randomUUID(), key, type, note ?? null);
      created.push(key);
    }
  });
  tx();
  return res.status(201).json({ created, type });
});

adminRouter.post('/keys/:id/revoke', (req, res) => {
  const info = db
    .prepare(`UPDATE activation_keys SET status='revoked' WHERE id = ? AND status != 'used'`)
    .run(req.params.id);
  if (info.changes === 0)
    return res
      .status(400)
      .json({ error: 'Clé introuvable ou déjà utilisée (révoquez plutôt le compte associé).' });
  return res.json({ ok: true });
});

// ---- Gestion des comptes --------------------------------------------------
adminRouter.get('/accounts', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.role, u.status, u.hwid, u.hwid_label, u.hwid_registered_at, u.created_at,
              k.key AS activation_key
       FROM users u LEFT JOIN activation_keys k ON k.used_by = u.id
       ORDER BY u.created_at DESC`,
    )
    .all();
  return res.json({ accounts: rows });
});

// Délier l'appareil (HWID) — l'utilisateur pourra reconnecter sur un nouveau PC.
adminRouter.post('/accounts/:id/reset-hwid', (req, res) => {
  const info = db
    .prepare(`UPDATE users SET hwid=NULL, hwid_label=NULL, hwid_registered_at=NULL WHERE id = ?`)
    .run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Compte introuvable.' });
  return res.json({ ok: true });
});

const statusSchema = z.object({ status: z.enum(['active', 'revoked']) });

adminRouter.post('/accounts/:id/status', (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Statut invalide.' });
  if (req.params.id === req.user!.id)
    return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre statut.' });
  const info = db
    .prepare(`UPDATE users SET status = ? WHERE id = ?`)
    .run(parsed.data.status, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Compte introuvable.' });
  return res.json({ ok: true });
});

// ---- Diffusion de messages ------------------------------------------------
const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis.').max(120),
  body: z.string().trim().min(1, 'Message requis.').max(2000),
  kind: z.enum(['info', 'update', 'important']).default('info'),
  blocking: z.boolean().default(false),
});

adminRouter.post('/broadcast', (req, res) => {
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' });
  const { title, body, kind, blocking } = parsed.data;

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO broadcasts (id, title, body, type, blocking, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, title, body, kind, blocking ? 1 : 0, req.user!.id);

  const row = db
    .prepare(`SELECT created_at FROM broadcasts WHERE id = ?`)
    .get(id) as { created_at: string };

  const payload: BroadcastPayload = {
    id,
    title,
    body,
    kind,
    blocking,
    createdAt: row.created_at,
  };
  broadcast(payload);
  return res.status(201).json({ message: payload, delivered: onlineCount() });
});

adminRouter.delete('/broadcasts/:id', (req, res) => {
  const info = db.prepare(`DELETE FROM broadcasts WHERE id = ?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Message introuvable.' });
  return res.json({ ok: true });
});

adminRouter.get('/broadcasts', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT b.id, b.title, b.body, b.type, b.blocking, b.created_at, u.email AS sender
       FROM broadcasts b LEFT JOIN users u ON u.id = b.created_by
       ORDER BY b.created_at DESC LIMIT 100`,
    )
    .all();
  return res.json({ broadcasts: rows });
});

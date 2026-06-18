import { Router } from 'express';
import { z } from 'zod';
import { one, all, run } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { generateKey } from '../utils/keys.js';
import { broadcast, broadcastLockdown, onlineCount, type BroadcastPayload } from '../ws/hub.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// ---- Statistiques globales ------------------------------------------------
adminRouter.get('/stats', async (_req, res) => {
  const count = async (sql: string) => Number((await one<{ n: string }>(sql))?.n ?? 0);
  res.json({
    accounts: await count(`SELECT COUNT(*)::int AS n FROM users`),
    admins: await count(`SELECT COUNT(*)::int AS n FROM users WHERE role='admin'`),
    keysTotal: await count(`SELECT COUNT(*)::int AS n FROM activation_keys`),
    keysUsed: await count(`SELECT COUNT(*)::int AS n FROM activation_keys WHERE status='used'`),
    keysFree: await count(`SELECT COUNT(*)::int AS n FROM activation_keys WHERE status='unused'`),
    online: onlineCount(),
  });
});

// ---- Gestion des clés -----------------------------------------------------
adminRouter.get('/keys', async (_req, res) => {
  const keys = await all(
    `SELECT k.id, k.key, k.type, k.status, k.note, k.created_at, k.used_at, u.email AS used_by_email
     FROM activation_keys k LEFT JOIN users u ON u.id = k.used_by
     ORDER BY k.created_at DESC`,
  );
  res.json({ keys });
});

const genSchema = z.object({
  type: z.enum(['user', 'admin']).default('user'),
  count: z.number().int().min(1).max(100).default(1),
  note: z.string().max(200).optional(),
});

adminRouter.post('/keys', async (req, res) => {
  const parsed = genSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' });
  const { type, count, note } = parsed.data;

  const created: string[] = [];
  for (let i = 0; i < count; i++) {
    const key = generateKey();
    await run(
      `INSERT INTO activation_keys (id, key, type, status, note) VALUES ($1, $2, $3, 'unused', $4)`,
      [crypto.randomUUID(), key, type, note ?? null],
    );
    created.push(key);
  }
  res.status(201).json({ created, type });
});

adminRouter.post('/keys/:id/revoke', async (req, res) => {
  const changes = await run(
    `UPDATE activation_keys SET status='revoked' WHERE id = $1 AND status != 'used'`,
    [req.params.id],
  );
  if (changes === 0)
    return res
      .status(400)
      .json({ error: 'Clé introuvable ou déjà utilisée (révoquez plutôt le compte associé).' });
  res.json({ ok: true });
});

// Suppression DÉFINITIVE d'une clé.
adminRouter.delete('/keys/:id', async (req, res) => {
  const changes = await run(`DELETE FROM activation_keys WHERE id = $1`, [req.params.id]);
  if (changes === 0) return res.status(404).json({ error: 'Clé introuvable.' });
  res.json({ ok: true });
});

// ---- Gestion des comptes --------------------------------------------------
adminRouter.get('/accounts', async (_req, res) => {
  const accounts = await all(
    `SELECT u.id, u.email, u.role, u.status, u.hwid, u.hwid_label, u.hwid_registered_at, u.created_at,
            k.key AS activation_key
     FROM users u LEFT JOIN activation_keys k ON k.used_by = u.id
     ORDER BY u.created_at DESC`,
  );
  res.json({ accounts });
});

adminRouter.post('/accounts/:id/reset-hwid', async (req, res) => {
  const changes = await run(
    `UPDATE users SET hwid=NULL, hwid_label=NULL, hwid_registered_at=NULL WHERE id = $1`,
    [req.params.id],
  );
  if (changes === 0) return res.status(404).json({ error: 'Compte introuvable.' });
  res.json({ ok: true });
});

const statusSchema = z.object({ status: z.enum(['active', 'revoked']) });

adminRouter.post('/accounts/:id/status', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Statut invalide.' });
  if (req.params.id === req.user!.id)
    return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre statut.' });
  const changes = await run(`UPDATE users SET status = $1 WHERE id = $2`, [
    parsed.data.status,
    req.params.id,
  ]);
  if (changes === 0) return res.status(404).json({ error: 'Compte introuvable.' });
  res.json({ ok: true });
});

// ---- Diffusion de messages ------------------------------------------------
const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis.').max(120),
  body: z.string().trim().min(1, 'Message requis.').max(2000),
  kind: z.enum(['info', 'update', 'important']).default('info'),
  blocking: z.boolean().default(false),
});

adminRouter.post('/broadcast', async (req, res) => {
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' });
  const { title, body, kind, blocking } = parsed.data;

  const id = crypto.randomUUID();
  const ins = await one<{ created_at: string }>(
    `INSERT INTO broadcasts (id, title, body, type, blocking, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING created_at`,
    [id, title, body, kind, blocking ? 1 : 0, req.user!.id],
  );

  const payload: BroadcastPayload = {
    id,
    title,
    body,
    kind,
    blocking,
    createdAt: ins?.created_at ?? new Date().toISOString(),
  };

  if (blocking) {
    // Active le blocage global (persistant). L'overlay reste jusqu'au déblocage admin.
    await run(
      `UPDATE lockdown SET active=1, title=$1, body=$2, kind=$3, updated_at=now() WHERE id='current'`,
      [title, body, kind],
    );
    broadcastLockdown({ active: true, title, body, kind });
  } else {
    broadcast(payload);
  }
  res.status(201).json({ message: payload, delivered: onlineCount() });
});

// Lève le blocage global (admin uniquement).
adminRouter.post('/lockdown/clear', async (_req, res) => {
  await run(`UPDATE lockdown SET active=0, updated_at=now() WHERE id='current'`);
  broadcastLockdown({ active: false });
  res.json({ ok: true });
});

// Statut du blocage (pour le panneau admin).
adminRouter.get('/lockdown', async (_req, res) => {
  const row = await one<{ active: number; title: string; body: string; kind: string; updated_at: string }>(
    `SELECT active, title, body, kind, updated_at FROM lockdown WHERE id='current'`,
  );
  res.json({
    active: !!row?.active,
    title: row?.title ?? null,
    body: row?.body ?? null,
    kind: row?.kind ?? null,
    updatedAt: row?.updated_at ?? null,
  });
});

adminRouter.delete('/broadcasts/:id', async (req, res) => {
  const changes = await run(`DELETE FROM broadcasts WHERE id = $1`, [req.params.id]);
  if (changes === 0) return res.status(404).json({ error: 'Message introuvable.' });
  res.json({ ok: true });
});

adminRouter.get('/broadcasts', async (_req, res) => {
  const broadcasts = await all(
    `SELECT b.id, b.title, b.body, b.type, b.blocking, b.created_at, u.email AS sender
     FROM broadcasts b LEFT JOIN users u ON u.id = b.created_by
     ORDER BY b.created_at DESC LIMIT 100`,
  );
  res.json({ broadcasts });
});

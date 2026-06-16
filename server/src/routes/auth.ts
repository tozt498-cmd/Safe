import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { isValidKeyFormat } from '../utils/keys.js';
import { requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const emailSchema = z.string().trim().toLowerCase().email('Adresse e-mail invalide.');
const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(200);
const hwidSchema = z.string().min(8, 'Identifiant matériel manquant.').max(200);

const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    key: z.string().trim(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirm'],
  });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis.'),
  hwid: hwidSchema,
  hwidLabel: z.string().max(120).optional(),
});

type KeyRow = {
  id: string;
  key: string;
  type: 'user' | 'admin';
  status: 'unused' | 'used' | 'revoked';
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  status: 'active' | 'revoked';
  hwid: string | null;
};

function publicUser(u: { id: string; email: string; role: string }) {
  const key = db
    .prepare(`SELECT key, type FROM activation_keys WHERE used_by = ?`)
    .get(u.id) as { key: string; type: string } | undefined;
  const full = db
    .prepare(
      `SELECT id, email, role, status, hwid, hwid_label, hwid_registered_at, created_at
       FROM users WHERE id = ?`,
    )
    .get(u.id) as Record<string, unknown>;
  return {
    id: full.id,
    email: full.email,
    role: full.role,
    status: full.status,
    hwid: full.hwid,
    hwidLabel: full.hwid_label,
    hwidRegisteredAt: full.hwid_registered_at,
    createdAt: full.created_at,
    key: key?.key ?? null,
    keyType: key?.type ?? null,
  };
}

// POST /api/auth/signup — crée un compte lié à une clé d'activation valide.
authRouter.post('/signup', (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' });
  }
  const { email, password, key } = parsed.data;
  const normKey = key.toUpperCase();

  if (!isValidKeyFormat(normKey)) {
    return res.status(400).json({ error: 'Format de clé invalide (XXXX-XXXX-XXXX-XXXX).' });
  }

  const keyRow = db
    .prepare(`SELECT id, key, type, status FROM activation_keys WHERE key = ? COLLATE NOCASE`)
    .get(normKey) as KeyRow | undefined;

  if (!keyRow) return res.status(400).json({ error: 'Clé d\'activation introuvable.' });
  if (keyRow.status === 'revoked')
    return res.status(400).json({ error: 'Cette clé a été révoquée.' });
  if (keyRow.status === 'used')
    return res.status(409).json({ error: 'Cette clé est déjà utilisée par un autre compte.' });

  const existing = db
    .prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`)
    .get(email);
  if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' });

  const userId = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 12);

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')`,
    ).run(userId, email, hash, keyRow.type);
    db.prepare(
      `UPDATE activation_keys SET status = 'used', used_by = ?, used_at = datetime('now') WHERE id = ?`,
    ).run(userId, keyRow.id);
  });
  tx();

  return res.status(201).json({
    message: 'Compte créé. Connectez-vous pour lier cet appareil.',
    user: publicUser({ id: userId, email, role: keyRow.type }),
  });
});

// POST /api/auth/login — connexion + verrou matériel à 1 appareil.
authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' });
  }
  const { email, password, hwid, hwidLabel } = parsed.data;

  const user = db
    .prepare(
      `SELECT id, email, password_hash, role, status, hwid FROM users WHERE email = ? COLLATE NOCASE`,
    )
    .get(email) as UserRow | undefined;

  // Réponse générique pour ne pas révéler l'existence d'un compte.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
  }
  if (user.status === 'revoked') {
    return res.status(403).json({ error: 'Ce compte a été révoqué. Contactez l\'administrateur.' });
  }

  if (!user.hwid) {
    // Première connexion : on lie l'appareil de façon permanente.
    db.prepare(
      `UPDATE users SET hwid = ?, hwid_label = ?, hwid_registered_at = datetime('now') WHERE id = ?`,
    ).run(hwid, hwidLabel ?? null, user.id);
    user.hwid = hwid;
  } else if (user.hwid !== hwid) {
    return res.status(403).json({
      error: 'Ce compte est déjà lié à un autre appareil. Contactez l\'administrateur.',
      code: 'HWID_LOCKED',
    });
  }

  const token = signToken(user.id, hwid);
  return res.json({
    token,
    user: publicUser({ id: user.id, email: user.email, role: user.role }),
  });
});

// GET /api/auth/me — profil de l'utilisateur connecté.
authRouter.get('/me', requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user!) });
});

// POST /api/auth/logout — côté client on jette le token ; endpoint fourni pour cohérence.
authRouter.post('/logout', requireAuth, (_req, res) => {
  return res.json({ ok: true });
});

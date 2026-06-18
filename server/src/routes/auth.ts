import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { one, run, tx } from '../db/index.js';
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
    key: z.string().trim().optional().default(''),
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

type KeyRow = { id: string; key: string; type: 'user' | 'admin'; status: 'unused' | 'used' | 'revoked' };
type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  status: 'active' | 'revoked';
  hwid: string | null;
};

async function publicUser(userId: string) {
  const full = await one<Record<string, unknown>>(
    `SELECT id, email, role, status, hwid, hwid_label, hwid_registered_at, created_at
     FROM users WHERE id = $1`,
    [userId],
  );
  const key = await one<{ key: string; type: string }>(
    `SELECT key, type FROM activation_keys WHERE used_by = $1`,
    [userId],
  );
  return {
    id: full?.id,
    email: full?.email,
    role: full?.role,
    status: full?.status,
    hwid: full?.hwid,
    hwidLabel: full?.hwid_label,
    hwidRegisteredAt: full?.hwid_registered_at,
    createdAt: full?.created_at,
    key: key?.key ?? null,
    keyType: key?.type ?? null,
    plan: key?.type || full?.role === 'admin' ? 'pro' : 'free',
  };
}

// POST /api/auth/signup — crée un compte lié à une clé d'activation valide.
authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' });
  }
  const { email, password, key } = parsed.data;
  const normKey = key.toUpperCase();

  // Clé optionnelle : sans clé -> compte GRATUIT (limité). Avec clé -> compte PRO.
  let keyRow: KeyRow | undefined;
  let role: 'user' | 'admin' = 'user';
  if (normKey) {
    if (!isValidKeyFormat(normKey)) {
      return res.status(400).json({ error: 'Format de clé invalide (XXXX-XXXX-XXXX-XXXX).' });
    }
    keyRow = await one<KeyRow>(`SELECT id, key, type, status FROM activation_keys WHERE key = $1`, [normKey]);
    if (!keyRow) return res.status(400).json({ error: 'Clé d\'activation introuvable.' });
    if (keyRow.status === 'revoked') return res.status(400).json({ error: 'Cette clé a été révoquée.' });
    if (keyRow.status === 'used')
      return res.status(409).json({ error: 'Cette clé est déjà utilisée par un autre compte.' });
    role = keyRow.type;
  }

  const existing = await one(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' });

  const userId = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 12);

  try {
    await tx(async (c) => {
      await c.query(
        `INSERT INTO users (id, email, password_hash, role, status) VALUES ($1, $2, $3, $4, 'active')`,
        [userId, email, hash, role],
      );
      if (keyRow) {
        await c.query(
          `UPDATE activation_keys SET status = 'used', used_by = $1, used_at = now() WHERE id = $2`,
          [userId, keyRow.id],
        );
      }
    });
  } catch {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' });
  }

  return res.status(201).json({
    message: 'Compte créé. Connectez-vous pour lier cet appareil.',
    user: await publicUser(userId),
  });
});

// POST /api/auth/login — connexion + verrou matériel à 1 appareil.
authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' });
  }
  const { email, password, hwid, hwidLabel } = parsed.data;

  const user = await one<UserRow>(
    `SELECT id, email, password_hash, role, status, hwid FROM users WHERE email = $1`,
    [email],
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
  }
  if (user.status === 'revoked') {
    return res.status(403).json({ error: 'Ce compte a été révoqué. Contactez l\'administrateur.' });
  }

  if (!user.hwid) {
    await run(
      `UPDATE users SET hwid = $1, hwid_label = $2, hwid_registered_at = now() WHERE id = $3`,
      [hwid, hwidLabel ?? null, user.id],
    );
    user.hwid = hwid;
  } else if (user.hwid !== hwid) {
    return res.status(403).json({
      error: 'Ce compte est déjà lié à un autre appareil. Contactez l\'administrateur.',
      code: 'HWID_LOCKED',
    });
  }

  const token = signToken(user.id, hwid);
  return res.json({ token, user: await publicUser(user.id) });
});

// GET /api/auth/me — profil de l'utilisateur connecté.
authRouter.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: await publicUser(req.user!.id) });
});

// POST /api/auth/redeem — un compte gratuit débloque le Pro avec une clé valide.
authRouter.post('/redeem', requireAuth, async (req, res) => {
  const normKey = String((req.body as { key?: string })?.key ?? '').toUpperCase().trim();
  if (!isValidKeyFormat(normKey)) return res.status(400).json({ error: 'Format de clé invalide.' });

  const already = await one(`SELECT id FROM activation_keys WHERE used_by = $1`, [req.user!.id]);
  if (already) return res.status(400).json({ error: 'Ce compte est déjà lié à une clé.' });

  const keyRow = await one<KeyRow>(`SELECT id, key, type, status FROM activation_keys WHERE key = $1`, [normKey]);
  if (!keyRow) return res.status(400).json({ error: 'Clé introuvable.' });
  if (keyRow.status === 'revoked') return res.status(400).json({ error: 'Cette clé a été révoquée.' });
  if (keyRow.status === 'used') return res.status(409).json({ error: 'Cette clé est déjà utilisée.' });

  await tx(async (c) => {
    await c.query(`UPDATE activation_keys SET status='used', used_by=$1, used_at=now() WHERE id=$2`, [req.user!.id, keyRow.id]);
    await c.query(`UPDATE users SET role=$1 WHERE id=$2`, [keyRow.type, req.user!.id]);
  });
  return res.json({ user: await publicUser(req.user!.id), message: 'Licence activée ! Tout est débloqué.' });
});

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, (_req, res) => {
  return res.json({ ok: true });
});

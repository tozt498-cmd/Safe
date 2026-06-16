import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'revoked';
  hwid: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface TokenPayload {
  sub: string;
  hwid: string;
}

export function signToken(userId: string, hwid: string): string {
  return jwt.sign({ sub: userId, hwid }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Authentifie la requête. Vérifie TOUJOURS côté serveur :
 *  - la validité du JWT
 *  - que le compte existe et est actif
 *  - que le HWID du token correspond au HWID enregistré sur le compte (verrou 1 appareil)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });

  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }

  const user = db
    .prepare(`SELECT id, email, role, status, hwid FROM users WHERE id = ?`)
    .get(payload.sub) as AuthUser | undefined;

  if (!user) return res.status(401).json({ error: 'Compte introuvable.' });
  if (user.status === 'revoked')
    return res.status(403).json({ error: 'Ce compte a été révoqué. Contactez l\'administrateur.' });

  // Verrou matériel : le HWID du token doit correspondre à celui enregistré.
  if (!user.hwid || user.hwid !== payload.hwid) {
    return res.status(403).json({
      error: 'Ce compte est lié à un autre appareil. Contactez l\'administrateur.',
      code: 'HWID_MISMATCH',
    });
  }

  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  next();
}

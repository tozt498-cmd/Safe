import { app } from 'electron';

/**
 * Vérification d'entitlement (Pro) CÔTÉ SERVEUR.
 *
 * La source de vérité du statut Pro est l'API (le champ `plan` renvoyé par
 * /auth/me, calculé par le serveur selon la clé liée au compte). Le processus
 * principal interroge le serveur avec le token de session avant d'autoriser les
 * fonctionnalités payantes : on ne peut donc pas débloquer le Pro en modifiant
 * uniquement le code côté client.
 */

const PROD_API = 'https://safeoptimiseur.onrender.com';
const DEV_API = 'http://127.0.0.1:4317';
const API_BASE = `${app.isPackaged ? PROD_API : DEV_API}/api`;

const FRESH_MS = 60_000; // ré-interroge le serveur au plus une fois par minute
const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000; // tolérance hors-ligne : 3 jours

let token: string | null = null;
let cache: { pro: boolean; at: number } | null = null;

export function setToken(value: string | null): void {
  token = value || null;
  // Tout changement de token réinitialise le cache (re-vérification immédiate).
  cache = null;
}

/** Renvoie true si le compte courant est Pro, confirmé par le serveur. */
export async function isPro(): Promise<boolean> {
  if (!token) return false;

  const now = Date.now();
  if (cache && now - cache.at < FRESH_MS) return cache.pro;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      cache = { pro: false, at: now };
      return false;
    }
    if (!res.ok) throw new Error('server');
    const data = (await res.json()) as { user?: { plan?: string; role?: string } };
    const pro = data.user?.plan === 'pro' || data.user?.role === 'admin';
    cache = { pro, at: now };
    return pro;
  } catch {
    // Serveur injoignable : on tolère le dernier statut Pro connu pendant la grâce
    // (évite de bloquer un client payant lors d'une coupure), sinon on refuse.
    if (cache && cache.pro && now - cache.at < OFFLINE_GRACE_MS) return true;
    return false;
  }
}

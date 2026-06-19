const BASE = window.api.config.apiUrl;

let token: string | null = localStorage.getItem('sm.token');
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('sm.token', t);
  else localStorage.removeItem('sm.token');
}

export function getAuthToken(): string | null {
  return token;
}

// Sauvegarde locale du profil : permet de restaurer la session instantanément au
// lancement et de rester connecté même si le serveur est momentanément injoignable.
const USER_KEY = 'sm.user';

export function setCachedUser(user: unknown | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function getCachedUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Serveur injoignable. Vérifiez que le backend est démarré.', 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* corps vide */
  }

  if (!res.ok) {
    const body = data as { error?: string; code?: string } | null;
    const err = new ApiError(body?.error || 'Une erreur est survenue.', res.status, body?.code);
    if (res.status === 401 || err.code === 'HWID_MISMATCH' || err.code === 'HWID_LOCKED') {
      onUnauthorized?.();
    }
    throw err;
  }

  return data as T;
}

export const get = <T>(path: string) => apiFetch<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
export const del = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' });

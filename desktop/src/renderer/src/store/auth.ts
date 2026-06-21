import { create } from 'zustand';
import {
  get,
  post,
  setAuthToken,
  setUnauthorizedHandler,
  getAuthToken,
  setCachedUser,
  getCachedUser,
  ApiError,
} from '../lib/api';
import { connectWs, disconnectWs } from '../lib/ws';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  status: 'loading' | 'authed' | 'guest';
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, confirm: string, key: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  refreshToken: () => Promise<void>;
  redeem: (key: string) => Promise<void>;
}

async function getHwid() {
  try {
    return await window.api.app.hwid();
  } catch {
    return { hwid: 'unknown-device', label: 'PC' };
  }
}

// Transmet le token au processus principal, qui valide le statut Pro côté serveur
// avant d'autoriser les fonctionnalités payantes.
function syncMainToken(token: string | null) {
  void window.api.app.setToken(token).catch(() => {});
}

// Rafraîchissement automatique du token pendant que l'app reste ouverte
// (prolonge la session sans aucune action de l'utilisateur).
let refreshTimer: ReturnType<typeof setInterval> | null = null;
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => void useAuth.getState().refreshToken(), 12 * 60 * 60 * 1000);
}

export const useAuth = create<AuthState>((set, getState) => ({
  user: null,
  status: 'loading',

  init: async () => {
    setUnauthorizedHandler(() => getState().logout());
    const token = getAuthToken();
    if (!token) {
      set({ status: 'guest', user: null });
      return;
    }

    // Restauration optimiste : on rouvre tout de suite la session sauvegardée,
    // sans attendre le serveur (utile quand Render se réveille ou est lent).
    const cached = getCachedUser<User>();
    if (cached) set({ user: cached, status: 'authed' });

    try {
      // Prolonge la session (nouveau token) + récupère le profil à jour.
      const res = await post<{ token: string; user: User }>('/auth/refresh', {});
      setAuthToken(res.token);
      setCachedUser(res.user);
      syncMainToken(res.token);
      set({ user: res.user, status: 'authed' });
      connectWs(res.token);
      startAutoRefresh();
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      if (status === 401 || status === 403) {
        // Auth réellement invalide (token expiré, compte révoqué, autre appareil) :
        // là seulement on efface la session sauvegardée.
        setAuthToken(null);
        setCachedUser(null);
        syncMainToken(null);
        set({ status: 'guest', user: null });
      } else if (cached) {
        // Tout autre souci (serveur injoignable, 404/500, réveil de Render…) :
        // on NE déconnecte JAMAIS, on garde la session sauvegardée.
        syncMainToken(token);
        set({ user: cached, status: 'authed' });
        connectWs(token);
        startAutoRefresh();
      } else {
        set({ status: 'guest', user: null });
      }
    }
  },

  login: async (email, password) => {
    const { hwid, label } = await getHwid();
    const res = await post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
      hwid,
      hwidLabel: label,
    });
    setAuthToken(res.token);
    setCachedUser(res.user);
    syncMainToken(res.token);
    set({ user: res.user, status: 'authed' });
    connectWs(res.token);
    startAutoRefresh();
  },

  signup: async (email, password, confirm, key) => {
    await post('/auth/signup', { email, password, confirm, key });
    // Première connexion : lie l'appareil et ouvre la session.
    await getState().login(email, password);
  },

  logout: () => {
    stopAutoRefresh();
    disconnectWs();
    setAuthToken(null);
    setCachedUser(null);
    syncMainToken(null);
    set({ user: null, status: 'guest' });
  },

  refresh: async () => {
    try {
      const { user } = await get<{ user: User }>('/auth/me');
      setCachedUser(user);
      set({ user });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) getState().logout();
    }
  },

  // Renouvelle le token en arrière-plan (timer). N'efface la session que sur une
  // vraie erreur d'auth ; un problème réseau est ignoré.
  refreshToken: async () => {
    if (!getAuthToken()) return;
    try {
      const res = await post<{ token: string; user: User }>('/auth/refresh', {});
      setAuthToken(res.token);
      setCachedUser(res.user);
      syncMainToken(res.token);
      set({ user: res.user });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) getState().logout();
    }
  },

  redeem: async (key) => {
    const res = await post<{ user: User }>('/auth/redeem', { key });
    setCachedUser(res.user);
    // Le compte devient Pro : on réinitialise le cache d'entitlement côté principal.
    syncMainToken(getAuthToken());
    set({ user: res.user });
  },
}));

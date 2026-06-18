import { create } from 'zustand';
import { get, post, setAuthToken, setUnauthorizedHandler, getAuthToken, ApiError } from '../lib/api';
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
  redeem: (key: string) => Promise<void>;
}

async function getHwid() {
  try {
    return await window.api.app.hwid();
  } catch {
    return { hwid: 'unknown-device', label: 'PC' };
  }
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
    try {
      const { user } = await get<{ user: User }>('/auth/me');
      set({ user, status: 'authed' });
      connectWs(token);
    } catch {
      setAuthToken(null);
      set({ status: 'guest', user: null });
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
    set({ user: res.user, status: 'authed' });
    connectWs(res.token);
  },

  signup: async (email, password, confirm, key) => {
    await post('/auth/signup', { email, password, confirm, key });
    // Première connexion : lie l'appareil et ouvre la session.
    await getState().login(email, password);
  },

  logout: () => {
    disconnectWs();
    setAuthToken(null);
    set({ user: null, status: 'guest' });
  },

  refresh: async () => {
    try {
      const { user } = await get<{ user: User }>('/auth/me');
      set({ user });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) getState().logout();
    }
  },

  redeem: async (key) => {
    const res = await post<{ user: User }>('/auth/redeem', { key });
    set({ user: res.user });
  },
}));

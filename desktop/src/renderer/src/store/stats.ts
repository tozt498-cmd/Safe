import { create } from 'zustand';

// Statistiques cumulées locales (gamification) : total nettoyé, RAM libérée,
// nombre d'optimisations et série de jours consécutifs.
interface Stats {
  totalCleanedBytes: number;
  ramFreedMB: number;
  optimizations: number;
  lastOptim: string | null;
  streak: number;
}

interface StatsState extends Stats {
  record: (d: { freedBytes?: number; ramMB?: number }) => void;
}

const KEY = 'sm.stats';
const DEFAULTS: Stats = {
  totalCleanedBytes: 0,
  ramFreedMB: 0,
  optimizations: 0,
  lastOptim: null,
  streak: 0,
};

function load(): Stats {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}
function save(s: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export const useStats = create<StatsState>((set, get) => ({
  ...load(),
  record: ({ freedBytes = 0, ramMB = 0 }) => {
    const cur = get();
    const today = dayKey();
    let streak = cur.streak;
    if (cur.lastOptim !== today) {
      const yesterday = dayKey(new Date(Date.now() - 86400000));
      streak = cur.lastOptim === yesterday ? cur.streak + 1 : 1;
    }
    const next: Stats = {
      totalCleanedBytes: cur.totalCleanedBytes + freedBytes,
      ramFreedMB: cur.ramFreedMB + ramMB,
      optimizations: cur.optimizations + 1,
      lastOptim: today,
      streak,
    };
    save(next);
    set(next);
  },
}));

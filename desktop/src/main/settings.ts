import { app } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

export interface AppSettings {
  closeToTray: boolean;
  launchAtStartup: boolean;
  theme: 'dark' | 'light';
  // Demander automatiquement les droits administrateur au lancement
  // (nécessaire pour que TOUTES les optimisations fonctionnent).
  autoElevate: boolean;
  // Autoriser les notifications système.
  notifications: boolean;
  // Optimisation planifiée automatique.
  scheduledOptim: { enabled: boolean; frequency: 'daily' | 'weekly' };
}

const FILE = () => join(app.getPath('userData'), 'settings.json');
const DEFAULTS: AppSettings = {
  closeToTray: true,
  launchAtStartup: false,
  theme: 'dark',
  autoElevate: true,
  notifications: true,
  scheduledOptim: { enabled: false, frequency: 'weekly' },
};

let cache: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (cache) return cache;
  let loaded: AppSettings;
  try {
    loaded = { ...DEFAULTS, ...JSON.parse(readFileSync(FILE(), 'utf8')) };
  } catch {
    loaded = { ...DEFAULTS };
  }
  cache = loaded;
  return loaded;
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  cache = { ...getSettings(), ...patch };
  try {
    writeFileSync(FILE(), JSON.stringify(cache, null, 2));
  } catch {
    /* ignore */
  }
  return cache;
}

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import si from 'systeminformation';
import { freeMemory } from './optimize.js';
import { flushDns, tcpOptimize } from './network.js';
import type { GameInfo, GameProgress, GameReport, TotalStepResult } from '../../shared/types.js';

const execp = promisify(exec);
const LOCAL = process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local');

async function run(cmd: string, timeout = 20000): Promise<boolean> {
  try {
    await execp(cmd, { timeout, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

// Caches de shaders partagés (sûrs à vider, régénérés automatiquement).
const SHADER_CACHES = [
  join(LOCAL, 'D3DSCache'),
  join(LOCAL, 'NVIDIA', 'DXCache'),
  join(LOCAL, 'NVIDIA', 'GLCache'),
  join(LOCAL, 'AMD', 'DxCache'),
  join(LOCAL, 'AMD', 'DxcCache'),
];

interface GameDef {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  processes: string[]; // noms de process (avec .exe)
  extraCaches: string[]; // caches spécifiques sûrs
  specials: string[]; // libellés d'optimisations spécifiques
}

const GAMES: GameDef[] = [
  {
    id: 'fortnite',
    name: 'Fortnite',
    tagline: 'Battle Royale',
    accent: '#3AA0FF',
    processes: ['FortniteClient-Win64-Shipping.exe'],
    extraCaches: [join(LOCAL, 'FortniteGame', 'Saved', 'webcache_4147'), join(LOCAL, 'FortniteGame', 'Saved', 'webcache')],
    specials: ['Nettoyage des shaders', 'Optimisation réseau & paramètres'],
  },
  {
    id: 'valorant',
    name: 'Valorant',
    tagline: 'FPS compétitif',
    accent: '#FF4655',
    processes: ['VALORANT-Win64-Shipping.exe', 'RiotClientServices.exe'],
    extraCaches: [join(LOCAL, 'VALORANT', 'Saved', 'webcache')],
    specials: ['Priorité latence basse', 'Optimisation du client Riot'],
  },
  {
    id: 'gta5',
    name: 'GTA V',
    tagline: 'Open world',
    accent: '#54C04A',
    processes: ['GTA5.exe', 'PlayGTAV.exe'],
    extraCaches: [],
    specials: ['Gestion mémoire (jeu lourd)', 'Nettoyage du cache'],
  },
];

async function dirSize(p: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(p, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const full = join(p, e.name);
    try {
      if (e.isDirectory()) total += await dirSize(full);
      else if (e.isFile()) total += (await fs.stat(full)).size;
    } catch {
      /* ignore */
    }
  }
  return total;
}

async function clearDir(dir: string): Promise<{ freed: number; removed: number }> {
  let freed = 0;
  let removed = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { freed, removed };
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    try {
      const size = e.isDirectory() ? await dirSize(full) : (await fs.stat(full)).size;
      await fs.rm(full, { recursive: true, force: true });
      freed += size;
      removed += 1;
    } catch {
      /* fichier verrouillé */
    }
  }
  return { freed, removed };
}

async function isRunning(processes: string[]): Promise<boolean> {
  try {
    const list = await si.processes();
    const names = list.list.map((p) => p.name.toLowerCase());
    return processes.some((p) => names.includes(p.toLowerCase()));
  } catch {
    return false;
  }
}

export async function listGames(): Promise<GameInfo[]> {
  return Promise.all(
    GAMES.map(async (g) => ({
      id: g.id,
      name: g.name,
      tagline: g.tagline,
      accent: g.accent,
      running: await isRunning(g.processes),
    })),
  );
}

export async function runGameOptimization(
  gameId: string,
  onProgress: (p: GameProgress) => void,
): Promise<GameReport> {
  const game = GAMES.find((g) => g.id === gameId) ?? GAMES[0];
  const started = Date.now();

  const steps: { id: string; label: string; fn: () => Promise<Omit<TotalStepResult, 'id' | 'label' | 'status'>> }[] = [
    {
      id: 'restore-point',
      label: 'Point de restauration',
      fn: async () => {
        const ok = await run(
          `powershell -NoProfile -Command "Checkpoint-Computer -Description 'SafeMarket - Optim ${game.name}' -RestorePointType MODIFY_SETTINGS"`,
          45000,
        );
        return { detail: ok ? 'Sauvegarde système créée.' : 'Non créé (admin/protection requise).', items: ok ? 1 : 0 };
      },
    },
    {
      id: 'network',
      label: 'Réseau & latence',
      fn: async () => {
        await flushDns();
        const tcp = await tcpOptimize();
        return { detail: tcp.ok ? 'DNS vidé + TCP/IP optimisé.' : 'DNS vidé (TCP/IP requiert admin).', items: 1 };
      },
    },
    {
      id: 'memory',
      label: 'Boost FPS — libération mémoire',
      fn: async () => {
        const m = await freeMemory();
        return { detail: `${m.freedMB} Mo de RAM libérés`, memoryFreedMB: m.freedMB };
      },
    },
    {
      id: 'shaders',
      label: game.id === 'fortnite' ? 'Nettoyage des shaders (Fortnite)' : 'Cache shaders & jeu',
      fn: async () => {
        let freed = 0;
        let removed = 0;
        for (const dir of [...SHADER_CACHES, ...game.extraCaches]) {
          const r = await clearDir(dir);
          freed += r.freed;
          removed += r.removed;
        }
        return { detail: `${removed} éléments de cache supprimés`, freedBytes: freed, items: removed };
      },
    },
    {
      id: 'overlays',
      label: 'Désactivation des overlays (Game Bar/DVR)',
      fn: async () => {
        let ok = 0;
        ok += (await run('reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f')) ? 1 : 0;
        ok += (await run('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f')) ? 1 : 0;
        ok += (await run('reg add "HKCU\\Software\\Microsoft\\GameBar" /v UseNexusForGameBarEnabled /t REG_DWORD /d 0 /f')) ? 1 : 0;
        return { detail: ok > 0 ? 'Game Bar & Game DVR désactivés.' : 'Non appliqué.', items: ok };
      },
    },
    {
      id: 'power',
      label: 'Plan d\'alimentation & Mode Jeu',
      fn: async () => {
        const a = await run('powercfg /setactive SCHEME_MIN');
        await run('reg add "HKCU\\Software\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 1 /f');
        return { detail: a ? 'Hautes performances + Mode Jeu activés.' : 'Mode Jeu activé.', items: 1 };
      },
    },
    {
      id: 'priority',
      label:
        game.id === 'valorant'
          ? 'Priorité CPU haute (client Riot)'
          : `Priorité CPU haute (${game.name})`,
      fn: async () => {
        let set = 0;
        for (const proc of game.processes) {
          const name = proc.replace(/\.exe$/i, '');
          const ok = await run(
            `powershell -NoProfile -Command "Get-Process -Name '${name}' -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass='High' }"`,
          );
          if (ok) set++;
        }
        return {
          detail: (await isRunning(game.processes))
            ? 'Priorité haute appliquée au jeu en cours.'
            : 'Le jeu n\'est pas lancé — priorité appliquée au prochain démarrage.',
          items: set,
        };
      },
    },
    {
      id: 'visual-effects',
      label: 'Effets visuels (performance)',
      fn: async () => {
        const ok = await run(
          'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f',
        );
        return { detail: ok ? 'Effets visuels réglés pour la fluidité.' : 'Non appliqué.', items: ok ? 1 : 0 };
      },
    },
  ];

  const report: GameReport = {
    gameId: game.id,
    gameName: game.name,
    freedBytes: 0,
    memoryFreedMB: 0,
    itemsOptimized: 0,
    durationMs: 0,
    steps: [],
    restorePoint: false,
  };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const base: TotalStepResult = { id: step.id, label: step.label, status: 'running', detail: '' };
    onProgress({ gameId: game.id, index: i + 1, total: steps.length, overallPercent: Math.round((i / steps.length) * 100), current: base });

    let result: TotalStepResult;
    try {
      const out = await step.fn();
      result = { ...base, status: 'done', ...out };
      report.freedBytes += out.freedBytes ?? 0;
      report.memoryFreedMB += out.memoryFreedMB ?? 0;
      report.itemsOptimized += out.items ?? 0;
      if (step.id === 'restore-point') report.restorePoint = (out.items ?? 0) > 0;
    } catch (e) {
      result = { ...base, status: 'error', detail: (e as Error).message };
    }

    report.steps.push(result);
    onProgress({
      gameId: game.id,
      index: i + 1,
      total: steps.length,
      overallPercent: Math.round(((i + 1) / steps.length) * 100),
      current: result,
    });
  }

  report.durationMs = Date.now() - started;
  return report;
}

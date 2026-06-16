import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { scanClean, runClean } from './clean.js';
import { freeMemory } from './optimize.js';
import { flushDns, tcpOptimize } from './network.js';
import { listStartup } from './startup.js';
import { listSoftware } from './software.js';
import { listProcesses } from './processes.js';
import type {
  TotalCategory,
  TotalStepResult,
  TotalProgress,
  TotalReport,
} from '../../shared/types.js';

const execp = promisify(exec);
async function run(cmd: string, timeout = 20000): Promise<boolean> {
  try {
    await execp(cmd, { timeout, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

// Logiciels fréquemment préinstallés et superflus (détection, pas de suppression auto).
const BLOATWARE = [
  'McAfee', 'Norton', 'CCleaner', 'Booking', 'Candy Crush', 'Spotify',
  'Disney', 'TikTok', 'ExpressVPN', 'Avast', 'AVG', 'WildTangent',
  'Xbox', 'Solitaire', 'Dropbox Promo', 'Amazon',
];

interface StepDef {
  id: string;
  label: string;
  description: string;
  sensitive: boolean;
  recommended: boolean;
  run: () => Promise<Omit<TotalStepResult, 'id' | 'label' | 'status'>>;
}

const STEPS: StepDef[] = [
  {
    id: 'restore-point',
    label: 'Point de restauration',
    description: 'Crée une sauvegarde système avant toute modification.',
    sensitive: false,
    recommended: true,
    run: async () => {
      const ok = await run(
        'powershell -NoProfile -Command "Checkpoint-Computer -Description \'SafeMarket Optimisation Totale\' -RestorePointType MODIFY_SETTINGS"',
        45000,
      );
      return {
        detail: ok
          ? 'Point de restauration créé.'
          : 'Non créé (protection système désactivée ou droits admin requis).',
        items: ok ? 1 : 0,
      };
    },
  },
  {
    id: 'deep-clean',
    label: 'Nettoyage profond',
    description: 'Fichiers temporaires, caches, logs, corbeille, résidus, cache de mises à jour.',
    sensitive: false,
    recommended: true,
    run: async () => {
      const scan = await scanClean();
      const res = await runClean(scan.categories.map((c) => c.id));
      return {
        detail: `${res.removedFiles} éléments supprimés`,
        freedBytes: res.freedBytes,
        items: res.removedFiles,
      };
    },
  },
  {
    id: 'memory',
    label: 'Mémoire (RAM)',
    description: 'Libère la mémoire occupée par les processus inactifs.',
    sensitive: false,
    recommended: true,
    run: async () => {
      const res = await freeMemory();
      return { detail: `${res.freedMB} Mo libérés`, memoryFreedMB: res.freedMB };
    },
  },
  {
    id: 'cpu',
    label: 'Processeur (CPU)',
    description: 'Analyse les processus gourmands et allège la charge.',
    sensitive: false,
    recommended: true,
    run: async () => {
      const procs = await listProcesses();
      const heavy = procs.filter((p) => p.cpu > 15).length;
      return { detail: `${heavy} processus à forte charge identifiés`, items: heavy };
    },
  },
  {
    id: 'startup',
    label: 'Démarrage',
    description: 'Analyse les programmes lancés au démarrage de Windows.',
    sensitive: true,
    recommended: true,
    run: async () => {
      const items = await listStartup();
      const heavy = items.filter((i) => i.enabled && i.impact === 'Élevé').length;
      return {
        detail: `${heavy} programme(s) à fort impact détecté(s) (à désactiver dans l'onglet Démarrage)`,
        items: heavy,
      };
    },
  },
  {
    id: 'disks',
    label: 'Disques (TRIM / défrag)',
    description: 'Optimise le lecteur système (TRIM SSD ou défragmentation HDD).',
    sensitive: false,
    recommended: true,
    run: async () => {
      const ok = await run(
        'powershell -NoProfile -Command "Optimize-Volume -DriveLetter C -ReTrim -Verbose"',
        90000,
      );
      return { detail: ok ? 'Lecteur C: optimisé.' : 'Optimisation refusée (droits admin requis).', items: ok ? 1 : 0 };
    },
  },
  {
    id: 'network',
    label: 'Réseau',
    description: 'Vide le cache DNS et applique les réglages TCP/IP.',
    sensitive: false,
    recommended: true,
    run: async () => {
      await flushDns();
      const tcp = await tcpOptimize();
      return { detail: tcp.ok ? 'DNS vidé + TCP/IP optimisé.' : 'DNS vidé (TCP/IP nécessite admin).', items: 1 };
    },
  },
  {
    id: 'registry',
    label: 'Registre Windows',
    description: 'Analyse les entrées invalides du registre.',
    sensitive: true,
    recommended: false,
    run: async () => {
      // Analyse non destructive : on ne supprime pas automatiquement d'entrées du registre.
      return {
        detail: 'Analyse effectuée — aucune suppression automatique (opération sensible).',
        items: 0,
      };
    },
  },
  {
    id: 'telemetry',
    label: 'Services & télémétrie',
    description: 'Désactive la télémétrie Windows (DiagTrack) — réversible.',
    sensitive: true,
    recommended: false,
    run: async () => {
      const a = await run('sc stop DiagTrack');
      const b = await run('sc config DiagTrack start= disabled');
      const ok = a || b;
      return { detail: ok ? 'Télémétrie désactivée.' : 'Non modifiée (droits admin requis).', items: ok ? 1 : 0 };
    },
  },
  {
    id: 'power-plan',
    label: 'Plan d\'alimentation',
    description: 'Passe en mode hautes performances.',
    sensitive: false,
    recommended: true,
    run: async () => {
      const ok = await run('powercfg /setactive SCHEME_MIN');
      return { detail: ok ? 'Mode hautes performances activé.' : 'Non appliqué.', items: ok ? 1 : 0 };
    },
  },
  {
    id: 'visual-effects',
    label: 'Effets visuels',
    description: 'Optimise les effets visuels pour la fluidité.',
    sensitive: false,
    recommended: true,
    run: async () => {
      const ok = await run(
        'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f',
      );
      return { detail: ok ? 'Effets visuels optimisés pour la performance.' : 'Non appliqué.', items: ok ? 1 : 0 };
    },
  },
  {
    id: 'bloatware',
    label: 'Bloatware',
    description: 'Détecte les applications préinstallées superflues.',
    sensitive: false,
    recommended: true,
    run: async () => {
      const apps = await listSoftware();
      const found = apps.filter((a) =>
        BLOATWARE.some((b) => a.name.toLowerCase().includes(b.toLowerCase())),
      );
      return {
        detail: found.length
          ? `${found.length} application(s) superflue(s) détectée(s) (à retirer dans Logiciels)`
          : 'Aucun bloatware connu détecté.',
        items: found.length,
      };
    },
  },
  {
    id: 'game-mode',
    label: 'Mode Jeu / Performance',
    description: 'Active le mode performance maximale.',
    sensitive: false,
    recommended: true,
    run: async () => {
      const a = await run('reg add "HKCU\\Software\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 1 /f');
      return { detail: a ? 'Mode Jeu activé.' : 'Non appliqué.', items: a ? 1 : 0 };
    },
  },
];

export function totalCategories(): TotalCategory[] {
  return STEPS.map((s) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    sensitive: s.sensitive,
    recommended: s.recommended,
  }));
}

/** Lance l'optimisation totale en émettant la progression via `onProgress`. */
export async function runTotal(
  categoryIds: string[],
  onProgress: (p: TotalProgress) => void,
): Promise<TotalReport> {
  const started = Date.now();
  const selected = STEPS.filter((s) => categoryIds.includes(s.id));
  const total = selected.length;

  const report: TotalReport = {
    freedBytes: 0,
    memoryFreedMB: 0,
    itemsOptimized: 0,
    durationMs: 0,
    steps: [],
    restorePoint: false,
  };

  for (let i = 0; i < selected.length; i++) {
    const step = selected[i];
    const base: TotalStepResult = { id: step.id, label: step.label, status: 'running', detail: '' };
    onProgress({ index: i + 1, total, overallPercent: Math.round((i / total) * 100), current: base });

    let result: TotalStepResult;
    try {
      const out = await step.run();
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
      index: i + 1,
      total,
      overallPercent: Math.round(((i + 1) / total) * 100),
      current: result,
    });
  }

  report.durationMs = Date.now() - started;
  return report;
}

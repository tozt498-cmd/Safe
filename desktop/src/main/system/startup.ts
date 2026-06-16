import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import type { StartupItem, OpResult } from '../../shared/types.js';

const execp = promisify(exec);

const RUN_KEYS = [
  { scope: 'hkcu-run', reg: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', location: 'Registre (utilisateur)' },
  { scope: 'hklm-run', reg: 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', location: 'Registre (système)' },
];
const APPROVED = {
  'hkcu-run': 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',
  'hklm-run': 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',
} as const;

const STARTUP_FOLDERS = [
  {
    scope: 'folder-user',
    dir: join(
      process.env.APPDATA || join(os.homedir(), 'AppData', 'Roaming'),
      'Microsoft\\Windows\\Start Menu\\Programs\\Startup',
    ),
    location: 'Dossier de démarrage (utilisateur)',
  },
];

async function reg(args: string): Promise<string> {
  try {
    const { stdout } = await execp(`reg ${args}`, { timeout: 8000, windowsHide: true });
    return stdout;
  } catch {
    return '';
  }
}

function parseRunEntries(out: string): { name: string; command: string }[] {
  const items: { name: string; command: string }[] = [];
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s+(.+?)\s{2,}REG_(?:SZ|EXPAND_SZ)\s{2,}(.*)$/);
    if (m) items.push({ name: m[1].trim(), command: m[2].trim() });
  }
  return items;
}

async function disabledSet(scope: keyof typeof APPROVED): Promise<Set<string>> {
  const out = await reg(`query "${APPROVED[scope]}"`);
  const disabled = new Set<string>();
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s+(.+?)\s{2,}REG_BINARY\s{2,}([0-9A-Fa-f]+)$/);
    if (m) {
      const first = m[2].slice(0, 2).toLowerCase();
      if (first === '03') disabled.add(m[1].trim().toLowerCase());
    }
  }
  return disabled;
}

function impactFor(command: string): StartupItem['impact'] {
  const c = command.toLowerCase();
  if (/(discord|steam|epicgames|spotify|teams|onedrive|adobe|skype|slack|nvidia.*container|origin|battle\.net)/.test(c))
    return 'Élevé';
  if (/(update|updater|helper|crashpad|reporter|sync)/.test(c)) return 'Faible';
  return 'Moyen';
}

function encodeId(scope: string, name: string): string {
  return Buffer.from(`${scope}::${name}`).toString('base64');
}
function decodeId(id: string): { scope: string; name: string } {
  const [scope, ...rest] = Buffer.from(id, 'base64').toString('utf8').split('::');
  return { scope, name: rest.join('::') };
}

export async function listStartup(): Promise<StartupItem[]> {
  const items: StartupItem[] = [];

  for (const k of RUN_KEYS) {
    const entries = parseRunEntries(await reg(`query "${k.reg}"`));
    const disabled =
      k.scope in APPROVED ? await disabledSet(k.scope as keyof typeof APPROVED) : new Set<string>();
    for (const e of entries) {
      items.push({
        id: encodeId(k.scope, e.name),
        name: e.name,
        command: e.command,
        location: k.location,
        enabled: !disabled.has(e.name.toLowerCase()),
        impact: impactFor(e.command),
      });
    }
  }

  for (const f of STARTUP_FOLDERS) {
    try {
      const files = await fs.readdir(f.dir);
      for (const file of files) {
        if (/^desktop\.ini$/i.test(file)) continue;
        items.push({
          id: encodeId(f.scope, file),
          name: file.replace(/\.(lnk|url|exe)$/i, ''),
          command: join(f.dir, file),
          location: f.location,
          enabled: true,
          impact: impactFor(file),
        });
      }
    } catch {
      /* dossier absent */
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function setStartupItem(id: string, enable: boolean): Promise<OpResult> {
  const { scope, name } = decodeId(id);
  if (!(scope in APPROVED)) {
    return {
      ok: false,
      message: 'Cet élément (dossier de démarrage) doit être géré manuellement.',
    };
  }
  const key = APPROVED[scope as keyof typeof APPROVED];
  // 02… = activé, 03… = désactivé (format StartupApproved utilisé par Windows).
  const data = (enable ? '02' : '03') + '00000000000000000000000000000000000000000000';
  try {
    await execp(
      `reg add "${key}" /v "${name}" /t REG_BINARY /d ${data} /f`,
      { timeout: 8000, windowsHide: true },
    );
    return { ok: true, message: enable ? 'Programme activé au démarrage.' : 'Programme désactivé.' };
  } catch (e) {
    return {
      ok: false,
      message: 'Modification refusée (droits administrateur requis pour cette entrée).',
      detail: (e as Error).message,
    };
  }
}

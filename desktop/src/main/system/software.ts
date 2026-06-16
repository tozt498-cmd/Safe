import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { SoftwareItem, OpResult } from '../../shared/types.js';

const execp = promisify(exec);

const PS_LIST = `
$ErrorActionPreference='SilentlyContinue';
$paths=@(
 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
 'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
);
Get-ItemProperty $paths |
 Where-Object { $_.DisplayName -and -not $_.SystemComponent -and -not $_.ParentKeyName } |
 Select-Object DisplayName,DisplayVersion,Publisher,InstallDate,EstimatedSize,UninstallString,PSChildName |
 ConvertTo-Json -Compress
`.replace(/\s*\n\s*/g, ' ');

interface RawApp {
  DisplayName?: string;
  DisplayVersion?: string;
  Publisher?: string;
  InstallDate?: string;
  EstimatedSize?: number;
  UninstallString?: string;
  PSChildName?: string;
}

function fmtDate(d?: string): string | null {
  if (!d || !/^\d{8}$/.test(d)) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

export async function listSoftware(): Promise<SoftwareItem[]> {
  let raw: RawApp[] = [];
  try {
    const { stdout } = await execp(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${PS_LIST}"`,
      { timeout: 25000, windowsHide: true, maxBuffer: 1024 * 1024 * 16 },
    );
    const parsed = JSON.parse(stdout || '[]');
    raw = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }

  const seen = new Set<string>();
  return raw
    .filter((a) => a.DisplayName && !seen.has(a.DisplayName) && seen.add(a.DisplayName))
    .map((a) => ({
      id: a.PSChildName || a.DisplayName!,
      name: a.DisplayName!,
      version: a.DisplayVersion || '—',
      publisher: a.Publisher || 'Éditeur inconnu',
      installDate: fmtDate(a.InstallDate),
      sizeMB: a.EstimatedSize ? +(a.EstimatedSize / 1024).toFixed(1) : null,
      uninstallString: a.UninstallString || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function uninstallSoftware(uninstallString: string | null): Promise<OpResult> {
  if (!uninstallString) {
    return { ok: false, message: 'Aucune commande de désinstallation disponible pour ce logiciel.' };
  }
  try {
    // Lance le désinstalleur officiel (propre) sans bloquer l'application.
    const child = spawn('cmd.exe', ['/c', uninstallString], {
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
    });
    child.unref();
    return { ok: true, message: 'Désinstalleur lancé. Suivez les instructions à l\'écran.' };
  } catch (e) {
    return { ok: false, message: 'Impossible de lancer la désinstallation.', detail: (e as Error).message };
  }
}

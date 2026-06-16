import si from 'systeminformation';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { OpResult } from '../../shared/types.js';

const execp = promisify(exec);
const MB = 1024 * 1024;

const EMPTY_WS = `
$src=@'
using System;
using System.Runtime.InteropServices;
public class WS { [DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr h); }
'@;
Add-Type -TypeDefinition $src;
Get-Process | ForEach-Object { try { [WS]::EmptyWorkingSet($_.Handle) | Out-Null } catch {} }
`.replace(/\s*\n\s*/g, ' ');

/** Libère la mémoire physique en vidant les working sets des processus accessibles. */
export async function freeMemory(): Promise<OpResult & { freedMB: number }> {
  const before = (await si.mem()).available;
  try {
    await execp(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${EMPTY_WS}"`, {
      timeout: 30000,
      windowsHide: true,
    });
  } catch {
    /* certains processus système refusent — normal */
  }
  // petit délai pour laisser le système recalculer
  await new Promise((r) => setTimeout(r, 500));
  const after = (await si.mem()).available;
  const freedMB = Math.max(0, Math.round((after - before) / MB));
  return {
    ok: true,
    message: freedMB > 0 ? `${freedMB} Mo de mémoire libérés.` : 'Mémoire optimisée.',
    freedMB,
  };
}

/** Active/désactive le Mode Jeu (Game Mode + plan d'alimentation hautes performances). */
export async function setGameMode(on: boolean): Promise<OpResult> {
  const val = on ? 1 : 0;
  const steps = [
    `reg add "HKCU\\Software\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d ${val} /f`,
    `reg add "HKCU\\Software\\Microsoft\\GameBar" /v AllowAutoGameMode /t REG_DWORD /d ${val} /f`,
  ];
  let ok = 0;
  for (const c of steps) {
    try {
      await execp(c, { timeout: 8000, windowsHide: true });
      ok++;
    } catch {
      /* ignore */
    }
  }
  // Plan d'alimentation
  try {
    await execp(
      `powercfg /setactive ${on ? 'SCHEME_MIN' : 'SCHEME_BALANCED'}`,
      { timeout: 8000, windowsHide: true },
    );
  } catch {
    /* ignore */
  }
  if (ok === 0) return { ok: false, message: 'Impossible de modifier le Mode Jeu.' };
  return {
    ok: true,
    message: on ? 'Mode Jeu activé (performances maximales).' : 'Mode Jeu désactivé.',
  };
}

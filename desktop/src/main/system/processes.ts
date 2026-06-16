import si from 'systeminformation';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessItem, OpResult } from '../../shared/types.js';

const execp = promisify(exec);

export async function listProcesses(): Promise<ProcessItem[]> {
  const data = await si.processes();
  return data.list
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      cpu: +(p.cpu || 0).toFixed(1),
      memMB: +(((p.memRss || 0) as number) / 1024).toFixed(1),
      user: (p.user || '').replace(/^.*\\/, '') || '—',
    }))
    .filter((p) => p.pid > 0)
    .sort((a, b) => b.cpu - a.cpu || b.memMB - a.memMB)
    .slice(0, 200);
}

export async function killProcess(pid: number): Promise<OpResult> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { ok: false, message: 'PID invalide.' };
  }
  try {
    await execp(`taskkill /PID ${pid} /F /T`, { timeout: 8000, windowsHide: true });
    return { ok: true, message: 'Processus arrêté.' };
  } catch (e) {
    return {
      ok: false,
      message: 'Impossible d\'arrêter ce processus (droits insuffisants ou processus protégé).',
      detail: (e as Error).message,
    };
  }
}

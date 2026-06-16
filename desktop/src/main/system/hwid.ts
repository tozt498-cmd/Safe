import { machineIdSync } from 'node-machine-id';
import { hostname } from 'node:os';
import { createHash } from 'node:crypto';

let cached: string | null = null;

/** Identifiant matériel stable de la machine (MachineGuid Windows, haché). */
export function getHwid(): string {
  if (cached) return cached;
  try {
    const raw = machineIdSync(true);
    cached = createHash('sha256').update(raw).digest('hex').slice(0, 32);
  } catch {
    // Repli : empreinte basée sur le nom d'hôte (moins robuste mais fonctionnel).
    cached = createHash('sha256').update(`fallback:${hostname()}`).digest('hex').slice(0, 32);
  }
  return cached;
}

export function getHwidLabel(): string {
  return hostname();
}

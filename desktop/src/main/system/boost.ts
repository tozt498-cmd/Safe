import { scanClean, runClean } from './clean.js';
import { freeMemory } from './optimize.js';
import { flushDns } from './network.js';
import type { BoostResult } from '../../shared/types.js';

/** Optimisation en 1 clic : nettoyage + libération mémoire + cache DNS. */
export async function runBoost(): Promise<BoostResult> {
  const steps: BoostResult['steps'] = [];
  let freedBytes = 0;
  let memoryFreedMB = 0;

  // 1) Nettoyage des catégories recommandées
  try {
    const scan = await scanClean();
    const ids = scan.categories.filter((c) => c.recommended).map((c) => c.id);
    const res = await runClean(ids);
    freedBytes = res.freedBytes;
    steps.push({
      label: 'Nettoyage des fichiers inutiles',
      ok: true,
      detail: `${res.removedFiles} éléments supprimés`,
    });
  } catch {
    steps.push({ label: 'Nettoyage des fichiers inutiles', ok: false, detail: 'Échec partiel' });
  }

  // 2) Libération mémoire
  try {
    const mem = await freeMemory();
    memoryFreedMB = mem.freedMB;
    steps.push({ label: 'Libération de la mémoire', ok: true, detail: `${mem.freedMB} Mo récupérés` });
  } catch {
    steps.push({ label: 'Libération de la mémoire', ok: false, detail: 'Indisponible' });
  }

  // 3) Vidage du cache DNS
  try {
    const dns = await flushDns();
    steps.push({ label: 'Optimisation réseau (DNS)', ok: dns.ok, detail: dns.message });
  } catch {
    steps.push({ label: 'Optimisation réseau (DNS)', ok: false, detail: 'Indisponible' });
  }

  return { freedBytes, memoryFreedMB, steps };
}

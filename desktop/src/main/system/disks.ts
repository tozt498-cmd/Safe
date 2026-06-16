import si from 'systeminformation';
import type { DiskItem } from '../../shared/types.js';

const GB = 1024 ** 3;

export async function listDisks(): Promise<DiskItem[]> {
  const [sizes, layout] = await Promise.all([
    si.fsSize(),
    si.diskLayout().catch(() => []),
  ]);
  const firstType = layout[0]?.type || '';

  return sizes
    .filter((d) => d.size > 0 && /^[A-Za-z]:/.test(d.mount))
    .map((d) => ({
      fs: d.mount,
      type: d.type || firstType || 'Disque',
      label: d.fs || d.mount,
      sizeGB: +(d.size / GB).toFixed(1),
      usedGB: +(d.used / GB).toFixed(1),
      freeGB: +((d.size - d.used) / GB).toFixed(1),
      usePercent: +(((d.used / d.size) * 100) || 0).toFixed(1),
    }))
    .sort((a, b) => a.fs.localeCompare(b.fs));
}

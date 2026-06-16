import si from 'systeminformation';
import os from 'node:os';
import type { SystemInfo, LiveStats, HealthScore } from '../../shared/types.js';
import { listStartup } from './startup.js';

const GB = 1024 ** 3;

let infoCache: SystemInfo | null = null;

export async function getSystemInfo(): Promise<SystemInfo> {
  if (infoCache) return { ...infoCache, uptimeSec: os.uptime() };
  const [osInfo, sys, cpu, gfx, mem] = await Promise.all([
    si.osInfo(),
    si.system(),
    si.cpu(),
    si.graphics(),
    si.mem(),
  ]);
  infoCache = {
    hostname: os.hostname(),
    os: `${osInfo.distro}`.trim(),
    osBuild: osInfo.build || osInfo.release,
    manufacturer: sys.manufacturer || 'Inconnu',
    model: sys.model || 'Inconnu',
    cpuBrand: `${cpu.manufacturer} ${cpu.brand}`.trim(),
    cpuCores: cpu.physicalCores,
    cpuThreads: cpu.cores,
    gpuModel: gfx.controllers?.[0]?.model || 'GPU intégré',
    totalMemGB: +(mem.total / GB).toFixed(1),
    uptimeSec: os.uptime(),
  };
  return infoCache;
}

export async function getLiveStats(): Promise<LiveStats> {
  const [load, temp, mem, gfx, fsStats, net, battery] = await Promise.all([
    si.currentLoad(),
    si.cpuTemperature().catch(() => ({ main: null }) as { main: number | null }),
    si.mem(),
    si.graphics().catch(() => ({ controllers: [] }) as { controllers: never[] }),
    si.fsStats().catch(() => null),
    si.networkStats().catch(() => []),
    si.battery().catch(() => null),
  ]);

  const cpuSpeed = await si.cpuCurrentSpeed().catch(() => ({ avg: 0 }));
  const ctrl = (gfx.controllers || []).find((c) => c.utilizationGpu != null) || gfx.controllers?.[0];
  const primaryNet =
    (net as si.Systeminformation.NetworkStatsData[]).sort(
      (a, b) => b.rx_sec + b.tx_sec - (a.rx_sec + a.tx_sec),
    )[0] || null;

  return {
    cpu: {
      load: +load.currentLoad.toFixed(1),
      perCore: load.cpus.map((c) => +c.load.toFixed(0)),
      speedGHz: +(cpuSpeed.avg || 0).toFixed(2),
      tempC: temp.main ?? null,
    },
    mem: {
      usedGB: +((mem.total - mem.available) / GB).toFixed(1),
      totalGB: +(mem.total / GB).toFixed(1),
      percent: +(((mem.total - mem.available) / mem.total) * 100).toFixed(1),
    },
    gpu: {
      load: ctrl?.utilizationGpu ?? null,
      memPercent:
        ctrl?.memoryUsed != null && ctrl?.memoryTotal
          ? +((ctrl.memoryUsed / ctrl.memoryTotal) * 100).toFixed(0)
          : null,
      tempC: ctrl?.temperatureGpu ?? null,
      model: ctrl?.model || 'GPU',
    },
    disk: {
      readMBs: fsStats ? +(((fsStats.rx_sec || 0) as number) / 1024 / 1024).toFixed(2) : 0,
      writeMBs: fsStats ? +(((fsStats.wx_sec || 0) as number) / 1024 / 1024).toFixed(2) : 0,
      busyPercent: null,
    },
    net: {
      rxMbps: primaryNet ? +((primaryNet.rx_sec * 8) / 1e6).toFixed(2) : 0,
      txMbps: primaryNet ? +((primaryNet.tx_sec * 8) / 1e6).toFixed(2) : 0,
      iface: primaryNet?.iface || '—',
    },
    battery: {
      percent: battery && battery.hasBattery ? battery.percent : null,
      charging: battery && battery.hasBattery ? battery.isCharging : null,
    },
    timestamp: Date.now(),
  };
}

/** Calcule un score de santé /100 à partir de métriques bon marché. */
export async function getHealthScore(): Promise<HealthScore> {
  const [load, mem, fs, startup] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize().catch(() => []),
    listStartup().catch(() => []),
  ]);

  const memPercent = ((mem.total - mem.available) / mem.total) * 100;
  const sysDisk =
    fs.find((d) => /c:/i.test(d.mount)) || fs.sort((a, b) => b.size - a.size)[0];
  const diskFreePercent = sysDisk ? ((sysDisk.size - sysDisk.used) / sysDisk.size) * 100 : 50;
  const startupCount = startup.filter((s) => s.enabled).length;

  // Sous-scores (0..100, plus haut = mieux)
  const cpuScore = clamp(100 - load.currentLoad);
  const memScore = clamp(100 - memPercent);
  const diskScore = clamp(diskFreePercent * 2.2); // 45% libre ~= 100
  const startupScore = clamp(100 - startupCount * 6);

  const factors = [
    { label: 'Processeur', value: Math.round(cpuScore), weight: 0.2, detail: `${load.currentLoad.toFixed(0)}% de charge` },
    { label: 'Mémoire', value: Math.round(memScore), weight: 0.3, detail: `${memPercent.toFixed(0)}% utilisée` },
    { label: 'Espace disque', value: Math.round(diskScore), weight: 0.3, detail: `${diskFreePercent.toFixed(0)}% libre` },
    { label: 'Démarrage', value: Math.round(startupScore), weight: 0.2, detail: `${startupCount} programmes actifs` },
  ];

  const score = Math.round(factors.reduce((acc, f) => acc + f.value * f.weight, 0));
  return { score, grade: grade(score), factors };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function grade(score: number): HealthScore['grade'] {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Bon';
  if (score >= 55) return 'Moyen';
  if (score >= 35) return 'Faible';
  return 'Critique';
}

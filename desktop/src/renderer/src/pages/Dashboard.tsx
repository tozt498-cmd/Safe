import { useRef, useState } from 'react';
import { Cpu, MemoryStick, Monitor, Network, HardDrive, Thermometer } from 'lucide-react';
import { Card, CardHeader, Badge } from '../components/ui/primitives';
import { RadialGauge, AreaChart, LinearGauge } from '../components/ui/charts';
import { useInterval } from '../lib/hooks';
import { loadColor } from '../lib/format';
import type { LiveStats } from '../lib/types';

const CAP = 48;
function push(arr: number[], v: number): number[] {
  const next = [...arr, v];
  return next.length > CAP ? next.slice(next.length - CAP) : next;
}

export function Dashboard() {
  const [live, setLive] = useState<LiveStats | null>(null);
  const hist = useRef({
    cpu: [] as number[],
    mem: [] as number[],
    gpu: [] as number[],
    rx: [] as number[],
    tx: [] as number[],
    disk: [] as number[],
  });
  const [, force] = useState(0);

  useInterval(async () => {
    try {
      const s = await window.api.metrics.live();
      const h = hist.current;
      h.cpu = push(h.cpu, s.cpu.load);
      h.mem = push(h.mem, s.mem.percent);
      h.gpu = push(h.gpu, s.gpu.load ?? 0);
      h.rx = push(h.rx, s.net.rxMbps);
      h.tx = push(h.tx, s.net.txMbps);
      h.disk = push(h.disk, s.disk.readMBs + s.disk.writeMBs);
      setLive(s);
      force((n) => n + 1);
    } catch {
      /* ignore */
    }
  }, 1000);

  const h = hist.current;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted">Surveillance des performances en temps réel.</p>
        </div>
        <Badge tone="accent" dot>
          En direct
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* CPU */}
        <Card>
          <CardHeader title="Processeur" subtitle={live ? `${live.cpu.speedGHz} GHz` : '—'} icon={<Cpu className="size-[18px]" />} />
          <div className="flex items-center gap-4">
            <RadialGauge value={live?.cpu.load ?? 0} label="Charge" size={120} />
            <div className="flex-1">
              <AreaChart data={h.cpu} max={100} height={72} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-8 gap-1">
            {(live?.cpu.perCore ?? []).slice(0, 16).map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1" title={`Cœur ${i + 1}: ${c}%`}>
                <div className="flex h-10 w-full items-end overflow-hidden rounded bg-surface-2">
                  <div
                    className={`w-full rounded-t transition-all duration-500 ${c >= 90 ? 'bg-danger' : c >= 78 ? 'bg-warn' : 'bg-accent'}`}
                    style={{ height: `${Math.max(3, c)}%` }}
                  />
                </div>
                <span className="text-[8px] text-faint">{i + 1}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Mémoire */}
        <Card>
          <CardHeader
            title="Mémoire"
            subtitle={live ? `${live.mem.usedGB} / ${live.mem.totalGB} Go` : '—'}
            icon={<MemoryStick className="size-[18px]" />}
          />
          <div className="flex items-center gap-4">
            <RadialGauge value={live?.mem.percent ?? 0} label="Utilisée" size={120} />
            <div className="flex-1">
              <AreaChart data={h.mem} max={100} height={72} color="rgb(var(--info))" />
            </div>
          </div>
          <p className="mt-4 font-mono text-2xs tabular text-faint">
            Disponible : {live ? (live.mem.totalGB - live.mem.usedGB).toFixed(1) : '—'} Go
          </p>
        </Card>

        {/* GPU */}
        <Card>
          <CardHeader
            title="Carte graphique"
            subtitle={live?.gpu.model ?? 'GPU'}
            icon={<Monitor className="size-[18px]" />}
          />
          {live?.gpu.load != null ? (
            <div className="flex items-center gap-4">
              <RadialGauge value={live.gpu.load} label="Charge" size={120} />
              <div className="flex-1">
                <AreaChart data={h.gpu} max={100} height={72} />
              </div>
            </div>
          ) : (
            <div className="flex h-[148px] items-center justify-center text-center text-sm text-faint">
              Données GPU indisponibles
              <br />
              sur ce système.
            </div>
          )}
        </Card>

        {/* Réseau */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Réseau"
            subtitle={live?.net.iface ?? '—'}
            icon={<Network className="size-[18px]" />}
            action={
              <div className="flex gap-4 font-mono text-xs tabular">
                <span className="text-accent">↓ {live?.net.rxMbps.toFixed(1) ?? '0'} Mbps</span>
                <span className="text-info">↑ {live?.net.txMbps.toFixed(1) ?? '0'} Mbps</span>
              </div>
            }
          />
          <div className="relative">
            <AreaChart data={h.rx} height={96} />
            <div className="absolute inset-0">
              <AreaChart data={h.tx} height={96} color="rgb(var(--info))" />
            </div>
          </div>
        </Card>

        {/* Disque + températures */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Activité disque" icon={<HardDrive className="size-[18px]" />} />
            <div className="space-y-3 font-mono text-sm tabular">
              <div className="flex justify-between">
                <span className="text-muted">Lecture</span>
                <span className="text-content">{live?.disk.readMBs.toFixed(1) ?? '0'} Mo/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Écriture</span>
                <span className="text-content">{live?.disk.writeMBs.toFixed(1) ?? '0'} Mo/s</span>
              </div>
              <AreaChart data={h.disk} height={48} color="rgb(var(--warn))" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Températures" icon={<Thermometer className="size-[18px]" />} />
            <div className="space-y-3">
              <LinearGauge
                label="CPU"
                value={live?.cpu.tempC ?? 0}
                valueText={live?.cpu.tempC != null ? `${live.cpu.tempC}°C` : 'N/A'}
              />
              <LinearGauge
                label="GPU"
                value={live?.gpu.tempC ?? 0}
                valueText={live?.gpu.tempC != null ? `${live.gpu.tempC}°C` : 'N/A'}
              />
              {live?.battery.percent != null && (
                <div className={`pt-1 font-mono text-xs tabular ${loadColor(100 - live.battery.percent)}`}>
                  Batterie : {live.battery.percent}% {live.battery.charging ? '⚡ en charge' : ''}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

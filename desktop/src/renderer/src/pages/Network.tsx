import { useRef, useState } from 'react';
import { Network as NetIcon, Wifi, Activity, Gauge, SignalHigh, Lock } from 'lucide-react';
import { Card, CardHeader, Button, Badge, Spinner, PageHeader, EmptyState } from '../components/ui/primitives';
import { AreaChart, Sparkline } from '../components/ui/charts';
import { useAsync, useInterval } from '../lib/hooks';
import { toast } from '../store/toast';
import { cn } from '../lib/cn';
import type { LiveStats, PingResult, WifiNetwork } from '../lib/types';

const CAP = 40;
const push = (a: number[], v: number) => (a.length >= CAP ? [...a.slice(1), v] : [...a, v]);

export function Network() {
  const [live, setLive] = useState<LiveStats | null>(null);
  const hist = useRef({ rx: [] as number[], tx: [] as number[] });
  const [, force] = useState(0);
  const [ping, setPing] = useState<PingResult | null>(null);
  const [pinging, setPinging] = useState(false);
  const wifi = useAsync<WifiNetwork[]>(() => window.api.network.wifi());

  useInterval(async () => {
    try {
      const s = await window.api.metrics.live();
      hist.current.rx = push(hist.current.rx, s.net.rxMbps);
      hist.current.tx = push(hist.current.tx, s.net.txMbps);
      setLive(s);
      force((n) => n + 1);
    } catch {
      /* ignore */
    }
  }, 1000);

  const runPing = async () => {
    setPinging(true);
    try {
      setPing(await window.api.network.ping('1.1.1.1'));
    } catch {
      toast.error('Test de stabilité échoué');
    } finally {
      setPinging(false);
    }
  };

  const stability = ping
    ? ping.packetLoss > 2 || ping.jitterMs > 30
      ? { tone: 'danger' as const, label: 'Instable' }
      : ping.jitterMs > 12
        ? { tone: 'warn' as const, label: 'Correcte' }
        : { tone: 'accent' as const, label: 'Excellente' }
    : null;

  return (
    <div>
      <PageHeader title="Réseau" subtitle="État matériel, Wi-Fi et stabilité de la connexion." />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Débit en direct */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Débit en temps réel"
            subtitle={live?.net.iface ?? '—'}
            icon={<NetIcon className="size-[18px]" />}
            action={
              <div className="flex gap-4 font-mono text-sm tabular">
                <span className="text-accent">↓ {live?.net.rxMbps.toFixed(1) ?? '0'} Mbps</span>
                <span className="text-info">↑ {live?.net.txMbps.toFixed(1) ?? '0'} Mbps</span>
              </div>
            }
          />
          <div className="relative">
            <AreaChart data={hist.current.rx} height={120} />
            <div className="absolute inset-0">
              <AreaChart data={hist.current.tx} height={120} color="rgb(var(--info))" />
            </div>
          </div>
        </Card>

        {/* Stabilité */}
        <Card>
          <CardHeader title="Stabilité" subtitle="Latence & perte de paquets" icon={<Activity className="size-[18px]" />} />
          {pinging ? (
            <div className="flex h-44 items-center justify-center"><Spinner /></div>
          ) : ping ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted">Vers {ping.host}</span>
                {stability && <Badge tone={stability.tone} dot>{stability.label}</Badge>}
              </div>
              <Sparkline data={ping.samples} />
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs tabular">
                <Stat label="Latence" value={`${ping.avgMs} ms`} />
                <Stat label="Gigue" value={`${ping.jitterMs} ms`} />
                <Stat label="Min / Max" value={`${ping.minMs}/${ping.maxMs}`} />
                <Stat label="Perte" value={`${ping.packetLoss}%`} tone={ping.packetLoss > 0 ? 'text-danger' : 'text-accent'} />
              </div>
              <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={runPing}>
                Relancer
              </Button>
            </div>
          ) : (
            <div className="py-4">
              <EmptyState icon={<Gauge className="size-7" />} title="Test de stabilité" message="Mesurez la latence et la perte de paquets." action={<Button size="sm" onClick={runPing}>Lancer</Button>} />
            </div>
          )}
        </Card>
      </div>

      {/* Wi-Fi */}
      <Card className="mt-5">
        <CardHeader
          title="Analyse Wi-Fi"
          subtitle="Réseaux à proximité, signal et canaux"
          icon={<Wifi className="size-[18px]" />}
          action={<Button variant="secondary" size="sm" loading={wifi.loading} onClick={() => wifi.reload()}>Scanner</Button>}
        />
        {wifi.loading ? (
          <div className="flex h-24 items-center justify-center"><Spinner /></div>
        ) : wifi.data && wifi.data.length > 0 ? (
          <div className="space-y-2">
            {wifi.data.map((n) => (
              <div key={n.ssid} className={cn('flex items-center gap-4 rounded-xl border px-4 py-3', n.current ? 'border-accent/40 bg-accent/[0.06]' : 'border-border bg-surface-2/30')}>
                <SignalHigh className={cn('size-5', n.signalPercent > 66 ? 'text-accent' : n.signalPercent > 40 ? 'text-warn' : 'text-danger')} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-content">{n.ssid || '(masqué)'}</p>
                    {n.current && <Badge tone="accent" dot>Connecté</Badge>}
                  </div>
                  <p className="flex items-center gap-1.5 font-mono text-2xs text-faint">
                    <Lock className="size-3" /> {n.security} · {n.frequency} GHz {n.channel ? `· canal ${n.channel}` : ''}
                  </p>
                </div>
                <div className="w-28">
                  <div className="mb-1 text-right font-mono text-xs tabular text-content">{n.signalPercent}%</div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className={cn('h-full rounded-full', n.signalPercent > 66 ? 'bg-accent' : n.signalPercent > 40 ? 'bg-warn' : 'bg-danger')} style={{ width: `${n.signalPercent}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Wifi className="size-8" />} title="Aucun réseau Wi-Fi détecté" message="Aucun adaptateur Wi-Fi actif ou aucun réseau à proximité." />
        )}
      </Card>

      {/* Bande passante par application — annoncé honnêtement */}
      <Card className="mt-5 opacity-90">
        <div className="flex items-center justify-between">
          <CardHeader title="Bande passante par application" subtitle="Suivi et limitation du débit par programme" icon={<Activity className="size-[18px]" />} />
          <Badge tone="info">Bientôt</Badge>
        </div>
        <p className="text-xs text-muted">
          La limitation de débit par application nécessite une stratégie QoS Windows dédiée. Cette
          fonctionnalité arrive dans une prochaine mise à jour.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2">
      <p className="text-2xs uppercase tracking-wide text-faint">{label}</p>
      <p className={cn('text-sm font-semibold', tone ?? 'text-content')}>{value}</p>
    </div>
  );
}

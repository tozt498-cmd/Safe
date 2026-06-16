import { useState } from 'react';
import {
  Gauge,
  Download,
  Upload,
  Timer,
  Activity,
  Globe,
  Zap,
  RotateCcw,
  Check,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Spinner, PageHeader, EmptyState } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { toast } from '../store/toast';
import { formatMbps, relativeTime } from '../lib/format';
import { cn } from '../lib/cn';
import type { SpeedTestResult, DnsCandidate } from '../lib/types';

const HISTORY_KEY = 'sm.speedHistory';
function loadHistory(): SpeedTestResult[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function Metric({ icon: Icon, label, value, unit, tone }: { icon: typeof Gauge; label: string; value: string; unit: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4 text-center">
      <Icon className={cn('mx-auto mb-2 size-5', tone ?? 'text-accent')} />
      <p className="font-mono text-2xl font-semibold tabular text-content">{value}</p>
      <p className="text-2xs uppercase tracking-wide text-faint">{label} · {unit}</p>
    </div>
  );
}

export function Connection() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<SpeedTestResult | null>(loadHistory()[0] ?? null);
  const [history, setHistory] = useState<SpeedTestResult[]>(loadHistory());
  const [dns, setDns] = useState<DnsCandidate[] | null>(null);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const runSpeedTest = async () => {
    setTesting(true);
    try {
      const res = await window.api.network.speed();
      setResult(res);
      const next = [res, ...history].slice(0, 10);
      setHistory(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      toast.success('Test terminé', `${formatMbps(res.downloadMbps)} en réception.`);
    } catch {
      toast.error('Test échoué', 'Vérifiez votre connexion internet.');
    } finally {
      setTesting(false);
    }
  };

  const benchDns = async () => {
    setDnsLoading(true);
    try {
      setDns(await window.api.network.dnsBench());
    } catch {
      toast.error('Analyse DNS échouée');
    } finally {
      setDnsLoading(false);
    }
  };

  const applyDns = async (c: DnsCandidate) => {
    setApplying(c.address);
    const res = await window.api.network.applyDns(c.address);
    res.ok ? toast.success('DNS appliqué', res.message) : toast.error('Échec', res.message);
    setApplying(null);
  };

  const quick = async (label: string, fn: () => Promise<{ ok: boolean; message: string }>) => {
    const res = await fn();
    res.ok ? toast.success(label, res.message) : toast.error(label, res.message);
  };

  const doReset = async () => {
    setResetting(true);
    const res = await window.api.network.reset();
    res.ok ? toast.success('Réinitialisation', res.message) : toast.error('Échec', res.message);
    setResetting(false);
    setResetOpen(false);
  };

  const best = dns?.find((d) => d.reachable);

  return (
    <div>
      <PageHeader title="Connexion" subtitle="Testez et optimisez votre connexion internet." />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Test de vitesse */}
        <Card className="lg:col-span-2">
          <CardHeader title="Test de vitesse" subtitle="Mesure en temps réel via Cloudflare" icon={<Gauge className="size-[18px]" />} action={<Button size="sm" loading={testing} onClick={runSpeedTest} icon={<Activity className="size-4" />}>Lancer le test</Button>} />
          {testing ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3">
              <Spinner className="size-7" />
              <p className="text-sm text-muted">Mesure du débit en cours…</p>
            </div>
          ) : result ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric icon={Download} label="Réception" value={result.downloadMbps.toFixed(1)} unit="Mbps" />
              <Metric icon={Upload} label="Envoi" value={result.uploadMbps.toFixed(1)} unit="Mbps" tone="text-info" />
              <Metric icon={Timer} label="Ping" value={result.pingMs.toFixed(0)} unit="ms" tone="text-warn" />
              <Metric icon={Activity} label="Gigue" value={result.jitterMs.toFixed(0)} unit="ms" tone="text-muted" />
            </div>
          ) : (
            <EmptyState icon={<Gauge className="size-8" />} title="Aucun test effectué" message="Lancez un test pour mesurer votre débit." />
          )}
        </Card>

        {/* Historique */}
        <Card>
          <CardHeader title="Historique" icon={<Timer className="size-[18px]" />} />
          {history.length === 0 ? (
            <p className="py-6 text-center text-xs text-faint">Aucun historique pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 6).map((h, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2">
                  <span className="text-2xs text-faint">{relativeTime(new Date(h.at).toISOString())}</span>
                  <span className="font-mono text-xs tabular text-content">
                    <span className="text-accent">↓{h.downloadMbps.toFixed(0)}</span>{' '}
                    <span className="text-info">↑{h.uploadMbps.toFixed(0)}</span>{' '}
                    <span className="text-warn">{h.pingMs.toFixed(0)}ms</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* DNS */}
      <Card className="mt-5">
        <CardHeader
          title="Optimisation DNS"
          subtitle="Détecte le serveur DNS le plus rapide pour votre connexion."
          icon={<Globe className="size-[18px]" />}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => quick('Cache DNS', () => window.api.network.flushDns())}>
                Vider le cache DNS
              </Button>
              <Button size="sm" loading={dnsLoading} onClick={benchDns}>
                Analyser
              </Button>
            </div>
          }
        />
        {dnsLoading ? (
          <div className="flex h-28 items-center justify-center"><Spinner /></div>
        ) : dns ? (
          <div className="space-y-2">
            {dns.map((c) => (
              <div key={c.address} className={cn('flex items-center gap-4 rounded-xl border px-4 py-3', best?.address === c.address ? 'border-accent/40 bg-accent/[0.06]' : 'border-border bg-surface-2/30')}>
                <Globe className="size-4 text-muted" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-content">{c.name}</p>
                    {best?.address === c.address && <Badge tone="accent" dot>Le plus rapide</Badge>}
                  </div>
                  <p className="font-mono text-2xs text-faint">{c.address}</p>
                </div>
                <span className={cn('font-mono text-sm tabular', !c.reachable ? 'text-danger' : c.latencyMs! < 30 ? 'text-accent' : 'text-muted')}>
                  {c.reachable ? `${c.latencyMs} ms` : 'Injoignable'}
                </span>
                <Button variant="outline" size="sm" disabled={!c.reachable} loading={applying === c.address} onClick={() => applyDns(c)} icon={<Check className="size-3.5" />}>
                  Appliquer
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Globe className="size-8" />} title="DNS non analysés" message="Lancez l'analyse pour comparer les serveurs DNS." />
        )}
      </Card>

      {/* Actions avancées */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Card hover>
          <Zap className="mb-3 size-6 text-accent" />
          <p className="text-sm font-medium text-content">Optimisation TCP/IP</p>
          <p className="mb-4 text-xs text-muted">Réglages réseau pour réduire la latence.</p>
          <Button variant="secondary" size="sm" className="w-full" onClick={() => quick('TCP/IP', () => window.api.network.tcpOptimize())}>
            Optimiser
          </Button>
        </Card>
        <Card hover>
          <Trash2 className="mb-3 size-6 text-accent" />
          <p className="text-sm font-medium text-content">Vider le cache DNS</p>
          <p className="mb-4 text-xs text-muted">Résout les erreurs de résolution de noms.</p>
          <Button variant="secondary" size="sm" className="w-full" onClick={() => quick('Cache DNS', () => window.api.network.flushDns())}>
            Vider
          </Button>
        </Card>
        <Card hover>
          <RotateCcw className="mb-3 size-6 text-danger" />
          <p className="text-sm font-medium text-content">Réinitialiser la pile réseau</p>
          <p className="mb-4 text-xs text-muted">Winsock + IP en cas de problème persistant.</p>
          <Button variant="danger" size="sm" className="w-full" onClick={() => setResetOpen(true)}>
            Réinitialiser
          </Button>
        </Card>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Réinitialiser la pile réseau"
        icon={<RotateCcw className="size-5 text-danger" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>Annuler</Button>
            <Button variant="danger" loading={resetting} onClick={doReset}>Réinitialiser</Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Cette opération réinitialise Winsock et la configuration IP (droits administrateur requis).
          Un <span className="font-medium text-content">redémarrage</span> sera nécessaire pour finaliser.
        </p>
      </Modal>
    </div>
  );
}

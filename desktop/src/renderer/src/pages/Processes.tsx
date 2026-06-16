import { useMemo, useState } from 'react';
import { Search, RefreshCw, X, Activity, Cpu, MemoryStick } from 'lucide-react';
import { Card, Button, Input, Skeleton, PageHeader, IconButton } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { useAsync, useInterval } from '../lib/hooks';
import { toast } from '../store/toast';
import { cn } from '../lib/cn';
import type { ProcessItem } from '../lib/types';

export function Processes() {
  const { data, loading, reload, setData } = useAsync<ProcessItem[]>(() => window.api.processes.list());
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<ProcessItem | null>(null);
  const [killing, setKilling] = useState(false);

  useInterval(() => {
    window.api.processes.list().then(setData).catch(() => {});
  }, 3000);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (data ?? []).filter((p) => p.name.toLowerCase().includes(q));
  }, [data, query]);

  const totals = useMemo(() => {
    const cpu = (data ?? []).reduce((a, p) => a + p.cpu, 0);
    const mem = (data ?? []).reduce((a, p) => a + p.memMB, 0);
    return { cpu, mem, count: data?.length ?? 0 };
  }, [data]);

  const kill = async () => {
    if (!target) return;
    setKilling(true);
    const res = await window.api.processes.kill(target.pid);
    res.ok ? toast.success('Processus arrêté', target.name) : toast.error('Échec', res.message);
    setKilling(false);
    setTarget(null);
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Processus"
        subtitle="Surveillez et arrêtez les processus gourmands."
        action={
          <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => reload()}>
            Actualiser
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-4">
        {[
          { icon: Activity, label: 'Processus actifs', value: totals.count.toString() },
          { icon: Cpu, label: 'Charge CPU totale', value: `${totals.cpu.toFixed(0)}%` },
          { icon: MemoryStick, label: 'Mémoire totale', value: `${(totals.mem / 1024).toFixed(1)} Go` },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="flex items-center gap-3 py-4">
              <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-accent">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wide text-faint">{s.label}</p>
                <p className="font-mono text-lg font-semibold tabular text-content">{s.value}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-0">
        <div className="border-b border-border p-3">
          <Input
            icon={<Search className="size-4" />}
            placeholder="Rechercher un processus…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border px-4 py-2.5 text-2xs font-semibold uppercase tracking-wide text-faint">
          <span>Nom</span>
          <span className="w-20 text-right">CPU</span>
          <span className="w-24 text-right">Mémoire</span>
          <span className="w-10" />
        </div>

        <div className="max-h-[calc(100vh-26rem)] overflow-y-auto">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.pid}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border/50 px-4 py-2.5 transition-colors hover:bg-surface-2/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-content">{p.name}</p>
                  <p className="font-mono text-2xs text-faint">PID {p.pid} • {p.user}</p>
                </div>
                <span className={cn('w-20 text-right font-mono text-sm tabular', p.cpu >= 25 ? 'text-warn' : 'text-muted')}>
                  {p.cpu.toFixed(1)}%
                </span>
                <span className={cn('w-24 text-right font-mono text-sm tabular', p.memMB >= 1000 ? 'text-warn' : 'text-muted')}>
                  {p.memMB >= 1024 ? `${(p.memMB / 1024).toFixed(1)} Go` : `${p.memMB.toFixed(0)} Mo`}
                </span>
                <IconButton className="w-10 hover:text-danger" onClick={() => setTarget(p)} aria-label="Arrêter">
                  <X className="size-4" />
                </IconButton>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Arrêter le processus"
        icon={<X className="size-5 text-danger" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Annuler
            </Button>
            <Button variant="danger" loading={killing} onClick={kill}>
              Arrêter
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Voulez-vous arrêter <span className="font-medium text-content">{target?.name}</span> (PID{' '}
          {target?.pid}) ? Les données non enregistrées de ce programme seront perdues.
        </p>
      </Modal>
    </div>
  );
}

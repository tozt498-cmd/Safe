import { Link } from 'react-router-dom';
import { HardDrive, RefreshCw, Trash2, Database, Server } from 'lucide-react';
import { Card, Badge, Skeleton, PageHeader, Button, ProgressBar, StatTile } from '../components/ui/primitives';
import { RadialGauge } from '../components/ui/charts';
import { useAsync } from '../lib/hooks';
import type { DiskItem } from '../lib/types';

export function Disks() {
  const { data, loading, reload } = useAsync<DiskItem[]>(() => window.api.disks.list());

  const totals = (data ?? []).reduce(
    (a, d) => ({ size: a.size + d.sizeGB, used: a.used + d.usedGB, free: a.free + d.freeGB }),
    { size: 0, used: 0, free: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Disques"
        subtitle="État, capacité et espace disponible de vos lecteurs."
        action={
          <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => reload()}>
            Actualiser
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={<Server className="size-5" />} label="Capacité totale" value={`${totals.size.toFixed(0)} Go`} sub={`${data?.length ?? 0} lecteur(s)`} />
        <StatTile icon={<Database className="size-5" />} label="Espace utilisé" value={`${totals.used.toFixed(0)} Go`} />
        <StatTile icon={<HardDrive className="size-5" />} label="Espace libre" value={`${totals.free.toFixed(0)} Go`} tone="text-accent" />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)
          : data?.map((d) => {
              const critical = d.usePercent >= 90;
              return (
                <Card key={d.fs} hover>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-accent">
                        <HardDrive className="size-5" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-content">{d.fs}</p>
                        <p className="text-xs text-muted">{d.label}</p>
                      </div>
                    </div>
                    <Badge tone={critical ? 'danger' : d.usePercent >= 75 ? 'warn' : 'neutral'}>
                      {d.type}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center gap-6">
                    <RadialGauge value={d.usePercent} label="Occupé" size={128} />
                    <div className="flex-1 space-y-3 font-mono text-sm tabular">
                      <div className="flex justify-between">
                        <span className="text-muted">Total</span>
                        <span className="text-content">{d.sizeGB} Go</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Utilisé</span>
                        <span className="text-content">{d.usedGB} Go</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Libre</span>
                        <span className="text-accent">{d.freeGB} Go</span>
                      </div>
                      <ProgressBar value={d.usePercent} tone={critical ? 'danger' : d.usePercent >= 75 ? 'warn' : 'accent'} />
                    </div>
                  </div>

                  {critical && (
                    <Link to="/cleaning">
                      <Button variant="outline" size="sm" icon={<Trash2 className="size-4" />} className="mt-4 w-full">
                        Espace faible — libérer de l'espace
                      </Button>
                    </Link>
                  )}
                </Card>
              );
            })}
      </div>
    </div>
  );
}

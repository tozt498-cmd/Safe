import { useState } from 'react';
import { Power, RefreshCw, Rocket } from 'lucide-react';
import { Card, Badge, Toggle, Skeleton, PageHeader, EmptyState, Button } from '../components/ui/primitives';
import { useAsync } from '../lib/hooks';
import { toast } from '../store/toast';
import type { StartupItem } from '../lib/types';

const IMPACT: Record<StartupItem['impact'], 'danger' | 'warn' | 'neutral'> = {
  Élevé: 'danger',
  Moyen: 'warn',
  Faible: 'neutral',
};

export function Startup() {
  const { data, loading, reload, setData } = useAsync<StartupItem[]>(() => window.api.startup.list());
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (item: StartupItem, enable: boolean) => {
    setBusy(item.id);
    // mise à jour optimiste
    setData((prev) => prev?.map((p) => (p.id === item.id ? { ...p, enabled: enable } : p)) ?? prev);
    const res = await window.api.startup.set(item.id, enable);
    if (res.ok) {
      toast.success(res.message);
    } else {
      toast.error('Action impossible', res.message);
      setData((prev) => prev?.map((p) => (p.id === item.id ? { ...p, enabled: !enable } : p)) ?? prev);
    }
    setBusy(null);
  };

  const enabledCount = data?.filter((d) => d.enabled).length ?? 0;
  const highImpact = data?.filter((d) => d.enabled && d.impact === 'Élevé').length ?? 0;

  return (
    <div>
      <PageHeader
        title="Démarrage"
        subtitle="Désactivez les programmes qui ralentissent le démarrage de Windows."
        action={
          <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => reload()}>
            Actualiser
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-4">
        <Card className="py-4">
          <p className="text-2xs uppercase tracking-wide text-faint">Programmes actifs</p>
          <p className="font-mono text-2xl font-semibold tabular text-content">{enabledCount}</p>
        </Card>
        <Card className="py-4">
          <p className="text-2xs uppercase tracking-wide text-faint">Impact élevé</p>
          <p className="font-mono text-2xl font-semibold tabular text-danger">{highImpact}</p>
        </Card>
        <Card className="py-4">
          <p className="text-2xs uppercase tracking-wide text-faint">Total détecté</p>
          <p className="font-mono text-2xl font-semibold tabular text-muted">{data?.length ?? 0}</p>
        </Card>
      </div>

      <div className="space-y-2.5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[68px] rounded-2xl" />)
        ) : data && data.length > 0 ? (
          data.map((item) => (
            <Card key={item.id} className="flex items-center gap-4 py-3.5">
              <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-accent">
                <Power className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-content">{item.name}</p>
                  <Badge tone={IMPACT[item.impact]}>Impact {item.impact.toLowerCase()}</Badge>
                </div>
                <p className="truncate font-mono text-2xs text-faint">{item.location}</p>
              </div>
              <Toggle
                checked={item.enabled}
                disabled={busy === item.id}
                onChange={(v) => toggle(item, v)}
              />
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<Power className="size-8" />}
            title="Aucun programme au démarrage"
            message="Aucune entrée de démarrage automatique n'a été détectée sur ce système."
          />
        )}
      </div>

      <p className="mt-4 text-2xs text-faint">
        L'impact est estimé. Les entrées système peuvent nécessiter des droits administrateur pour
        être modifiées.
      </p>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Search, RefreshCw, Trash2, Boxes, Package } from 'lucide-react';
import { Card, Button, Input, Skeleton, PageHeader, EmptyState } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { useAsync } from '../lib/hooks';
import { toast } from '../store/toast';
import { formatDate } from '../lib/format';
import type { SoftwareItem } from '../lib/types';

export function Software() {
  const { data, loading, reload } = useAsync<SoftwareItem[]>(() => window.api.software.list());
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<SoftwareItem | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (data ?? []).filter(
      (s) => s.name.toLowerCase().includes(q) || s.publisher.toLowerCase().includes(q),
    );
  }, [data, query]);

  const totalSize = useMemo(
    () => (data ?? []).reduce((a, s) => a + (s.sizeMB ?? 0), 0),
    [data],
  );

  const uninstall = async () => {
    if (!target) return;
    setBusy(true);
    const res = await window.api.software.uninstall(target.uninstallString);
    res.ok ? toast.success('Désinstallation', res.message) : toast.error('Échec', res.message);
    setBusy(false);
    setTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="Logiciels"
        subtitle="Gérez et désinstallez proprement les applications installées."
        action={
          <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => reload()} loading={loading}>
            Actualiser
          </Button>
        }
      />

      <div className="mb-5 flex gap-4">
        <Card className="flex flex-1 items-center gap-3 py-3.5">
          <Boxes className="size-5 text-accent" />
          <div>
            <p className="text-2xs uppercase tracking-wide text-faint">Applications</p>
            <p className="font-mono text-lg font-semibold tabular text-content">{data?.length ?? 0}</p>
          </div>
        </Card>
        <Card className="flex flex-1 items-center gap-3 py-3.5">
          <Package className="size-5 text-accent" />
          <div>
            <p className="text-2xs uppercase tracking-wide text-faint">Espace total estimé</p>
            <p className="font-mono text-lg font-semibold tabular text-content">
              {(totalSize / 1024).toFixed(1)} Go
            </p>
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-border p-3">
          <Input
            icon={<Search className="size-4" />}
            placeholder="Rechercher une application…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[calc(100vh-24rem)] overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={<Boxes className="size-8" />} title="Aucune application trouvée" />
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 border-b border-border/50 px-4 py-3 transition-colors hover:bg-surface-2/30"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2/60 text-muted">
                  {s.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">{s.name}</p>
                  <p className="truncate text-xs text-muted">
                    {s.publisher} • v{s.version}
                    {s.installDate ? ` • ${formatDate(s.installDate)}` : ''}
                  </p>
                </div>
                <span className="hidden w-20 text-right font-mono text-xs tabular text-faint sm:block">
                  {s.sizeMB ? (s.sizeMB >= 1024 ? `${(s.sizeMB / 1024).toFixed(1)} Go` : `${s.sizeMB.toFixed(0)} Mo`) : '—'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-danger"
                  icon={<Trash2 className="size-4" />}
                  onClick={() => setTarget(s)}
                >
                  Désinstaller
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Désinstaller le logiciel"
        icon={<Trash2 className="size-5 text-danger" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Annuler
            </Button>
            <Button variant="danger" loading={busy} onClick={uninstall}>
              Désinstaller
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Lancer la désinstallation de{' '}
          <span className="font-medium text-content">{target?.name}</span> ? Le désinstalleur officiel
          de l'éditeur s'ouvrira pour une suppression propre.
        </p>
      </Modal>
    </div>
  );
}

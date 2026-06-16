import { useEffect, useState } from 'react';
import {
  Trash2,
  RefreshCw,
  FileText,
  Globe,
  Image,
  Bug,
  Download,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Card, Button, Badge, Skeleton, PageHeader } from '../components/ui/primitives';
import { useAsync } from '../lib/hooks';
import { toast } from '../store/toast';
import { formatBytes } from '../lib/format';
import { cn } from '../lib/cn';
import type { CleanScan, CleanResult } from '../lib/types';

const ICONS: Record<string, typeof FileText> = {
  'user-temp': FileText,
  'windows-temp': FileText,
  'browser-cache': Globe,
  thumbnails: Image,
  'crash-dumps': Bug,
  'windows-update': Download,
  'recycle-bin': RotateCcw,
};

export function Cleaning() {
  const scan = useAsync<CleanScan>(() => window.api.clean.scan());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<CleanResult | null>(null);

  useEffect(() => {
    if (scan.data) {
      setSelected(new Set(scan.data.categories.filter((c) => c.recommended && c.sizeBytes > 0).map((c) => c.id)));
    }
  }, [scan.data]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedBytes =
    scan.data?.categories.filter((c) => selected.has(c.id)).reduce((a, c) => a + c.sizeBytes, 0) ?? 0;

  const clean = async () => {
    if (!selected.size) return;
    setCleaning(true);
    setResult(null);
    try {
      const res = await window.api.clean.run([...selected]);
      setResult(res);
      toast.success('Nettoyage terminé', `${formatBytes(res.freedBytes)} libérés.`);
      window.api.app.notify('Nettoyage terminé', `${formatBytes(res.freedBytes)} d'espace récupérés.`);
      await scan.reload();
    } catch {
      toast.error('Échec du nettoyage');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Nettoyage"
        subtitle="Libérez de l'espace en supprimant les fichiers inutiles."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="size-4" />}
            onClick={() => scan.reload()}
            loading={scan.loading}
          >
            Analyser à nouveau
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {scan.loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-2xl" />)
            : scan.data?.categories.map((c) => {
                const Icon = ICONS[c.id] ?? FileText;
                const active = selected.has(c.id);
                const empty = c.sizeBytes === 0;
                return (
                  <button
                    key={c.id}
                    disabled={empty}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-150',
                      empty
                        ? 'cursor-default border-border bg-surface/40 opacity-50'
                        : active
                          ? 'border-accent/40 bg-accent/[0.06] shadow-glow-sm'
                          : 'border-border bg-surface/60 hover:border-border-strong',
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-5 items-center justify-center rounded-md border transition-colors',
                        active ? 'border-accent bg-accent text-[#04130d]' : 'border-border-strong',
                      )}
                    >
                      {active && <Check className="size-3.5" strokeWidth={3} />}
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-accent">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-content">{c.label}</p>
                        {c.recommended && <Badge tone="accent">Recommandé</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted">{c.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold tabular text-content">
                        {formatBytes(c.sizeBytes)}
                      </p>
                      <p className="text-2xs text-faint">{c.fileCount} fichiers</p>
                    </div>
                  </button>
                );
              })}
        </div>

        {/* Récapitulatif */}
        <div>
          <Card className="sticky top-0">
            <div className="text-center">
              <p className="text-2xs uppercase tracking-wide text-faint">Espace sélectionné</p>
              <p className="mt-1 font-mono text-4xl font-semibold tabular text-accent">
                {formatBytes(selectedBytes)}
              </p>
              <p className="mt-1 text-xs text-muted">
                sur {formatBytes(scan.data?.totalBytes ?? 0)} récupérables
              </p>
            </div>

            <Button
              size="lg"
              icon={<Trash2 className="size-5" />}
              onClick={clean}
              loading={cleaning}
              disabled={!selected.size}
              className="mt-5 w-full"
            >
              Nettoyer {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>

            {result && (
              <div className="mt-4 animate-slide-up rounded-xl border border-accent/25 bg-accent/[0.06] p-4 text-center">
                <p className="font-mono text-2xl font-semibold text-accent">{formatBytes(result.freedBytes)}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {result.removedFiles} fichiers supprimés
                  {result.errors > 0 && ` • ${result.errors} ignorés`}
                </p>
              </div>
            )}

            <p className="mt-4 text-2xs leading-relaxed text-faint">
              Certains emplacements (système, mises à jour) requièrent des droits administrateur. Les
              fichiers en cours d'utilisation sont ignorés automatiquement.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

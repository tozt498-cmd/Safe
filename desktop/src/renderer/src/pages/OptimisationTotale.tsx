import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ShieldCheck,
  Trash2,
  MemoryStick,
  Cpu,
  Power,
  HardDrive,
  Network,
  Database,
  EyeOff,
  Zap,
  Wind,
  Boxes,
  Gamepad2,
  Check,
  Loader2,
  CircleAlert,
  X,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { Card, Button, Badge, Skeleton } from '../components/ui/primitives';
import { Modal } from '../components/ui/Modal';
import { useAsync } from '../lib/hooks';
import { toast } from '../store/toast';
import { formatBytes } from '../lib/format';
import { cn } from '../lib/cn';
import type { TotalCategory, TotalProgress, TotalReport, TotalStepStatus } from '../lib/types';

const ICONS: Record<string, LucideIcon> = {
  'restore-point': ShieldCheck,
  'deep-clean': Trash2,
  memory: MemoryStick,
  cpu: Cpu,
  startup: Power,
  disks: HardDrive,
  network: Network,
  registry: Database,
  telemetry: EyeOff,
  'power-plan': Zap,
  'visual-effects': Wind,
  bloatware: Boxes,
  'game-mode': Gamepad2,
};

type Phase = 'idle' | 'running' | 'done';

interface LiveStep {
  status: TotalStepStatus;
  detail: string;
}

export function OptimisationTotale() {
  const cats = useAsync<TotalCategory[]>(() => window.api.total.categories());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('idle');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<Record<string, LiveStep>>({});
  const [report, setReport] = useState<TotalReport | null>(null);
  const offRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (cats.data) setSelected(new Set(cats.data.filter((c) => c.recommended).map((c) => c.id)));
  }, [cats.data]);

  useEffect(() => () => offRef.current?.(), []);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const sensitiveSelected = (cats.data ?? []).filter((c) => c.sensitive && selected.has(c.id));

  const start = async () => {
    setConfirmOpen(false);
    setPhase('running');
    setProgress(0);
    setReport(null);
    const init: Record<string, LiveStep> = {};
    (cats.data ?? [])
      .filter((c) => selected.has(c.id))
      .forEach((c) => (init[c.id] = { status: 'pending', detail: '' }));
    setLive(init);

    offRef.current = window.api.total.onProgress((p: TotalProgress) => {
      setProgress(p.overallPercent);
      setLive((prev) => ({ ...prev, [p.current.id]: { status: p.current.status, detail: p.current.detail } }));
    });

    try {
      const res = await window.api.total.run([...selected]);
      setReport(res);
      setPhase('done');
      window.api.app.notify(
        'Optimisation Totale terminée',
        `${formatBytes(res.freedBytes)} libérés • ${res.memoryFreedMB} Mo de RAM • ${res.itemsOptimized} éléments optimisés.`,
      );
      toast.success('Optimisation Totale terminée', `${formatBytes(res.freedBytes)} récupérés.`);
    } catch {
      toast.error('Optimisation interrompue', 'Une erreur est survenue.');
      setPhase('idle');
    } finally {
      offRef.current?.();
      offRef.current = null;
    }
  };

  const reset = () => {
    setPhase('idle');
    setReport(null);
    setLive({});
    setProgress(0);
  };

  const runningList = (cats.data ?? []).filter((c) => selected.has(c.id));

  return (
    <div>
      {/* Hero */}
      <Card className="relative mb-6 overflow-hidden p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-accent-deep/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-accent">
              <Sparkles className="size-3.5" /> Fonctionnalité phare
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-content">Optimisation Totale</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Une optimisation complète et profonde de tout l'ordinateur en une fois : nettoyage,
              mémoire, disques, réseau, services et performances. Un point de restauration est créé
              avant toute modification.
            </p>
          </div>
          <div className="shrink-0 text-center">
            <Button
              size="lg"
              icon={<Sparkles className="size-5" />}
              onClick={() => setConfirmOpen(true)}
              loading={phase === 'running'}
              disabled={selected.size === 0 || phase === 'running'}
              className="h-14 px-8 text-base"
            >
              Lancer l'optimisation totale
            </Button>
            <p className="mt-2 text-2xs text-faint">{selected.size} catégorie(s) sélectionnée(s)</p>
          </div>
        </div>
      </Card>

      {/* Progression / Rapport */}
      {phase !== 'idle' && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-content">
              {phase === 'running' ? 'Optimisation en cours…' : 'Optimisation terminée'}
            </h3>
            <span className="font-mono text-sm font-semibold tabular text-accent">{progress}%</span>
          </div>
          <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-accent-grad"
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.4 }}
            />
          </div>

          {report && (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Espace libéré', value: formatBytes(report.freedBytes) },
                { label: 'RAM récupérée', value: `${report.memoryFreedMB} Mo` },
                { label: 'Éléments optimisés', value: String(report.itemsOptimized) },
                { label: 'Durée', value: `${(report.durationMs / 1000).toFixed(1)} s` },
              ].map((s) => (
                <div key={s.label} className="panel p-4 text-center">
                  <p className="font-mono text-2xl font-semibold tabular text-accent">{s.value}</p>
                  <p className="text-2xs uppercase tracking-wide text-faint">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            {runningList.map((c) => {
              const st = live[c.id]?.status ?? 'pending';
              const Icon = ICONS[c.id] ?? Sparkles;
              return (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                    st === 'running'
                      ? 'border-accent/30 bg-accent/[0.05]'
                      : 'border-border/60 bg-surface-2/20',
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted" />
                  <span className="flex-1 text-sm text-content">{c.label}</span>
                  <span className="text-xs text-muted">{live[c.id]?.detail}</span>
                  <StatusIcon status={st} />
                </div>
              );
            })}
          </div>

          {phase === 'done' && (
            <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={reset} className="mt-5">
              Nouvelle optimisation
            </Button>
          )}
        </Card>
      )}

      {/* Sélection des catégories */}
      {phase === 'idle' && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-content">Catégories à optimiser</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cats.loading
              ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-2xl" />)
              : cats.data?.map((c) => {
                  const Icon = ICONS[c.id] ?? Sparkles;
                  const active = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      className={cn(
                        'group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200',
                        active
                          ? 'border-accent/40 bg-accent/[0.06] shadow-glow-sm'
                          : 'border-border bg-surface/50 hover:border-border-strong hover:-translate-y-0.5',
                      )}
                    >
                      <div className={cn('icon-chip size-9 shrink-0', !active && 'opacity-80')}>
                        <Icon className="size-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-content">{c.label}</p>
                          {c.sensitive && <Badge tone="warn">Sensible</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-muted">{c.description}</p>
                      </div>
                      <div
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                          active ? 'border-accent bg-accent text-[#04130d]' : 'border-border-strong',
                        )}
                      >
                        {active && <Check className="size-3.5" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
          </div>
        </>
      )}

      {/* Confirmation */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        icon={<Sparkles className="size-5 text-accent" />}
        title="Lancer l'optimisation totale ?"
        subtitle={`${selected.size} catégorie(s) seront traitées`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button onClick={start} icon={<Sparkles className="size-4" />}>
              Confirmer et lancer
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Un <span className="font-medium text-content">point de restauration</span> sera créé avant
          toute modification pour pouvoir revenir en arrière.
        </p>
        {sensitiveSelected.length > 0 && (
          <div className="mt-4 rounded-xl border border-warn/25 bg-warn/10 p-3.5">
            <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-warn">
              <CircleAlert className="size-4" /> Actions sensibles sélectionnées
            </p>
            <ul className="space-y-1 text-xs text-muted">
              {sensitiveSelected.map((c) => (
                <li key={c.id}>• {c.label}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-2xs text-faint">
          Certaines actions nécessitent des droits administrateur. Les opérations refusées sont
          ignorées sans risque.
        </p>
      </Modal>
    </div>
  );
}

function StatusIcon({ status }: { status: TotalStepStatus }) {
  if (status === 'running') return <Loader2 className="size-4 shrink-0 animate-spin text-accent" />;
  if (status === 'done') return <Check className="size-4 shrink-0 text-accent" strokeWidth={3} />;
  if (status === 'error') return <X className="size-4 shrink-0 text-danger" />;
  if (status === 'skipped') return <span className="text-2xs text-faint">ignoré</span>;
  return <span className="size-2 shrink-0 rounded-full bg-border-strong" />;
}

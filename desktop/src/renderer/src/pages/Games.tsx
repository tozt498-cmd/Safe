import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket,
  Check,
  Loader2,
  X,
  RotateCcw,
  Cpu,
  MemoryStick,
  Monitor,
  Thermometer,
  Wifi,
} from 'lucide-react';
import { Card, Button, Skeleton, PageHeader } from '../components/ui/primitives';
import { GameArt } from '../components/GameArt';
import { useAsync, useInterval } from '../lib/hooks';
import { toast } from '../store/toast';
import { formatBytes } from '../lib/format';
import { cn } from '../lib/cn';
import type { GameInfo, GameProgress, GameReport, LiveStats, TotalStepStatus } from '../lib/types';

type Phase = 'idle' | 'running' | 'done';

export function Games() {
  const games = useAsync<GameInfo[]>(() => window.api.games.list());
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<Record<string, { status: TotalStepStatus; detail: string }>>({});
  const [steps, setSteps] = useState<{ id: string; label: string }[]>([]);
  const [report, setReport] = useState<GameReport | null>(null);
  const [mon, setMon] = useState<LiveStats | null>(null);
  const offRef = useRef<(() => void) | null>(null);

  useInterval(() => window.api.metrics.live().then(setMon).catch(() => {}), 2000);
  useEffect(() => {
    window.api.metrics.live().then(setMon).catch(() => {});
    return () => offRef.current?.();
  }, []);

  const selectedGame = games.data?.find((g) => g.id === selected) ?? null;

  const optimize = async () => {
    if (!selectedGame) return;
    setPhase('running');
    setProgress(0);
    setReport(null);
    setSteps([]);
    setLive({});
    offRef.current = window.api.games.onProgress((p: GameProgress) => {
      setProgress(p.overallPercent);
      setSteps((prev) => (prev.some((s) => s.id === p.current.id) ? prev : [...prev, { id: p.current.id, label: p.current.label }]));
      setLive((prev) => ({ ...prev, [p.current.id]: { status: p.current.status, detail: p.current.detail } }));
    });
    try {
      const res = await window.api.games.run(selectedGame.id);
      setReport(res);
      setPhase('done');
      window.api.app.notify(
        `Optimisation ${res.gameName} terminée`,
        `${formatBytes(res.freedBytes)} libérés • ${res.memoryFreedMB} Mo de RAM • ${res.itemsOptimized} éléments.`,
      );
      toast.success(`${res.gameName} optimisé`, `${formatBytes(res.freedBytes)} récupérés.`);
    } catch {
      toast.error('Optimisation interrompue');
      setPhase('idle');
    } finally {
      offRef.current?.();
      offRef.current = null;
    }
  };

  const reset = () => {
    setPhase('idle');
    setReport(null);
    setProgress(0);
    setSteps([]);
    setLive({});
  };

  const monitors = [
    { icon: Cpu, label: 'CPU', value: mon ? `${mon.cpu.load.toFixed(0)}%` : '—' },
    { icon: MemoryStick, label: 'RAM', value: mon ? `${mon.mem.percent.toFixed(0)}%` : '—' },
    { icon: Monitor, label: 'GPU', value: mon?.gpu.load != null ? `${mon.gpu.load}%` : 'N/A' },
    { icon: Thermometer, label: 'Temp CPU', value: mon?.cpu.tempC != null ? `${mon.cpu.tempC}°C` : 'N/A' },
  ];

  return (
    <div>
      <PageHeader title="Jeux" subtitle="Optimisations dédiées par jeu pour plus de FPS et moins de latence." />

      {/* Moniteur de performances en direct */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {monitors.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="card flex items-center gap-3 p-4">
              <div className="icon-chip size-10 shrink-0">
                <Icon className="size-[18px]" />
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wide text-faint">{m.label}</p>
                <p className="font-mono text-lg font-semibold tabular text-content">{m.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cartes de jeux */}
      {phase === 'idle' && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-content">Choisis un jeu</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {games.loading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)
              : games.data?.map((g) => {
                  const active = selected === g.id;
                  return (
                    <motion.button
                      key={g.id}
                      onClick={() => setSelected(g.id)}
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'relative overflow-hidden rounded-2xl border bg-surface/60 p-4 text-left transition-shadow',
                        active ? 'shadow-glow-sm' : 'border-border hover:border-border-strong',
                      )}
                      style={active ? { borderColor: `${g.accent}99`, boxShadow: `0 0 0 1px ${g.accent}55, 0 0 30px -8px ${g.accent}80` } : undefined}
                    >
                      <div className="relative h-40 overflow-hidden rounded-xl">
                        <GameArt id={g.id} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                        <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
                          <div>
                            <p
                              className="text-xl font-bold tracking-tight text-white"
                              style={{ textShadow: '0 2px 10px rgba(0,0,0,.55)' }}
                            >
                              {g.name}
                            </p>
                            <p className="text-2xs font-medium text-white/85">{g.tagline}</p>
                          </div>
                          {g.running && (
                            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-[#04130d]">
                              En jeu
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-2xs text-faint">
                          {g.running ? 'Détecté en cours d\'exécution' : 'Non lancé'}
                        </span>
                        <div
                          className={cn(
                            'flex size-5 items-center justify-center rounded-md border transition-colors',
                            active ? 'text-[#04130d]' : 'border-border-strong',
                          )}
                          style={active ? { background: g.accent, borderColor: g.accent } : undefined}
                        >
                          {active && <Check className="size-3.5" strokeWidth={3} />}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-surface/50 p-4">
            <div className="flex items-center gap-3">
              <div className="icon-chip size-10">
                <Rocket className="size-[18px]" />
              </div>
              <div>
                <p className="text-sm font-medium text-content">
                  {selectedGame ? `Prêt à optimiser ${selectedGame.name}` : 'Sélectionne un jeu pour commencer'}
                </p>
                <p className="text-xs text-muted">Réseau, FPS, shaders, priorité CPU, overlays, alimentation.</p>
              </div>
            </div>
            <Button size="lg" icon={<Rocket className="size-5" />} disabled={!selectedGame} onClick={optimize}>
              Optimiser{selectedGame ? ` ${selectedGame.name}` : ''}
            </Button>
          </div>
        </>
      )}

      {/* Progression / rapport */}
      {phase !== 'idle' && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-content">
              {phase === 'running' ? `Optimisation de ${selectedGame?.name}…` : `${report?.gameName} optimisé`}
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
            {steps.map((s) => {
              const st = live[s.id]?.status ?? 'pending';
              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                    st === 'running' ? 'border-accent/30 bg-accent/[0.05]' : 'border-border/60 bg-surface-2/20',
                  )}
                >
                  <Wifi className="size-4 shrink-0 text-muted" />
                  <span className="flex-1 text-sm text-content">{s.label}</span>
                  <span className="text-xs text-muted">{live[s.id]?.detail}</span>
                  {st === 'running' && <Loader2 className="size-4 shrink-0 animate-spin text-accent" />}
                  {st === 'done' && <Check className="size-4 shrink-0 text-accent" strokeWidth={3} />}
                  {st === 'error' && <X className="size-4 shrink-0 text-danger" />}
                </div>
              );
            })}
          </div>

          {phase === 'done' && (
            <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={reset} className="mt-5">
              Optimiser un autre jeu
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}

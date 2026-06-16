import { useState } from 'react';
import { Gauge, Cpu, Cpu as CpuIcon, MemoryStick, HardDrive, Play, Trophy } from 'lucide-react';
import { Card, CardHeader, Button, PageHeader, EmptyState } from '../components/ui/primitives';
import { useAsync } from '../lib/hooks';
import { toast } from '../store/toast';
import { cn } from '../lib/cn';
import type { BenchmarkResult } from '../lib/types';

const BEST_KEY = 'sm.benchBest';
function loadBest(): BenchmarkResult | null {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || 'null');
  } catch {
    return null;
  }
}

const TIERS = [
  { label: 'Entrée de gamme', score: 1500 },
  { label: 'Milieu de gamme', score: 4000 },
  { label: 'Haut de gamme', score: 8000 },
];

export function Benchmark() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(loadBest());
  const best = loadBest();

  const run = async () => {
    setRunning(true);
    try {
      const res = await window.api.benchmark.run();
      setResult(res);
      if (!best || res.overall > best.overall) {
        localStorage.setItem(BEST_KEY, JSON.stringify(res));
        toast.success('Nouveau record !', `Score global : ${res.overall}`);
      } else {
        toast.success('Benchmark terminé', `Score global : ${res.overall}`);
      }
    } catch {
      toast.error('Benchmark échoué');
    } finally {
      setRunning(false);
    }
  };

  const subs = result
    ? [
        { icon: CpuIcon, label: 'CPU mono-cœur', value: result.cpuSingle, max: 4000 },
        { icon: Cpu, label: 'CPU multi-cœurs', value: result.cpuMulti, max: 30000 },
        { icon: MemoryStick, label: 'Mémoire', value: result.memoryScore, max: 30000 },
        { icon: HardDrive, label: 'Disque', value: result.diskScore, max: 5000 },
      ]
    : [];

  const tierMax = TIERS[TIERS.length - 1].score * 1.2;

  return (
    <div>
      <PageHeader
        title="Benchmark"
        subtitle="Évaluez les performances de votre machine."
        action={
          <Button icon={<Play className="size-4" />} loading={running} onClick={run}>
            {result ? 'Relancer le test' : 'Lancer le benchmark'}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Score global */}
        <Card className="flex flex-col items-center justify-center text-center lg:col-span-1">
          {running ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <Gauge className="size-10 animate-pulse-soft text-accent" />
              <p className="text-sm text-muted">Test en cours…</p>
              <p className="text-2xs text-faint">CPU · Mémoire · Disque</p>
            </div>
          ) : result ? (
            <>
              <p className="text-2xs uppercase tracking-[0.2em] text-faint">Score global</p>
              <p className="my-2 font-mono text-6xl font-semibold tabular text-accent">{result.overall}</p>
              {best && (
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Trophy className="size-3.5 text-warn" /> Record : {best.overall}
                </p>
              )}
              <p className="mt-1 text-2xs text-faint">Durée : {(result.durationMs / 1000).toFixed(1)} s</p>
            </>
          ) : (
            <EmptyState icon={<Gauge className="size-9" />} title="Aucun résultat" message="Lancez le benchmark pour obtenir votre score." />
          )}
        </Card>

        {/* Sous-scores */}
        <Card className="lg:col-span-2">
          <CardHeader title="Détail des performances" icon={<Cpu className="size-[18px]" />} />
          {result ? (
            <div className="space-y-4">
              {subs.map((s) => {
                const Icon = s.icon;
                const pct = Math.min(100, (s.value / s.max) * 100);
                return (
                  <div key={s.label}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-muted">
                        <Icon className="size-4 text-accent" /> {s.label}
                      </span>
                      <span className="font-mono text-sm font-semibold tabular text-content">
                        {s.value.toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent-grad transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-faint">
              Les sous-scores apparaîtront après le test.
            </div>
          )}
        </Card>
      </div>

      {/* Comparaison */}
      <Card className="mt-5">
        <CardHeader title="Comparaison" subtitle="Positionnement de votre score global" icon={<Trophy className="size-[18px]" />} />
        <div className="relative pt-6">
          <div className="relative h-2.5 rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent-grad transition-all duration-700"
              style={{ width: `${Math.min(100, ((result?.overall ?? 0) / tierMax) * 100)}%` }}
            />
            {TIERS.map((t) => (
              <div
                key={t.label}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${(t.score / tierMax) * 100}%` }}
              >
                <div className="size-3 -translate-x-1/2 rounded-full border-2 border-bg bg-border-strong" />
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-2xs text-faint">
                  {t.label}
                </span>
                <span className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-2xs text-faint">
                  {t.score.toLocaleString('fr-FR')}
                </span>
              </div>
            ))}
            {result && (
              <div
                className={cn('absolute top-1/2 -translate-y-1/2 transition-all duration-700')}
                style={{ left: `${Math.min(100, (result.overall / tierMax) * 100)}%` }}
              >
                <div className="size-4 -translate-x-1/2 rounded-full border-2 border-bg bg-accent shadow-glow-sm" />
              </div>
            )}
          </div>
        </div>
        <p className="mt-10 text-2xs text-faint">
          Scores indicatifs mesurés localement (calcul CPU, débit mémoire et disque). À titre de
          repère uniquement.
        </p>
      </Card>
    </div>
  );
}

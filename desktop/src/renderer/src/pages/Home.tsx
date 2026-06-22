import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  Lock,
  Loader2,
  Trash2,
  LineChart,
  Signal,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Badge, Skeleton, ProgressBar, Button } from '../components/ui/primitives';
import { HealthRing, RadialGauge, AreaChart } from '../components/ui/charts';
import { Modal } from '../components/ui/Modal';
import { useAsync, useInterval } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { useStats } from '../store/stats';
import { isPro } from '../lib/entitlement';
import { toast } from '../store/toast';
import { formatBytes, formatUptime } from '../lib/format';
import type { HealthScore, SystemInfo, LiveStats, BoostResult } from '../lib/types';

// Apparition échelonnée des cellules du bento.
const cell = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] as const },
});

const CAP = 40;
function push(arr: number[], v: number): number[] {
  const next = [...arr, v];
  return next.length > CAP ? next.slice(next.length - CAP) : next;
}

function GaugeTile({
  label,
  sub,
  value,
}: {
  label: string;
  sub?: string;
  value: number | null;
}) {
  return (
    <Card hover className="flex h-full items-center gap-3.5">
      {value == null ? (
        <div className="grid size-[64px] shrink-0 place-items-center rounded-full border border-border bg-surface-2 font-mono text-2xs text-faint">
          N/A
        </div>
      ) : (
        <RadialGauge value={value} size={64} />
      )}
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>}
      </div>
    </Card>
  );
}

export function Home() {
  const health = useAsync<HealthScore>(() => window.api.metrics.health());
  const info = useAsync<SystemInfo>(() => window.api.metrics.info());
  const [live, setLive] = useState<LiveStats | null>(null);
  const [boosting, setBoosting] = useState(false);
  const [result, setResult] = useState<BoostResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();
  const pro = isPro(useAuth((s) => s.user));
  const histRef = useRef({ cpu: [] as number[], mem: [] as number[] });

  useInterval(() => {
    window.api.metrics
      .live()
      .then((s) => {
        const hh = histRef.current;
        hh.cpu = push(hh.cpu, s.cpu.load);
        hh.mem = push(hh.mem, s.mem.percent);
        setLive(s);
      })
      .catch(() => {});
  }, 1500);

  const runBoost = async () => {
    setModalOpen(true);
    setBoosting(true);
    setResult(null);
    try {
      const res = await window.api.boost.run();
      setResult(res);
      useStats.getState().record({ freedBytes: res.freedBytes, ramMB: res.memoryFreedMB });
      await health.reload();
      window.api.app.notify(
        'Optimisation terminée',
        `${formatBytes(res.freedBytes)} nettoyés • ${res.memoryFreedMB} Mo de RAM libérés.`,
      );
      toast.success('Optimisation terminée', `${formatBytes(res.freedBytes)} récupérés.`);
    } catch {
      toast.error('Échec de l\'optimisation', 'Réessayez en mode administrateur.');
      setModalOpen(false);
    } finally {
      setBoosting(false);
    }
  };

  const h = health.data;
  const hist = histRef.current;

  return (
    <div className="relative isolate">
      {/* Ambiance lumineuse en fond */}
      <div
        aria-hidden
        className="blob -z-10 bg-accent animate-aurora"
        style={{ width: '26rem', height: '26rem', top: '-9rem', left: '-7rem' }}
      />
      <div
        aria-hidden
        className="blob -z-10 bg-info animate-aurora"
        style={{ width: '20rem', height: '20rem', top: '3rem', right: '-8rem', animationDelay: '-7s' }}
      />

      <div className="mb-6">
        <span className="eyebrow">Tableau de bord</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-content">Bonjour.</h1>
        <p className="mt-1 text-sm text-muted">
          {info.data ? `${info.data.hostname} • ${info.data.os}` : 'Analyse de votre système…'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4 lg:auto-rows-min">
        {/* Score de santé — pièce maîtresse */}
        <motion.div {...cell(0)} className="lg:col-span-2 lg:row-span-2">
          <Card className="glow-border flex h-full flex-col gap-6 p-6 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-col items-center gap-3">
              {health.loading || !h ? (
                <Skeleton className="size-[224px] rounded-full" />
              ) : (
                <>
                  <HealthRing score={h.score} />
                  <Badge tone={h.score >= 75 ? 'accent' : h.score >= 50 ? 'warn' : 'danger'} dot>
                    {h.grade}
                  </Badge>
                </>
              )}
            </div>

            <div className="w-full flex-1">
              <span className="eyebrow">État du système</span>
              <div className="mt-4 space-y-3.5">
                {health.loading || !h
                  ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)
                  : h.factors.map((f) => (
                      <div key={f.label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted">{f.label}</span>
                          <span className="font-mono tabular text-faint">{f.detail}</span>
                        </div>
                        <ProgressBar
                          value={f.value}
                          tone={f.value >= 70 ? 'accent' : f.value >= 45 ? 'warn' : 'danger'}
                        />
                      </div>
                    ))}
              </div>

              {pro ? (
                <button
                  onClick={runBoost}
                  disabled={boosting}
                  className="hero-cta group mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-[15px] font-semibold animate-glow-pulse transition active:translate-y-px disabled:opacity-70"
                >
                  {boosting ? <Loader2 className="size-5 animate-spin" /> : <Zap className="size-5" />}
                  Optimisation en 1 clic
                </button>
              ) : (
                <button
                  onClick={() => navigate('/shop')}
                  className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-accent/40 px-6 py-4 text-[15px] font-semibold text-accent transition hover:bg-accent/10 hover:border-accent/60"
                >
                  <Lock className="size-5" /> Débloquer l'optimisation (Pro)
                </button>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Tuiles de métriques live */}
        <motion.div {...cell(1)}>
          <GaugeTile label="Processeur" sub={info.data?.cpuBrand} value={live ? live.cpu.load : null} />
        </motion.div>
        <motion.div {...cell(2)}>
          <GaugeTile
            label="Mémoire"
            sub={live ? `${live.mem.usedGB} / ${live.mem.totalGB} Go` : undefined}
            value={live ? live.mem.percent : null}
          />
        </motion.div>
        <motion.div {...cell(3)}>
          <GaugeTile label="Carte graphique" sub={info.data?.gpuModel} value={live?.gpu.load ?? null} />
        </motion.div>
        <motion.div {...cell(4)}>
          <Card hover className="flex h-full items-center gap-3.5">
            <div className="icon-chip size-[64px] shrink-0">
              <Clock className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs font-medium uppercase tracking-wide text-faint">Activité</p>
              <p className="mt-0.5 font-mono text-base font-semibold tabular text-content">
                {info.data ? formatUptime(info.data.uptimeSec) : '—'}
              </p>
              <p className="text-2xs text-muted">Temps de fonctionnement</p>
            </div>
          </Card>
        </motion.div>

        {/* Optimisation Totale — carte hero */}
        <motion.div {...cell(5)} className="lg:col-span-2">
          <Link to="/total" className="block h-full">
            <Card hover className="group relative flex h-full items-center gap-4 overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-accent/15 blur-3xl transition-opacity group-hover:opacity-150" />
              <div className="icon-chip size-14 shrink-0 animate-float">
                <Sparkles className="size-7" />
              </div>
              <div className="relative min-w-0 flex-1">
                <p className="text-base font-semibold text-content">Optimisation Totale</p>
                <p className="mt-0.5 text-xs text-muted">
                  Nettoyage profond, mémoire, disques, réseau et performances — en une action.
                </p>
              </div>
              <span className="relative inline-flex items-center gap-1.5 rounded-xl bg-accent-grad px-4 py-2.5 text-sm font-semibold text-[#04130d] transition-transform group-hover:translate-x-0.5">
                Lancer <ArrowRight className="size-4" />
              </span>
            </Card>
          </Link>
        </motion.div>

        {/* Courbe de performances */}
        <motion.div {...cell(6)} className="lg:col-span-2">
          <Card className="h-full p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">Performances en direct</span>
              <div className="flex gap-3 font-mono text-2xs tabular">
                <span className="text-accent">CPU {live ? live.cpu.load.toFixed(0) : '0'}%</span>
                <span className="text-info">RAM {live ? live.mem.percent.toFixed(0) : '0'}%</span>
              </div>
            </div>
            <div className="relative">
              <AreaChart data={hist.cpu} max={100} height={92} />
              <div className="absolute inset-0">
                <AreaChart data={hist.mem} max={100} height={92} color="rgb(var(--info))" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Raccourcis */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { to: '/cleaning', title: 'Nettoyer le disque', text: 'Supprimer les fichiers inutiles.', icon: Trash2 },
          { to: '/dashboard', title: 'Surveiller en direct', text: 'Graphiques temps réel.', icon: LineChart },
          { to: '/connection', title: 'Optimiser la connexion', text: 'Test de débit et DNS.', icon: Signal },
        ].map((s, i) => (
          <motion.div key={s.to} {...cell(7 + i)}>
            <Link to={s.to}>
              <Card hover className="group flex items-center gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-accent transition-colors group-hover:border-accent/40">
                  <s.icon className="size-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-content">{s.title}</p>
                  <p className="text-xs text-muted">{s.text}</p>
                </div>
                <ArrowRight className="size-4 text-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Modal de boost */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        dismissable={!boosting}
        icon={<Zap className="size-5 text-accent" />}
        title="Optimisation en 1 clic"
        subtitle={boosting ? 'Optimisation en cours…' : 'Optimisation terminée'}
        footer={
          !boosting && (
            <Button onClick={() => setModalOpen(false)} variant="secondary">
              Fermer
            </Button>
          )
        }
      >
        {boosting && !result && (
          <div className="space-y-4 py-2">
            <ProgressBar value={66} />
            <p className="text-center text-sm text-muted">
              Nettoyage, libération mémoire et optimisation réseau…
            </p>
          </div>
        )}
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-surface-2/40 p-4 text-center">
                <p className="font-mono text-2xl font-semibold text-accent">
                  {formatBytes(result.freedBytes)}
                </p>
                <p className="text-2xs uppercase tracking-wide text-faint">Espace libéré</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-2/40 p-4 text-center">
                <p className="font-mono text-2xl font-semibold text-accent">{result.memoryFreedMB} Mo</p>
                <p className="text-2xs uppercase tracking-wide text-faint">RAM récupérée</p>
              </div>
            </div>
            <div className="space-y-2">
              {result.steps.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/30 px-3 py-2"
                >
                  {s.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-accent" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-danger" />
                  )}
                  <span className="flex-1 text-sm text-content">{s.label}</span>
                  <span className="text-xs text-muted">{s.detail}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

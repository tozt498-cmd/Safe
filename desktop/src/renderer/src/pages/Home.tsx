import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Button, Badge, Skeleton, ProgressBar } from '../components/ui/primitives';
import { HealthRing } from '../components/ui/charts';
import { Modal } from '../components/ui/Modal';
import { useAsync, useInterval } from '../lib/hooks';
import { toast } from '../store/toast';
import { formatBytes, formatUptime } from '../lib/format';
import type { HealthScore, SystemInfo, LiveStats, BoostResult } from '../lib/types';

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card hover className="flex items-center gap-4">
      <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-accent">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</p>
        <p className="font-mono text-lg font-semibold tabular text-content">{value}</p>
        {sub && <p className="truncate text-2xs text-muted">{sub}</p>}
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

  useInterval(() => window.api.metrics.live().then(setLive).catch(() => {}), 2500);

  const runBoost = async () => {
    setModalOpen(true);
    setBoosting(true);
    setResult(null);
    try {
      const res = await window.api.boost.run();
      setResult(res);
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-content">Accueil</h1>
        <p className="mt-1 text-sm text-muted">
          {info.data
            ? `${info.data.hostname} • ${info.data.os}`
            : 'Analyse de l\'état de votre système…'}
        </p>
      </div>

      {/* Bannière fonctionnalité phare */}
      <Link to="/total">
        <Card hover className="group relative mb-5 flex items-center gap-4 overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full bg-accent/15 blur-3xl" />
          <div className="icon-chip size-12 shrink-0">
            <Sparkles className="size-6" />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="text-sm font-semibold text-content">Optimisation Totale</p>
            <p className="truncate text-xs text-muted">
              Nettoyage profond, mémoire, disques, réseau et performances — en une seule action.
            </p>
          </div>
          <span className="relative inline-flex items-center gap-1.5 rounded-lg bg-accent-grad px-3.5 py-2 text-xs font-semibold text-[#04130d] transition-transform group-hover:translate-x-0.5">
            Lancer <ArrowRight className="size-3.5" />
          </span>
        </Card>
      </Link>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Carte santé */}
        <Card className="lg:col-span-2">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-col items-center gap-3">
              {health.loading || !h ? (
                <Skeleton className="size-[220px] rounded-full" />
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
              <div className="mb-4 flex items-center gap-2 text-accent">
                <Sparkles className="size-4" />
                <span className="text-sm font-medium">Score de santé système</span>
              </div>

              <div className="space-y-3">
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

              <Button
                size="lg"
                icon={<Zap className="size-5" />}
                onClick={runBoost}
                loading={boosting}
                className="mt-6 w-full"
              >
                Optimisation en 1 clic
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-1">
          <StatTile
            icon={Cpu}
            label="Processeur"
            value={live ? `${live.cpu.load.toFixed(0)}%` : '—'}
            sub={info.data?.cpuBrand}
          />
          <StatTile
            icon={MemoryStick}
            label="Mémoire"
            value={live ? `${live.mem.percent.toFixed(0)}%` : '—'}
            sub={live ? `${live.mem.usedGB} / ${live.mem.totalGB} Go` : undefined}
          />
          <StatTile
            icon={HardDrive}
            label="GPU"
            value={live?.gpu.load != null ? `${live.gpu.load}%` : 'N/A'}
            sub={info.data?.gpuModel}
          />
          <StatTile
            icon={Clock}
            label="Activité"
            value={info.data ? formatUptime(info.data.uptimeSec) : '—'}
            sub="Temps de fonctionnement"
          />
        </div>
      </div>

      {/* Raccourcis */}
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        {[
          { to: '/cleaning', title: 'Nettoyer le disque', text: 'Supprimez les fichiers inutiles.' },
          { to: '/dashboard', title: 'Surveiller en direct', text: 'Graphiques temps réel.' },
          { to: '/connection', title: 'Optimiser la connexion', text: 'Test de débit & DNS.' },
        ].map((s) => (
          <Link key={s.to} to={s.to}>
            <Card hover className="group flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-content">{s.title}</p>
                <p className="text-xs text-muted">{s.text}</p>
              </div>
              <ArrowRight className="size-4 text-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
            </Card>
          </Link>
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

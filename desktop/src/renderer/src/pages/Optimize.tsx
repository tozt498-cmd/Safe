import { useEffect, useState } from 'react';
import { Rocket, MemoryStick, Gamepad2, Wind, Network, Zap } from 'lucide-react';
import { Card, CardHeader, Button, Toggle, PageHeader } from '../components/ui/primitives';
import { RadialGauge } from '../components/ui/charts';
import { useInterval } from '../lib/hooks';
import { toast } from '../store/toast';
import type { LiveStats } from '../lib/types';

export function Optimize() {
  const [live, setLive] = useState<LiveStats | null>(null);
  const [freeing, setFreeing] = useState(false);
  const [gameMode, setGameMode] = useState(false);
  const [lastFreed, setLastFreed] = useState<number | null>(null);

  useInterval(() => window.api.metrics.live().then(setLive).catch(() => {}), 2000);
  useEffect(() => {
    window.api.metrics.live().then(setLive).catch(() => {});
  }, []);

  const freeMemory = async () => {
    setFreeing(true);
    try {
      const res = await window.api.optimize.freeMemory();
      setLastFreed(res.freedMB);
      toast.success('Mémoire libérée', res.message);
      window.api.metrics.live().then(setLive).catch(() => {});
    } catch {
      toast.error('Échec de la libération mémoire');
    } finally {
      setFreeing(false);
    }
  };

  const toggleGameMode = async (on: boolean) => {
    setGameMode(on);
    const res = await window.api.optimize.gameMode(on);
    res.ok ? toast.success(res.message) : toast.error(res.message);
    if (!res.ok) setGameMode(!on);
  };

  const quickAction = async (
    label: string,
    fn: () => Promise<{ ok: boolean; message: string }>,
  ) => {
    const res = await fn();
    res.ok ? toast.success(label, res.message) : toast.error(label, res.message);
  };

  return (
    <div>
      <PageHeader title="Optimisation" subtitle="Boostez les performances et libérez les ressources." />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Libération mémoire */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Libération de la mémoire"
            subtitle="Récupère la RAM occupée par les processus inactifs."
            icon={<MemoryStick className="size-[18px]" />}
          />
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <RadialGauge value={live?.mem.percent ?? 0} label="RAM utilisée" size={150} />
            <div className="flex-1">
              <div className="mb-4 grid grid-cols-2 gap-3 font-mono text-sm tabular">
                <div className="rounded-xl border border-border bg-surface-2/40 p-3">
                  <p className="text-2xs uppercase tracking-wide text-faint">Utilisée</p>
                  <p className="text-lg font-semibold text-content">{live?.mem.usedGB ?? '—'} Go</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-2/40 p-3">
                  <p className="text-2xs uppercase tracking-wide text-faint">Disponible</p>
                  <p className="text-lg font-semibold text-accent">
                    {live ? (live.mem.totalGB - live.mem.usedGB).toFixed(1) : '—'} Go
                  </p>
                </div>
              </div>
              <Button size="lg" icon={<Wind className="size-5" />} loading={freeing} onClick={freeMemory} className="w-full">
                Libérer la mémoire
              </Button>
              {lastFreed != null && (
                <p className="mt-2 text-center text-xs text-accent">
                  {lastFreed} Mo récupérés lors de la dernière optimisation.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Mode Jeu */}
        <Card>
          <CardHeader title="Mode Jeu" icon={<Gamepad2 className="size-[18px]" />} />
          <p className="text-sm text-muted">
            Active le Game Mode de Windows et le plan d'alimentation hautes performances pour un
            maximum de fluidité en jeu.
          </p>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-surface-2/40 p-4">
            <div>
              <p className="text-sm font-medium text-content">Performances maximales</p>
              <p className="text-xs text-muted">{gameMode ? 'Activé' : 'Désactivé'}</p>
            </div>
            <Toggle checked={gameMode} onChange={toggleGameMode} />
          </div>
        </Card>
      </div>

      {/* Actions rapides */}
      <h2 className="mb-3 mt-7 text-sm font-semibold text-content">Réglages rapides</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Zap,
            title: 'Optimisation complète',
            text: 'Nettoyage + mémoire + réseau.',
            run: async () => {
              const r = await window.api.boost.run();
              return { ok: true, message: `${r.memoryFreedMB} Mo de RAM libérés.` };
            },
            label: 'Optimisation complète',
          },
          {
            icon: Network,
            title: 'Optimiser TCP/IP',
            text: 'Réglages réseau pour plus de réactivité.',
            run: () => window.api.network.tcpOptimize(),
            label: 'Optimisation TCP/IP',
          },
          {
            icon: Rocket,
            title: 'Vider le cache DNS',
            text: 'Résout les ralentissements de navigation.',
            run: () => window.api.network.flushDns(),
            label: 'Cache DNS',
          },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Card key={a.title} hover>
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-accent">
                <Icon className="size-5" />
              </div>
              <p className="text-sm font-medium text-content">{a.title}</p>
              <p className="mb-4 text-xs text-muted">{a.text}</p>
              <Button variant="secondary" size="sm" className="w-full" onClick={() => quickAction(a.label, a.run)}>
                Exécuter
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

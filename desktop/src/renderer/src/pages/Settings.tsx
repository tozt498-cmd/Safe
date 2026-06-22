import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Palette,
  Bell,
  Power,
  ShieldCheck,
  CalendarClock,
  Languages,
  Moon,
  Sun,
} from 'lucide-react';
import { Card, Toggle, PageHeader } from '../components/ui/primitives';
import { useTheme } from '../store/theme';
import { toast } from '../store/toast';
import { cn } from '../lib/cn';
import type { ReactNode } from 'react';

interface Settings {
  closeToTray: boolean;
  launchAtStartup: boolean;
  theme: 'dark' | 'light';
  autoElevate: boolean;
  notifications: boolean;
  scheduledOptim: { enabled: boolean; frequency: 'daily' | 'weekly' };
}

const cell = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const },
});

function Section({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="icon-chip size-10 shrink-0">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-content">{title}</h3>
          <p className="text-xs text-muted">{desc}</p>
        </div>
      </div>
      <div className="space-y-1">{children}</div>
    </Card>
  );
}

function SettingRow({ title, desc, control }: { title: string; desc?: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border/50 py-3.5 first:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-content">{title}</p>
        {desc && <p className="mt-0.5 text-xs text-muted">{desc}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function Settings() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.set);
  const [s, setS] = useState<Settings | null>(null);
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.api.app.getSettings().then(setS).catch(() => {});
    window.api.app.version().then(setVersion).catch(() => {});
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await window.api.app.setSettings(patch);
    setS(next as Settings);
    toast.success('Réglage enregistré');
  };

  return (
    <div className="relative isolate">
      <div aria-hidden className="blob -z-10 bg-accent animate-aurora" style={{ width: '22rem', height: '22rem', top: '-8rem', right: '-6rem' }} />
      <PageHeader title="Paramètres" subtitle="Personnalise l'application selon tes préférences." />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Apparence */}
        <motion.div {...cell(0)}>
          <Section icon={<Palette className="size-5" />} title="Apparence" desc="Thème de l'interface.">
            <SettingRow
              title="Thème sombre"
              desc="Recommandé. Le thème clair reste disponible."
              control={
                <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2/50 p-1">
                  {(['dark', 'light'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                        theme === t ? 'bg-accent-grad text-[#04130d]' : 'text-muted hover:text-content',
                      )}
                    >
                      {t === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
                      {t === 'dark' ? 'Sombre' : 'Clair'}
                    </button>
                  ))}
                </div>
              }
            />
          </Section>
        </motion.div>

        {/* Notifications */}
        <motion.div {...cell(1)}>
          <Section icon={<Bell className="size-5" />} title="Notifications" desc="Alertes système de l'application.">
            <SettingRow
              title="Activer les notifications"
              desc="Optimisations terminées, alertes système."
              control={<Toggle checked={s?.notifications ?? true} onChange={(v) => update({ notifications: v })} />}
            />
          </Section>
        </motion.div>

        {/* Démarrage & système */}
        <motion.div {...cell(2)}>
          <Section icon={<Power className="size-5" />} title="Démarrage & système" desc="Comportement au lancement.">
            <SettingRow
              title="Lancer au démarrage de Windows"
              control={<Toggle checked={s?.launchAtStartup ?? false} onChange={(v) => update({ launchAtStartup: v })} />}
            />
            <SettingRow
              title="Réduire dans la barre des tâches"
              desc="Garder l'app en arrière-plan à la fermeture."
              control={<Toggle checked={s?.closeToTray ?? true} onChange={(v) => update({ closeToTray: v })} />}
            />
            <SettingRow
              title="Lancer en administrateur"
              desc="Nécessaire pour que toutes les optimisations s'appliquent."
              control={<Toggle checked={s?.autoElevate ?? true} onChange={(v) => update({ autoElevate: v })} />}
            />
          </Section>
        </motion.div>

        {/* Optimisation planifiée */}
        <motion.div {...cell(3)}>
          <Section
            icon={<CalendarClock className="size-5" />}
            title="Optimisation planifiée"
            desc="Lancer une optimisation automatiquement."
          >
            <SettingRow
              title="Activer l'optimisation automatique"
              control={
                <Toggle
                  checked={s?.scheduledOptim.enabled ?? false}
                  onChange={(v) =>
                    update({ scheduledOptim: { enabled: v, frequency: s?.scheduledOptim.frequency ?? 'weekly' } })
                  }
                />
              }
            />
            <SettingRow
              title="Fréquence"
              control={
                <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2/50 p-1">
                  {(['daily', 'weekly'] as const).map((f) => (
                    <button
                      key={f}
                      disabled={!s?.scheduledOptim.enabled}
                      onClick={() => update({ scheduledOptim: { enabled: true, frequency: f } })}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40',
                        s?.scheduledOptim.frequency === f ? 'bg-accent-grad text-[#04130d]' : 'text-muted hover:text-content',
                      )}
                    >
                      {f === 'daily' ? 'Quotidienne' : 'Hebdomadaire'}
                    </button>
                  ))}
                </div>
              }
            />
            <p className="pt-1 text-2xs text-faint">
              La planification en arrière-plan arrive dans une prochaine mise à jour ; ta préférence est déjà
              enregistrée.
            </p>
          </Section>
        </motion.div>

        {/* Langue */}
        <motion.div {...cell(4)}>
          <Section icon={<Languages className="size-5" />} title="Langue" desc="Langue de l'interface.">
            <SettingRow
              title="Langue de l'application"
              control={
                <span className="rounded-lg border border-border bg-surface-2/50 px-3 py-1.5 text-xs font-medium text-content">
                  Français
                </span>
              }
            />
            <p className="pt-1 text-2xs text-faint">D'autres langues seront ajoutées prochainement.</p>
          </Section>
        </motion.div>

        {/* À propos */}
        <motion.div {...cell(5)}>
          <Section icon={<ShieldCheck className="size-5" />} title="À propos" desc="Version et sécurité.">
            <SettingRow title="Version installée" control={<span className="font-mono text-sm text-content">{version || '—'}</span>} />
            <SettingRow title="Mises à jour" desc="Automatiques via les versions officielles." control={<span className="text-xs text-accent">Activées</span>} />
          </Section>
        </motion.div>
      </div>
    </div>
  );
}

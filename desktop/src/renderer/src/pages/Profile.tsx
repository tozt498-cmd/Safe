import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  KeyRound,
  MonitorSmartphone,
  ShieldCheck,
  LogOut,
  HardDrive,
  MemoryStick,
  Zap,
  Flame,
  Crown,
  MessageCircle,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Card, Button, Badge } from '../components/ui/primitives';
import { Counter } from '../components/ui/charts';
import { useAuth } from '../store/auth';
import { useStats } from '../store/stats';
import { isPro, openExternal, DISCORD_URL } from '../lib/entitlement';
import { formatDate } from '../lib/format';
import { toast } from '../store/toast';
import type { ReactNode } from 'react';

const cell = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] as const },
});

function StatTile({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Card hover className="flex flex-col gap-2 p-5">
      <div className="icon-chip size-10">{icon}</div>
      <p className="mt-1 font-mono text-2xl font-semibold tabular text-content">{children}</p>
      <p className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</p>
    </Card>
  );
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/50 py-3 last:border-0">
      <span className="text-faint">{icon}</span>
      <span className="w-44 text-sm text-muted">{label}</span>
      <span className="flex-1 truncate text-right text-sm font-medium text-content">{value}</span>
    </div>
  );
}

export function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pro = isPro(user);
  const stats = useStats();
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.api.app.version().then(setVersion).catch(() => {});
  }, []);

  if (!user) return null;

  const plan = user.role === 'admin' ? 'Administrateur' : pro ? 'Premium' : 'Gratuit';
  const goCleaned = (stats.totalCleanedBytes / 1e9) || 0;

  return (
    <div className="relative isolate">
      <div aria-hidden className="blob -z-10 bg-accent animate-aurora" style={{ width: '24rem', height: '24rem', top: '-9rem', left: '-6rem' }} />

      <span className="eyebrow">Compte</span>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-content">Profil</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Carte identité */}
        <motion.div {...cell(0)} className="lg:col-span-3">
          <Card className="glow-border flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-3xl bg-accent/30 blur-xl" />
              <div className="relative flex size-20 items-center justify-center rounded-3xl bg-accent-grad text-3xl font-semibold text-[#04130d]">
                {user.email[0]?.toUpperCase()}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <p className="truncate text-xl font-semibold text-content">{user.email}</p>
                <Badge tone={user.role === 'admin' ? 'info' : pro ? 'accent' : 'neutral'} dot>
                  {plan}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                Membre depuis {formatDate(user.createdAt) || '—'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {!pro && (
                <Button icon={<Crown className="size-4" />} onClick={() => navigate('/shop')}>
                  Passer Premium
                </Button>
              )}
              <Button variant="secondary" icon={<SettingsIcon className="size-4" />} onClick={() => navigate('/settings')}>
                Paramètres
              </Button>
              <Button
                variant="secondary"
                icon={<MessageCircle className="size-4" />}
                onClick={() => openExternal(DISCORD_URL)}
              >
                Discord
              </Button>
              <Button variant="danger" icon={<LogOut className="size-4" />} onClick={logout}>
                Déconnexion
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Statistiques personnelles */}
        <motion.div {...cell(1)}>
          <StatTile icon={<HardDrive className="size-5" />} label="Espace nettoyé">
            <Counter to={goCleaned} decimals={goCleaned >= 10 ? 0 : 1} /> Go
          </StatTile>
        </motion.div>
        <motion.div {...cell(2)}>
          <StatTile icon={<MemoryStick className="size-5" />} label="RAM libérée">
            <Counter to={stats.ramFreedMB} /> Mo
          </StatTile>
        </motion.div>
        <motion.div {...cell(3)}>
          <StatTile icon={<Zap className="size-5" />} label="Optimisations">
            <Counter to={stats.optimizations} />
          </StatTile>
        </motion.div>
        <motion.div {...cell(4)} className="sm:col-span-1 lg:col-span-3">
          <Card hover className="flex items-center gap-4 p-5">
            <div className="icon-chip size-12 shrink-0">
              <Flame className="size-6" />
            </div>
            <div className="flex-1">
              <p className="font-mono text-2xl font-semibold tabular text-content">
                <Counter to={stats.streak} /> jour{stats.streak > 1 ? 's' : ''}
              </p>
              <p className="text-2xs font-medium uppercase tracking-wide text-faint">Série d'optimisation</p>
            </div>
            <p className="max-w-[14rem] text-right text-xs text-muted">
              Optimise au moins une fois par jour pour faire grimper ta série.
            </p>
          </Card>
        </motion.div>

        {/* Licence & appareil */}
        <motion.div {...cell(5)} className="lg:col-span-2">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="icon-chip size-10">
                <KeyRound className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-content">Licence & appareil</h3>
            </div>
            <Row icon={<ShieldCheck className="size-4" />} label="Statut de licence" value={pro ? 'Premium actif' : 'Gratuit'} />
            <Row icon={<KeyRound className="size-4" />} label="Clé associée" value={user.key ?? 'Aucune'} />
            <Row icon={<MonitorSmartphone className="size-4" />} label="Appareil lié" value={user.hwidLabel ?? 'Cet appareil'} />
            <Row icon={<RefreshCw className="size-4" />} label="Lié depuis" value={formatDate(user.hwidRegisteredAt) || '—'} />
            <Button
              variant="secondary"
              icon={<RefreshCw className="size-4" />}
              className="mt-4"
              onClick={() => {
                openExternal(DISCORD_URL);
                toast.info('Changement d\'appareil', 'Fais ta demande au staff sur le Discord.');
              }}
            >
              Demander un changement d'appareil
            </Button>
          </Card>
        </motion.div>

        {/* Premium / version */}
        <motion.div {...cell(6)}>
          <Card className="flex h-full flex-col justify-between p-6">
            <div>
              <div className="icon-chip size-10">
                <Crown className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-content">{pro ? 'Merci de ton soutien' : 'Passe en Premium'}</h3>
              <p className="mt-1 text-xs text-muted">
                {pro
                  ? 'Toutes les optimisations sont débloquées sur cet appareil.'
                  : 'Débloque toutes les optimisations et le mode 1 clic.'}
              </p>
            </div>
            {!pro && (
              <Button icon={<Crown className="size-4" />} className="mt-4 w-full" onClick={() => navigate('/shop')}>
                Voir la boutique
              </Button>
            )}
            <p className="mt-4 text-center font-mono text-2xs text-faint">SafeMarket Optimiseur {version}</p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

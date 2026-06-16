import { useEffect, useState } from 'react';
import { User, KeyRound, MonitorSmartphone, ShieldCheck, LogOut, Power, BellRing } from 'lucide-react';
import { Card, CardHeader, Button, Badge, Toggle, PageHeader } from '../components/ui/primitives';
import { useAuth } from '../store/auth';
import { formatDate } from '../lib/format';
import { toast } from '../store/toast';

interface Settings {
  closeToTray: boolean;
  launchAtStartup: boolean;
  theme: 'dark' | 'light';
}

function Row({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
      <Icon className="size-4 text-faint" />
      <span className="w-40 text-sm text-muted">{label}</span>
      <span className="flex-1 truncate text-sm font-medium text-content">{value}</span>
    </div>
  );
}

export function Profile() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    window.api.app.getSettings().then(setSettings).catch(() => {});
    window.api.app.version().then(setAppVersion).catch(() => {});
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await window.api.app.setSettings(patch);
    setSettings(next);
    toast.success('Réglage enregistré');
  };

  if (!user) return null;

  return (
    <div>
      <PageHeader title="Profil" subtitle="Votre compte, votre licence et vos préférences." />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-grad text-xl font-semibold text-[#04130d]">
              {user.email[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-content">{user.email}</p>
              <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'} dot>
                {user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
              </Badge>
            </div>
          </div>

          <Row icon={User} label="Adresse e-mail" value={user.email} />
          <Row icon={ShieldCheck} label="Type de compte" value={user.role === 'admin' ? 'Administrateur' : 'Utilisateur'} />
          <Row icon={KeyRound} label="Clé d'activation" value={user.key ?? '—'} />
          <Row icon={MonitorSmartphone} label="Appareil enregistré" value={user.hwidLabel ?? 'Cet appareil'} />
          <Row icon={Power} label="Lié depuis le" value={formatDate(user.hwidRegisteredAt)} />

          <Button variant="danger" icon={<LogOut className="size-4" />} className="mt-5" onClick={logout}>
            Se déconnecter
          </Button>
        </Card>

        <Card>
          <CardHeader title="Préférences" icon={<BellRing className="size-[18px]" />} />
          <div className="space-y-1">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-content">Lancer au démarrage</p>
                <p className="text-xs text-muted">Ouvrir avec Windows.</p>
              </div>
              <Toggle
                checked={settings?.launchAtStartup ?? false}
                onChange={(v) => update({ launchAtStartup: v })}
              />
            </div>
            <div className="flex items-center justify-between border-t border-border/60 py-3">
              <div>
                <p className="text-sm font-medium text-content">Réduire dans le tray</p>
                <p className="text-xs text-muted">Continuer en arrière-plan à la fermeture.</p>
              </div>
              <Toggle
                checked={settings?.closeToTray ?? true}
                onChange={(v) => update({ closeToTray: v })}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-surface-2/30 p-4 text-center">
            <p className="text-2xs uppercase tracking-wide text-faint">Version</p>
            <p className="font-mono text-sm text-content">SafeMarket Optimiseur {appVersion}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

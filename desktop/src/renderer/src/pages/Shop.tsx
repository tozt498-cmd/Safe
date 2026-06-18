import { useState } from 'react';
import { Sparkles, Check, ExternalLink, KeyRound, BadgeCheck, ShoppingBag } from 'lucide-react';
import { Card, Button, Input, PageHeader, Badge } from '../components/ui/primitives';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';
import { ApiError } from '../lib/api';
import { openExternal, SHOP_URL, isPro } from '../lib/entitlement';

function formatKey(raw: string): string {
  return raw.toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '').replace(/(.{4})(?=.)/g, '$1-').slice(0, 19);
}

const INCLUDED = [
  'Optimisation Totale du PC',
  'Mode jeu & boost FPS',
  'Optimisation réseau & latence',
  'Catégorie Jeux dédiée',
  'Processus, démarrage, disques',
  'Mises à jour automatiques à vie',
];

export function Shop() {
  const { user, redeem } = useAuth();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const pro = isPro(user);

  const activate = async () => {
    setBusy(true);
    try {
      await redeem(key);
      toast.success('Licence activée 🎉', 'Toutes les fonctionnalités sont débloquées.');
    } catch (e) {
      toast.error('Activation impossible', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Boutique" subtitle="Débloque toutes les optimisations avec une licence." />

      {pro ? (
        <Card className="flex items-center gap-4">
          <div className="icon-chip size-12"><BadgeCheck className="size-6" /></div>
          <div>
            <p className="flex items-center gap-2 text-base font-semibold text-content">Licence active <Badge tone="accent" dot>Pro</Badge></p>
            <p className="text-sm text-muted">Merci ! Toutes les fonctionnalités sont débloquées sur ce PC.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Acheter */}
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-accent">
                <Sparkles className="size-3.5" /> Licence complète
              </span>
              <div className="flex items-end gap-2">
                <span className="font-mono text-5xl font-bold tracking-tight text-content">5,99 €</span>
                <span className="mb-1 text-sm text-faint">paiement unique</span>
              </div>
              <ul className="mt-5 space-y-2">
                {INCLUDED.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"><Check className="size-3.5" /></span>
                    <span className="text-muted">{t}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="mt-6 w-full" icon={<ShoppingBag className="size-5" />} onClick={() => openExternal(SHOP_URL)}>
                Acheter une licence <ExternalLink className="size-4" />
              </Button>
              <p className="mt-2 text-center text-2xs text-faint">Ouvre la boutique sécurisée (PayPal) dans ton navigateur.</p>
            </div>
          </Card>

          {/* Activer une clé */}
          <Card>
            <div className="icon-chip mb-4 size-11"><KeyRound className="size-5" /></div>
            <h3 className="text-base font-semibold text-content">J'ai déjà une clé</h3>
            <p className="mt-1 text-sm text-muted">Saisis ta clé d'activation pour tout débloquer immédiatement.</p>
            <div className="mt-5">
              <Input
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="font-mono tracking-wider"
                value={key}
                onChange={(e) => setKey(formatKey(e.target.value))}
              />
            </div>
            <Button className="mt-4 w-full" loading={busy} disabled={key.length < 19} onClick={activate}>
              Activer la licence
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

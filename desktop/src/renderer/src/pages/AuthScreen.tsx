import { useState, type FormEvent } from 'react';
import { Minus, X, Mail, Lock, KeyRound, ShieldCheck, Zap, Activity, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';
import { ApiError } from '../lib/api';
import { openExternal, SHOP_URL } from '../lib/entitlement';
import { Button, Input } from '../components/ui/primitives';
import { LogoMark } from '../components/Logo';

function formatKey(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '');
  return cleaned.replace(/(.{4})(?=.)/g, '$1-').slice(0, 19);
}

const HIGHLIGHTS = [
  { icon: Zap, title: 'Optimisation en 1 clic', text: 'Nettoyage, mémoire et réseau en une seule action.' },
  { icon: Activity, title: 'Monitoring temps réel', text: 'CPU, RAM, GPU, disques et températures en direct.' },
  { icon: Network, title: 'Réseau optimisé', text: 'Test de débit, DNS le plus rapide, latence réduite.' },
  { icon: ShieldCheck, title: 'Licence sécurisée', text: 'Compte protégé et lié à un seul appareil.' },
];

export function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<'free' | 'key'>('free');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        toast.success('Connexion réussie', 'Bienvenue sur SafeMarket Optimiseur.');
      } else {
        await signup(email, password, confirm, plan === 'key' ? key : '');
        toast.success(
          'Compte créé',
          plan === 'key' ? 'Licence activée — tout est débloqué.' : 'Compte gratuit créé. Débloque tout avec une clé quand tu veux.',
        );
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Une erreur est survenue.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-bg">
      {/* barre de titre minimale (frameless) */}
      <div className="drag absolute inset-x-0 top-0 z-20 flex h-11 items-center justify-end px-1">
        <button
          onClick={() => window.api.window.minimize()}
          className="no-drag flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2/70 hover:text-content"
        >
          <Minus className="size-4" />
        </button>
        <button
          onClick={() => window.api.window.close()}
          className="no-drag flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Panneau marque */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-border bg-elevated/40 p-12 lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 size-80 rounded-full bg-accent/[0.06] blur-3xl" />
        <div className="relative flex items-center gap-3">
          <LogoMark size={40} />
          <div>
            <p className="text-base font-semibold tracking-tight text-content">SafeMarket</p>
            <p className="text-2xs font-medium uppercase tracking-[0.22em] text-accent">Optimiseur</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-content">
            Votre PC, à pleine puissance.
          </h1>
          <div className="space-y-3.5">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon;
              return (
                <div key={h.title} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-accent">
                    <Icon className="size-[18px]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-content">{h.title}</p>
                    <p className="text-xs text-muted">{h.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="relative text-2xs text-faint">© 2026 SafeMarket — Optimisation Windows premium.</p>
      </div>

      {/* Panneau formulaire */}
      <div className="flex flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-6 lg:hidden">
            <LogoMark size={40} />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-content">
            {mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {mode === 'login'
              ? 'Accédez à votre espace d\'optimisation.'
              : 'Activez votre licence pour démarrer.'}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3.5">
            <Input
              label="Adresse e-mail"
              type="email"
              required
              autoFocus
              icon={<Mail className="size-4" />}
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Mot de passe"
              type="password"
              required
              icon={<Lock className="size-4" />}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3.5 overflow-hidden"
                >
                  <Input
                    label="Confirmer le mot de passe"
                    type="password"
                    required={mode === 'signup'}
                    icon={<Lock className="size-4" />}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />

                  {/* Choix : Gratuit ou Clé */}
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-muted">Type de compte</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPlan('free')}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${plan === 'free' ? 'border-accent/50 bg-accent/10' : 'border-border hover:border-border-strong'}`}
                      >
                        <span className={`block text-sm font-medium ${plan === 'free' ? 'text-accent' : 'text-content'}`}>Gratuit</span>
                        <span className="block text-2xs text-faint">Limité (cache + 1 outil)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlan('key')}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${plan === 'key' ? 'border-accent/50 bg-accent/10' : 'border-border hover:border-border-strong'}`}
                      >
                        <span className={`block text-sm font-medium ${plan === 'key' ? 'text-accent' : 'text-content'}`}>J'ai une clé</span>
                        <span className="block text-2xs text-faint">Tout débloqué</span>
                      </button>
                    </div>
                  </div>

                  {plan === 'key' ? (
                    <Input
                      label="Clé d'activation"
                      required={plan === 'key'}
                      icon={<KeyRound className="size-4" />}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      className="font-mono tracking-wider"
                      value={key}
                      onChange={(e) => setKey(formatKey(e.target.value))}
                    />
                  ) : (
                    <button type="button" onClick={() => openExternal(SHOP_URL)} className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-xs text-muted transition-colors hover:text-content">
                      Pas de clé ? <span className="text-accent">Achète une licence (5,99 €)</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {mode === 'login' ? 'Pas encore de compte ?' : 'Vous avez déjà un compte ?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
              }}
              className="font-medium text-accent transition-colors hover:text-accent-bright"
            >
              {mode === 'login' ? 'Activer une licence' : 'Se connecter'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

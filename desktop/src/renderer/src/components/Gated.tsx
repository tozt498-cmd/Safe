import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ShoppingBag, KeyRound, Sparkles } from 'lucide-react';
import { Button } from './ui/primitives';
import { useAuth } from '../store/auth';
import { isPro, openExternal, SHOP_URL } from '../lib/entitlement';

export function LockScreen({ title }: { title?: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="card glow-border relative w-full max-w-md overflow-hidden p-8 text-center"
      >
        <div className="pointer-events-none absolute -top-16 left-1/2 size-56 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
            <Lock className="size-7" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-accent">
            <Sparkles className="size-3.5" /> Fonctionnalité Pro
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-content">
            {title ?? 'Débloque tout avec une clé'}
          </h2>
          <p className="mt-2 text-sm text-muted">
            La version gratuite donne accès au nettoyage du cache et à l'analyse des disques. Active une
            licence pour débloquer toutes les optimisations.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button size="lg" icon={<KeyRound className="size-5" />} onClick={() => navigate('/shop')}>
              J'ai une clé / Voir la boutique
            </Button>
            <Button variant="secondary" icon={<ShoppingBag className="size-4" />} onClick={() => openExternal(SHOP_URL)}>
              Acheter une licence — 5,99 €
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function Gated({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  if (isPro(user)) return <>{children}</>;
  return <LockScreen />;
}

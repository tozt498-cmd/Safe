import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { LogoMark } from './Logo';
import { on } from '../lib/ws';
import { get } from '../lib/api';
import type { LockdownState } from '../lib/types';

/**
 * Verrou global piloté par le serveur. Quand l'admin active une "mise à jour
 * bloquante", un overlay plein écran SANS bouton s'affiche et rend l'app
 * inutilisable jusqu'à ce que l'admin lève le blocage. L'état est récupéré au
 * démarrage (persistant) et mis à jour en temps réel via WebSocket.
 */
export function LockdownGate() {
  const [state, setState] = useState<LockdownState | null>(null);

  useEffect(() => {
    get<LockdownState>('/messages/lockdown')
      .then(setState)
      .catch(() => {});
    const off = on('lockdown', (data) => {
      const p = data as Partial<LockdownState>;
      setState({
        active: !!p.active,
        title: p.title ?? null,
        body: p.body ?? null,
        kind: p.kind ?? 'important',
      });
    });
    return off;
  }, []);

  const active = !!state?.active;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="app-ambient fixed inset-0 z-[100] flex select-none items-center justify-center overflow-hidden bg-bg/96 backdrop-blur-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          // capture tous les événements : l'app est inutilisable
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="pointer-events-none absolute -top-24 left-1/4 size-[28rem] rounded-full bg-accent/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/4 size-[28rem] rounded-full bg-accent-deep/10 blur-3xl" />

          <motion.div
            className="relative flex w-full max-w-lg flex-col items-center px-8 text-center"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative mb-9 grid size-28 place-items-center">
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-accent/40"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              <motion.span
                className="absolute inset-3 rounded-full bg-accent/10"
                animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.2, 0.55] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative">
                <LogoMark size={58} />
              </div>
            </div>

            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3.5 py-1.5 text-2xs font-semibold uppercase tracking-[0.2em] text-accent">
              <Lock className="size-3.5" /> {state?.kind === 'update' ? 'Mise à jour en cours' : 'Maintenance'}
            </span>

            <h1 className="text-2xl font-semibold tracking-tight text-content">
              {state?.title || 'Application momentanément indisponible'}
            </h1>
            <p className="mt-3 max-w-md whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {state?.body ||
                'Une opération de maintenance est en cours. L\'application sera de nouveau accessible sous peu. Merci de votre patience.'}
            </p>

            <div className="relative mt-9 h-1.5 w-72 overflow-hidden rounded-full bg-surface-2">
              <span className="absolute inset-y-0 -left-1/3 w-1/3 rounded-full bg-accent-grad animate-scan" />
            </div>
            <p className="mt-4 text-2xs text-faint">Veuillez patienter — l'accès sera rétabli automatiquement.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

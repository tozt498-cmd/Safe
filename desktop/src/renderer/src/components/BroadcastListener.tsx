import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, Megaphone, AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/primitives';
import { on } from '../lib/ws';
import { get } from '../lib/api';
import { relativeTime } from '../lib/format';
import type { BroadcastPayload } from '../lib/types';

const LAST_SEEN = 'sm.lastSeenBroadcast';

const KIND = {
  info: { icon: Info, cls: 'text-info', label: 'Information' },
  update: { icon: Megaphone, cls: 'text-accent', label: 'Mise à jour' },
  important: { icon: AlertTriangle, cls: 'text-warn', label: 'Important' },
} as const;

export function BroadcastListener() {
  const [queue, setQueue] = useState<BroadcastPayload[]>([]);
  const current = queue[0];

  const enqueue = useCallback((msg: BroadcastPayload) => {
    setQueue((q) => (q.some((m) => m.id === msg.id) ? q : [...q, msg]));
  }, []);

  useEffect(() => {
    const offBroadcast = on('broadcast', (data) => enqueue(data as BroadcastPayload));
    get<{ message: BroadcastPayload | null }>('/messages/latest')
      .then(({ message }) => {
        if (message && localStorage.getItem(LAST_SEEN) !== message.id) enqueue(message);
      })
      .catch(() => {});
    return () => {
      offBroadcast();
    };
  }, [enqueue]);

  const acknowledge = () => {
    if (current) localStorage.setItem(LAST_SEEN, current.id);
    setQueue((q) => q.slice(1));
  };

  if (!current) return null;

  // Mise à jour bloquante → écran plein, immersif.
  if (current.blocking) return <BlockingUpdate message={current} onAcknowledge={acknowledge} />;

  // Message simple → modal classique refermable.
  const meta = KIND[current.kind];
  const Icon = meta.icon;
  return (
    <Modal
      open
      onClose={acknowledge}
      icon={<Icon className={`size-5 ${meta.cls}`} />}
      title={current.title}
      subtitle={`${meta.label} • ${relativeTime(current.createdAt)}`}
      size="md"
      footer={
        <Button onClick={acknowledge} variant="secondary">
          Compris
        </Button>
      }
    >
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{current.body}</p>
    </Modal>
  );
}

function BlockingUpdate({
  message,
  onAcknowledge,
}: {
  message: BroadcastPayload;
  onAcknowledge: () => void;
}) {
  const meta = KIND[message.kind];
  const Icon = meta.icon;
  return (
    <AnimatePresence>
      <motion.div
        className="app-ambient fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-bg/95 backdrop-blur-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* halos */}
        <div className="pointer-events-none absolute -top-24 left-1/4 size-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/4 size-96 rounded-full bg-accent-deep/10 blur-3xl" />

        <motion.div
          className="relative flex w-full max-w-md flex-col items-center px-8 text-center"
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* icône + anneau rotatif */}
          <div className="relative mb-8 grid size-24 place-items-center">
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-accent/40"
              animate={{ rotate: 360 }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
            />
            <motion.span
              className="absolute inset-2 rounded-full bg-accent/10"
              animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.25, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="icon-chip relative size-16">
              <Icon className="size-7" />
            </div>
          </div>

          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.18em] text-accent">
            {meta.label} en cours
          </span>

          <h2 className="text-2xl font-semibold tracking-tight text-content">{message.title}</h2>
          <p className="mt-3 max-w-sm whitespace-pre-wrap text-sm leading-relaxed text-muted">
            {message.body}
          </p>

          {/* barre de progression indéterminée */}
          <div className="relative mt-8 h-1.5 w-64 overflow-hidden rounded-full bg-surface-2">
            <span className="absolute inset-y-0 -left-1/3 w-1/3 rounded-full bg-accent-grad animate-scan" />
          </div>

          <Button onClick={onAcknowledge} size="lg" className="mt-8 px-10">
            J'ai compris
          </Button>
          <p className="mt-3 text-2xs text-faint">
            Cette mise à jour importante requiert votre validation.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

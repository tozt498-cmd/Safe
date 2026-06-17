import { useEffect, useState, useCallback } from 'react';
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

/**
 * Messages SIMPLES (non bloquants) uniquement : modal refermable via "Compris".
 * Les messages bloquants sont gérés par <LockdownGate /> (verrou serveur, sans bouton).
 */
export function BroadcastListener() {
  const [queue, setQueue] = useState<BroadcastPayload[]>([]);
  const current = queue[0];

  const enqueue = useCallback((msg: BroadcastPayload) => {
    if (msg.blocking) return; // géré par le verrou global
    setQueue((q) => (q.some((m) => m.id === msg.id) ? q : [...q, msg]));
  }, []);

  useEffect(() => {
    const offBroadcast = on('broadcast', (data) => enqueue(data as BroadcastPayload));
    get<{ message: BroadcastPayload | null }>('/messages/latest')
      .then(({ message }) => {
        if (message && !message.blocking && localStorage.getItem(LAST_SEEN) !== message.id) {
          enqueue(message);
        }
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

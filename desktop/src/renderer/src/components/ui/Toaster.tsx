import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useToasts, type ToastKind } from '../../store/toast';

const config: Record<ToastKind, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'text-accent' },
  error: { icon: AlertTriangle, cls: 'text-danger' },
  info: { icon: Info, cls: 'text-info' },
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((t) => {
          const { icon: Icon, cls } = config[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-elevated/95 p-3.5 shadow-soft backdrop-blur-xl"
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${cls}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-content">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-muted">{t.message}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-faint transition-colors hover:text-content">
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

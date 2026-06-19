import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';

/**
 * Bandeau affiché quand l'app n'a PAS les droits administrateur.
 * Sans ces droits, certaines optimisations (point de restauration, TRIM,
 * télémétrie, TCP/IP, dossier Windows\Temp…) ne peuvent pas s'appliquer.
 */
export function AdminBanner() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [relaunching, setRelaunching] = useState(false);

  useEffect(() => {
    let alive = true;
    window.api.app
      .isAdmin()
      .then((v) => alive && setAdmin(v))
      .catch(() => alive && setAdmin(true)); // en cas de doute, on n'embête pas l'utilisateur
    return () => {
      alive = false;
    };
  }, []);

  const relaunch = async () => {
    setRelaunching(true);
    try {
      const ok = await window.api.app.relaunchAsAdmin();
      if (!ok) setRelaunching(false); // UAC refusé : on reste en mode limité
    } catch {
      setRelaunching(false);
    }
  };

  return (
    <AnimatePresence>
      {admin === false && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
              <ShieldAlert size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-100">Mode limité — droits administrateur requis</p>
              <p className="text-xs text-amber-200/70">
                Certaines optimisations (point de restauration, TRIM, télémétrie, réseau…) ne
                s'appliqueront pas sans les droits administrateur.
              </p>
            </div>
            <button
              onClick={relaunch}
              disabled={relaunching}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
            >
              {relaunching ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Élévation…
                </>
              ) : (
                <>
                  <ShieldCheck size={16} /> Relancer en administrateur
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

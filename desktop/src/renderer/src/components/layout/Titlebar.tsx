import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { Logo } from '../Logo';
import { useTheme } from '../../store/theme';
import { on } from '../../lib/ws';
import { cn } from '../../lib/cn';

export function Titlebar() {
  const { theme, toggle } = useTheme();
  const [maximized, setMaximized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    const offStatus = on('status', (d) => setConnected(!!(d as { connected: boolean }).connected));
    const offPresence = on('presence', (n) => setOnline(n as number));
    return () => {
      offStatus();
      offPresence();
    };
  }, []);

  const win = window.api.window;

  return (
    <div className="drag flex h-11 shrink-0 items-center justify-between border-b border-border bg-bg/80 pl-4 pr-1 backdrop-blur-xl">
      <Logo size={26} />

      <div className="no-drag flex items-center gap-1">
        <div
          className={cn(
            'mr-1 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
            connected ? 'border-accent/25 bg-accent/10 text-accent' : 'border-border bg-surface-2 text-faint',
          )}
          title={connected ? `Connecté au serveur — ${online} en ligne` : 'Hors ligne'}
        >
          {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {connected ? `${online} en ligne` : 'Hors ligne'}
        </div>

        <button
          onClick={toggle}
          className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2/70 hover:text-content"
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <div className="mx-1 h-5 w-px bg-border" />

        <button
          onClick={() => win.minimize()}
          className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2/70 hover:text-content"
          aria-label="Réduire"
        >
          <Minus className="size-4" />
        </button>
        <button
          onClick={async () => setMaximized(await win.maximize())}
          className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2/70 hover:text-content"
          aria-label="Agrandir"
        >
          {maximized ? <Copy className="size-3.5 -scale-x-100" /> : <Square className="size-3.5" />}
        </button>
        <button
          onClick={() => win.close()}
          className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger hover:text-white"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

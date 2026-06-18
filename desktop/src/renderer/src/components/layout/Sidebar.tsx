import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  LayoutDashboard,
  Gauge,
  Trash2,
  Rocket,
  Activity,
  Power,
  Network,
  HardDrive,
  Boxes,
  Signal,
  ShieldCheck,
  LogOut,
  Sparkles,
  Gamepad2,
  Lock,
  ShoppingBag,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../store/auth';
import { cn } from '../../lib/cn';
import { isPro, openExternal, DISCORD_URL, FREE_ROUTES } from '../../lib/entitlement';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
}
interface Group {
  title: string;
  items: Item[];
}

const GROUPS: Group[] = [
  {
    title: 'Vue d\'ensemble',
    items: [
      { to: '/', label: 'Accueil', icon: Home },
      { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { to: '/benchmark', label: 'Benchmark', icon: Gauge },
    ],
  },
  {
    title: 'Entretien',
    items: [
      { to: '/cleaning', label: 'Nettoyage', icon: Trash2 },
      { to: '/optimize', label: 'Optimisation', icon: Rocket },
      { to: '/processes', label: 'Processus', icon: Activity },
      { to: '/startup', label: 'Démarrage', icon: Power },
    ],
  },
  {
    title: 'Jeux',
    items: [{ to: '/games', label: 'Optimisation jeux', icon: Gamepad2 }],
  },
  {
    title: 'Matériel & réseau',
    items: [
      { to: '/network', label: 'Réseau', icon: Network },
      { to: '/connection', label: 'Connexion', icon: Signal },
      { to: '/disks', label: 'Disques', icon: HardDrive },
      { to: '/software', label: 'Logiciels', icon: Boxes },
    ],
  },
];

function NavItem({ item, locked }: { item: Item; locked?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-150',
          isActive ? 'font-medium text-content' : 'text-muted hover:text-content',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              className="absolute inset-0 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/[0.14] to-accent/[0.03]"
            />
          )}
          {!isActive && (
            <span className="absolute inset-0 rounded-xl bg-surface-2/0 transition-colors duration-150 group-hover:bg-surface-2/40" />
          )}
          <span
            className={cn(
              'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-opacity duration-200',
              isActive ? 'opacity-100 shadow-glow-sm' : 'opacity-0',
            )}
          />
          <Icon className={cn('relative size-[18px] transition-colors', isActive && 'text-accent', locked && 'opacity-60')} />
          <span className={cn('relative', locked && 'opacity-60')}>{item.label}</span>
          {locked && <Lock className="relative ml-auto size-3.5 text-faint" />}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const pro = isPro(user);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-bg/30 backdrop-blur-sm">
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {/* Action phare */}
        <NavLink
          to="/total"
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200',
              isActive
                ? 'border-accent/50 text-[#04130d]'
                : 'border-accent/30 text-accent hover:border-accent/50',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'absolute inset-0 transition-opacity duration-200',
                  isActive
                    ? 'bg-accent-grad opacity-100'
                    : 'bg-accent-grad opacity-0 group-hover:opacity-10',
                )}
              />
              <span className="pointer-events-none absolute -inset-y-6 left-0 w-1/3 -skew-x-12 bg-white/10 opacity-0 transition-all duration-500 group-hover:left-full group-hover:opacity-100" />
              <Sparkles className="relative size-[18px]" />
              <span className="relative">Optimisation Totale</span>
              {!pro && <Lock className="relative ml-auto size-3.5" />}
            </>
          )}
        </NavLink>

        <NavItem item={{ to: '/shop', label: 'Boutique', icon: ShoppingBag }} />

        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.16em] text-faint">
              {g.title}
            </p>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavItem key={item.to} item={item} locked={!pro && !FREE_ROUTES.includes(item.to)} />
              ))}
            </div>
          </div>
        ))}

        {user?.role === 'admin' && (
          <div>
            <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.16em] text-faint">
              Administration
            </p>
            <NavItem item={{ to: '/admin', label: 'Panneau admin', icon: ShieldCheck }} />
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl p-2 transition-colors',
              isActive ? 'bg-surface-2/70' : 'hover:bg-surface-2/40',
            )
          }
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-grad text-sm font-semibold text-[#04130d]">
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-content">{user?.email}</p>
            <p className={cn('text-2xs', pro ? 'text-accent' : 'text-faint')}>
              {user?.role === 'admin' ? 'Administrateur' : pro ? 'Licence Pro' : 'Compte gratuit'}
            </p>
          </div>
        </NavLink>
        <button
          onClick={() => openExternal(DISCORD_URL)}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-[#5865F2]/15 hover:text-[#8b93f8]"
        >
          <MessageCircle className="size-[18px]" />
          Rejoindre le Discord
        </button>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <LogOut className="size-[18px]" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

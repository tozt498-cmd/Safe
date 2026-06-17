import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Users,
  Megaphone,
  Plus,
  Copy,
  Ban,
  MonitorX,
  Wifi,
  Send,
  RotateCcw,
  Trash2,
  Lock,
  ShieldOff,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Input, Toggle, Skeleton, PageHeader, EmptyState, IconButton } from '../components/ui/primitives';
import { get, post, del } from '../lib/api';
import { on } from '../lib/ws';
import { toast } from '../store/toast';
import { formatDate, relativeTime } from '../lib/format';
import { cn } from '../lib/cn';
import type { AdminKey, AdminAccount, AdminStats, AdminBroadcast } from '../lib/types';

type Tab = 'keys' | 'accounts' | 'broadcast';

export function Admin() {
  const [tab, setTab] = useState<Tab>('keys');
  const [stats, setStats] = useState<AdminStats | null>(null);

  const loadStats = () => get<AdminStats>('/admin/stats').then(setStats).catch(() => {});
  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <PageHeader
        title="Panneau d'administration"
        subtitle="Gérez les licences, les comptes et les communications."
        action={<Badge tone="accent" dot><Wifi className="size-3" /> {stats?.online ?? 0} en ligne</Badge>}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Comptes" value={stats?.accounts} sub={`${stats?.admins ?? 0} admin`} />
        <StatCard icon={KeyRound} label="Clés totales" value={stats?.keysTotal} />
        <StatCard icon={ShieldCheck} label="Clés utilisées" value={stats?.keysUsed} />
        <StatCard icon={Plus} label="Clés disponibles" value={stats?.keysFree} tone="text-accent" />
      </div>

      <div className="mb-5 inline-flex rounded-xl border border-border bg-surface/60 p-1">
        {([
          ['keys', 'Clés', KeyRound],
          ['accounts', 'Comptes', Users],
          ['broadcast', 'Diffusion', Megaphone],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              tab === id ? 'bg-surface-2 text-content shadow-sm' : 'text-muted hover:text-content',
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'keys' && <KeysTab onChange={loadStats} />}
      {tab === 'accounts' && <AccountsTab onChange={loadStats} />}
      {tab === 'broadcast' && <BroadcastTab />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value?: number; sub?: string; tone?: string }) {
  return (
    <Card className="flex items-center gap-3 py-4">
      <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-accent">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xs uppercase tracking-wide text-faint">{label}</p>
        <p className={cn('font-mono text-xl font-semibold tabular', tone ?? 'text-content')}>
          {value ?? '—'}
        </p>
        {sub && <p className="text-2xs text-faint">{sub}</p>}
      </div>
    </Card>
  );
}

/* ------------------------------- Clés ------------------------------------- */
function KeysTab({ onChange }: { onChange: () => void }) {
  const [keys, setKeys] = useState<AdminKey[] | null>(null);
  const [type, setType] = useState<'user' | 'admin'>('user');
  const [count, setCount] = useState(1);
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = () => get<{ keys: AdminKey[] }>('/admin/keys').then((d) => setKeys(d.keys)).catch(() => {});
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await post<{ created: string[] }>('/admin/keys', { type, count, note: note || undefined });
      toast.success(`${res.created.length} clé(s) générée(s)`, 'Copiées dans le presse-papiers.');
      navigator.clipboard?.writeText(res.created.join('\n')).catch(() => {});
      setNote('');
      load();
      onChange();
    } catch (e) {
      toast.error('Échec', (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await post(`/admin/keys/${id}/revoke`);
      toast.success('Clé révoquée');
      load();
      onChange();
    } catch (e) {
      toast.error('Échec', (e as Error).message);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader title="Générer des clés" icon={<Plus className="size-[18px]" />} />
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Type de clé</span>
            <div className="grid grid-cols-2 gap-2">
              {(['user', 'admin'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors',
                    type === t ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-muted hover:text-content',
                  )}
                >
                  {t === 'user' ? 'Utilisateur' : 'Admin'}
                </button>
              ))}
            </div>
          </div>
          <Input label="Quantité" type="number" min={1} max={100} value={count} onChange={(e) => setCount(Math.max(1, Math.min(100, +e.target.value)))} />
          <Input label="Note (optionnel)" placeholder="ex : commande #1234" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" loading={generating} onClick={generate} icon={<KeyRound className="size-4" />}>
            Générer
          </Button>
        </div>
      </Card>

      <Card className="p-0 lg:col-span-2">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-content">
          Licences ({keys?.length ?? 0})
        </div>
        <div className="max-h-[calc(100vh-26rem)] overflow-y-auto">
          {!keys ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : keys.length === 0 ? (
            <div className="p-4"><EmptyState icon={<KeyRound className="size-7" />} title="Aucune clé" /></div>
          ) : (
            keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5 hover:bg-surface-2/30">
                <button onClick={() => { navigator.clipboard?.writeText(k.key); toast.success('Clé copiée'); }} className="flex items-center gap-1.5 font-mono text-xs text-content hover:text-accent" title="Copier">
                  {k.key} <Copy className="size-3 opacity-50" />
                </button>
                <Badge tone={k.type === 'admin' ? 'accent' : 'neutral'}>{k.type}</Badge>
                <Badge tone={k.status === 'used' ? 'info' : k.status === 'revoked' ? 'danger' : 'accent'}>
                  {k.status === 'used' ? 'Utilisée' : k.status === 'revoked' ? 'Révoquée' : 'Libre'}
                </Badge>
                <span className="flex-1 truncate text-xs text-muted">{k.used_by_email ?? k.note ?? ''}</span>
                {k.status === 'unused' && (
                  <Button variant="ghost" size="sm" className="hover:text-danger" onClick={() => revoke(k.id)} icon={<Ban className="size-3.5" />}>
                    Révoquer
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Comptes ----------------------------------- */
function AccountsTab({ onChange }: { onChange: () => void }) {
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const load = () => get<{ accounts: AdminAccount[] }>('/admin/accounts').then((d) => setAccounts(d.accounts)).catch(() => {});
  useEffect(() => { load(); }, []);

  const action = async (path: string, body: unknown, msg: string) => {
    try {
      await post(path, body);
      toast.success(msg);
      load();
      onChange();
    } catch (e) {
      toast.error('Échec', (e as Error).message);
    }
  };

  return (
    <Card className="p-0">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-content">
        Comptes ({accounts?.length ?? 0})
      </div>
      <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
        {!accounts ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : accounts.length === 0 ? (
          <div className="p-4"><EmptyState icon={<Users className="size-7" />} title="Aucun compte" /></div>
        ) : (
          accounts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-3 hover:bg-surface-2/30">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-grad text-sm font-semibold text-[#04130d]">
                {a.email[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-content">{a.email}</p>
                  <Badge tone={a.role === 'admin' ? 'accent' : 'neutral'}>{a.role}</Badge>
                  {a.status === 'revoked' && <Badge tone="danger">Révoqué</Badge>}
                </div>
                <p className="truncate font-mono text-2xs text-faint">
                  {a.hwid ? `${a.hwid_label ?? 'Appareil'} · lié le ${formatDate(a.hwid_registered_at)}` : 'Aucun appareil lié'}
                </p>
              </div>
              <div className="flex gap-1.5">
                {a.hwid && (
                  <Button variant="secondary" size="sm" icon={<MonitorX className="size-3.5" />} onClick={() => action(`/admin/accounts/${a.id}/reset-hwid`, undefined, 'Appareil délié')}>
                    Délier
                  </Button>
                )}
                {a.status === 'active' ? (
                  <Button variant="ghost" size="sm" className="hover:text-danger" icon={<Ban className="size-3.5" />} onClick={() => action(`/admin/accounts/${a.id}/status`, { status: 'revoked' }, 'Compte révoqué')}>
                    Révoquer
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => action(`/admin/accounts/${a.id}/status`, { status: 'active' }, 'Compte réactivé')}>
                    Réactiver
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

/* ----------------------------- Diffusion ---------------------------------- */
function BroadcastTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'info' | 'update' | 'important'>('info');
  const [blocking, setBlocking] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<AdminBroadcast[] | null>(null);
  const [lock, setLock] = useState<{ active: boolean; title?: string | null }>({ active: false });
  const [unlocking, setUnlocking] = useState(false);

  const load = () => get<{ broadcasts: AdminBroadcast[] }>('/admin/broadcasts').then((d) => setHistory(d.broadcasts)).catch(() => {});
  const loadLock = () =>
    get<{ active: boolean; title: string | null }>('/admin/lockdown').then(setLock).catch(() => {});
  useEffect(() => {
    load();
    loadLock();
    const off = on('lockdown', (d) => {
      const p = d as { active: boolean; title?: string };
      setLock({ active: !!p.active, title: p.title ?? null });
    });
    return off;
  }, []);

  const clearLock = async () => {
    setUnlocking(true);
    try {
      await post('/admin/lockdown/clear');
      setLock({ active: false });
      toast.success('Blocage levé', 'Les utilisateurs ont retrouvé l\'accès.');
    } catch (e) {
      toast.error('Échec', (e as Error).message);
    } finally {
      setUnlocking(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await del(`/admin/broadcasts/${id}`);
      setHistory((h) => h?.filter((m) => m.id !== id) ?? h);
      toast.success('Message supprimé');
    } catch (e) {
      toast.error('Échec', (e as Error).message);
    }
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Titre et message requis');
      return;
    }
    setSending(true);
    try {
      const res = await post<{ delivered: number }>('/admin/broadcast', { title, body, kind, blocking });
      toast.success(
        blocking ? 'Application bloquée' : 'Message diffusé',
        blocking ? 'Les utilisateurs sont bloqués jusqu\'au déblocage.' : `Envoyé à ${res.delivered} utilisateur(s) en ligne.`,
      );
      setTitle('');
      setBody('');
      setBlocking(false);
      load();
      loadLock();
    } catch (e) {
      toast.error('Échec', (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Statut du blocage global */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-4 rounded-2xl border p-4',
          lock.active ? 'border-danger/40 bg-danger/[0.07]' : 'border-border bg-surface/50',
        )}
      >
        <div
          className={cn(
            'flex size-11 items-center justify-center rounded-xl border',
            lock.active ? 'border-danger/30 bg-danger/10 text-danger' : 'border-border bg-surface-2/60 text-accent',
          )}
        >
          {lock.active ? <Lock className="size-5" /> : <ShieldOff className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-content">
              {lock.active ? 'Application BLOQUÉE' : 'Aucun blocage actif'}
            </p>
            <Badge tone={lock.active ? 'danger' : 'accent'} dot>
              {lock.active ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted">
            {lock.active
              ? `Les utilisateurs voient l'overlay « ${lock.title ?? 'Mise à jour'} » et ne peuvent rien faire.`
              : 'Les utilisateurs ont un accès normal à l\'application.'}
          </p>
        </div>
        {lock.active && (
          <Button variant="danger" icon={<ShieldOff className="size-4" />} loading={unlocking} onClick={clearLock}>
            Lever le blocage
          </Button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Composer un message" subtitle="Diffusé en temps réel à tous les utilisateurs" icon={<Megaphone className="size-[18px]" />} />
        <div className="space-y-3">
          <Input label="Titre" placeholder="Nouvelle version disponible" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Détaillez votre annonce…"
              className="w-full rounded-xl border border-border bg-surface-2/50 px-3.5 py-2.5 text-sm text-content placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Type</span>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['info', 'Info'],
                ['update', 'Mise à jour'],
                ['important', 'Important'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setKind(id)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    kind === id ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-muted hover:text-content',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 p-3.5">
            <div>
              <p className="text-sm font-medium text-content">Mise à jour bloquante</p>
              <p className="text-xs text-muted">Bloque l'app jusqu'à validation.</p>
            </div>
            <Toggle checked={blocking} onChange={setBlocking} />
          </div>
          <Button className="w-full" loading={sending} onClick={send} icon={<Send className="size-4" />}>
            Diffuser le message
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border px-5 py-3.5 text-sm font-semibold text-content">Historique</div>
        <div className="max-h-[calc(100vh-20rem)] space-y-2 overflow-y-auto p-4">
          {!history ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : history.length === 0 ? (
            <EmptyState icon={<Megaphone className="size-7" />} title="Aucun message envoyé" />
          ) : (
            history.map((m) => (
              <div key={m.id} className="group rounded-xl border border-border bg-surface-2/30 p-3.5">
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone={m.type === 'important' ? 'warn' : m.type === 'update' ? 'accent' : 'info'}>{m.type}</Badge>
                  {!!m.blocking && <Badge tone="danger">Bloquant</Badge>}
                  <span className="ml-auto text-2xs text-faint">{relativeTime(m.created_at)}</span>
                  <IconButton
                    onClick={() => remove(m.id)}
                    aria-label="Supprimer le message"
                    className="size-7 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
                <p className="text-sm font-medium text-content">{m.title}</p>
                <p className="line-clamp-2 text-xs text-muted">{m.body}</p>
              </div>
            ))
          )}
        </div>
      </Card>
      </div>
    </div>
  );
}

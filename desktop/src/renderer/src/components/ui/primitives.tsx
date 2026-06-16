import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Loader2 } from 'lucide-react';

/* ---------------------------------- Button -------------------------------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent-grad text-[#04130d] font-semibold shadow-[0_6px_22px_-8px_rgb(var(--accent)/0.65)] hover:brightness-110 hover:shadow-[0_8px_28px_-8px_rgb(var(--accent)/0.8)] active:brightness-95 active:translate-y-px',
  secondary:
    'bg-surface-2/70 text-content border border-border hover:border-border-strong hover:bg-surface-2 active:translate-y-px',
  ghost: 'text-muted hover:text-content hover:bg-surface-2/60',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 active:translate-y-px',
  outline: 'border border-accent/40 text-accent hover:bg-accent/10 hover:border-accent/60',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-50 disabled:pointer-events-none select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

/* -------------------------------- IconButton ------------------------------ */
export function IconButton({
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors',
        'hover:bg-surface-2/70 hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ----------------------------------- Card --------------------------------- */
export function Card({
  className,
  children,
  hover,
  ...rest
}: { className?: string; children: ReactNode; hover?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card p-5', hover && 'card-hover', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <div className="icon-chip size-9 shrink-0">{icon}</div>}
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-content">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------------------------------- Badge --------------------------------- */
type Tone = 'accent' | 'warn' | 'danger' | 'info' | 'neutral';
const tones: Record<Tone, string> = {
  accent: 'bg-accent/12 text-accent border-accent/25',
  warn: 'bg-warn/12 text-warn border-warn/25',
  danger: 'bg-danger/12 text-danger border-danger/25',
  info: 'bg-info/12 text-info border-info/25',
  neutral: 'bg-surface-2 text-muted border-border',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------------------------------- Input --------------------------------- */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...rest }, ref) => (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'h-11 w-full rounded-xl border bg-surface-2/50 px-3.5 text-sm text-content placeholder:text-faint',
            'transition-colors focus:outline-none focus:border-accent/60 focus:bg-surface-2/80',
            icon && 'pl-10',
            error ? 'border-danger/60' : 'border-border',
            className,
          )}
          {...rest}
        />
      </div>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  ),
);
Input.displayName = 'Input';

/* ---------------------------------- Toggle -------------------------------- */
export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-[3px] transition-colors duration-200 disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        checked ? 'border-transparent bg-accent' : 'border-border bg-surface-2',
      )}
    >
      <span
        className={cn(
          'size-[16px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out',
          checked ? 'translate-x-[20px]' : 'translate-x-0',
        )}
      />
    </button>
  );
}

/* -------------------------------- ProgressBar ----------------------------- */
export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: Tone }) {
  const color =
    tone === 'danger'
      ? 'bg-danger'
      : tone === 'warn'
        ? 'bg-warn'
        : tone === 'info'
          ? 'bg-info'
          : 'bg-accent-grad';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* --------------------------------- Skeleton ------------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-surface-2/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

/* --------------------------------- Spinner -------------------------------- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-accent', className)} />;
}

/* ------------------------------- EmptyState ------------------------------- */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-content">{title}</p>
        {message && <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{message}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- StatTile -------------------------------- */
export function StatTile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="card card-hover flex items-center gap-3.5 p-4">
      <div className="icon-chip size-11 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</p>
        <p className={cn('truncate font-mono text-lg font-semibold tabular text-content', tone)}>
          {value}
        </p>
        {sub && <p className="truncate text-2xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

/* ------------------------------- SectionTitle ----------------------------- */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-content">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

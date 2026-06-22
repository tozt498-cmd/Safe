import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

/* ------------------------------- Counter ---------------------------------- */
// Nombre qui s'anime de sa valeur précédente vers la nouvelle (count-up).
export function Counter({
  to,
  duration = 1100,
  decimals = 0,
  className,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  return <span className={className}>{value.toFixed(decimals)}</span>;
}

/* ----------------------------- helpers ------------------------------------ */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

function toneColor(v: number): string {
  if (v >= 90) return 'var(--c-danger)';
  if (v >= 78) return 'var(--c-warn)';
  return 'var(--c-accent)';
}

/* ----------------------------- RadialGauge -------------------------------- */
export function RadialGauge({
  value,
  size = 132,
  label,
  unit = '%',
  display,
  colorByValue = true,
}: {
  value: number;
  size?: number;
  label?: string;
  unit?: string;
  display?: string;
  colorByValue?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = Math.round(size * 0.085);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const START = 135;
  const SWEEP = 270;
  const color = colorByValue ? toneColor(v) : 'rgb(var(--accent))';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      style={
        {
          '--c-danger': 'rgb(var(--danger))',
          '--c-warn': 'rgb(var(--warn))',
          '--c-accent': 'rgb(var(--accent))',
        } as React.CSSProperties
      }
    >
      <path
        d={arc(cx, cy, r, START, START + SWEEP)}
        fill="none"
        stroke="rgb(var(--surface-2))"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={arc(cx, cy, r, START, START + (SWEEP * v) / 100)}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        style={{ transition: 'all 0.6s cubic-bezier(0.22,1,0.36,1)' }}
      />
      <text
        x={cx}
        y={label ? cy - size * 0.03 : cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono font-semibold tabular"
        style={{ fontSize: size * 0.21, fill: 'rgb(var(--text))' }}
      >
        {display ?? Math.round(v)}
        <tspan style={{ fontSize: size * 0.1, fill: 'rgb(var(--text-muted))' }}>{unit}</tspan>
      </text>
      {label && (
        <text
          x={cx}
          y={cy + size * 0.22}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: size * 0.092, fill: 'rgb(var(--text-muted))', fontWeight: 500 }}
        >
          {label}
        </text>
      )}
    </svg>
  );
}

/* ------------------------------ HealthRing -------------------------------- */
// Jauge de score circulaire : tracé en dégradé, glow émeraude, remplissage
// animé au chargement et nombre qui compte jusqu'au score.
export function HealthRing({ score, size = 224 }: { score: number; size?: number }) {
  const target = Math.max(0, Math.min(100, score));
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gid = useId();

  // Remplissage au chargement : on part de 0 puis on anime vers la cible.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  const offset = c - (c * progress) / 100;

  const tail =
    target >= 75 ? 'rgb(var(--accent-deep))' : target >= 50 ? 'rgb(var(--warn))' : 'rgb(var(--danger))';
  const glow =
    target >= 75 ? 'rgb(var(--accent))' : target >= 50 ? 'rgb(var(--warn))' : 'rgb(var(--danger))';

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* halo de couleur derrière la jauge */}
      <div
        className="absolute rounded-full"
        style={{ width: size * 0.62, height: size * 0.62, background: glow, filter: 'blur(48px)', opacity: 0.22 }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent-bright))" />
            <stop offset="100%" stopColor={tail} />
          </linearGradient>
          <filter id={`${gid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={glow} floodOpacity="0.6" />
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          filter={`url(#${gid}-glow)`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Counter
          to={target}
          className="font-mono text-[3.6rem] font-semibold leading-none tabular text-content"
        />
        <span className="mt-2 text-2xs uppercase tracking-[0.22em] text-faint">Score / 100</span>
      </div>
    </div>
  );
}

/* ------------------------------- AreaChart -------------------------------- */
export function AreaChart({
  data,
  color = 'rgb(var(--accent))',
  height = 64,
  max,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  max?: number;
  className?: string;
}) {
  const gid = useId();
  const W = 100;
  const H = height;
  if (data.length < 2) {
    return <div style={{ height }} className={cn('w-full', className)} />;
  }
  const top = max ?? Math.max(...data, 1) * 1.15;
  const step = W / (data.length - 1);
  const pts = data.map((d, i) => [i * step, H - (Math.min(d, top) / top) * (H - 4) - 2]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={className}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------- Sparkline -------------------------------- */
export function Sparkline({ data, color = 'rgb(var(--accent))' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <div className="h-8" />;
  const W = 100;
  const H = 32;
  const top = Math.max(...data, 1);
  const step = W / (data.length - 1);
  const line = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(H - (d / top) * (H - 2) - 1).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------ LinearGauge ------------------------------- */
export function LinearGauge({
  value,
  label,
  valueText,
}: {
  value: number;
  label: string;
  valueText: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 85 ? 'bg-danger' : v >= 65 ? 'bg-warn' : 'bg-accent';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="font-mono text-xs font-medium tabular text-content">{valueText}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

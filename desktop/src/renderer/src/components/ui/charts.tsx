import { useId } from 'react';
import { cn } from '../../lib/cn';

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
export function HealthRing({ score, size = 220 }: { score: number; size?: number }) {
  const v = Math.max(0, Math.min(100, score));
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (c * v) / 100;
  const gid = useId();
  const color =
    v >= 75 ? 'rgb(var(--accent))' : v >= 50 ? 'rgb(var(--warn))' : 'rgb(var(--danger))';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent-bright))" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
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
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[3.4rem] font-semibold leading-none tabular text-content">
          {Math.round(v)}
        </span>
        <span className="mt-1 text-2xs uppercase tracking-[0.2em] text-faint">/ 100</span>
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

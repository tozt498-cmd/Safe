import { useId } from 'react';

const BOLT = '150,30 84,150 124,150 106,226 180,100 140,100 168,30';

export function LogoMark({ size = 32 }: { size?: number }) {
  const gid = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--accent-bright))" />
          <stop offset="100%" stopColor="rgb(var(--accent-deep))" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="240" height="240" rx="58" fill={`url(#${gid})`} />
      <polygon points={BOLT} fill="#F4FFFA" />
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-none">
        <span className="block text-sm font-semibold tracking-tight text-content">SafeMarket</span>
        <span className="block text-2xs font-medium uppercase tracking-[0.22em] text-accent">
          Optimiseur
        </span>
      </div>
    </div>
  );
}

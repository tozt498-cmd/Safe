import { useId } from 'react';

/**
 * Illustrations stylisées et originales par jeu (pas de logo officiel sous
 * droits d'auteur) : ambiance + couleurs reconnaissables.
 */
export function GameArt({ id, className }: { id: string; className?: string }) {
  if (id === 'fortnite') return <Fortnite className={className} />;
  if (id === 'valorant') return <Valorant className={className} />;
  if (id === 'gta5') return <Gta className={className} />;
  return <Fortnite className={className} />;
}

const SVG = 'h-full w-full';

function Fortnite({ className }: { className?: string }) {
  const g = useId();
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={`${SVG} ${className ?? ''}`}>
      <defs>
        <linearGradient id={`${g}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B2A6B" />
          <stop offset="55%" stopColor="#3B3FA0" />
          <stop offset="100%" stopColor="#6A3CA6" />
        </linearGradient>
        <radialGradient id={`${g}moon`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#BFE3FF" />
          <stop offset="100%" stopColor="#5AA0FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${g}sky)`} />
      {/* étoiles */}
      {[
        [40, 40], [90, 70], [150, 35], [250, 55], [320, 30], [360, 80], [200, 25], [290, 95],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1} fill="#DCEBFF" opacity="0.85" />
      ))}
      {/* halo lunaire */}
      <circle cx="312" cy="70" r="60" fill={`url(#${g}moon)`} />
      <circle cx="312" cy="70" r="22" fill="#CFE6FF" opacity="0.9" />
      {/* cercle de tempête */}
      <circle cx="312" cy="70" r="40" fill="none" stroke="#8FD0FF" strokeWidth="2" opacity="0.5" />
      <circle cx="312" cy="70" r="52" fill="none" stroke="#8FD0FF" strokeWidth="1.2" opacity="0.3" />
      {/* îles / montagnes */}
      <path d="M0 200 L70 150 L130 195 L190 140 L250 200 L300 165 L400 205 L400 240 L0 240 Z" fill="#16204F" opacity="0.85" />
      <path d="M0 222 L80 188 L160 220 L240 185 L320 220 L400 192 L400 240 L0 240 Z" fill="#0E1638" />
    </svg>
  );
}

function Valorant({ className }: { className?: string }) {
  const g = useId();
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={`${SVG} ${className ?? ''}`}>
      <defs>
        <linearGradient id={`${g}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1A0E12" />
          <stop offset="100%" stopColor="#0C0A0E" />
        </linearGradient>
        <radialGradient id={`${g}glow`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FF4655" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FF4655" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${g}bg)`} />
      <rect width="400" height="240" fill={`url(#${g}glow)`} />
      {/* éclats angulaires */}
      <polygon points="0,0 130,0 60,240 0,240" fill="#FF4655" opacity="0.10" />
      <polygon points="400,0 400,240 320,240 380,0" fill="#FF4655" opacity="0.14" />
      <polygon points="150,240 210,90 230,90 180,240" fill="#FF4655" opacity="0.12" />
      {/* crosshair central */}
      <g stroke="#FF5C69" strokeWidth="3" strokeLinecap="round">
        <line x1="200" y1="92" x2="200" y2="116" />
        <line x1="200" y1="124" x2="200" y2="148" />
        <line x1="164" y1="120" x2="188" y2="120" />
        <line x1="212" y1="120" x2="236" y2="120" />
      </g>
      <circle cx="200" cy="120" r="2.6" fill="#FF5C69" />
      <circle cx="200" cy="120" r="46" fill="none" stroke="#FF4655" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

function Gta({ className }: { className?: string }) {
  const g = useId();
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={`${SVG} ${className ?? ''}`}>
      <defs>
        <linearGradient id={`${g}sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFC24B" />
          <stop offset="45%" stopColor="#FF7E5F" />
          <stop offset="78%" stopColor="#E0497B" />
          <stop offset="100%" stopColor="#3A2A5A" />
        </linearGradient>
        <linearGradient id={`${g}disc`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE08A" />
          <stop offset="100%" stopColor="#FF7E5F" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${g}sun)`} />
      {/* soleil + bandes */}
      <circle cx="200" cy="150" r="74" fill={`url(#${g}disc)`} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="126" y={138 + i * 14} width="148" height="6" fill="#3A2A5A" opacity="0.45" />
      ))}
      {/* skyline */}
      <g fill="#221833">
        <rect x="20" y="150" width="22" height="60" />
        <rect x="48" y="130" width="18" height="80" />
        <rect x="300" y="140" width="20" height="70" />
        <rect x="326" y="120" width="16" height="90" />
        <rect x="348" y="150" width="24" height="60" />
      </g>
      {/* palmier */}
      <g stroke="#1A1226" strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M86 210 Q90 160 96 140" />
      </g>
      <g fill="#1A1226">
        <path d="M96 138 Q70 128 60 138 Q78 134 96 144 Z" />
        <path d="M96 138 Q122 126 134 136 Q112 134 96 146 Z" />
        <path d="M96 138 Q86 116 92 104 Q96 122 100 140 Z" />
        <path d="M96 138 Q108 118 120 114 Q104 124 98 142 Z" />
        <path d="M96 138 Q80 120 70 112 Q90 124 98 142 Z" />
      </g>
      <rect x="0" y="210" width="400" height="30" fill="#1A1226" />
    </svg>
  );
}

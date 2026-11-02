import { makeSigil, type SigilInput } from './sigil.js';

const OUTLINES = {
  heater: 'M10 8 H90 V48 C90 74 70 90 50 98 C30 90 10 74 10 48 Z',
  round: 'M10 8 H90 V52 A40 44 0 0 1 10 52 Z',
  kite: 'M50 4 C74 10 90 22 90 38 C90 64 66 86 50 100 C34 86 10 64 10 38 C10 22 26 10 50 4 Z',
  hex: 'M50 4 L90 24 V72 L50 100 L10 72 V24 Z',
};

function Division({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
    case 'pale':
      return <rect x="50" y="0" width="50" height="104" fill={color} />;
    case 'bend':
      return <path d="M0 0 L100 104 H100 V0 Z" fill={color} />;
    case 'chevron':
      return <path d="M0 104 L50 46 L100 104 V80 L50 26 L0 80 Z" fill={color} />;
    case 'quarterly':
      return (
        <>
          <rect x="50" y="0" width="50" height="52" fill={color} />
          <rect x="0" y="52" width="50" height="52" fill={color} />
        </>
      );
    default:
      return null;
  }
}

function Charge({ kind, color }: { kind: string; color: string }) {
  const s = { fill: color, stroke: '#1a130c', strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'tower':
      return (
        <path
          {...s}
          d="M34 70 V40 H38 V34 H44 V40 H48 V34 H52 V40 H56 V34 H62 V40 H66 V70 Z M46 70 V58 A4 4 0 0 1 54 58 V70 Z"
        />
      );
    case 'bow':
      return (
        <>
          <path {...s} fill="none" strokeWidth={4} stroke={color} d="M38 28 C62 40 62 64 38 76" />
          <path
            {...s}
            d="M36 52 H68 L62 47 M68 52 L62 57"
            fill="none"
            stroke={color}
            strokeWidth={3}
          />
        </>
      );
    case 'leaf':
      return <path {...s} d="M50 26 C68 38 70 60 50 78 C30 60 32 38 50 26 Z M50 32 V74" />;
    case 'dagger':
      return <path {...s} d="M50 22 L56 56 H64 V61 H54 V76 H46 V61 H36 V56 H44 Z" />;
    default:
      return (
        <>
          <ellipse {...s} cx="50" cy="54" rx="13" ry="17" />
          <circle {...s} cx="36" cy="72" r="6" />
          <circle {...s} cx="64" cy="72" r="6" />
        </>
      );
  }
}

function Mark({ op, x, color }: { op: string; x: number; color: string }) {
  const y = 14;
  const p = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const };
  switch (op) {
    case 'shield':
      return (
        <path
          {...p}
          d={`M${x - 4} ${y - 4} H${x + 4} V${y} C${x + 4} ${y + 3} ${x} ${y + 5} ${x} ${y + 5} C${x} ${y + 5} ${x - 4} ${y + 3} ${x - 4} ${y} Z`}
        />
      );
    case 'slow':
      return (
        <path
          {...p}
          d={`M${x} ${y - 5} V${y + 5} M${x - 4.5} ${y - 2.5} L${x + 4.5} ${y + 2.5} M${x - 4.5} ${y + 2.5} L${x + 4.5} ${y - 2.5}`}
        />
      );
    case 'split':
      return (
        <g fill={color}>
          <circle cx={x} cy={y - 3} r="2" />
          <circle cx={x - 3.5} cy={y + 3} r="2" />
          <circle cx={x + 3.5} cy={y + 3} r="2" />
        </g>
      );
    case 'heal':
      return (
        <path {...p} strokeWidth={2.6} d={`M${x} ${y - 5} V${y + 5} M${x - 5} ${y} H${x + 5}`} />
      );
    default:
      return (
        <path
          {...p}
          d={`M${x} ${y - 5} L${x + 1.6} ${y - 1.6} L${x + 5} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 5} L${x - 1.6} ${y + 1.6} L${x - 5} ${y} L${x - 1.6} ${y - 1.6} Z`}
        />
      );
  }
}

export function ForgeSigil({
  unit,
  size = 96,
  motto = false,
  className = '',
}: {
  unit: SigilInput;
  size?: number;
  motto?: boolean;
  className?: string;
}) {
  const g = makeSigil(unit);
  const clip = `sigil-${g.seed.toString(36)}`;
  const xs = g.marks.length === 1 ? [50] : g.marks.length === 2 ? [40, 60] : [32, 50, 68];
  return (
    <figure className={`forge-sigil ${className}`} style={{ width: size }}>
      <svg
        viewBox="-14 -14 128 132"
        width={size}
        height={(size * 132) / 128}
        role="img"
        aria-label={`Generated sigil for ${unit.name}`}
      >
        <defs>
          <clipPath id={clip}>
            <path d={OUTLINES[g.outline]} />
          </clipPath>
          <radialGradient id={`${clip}-shine`} cx="35%" cy="25%" r="80%">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#000" stopOpacity="0.25" />
          </radialGradient>
        </defs>
        <g opacity="0.55">
          {Array.from({ length: g.rays }, (_, i) => {
            const a = (i / g.rays) * Math.PI * 2 + (g.seed % 100) / 100;
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * 52}
                y1={54 + Math.sin(a) * 52}
                x2={50 + Math.cos(a) * 62}
                y2={54 + Math.sin(a) * 62}
                stroke={g.metal}
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
        </g>
        <g clipPath={`url(#${clip})`}>
          <rect x="0" y="0" width="100" height="104" fill={g.field} />
          <Division kind={g.division} color={g.tincture} />
          <g opacity={g.division === 'plain' ? 1 : 0.94}>
            <circle
              cx="50"
              cy="54"
              r="24"
              fill={g.field}
              opacity={g.division === 'plain' ? 0 : 0.85}
            />
          </g>
          <Charge kind={g.charge} color={g.metal} />
          <rect x="0" y="0" width="100" height="24" fill="#120d08" opacity="0.38" />
          {g.marks.map((op, i) => (
            <Mark key={op} op={op} x={xs[i]!} color={g.metal} />
          ))}
          <rect x="0" y="0" width="100" height="104" fill={`url(#${clip}-shine)`} />
        </g>
        <path d={OUTLINES[g.outline]} fill="none" stroke={g.metal} strokeWidth="3.2" />
        <path
          d={OUTLINES[g.outline]}
          fill="none"
          stroke="#120d08"
          strokeWidth="1"
          opacity="0.6"
          transform="translate(50 54) scale(0.9) translate(-50 -54)"
        />
      </svg>
      {motto && <figcaption>“{g.motto}”</figcaption>}
    </figure>
  );
}

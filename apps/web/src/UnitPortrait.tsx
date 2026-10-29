import type { CSSProperties } from 'react';
const frames: Record<string, number> = {
  shield: 0,
  arrow: 1,
  diamond: 2,
  cross: 3,
  orb: 4,
  slime: 5,
};
export function UnitPortrait({
  shape,
  className = '',
  label,
}: {
  shape: string;
  className?: string;
  label?: string;
}) {
  const frame = frames[shape] ?? 4;
  return (
    <span
      className={`unit-portrait ${className}`}
      style={
        {
          '--portrait-x': `${(frame % 3) * 50}%`,
          '--portrait-y': `${Math.floor(frame / 3) * 100}%`,
        } as CSSProperties
      }
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

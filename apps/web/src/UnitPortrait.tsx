import type { CSSProperties } from 'react';
import { soldierRow } from './battle-presentation.js';
import soldierAtlas from './art/sunstone-units.json';
export function UnitPortrait({
  shape,
  className = '',
  label,
}: {
  shape: string;
  className?: string;
  label?: string;
}) {
  const frame = soldierRow(shape);
  const sprite = className.includes('hero-character')
    ? soldierAtlas.frames[frame * 12]!.frame
    : null;
  return (
    <span
      className={`unit-portrait ${className}`}
      style={
        {
          '--portrait-x': `${(frame % 3) * 50}%`,
          '--portrait-y': `${Math.floor(frame / 3) * 100}%`,
          ...(sprite
            ? {
                backgroundImage: "url('/art/sunstone-units.webp')",
                backgroundSize: `${(soldierAtlas.width / sprite.width) * 100}% ${(soldierAtlas.height / sprite.height) * 100}%`,
                backgroundPosition: `${(sprite.x / (soldierAtlas.width - sprite.width)) * 100}% ${(sprite.y / (soldierAtlas.height - sprite.height)) * 100}%`,
                height: 'auto',
                aspectRatio: `${sprite.width} / ${sprite.height}`,
              }
            : {}),
        } as CSSProperties
      }
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

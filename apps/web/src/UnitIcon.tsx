import type { Entity } from '../../../packages/shared/src/index.js';
import { UnitPortrait } from './UnitPortrait.js';

// DOM portraits must not pull the WebGL renderer into the initial app bundle.
export function UnitIcon({ shape, team = 'ember' }: { shape: string; team?: Entity['team'] }) {
  return (
    <span className={`unit-icon ${team}`}>
      <UnitPortrait shape={shape} />
    </span>
  );
}

// Presentation only. Combat positions, damage and timing remain server-authoritative.
export const SOLDIER_ROWS = ['shield', 'arrow', 'diamond', 'cross', 'orb', 'slime'] as const;
export const SOLDIER_COLUMNS = 12;
export const SUNSTONE_ARENA = '/art/sunstone-arena.webp';
export const SUNSTONE_SOLDIERS = '/art/sunstone-units.webp';

export function projectToArena(x: number, y: number, portrait = false) {
  if (portrait) return { x: 48 + x * 0.52, y: 300 + (y - 80) * 1.15 };
  const scale = 675 / 560;
  return {
    x: (72 + x * 0.88) * scale + (1200 - 1200 * scale) / 2,
    y: (168 + (y - 80) * 0.65) * scale,
  };
}

export function soldierRow(shape: string) {
  const row = SOLDIER_ROWS.indexOf(shape as (typeof SOLDIER_ROWS)[number]);
  return row < 0 ? 4 : row;
}

export function soldierPose({
  distance,
  moving,
  attackAge,
  cooldown,
  reduced,
}: {
  distance: number;
  moving: boolean;
  attackAge: number;
  cooldown: number;
  reduced: boolean;
}) {
  if (reduced) return { frame: 0, lift: 0, lean: 0, reach: 0 };
  // A complete stride follows distance travelled, so slow units never skate with fast feet.
  const stride = (distance / 24) * Math.PI * 2;
  if (attackAge >= 0 && attackAge < 7) {
    const contact = Math.max(0, 1 - attackAge / 7);
    return { frame: attackAge < 3 ? 4 : 5, lift: 0, lean: -contact * 0.06, reach: contact * 3 };
  }
  if (moving)
    return {
      frame: Math.sin(stride) >= 0 ? 1 : 2,
      lift: -Math.abs(Math.sin(stride)) * 1.7,
      lean: Math.sin(stride) * 0.018,
      reach: 0,
    };
  return { frame: cooldown > 0 && cooldown <= 4 ? 3 : 0, lift: 0, lean: 0, reach: 0 };
}

export function perspectiveScale(y: number) {
  return 0.88 + Math.max(0, Math.min(1, (y - 80) / 380)) * 0.16;
}

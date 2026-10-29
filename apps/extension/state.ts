// Validate the small display contract without shipping the game's full schema runtime.
type Unit = {
  id: string;
  name: string;
  archetype: string;
  appearance: { shape: string };
  stats: { spawnCost: number };
};
export type ExtensionState = {
  roomId: string;
  team: 'ember' | 'azure';
  phase: 'lobby' | 'battle' | 'results';
  paused: boolean;
  commandsEnabled: boolean;
  energy: number;
  linked: boolean;
  catalog: Record<string, Unit>;
};
const invalid = () => new Error('The battle returned an invalid display state.');
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
};
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.length || value.length > max) throw invalid();
  return value;
}
export function readExtensionState(raw: unknown): ExtensionState {
  const data = object(raw);
  const roomId = text(data.roomId, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId) ||
    !['ember', 'azure'].includes(String(data.team)) ||
    !['lobby', 'battle', 'results'].includes(String(data.phase)) ||
    typeof data.paused !== 'boolean' ||
    typeof data.commandsEnabled !== 'boolean' ||
    typeof data.linked !== 'boolean' ||
    typeof data.energy !== 'number' ||
    !Number.isFinite(data.energy) ||
    data.energy < 0 ||
    data.energy > 10000
  )
    throw invalid();
  const entries = Object.entries(object(data.catalog));
  if (entries.length > 64) throw invalid();
  const catalog: Record<string, Unit> = Object.create(null) as Record<string, Unit>;
  for (const [key, rawUnit] of entries) {
    const unit = object(rawUnit),
      appearance = object(unit.appearance),
      stats = object(unit.stats);
    const id = text(unit.id, 40),
      name = text(unit.name, 60),
      archetype = text(unit.archetype, 24),
      shape = text(appearance.shape, 24);
    if (
      key !== id ||
      !/^[a-z][a-z0-9-]{0,39}$/.test(id) ||
      typeof stats.spawnCost !== 'number' ||
      !Number.isInteger(stats.spawnCost) ||
      stats.spawnCost < 1 ||
      stats.spawnCost > 100
    )
      throw invalid();
    catalog[id] = {
      id,
      name,
      archetype,
      appearance: { shape },
      stats: { spawnCost: stats.spawnCost },
    };
  }
  return {
    roomId,
    team: data.team as ExtensionState['team'],
    phase: data.phase as ExtensionState['phase'],
    paused: data.paused,
    commandsEnabled: data.commandsEnabled,
    linked: data.linked,
    energy: data.energy,
    catalog,
  };
}
export function readCommandResult(raw: unknown) {
  const message = object(raw).message;
  return text(message, 500);
}

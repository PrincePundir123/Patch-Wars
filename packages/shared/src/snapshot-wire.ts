import type { GameState, Snapshot } from './index.js';
export type SnapshotFrame = Omit<Snapshot, 'game'> & {
  game: Omit<GameState, 'catalog'> & { catalog?: GameState['catalog'] };
};
export function compactSnapshot(snapshot: Snapshot): SnapshotFrame {
  const game: SnapshotFrame['game'] = { ...snapshot.game };
  delete game.catalog;
  return { ...snapshot, game };
}
// One decoder per socket connection. Reconnects must start with a full catalog.
export function createSnapshotDecoder() {
  let catalog: GameState['catalog'] | undefined;
  return (frame: SnapshotFrame): Snapshot => {
    catalog = frame.game.catalog ?? catalog;
    if (!catalog) throw new Error('A compact snapshot needs an initial catalog.');
    return { ...frame, game: { ...frame.game, catalog } };
  };
}

import { create } from 'zustand';
import type { Snapshot } from '../../../packages/shared/src/index.js';
type State = {
  snapshot: Snapshot | null;
  connection: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  setSnapshot: (s: Snapshot | null) => void;
  setConnection: (s: State['connection']) => void;
};
export const useBattle = create<State>((set) => ({
  snapshot: null,
  connection: 'offline',
  setSnapshot: (snapshot) => set({ snapshot }),
  setConnection: (connection) => set({ connection }),
}));
export async function api<T = Record<string, unknown>>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? 'Request failed.');
  return data as T;
}

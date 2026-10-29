import { readExtensionState, readCommandResult, type ExtensionState } from './state.js';

declare const PATCH_WARS_BACKEND: string;
type Auth = { token: string; channelId: string; clientId: string };
type Helper = {
  onAuthorized: (fn: (auth: Auth) => void) => void;
  onVisibilityChanged: (fn: (visible: boolean) => void) => void;
  actions: { requestIdShare: () => void };
};
const helper = (window as Window & { Twitch?: { ext?: Helper } }).Twitch?.ext;
const status = document.querySelector<HTMLElement>('#status')!;
const energy = document.querySelector<HTMLElement>('#energy')!;
const units = document.querySelector<HTMLElement>('#units')!;
const identity = document.querySelector<HTMLButtonElement>('#identity')!;
const form = document.querySelector<HTMLFormElement>('#command-form')!;
const input = document.querySelector<HTMLInputElement>('#command')!;
const sendButton = document.querySelector<HTMLButtonElement>('#send')!;
let auth: Auth | undefined;
let state: ExtensionState | undefined;
let visible = true,
  busy = false,
  cooling = false,
  receipt = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let coolingTimer: ReturnType<typeof setTimeout> | undefined;
let request: AbortController | undefined;
let catalogKey = '';
const cards = new Map<string, HTMLButtonElement>();
const shapes: Record<string, number> = {
  shield: 0,
  arrow: 1,
  diamond: 2,
  cross: 3,
  orb: 4,
  slime: 5,
};
async function call(path: string, body?: unknown) {
  const response = await fetch(PATCH_WARS_BACKEND + path, {
    method: body ? 'POST' : 'GET',
    credentials: 'omit',
    headers: {
      Authorization: `Bearer ${auth?.token ?? ''}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: body
      ? AbortSignal.timeout(10000)
      : AbortSignal.any([request!.signal, AbortSignal.timeout(8000)]),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(typeof data.error === 'string' ? data.error : 'Unable to reach the battle.');
  return data;
}
function render() {
  identity.hidden = !!state?.linked;
  form.hidden = !state?.linked;
  energy.textContent = state
    ? `${state.team.toUpperCase()} · ${state.energy} ENERGY`
    : 'CONNECTING';
  const blocked =
    !state ||
    !state.linked ||
    state.paused ||
    state.phase !== 'battle' ||
    !state.commandsEnabled ||
    busy ||
    cooling;
  sendButton.disabled = blocked;
  if (state) {
    const key = JSON.stringify(state.catalog);
    if (key !== catalogKey) {
      catalogKey = key;
      units.replaceChildren();
      cards.clear();
      for (const b of Object.values(state.catalog)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', `Deploy ${b.name}`);
        const art = document.createElement('span');
        art.className = 'portrait';
        const frame = shapes[b.appearance.shape] ?? 4;
        art.style.backgroundPosition = `${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%`;
        art.setAttribute('aria-hidden', 'true');
        const title = document.createElement('strong');
        title.textContent = b.name;
        const detail = document.createElement('small');
        detail.textContent = `${b.archetype} · ⚡ ${b.stats.spawnCost}`;
        button.append(art, title, detail);
        button.addEventListener('click', () => void send(`!spawn ${b.id}`));
        units.append(button);
        cards.set(b.id, button);
      }
    }
    for (const [id, button] of cards)
      button.disabled = blocked || state.energy < state.catalog[id]!.stats.spawnCost;
  }
  status.textContent =
    receipt ||
    (!state
      ? 'Waiting for the streamer to connect a match.'
      : !state.linked
        ? 'Share your Twitch identity to deploy. You can still use Twitch chat.'
        : state.paused
          ? 'Battle paused by the host.'
          : state.phase !== 'battle'
            ? 'Waiting for the host’s next battle.'
            : !state.commandsEnabled
              ? 'Commands paused by the host.'
              : 'Choose your unit. Same costs and cooldowns as chat.');
}
async function send(text: string) {
  if (!state || !auth || busy || cooling) return;
  busy = true;
  render();
  try {
    const data = await call('/api/extension/command', {
      roomId: state.roomId,
      text,
      requestId: crypto.randomUUID(),
    });
    receipt = readCommandResult(data);
    cooling = true;
    coolingTimer = setTimeout(() => {
      cooling = false;
      render();
    }, 1600);
  } catch (error) {
    receipt = (error as Error).message;
  } finally {
    busy = false;
    render();
  }
}
async function refresh() {
  clearTimeout(timer);
  request?.abort();
  if (!visible || document.hidden || !auth) return;
  const current = new AbortController();
  request = current;
  try {
    state = readExtensionState(await call('/api/extension/state'));
    if (request === current) render();
  } catch (error) {
    if (request !== current || current.signal.aborted) return;
    state = undefined;
    catalogKey = '';
    cards.clear();
    units.replaceChildren();
    status.textContent = (error as Error).message;
    sendButton.disabled = true;
  } finally {
    if (request === current && visible && !document.hidden)
      timer = setTimeout(() => void refresh(), 5000);
  }
}
identity.addEventListener('click', () => helper?.actions.requestIdShare());
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void send(input.value.trim());
});
if (helper) {
  helper.onAuthorized((next) => {
    auth = next;
    void refresh();
  });
  helper.onVisibilityChanged((next) => {
    visible = next;
    void refresh();
  });
  document.addEventListener('visibilitychange', () => void refresh());
} else {
  status.textContent =
    'Open this extension in Twitch Local Test or Hosted Test. The normal web app is not a Twitch extension context.';
  sendButton.disabled = true;
  identity.hidden = true;
  form.hidden = true;
}
window.addEventListener('pagehide', () => {
  visible = false;
  request?.abort();
  clearTimeout(timer);
  clearTimeout(coolingTimer);
});

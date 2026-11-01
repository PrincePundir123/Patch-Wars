import { readExtensionState, readCommandResult, type ExtensionState } from './state.js';
import { DeploymentRecord } from '../../packages/shared/src/payments.js';

declare const PATCH_WARS_BACKEND: string;
type Auth = { token: string; channelId: string; clientId: string };
type Helper = {
  onAuthorized: (fn: (auth: Auth) => void) => void;
  onVisibilityChanged: (fn: (visible: boolean) => void) => void;
  actions: { requestIdShare: () => void };
  features: { isBitsEnabled: boolean; onChanged: (fn: () => void) => void };
  bits: {
    getProducts: () => Promise<
      { sku: string; cost: { type: string; amount: string }; inDevelopment?: boolean }[]
    >;
    useBits: (sku: string) => void;
    onTransactionCancelled: (fn: () => void) => void;
    onTransactionComplete: (
      fn: (value: { initiator: string; transactionID: string; transactionReceipt: string }) => void,
    ) => void;
  };
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
let intentId = '';
let products = new Map<string, number>();
let recovery: { intentId: string; transactionId: string } | undefined;
let recovering = false;
let recoveryAttempts = 0;
const recoveryKey = () => `patchwars.bits.${auth?.channelId ?? ''}`;
const retryButton = document.querySelector<HTMLButtonElement>('#retry-payment')!;
const history = document.querySelector<HTMLElement>('#payment-history')!;
const admin = document.querySelector<HTMLElement>('#payment-admin')!;
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
  const paid = !!state?.payments.enabled && !state.host;
  const bitsAvailable = !!helper?.features?.isBitsEnabled;
  document.querySelector<HTMLElement>('#hint')!.textContent = paid
    ? 'One activation deploys one soldier. Confirmed actions wait for space or the next battle on this channel. No guaranteed battle outcome.'
    : 'Free team-energy deployment. No Bits are used.';
  retryButton.hidden = !recovery;
  retryButton.disabled = recovering;
  history.replaceChildren();
  for (const record of (state?.payments.records ?? [])
    .filter((value) => value.transactionId)
    .slice(0, 5)) {
    const row = document.createElement('p');
    row.textContent = `${record.unitId} · ${record.bits} Bits · ${record.status === 'review' ? 'Host review required' : record.status}`;
    history.append(row);
  }
  admin.replaceChildren();
  admin.hidden = !state?.host || !state.payments.enabled;
  if (state?.host && state.payments.enabled) {
    const toggle = document.createElement('button');
    toggle.textContent = state.payments.acceptingEnabled
      ? 'Stop new activations'
      : 'Allow new activations';
    toggle.disabled = busy;
    toggle.onclick = () =>
      void manage({ action: 'accepting', accepting: !state!.payments.acceptingEnabled });
    admin.append(toggle);
    for (const record of state.payments.records.filter((value) => value.status === 'review')) {
      const label = document.createElement('label');
      label.textContent = `${record.unitId}: ${record.note} Inspect delivery before resolving. Resolution note:`;
      const input = document.createElement('input');
      input.maxLength = 300;
      label.append(input);
      admin.append(label);
      for (const action of ['requeue', 'fulfilled'] as const) {
        const button = document.createElement('button');
        button.textContent =
          action === 'requeue' ? 'Requeue after inspection' : 'Confirm already delivered';
        button.onclick = () => {
          if (input.value.trim().length < 10) {
            receipt = 'Enter a resolution note of at least 10 characters.';
            return render();
          }
          void manage({ action, id: record.id, note: input.value.trim() });
        };
        admin.append(button);
      }
    }
  }
  identity.hidden = !!state?.linked;
  form.hidden = !state?.linked;
  document.querySelector<HTMLElement>('#extra-controls')!.hidden = !state?.linked;
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
    const key = JSON.stringify([state.catalog, paid, state.payments.products]);
    if (key !== catalogKey) {
      catalogKey = key;
      units.replaceChildren();
      cards.clear();
      for (const b of Object.values(state.catalog)) {
        const product = paid
          ? state.payments.products.find((value) => value.unitId === b.id)
          : undefined;
        if (paid && !product) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute(
          'aria-label',
          paid ? `Activate ${b.name} · ${product!.bits} Bits` : `Deploy ${b.name}`,
        );
        button.title = paid
          ? `${b.name} · ${product!.bits} Bits · one deployment`
          : `${b.name} · ${b.archetype} · ${b.stats.spawnCost} team energy`;
        const art = document.createElement('span');
        art.className = 'portrait';
        const frame = shapes[b.appearance.shape] ?? 4;
        art.style.backgroundPosition = `${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%`;
        art.setAttribute('aria-hidden', 'true');
        const title = document.createElement('strong');
        title.textContent = b.name;
        const detail = document.createElement('small');
        detail.textContent = paid
          ? `${product!.bits} Bits · one deployment`
          : `${b.archetype} · ⚡ ${b.stats.spawnCost}`;
        button.append(art, title, detail);
        button.addEventListener('click', () =>
          paid ? void activate(product!.sku) : void send(`!spawn ${b.id}`),
        );
        units.append(button);
        cards.set(b.id, button);
      }
    }
    for (const [id, button] of cards) {
      const product = state.payments.products.find((value) => value.unitId === id);
      button.disabled =
        blocked ||
        (paid
          ? !bitsAvailable ||
            !state.payments.accepting ||
            !!recovery ||
            !product ||
            products.get(product.sku) !== product.bits
          : state.energy < state.catalog[id]!.stats.spawnCost);
    }
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
              : paid
                ? !bitsAvailable
                  ? 'Bits actions are unavailable on this channel.'
                  : state.payments.message
                : 'Choose your unit. Free team-energy deployment.');
}
async function loadProducts() {
  products = new Map();
  if (!helper?.features?.isBitsEnabled) return render();
  try {
    const catalog = await helper.bits.getProducts();
    if (!Array.isArray(catalog) || catalog.length > 250) throw new Error();
    for (const product of catalog) {
      const amount = Number(product.cost?.amount);
      if (
        typeof product.sku === 'string' &&
        product.sku.length <= 80 &&
        product.cost?.type === 'bits' &&
        Number.isInteger(amount) &&
        amount > 0 &&
        amount <= 10000 &&
        !product.inDevelopment
      )
        products.set(product.sku, amount);
    }
  } catch {
    receipt = 'Unable to load the Twitch Bits catalog. Reopen the extension to retry.';
  }
  render();
}
async function activate(sku: string) {
  if (!state || !helper?.features?.isBitsEnabled || busy || recovery) return;
  busy = true;
  receipt = 'Preparing activation…';
  render();
  try {
    const record = DeploymentRecord.parse(
      await call('/api/extension/payments/intents', { roomId: state.roomId, sku }),
    );
    intentId = record.id;
    state.payments.records.unshift(record);
    receipt = 'Confirm or cancel in the Twitch dialog.';
    helper.bits.useBits(sku);
  } catch (error) {
    busy = false;
    receipt = (error as Error).message;
  }
  render();
}
async function recoverPayment(signedReceipt?: string) {
  if (!recovery || recovering || !auth) return;
  recovering = true;
  render();
  try {
    const result = DeploymentRecord.parse(
      await call(
        signedReceipt ? '/api/extension/payments/receipt' : '/api/extension/payments/reconcile',
        signedReceipt ? { intentId: recovery.intentId, receipt: signedReceipt } : recovery,
      ),
    );
    receipt = `${result.unitId}: ${result.status === 'fulfilled' ? 'deployed' : result.status === 'review' ? 'host review required' : 'confirmed and queued'}.`;
    recovery = undefined;
    try {
      localStorage.removeItem(recoveryKey());
    } catch {
      /* Recovery also runs on the server. */
    }
    void refresh();
  } catch {
    receipt =
      'Confirmation is being verified. Your action is not lost: use Retry verification or contact the host. Do not activate again.';
  } finally {
    recovering = false;
    render();
  }
}
retryButton.addEventListener('click', () => void recoverPayment());
async function manage(action: object) {
  if (!state?.host || !auth || busy) return;
  busy = true;
  try {
    await call('/api/extension/payments/admin', { ...action, channelId: auth.channelId });
    receipt = 'Activation settings updated.';
    void refresh();
  } catch (error) {
    receipt = (error as Error).message;
  } finally {
    busy = false;
    render();
  }
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
    if (recovery && recoveryAttempts++ < 3) void recoverPayment();
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
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(recoveryKey()) ?? 'null');
      if (
        saved &&
        typeof saved === 'object' &&
        'intentId' in saved &&
        'transactionId' in saved &&
        typeof saved.intentId === 'string' &&
        /^[\da-f-]{36}$/i.test(saved.intentId) &&
        typeof saved.transactionId === 'string' &&
        saved.transactionId.length <= 100
      )
        recovery = { intentId: saved.intentId, transactionId: saved.transactionId };
    } catch {
      /* Server reconciliation covers unavailable browser storage. */
    }
    void loadProducts();
    void refresh();
  });
  helper.features?.onChanged(() => void loadProducts());
  helper.bits?.onTransactionCancelled(() => {
    busy = false;
    receipt = 'Twitch confirmation canceled. No deployment was requested.';
    render();
  });
  helper.bits?.onTransactionComplete((value) => {
    if (
      value.initiator !== 'current_user' ||
      typeof value.transactionID !== 'string' ||
      value.transactionID.length > 100
    )
      return;
    const id =
      intentId || state?.payments.records.find((record) => record.status === 'confirming')?.id;
    busy = false;
    if (!id) {
      receipt = 'Twitch confirmed your action. Server reconciliation will recover its deployment.';
      return render();
    }
    recovery = { intentId: id, transactionId: value.transactionID };
    recoveryAttempts = 0;
    try {
      localStorage.setItem(recoveryKey(), JSON.stringify(recovery));
    } catch {
      /* No secrets are stored. */
    }
    void recoverPayment(
      typeof value.transactionReceipt === 'string' ? value.transactionReceipt : undefined,
    );
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

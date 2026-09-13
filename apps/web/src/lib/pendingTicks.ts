import { api, ApiError } from './api';

/**
 * Ticks on the shopping list that the server has not heard yet (`0055`).
 *
 * The supermarket is where the signal drops, and a tick that quietly undid
 * itself there was the one thing the offline copy (`0053`) still could not do.
 * So every tick goes through here. It is kept on this device first, sent at
 * once when there is a connection, and sent again when one comes back: on
 * reconnecting, on returning to the app, and on opening it.
 *
 * One entry per item, and the last tick wins. Ticking and unticking offline
 * leaves one answer to send, not a history of changes. It is this device's
 * answer, applied when it arrives, so a list ticked on two devices keeps
 * whichever reached the server last.
 */
const KEY = 'nutria-pending-ticks-v1';

type Ticks = Readonly<Record<string, boolean>>;

/** What happened to one tick: it reached the server, the server will never take it, or it waits for a connection. */
export type TickOutcome = 'kept' | 'refused' | 'sent';

const listeners = new Set<() => void>();
/** The ticks the server confirmed in this visit, so the screen shows them without waiting for a new render. */
const confirmed = new Map<string, boolean>();
let cached: Ticks | null = null;
let flushing: Promise<number> | null = null;

function read(): Ticks {
  if (cached) {
    return cached;
  }

  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');

    cached = parsed !== null && typeof parsed === 'object' ? (parsed as Ticks) : {};
  } catch {
    cached = {};
  }

  return cached;
}

function write(next: Ticks): void {
  cached = next;

  try {
    if (Object.keys(next).length === 0) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(next));
    }
  } catch {
    // A device that will not store it still shows the tick; it is only lost on reload.
  }

  for (const listener of listeners) {
    listener();
  }
}

/** Takes a tick off the queue, unless a newer one for the same item arrived while it was being sent. */
function settle(id: string, checked: boolean): void {
  const ticks = read();

  if (ticks[id] !== checked) {
    return;
  }

  write(Object.fromEntries(Object.entries(ticks).filter(([key]) => key !== id)));
}

export function subscribeToTicks(onChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    // Another tab of the app changed the queue.
    if (event.key === KEY) {
      cached = null;
      onChange();
    }
  }

  listeners.add(onChange);
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** What this device knows about an item that the page it came with may not: a tick still waiting, or one confirmed since. */
export function tickOf(id: string): boolean | undefined {
  return read()[id] ?? confirmed.get(id);
}

export function queueTick(id: string, checked: boolean): void {
  write({ ...read(), [id]: checked });
}

/**
 * Tells the server one tick. `refused` is an item that no longer exists or is
 * not theirs — a list rebuilt with a new plan, say — which no retry will
 * change, so it leaves the queue like a sent one. `kept` is a connection that
 * is not there, or a server that failed, and it is tried again later.
 */
export async function sendTick(id: string, checked: boolean): Promise<TickOutcome> {
  try {
    await api(`/shopping-lists/items/${id}`, { body: { checked }, method: 'PATCH' });
  } catch (error: unknown) {
    if (error instanceof ApiError && error.code !== 'NETWORK' && error.status < 500) {
      confirmed.delete(id);
      settle(id, checked);

      return 'refused';
    }

    return 'kept';
  }

  confirmed.set(id, checked);
  settle(id, checked);

  return 'sent';
}

/**
 * Sends everything still waiting, one at a time and one flush at a time.
 * Resolves to how many reached the server. The first tick that finds no
 * connection stops it, because the rest would find the same.
 */
export function flushTicks(): Promise<number> {
  flushing ??= (async () => {
    let sent = 0;

    try {
      for (const [id, checked] of Object.entries(read())) {
        const outcome = await sendTick(id, checked);

        if (outcome === 'kept') {
          break;
        }

        sent += outcome === 'sent' ? 1 : 0;
      }
    } finally {
      flushing = null;
    }

    return sent;
  })();

  return flushing;
}

/** At sign-in, sign-out and account deletion: another session's ticks are not this one's to send. */
export function forgetPendingTicks(): void {
  confirmed.clear();
  write({});
}

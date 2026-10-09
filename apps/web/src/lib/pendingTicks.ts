import { api, ApiError } from './api';

/**
 * Marks on the shopping list that the server has not heard yet (`0055`).
 *
 * The supermarket is where the signal drops, and a mark that quietly undid
 * itself there was the one thing the offline copy (`0053`) still could not do.
 * So every mark goes through here. It is kept on this device first, sent at
 * once when there is a connection, and sent again when one comes back: on
 * reconnecting, on returning to the app, and on opening it.
 *
 * One entry per item, and the last mark wins. Marking and unmarking offline
 * leaves one answer to send, not a history of changes. It is this device's
 * answer, applied when it arrives, so a list marked on two devices keeps
 * whichever reached the server last.
 *
 * Since `0091` a mark is an **amount**, not a tick, and an entry is the request
 * body itself. Holding the body rather than the amount is what lets a v1 entry
 * — a boolean, queued by a build that shipped before this one — go out
 * unchanged: only the server knows the row's whole need, and it is the server
 * that turns `checked` into grams.
 */
const KEY = 'nutria-pending-ticks-v2';

/** The key this queue used while a mark was a tick. Read once, then dropped. */
const KEY_V1 = 'nutria-pending-ticks-v1';

/**
 * One queued mark: exactly the body `PATCH /shopping-lists/items/:id` takes.
 *
 * A mark this build makes carries **both** fields, for one release — as
 * insurance against a rollback, not against a deploy. The API that answers an
 * amount alone with a 400 is no longer live anywhere: it went out with
 * project 020 phase 2. What the tick still buys is that reverting that release
 * would not silently drop every waiting mark, since a 4xx drops the entry
 * (below). The current API prefers the amount when both arrive, so sending both
 * costs nothing but the bytes.
 *
 * Be clear about what the insurance covers: the pre-phase-2 schema is
 * non-strict, so a rolled-back API **strips** the amount and reads the tick.
 * The mark survives; the amount does not. A partial shop — 700 g of 1.2 kg,
 * which sends `checked: false` — would land as nothing bought.
 */
export type PendingMark = { readonly boughtGrams?: number; readonly checked?: boolean };

type Marks = Readonly<Record<string, PendingMark>>;

/** What happened to one mark: it reached the server, the server will never take it, or it waits for a connection. */
export type MarkOutcome = 'kept' | 'refused' | 'sent';

const listeners = new Set<() => void>();
/** The marks the server confirmed in this visit, so the screen shows them without waiting for a new render. */
const confirmed = new Map<string, PendingMark>();
let cached: Marks | null = null;
let flushing: Promise<number> | null = null;

function parse(raw: string | null): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw ?? '{}');

    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * One stored entry, if it really is one — in a list, so it drops out of the
 * queue when it is not.
 *
 * `localStorage` is not ours: anything can write to it, and a value shaped
 * nearly right is worse than one shaped wrong. `{ boughtGrams: null }` would
 * flow into the row's arithmetic and out to the server; an entry with neither
 * field is a body the API refuses.
 */
function asMark(entry: unknown): readonly PendingMark[] {
  if (entry === null || typeof entry !== 'object') {
    return [];
  }

  const { boughtGrams, checked } = entry as { boughtGrams?: unknown; checked?: unknown };
  const amount = boughtGrams === undefined || (typeof boughtGrams === 'number' && Number.isFinite(boughtGrams) && boughtGrams >= 0);
  const tick = checked === undefined || typeof checked === 'boolean';

  if (!amount || !tick || (boughtGrams === undefined && checked === undefined)) {
    return [];
  }

  return [
    {
      ...(boughtGrams === undefined ? {} : { boughtGrams: boughtGrams as number }),
      ...(checked === undefined ? {} : { checked: checked as boolean })
    }
  ];
}

/**
 * The queue, migrating the old key the first time it is read.
 *
 * Here rather than in a one-off at start-up because every screen that reads a
 * mark comes through this function, and a person who installed the app
 * yesterday, marked three things in the aisle and opened it today must not lose
 * them to a deploy. A v1 entry keeps its boolean shape: it says "all of it" or
 * "none of it", which is what `checked` meant, and the server still reads that.
 */
function read(): Marks {
  if (cached) {
    return cached;
  }

  const v2 = Object.fromEntries(Object.entries(parse(localStorage.getItem(KEY))).flatMap(([id, entry]) => asMark(entry).map(mark => [id, mark])));
  const v1 = Object.fromEntries(
    Object.entries(parse(localStorage.getItem(KEY_V1))).flatMap(([id, checked]) => (typeof checked === 'boolean' ? [[id, { checked }]] : []))
  );

  // v2 wins on a collision: it cannot be older, since v1 stopped being written
  // the moment this build loaded.
  cached = { ...v1, ...v2 };

  // Persisted, not written: `write` tells every listener, and this runs inside
  // the snapshot a render reads. Telling React the store changed while it is
  // reading the store is how a render loop starts.
  //
  // The old key goes only once the new one is safely stored. A device with no
  // room would otherwise drop the marks it was migrating and keep them in
  // memory alone — lost to the next reload, which is exactly the person this
  // migration exists for.
  if (Object.keys(v1).length === 0 || persist(cached)) {
    try {
      localStorage.removeItem(KEY_V1);
    } catch {
      // Nothing to drop, or a device that will not let go of it; it is read-only from here.
    }
  }

  return cached;
}

/** Whether the queue actually reached storage: a device can be full, and `0053` stores whole lists beside this. */
function persist(next: Marks): boolean {
  try {
    if (Object.keys(next).length === 0) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(next));
    }

    return true;
  } catch {
    // A device that will not store it still shows the mark; it is only lost on reload.
    return false;
  }
}

function write(next: Marks): void {
  cached = next;
  persist(next);

  for (const listener of listeners) {
    listener();
  }
}

/** Takes a mark off the queue, unless a newer one for the same item arrived while it was being sent. */
function settle(id: string, mark: PendingMark): void {
  const marks = read();
  const queued = marks[id];

  if (queued === undefined || queued.boughtGrams !== mark.boughtGrams || queued.checked !== mark.checked) {
    return;
  }

  write(Object.fromEntries(Object.entries(marks).filter(([key]) => key !== id)));
}

export function subscribeToMarks(onChange: () => void): () => void {
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

/** What this device knows about an item that the page it came with may not: a mark still waiting, or one confirmed since. */
export function markOf(id: string): PendingMark | undefined {
  return read()[id] ?? confirmed.get(id);
}

/**
 * How much of a row this device believes is bought, in grams.
 *
 * The server's figure, unless this device knows better. A v1 entry knows only
 * "all" or "none", so it answers with the row's whole need or zero — the same
 * reading the server gives it.
 */
export function boughtOf(id: string, row: { readonly boughtGrams: number; readonly totalGrams: number }): number {
  const mark = markOf(id);

  if (mark?.boughtGrams !== undefined) {
    return mark.boughtGrams;
  }

  if (mark?.checked !== undefined) {
    return mark.checked ? row.totalGrams : 0;
  }

  return row.boughtGrams;
}

export function queueMark(id: string, mark: PendingMark): void {
  write({ ...read(), [id]: mark });
}

/**
 * The answers that will never change, however many times the mark is sent: the
 * item is gone, is not theirs, or the body is one the server will not take.
 *
 * Deliberately not every 4xx. A session that expired with the tab open answers
 * 401, and dropping the queue on that would throw away a whole aisle's marks
 * the moment somebody's cookie aged out — `0055` drops a mark because "the list
 * was rebuilt, or is not theirs", which a 401, a 403 or a 429 is not. Keeping a
 * mark across an expiry leaks nothing: signing in clears the queue.
 */
const FINAL = new Set([400, 404, 409, 422]);

/**
 * Tells the server one mark. `refused` is an item that no longer exists or is
 * not theirs — a list rebuilt with a new plan, say — which no retry will
 * change, so it leaves the queue like a sent one. `kept` is a connection that
 * is not there, a server that failed, or anything else that may yet succeed,
 * and it is tried again later.
 */
export async function sendMark(id: string, mark: PendingMark): Promise<MarkOutcome> {
  try {
    await api(`/shopping-lists/items/${encodeURIComponent(id)}`, { body: mark, method: 'PATCH' });
  } catch (error: unknown) {
    if (error instanceof ApiError && error.code !== 'NETWORK' && FINAL.has(error.status)) {
      confirmed.delete(id);
      settle(id, mark);

      return 'refused';
    }

    return 'kept';
  }

  confirmed.set(id, mark);
  settle(id, mark);

  return 'sent';
}

/**
 * Sends everything still waiting, one at a time and one flush at a time.
 * Resolves to how many reached the server. The first mark that finds no
 * connection stops it, because the rest would find the same.
 *
 * **Every write goes through here**, including the one a tap makes with a
 * connection, so a device never has two writes to the same row in the air. The
 * entry is re-read at send time rather than taken from a snapshot of the queue:
 * draining twenty rows on supermarket 3G takes seconds, and a reader who
 * unmarks row nine while it drains must not have the older mark land after
 * theirs. That is `0055`'s "the newest mark for a row wins", which is about the
 * server and not only about the queue.
 *
 * It drains again if anything was queued while it drained, so a mark made
 * mid-flush goes out now rather than waiting for the next reconnect. Each pass
 * either empties the queue or stops, and the queue grows only when somebody
 * presses something, so it ends.
 */
export function flushMarks(): Promise<number> {
  flushing ??= (async () => {
    let sent = 0;

    try {
      let moved = true;

      while (moved) {
        moved = false;

        for (const id of Object.keys(read())) {
          const mark = read()[id];

          // Settled by a flush that overlapped this one, or dropped by a change
          // of session while this was draining.
          if (mark === undefined) {
            continue;
          }

          const outcome = await sendMark(id, mark);

          if (outcome === 'kept') {
            return sent;
          }

          sent += outcome === 'sent' ? 1 : 0;
          moved = true;
        }
      }
    } finally {
      flushing = null;
    }

    return sent;
  })();

  return flushing;
}

/**
 * At sign-in, sign-out and account deletion: another session's marks are not
 * this one's to send.
 *
 * Both keys go, and the cache with them. Dropping only the current one would
 * leave a mark the previous build queued sitting in storage, unread because
 * this page had already migrated — and resurrected into the next session by the
 * next reload. A session change means nothing waiting survives it, whichever
 * build wrote it.
 */
export function forgetPendingMarks(): void {
  confirmed.clear();
  cached = null;

  for (const key of [KEY, KEY_V1]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing stored is nothing to forget.
    }
  }

  for (const listener of listeners) {
    listener();
  }
}

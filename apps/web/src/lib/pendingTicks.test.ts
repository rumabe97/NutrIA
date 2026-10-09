import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError } from './api';
import { boughtOf, flushMarks, forgetPendingMarks, markOf, queueMark, sendMark } from './pendingTicks';

import type * as ApiModule from './api';

vi.mock('./api', async importOriginal => ({ ...(await importOriginal<typeof ApiModule>()), api: vi.fn() }));

const send = vi.mocked(api);
const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  removeItem: (key: string) => store.delete(key),
  setItem: (key: string, value: string) => store.set(key, value)
});

const offline = new ApiError('NETWORK', 'Network error', 0);
const KEY = 'nutria-pending-ticks-v2';
const KEY_V1 = 'nutria-pending-ticks-v1';

/** How many marks the device is still holding, read from where it keeps them. */
function waiting(): number {
  return Object.keys(JSON.parse(store.get(KEY) ?? '{}') as object).length;
}

/** A mark as this build makes one: the amount, and the tick derived from it. */
function bought(grams: number, total: number) {
  return { boughtGrams: grams, checked: grams >= total && total > 0 };
}

/*
 * `0055`'s rules are unchanged by `0091` — only what an entry holds changed, from
 * a tick to an amount — so every one of them is proved again here.
 */
describe('pending marks', () => {
  beforeEach(() => {
    forgetPendingMarks();
    store.delete(KEY_V1);
    send.mockReset();
  });

  it('keeps the last mark of each item, on the device, until it is sent', () => {
    queueMark('milk', bought(500, 1200));
    queueMark('milk', bought(0, 1200));
    queueMark('eggs', bought(348, 348));

    expect(markOf('milk')).toEqual({ boughtGrams: 0, checked: false });
    expect(waiting()).toBe(2);
  });

  it('leaves the queue once the server has it, and keeps showing what it confirmed', async () => {
    send.mockResolvedValue(undefined);
    queueMark('milk', bought(500, 1200));

    await expect(sendMark('milk', bought(500, 1200))).resolves.toBe('sent');
    expect(send).toHaveBeenCalledWith('/shopping-lists/items/milk', { body: { boughtGrams: 500, checked: false }, method: 'PATCH' });
    expect(waiting()).toBe(0);
    expect(markOf('milk')).toEqual({ boughtGrams: 500, checked: false });
  });

  /* Both fields, for one release — insurance against a rollback of phase 2, not
     against a deploy: no live API answers an amount alone with a 400 any more.
     A reverted API strips the amount and reads the tick, so the mark survives
     and the amount does not. */
  it('sends the amount and the tick together, so either API takes it', async () => {
    send.mockResolvedValue(undefined);

    await sendMark('milk', bought(1200, 1200));

    expect(send).toHaveBeenCalledWith('/shopping-lists/items/milk', { body: { boughtGrams: 1200, checked: true }, method: 'PATCH' });
  });

  it('waits for a connection that is not there, and for a server that failed', async () => {
    send.mockRejectedValueOnce(offline).mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 'boom', 500));
    queueMark('milk', bought(500, 1200));

    await expect(sendMark('milk', bought(500, 1200))).resolves.toBe('kept');
    await expect(sendMark('milk', bought(500, 1200))).resolves.toBe('kept');
    expect(markOf('milk')).toEqual({ boughtGrams: 500, checked: false });
    expect(waiting()).toBe(1);
  });

  /* A list rebuilt with a new plan: its old items are gone, and no retry brings them back. */
  it('drops a mark the server refuses', async () => {
    send.mockRejectedValue(new ApiError('NOT_FOUND', 'Not found', 404));
    queueMark('gone', bought(500, 1200));

    await expect(sendMark('gone', bought(500, 1200))).resolves.toBe('refused');
    expect(waiting()).toBe(0);
    expect(markOf('gone')).toBeUndefined();
  });

  it('does not let an older answer clear a newer mark made while it was being sent', async () => {
    queueMark('milk', bought(500, 1200));
    send.mockImplementationOnce(async () => {
      queueMark('milk', bought(1200, 1200));

      return undefined;
    });

    await sendMark('milk', bought(500, 1200));

    expect(markOf('milk')).toEqual({ boughtGrams: 1200, checked: true });
    expect(waiting()).toBe(1);
  });

  it('sends everything waiting when the connection comes back, and stops at the first that finds none', async () => {
    queueMark('milk', bought(500, 1200));
    queueMark('eggs', bought(348, 348));
    queueMark('bread', bought(0, 400));
    send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(offline);

    await expect(flushMarks()).resolves.toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(waiting()).toBe(2);

    send.mockResolvedValue(undefined);

    await expect(flushMarks()).resolves.toBe(2);
    expect(waiting()).toBe(0);
  });

  it('runs one flush at a time', async () => {
    queueMark('milk', bought(500, 1200));
    send.mockResolvedValue(undefined);

    const [first, second] = await Promise.all([flushMarks(), flushMarks()]);

    expect([first, second]).toEqual([1, 1]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('forgets every mark at a change of session', () => {
    queueMark('milk', bought(500, 1200));
    forgetPendingMarks();

    expect(waiting()).toBe(0);
    expect(markOf('milk')).toBeUndefined();
    expect(store.has(KEY)).toBe(false);
  });
});

/*
 * A person who marked three things in the aisle yesterday, on the build before
 * this one, and opens the app today. Their marks are booleans, and they must not
 * be lost to a deploy.
 */
describe('pending marks — the queue the previous build left behind', () => {
  beforeEach(() => {
    forgetPendingMarks();
    store.delete(KEY_V1);
    send.mockReset();
  });

  it('adopts a tick queued by the old build, and drops the old key', () => {
    store.set(KEY_V1, JSON.stringify({ eggs: false, milk: true }));

    expect(markOf('milk')).toEqual({ checked: true });
    expect(markOf('eggs')).toEqual({ checked: false });
    expect(store.has(KEY_V1)).toBe(false);
    expect(waiting()).toBe(2);
  });

  /* The amount is never guessed from a boolean here: only the server knows the
     row's whole need, and it is the server that turns a tick into grams. */
  it('sends it as the tick it was, not as an invented amount', async () => {
    store.set(KEY_V1, JSON.stringify({ milk: true }));
    send.mockResolvedValue(undefined);

    await expect(flushMarks()).resolves.toBe(1);
    expect(send).toHaveBeenCalledWith('/shopping-lists/items/milk', { body: { checked: true }, method: 'PATCH' });
  });

  it('lets this build’s own mark win over the old one for the same row', () => {
    store.set(KEY_V1, JSON.stringify({ milk: true }));
    store.set(KEY, JSON.stringify({ milk: { boughtGrams: 500, checked: false } }));

    expect(markOf('milk')).toEqual({ boughtGrams: 500, checked: false });
  });

  it('reads a tick as all of the row or none of it, the way the server reads it', () => {
    store.set(KEY_V1, JSON.stringify({ eggs: false, milk: true }));

    expect(boughtOf('milk', { boughtGrams: 0, totalGrams: 1200 })).toBe(1200);
    expect(boughtOf('eggs', { boughtGrams: 1200, totalGrams: 1200 })).toBe(0);
  });
});

/*
 * The owner's case, through the arithmetic the row itself does: week 1 needs
 * 500 g of the fortnight's 1.2 kg. Marked in the week and read in the fortnight,
 * 700 g are still to buy; marked in the fortnight, the week reads as done.
 */
describe('boughtOf — what the device believes is bought', () => {
  beforeEach(() => {
    forgetPendingMarks();
    store.delete(KEY_V1);
  });

  it('takes the server’s figure until this device knows better', () => {
    expect(boughtOf('chicken', { boughtGrams: 500, totalGrams: 1200 })).toBe(500);
  });

  it('prefers a mark still waiting for a connection', () => {
    queueMark('chicken', bought(500, 1200));

    expect(boughtOf('chicken', { boughtGrams: 0, totalGrams: 1200 })).toBe(500);
  });

  it('marking the week buys the week, and the fortnight still owes the rest', () => {
    const row = { boughtGrams: 0, totalGrams: 1200 };
    // Marking sends max(bought, needed): the week's 500 g.
    const marked = Math.min(Math.max(boughtOf('chicken', row), 500), 1200);

    queueMark('chicken', bought(marked, 1200));

    expect(boughtOf('chicken', row)).toBe(500);
    // Read in the fortnight: 1,200 needed, 500 bought, 700 left — and not done.
    expect(1200 - boughtOf('chicken', row)).toBe(700);
    expect(boughtOf('chicken', row) >= 1200).toBe(false);
  });

  it('marking the fortnight leaves the week reading as done', () => {
    const row = { boughtGrams: 0, totalGrams: 1200 };

    queueMark('chicken', bought(Math.min(Math.max(boughtOf('chicken', row), 1200), 1200), 1200));

    expect(boughtOf('chicken', row) >= 500).toBe(true);
  });

  it('unmarking the week gives back only the week’s share', () => {
    const row = { boughtGrams: 1200, totalGrams: 1200 };
    // Unmarking sends max(0, bought - needed): 1,200 − 500.
    const unmarked = Math.max(boughtOf('chicken', row) - 500, 0);

    queueMark('chicken', bought(unmarked, 1200));

    expect(boughtOf('chicken', row)).toBe(700);
  });
});

/*
 * What `0055` means by "the newest mark for a row wins": the newest reaches the
 * *server* last, not merely the queue. Draining twenty rows on supermarket 3G
 * takes seconds, and somebody who unmarks a row while it drains must not have
 * the older mark land on top of theirs.
 */
describe('flushMarks — a mark made while the queue drains', () => {
  beforeEach(() => {
    forgetPendingMarks();
    store.delete(KEY_V1);
    send.mockReset();
  });

  it('sends the entry as it is at send time, not as it was when the flush began', async () => {
    queueMark('milk', bought(700, 1200));
    queueMark('eggs', bought(348, 348));
    // While the first row is in the air, the reader unmarks the second.
    send.mockImplementationOnce(async () => {
      queueMark('eggs', bought(0, 348));

      return undefined;
    });
    send.mockResolvedValue(undefined);

    await flushMarks();

    const bodies = send.mock.calls.map(([, options]) => (options as { body: unknown }).body);

    expect(bodies).toContainEqual({ boughtGrams: 0, checked: false });
    expect(bodies).not.toContainEqual({ boughtGrams: 348, checked: true });
    expect(waiting()).toBe(0);
  });

  it('drains again for a row queued after the pass had gone by it', async () => {
    queueMark('milk', bought(700, 1200));
    send.mockImplementationOnce(async () => {
      queueMark('bread', bought(400, 400));

      return undefined;
    });
    send.mockResolvedValue(undefined);

    await expect(flushMarks()).resolves.toBe(2);
    expect(waiting()).toBe(0);
  });

  it('sends nothing more once a change of session has emptied the queue mid-flush', async () => {
    queueMark('milk', bought(700, 1200));
    queueMark('eggs', bought(348, 348));
    send.mockImplementationOnce(async () => {
      forgetPendingMarks();

      return undefined;
    });
    send.mockResolvedValue(undefined);

    await flushMarks();

    expect(send).toHaveBeenCalledTimes(1);
  });
});

/*
 * A 4xx is not one thing. `0055` drops a mark because the list was rebuilt or is
 * not theirs; a cookie that aged out with the tab open is neither, and dropping
 * on it would throw away a whole aisle.
 */
describe('sendMark — which answers are final', () => {
  beforeEach(() => {
    forgetPendingMarks();
    store.delete(KEY_V1);
    send.mockReset();
  });

  it.each([400, 404, 409, 422])('drops a mark on %i, which no retry would change', async status => {
    send.mockRejectedValue(new ApiError('CONFLICT', 'no', status));
    queueMark('gone', bought(500, 1200));

    await expect(sendMark('gone', bought(500, 1200))).resolves.toBe('refused');
    expect(waiting()).toBe(0);
  });

  it.each([401, 403, 429, 500])('keeps a mark on %i, which may yet succeed', async status => {
    send.mockRejectedValue(new ApiError('CONFLICT', 'no', status));
    queueMark('milk', bought(500, 1200));

    await expect(sendMark('milk', bought(500, 1200))).resolves.toBe('kept');
    expect(waiting()).toBe(1);
  });

  it('escapes the item id, which comes from storage and not from us', async () => {
    send.mockResolvedValue(undefined);

    await sendMark('../../admin', bought(1, 1));

    expect(send).toHaveBeenCalledWith('/shopping-lists/items/..%2F..%2Fadmin', expect.anything());
  });
});

describe('the queue is read from storage nobody else owns', () => {
  beforeEach(() => {
    forgetPendingMarks();
    store.delete(KEY_V1);
  });

  it.each([
    ['an array', [1, 2]],
    ['neither field', {}],
    ['a null amount', { boughtGrams: null }],
    ['an amount that is not a number', { boughtGrams: '500' }],
    ['a negative amount', { boughtGrams: -5 }],
    ['an infinite amount', { boughtGrams: Number.POSITIVE_INFINITY }],
    ['a tick that is not a boolean', { checked: 'yes' }]
  ])('drops an entry holding %s', (_label, entry) => {
    store.set(KEY, JSON.stringify({ milk: entry }));

    expect(markOf('milk')).toBeUndefined();
  });

  it('keeps a sound one beside it', () => {
    store.set(KEY, JSON.stringify({ eggs: { boughtGrams: 348, checked: true }, milk: { boughtGrams: null } }));

    expect(markOf('eggs')).toEqual({ boughtGrams: 348, checked: true });
    expect(markOf('milk')).toBeUndefined();
  });
});

/* A device with no room left: the migrated marks must not be dropped from the old key before the new one holds them. */
describe('the migration on a device that cannot store', () => {
  beforeEach(() => {
    forgetPendingMarks();
    store.delete(KEY_V1);
  });

  it('keeps the old key when the new one could not be written', () => {
    store.set(KEY_V1, JSON.stringify({ milk: true }));
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(markOf('milk')).toEqual({ checked: true });
    expect(store.has(KEY_V1)).toBe(true);

    setItem.mockRestore();
  });
});

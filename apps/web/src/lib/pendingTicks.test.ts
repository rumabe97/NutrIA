import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError } from './api';
import { flushTicks, forgetPendingTicks, queueTick, sendTick, tickOf } from './pendingTicks';

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

/** How many ticks the device is still holding, read from where it keeps them. */
function waitingTicks(): number {
  return Object.keys(JSON.parse(store.get('nutria-pending-ticks-v1') ?? '{}') as object).length;
}

describe('pending ticks', () => {
  beforeEach(() => {
    forgetPendingTicks();
    send.mockReset();
  });

  it('keeps the last tick of each item, on the device, until it is sent', () => {
    queueTick('milk', true);
    queueTick('milk', false);
    queueTick('eggs', true);

    expect(tickOf('milk')).toBe(false);
    expect(waitingTicks()).toBe(2);
    expect(JSON.parse(store.get('nutria-pending-ticks-v1') ?? '{}')).toEqual({ eggs: true, milk: false });
  });

  it('leaves the queue once the server has it, and keeps showing what it confirmed', async () => {
    send.mockResolvedValue(undefined);
    queueTick('milk', true);

    await expect(sendTick('milk', true)).resolves.toBe('sent');
    expect(send).toHaveBeenCalledWith('/shopping-lists/items/milk', { body: { checked: true }, method: 'PATCH' });
    expect(waitingTicks()).toBe(0);
    expect(tickOf('milk')).toBe(true);
  });

  it('waits for a connection that is not there, and for a server that failed', async () => {
    send.mockRejectedValueOnce(offline).mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 'boom', 500));
    queueTick('milk', true);

    await expect(sendTick('milk', true)).resolves.toBe('kept');
    await expect(sendTick('milk', true)).resolves.toBe('kept');
    expect(tickOf('milk')).toBe(true);
    expect(waitingTicks()).toBe(1);
  });

  /* A list rebuilt with a new plan: its old items are gone, and no retry brings them back. */
  it('drops a tick the server refuses', async () => {
    send.mockRejectedValue(new ApiError('NOT_FOUND', 'Not found', 404));
    queueTick('gone', true);

    await expect(sendTick('gone', true)).resolves.toBe('refused');
    expect(waitingTicks()).toBe(0);
    expect(tickOf('gone')).toBeUndefined();
  });

  it('does not let an older answer clear a newer tick made while it was being sent', async () => {
    queueTick('milk', true);
    send.mockImplementationOnce(async () => {
      queueTick('milk', false);

      return undefined;
    });

    await sendTick('milk', true);

    expect(tickOf('milk')).toBe(false);
    expect(waitingTicks()).toBe(1);
  });

  it('sends everything waiting when the connection comes back, and stops at the first that finds none', async () => {
    queueTick('milk', true);
    queueTick('eggs', true);
    queueTick('bread', false);
    send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(offline);

    await expect(flushTicks()).resolves.toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(waitingTicks()).toBe(2);

    send.mockResolvedValue(undefined);

    await expect(flushTicks()).resolves.toBe(2);
    expect(waitingTicks()).toBe(0);
  });

  it('runs one flush at a time', async () => {
    queueTick('milk', true);
    send.mockResolvedValue(undefined);

    const [first, second] = await Promise.all([flushTicks(), flushTicks()]);

    expect([first, second]).toEqual([1, 1]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('forgets every tick at a change of session', () => {
    queueTick('milk', true);
    forgetPendingTicks();

    expect(waitingTicks()).toBe(0);
    expect(tickOf('milk')).toBeUndefined();
    expect(store.has('nutria-pending-ticks-v1')).toBe(false);
  });
});

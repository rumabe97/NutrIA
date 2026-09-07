import { describe, expect, it, jest } from '@jest/globals';

import { BackgroundTaskService } from './BackgroundTask.service.js';

/** Lets the microtask queue drain; the service deliberately does not await. */
async function settle(): Promise<void> {
  return new Promise(resolve => {
    setImmediate(resolve);
  });
}

describe('BackgroundTaskService', () => {
  it('returns before the work finishes', async () => {
    let finished = false;
    const service = new BackgroundTaskService();

    service.run('slow', async () => {
      await settle();
      finished = true;
    });

    expect(finished).toBe(false);

    await settle();
    await settle();

    expect(finished).toBe(true);
  });

  it('accepts a promise as well as a thunk', async () => {
    const service = new BackgroundTaskService();
    const work = jest.fn<() => Promise<string>>().mockResolvedValue('done');

    service.run('promise', work());

    await settle();

    expect(work).toHaveBeenCalledTimes(1);
  });

  /*
   * The whole point: this runs where `waitUntil` is unavailable and throws, and
   * a rejection here would otherwise take the process down rather than the
   * request. Neither may happen.
   */
  it('swallows a rejection instead of letting it reach the process', async () => {
    const service = new BackgroundTaskService();

    expect(() => {
      service.run('doomed', () => Promise.reject(new Error('boom')));
    }).not.toThrow();

    await settle();
    await settle();
  });
});

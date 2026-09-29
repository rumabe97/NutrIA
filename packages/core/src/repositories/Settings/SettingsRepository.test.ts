import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsRepository } from './SettingsRepository';

let upserted: Record<string, unknown> | undefined;

vi.mock('database', () => ({
  database: () => ({
    transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        insert: () => ({
          values: (values: Record<string, unknown>) => {
            upserted = values;

            return { onConflictDoUpdate: () => Promise.resolve(undefined) };
          }
        })
      })
  })
}));

/** `set` (`0071`): the trail's row goes in the same transaction as the switch — an upsert that always writes, so `record` always runs when given. */
describe('SettingsRepository.set', () => {
  beforeEach(() => {
    upserted = undefined;
  });

  it('writes the switch and calls the record inside the same transaction', async () => {
    const record = vi.fn(async () => {});

    await SettingsRepository.set('premium', true, record);

    expect(upserted).toEqual({ enabled: true, key: 'premium' });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('writes the switch with no record at all when the caller gives none', async () => {
    await expect(SettingsRepository.set('premium', false)).resolves.toBeUndefined();

    expect(upserted).toEqual({ enabled: false, key: 'premium' });
  });
});

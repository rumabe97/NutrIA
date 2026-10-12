import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsRepository } from './SettingsRepository';

let upserted: Record<string, unknown> | undefined;
let deleted = false;

vi.mock('database', () => ({
  database: () => ({
    transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        delete: () => ({
          where: () => {
            deleted = true;

            return Promise.resolve(undefined);
          }
        }),
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

/**
 * `setAllowance` (`0097`, rule 4): a limit put back to what the code ships has
 * its row deleted rather than stored as a number that happens to match today.
 * Stored, it would stop being the shipped number the day a release changed it.
 */
describe('SettingsRepository.setAllowance', () => {
  beforeEach(() => {
    upserted = undefined;
    deleted = false;
  });

  it('stores a limit that differs from the shipped one, and writes the trail with it', async () => {
    const trail = vi.fn(() => Promise.resolve(undefined));

    await SettingsRepository.setAllowance('premium', 'mealSwapsPerPlan', 10, 20, trail);

    expect(upserted).toMatchObject({ key: 'mealSwapsPerPlan', tier: 'premium', value: 10 });
    expect(deleted).toBe(false);
    expect(trail).toHaveBeenCalledTimes(1);
  });

  it('deletes the row when the limit is put back to what the code ships', async () => {
    const trail = vi.fn(() => Promise.resolve(undefined));

    await SettingsRepository.setAllowance('premium', 'mealSwapsPerPlan', 20, 20, trail);

    expect(deleted).toBe(true);
    expect(upserted).toBeUndefined();
    // The trail still runs: putting a limit back is a change somebody made.
    expect(trail).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileRepository } from './ProfileRepository';

let selectResult: Record<string, unknown>[] = [];
let updateResult: Record<string, unknown>[] = [];

vi.mock('database', () => ({
  database: () => ({
    select: () => {
      const chain = { from: () => chain, limit: () => Promise.resolve(selectResult), where: () => chain };

      return chain;
    },
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve(updateResult) }) }) })
  })
}));

/**
 * The enum value `'custom'` stays in Postgres past the column-drop release
 * (`0067`), and the old API deployed alongside the migration that clears it
 * may still write one during the switch. Every read has to keep meaning what
 * a `'custom'` goal always computed as, not fail to parse for a value
 * `GOAL_TYPES` no longer offers.
 */
describe('ProfileRepository — a stored `custom` goal type (`0067`)', () => {
  const ROW = {
    id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    paceKgPerWeek: null,
    startingWeightKg: 72,
    targetWeightKg: null,
    type: 'custom',
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    userId: 'usr-1'
  };

  beforeEach(() => {
    selectResult = [];
    updateResult = [];
  });

  it('findActiveGoal reads it as maintenance — what it always computed as', async () => {
    selectResult = [ROW];

    await expect(ProfileRepository.findActiveGoal('usr-1')).resolves.toMatchObject({ type: 'maintenance' });
  });

  it('upsertGoal reads the row it wrote as maintenance too, whatever the old API left there', async () => {
    // The existing-goal check (`upsertGoal`'s own `select`) finds a row, so the
    // write goes through `update`, not `insert` — the branch this mock covers.
    selectResult = [{ id: ROW.id }];
    updateResult = [ROW];

    await expect(ProfileRepository.upsertGoal('usr-1', { type: 'maintenance' })).resolves.toMatchObject({ type: 'maintenance' });
  });

  it('leaves every other goal type exactly as stored', async () => {
    selectResult = [{ ...ROW, type: 'weight_loss' }];

    await expect(ProfileRepository.findActiveGoal('usr-1')).resolves.toMatchObject({ type: 'weight_loss' });
  });
});

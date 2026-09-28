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
 * `readableGoalType`'s `'custom'` → `'maintenance'` mapping is gone (`0067`,
 * migration `0044`): the Postgres enum no longer offers `'custom'`, so a row
 * this repository reads can never carry it again. What is left to cover is
 * the happy path — a goal type comes back exactly as the row stored it.
 */
describe('ProfileRepository — findActiveGoal / upsertGoal happy path', () => {
  const ROW = {
    id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    paceKgPerWeek: null,
    startingWeightKg: '72',
    targetWeightKg: null,
    type: 'maintenance',
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    userId: 'usr-1'
  };

  beforeEach(() => {
    selectResult = [];
    updateResult = [];
  });

  it('findActiveGoal returns the stored type unchanged', async () => {
    selectResult = [ROW];

    await expect(ProfileRepository.findActiveGoal('usr-1')).resolves.toMatchObject({ type: 'maintenance' });
  });

  it('findActiveGoal converts the numeric columns Drizzle returns as strings', async () => {
    selectResult = [ROW];

    await expect(ProfileRepository.findActiveGoal('usr-1')).resolves.toMatchObject({ startingWeightKg: 72 });
  });

  it('findActiveGoal returns undefined when there is no active goal', async () => {
    selectResult = [];

    await expect(ProfileRepository.findActiveGoal('usr-1')).resolves.toBeUndefined();
  });

  it('upsertGoal returns the row it wrote, type unchanged', async () => {
    // The existing-goal check (`upsertGoal`'s own `select`) finds a row, so the
    // write goes through `update`, not `insert` — the branch this mock covers.
    selectResult = [{ id: ROW.id }];
    updateResult = [{ ...ROW, type: 'weight_loss' }];

    await expect(ProfileRepository.upsertGoal('usr-1', { type: 'weight_loss' })).resolves.toMatchObject({ type: 'weight_loss' });
  });
});

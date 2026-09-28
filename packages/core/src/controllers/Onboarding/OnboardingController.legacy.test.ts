import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PROFILE_CONSENT_VERSION } from 'core/entities/Profile';

import { OnboardingController } from './OnboardingController';

/**
 * The real `OnboardingRepository` against a mocked `database()` — unlike
 * `OnboardingController.test.ts`, which mocks the repository and so never
 * exercises its legacy-row handling. `#repositories/Profile` is mocked
 * instead, so `hasProfileConsent` and a save's write both answer without a
 * second table to fake through the same `select()`.
 */
let selectResult: Record<string, unknown>[] = [];
let writeResult: Record<string, unknown>[] = [];

vi.mock('database', () => ({
  database: () => ({
    insert: () => ({ values: () => ({ returning: () => Promise.resolve(writeResult) }) }),
    select: () => {
      const chain = { from: () => chain, limit: () => Promise.resolve(selectResult), where: () => chain };

      return chain;
    },
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve(writeResult) }) }) })
  })
}));

const upsert = vi.fn(async () => ({}));

vi.mock('#repositories/Profile', () => ({
  ProfileConsentRepository: { find: async () => ({ grantedAt: new Date('2026-09-25T10:00:00Z'), version: PROFILE_CONSENT_VERSION }) },
  ProfileRepository: { upsert: () => upsert() }
}));

/**
 * Every account that finished onboarding before `lifestyle` was removed
 * (`0067`) has this exact shape sitting in `onboarding_state`.
 */
const LEGACY_ROW = {
  id: '11111111-2222-4333-8444-555555555555',
  completedAt: '2026-09-07',
  completedSteps: ['about-you', 'goal', 'body-activity', 'how-you-eat', 'food-preferences', 'allergies', 'lifestyle', 'cooking'],
  currentStep: 10,
  userId: 'usr-1'
};

describe('OnboardingController — a legacy row through the real repository (`0067`)', () => {
  beforeEach(() => {
    selectResult = [];
    writeResult = [];
    upsert.mockClear();
  });

  it('getState still reads a finished legacy account as complete, with nothing missing', async () => {
    selectResult = [LEGACY_ROW];

    const view = await OnboardingController.getState('usr-1');

    expect(view.isComplete).toBe(true);
    expect(view.missingSteps).toEqual([]);
  });

  it('the same row without `completedAt` stays incomplete, but still parses', async () => {
    selectResult = [{ ...LEGACY_ROW, completedAt: null }];

    const view = await OnboardingController.getState('usr-1');

    expect(view.isComplete).toBe(false);
    // Every required step is still there — only the closing flag is missing.
    expect(view.missingSteps).toEqual([]);
  });

  it('saveStep on a legacy account writes cleanly and never puts `lifestyle` back', async () => {
    selectResult = [LEGACY_ROW];
    writeResult = [
      {
        id: LEGACY_ROW.id,
        completedAt: LEGACY_ROW.completedAt,
        completedSteps: LEGACY_ROW.completedSteps.filter(step => step !== 'lifestyle'),
        currentStep: 9,
        userId: 'usr-1'
      }
    ];

    const view = await OnboardingController.saveStep('usr-1', { data: { displayName: 'Ana' }, step: 'about-you' });

    expect(upsert).toHaveBeenCalledOnce();
    expect(view.completedSteps).not.toContain('lifestyle');
    expect(view.isComplete).toBe(true);
  });
});

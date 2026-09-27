import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ONBOARDING_STEPS, REQUIRED_ONBOARDING_STEPS } from 'core/entities/Onboarding';

import { OnboardingRepository } from './OnboardingRepository';

import type { SQL } from 'drizzle-orm';

let selectResult: Record<string, unknown>[] = [];
let updateResult: Record<string, unknown>[] = [];
let insertResult: Record<string, unknown>[] = [];
let updateSet: Record<string, unknown> | undefined;
let insertValues: Record<string, unknown> | undefined;

vi.mock('database', () => ({
  database: () => ({
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        insertValues = values;

        return { returning: () => Promise.resolve(insertResult) };
      }
    }),
    select: () => {
      const chain = { from: () => chain, limit: () => Promise.resolve(selectResult), where: () => chain };

      return chain;
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updateSet = values;

        return { where: (_where: SQL) => ({ returning: () => Promise.resolve(updateResult) }) };
      }
    })
  })
}));

/**
 * Every account that finished onboarding before `lifestyle` was removed
 * (`0067`) has it sitting in `completed_steps`, and `current_step` up to the
 * old ten. Neither survives `ONBOARDING_STEPS` shrinking to nine — a row
 * stored exactly like this is what production holds today.
 */
const LEGACY_ROW = {
  id: '11111111-2222-4333-8444-555555555555',
  completedAt: '2026-09-07',
  completedSteps: ['about-you', 'goal', 'body-activity', 'how-you-eat', 'food-preferences', 'allergies', 'lifestyle', 'cooking'],
  currentStep: 10,
  userId: 'usr-1'
};

describe('OnboardingRepository — a legacy row that still names `lifestyle` (`0067`)', () => {
  beforeEach(() => {
    selectResult = [];
    updateResult = [];
    insertResult = [];
    updateSet = undefined;
    insertValues = undefined;
  });

  it('find parses it — drops `lifestyle`, clamps currentStep, and stays complete for every required step', async () => {
    selectResult = [LEGACY_ROW];

    const state = await OnboardingRepository.find('usr-1');

    expect(state?.completedSteps).not.toContain('lifestyle');
    expect(state?.currentStep).toBeLessThanOrEqual(ONBOARDING_STEPS.length);

    // What `OnboardingController.presentOnboarding` derives from this, and what
    // `RequiresOnboardingGuard` refuses on: `isComplete` is `completedAt` set,
    // `missingSteps` is any required step not in `completedSteps`. Both stay
    // exactly as they were before the step existed — an account that finished
    // onboarding does not get sent back through it because a question it never
    // depended on was removed.
    expect(Boolean(state?.completedAt)).toBe(true);
    expect(REQUIRED_ONBOARDING_STEPS.filter(step => !state?.completedSteps.includes(step))).toEqual([]);
  });

  it('markComplete parses the same legacy shape', async () => {
    updateResult = [LEGACY_ROW];

    const state = await OnboardingRepository.markComplete('usr-1', '2026-09-07');

    expect(state.completedSteps).not.toContain('lifestyle');
    expect(state.currentStep).toBeLessThanOrEqual(ONBOARDING_STEPS.length);
  });

  it('markStepComplete reads a legacy row and never writes `lifestyle` back', async () => {
    selectResult = [LEGACY_ROW];
    updateResult = [
      { ...LEGACY_ROW, completedSteps: LEGACY_ROW.completedSteps.filter(step => step !== 'lifestyle'), currentStep: ONBOARDING_STEPS.length }
    ];

    await OnboardingRepository.markStepComplete('usr-1', 'cooking', ONBOARDING_STEPS.length);

    expect(updateSet?.['completedSteps']).not.toContain('lifestyle');
    expect(updateSet?.['currentStep']).toBeLessThanOrEqual(ONBOARDING_STEPS.length);
  });

  it('markStepComplete inserts cleanly when there is no row at all', async () => {
    insertResult = [
      { id: '22222222-3333-4444-8555-666666666666', completedAt: null, completedSteps: ['about-you'], currentStep: 2, userId: 'usr-2' }
    ];

    await OnboardingRepository.markStepComplete('usr-2', 'about-you', 2);

    expect(insertValues?.['completedSteps']).toEqual(['about-you']);
  });
});

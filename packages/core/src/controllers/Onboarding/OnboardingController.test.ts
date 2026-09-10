import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ONBOARDING_STEPS, REQUIRED_ONBOARDING_STEPS } from 'core/entities/Onboarding';

import { OnboardingController } from './OnboardingController';

import type { OnboardingState, OnboardingStep } from 'core/entities/Onboarding';

const find = vi.fn<(userId: string) => Promise<OnboardingState | undefined>>();

vi.mock('#repositories/Onboarding', () => ({
  OnboardingRepository: { find: (userId: string) => find(userId), markComplete: vi.fn(), markStepComplete: vi.fn() }
}));
vi.mock('#repositories/Profile', () => ({ ProfileRepository: {} }));
vi.mock('#repositories/Safety', () => ({ SafetyRepository: {} }));

function stored(completedSteps: readonly OnboardingStep[], currentStep = 1, completedAt: string | null = null): OnboardingState {
  return { id: '11111111-2222-4333-8444-555555555555', completedAt, completedSteps: [...completedSteps], currentStep, userId: 'usr-1' };
}

/**
 * `resumeStep` is the whole of "onboarding resumes": the client no longer works
 * out where someone belongs, it is told. These cover the shapes that made the
 * old client-side guess wrong.
 */
describe('OnboardingController.getState — the resume target', () => {
  beforeEach(() => {
    find.mockReset();
  });

  it('sends someone who has never started to the first step', async () => {
    find.mockResolvedValue(undefined);

    await expect(OnboardingController.getState('usr-1')).resolves.toMatchObject({ isComplete: false, resumeStep: 1 });
  });

  it('sends someone mid-flow to the step after the ones they finished', async () => {
    find.mockResolvedValue(stored(['about-you', 'goal'], 3));

    await expect(OnboardingController.getState('usr-1')).resolves.toMatchObject({ resumeStep: 3 });
  });

  it('resolves to the first *missing* step, not the furthest one reached', async () => {
    // Someone who filled steps 1–4, then jumped back and re-saved step 1: the
    // stored `currentStep` reads 2, and the client's old `min(currentStep, 9)`
    // sent them to a step they had already answered. The gap is what matters.
    find.mockResolvedValue(stored(['about-you', 'goal', 'body-activity', 'how-you-eat'], 2));

    await expect(OnboardingController.getState('usr-1')).resolves.toMatchObject({ resumeStep: 5 });
  });

  it('skips over steps completed out of order', async () => {
    find.mockResolvedValue(stored(['about-you', 'body-activity', 'how-you-eat'], 5));

    const view = await OnboardingController.getState('usr-1');

    // 'goal' is the hole, and it is step 2.
    expect(view.missingSteps[0]).toBe('goal');
    expect(view.resumeStep).toBe(2);
  });

  it('sends someone with every answer in to the review step, not past it', async () => {
    find.mockResolvedValue(stored(REQUIRED_ONBOARDING_STEPS, 9));

    const view = await OnboardingController.getState('usr-1');

    expect(view.missingSteps).toEqual([]);
    expect(view.resumeStep).toBe(ONBOARDING_STEPS.indexOf('review') + 1);
    // Every answer in is not the same as finished. Until the flow is closed the
    // API refuses a plan, so the resume target has to be the screen that closes it.
    expect(view.isComplete).toBe(false);
  });

  it('still points at review once onboarding is closed, so the link is never dead', async () => {
    find.mockResolvedValue(stored(REQUIRED_ONBOARDING_STEPS, 10, '2026-09-07'));

    await expect(OnboardingController.getState('usr-1')).resolves.toMatchObject({ isComplete: true, resumeStep: 9 });
  });

  it('never resolves past the last screen the flow renders', async () => {
    find.mockResolvedValue(stored(REQUIRED_ONBOARDING_STEPS, 10, '2026-09-07'));

    const view = await OnboardingController.getState('usr-1');

    // The last two entries of ONBOARDING_STEPS are 'review' and 'create-plan';
    // the web flow renders nine screens. A resume target of 10 would 404.
    expect(view.resumeStep).toBeLessThanOrEqual(ONBOARDING_STEPS.length - 1);
  });
});

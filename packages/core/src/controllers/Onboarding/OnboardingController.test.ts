import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ONBOARDING_STEPS, REQUIRED_ONBOARDING_STEPS } from 'core/entities/Onboarding';
import { PROFILE_CONSENT_VERSION } from 'core/entities/Profile';
import { ProfileConsentRequiredError, UnderMinimumAgeError } from 'core/entities/Error';

import { OnboardingController } from './OnboardingController';

import type { OnboardingState, OnboardingStep } from 'core/entities/Onboarding';

const find = vi.fn<(userId: string) => Promise<OnboardingState | undefined>>();
const markStepComplete = vi.fn<(userId: string, step: OnboardingStep, next: number) => Promise<OnboardingState>>();
const consent = vi.fn<(userId: string) => Promise<{ grantedAt: Date; version: string } | undefined>>();
const upsert = vi.fn(async () => ({}));
const upsertGoal = vi.fn(async () => ({}));
const replaceAll = vi.fn(async () => undefined);

vi.mock('#repositories/Onboarding', () => ({
  OnboardingRepository: {
    find: (userId: string) => find(userId),
    markComplete: vi.fn(),
    markStepComplete: (userId: string, step: OnboardingStep, next: number) => markStepComplete(userId, step, next)
  }
}));
vi.mock('#repositories/Profile', () => ({
  ProfileConsentRepository: { find: (userId: string) => consent(userId) },
  ProfileRepository: { upsert: () => upsert(), upsertGoal: () => upsertGoal() }
}));
vi.mock('#repositories/Safety', () => ({ SafetyRepository: { replaceAll: () => replaceAll() } }));

const GIVEN = { grantedAt: new Date('2026-09-25T10:00:00Z'), version: PROFILE_CONSENT_VERSION };

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
    consent.mockResolvedValue(GIVEN);
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

describe('OnboardingController — the profile consent (RGPD art. 9.2.a)', () => {
  beforeEach(() => {
    for (const mock of [find, consent, markStepComplete, upsert, upsertGoal, replaceAll]) {
      mock.mockClear();
    }

    find.mockResolvedValue(stored(REQUIRED_ONBOARDING_STEPS, 10, '2026-09-07'));
    markStepComplete.mockResolvedValue(stored(['about-you'], 2));
  });

  it('says consent is required when none was ever given — also to an account that finished onboarding before it existed', async () => {
    consent.mockResolvedValue(undefined);

    await expect(OnboardingController.getState('usr-1')).resolves.toMatchObject({ isComplete: true, profileConsentRequired: true });
  });

  it('says it is required again when it was given to an older notice', async () => {
    consent.mockResolvedValue({ ...GIVEN, version: '0.9.0' });

    await expect(OnboardingController.getState('usr-1')).resolves.toMatchObject({ profileConsentRequired: true });
  });

  it('does not ask for it once the current notice is consented to', async () => {
    consent.mockResolvedValue(GIVEN);

    await expect(OnboardingController.getState('usr-1')).resolves.toMatchObject({ profileConsentRequired: false });
  });

  it.each([
    ['goal', { type: 'maintenance' }],
    ['body-activity', { activityLevel: 'moderate', currentWeightKg: 70, heightCm: 170 }],
    ['allergies', { allergies: [], customAllergens: [], dietaryPatterns: ['halal'], intolerances: [] }]
  ] as const)('refuses the %s step without it, and stores nothing', async (step, data) => {
    consent.mockResolvedValue(undefined);

    await expect(OnboardingController.saveStep('usr-1', { data, step } as never)).rejects.toBeInstanceOf(ProfileConsentRequiredError);
    expect(upsert).not.toHaveBeenCalled();
    expect(upsertGoal).not.toHaveBeenCalled();
    expect(replaceAll).not.toHaveBeenCalled();
    expect(markStepComplete).not.toHaveBeenCalled();
  });

  it('saves the goal step once it is given', async () => {
    consent.mockResolvedValue(GIVEN);

    await OnboardingController.saveStep('usr-1', { data: { type: 'maintenance' }, step: 'goal' });

    expect(upsertGoal).toHaveBeenCalledOnce();
  });

  it('does not ask for it on a step that collects no health data', async () => {
    consent.mockResolvedValue(undefined);

    await expect(OnboardingController.saveStep('usr-1', { data: { displayName: 'Ana' }, step: 'about-you' })).resolves.toMatchObject({
      profileConsentRequired: true
    });
    expect(upsert).toHaveBeenCalledOnce();
  });
});

describe('OnboardingController — the minimum age', () => {
  beforeEach(() => {
    upsert.mockClear();
    consent.mockResolvedValue(GIVEN);
    markStepComplete.mockResolvedValue(stored(['about-you'], 2));
  });

  function yearsAgo(years: number, days = 0): string {
    const date = new Date();

    date.setUTCFullYear(date.getUTCFullYear() - years);
    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
  }

  it('refuses a birth date under 18 with its own error, and stores nothing', async () => {
    await expect(OnboardingController.saveStep('usr-1', { data: { birthDate: yearsAgo(17) }, step: 'about-you' })).rejects.toBeInstanceOf(
      UnderMinimumAgeError
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('refuses the day before the eighteenth birthday', async () => {
    await expect(OnboardingController.saveStep('usr-1', { data: { birthDate: yearsAgo(18, 1) }, step: 'about-you' })).rejects.toBeInstanceOf(
      UnderMinimumAgeError
    );
  });

  it('accepts the eighteenth birthday itself', async () => {
    await OnboardingController.saveStep('usr-1', { data: { birthDate: yearsAgo(18) }, step: 'about-you' });

    expect(upsert).toHaveBeenCalledOnce();
  });
});

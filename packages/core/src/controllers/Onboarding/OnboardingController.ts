import { ONBOARDING_STEPS, REQUIRED_ONBOARDING_STEPS } from 'core/entities/Onboarding';
import { OnboardingRepository } from '#repositories/Onboarding';
import { resolveFreeTextAllergens } from 'core/controllers/Safety';
import { ProfileRepository } from '#repositories/Profile';
import { SafetyRepository } from '#repositories/Safety';
import type { OnboardingState, OnboardingStep, OnboardingStepInput } from 'core/entities/Onboarding';

// --- Presenters ---------------------------------------------------------------

export interface OnboardingView {
  completedAt: string | null;
  completedSteps: readonly OnboardingStep[];
  currentStep: number;
  isComplete: boolean;
  /** The steps still standing between the user and a plan. */
  missingSteps: readonly OnboardingStep[];
  /**
   * Where someone returning mid-flow belongs: the position of the first
   * incomplete step in `ONBOARDING_STEPS`, one-based, or the review step once
   * every answer is in.
   *
   * Resolved here so no client has to work it out. The two that did computed
   * `min(currentStep, 9)`, and `currentStep` is *the step after the last one
   * saved* — go back and re-save step 1 and it says 2, sending you to a step
   * you finished days ago. The first missing step is the only definition that
   * survives someone editing out of order.
   */
  resumeStep: number;
  totalSteps: number;
}

function presentOnboarding(state: OnboardingState | undefined): OnboardingView {
  const completedSteps = state?.completedSteps ?? [];
  const missingSteps = REQUIRED_ONBOARDING_STEPS.filter(step => !completedSteps.includes(step));
  const firstMissing = missingSteps[0];

  return {
    completedAt: state?.completedAt ?? null,
    completedSteps,
    currentStep: state?.currentStep ?? 1,
    isComplete: Boolean(state?.completedAt),
    missingSteps,
    resumeStep: firstMissing ? ONBOARDING_STEPS.indexOf(firstMissing) + 1 : REQUIRED_ONBOARDING_STEPS.length + 1,
    totalSteps: ONBOARDING_STEPS.length
  };
}

// --- Controller ---------------------------------------------------------------

export const OnboardingController = {
  /**
   * Closes onboarding. Refuses while any required step is missing rather than
   * accepting a partial profile — the generator downstream cannot build a safe
   * plan without the allergy step, and a "complete" flag it can trust is the
   * cheapest place to enforce that.
   */
  async complete(userId: string): Promise<OnboardingView> {
    const state = await OnboardingRepository.find(userId);
    const view = presentOnboarding(state);

    if (view.missingSteps.length > 0) {
      return view;
    }

    if (view.isComplete) {
      return view;
    }

    return presentOnboarding(await OnboardingRepository.markComplete(userId, new Date().toISOString().slice(0, 10)));
  },

  async getState(userId: string): Promise<OnboardingView> {
    return presentOnboarding(await OnboardingRepository.find(userId));
  },

  /**
   * Saves one step and records it as done.
   *
   * Each step writes to the same tables the profile screen edits — there is no
   * parallel "onboarding draft" store. That is what makes the flow resumable
   * from any device and keeps a half-finished onboarding from diverging from the
   * profile it is supposed to be filling in.
   */
  async saveStep(userId: string, input: OnboardingStepInput): Promise<OnboardingView> {
    switch (input.step) {
      case 'about-you':
        await ProfileRepository.upsert(userId, input.data);
        break;

      case 'goal':
        await ProfileRepository.upsertGoal(userId, input.data);
        break;

      case 'body-activity': {
        const { activityLevel, currentWeightKg, heightCm } = input.data;

        await ProfileRepository.upsert(userId, { heightCm });
        await ProfileRepository.upsertPreferences(userId, { activityLevel });

        // Weight belongs to the goal: it is the baseline every target is
        // computed against, and it must not silently change when the profile does.
        const goal = await ProfileRepository.findActiveGoal(userId);

        if (goal) {
          await ProfileRepository.upsertGoal(userId, {
            customGoal: goal.customGoal,
            paceKgPerWeek: goal.paceKgPerWeek,
            startingWeightKg: currentWeightKg,
            targetWeightKg: goal.targetWeightKg,
            type: goal.type
          });
        }

        break;
      }

      case 'how-you-eat':
      case 'lifestyle':
      case 'cooking':
        await ProfileRepository.upsertPreferences(userId, input.data);
        break;

      case 'food-preferences':
        await ProfileRepository.setFoodPreferences(userId, input.data.preferences);
        await ProfileRepository.setCuisines(userId, input.data.cuisines);
        break;

      case 'allergies': {
        // Free text is resolved through the same domain matcher the profile
        // screen uses. Two save paths, one definition of what a word means.
        const customAllergens = await resolveFreeTextAllergens(input.data.customAllergens);

        await SafetyRepository.replaceAll(
          userId,
          { allergies: input.data.allergies, customAllergens: input.data.customAllergens, intolerances: input.data.intolerances },
          customAllergens
        );
        await ProfileRepository.setDietaryPatterns(userId, input.data.dietaryPatterns);
        break;
      }
    }

    const index = ONBOARDING_STEPS.indexOf(input.step);

    return presentOnboarding(await OnboardingRepository.markStepComplete(userId, input.step, Math.min(index + 2, ONBOARDING_STEPS.length)));
  }
};

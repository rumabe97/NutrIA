import { ONBOARDING_STEPS, REQUIRED_ONBOARDING_STEPS } from 'core/entities/Onboarding';
import { OnboardingRepository } from '#repositories/Onboarding';
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
  totalSteps: number;
}

function presentOnboarding(state: OnboardingState | undefined): OnboardingView {
  const completedSteps = state?.completedSteps ?? [];
  const missingSteps = REQUIRED_ONBOARDING_STEPS.filter(step => !completedSteps.includes(step));

  return {
    completedAt: state?.completedAt ?? null,
    completedSteps,
    currentStep: state?.currentStep ?? 1,
    isComplete: Boolean(state?.completedAt),
    missingSteps,
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

    if (view.missingSteps.length > 0) {return view;}

    if (view.isComplete) {return view;}

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

      case 'allergies':
        await SafetyRepository.replaceAll(userId, { allergies: input.data.allergies, intolerances: input.data.intolerances });
        await ProfileRepository.setDietaryPatterns(userId, input.data.dietaryPatterns);
        break;
    }

    const index = ONBOARDING_STEPS.indexOf(input.step);

    return presentOnboarding(await OnboardingRepository.markStepComplete(userId, input.step, Math.min(index + 2, ONBOARDING_STEPS.length)));
  }
};

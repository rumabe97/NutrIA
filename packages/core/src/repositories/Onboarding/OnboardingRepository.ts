import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { onboardingState } from 'database/schema/profile';

import { DatabaseOperationError } from 'core/entities/Error';
import { ONBOARDING_STEPS, onboardingStateSchema } from 'core/entities/Onboarding';
import type { OnboardingState, OnboardingStep } from 'core/entities/Onboarding';

export const OnboardingRepository = {
  async find(userId: string): Promise<OnboardingState | undefined> {
    try {
      const [row] = await database().select().from(onboardingState).where(eq(onboardingState.userId, userId)).limit(1);

      return row ? onboardingStateSchema.parse({ ...row, ...sanitizeLegacyRow(row) }) : undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async markComplete(userId: string, completedOn: string): Promise<OnboardingState> {
    try {
      const [row] = await database().update(onboardingState).set({ completedAt: completedOn }).where(eq(onboardingState.userId, userId)).returning();

      return onboardingStateSchema.parse(row ? { ...row, ...sanitizeLegacyRow(row) } : row);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Marks one step done. Idempotent — re-submitting a step must not duplicate it. */
  async markStepComplete(userId: string, step: OnboardingStep, nextStep: number): Promise<OnboardingState> {
    try {
      const db = database();
      const [existingRow] = await db.select().from(onboardingState).where(eq(onboardingState.userId, userId)).limit(1);
      // Sanitised before it is read from: a legacy row's `lifestyle` must not
      // survive into the merge below, or this write would put it right back.
      const existing = existingRow ? { ...existingRow, ...sanitizeLegacyRow(existingRow) } : undefined;
      const completedSteps = [...new Set([...(existing?.completedSteps ?? []), step])];

      const [row] = existing
        ? await db
            .update(onboardingState)
            .set({ completedSteps, currentStep: Math.max(existing.currentStep, nextStep) })
            .where(eq(onboardingState.userId, userId))
            .returning()
        : await db.insert(onboardingState).values({ completedSteps, currentStep: nextStep, userId }).returning();

      return onboardingStateSchema.parse(row ? { ...row, ...sanitizeLegacyRow(row) } : row);
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

/**
 * A stored row, filtered to what `ONBOARDING_STEPS` still recognises, before
 * it reaches `onboardingStateSchema.parse`.
 *
 * Every account that finished onboarding before `lifestyle` was removed
 * (`0067`) has it in `completedSteps` and a `currentStep` up to the old ten —
 * both fail the schema today, and a row that fails to parse is a row that
 * fails `RequiresOnboardingGuard` for someone who already finished. Dropping
 * what the step list no longer knows, and clamping to its new length, is what
 * lets a legacy row keep meaning "done".
 */
function sanitizeLegacyRow(row: { completedSteps: readonly string[]; currentStep: number }): {
  completedSteps: OnboardingStep[];
  currentStep: number;
} {
  return {
    completedSteps: row.completedSteps.filter((step): step is OnboardingStep => (ONBOARDING_STEPS as readonly string[]).includes(step)),
    currentStep: Math.min(Math.max(row.currentStep, 1), ONBOARDING_STEPS.length)
  };
}

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on onboarding_state: ${error.message}`);
  }

  return new DatabaseOperationError();
}

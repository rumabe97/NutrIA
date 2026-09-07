import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { onboardingState } from 'database/schema/profile';

import { DatabaseOperationError } from 'core/entities/Error';
import { onboardingStateSchema } from 'core/entities/Onboarding';
import type { OnboardingState, OnboardingStep } from 'core/entities/Onboarding';

export const OnboardingRepository = {
  async find(userId: string): Promise<OnboardingState | undefined> {
    try {
      const [row] = await database().select().from(onboardingState).where(eq(onboardingState.userId, userId)).limit(1);

      return row ? onboardingStateSchema.parse(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async markComplete(userId: string, completedOn: string): Promise<OnboardingState> {
    try {
      const [row] = await database().update(onboardingState).set({ completedAt: completedOn }).where(eq(onboardingState.userId, userId)).returning();

      return onboardingStateSchema.parse(row);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Marks one step done. Idempotent — re-submitting a step must not duplicate it. */
  async markStepComplete(userId: string, step: OnboardingStep, nextStep: number): Promise<OnboardingState> {
    try {
      const db = database();
      const [existing] = await db.select().from(onboardingState).where(eq(onboardingState.userId, userId)).limit(1);
      const completedSteps = [...new Set([...(existing?.completedSteps ?? []), step])];

      const [row] = existing
        ? await db
            .update(onboardingState)
            .set({ completedSteps, currentStep: Math.max(existing.currentStep, nextStep) })
            .where(eq(onboardingState.userId, userId))
            .returning()
        : await db.insert(onboardingState).values({ completedSteps, currentStep: nextStep, userId }).returning();

      return onboardingStateSchema.parse(row);
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {return new DatabaseOperationError(`Schema mismatch on onboarding_state: ${error.message}`);}

  return new DatabaseOperationError();
}

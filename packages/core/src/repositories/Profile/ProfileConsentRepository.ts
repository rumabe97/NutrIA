import { eq, sql } from 'drizzle-orm';

import { database } from 'database';
import { goals, onboardingState, profileDataConsents, profiles, userDietaryPatterns } from 'database/schema/profile';
import { allergies, customAllergens, intolerances } from 'database/schema/safety';
import { checkIns, progressEntries } from 'database/schema/progress';

import { DatabaseOperationError } from 'core/entities/Error';
import type { OnboardingStep } from 'core/entities/Onboarding';

export type StoredProfileConsent = { readonly grantedAt: Date; readonly version: string };

/**
 * The explicit consent to use the profile's health data (RGPD art. 9.2.a).
 * Every method takes `userId` from the session first and filters on it.
 */
export const ProfileConsentRepository = {
  /** Plain read: one row by a unique key, nothing to hold. */
  async find(userId: string): Promise<StoredProfileConsent | undefined> {
    try {
      const [row] = await database()
        .select({ grantedAt: profileDataConsents.grantedAt, version: profileDataConsents.version })
        .from(profileDataConsents)
        .where(eq(profileDataConsents.userId, userId))
        .limit(1);

      return row;
    } catch {
      throw new DatabaseOperationError();
    }
  },

  /** Upsert on the unique `user_id`: giving it twice records the latest version and moment. */
  async give(userId: string, version: string): Promise<StoredProfileConsent> {
    try {
      const consent = { grantedAt: new Date(), version };
      const [row] = await database()
        .insert(profileDataConsents)
        .values({ ...consent, userId })
        .onConflictDoUpdate({ set: consent, target: profileDataConsents.userId })
        .returning({ grantedAt: profileDataConsents.grantedAt, version: profileDataConsents.version });

      if (!row) {
        throw new DatabaseOperationError();
      }

      return row;
    } catch {
      throw new DatabaseOperationError();
    }
  },

  /**
   * Withdrawal: the consent and every datum it covered go together, in one
   * transaction, as `HealthRepository.deleteAll` does for the health section —
   * allergies, intolerances and the ones typed by hand, the way of eating, every
   * goal (a goal holds weights), the height, and every recorded weight and body
   * measurement. The steps that collected them are reopened and onboarding is
   * no longer complete, so the account goes back to them.
   *
   * No intermediate state is observable: a profile with its allergies deleted
   * and its plan still generable is exactly what the transaction exists to hide.
   */
  async withdraw(userId: string, reopen: readonly OnboardingStep[], resumeAt: number): Promise<void> {
    try {
      await database().transaction(async tx => {
        await tx.delete(allergies).where(eq(allergies.userId, userId));
        await tx.delete(intolerances).where(eq(intolerances.userId, userId));
        await tx.delete(customAllergens).where(eq(customAllergens.userId, userId));
        await tx.delete(userDietaryPatterns).where(eq(userDietaryPatterns.userId, userId));
        await tx.delete(goals).where(eq(goals.userId, userId));
        await tx.update(profiles).set({ heightCm: null }).where(eq(profiles.userId, userId));
        await tx.update(progressEntries).set({ measurements: null, weightKg: null }).where(eq(progressEntries.userId, userId));
        await tx.update(checkIns).set({ weightKg: null }).where(eq(checkIns.userId, userId));

        // Built step by step rather than with one array operator, so the
        // statement names each step it reopens.
        let completed = sql`${onboardingState.completedSteps}`;

        for (const step of reopen) {
          completed = sql`array_remove(${completed}, ${step})`;
        }

        await tx
          .update(onboardingState)
          .set({ completedAt: null, completedSteps: completed, currentStep: resumeAt })
          .where(eq(onboardingState.userId, userId));
        await tx.delete(profileDataConsents).where(eq(profileDataConsents.userId, userId));
      });
    } catch {
      throw new DatabaseOperationError();
    }
  }
};

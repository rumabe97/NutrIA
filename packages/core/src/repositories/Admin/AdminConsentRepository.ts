import { count, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { database } from 'database';
import { careLinks } from 'database/schema/care';
import { healthDataConsents, onboardingState, profileDataConsents } from 'database/schema/profile';
import { professionals } from 'database/schema/professional';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';

/** How many accounts hold a version of a consent. `null` is a grant that has not been accepted yet (the professional's agreement) or an account created before its terms were recorded. */
export type ConsentVersionRow = { readonly n: number; readonly version: string | null };

/**
 * Who holds which version of each consent that is versioned (`0071`, Personas ›
 * Consentimientos). Every read is a count grouped by a version string: no
 * account, no date of anybody's and no health value is selected (`0028`).
 */
export const AdminConsentRepository = {
  /** Open links (`active` or `paused`) by the version of the care consent the client accepted. Mode: one grouped query. */
  async careVersions(): Promise<readonly ConsentVersionRow[]> {
    try {
      return await database()
        .select({ n: count(), version: careLinks.consentVersion })
        .from(careLinks)
        .where(inArray(careLinks.status, ['active', 'paused']))
        .groupBy(careLinks.consentVersion);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Accounts by the version of the health-data consent they hold. Mode: one grouped query. */
  async healthVersions(): Promise<readonly ConsentVersionRow[]> {
    try {
      return await database()
        .select({ n: count(), version: healthDataConsents.version })
        .from(healthDataConsents)
        .groupBy(healthDataConsents.version);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Accounts that finished onboarding, and how many of them hold the profile
   * consent at `currentVersion` — the two numbers that say whether anyone who
   * got in is about to be asked again. Mode: one aggregate.
   */
  async onboardedAgainstProfileConsent(currentVersion: string): Promise<{ readonly holding: number; readonly onboarded: number }> {
    try {
      const [row] = await database()
        .select({
          holding: sql<number>`count(*) filter (where ${profileDataConsents.version} = ${currentVersion})`.mapWith(Number),
          onboarded: count()
        })
        .from(onboardingState)
        .leftJoin(profileDataConsents, eq(profileDataConsents.userId, onboardingState.userId))
        .where(isNotNull(onboardingState.completedAt));

      return { holding: row?.holding ?? 0, onboarded: row?.onboarded ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Professionals by the version of the agreement they accepted; `null` for a grant not yet accepted. Mode: one grouped query. */
  async professionalVersions(): Promise<readonly ConsentVersionRow[]> {
    try {
      return await database()
        .select({ n: count(), version: professionals.agreementVersion })
        .from(professionals)
        .groupBy(professionals.agreementVersion);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Accounts by the version of the profile-data consent they hold. Mode: one grouped query. */
  async profileVersions(): Promise<readonly ConsentVersionRow[]> {
    try {
      return await database()
        .select({ n: count(), version: profileDataConsents.version })
        .from(profileDataConsents)
        .groupBy(profileDataConsents.version);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Accounts by the version of `/condiciones` they were created under; `null`
   * is every account created before the record existed. Mode: one grouped query.
   */
  async termsVersions(): Promise<readonly ConsentVersionRow[]> {
    try {
      return await database().select({ n: count(), version: user.termsVersion }).from(user).groupBy(user.termsVersion);
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}

import { and, count, countDistinct, desc, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm';

import { database } from 'database';
import { ingredients } from 'database/schema/food';
import { recipeImages, recipes } from 'database/schema/recipe';
import { mealPlans, planGenerationJobs } from 'database/schema/plan';
import { user } from 'database/schema/auth';
import { checkIns } from 'database/schema/progress';
import { mealCompletions } from 'database/schema/plan';
import { onboardingState } from 'database/schema/profile';

import { DatabaseOperationError } from 'core/entities/Error';

export type JobRow = {
  readonly id: string;
  readonly attempts: number;
  readonly error: string | null;
  readonly errorDetail: string | null;
  readonly finishedAt: Date | null;
  readonly startedAt: Date | null;
  readonly status: string;
  readonly step: string | null;
};

/**
 * How many people reached each step, counted from the rows that prove it.
 *
 * Not from the event log (`0033`): these are facts the schema already holds, so
 * reading them where they live means the figures cover every account that ever
 * existed — including the ones from before anybody thought to measure — and
 * cannot drift from the truth they are counting.
 */
export type Funnel = {
  /** Signed in at least once since sessions started being recorded. */
  readonly activated: number;
  readonly checkedIn: number;
  readonly confirmed: number;
  /** Marked at least one meal eaten or skipped. */
  readonly lived: number;
  readonly onboarded: number;
  readonly planned: number;
  /** Came back for a second fortnight. The only number here that is about the product working. */
  readonly returned: number;
  readonly signedUp: number;
};

export type Counts = {
  readonly accounts: { readonly total: number; readonly waiting: number };
  readonly catalogue: { readonly ingredients: number; readonly recipes: number; readonly withoutImage: number };
  readonly jobs: readonly { readonly n: number; readonly status: string }[];
  readonly plans: readonly { readonly n: number; readonly status: string }[];
};

/**
 * Reads for the owner's own screen. Nothing here is scoped to a user — that is
 * the point of it, and why every route that calls it carries `@Roles('admin')`.
 *
 * **No column here carries content.** Not a dish, not a profile, not an email:
 * the questions this answers are "is generation working" and "what is the
 * catalogue's size", and a screen that answered them with someone's plan on it
 * would be a health-data leak wearing a dashboard.
 */
export const AdminRepository = {
  async counts(since: Date): Promise<Counts> {
    try {
      const db = database();
      const [accounts, waiting, jobs, plans, recipeCount, ingredientCount, withoutImage] = await Promise.all([
        db.select({ n: count() }).from(user),
        db.select({ n: count() }).from(user).where(isNull(user.activatedAt)),
        db.select({ n: count(), status: planGenerationJobs.status }).from(planGenerationJobs).where(gte(planGenerationJobs.createdAt, since)).groupBy(planGenerationJobs.status),
        db.select({ n: count(), status: mealPlans.status }).from(mealPlans).groupBy(mealPlans.status),
        db.select({ n: count() }).from(recipes),
        db.select({ n: count() }).from(ingredients),
        db
          .select({ n: count() })
          .from(recipes)
          .where(sql`not exists (select 1 from ${recipeImages} where ${recipeImages.recipeId} = ${recipes.id})`)
      ]);

      return {
        accounts: { total: accounts[0]?.n ?? 0, waiting: waiting[0]?.n ?? 0 },
        catalogue: { ingredients: ingredientCount[0]?.n ?? 0, recipes: recipeCount[0]?.n ?? 0, withoutImage: withoutImage[0]?.n ?? 0 },
        jobs: jobs.map(row => ({ n: row.n, status: row.status })),
        plans: plans.map(row => ({ n: row.n, status: row.status }))
      };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The funnel, in one round trip per stage.
   *
   * `planned` and `returned` come from one grouped read rather than two: the
   * question "how many generated a plan" and "how many generated a second" are
   * the same list counted twice, and asking twice would let them disagree.
   */
  async funnel(): Promise<Funnel> {
    try {
      const db = database();
      const [signedUp, confirmed, activated, onboarded, plansPerUser, lived, checkedIn] = await Promise.all([
        db.select({ n: count() }).from(user),
        db.select({ n: count() }).from(user).where(eq(user.emailVerified, true)),
        db.select({ n: count() }).from(user).where(isNotNull(user.activatedAt)),
        db.select({ n: count() }).from(onboardingState).where(isNotNull(onboardingState.completedAt)),
        db.select({ n: count(), userId: mealPlans.userId }).from(mealPlans).groupBy(mealPlans.userId),
        db.select({ n: countDistinct(mealCompletions.userId) }).from(mealCompletions),
        db.select({ n: countDistinct(checkIns.userId) }).from(checkIns)
      ]);

      return {
        activated: activated[0]?.n ?? 0,
        checkedIn: checkedIn[0]?.n ?? 0,
        confirmed: confirmed[0]?.n ?? 0,
        lived: lived[0]?.n ?? 0,
        onboarded: onboarded[0]?.n ?? 0,
        planned: plansPerUser.length,
        returned: plansPerUser.filter(row => row.n > 1).length,
        signedUp: signedUp[0]?.n ?? 0
      };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** The most recent generations, newest first. Failures first when asked for them. */
  async recentJobs(limit: number, failedOnly: boolean): Promise<readonly JobRow[]> {
    try {
      const rows = await database()
        .select({
          id: planGenerationJobs.id,
          attempts: planGenerationJobs.attempts,
          error: planGenerationJobs.error,
          errorDetail: planGenerationJobs.errorDetail,
          finishedAt: planGenerationJobs.finishedAt,
          startedAt: planGenerationJobs.startedAt,
          status: planGenerationJobs.status,
          step: planGenerationJobs.step
        })
        .from(planGenerationJobs)
        .where(failedOnly ? and(eq(planGenerationJobs.status, 'failed'), isNotNull(planGenerationJobs.error)) : undefined)
        .orderBy(desc(planGenerationJobs.createdAt))
        .limit(limit);

      return rows;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}

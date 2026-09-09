import { and, count, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';

import { database } from 'database';
import { ingredients } from 'database/schema/food';
import { recipeImages, recipes } from 'database/schema/recipe';
import { mealPlans, planGenerationJobs } from 'database/schema/plan';
import { user } from 'database/schema/auth';

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
        db.select({ n: count() }).from(user).where(eq(user.emailVerified, false)),
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

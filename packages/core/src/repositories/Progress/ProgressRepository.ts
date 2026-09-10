import { and, desc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { mealPlans, meals, planDays } from 'database/schema/plan';
import { progressEntries } from 'database/schema/progress';

import { DatabaseOperationError } from 'core/entities/Error';
import { progressEntrySchema } from 'core/entities/Progress';
import type { ProgressEntry } from 'core/entities/Progress';

export type MealMark = { readonly date: string; readonly n: number; readonly planId: string; readonly status: 'completed' | 'planned' | 'skipped' };

export const ProgressRepository = {
  /** The most recent weight the person logged, if any — what the targets are computed against. */
  async findLatestWeight(userId: string): Promise<number | null> {
    try {
      const [row] = await database()
        .select({ weightKg: progressEntries.weightKg })
        .from(progressEntries)
        .where(and(eq(progressEntries.userId, userId), isNotNull(progressEntries.weightKg)))
        .orderBy(desc(progressEntries.loggedOn))
        .limit(1);

      return row?.weightKg === null || row?.weightKg === undefined ? null : Number(row.weightKg);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Most recent first. The dashboard shows the latest and a short trend. */
  async findRecent(userId: string, limit: number): Promise<readonly ProgressEntry[]> {
    try {
      const rows = await database()
        .select({ id: progressEntries.id, loggedOn: progressEntries.loggedOn, weightKg: progressEntries.weightKg })
        .from(progressEntries)
        .where(eq(progressEntries.userId, userId))
        .orderBy(desc(progressEntries.loggedOn))
        .limit(limit);

      return rows.map(row => progressEntrySchema.parse({ ...row, weightKg: row.weightKg === null ? null : Number(row.weightKg) }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * How every plan's meals were marked, per day, for days on or before `upTo`.
   *
   * A meal three days from now is neither eaten nor missed; counting it would
   * make a plan that is going well look half-abandoned on its first morning.
   * Per day rather than per plan because a plan replaced mid-fortnight only
   * counts up to the day it was replaced, and the caller knows that day.
   */
  async mealMarksByDay(userId: string, upTo: string): Promise<readonly MealMark[]> {
    try {
      const rows = await database()
        .select({ date: planDays.date, n: sql<number>`count(*)::int`, planId: planDays.planId, status: meals.status })
        .from(meals)
        .innerJoin(planDays, eq(planDays.id, meals.planDayId))
        .innerJoin(mealPlans, eq(mealPlans.id, planDays.planId))
        .where(and(eq(mealPlans.userId, userId), lte(planDays.date, upTo)))
        .groupBy(planDays.planId, planDays.date, meals.status);

      return rows.map(row => ({
        date: row.date,
        n: row.n,
        planId: row.planId,
        status: row.status === 'completed' ? 'completed' : row.status === 'skipped' ? 'skipped' : 'planned'
      }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One weight per day, replaced rather than appended.
   *
   * There is no unique index on `(user_id, logged_on)` to lean on — the table
   * carries energy, hunger and measurements too, and a check-in may write those
   * separately — so the day is looked up first and updated if present. Two
   * weights logged in the same second could still race; the loser is a duplicate
   * reading on one day, which is a cosmetic problem rather than a correctness one.
   */
  async upsertWeight(userId: string, loggedOn: string, weightKg: number): Promise<ProgressEntry> {
    try {
      const db = database();
      const [existing] = await db
        .select({ id: progressEntries.id })
        .from(progressEntries)
        .where(and(eq(progressEntries.userId, userId), eq(progressEntries.loggedOn, loggedOn)))
        .limit(1);

      const [row] = existing
        ? await db
            .update(progressEntries)
            .set({ updatedAt: new Date(), weightKg: String(weightKg) })
            .where(eq(progressEntries.id, existing.id))
            .returning({ id: progressEntries.id, loggedOn: progressEntries.loggedOn, weightKg: progressEntries.weightKg })
        : await db
            .insert(progressEntries)
            .values({ loggedOn, userId, weightKg: String(weightKg) })
            .returning({ id: progressEntries.id, loggedOn: progressEntries.loggedOn, weightKg: progressEntries.weightKg });

      if (!row) {
        throw new DatabaseOperationError('Progress insert returned no row');
      }

      return progressEntrySchema.parse({ ...row, weightKg: row.weightKg === null ? null : Number(row.weightKg) });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on progress_entries: ${error.message}`);
  }

  return new DatabaseOperationError();
}

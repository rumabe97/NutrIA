import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { progressEntries } from 'database/schema/progress';

import { DatabaseOperationError } from 'core/entities/Error';
import { progressEntrySchema } from 'core/entities/Progress';
import type { ProgressEntry } from 'core/entities/Progress';

export const ProgressRepository = {
  /**
   * One weight per day, replaced rather than appended.
   *
   * There is no unique index on `(user_id, logged_on)` to lean on — the table
   * carries energy, hunger and measurements too, and a check-in may write those
   * separately — so the day is looked up first and updated if present. Two
   * weights logged in the same second could still race; the loser is a duplicate
   * reading on one day, which is a cosmetic problem rather than a correctness one.
   */
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

      if (!row) {throw new DatabaseOperationError('Progress insert returned no row');}

      return progressEntrySchema.parse({ ...row, weightKg: row.weightKg === null ? null : Number(row.weightKg) });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {return new DatabaseOperationError(`Schema mismatch on progress_entries: ${error.message}`);}

  return new DatabaseOperationError();
}

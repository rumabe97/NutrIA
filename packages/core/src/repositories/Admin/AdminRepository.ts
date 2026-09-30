import { and, count, countDistinct, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';

import { database } from 'database';
import { recipeImageCalls, recipeImages } from 'database/schema/recipe';
import { mealPlans } from 'database/schema/plan';
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

/** A job with the account that asked for it and the plan it produced, for the generation log (`0050`). */
export type GenerationRow = JobRow & {
  readonly aiCalls: readonly Record<string, unknown>[] | null;
  readonly email: string;
  /** What the plan recorded about its own making; null when the job produced none. */
  readonly metadata: Record<string, unknown> | null;
  readonly name: string | null;
  readonly planVersion: number | null;
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

/**
 * Reads for the owner's own screen. Nothing here is scoped to a user — that is
 * the point of it, and why every route that calls it carries `@Roles('admin')`.
 *
 * **No column here carries content.** Not a dish, not a profile: the questions
 * this answers are "is generation working" and "what is the catalogue's size",
 * and a screen that answered them with someone's plan on it would be a
 * health-data leak wearing a dashboard. The reads that name somebody live
 * elsewhere, each behind a controller of its own: the account list, the inbox,
 * the professionals and the generation log (`AdminGenerationsRepository.page`,
 * an address per job) — `0028`, `0050`, `0068`.
 */
/** The dish pictures at a glance (`0066`): the month's spend and how many are in each state. */
export type PictureCounts = {
  readonly drawing: number;
  /** Failed for the dish's own reasons: rejected, unmarked, broken — waiting out the cool-off. */
  readonly failed: number;
  readonly ready: number;
  /** Given back for a reason that is not the dish's — the cap, a refused key — and drawn again on the next view. */
  readonly released: number;
  /** Dollars billed since the month's start, by the calls themselves. */
  readonly spentUsd: number;
};

/** A picture row a drawing gave back (`RecipeRepository.releasePicture`). */
const released = sql`(${recipeImages.provenance} ->> 'released') is not null`;

/** What a picture row that ended without a picture stored about how: enough for `pictureReasonOf`, and no dish is named. */
export type FailedPictureRow = { readonly provenance: Record<string, unknown> | null; readonly released: boolean };

export const AdminRepository = {
  /**
   * The picture rows that ended without a picture (`failed`, released or not)
   * in `[from, to)` by the time they ended. Only their provenance: the reasons
   * are counted by `pictureReasonOf`, the one place that reads it. Mode: one
   * filtered read; the rows are few (a failed dish waits a week).
   */
  async failedPictures(from: Date, to: Date): Promise<readonly FailedPictureRow[]> {
    try {
      return await database()
        .select({ provenance: recipeImages.provenance, released: sql<boolean>`${released}` })
        .from(recipeImages)
        .where(and(eq(recipeImages.status, 'failed'), gte(recipeImages.lastAttemptAt, from), lt(recipeImages.lastAttemptAt, to)));
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

  /**
   * What the pictures have spent since `monthStart`, and how many dishes have a
   * picture, are being drawn, or failed. Counts only: no dish is named. Mode: two
   * aggregates.
   */
  async pictures(monthStart: Date): Promise<PictureCounts> {
    try {
      const db = database();
      const [states, spend] = await Promise.all([
        db
          .select({ n: count(), released: sql<boolean>`${released}`, status: recipeImages.status })
          .from(recipeImages)
          .groupBy(recipeImages.status, sql`${released}`),
        db
          .select({ total: sql<string>`coalesce(sum(${recipeImageCalls.costUsd}), 0)` })
          .from(recipeImageCalls)
          .where(gte(recipeImageCalls.createdAt, monthStart))
      ]);
      const n = (status: string, wasReleased = false) =>
        states.filter(row => row.status === status && row.released === wasReleased).reduce((total, row) => total + row.n, 0);

      return { drawing: n('drawing'), failed: n('failed'), ready: n('ready'), released: n('failed', true), spentUsd: Number(spend[0]?.total ?? 0) };
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}

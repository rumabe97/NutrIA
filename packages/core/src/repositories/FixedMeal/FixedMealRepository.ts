import { and, asc, eq, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { fixedMeals } from 'database/schema/plan';
import { recipes } from 'database/schema/recipe';

import { ConflictError, DatabaseOperationError, QuotaExceededError } from 'core/entities/Error';
import { fixedMealSchema } from 'core/entities/FixedMeal';

import type { AddFixedMeal, FixedMeal } from 'core/entities/FixedMeal';

/** As `EventRepository`: enough turns at the lock for this same account's double submit, retry and burst to each get one. */
const LOCK_ATTEMPTS = 8;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function backoff(attempt: number): number {
  const base = Math.min(20 * 2 ** (attempt - 1), 250);

  return base + Math.random() * base;
}

/** The row shape the schema parses: the rule, with the dish read back as its slug and its name. */
function parsed(row: {
  readonly id: string;
  readonly dishName: string;
  readonly dishSlug: string;
  readonly slot: string;
  readonly weekday: number;
}): FixedMeal {
  return fixedMealSchema.parse(row);
}

export const FixedMealRepository = {
  /**
   * Adds a standing rule, inside the same lock that re-counts the allowance.
   *
   * The same defence as `EventRepository.createWithinQuota`, for the same
   * reason and found the same way: "count, then insert" is two statements
   * against two snapshots, so several requests fired together each read a count
   * that still had room and each inserted — a limit of three ends with five. A
   * security scan found exactly that in `EventController.add` on 2026-09-22,
   * and this is the second allowance with the shape that invites it.
   *
   * `UNIQUE(user_id, weekday, slot)` is **not** that defence. It stops two
   * rules landing on one meal of one weekday, which is the structural invariant
   * the scheduler's map needs; it says nothing about three rules on three
   * different days racing past a limit of two. The two protections guard
   * different things and both are needed.
   *
   * A transaction-scoped advisory lock keyed on the account takes the place of
   * a row to hold `FOR UPDATE`, because what is defended is a row that does not
   * exist yet. `try` and not the blocking form: a blocking lock as a
   * transaction's first statement pins a pooled connection for the whole wait,
   * and ten of one account's requests would be enough to deny every other
   * account. A failed try is not "already done" — two of this account's own
   * requests are both legitimate — so a few bounded, jittered retries give the
   * other one its turn before this refuses.
   *
   * `quota` is asked again on **every** attempt, against rows read fresh inside
   * that attempt's lock. A tier read once before the loop would judge a later
   * attempt against an upgrade that had not happened when it was read.
   */
  async createWithinQuota(userId: string, rule: AddFixedMeal, quota: (standing: readonly FixedMeal[]) => Promise<boolean>): Promise<FixedMeal> {
    try {
      for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          await wait(backoff(attempt));
        }

        const row = await database().transaction(async tx => {
          const [lock] = await tx.execute<{ held: boolean }>(
            sql`select pg_try_advisory_xact_lock(hashtext('fixed_meals'), hashtext(${userId})) as held`
          );

          if (!lock?.held) {
            return undefined;
          }

          const standing = await tx
            .select({ id: fixedMeals.id, dishName: recipes.name, dishSlug: recipes.slug, slot: fixedMeals.slot, weekday: fixedMeals.weekday })
            .from(fixedMeals)
            .innerJoin(recipes, eq(recipes.id, fixedMeals.recipeId))
            .where(eq(fixedMeals.userId, userId))
            .orderBy(asc(fixedMeals.weekday));

          if (!(await quota(standing.map(parsed)))) {
            throw new QuotaExceededError('fixed_meal');
          }

          const [recipe] = await tx.select({ id: recipes.id, name: recipes.name }).from(recipes).where(eq(recipes.slug, rule.dishSlug)).limit(1);

          if (!recipe) {
            // The caller validated the dish against `pinnable` before getting
            // here, so this is a dish deleted in between rather than a bad
            // request. It reads as a conflict because retrying may well work.
            throw new ConflictError('That dish is no longer in the catalogue');
          }

          const [inserted] = await tx
            .insert(fixedMeals)
            .values({ recipeId: recipe.id, slot: rule.slot, userId, weekday: rule.weekday })
            .returning({ id: fixedMeals.id, slot: fixedMeals.slot, weekday: fixedMeals.weekday });

          return inserted ? { ...inserted, dishName: recipe.name, dishSlug: rule.dishSlug } : undefined;
        });

        if (row) {
          return parsed(row);
        }
      }

      throw new ConflictError('Another request for this account is still fixing a meal');
    } catch (error: unknown) {
      if (error instanceof ConflictError || error instanceof QuotaExceededError) {
        throw error;
      }

      throw wrap(error);
    }
  },

  /**
   * Every standing rule this account has, by weekday and then by the order a
   * day is eaten in — what the generator expands and the screen lists.
   *
   * The second ordering is new with `0101` and it is not cosmetic: a day may
   * now hold more than one rule, and a list showing a Friday dinner above a
   * Friday lunch would be read as the order they are eaten in. `meal_slot` is
   * declared in that order (`_enums.ts`), so the enum's own `asc` *is* the
   * order of a day — breakfast, morning snack, lunch, afternoon snack, dinner,
   * supper — rather than the alphabet.
   */
  async findByUser(userId: string): Promise<readonly FixedMeal[]> {
    try {
      const rows = await database()
        .select({ id: fixedMeals.id, dishName: recipes.name, dishSlug: recipes.slug, slot: fixedMeals.slot, weekday: fixedMeals.weekday })
        .from(fixedMeals)
        .innerJoin(recipes, eq(recipes.id, fixedMeals.recipeId))
        .where(eq(fixedMeals.userId, userId))
        .orderBy(asc(fixedMeals.weekday), asc(fixedMeals.slot));

      return rows.map(parsed);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Removes one rule, this account's own.
   *
   * The `userId` in the `WHERE` is the ownership boundary, not a filter: a rule
   * id belonging to somebody else matches nothing and answers the same as an id
   * that never existed, which is what keeps a 404 from telling anybody that
   * another account's rule exists (`0019`).
   */
  async remove(userId: string, id: string): Promise<boolean> {
    try {
      const removed = await database()
        .delete(fixedMeals)
        .where(and(eq(fixedMeals.userId, userId), eq(fixedMeals.id, id)))
        .returning({ id: fixedMeals.id });

      return removed.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): Error {
  return error instanceof ZodError ? error : new DatabaseOperationError('Fixed meal operation failed');
}

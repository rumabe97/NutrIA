import { and, count, eq, gte, sql } from 'drizzle-orm';

import { database } from 'database';
import { recipeIngredients, recipes } from 'database/schema/recipe';

import { ConflictError, DatabaseOperationError, QuotaExceededError } from 'core/entities/Error';

import type { RecipeDraft } from 'core/entities/Plan';

/** As `EventRepository` and `FixedMealRepository`: enough turns for this account's own double submit and retry. */
const LOCK_ATTEMPTS = 8;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function backoff(attempt: number): number {
  const base = Math.min(20 * 2 ** (attempt - 1), 250);

  return base + Math.random() * base;
}

export const DishRequestRepository = {
  /**
   * How many dishes this account has had written for it this calendar month.
   *
   * **The count is of rows, not of requests**, and that is what keeps the legal
   * condition: nothing records what somebody typed, so the allowance is read
   * from the dishes that exist — `source: 'user'`, which is what a requested
   * dish is stored as and what no other path writes. A request the output gate
   * refused left no row and costs nobody anything (`marketing`, dish-requests).
   */
  async storedThisMonth(userId: string, since: Date): Promise<number> {
    try {
      const [row] = await database()
        .select({ stored: count() })
        .from(recipes)
        .where(and(eq(recipes.createdBy, userId), eq(recipes.source, 'user'), gte(recipes.createdAt, since)));

      return row?.stored ?? 0;
    } catch {
      throw new DatabaseOperationError('Dish request count failed');
    }
  },

  /**
   * Stores a dish somebody asked for, inside the lock that re-counts the month.
   *
   * The same defence as every other allowance here and for the same reason: a
   * count read before an insert is two snapshots, and several requests fired
   * together each see room. What is different is that **the model call has
   * already happened** by the time this runs — so a request that loses the race
   * is a call paid for and refused, which is honest and cheap (a text call is
   * 0.0006–0.002 $) and much better than the alternative of holding a lock
   * across a model call.
   *
   * `source: 'user'` is the marker the count reads, and the only place it is
   * written. A dish the generator wrote is `'ai'`, and conflating them would
   * bill somebody for dishes they never asked for.
   *
   * **A dish the library already has is handed back, not stored twice.** Two
   * accounts can ask for the same dish in the same month, and a generation can
   * write it between the model's answer and this insert; `recipes.slug` is
   * unique across the whole table, so without this the second one is a unique
   * violation dressed up as a 500 — after the model call was paid for.
   * `insertRecipes` has treated the same race as "a race to win harmlessly"
   * since `0006`. Nothing is spent for it either: the allowance buys a dish,
   * and that dish exists.
   */
  async storeWithinQuota(
    userId: string,
    draft: RecipeDraft,
    locale: string,
    allowed: (stored: number) => Promise<boolean>,
    since: Date
  ): Promise<string> {
    try {
      for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          await wait(backoff(attempt));
        }

        const id = await database().transaction(async tx => {
          const [lock] = await tx.execute<{ held: boolean }>(
            sql`select pg_try_advisory_xact_lock(hashtext('dish_requests'), hashtext(${userId})) as held`
          );

          if (!lock?.held) {
            return undefined;
          }

          const [row] = await tx
            .select({ stored: count() })
            .from(recipes)
            .where(and(eq(recipes.createdBy, userId), eq(recipes.source, 'user'), gte(recipes.createdAt, since)));

          if (!(await allowed(row?.stored ?? 0))) {
            throw new QuotaExceededError('dish_request');
          }

          const [inserted] = await tx
            .insert(recipes)
            .values({
              cookMinutes: draft.cookMinutes,
              createdBy: userId,
              cuisine: draft.cuisine,
              difficulty: draft.difficulty,
              instructions: draft.steps,
              locale,
              mealSlots: [...draft.mealSlots],
              name: draft.name,
              prepMinutes: draft.prepMinutes,
              servings: draft.servings,
              slug: draft.slug,
              source: 'user' as const,
              stepsVersion: draft.stepsVersion
            })
            .onConflictDoNothing({ target: recipes.slug })
            .returning({ id: recipes.id });

          if (!inserted) {
            const [already] = await tx.select({ id: recipes.id, locale: recipes.locale }).from(recipes).where(eq(recipes.slug, draft.slug)).limit(1);

            // Somebody else's identical dish won the race, or the library
            // already held it. Its ingredients are already there — writing them
            // again would double every weight in the shopping list.
            //
            // **Only if it is a dish this person could be served.** `slug` is
            // unique across the whole table and is *not* scoped by locale, so an
            // English request for gazpacho collides with the Spanish row — and
            // handing that back would tell somebody a dish exists which
            // `reusablePool`, which is locale-scoped, will never offer them:
            // they press "fix it" and get a 422 (`invariant-reviewer`,
            // 2026-10-13). A refusal is the honest answer, and it is the one the
            // screen already has a sentence for.
            if (already && already.locale !== locale) {
              throw new ConflictError('A dish of that name exists in another language');
            }

            return already?.id;
          }

          await tx.insert(recipeIngredients).values(
            draft.ingredients.map(item => ({
              grams: String(item.grams),
              ingredientId: item.ingredientId,
              // As `insertRecipes` writes it: the row carries both, and the
              // shopping list reads `quantity`.
              quantity: String(item.grams),
              recipeId: inserted.id,
              unit: item.unit
            }))
          );

          return inserted.id;
        });

        if (id) {
          return id;
        }
      }

      throw new ConflictError('Another request for this account is still being written');
    } catch (error: unknown) {
      if (error instanceof ConflictError || error instanceof QuotaExceededError) {
        throw error;
      }

      throw new DatabaseOperationError('Storing a requested dish failed');
    }
  }
};

import { aliasedTable, and, asc, count, countDistinct, desc, eq, isNull, sql } from 'drizzle-orm';

import { database } from 'database';
import { ingredientNames, ingredients } from 'database/schema/food';
import { pantryItems } from 'database/schema/pantry';
import { recipeIngredients } from 'database/schema/recipe';

import { DatabaseOperationError } from 'core/entities/Error';

import { qualified } from './AdminSql';

import type { CupboardGapQuery } from 'core/entities/AdminQuery';

/**
 * How many accounts must hold the same unanswered word before the console may show it (`docs/legal/pantry.md`
 * P2-6). It is the repository's `HAVING`, not the screen's: no caller can ask for less. Two is the smallest number
 * for which a word is no longer *one* account's.
 */
export const UNRESOLVED_WORD_THRESHOLD = 2;

/** The language every catalogue name is guaranteed to exist in. */
const NAME_LOCALE = 'es-ES';

/**
 * A word the catalogue could not answer, in its normalised form, and how many accounts hold it right now.
 * No account, no row id and no label as typed: the grouping key is `normalised_label`, which is what *«never
 * verbatim from one»* comes to.
 */
export type UnresolvedWordRow = { readonly accounts: number; readonly word: string };

/** A catalogue ingredient no recipe mentions, and how many accounts hold it in a cupboard (0 for most). */
export type UncookedIngredientRow = { readonly accounts: number; readonly category: string; readonly name: string; readonly slug: string };

const spanish = aliasedTable(ingredientNames, 'spanish_name');

const NAME = sql<string>`coalesce(${qualified(spanish, 'name')}, ${qualified(ingredients, 'slug')})`;

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}

/**
 * What the cupboard says the library cannot cook, as counts (project 022 phase 5). Two reads, both aggregates:
 * they return a number of accounts and never which accounts (`0028`).
 */
export const AdminCupboardRepository = {
  /**
   * Catalogue ingredients no `recipe_ingredients` row mentions — optional rows included, as the count of 513 is —
   * each with `count(distinct user_id)` over the cupboards that hold it, most held first, then by name and slug so a
   * page boundary is stable. **The row stays whatever the count, but the count is floored** (`docs/legal/pantry.md`
   * P2-10): below `UNRESOLVED_WORD_THRESHOLD` accounts it reads 0, in the `SELECT` and in the `ORDER BY` alike, so neither a
   * figure nor a position says that one account holds `leche-sin-lactosa`. A `HAVING` would drop the 0-rows, which are the list. Mode: one page and one count.
   */
  async uncooked(query: CupboardGapQuery): Promise<{ readonly rows: readonly UncookedIngredientRow[]; readonly total: number }> {
    try {
      const db = database();
      const unused = sql`not exists (select 1 from ${recipeIngredients} where ${qualified(recipeIngredients, 'ingredient_id')} = ${qualified(ingredients, 'id')})`;
      const held = countDistinct(pantryItems.userId);
      const accounts = sql<number>`case when ${held} >= ${UNRESOLVED_WORD_THRESHOLD} then ${held} else 0 end`.mapWith(Number);
      const [rows, counted] = await Promise.all([
        db
          .select({ accounts, category: ingredients.category, name: NAME, slug: ingredients.slug })
          .from(ingredients)
          .leftJoin(spanish, and(eq(spanish.ingredientId, ingredients.id), eq(spanish.locale, NAME_LOCALE)))
          .leftJoin(pantryItems, eq(pantryItems.ingredientId, ingredients.id))
          .where(unused)
          .groupBy(ingredients.id, ingredients.category, ingredients.slug, qualified(spanish, 'name'))
          .orderBy(desc(accounts), asc(NAME), asc(ingredients.slug))
          .limit(query.size)
          .offset(query.offset),
        db.select({ n: count() }).from(ingredients).where(unused)
      ]);

      return { rows, total: counted[0]?.n ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Unresolved cupboard entries (`ingredient_id IS NULL`) grouped by `normalised_label`, kept only where
   * **`UNRESOLVED_WORD_THRESHOLD` or more accounts** hold the word. The threshold is in the `HAVING`, and the total
   * counts the groups that pass it, so neither a page nor a total reveals a word held by one account.
   *
   * **A snapshot, never a history.** A cupboard is deleted by the generation that spends it and the plan keeps
   * slugs and amounts but no word anybody typed, so this lists what people are holding *now*; an empty answer is not
   * a bug. Mode: one page and one count.
   */
  async unresolved(query: CupboardGapQuery): Promise<{ readonly rows: readonly UnresolvedWordRow[]; readonly total: number }> {
    try {
      const db = database();
      const accounts = countDistinct(pantryItems.userId);
      const grouped = db
        .select({ accounts: accounts.as('accounts'), word: pantryItems.normalisedLabel })
        .from(pantryItems)
        .where(isNull(pantryItems.ingredientId))
        .groupBy(pantryItems.normalisedLabel)
        .having(sql`count(distinct ${pantryItems.userId}) >= ${UNRESOLVED_WORD_THRESHOLD}`)
        .as('unresolved_words');
      const [rows, counted] = await Promise.all([
        db
          .select({ accounts: grouped.accounts, word: grouped.word })
          .from(grouped)
          .orderBy(desc(grouped.accounts), asc(grouped.word))
          .limit(query.size)
          .offset(query.offset),
        db.select({ n: count() }).from(grouped)
      ]);

      return { rows, total: counted[0]?.n ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

import { aliasedTable, and, asc, count, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';

import { allergens } from 'database/schema/safety';
import { contains, ordered } from '#repositories/Search';
import { database } from 'database';
import { meals } from 'database/schema/plan';
import { ACCEPTED_BY_OWNER_SQL, needsRewriteCondition } from '#repositories/Recipe';
import { ingredientAllergens, ingredientNames, ingredients } from 'database/schema/food';
import { recipeImages, recipeIngredients, recipes } from 'database/schema/recipe';

import { DatabaseOperationError } from 'core/entities/Error';
import { PICTURE_ACCEPTED_BY_HAND } from 'core/entities/AdminQuery';
import { SERVING_BOUNDS } from 'core/domain/Scheduler';

import { qualified } from './AdminSql';

import type { IngredientCatalogueQuery, RecipeCatalogueQuery } from 'core/entities/AdminQuery';
import type { PictureProvenance, PictureStatus } from 'core/entities/DishPicture';
import type { SortDirection } from 'core/entities/AdminQuery';
import type { SQL } from 'drizzle-orm';

/** The language every catalogue name is guaranteed to exist in (`RecipeRepository.FALLBACK_LOCALE`). */
const NAME_LOCALE = 'es-ES';

/**
 * One recipe as the console lists it: what the dish is, never who made it.
 * No `created_by`, no id of a person: the catalogue names nobody (`0028`).
 */
export type CatalogueRecipeRow = {
  readonly id: string;
  readonly locale: string;
  /** The `meal_slot` values, as the column holds them. */
  readonly mealSlots: readonly string[];
  readonly name: string;
  readonly picture: PictureStatus;
  /** A `ready` picture the owner accepted by hand against the judge (`0072`); false on a `ready` row is the judge's. Any `ready` one can be removed. */
  readonly pictureAcceptedByHand: boolean;
  /** When the row was last claimed or ended: what the cool-off counts from. Null with no row. */
  readonly pictureAt: Date | null;
  /** The row is `failed`, released or not (`picture` reads a released one as `none`). */
  readonly pictureFailed: boolean;
  /** What a failed row stored about how it ended — its candidate's path included (`0072`); null for any other row. Read by `pictureReasonOf` and `reviewableCandidate`, never sent as it is. */
  readonly pictureProvenance: PictureProvenance | null;
  /** The public address of a `ready` picture's file — the one a person's app is given; null for any other row. Never a candidate's path. */
  readonly pictureUrl: string | null;
  readonly servings: number;
  readonly slug: string;
  readonly source: 'ai' | 'seed' | 'user';
};

/**
 * One recipe as Catálogo › Calidad judges it: the dish and its served
 * ingredients, by the catalogue's slug — nothing that names a person (`0028`).
 */
export type QualityRecipeRow = {
  readonly id: string;
  readonly items: readonly { readonly grams: number; readonly slug: string }[];
  readonly mealSlots: readonly string[];
  /** The sweep would still claim it (`needsRewriteCondition`), ignoring any claim in flight. */
  readonly pending: boolean;
  readonly servings: number;
  readonly source: 'ai' | 'seed' | 'user';
  readonly stepsVersion: string | null;
};

/** One served ingredient of a recipe: grams for the recipe's `servings`, by the catalogue's slug. */
export type CompositionRow = { readonly grams: number; readonly recipeId: string; readonly slug: string };

/** The catalogue's size, whatever the table is filtered by. */
export type CatalogueCounts = {
  readonly bySlot: readonly { readonly n: number; readonly slot: string }[];
  readonly bySource: readonly { readonly n: number; readonly source: string }[];
  readonly total: number;
  /** Recipes whose picture is not `ready`: the same test `AdminRepository.counts` makes. */
  readonly withoutImage: number;
};

/** One ingredient as the console lists it, per 100 g. */
export type CatalogueIngredientRow = {
  readonly carbsPer100g: number;
  readonly category: string;
  readonly countries: readonly string[];
  readonly fatPer100g: number;
  readonly kcalPer100g: number;
  readonly mealSlots: readonly string[];
  readonly name: string;
  readonly proteinPer100g: number;
  readonly slug: string;
};

/** An allergen an ingredient carries, by key, and how. */
export type IngredientAllergenRow = { readonly key: string; readonly presence: 'contains' | 'may_contain'; readonly slug: string };

// ─── Recipes ─────────────────────────────────────────────────────────────────

const RECIPE_ID = qualified(recipes, 'id');

/**
 * Where a recipe's picture stands, from its one `recipe_images` row (`0066`):
 * `ready` with a file, `drawing`, `failed` for the dish's own reasons, and
 * `none` for everything else — no row, a row given back for a reason that is
 * not the dish's (`released`, which reads as no picture and is drawn again on
 * the next view), or a `ready` row with no file. Exported for its spec.
 */
export const PICTURE_STATE = sql<PictureStatus>`case
  when ${qualified(recipeImages, 'status')} = 'ready' and ${qualified(recipeImages, 'url')} is not null then 'ready'
  when ${qualified(recipeImages, 'status')} = 'drawing' then 'drawing'
  when ${qualified(recipeImages, 'status')} = 'failed' and (${qualified(recipeImages, 'provenance')} ->> 'released') is null then 'failed'
  else 'none' end`;

/**
 * A `ready` picture the owner accepted by hand against the judge (`0072`):
 * `provenance.acceptedBy` is `ACCEPTED_BY_OWNER`, spelled by `ACCEPTED_BY_OWNER_SQL` as the count on `/admin/pictures` spells it,
 * read here as a flag and a filter, never sent as it is. Always true or false,
 * a recipe with no picture row included.
 */
const ACCEPTED_BY_HAND = sql`coalesce(${qualified(recipeImages, 'status')} = 'ready' and (${qualified(recipeImages, 'provenance')} ->> 'acceptedBy') = ${ACCEPTED_BY_OWNER_SQL}, false)`;

/**
 * A served ingredient of the outer recipe contains the allergen. Served means
 * not optional: the app leaves optional ingredients out of every dish it
 * serves (`findReusable`, `PlanRepository`), and so out of its macros and its
 * allergens here. `may_contain` is a trace warning, not the claim.
 */
function containsAllergen(key: string): SQL {
  return sql`exists (select 1 from ${recipeIngredients}
    inner join ${ingredientAllergens} on ${qualified(ingredientAllergens, 'ingredient_id')} = ${qualified(recipeIngredients, 'ingredient_id')}
    inner join ${allergens} on ${qualified(allergens, 'id')} = ${qualified(ingredientAllergens, 'allergen_id')}
    where ${qualified(recipeIngredients, 'recipe_id')} = ${RECIPE_ID}
      and ${qualified(recipeIngredients, 'is_optional')} = false
      and ${qualified(ingredientAllergens, 'presence')} = 'contains'
      and ${qualified(allergens, 'key')} = ${key})`;
}

/**
 * The recipe table's `WHERE`. Every value is bound as a parameter; the only
 * text is the name search, escaped into a literal "contains". Exported for its
 * spec.
 */
export function recipeFilters(
  query: Pick<RecipeCatalogueQuery, 'allergen' | 'locale' | 'picture' | 'q' | 'slot' | 'source'>,
  ids?: readonly string[]
): SQL | undefined {
  return and(
    // The recipes a quality check found (`AdminCatalogueController`): only the app's own helpers can say which they are.
    ids === undefined ? undefined : ids.length === 0 ? sql`false` : inArray(recipes.id, [...ids]),
    query.q === undefined ? undefined : contains(recipes.name, query.q),
    query.slot === undefined ? undefined : sql`${query.slot} = any(${qualified(recipes, 'meal_slots')})`,
    query.source === undefined ? undefined : eq(recipes.source, query.source),
    query.locale === undefined ? undefined : eq(recipes.locale, query.locale),
    query.picture === undefined
      ? undefined
      : query.picture === PICTURE_ACCEPTED_BY_HAND
        ? ACCEPTED_BY_HAND
        : sql`${PICTURE_STATE} = ${query.picture}`,
    query.allergen === undefined ? undefined : containsAllergen(query.allergen)
  );
}

/** What the recipe table selects. Nothing that names a person: `created_by` is not here, on purpose. */
const RECIPE_COLUMNS = {
  id: recipes.id,
  locale: recipes.locale,
  mealSlots: recipes.mealSlots,
  name: recipes.name,
  picture: PICTURE_STATE,
  pictureAcceptedByHand: sql<boolean>`${ACCEPTED_BY_HAND}`,
  pictureAt: recipeImages.lastAttemptAt,
  pictureFailed: sql<boolean>`coalesce(${qualified(recipeImages, 'status')} = 'failed', false)`,
  // Only a failed row's: a ready one carries the judge's notes, which the list has no use for. Never the judge's
  // answers (`drawings`): they are the largest part of a row and nothing the console shows is made from them.
  pictureProvenance: sql<PictureProvenance | null>`case when ${qualified(recipeImages, 'status')} = 'failed' then ${qualified(recipeImages, 'provenance')} - 'drawings' end`,
  // The published file's public address, and only a `ready` row's: what a person's app is given for the same dish.
  pictureUrl: sql<string | null>`case when ${qualified(recipeImages, 'status')} = 'ready' then ${qualified(recipeImages, 'url')} end`,
  servings: recipes.servings,
  slug: recipes.slug,
  source: recipes.source
};

/** Recipes by name, then slug, so a page boundary never splits a tie differently. Exported for its spec. */
export function recipeNameOrder(direction: SortDirection): readonly SQL[] {
  return [ordered(recipes.name, direction), asc(recipes.slug)];
}

type Database = ReturnType<typeof database>;

/** The recipe list's query before its order and page, over the recipe and its one picture row. Exported for its spec. */
export function recipeSelect(db: Database, where: SQL | undefined) {
  return db.select(RECIPE_COLUMNS).from(recipes).leftJoin(recipeImages, eq(recipeImages.recipeId, recipes.id)).where(where);
}

// ─── Ingredients ─────────────────────────────────────────────────────────────

const INGREDIENT_ID = qualified(ingredients, 'id');

/** The Spanish name, which every ingredient has (`FALLBACK_LOCALE`). */
const spanish = aliasedTable(ingredientNames, 'spanish_name');

/** The ingredient's name as the console shows it: Spanish, or the slug for a row with none, which says the seed is broken. */
const INGREDIENT_NAME = sql<string>`coalesce(${qualified(spanish, 'name')}, ${qualified(ingredients, 'slug')})`;

/** The ingredient contains the allergen — the claim, not a trace. */
function ingredientContains(key: string): SQL {
  return sql`exists (select 1 from ${ingredientAllergens}
    inner join ${allergens} on ${qualified(allergens, 'id')} = ${qualified(ingredientAllergens, 'allergen_id')}
    where ${qualified(ingredientAllergens, 'ingredient_id')} = ${INGREDIENT_ID}
      and ${qualified(ingredientAllergens, 'presence')} = 'contains'
      and ${qualified(allergens, 'key')} = ${key})`;
}

/** Its name in any language contains the text, or its slug does. */
function ingredientNamed(text: string): SQL {
  return sql`(${contains(ingredients.slug, text)} or exists (select 1 from ${ingredientNames} where ${qualified(ingredientNames, 'ingredient_id')} = ${INGREDIENT_ID} and ${contains(ingredientNames.name, text)}))`;
}

/** The ingredient table's `WHERE`. Exported for its spec. */
export function ingredientFilters(query: Pick<IngredientCatalogueQuery, 'allergen' | 'category' | 'q'>): SQL | undefined {
  return and(
    query.q === undefined ? undefined : ingredientNamed(query.q),
    query.category === undefined ? undefined : eq(ingredients.category, query.category),
    query.allergen === undefined ? undefined : ingredientContains(query.allergen)
  );
}

/** The column each allowed sort names. A map, so no name from the URL reaches the SQL. */
const INGREDIENT_SORT_COLUMNS = {
  carbs: ingredients.carbsPer100g,
  category: ingredients.category,
  fat: ingredients.fatPer100g,
  kcal: ingredients.kcalPer100g,
  name: INGREDIENT_NAME,
  protein: ingredients.proteinPer100g
} as const;

/** The chosen column in the chosen direction, then the name and the slug, so a page boundary is stable. Exported for its spec. */
export function ingredientOrder(query: Pick<IngredientCatalogueQuery, 'dir' | 'sort'>): readonly SQL[] {
  const chosen = ordered(INGREDIENT_SORT_COLUMNS[query.sort], query.dir);

  return query.sort === 'name' ? [chosen, asc(ingredients.slug)] : [chosen, asc(INGREDIENT_NAME), asc(ingredients.slug)];
}

/** The ingredient list's query before its order and page. Exported for its spec. */
export function ingredientSelect(db: Database, where: SQL | undefined) {
  return db
    .select({
      carbsPer100g: ingredients.carbsPer100g,
      category: ingredients.category,
      countries: ingredients.countries,
      fatPer100g: ingredients.fatPer100g,
      kcalPer100g: ingredients.kcalPer100g,
      mealSlots: ingredients.mealSlots,
      name: INGREDIENT_NAME,
      proteinPer100g: ingredients.proteinPer100g,
      slug: ingredients.slug
    })
    .from(ingredients)
    .leftJoin(spanish, and(eq(spanish.ingredientId, ingredients.id), eq(spanish.locale, NAME_LOCALE)))
    .where(where);
}

/**
 * The shared catalogue as the console browses it (`0068`): recipes and
 * ingredients, which are reference data and name nobody (`0028`). Reads only;
 * editing the catalogue stays in the seed file in git.
 */
export const AdminCatalogueRepository = {
  /**
   * The served ingredients of these recipes — not the optional ones, as the
   * app serves them — with their grams for the recipe's `servings`. Mode: one
   * read on `recipe_ingredients_recipe_idx`.
   */
  async compositions(recipeIds: readonly string[]): Promise<readonly CompositionRow[]> {
    if (recipeIds.length === 0) {
      return [];
    }

    try {
      const rows = await database()
        .select({ grams: recipeIngredients.grams, recipeId: recipeIngredients.recipeId, slug: ingredients.slug })
        .from(recipeIngredients)
        .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
        .where(and(inArray(recipeIngredients.recipeId, [...recipeIds]), eq(recipeIngredients.isOptional, false)));

      return rows.map(row => ({ grams: Number(row.grams), recipeId: row.recipeId, slug: row.slug }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Every allergen these ingredients carry, by key, and whether as the claim or as a trace. Mode: one join. */
  async ingredientAllergens(slugs: readonly string[]): Promise<readonly IngredientAllergenRow[]> {
    if (slugs.length === 0) {
      return [];
    }

    try {
      return await database()
        .select({ key: allergens.key, presence: ingredientAllergens.presence, slug: ingredients.slug })
        .from(ingredientAllergens)
        .innerJoin(ingredients, eq(ingredients.id, ingredientAllergens.ingredientId))
        .innerJoin(allergens, eq(allergens.id, ingredientAllergens.allergenId))
        .where(inArray(ingredients.slug, [...slugs]));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** One page of ingredients as the query asks, and how many match. Mode: one page and one count under the same `WHERE`. */
  async ingredientPage(query: IngredientCatalogueQuery): Promise<{ readonly rows: readonly CatalogueIngredientRow[]; readonly total: number }> {
    try {
      const db = database();
      const where = ingredientFilters(query);
      const [rows, counted] = await Promise.all([
        ingredientSelect(db, where)
          .orderBy(...ingredientOrder(query))
          .limit(query.size)
          .offset(query.offset),
        db.select({ n: count() }).from(ingredients).where(where)
      ]);

      return {
        rows: rows.map(row => ({
          ...row,
          carbsPer100g: Number(row.carbsPer100g),
          fatPer100g: Number(row.fatPer100g),
          kcalPer100g: Number(row.kcalPer100g),
          proteinPer100g: Number(row.proteinPer100g)
        })),
        total: counted[0]?.n ?? 0
      };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every recipe the filters match, unordered: for a sort by a macro, which
   * only the app's own helper can compute (`core/domain/Composition`). The
   * catalogue is bounded — about 1,700 recipes — and each row is a handful of
   * short columns. Mode: one read.
   */
  async matchingRecipes(query: RecipeCatalogueQuery, ids?: readonly string[]): Promise<readonly CatalogueRecipeRow[]> {
    try {
      return await recipeSelect(database(), recipeFilters(query, ids));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Meals stored with servings outside `SERVING_BOUNDS` — a count and nothing
   * else: no meal, plan or person is returned (`0028`). Mode: one aggregate.
   */
  async mealsOutsideServingBounds(): Promise<number> {
    try {
      const [row] = await database()
        .select({ n: count() })
        .from(meals)
        .where(or(lt(meals.servings, String(SERVING_BOUNDS.min)), gt(meals.servings, String(SERVING_BOUNDS.max))));

      return row?.n ?? 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Recipes whose picture failed for the dish's own reasons (`PICTURE_STATE`). Mode: one aggregate. */
  async picturesFailed(): Promise<number> {
    try {
      const [row] = await database()
        .select({ n: sql<number>`count(*) filter (where ${PICTURE_STATE} = 'failed')`.mapWith(Number) })
        .from(recipes)
        .leftJoin(recipeImages, eq(recipeImages.recipeId, recipes.id));

      return row?.n ?? 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every recipe with its served ingredients folded into two parallel arrays,
   * one row a recipe: what Catálogo › Calidad judges, in about a third of the
   * bytes of one row an ingredient (the recipe's id is sent once, not once per
   * line). `pending` is the sweep's own claim condition for `stepsVersion`.
   * Mode: one grouped read.
   */
  async qualityRecipes(stepsVersion: string): Promise<readonly QualityRecipeRow[]> {
    try {
      const rows = await database()
        .select({
          id: recipes.id,
          grams: sql<number[]>`coalesce(array_agg(${recipeIngredients.grams}::float8) filter (where ${recipeIngredients.id} is not null), '{}')`,
          mealSlots: recipes.mealSlots,
          pending: sql<boolean>`${needsRewriteCondition(stepsVersion)}`.mapWith(Boolean),
          servings: recipes.servings,
          slugs: sql<string[]>`coalesce(array_agg(${ingredients.slug}) filter (where ${recipeIngredients.id} is not null), '{}')`,
          source: recipes.source,
          stepsVersion: recipes.stepsVersion
        })
        .from(recipes)
        .leftJoin(recipeIngredients, and(eq(recipeIngredients.recipeId, recipes.id), eq(recipeIngredients.isOptional, false)))
        .leftJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
        .groupBy(recipes.id);

      return rows.map(row => ({
        id: row.id,
        items: row.slugs.map((slug, at) => ({ grams: Number(row.grams[at]), slug })),
        mealSlots: row.mealSlots,
        pending: row.pending,
        servings: row.servings,
        source: row.source,
        stepsVersion: row.stepsVersion
      }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** One recipe as the table lists it, or null when there is none. Mode: one read by primary key, with its one picture row. */
  async recipe(recipeId: string): Promise<CatalogueRecipeRow | null> {
    try {
      const [row] = await recipeSelect(database(), eq(recipes.id, recipeId)).limit(1);

      return row ?? null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The catalogue's size: recipes per meal slot (a recipe with two slots
   * counts in both), per source, and without a ready picture. Mode: three
   * aggregates.
   */
  async recipeCounts(): Promise<CatalogueCounts> {
    try {
      const db = database();
      // One row per recipe and slot it names, so a recipe with two slots counts in both.
      const slot = sql<string>`${sql.identifier('slots')}.${sql.identifier('slot')}`;
      const [slots, sources, pictures] = await Promise.all([
        db
          .select({ n: count(), slot })
          .from(
            sql`${recipes} cross join lateral unnest(${qualified(recipes, 'meal_slots')}) as ${sql.identifier('slots')}(${sql.identifier('slot')})`
          )
          .groupBy(slot),
        db.select({ n: count(), source: recipes.source }).from(recipes).groupBy(recipes.source),
        db
          .select({ total: count(), withoutImage: sql<number>`count(*) filter (where ${PICTURE_STATE} <> 'ready')`.mapWith(Number) })
          .from(recipes)
          .leftJoin(recipeImages, eq(recipeImages.recipeId, recipes.id))
      ]);

      return {
        bySlot: slots.map(row => ({ n: row.n, slot: row.slot })),
        bySource: sources.map(row => ({ n: row.n, source: row.source })),
        total: pictures[0]?.total ?? 0,
        withoutImage: pictures[0]?.withoutImage ?? 0
      };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** One page of recipes by name, and how many match. Mode: one page and one count under the same `WHERE`. */
  async recipePage(
    query: RecipeCatalogueQuery,
    ids?: readonly string[]
  ): Promise<{ readonly rows: readonly CatalogueRecipeRow[]; readonly total: number }> {
    try {
      const db = database();
      const where = recipeFilters(query, ids);
      const [rows, counted] = await Promise.all([
        recipeSelect(db, where)
          .orderBy(...recipeNameOrder(query.dir))
          .limit(query.size)
          .offset(query.offset),
        db.select({ n: count() }).from(recipes).leftJoin(recipeImages, eq(recipeImages.recipeId, recipes.id)).where(where)
      ]);

      return { rows, total: counted[0]?.n ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}

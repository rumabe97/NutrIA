import { aliasedTable, and, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { ingredientAllergens, ingredientNames, ingredients } from 'database/schema/food';
import { allergens } from 'database/schema/safety';
import { dislikedRecipes, favoriteRecipes } from 'database/schema/plan';
import { recipeImageCalls, recipeImages, recipeIngredients, recipes } from 'database/schema/recipe';

import { METHOD_RULES, nextRewriteStamp, REWRITE_ATTEMPT_BOUND } from 'core/domain/Method';
import { pictureStateSchema } from 'core/entities/DishPicture';
import { DatabaseOperationError } from 'core/entities/Error';
import type { FoodClass } from 'database/schema/food';
import type { LibraryRecipe } from 'core/domain/MealFit';
import type { PictureCall, PictureProvenance, PictureReason, PictureState } from 'core/entities/DishPicture';
import type { RecordAudit } from '#repositories/Audit';
import type { CatalogueIngredient, MealSlot, RecipeVerdict } from 'core/entities/Plan';
import type { RecipeStep } from 'database/schema/recipe';
import type { SQL } from 'drizzle-orm';

export type ReusableRecipe = {
  readonly id: string;
  readonly cookMinutes: number;
  readonly cuisine: string | null;
  readonly difficulty: 'easy' | 'hard' | 'medium';
  readonly ingredients: readonly { readonly grams: number; readonly slug: string }[];
  readonly mealSlots: readonly MealSlot[];
  readonly name: string;
  readonly prepMinutes: number;
  readonly servings: number;
  readonly slug: string;
  readonly steps: readonly { readonly minutes?: number; readonly text: string }[];
};

/**
 * The language every catalogue name is guaranteed to exist in.
 *
 * Spanish is the product's first language and the one the seed has always
 * written, so it is the only safe fallback. A resolver with no fallback would
 * hand back an empty name the first time a locale was added.
 */
export const FALLBACK_LOCALE = 'es-ES';

/** A dish as generation refers to it: what to exclude by slug, what to name to the model. */
export type DishRef = { readonly name: string; readonly slug: string };

export type UndocumentedRecipe = {
  readonly id: string;
  readonly cookMinutes: number;
  readonly ingredients: readonly { readonly grams: number; readonly name: string }[];
  readonly locale: string;
  readonly name: string;
  readonly prepMinutes: number;
  readonly servings: number;
  readonly steps: readonly RecipeStep[];
};

/** A catalogue ingredient as the picture rule reads it — `core/domain/DishPicture`'s shape, declared here so this layer imports no domain. */
export type PictureFood = {
  readonly allergens: readonly string[];
  readonly mayContain: readonly string[];
  readonly names: readonly string[];
  readonly slug: string;
};

/** A dish as its picture is drawn from: recipe data only. */
export type PictureDish = {
  readonly ingredients: readonly { readonly grams: number; readonly name: string; readonly slug: string }[];
  readonly name: string;
};

export const RecipeRepository = {
  /**
   * Claims the drawing of a dish's picture for this caller (0066). True when this
   * caller won and must draw; false when the dish is ready, already being drawn,
   * or failed less than `coolOffDays` ago.
   *
   * A drawing claimed more than `staleAfterMinutes` ago is taken over: the
   * function that ran it was stopped before it could end it (its `maxDuration`
   * is 5 minutes), and without this the dish would wait for a picture forever.
   * `now` is the claim's mark — `completePicture` and `failPicture` must be given
   * it back, so a drawer whose claim was taken over cannot end the new one.
   *
   * `attempts` counts drawings that never ended: a takeover adds one to it, so a
   * dish whose drawing is killed every time reaches the failure bound instead
   * of being paid for on every view. A claim after a finished failure's
   * cool-off starts again from zero.
   *
   * A **released** row (`releasePicture`: the cap, a refused key) is claimed at
   * once, with no cool-off, and keeps its `attempts`: what stopped it was not
   * the dish, and what the dish already failed still counts.
   *
   * Mode: one `INSERT … ON CONFLICT DO UPDATE … WHERE … RETURNING`. "Is anyone
   * drawing it?" and "I am" cannot be two statements: two first views fired
   * together would both read no row and both draw, paying twice. With one
   * statement the second caller waits on the first's row, then evaluates the
   * `WHERE` against it — `drawing`, so it updates nothing and returns no row.
   */
  async claimPicture(recipeId: string, now: Date, coolOffDays: number, staleAfterMinutes = 15): Promise<boolean> {
    try {
      const cooledOff = new Date(now.getTime() - coolOffDays * 86_400_000);
      const stale = new Date(now.getTime() - staleAfterMinutes * 60_000);
      const rows = await database()
        .insert(recipeImages)
        .values({ attempts: 0, lastAttemptAt: now, recipeId, status: 'drawing' })
        .onConflictDoUpdate({
          set: {
            attempts: sql`case when ${recipeImages.status} = 'drawing' then ${recipeImages.attempts} + 1 when ${released} then ${recipeImages.attempts} else 0 end`,
            lastAttemptAt: now,
            status: 'drawing',
            updatedAt: now
          },
          setWhere: or(
            and(eq(recipeImages.status, 'failed'), lt(recipeImages.lastAttemptAt, cooledOff)),
            and(eq(recipeImages.status, 'failed'), released),
            and(eq(recipeImages.status, 'drawing'), lt(recipeImages.lastAttemptAt, stale))
          ),
          target: recipeImages.recipeId
        })
        .returning({ recipeId: recipeImages.recipeId });

      return rows.length === 1;
    } catch (error: unknown) {
      throw wrap(error, 'recipe_images');
    }
  },

  /**
   * The whole ingredient catalogue, with allergen links attached.
   *
   * Loaded once per generation and passed down: every macro sum and every allergy
   * check reads from this, so it must be one query rather than a lookup per
   * ingredient inside a loop over fourteen days of meals.
   */
  /**
   * Recipes whose steps predate the current prompt, with everything needed to
   * rewrite them: the dish, its times, its ingredients in its own language, and
   * the steps as they stand.
   *
   * Nothing about any person is here and nothing can be — a recipe is shared, and
   * the rewriter is given a dish, not a diner.
   */
  /**
   * Recipes the sweep still needs to look at — an older prompt wrote them, or
   * nothing did, or the current one did but the method it wrote still has a
   * documentation gap (`needsRewriteCondition`, `core/domain/Method`'s
   * `RewriteStamp.needsRewrite` mirrored in SQL) — **claimed** for
   * `holdMinutes` in the same statement that picks them.
   *
   * Picking and claiming are one `UPDATE … RETURNING`, over a subquery locked
   * `FOR UPDATE SKIP LOCKED`: two sweeps started together — the owner pressing
   * "Run" twice — each take recipes the other did not, instead of both
   * rewriting the same twelve. A claim that outlives its sweep, because the
   * run failed or ran out of time, lapses on its own and the recipe is taken
   * again.
   */
  async claimUndocumented(stepsVersion: string, limit: number, holdMinutes: number): Promise<readonly UndocumentedRecipe[]> {
    try {
      const db = database();
      const free = db
        .select({ id: recipes.id })
        .from(recipes)
        .where(and(needsRewriteCondition(stepsVersion), or(isNull(recipes.stepsClaimedUntil), lt(recipes.stepsClaimedUntil, sql`now()`))))
        .orderBy(recipes.id)
        .limit(limit)
        .for('update', { skipLocked: true });
      const claimed = await db
        .update(recipes)
        .set({ stepsClaimedUntil: sql`now() + make_interval(mins => ${holdMinutes})` })
        .where(inArray(recipes.id, free))
        .returning({
          id: recipes.id,
          cookMinutes: recipes.cookMinutes,
          locale: recipes.locale,
          name: recipes.name,
          prepMinutes: recipes.prepMinutes,
          servings: recipes.servings,
          steps: recipes.instructions
        });
      // `RETURNING` keeps no order; the sweep's is the recipes' own.
      const rows = [...claimed].sort((a, b) => a.id.localeCompare(b.id));

      if (rows.length === 0) {
        return [];
      }

      const items = await db
        .select({ grams: recipeIngredients.grams, locale: ingredientNames.locale, name: ingredientNames.name, recipeId: recipeIngredients.recipeId })
        .from(recipeIngredients)
        .innerJoin(ingredientNames, eq(ingredientNames.ingredientId, recipeIngredients.ingredientId))
        .where(
          inArray(
            recipeIngredients.recipeId,
            rows.map(row => row.id)
          )
        );

      return rows.map(row => ({
        ...row,
        ingredients: items
          .filter(item => item.recipeId === row.id && item.locale === row.locale)
          .map(item => ({ grams: Number(item.grams), name: item.name }))
      }));
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /**
   * A drawing that ended with an accepted picture: its address and what drew it.
   * `claimedAt` is the `now` its claim was made with. Mode: a single guarded
   * `UPDATE … WHERE status = 'drawing' AND last_attempt_at = claimedAt`, so a
   * drawing whose claim was taken over as stale cannot end the newer one. False
   * when nothing was updated.
   */
  async completePicture(
    recipeId: string,
    claimedAt: Date,
    picture: {
      readonly attempts: number;
      readonly model: string;
      readonly promptVersion: string;
      readonly provenance: PictureProvenance;
      readonly url: string;
    }
  ): Promise<boolean> {
    try {
      const rows = await database()
        .update(recipeImages)
        .set({ ...picture, status: 'ready', updatedAt: new Date() })
        .where(stillClaimed(recipeId, claimedAt))
        .returning({ recipeId: recipeImages.recipeId });

      return rows.length === 1;
    } catch (error: unknown) {
      throw wrap(error, 'recipe_images');
    }
  },

  /**
   * A drawing that ended with no picture it could keep. `lastAttemptAt` is when
   * it ended, which is what the cool-off counts from. Mode: the same guarded
   * `UPDATE` as `completePicture`, for the same reason.
   */
  async failPicture(
    recipeId: string,
    claimedAt: Date,
    outcome: { readonly attempts: number; readonly provenance: PictureProvenance },
    now: Date
  ): Promise<boolean> {
    try {
      const rows = await database()
        .update(recipeImages)
        .set({ ...outcome, lastAttemptAt: now, status: 'failed', updatedAt: now })
        .where(stillClaimed(recipeId, claimedAt))
        .returning({ recipeId: recipeImages.recipeId });

      return rows.length === 1;
    } catch (error: unknown) {
      throw wrap(error, 'recipe_images');
    }
  },

  /**
   * Every library recipe that may be served at one of these meals, in every
   * language, with the ingredients it is made of — what `0063`'s second cut
   * reads to learn which foods the library cooks at lunch and at dinner.
   *
   * One query, not one per recipe: a join of `recipe_ingredients` to its
   * recipe and its ingredient, filtered by the stored meals, which a narrowing
   * can only take away from. On the dev library (2026-09-25, 1,002 recipes)
   * that is under 6,000 rows of four short columns, about 0.6 s from this
   * machine to Neon; once per generation, beside the two library reads it
   * already makes, and once per swap that reaches the model.
   * A plain read with no lock: the library only grows, and a recipe added
   * while this runs changes the next generation's sample, not this one's.
   *
   * The stored meals are not the answer, only the filter: they were narrowed
   * for whoever generated the dish, so the controller narrows each recipe
   * again for the person (`MealFit.libraryUsage`). Optional ingredients are
   * left out, as `findReusable` leaves them out of what is served.
   */
  async findLibraryUsage(slots: readonly MealSlot[]): Promise<readonly LibraryRecipe[]> {
    if (slots.length === 0) {
      return [];
    }

    try {
      const rows = await database()
        .select({ ingredientId: ingredients.id, mealSlots: recipes.mealSlots, recipeId: recipes.id, slug: ingredients.slug })
        .from(recipeIngredients)
        .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
        .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
        .where(
          and(
            eq(recipeIngredients.isOptional, false),
            sql`${recipes.mealSlots} && ${sql.raw(`ARRAY[${slots.map(slot => `'${slot}'`).join(',')}]::text[]`)}`
          )
        );

      const byRecipe = new Map<string, { ingredients: { id: string; slug: string }[]; slots: readonly MealSlot[] }>();

      for (const row of rows) {
        const recipe = byRecipe.get(row.recipeId) ?? { ingredients: [], slots: row.mealSlots as readonly MealSlot[] };

        recipe.ingredients.push({ id: row.ingredientId, slug: row.slug });
        byRecipe.set(row.recipeId, recipe);
      }

      return [...byRecipe.values()];
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /**
   * Recipes already in the library that could fill one of these slots.
   *
   * Returns candidates, **not** approved dishes. Safety is decided by
   * `findSafetyViolations` in the controller, over the ingredients returned here —
   * a recipe existing in the database says nothing about whether it is safe for a
   * particular person. See `docs/decisions/0006-reuse-before-generating.md`.
   */
  async findReusable(slots: readonly MealSlot[], limit: number, locale: string): Promise<readonly ReusableRecipe[]> {
    if (slots.length === 0) {
      return [];
    }

    try {
      const db = database();

      const rows = await db
        .select()
        .from(recipes)
        // `meal_slots` is a text[]; overlap is the array-aware form of "any of these".
        //
        // Scoped to the locale, and this is not a nicety: a recipe's name and
        // method are one artefact written in one language. Handing "Tostada de
        // aguacate" to an English user is not a translation gap, it is the wrong
        // dish — and reuse would otherwise quietly undo everything else here.
        .where(and(eq(recipes.locale, locale), sql`${recipes.mealSlots} && ${sql.raw(`ARRAY[${slots.map(slot => `'${slot}'`).join(',')}]::text[]`)}`))
        // A fixed order, so the same library gives the same pool: the rotation
        // shuffles it per person from a seed, and a seed only reproduces a plan
        // if what it shuffles arrives in the same order every time.
        .orderBy(recipes.slug)
        .limit(limit);

      if (rows.length === 0) {
        return [];
      }

      const items = await db
        .select({ grams: recipeIngredients.grams, recipeId: recipeIngredients.recipeId, slug: ingredients.slug })
        .from(recipeIngredients)
        .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
        .where(
          and(
            inArray(
              recipeIngredients.recipeId,
              rows.map(row => row.id)
            ),
            eq(recipeIngredients.isOptional, false)
          )
        );

      const byRecipe = new Map<string, { grams: number; slug: string }[]>();

      for (const item of items) {
        byRecipe.set(item.recipeId, [...(byRecipe.get(item.recipeId) ?? []), { grams: Number(item.grams), slug: item.slug }]);
      }

      return rows
        .map(row => ({
          id: row.id,
          cookMinutes: row.cookMinutes,
          cuisine: row.cuisine,
          difficulty: row.difficulty,
          ingredients: byRecipe.get(row.id) ?? [],
          mealSlots: row.mealSlots as readonly MealSlot[],
          name: row.name,
          prepMinutes: row.prepMinutes,
          servings: row.servings,
          slug: row.slug,
          steps: row.instructions
        }))
        .filter(recipe => recipe.ingredients.length > 0);
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /** What this person said about one recipe, if anything. */
  async findVerdict(userId: string, recipeId: string): Promise<'disliked' | 'liked' | null> {
    try {
      const db = database();
      const [liked, disliked] = await Promise.all([
        db
          .select({ id: favoriteRecipes.id })
          .from(favoriteRecipes)
          .where(and(eq(favoriteRecipes.userId, userId), eq(favoriteRecipes.recipeId, recipeId)))
          .limit(1),
        db
          .select({ id: dislikedRecipes.id })
          .from(dislikedRecipes)
          .where(and(eq(dislikedRecipes.userId, userId), eq(dislikedRecipes.recipeId, recipeId)))
          .limit(1)
      ]);

      return liked.length > 0 ? 'liked' : disliked.length > 0 ? 'disliked' : null;
    } catch (error: unknown) {
      throw wrap(error, 'favorite_recipes');
    }
  },

  /** Every verdict this person has given, as the dish names and slugs generation needs. */
  async findVerdicts(userId: string): Promise<{ readonly disliked: readonly DishRef[]; readonly liked: readonly DishRef[] }> {
    try {
      const db = database();
      const [liked, disliked] = await Promise.all([
        db
          .select({ name: recipes.name, slug: recipes.slug })
          .from(favoriteRecipes)
          .innerJoin(recipes, eq(recipes.id, favoriteRecipes.recipeId))
          .where(eq(favoriteRecipes.userId, userId)),
        db
          .select({ name: recipes.name, slug: recipes.slug })
          .from(dislikedRecipes)
          .innerJoin(recipes, eq(recipes.id, dislikedRecipes.recipeId))
          .where(eq(dislikedRecipes.userId, userId))
      ]);

      return { disliked, liked };
    } catch (error: unknown) {
      throw wrap(error, 'favorite_recipes');
    }
  },

  /**
   * Every recipe's own method, whatever wrote it — the seed, an old prompt, the
   * current one — for `apps/api/scripts/clean-stored-steps.mjs`, which applies
   * today's `cleanSteps` rules to what is already stored. Unlike
   * `claimUndocumented` this takes no claim and reads every source and every
   * `stepsVersion`: the bug this cleans up (a leaked field name, a bare slug)
   * was never scoped to "written before the current prompt", so neither is
   * this read.
   *
   * `ingredientSlugs` is the dish's **own** ingredients, by slug — never the
   * whole catalogue. `cleanSteps`' slug→name pass only ever reads a step back
   * against slugs a generation could plausibly have shown or used for *that*
   * dish (`PoolBuilder`'s `shownSlugs ∪ data.ingredients`); a slug map built
   * from the whole catalogue instead turns an ordinary word that happens to
   * equal some *other* ingredient's slug into that ingredient's name — seen on
   * a real recipe, "tomate triturado" corrupted into "tomate fresco
   * triturado" because "tomate" is itself the fresh-tomato slug. Since a
   * stored recipe's original request is gone, its own ingredients are the
   * closest safe stand-in for that union.
   */
  async listForStepCleanup(): Promise<
    readonly {
      readonly id: string;
      readonly ingredientSlugs: readonly string[];
      readonly instructions: readonly RecipeStep[];
      readonly locale: string;
      readonly name: string;
    }[]
  > {
    try {
      const db = database();
      const rows = await db
        .select({ id: recipes.id, instructions: recipes.instructions, locale: recipes.locale, name: recipes.name })
        .from(recipes)
        .orderBy(recipes.id);

      if (rows.length === 0) {
        return [];
      }

      const items = await db
        .select({ recipeId: recipeIngredients.recipeId, slug: ingredients.slug })
        .from(recipeIngredients)
        .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
        .where(
          inArray(
            recipeIngredients.recipeId,
            rows.map(row => row.id)
          )
        );
      const slugsByRecipe = new Map<string, string[]>();

      for (const item of items) {
        slugsByRecipe.set(item.recipeId, [...(slugsByRecipe.get(item.recipeId) ?? []), item.slug]);
      }

      return rows.map(row => ({ ...row, ingredientSlugs: slugsByRecipe.get(row.id) ?? [] }));
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /**
   * The catalogue this person can actually shop from.
   *
   * `country` drops the rows that are only sold somewhere else (`0034`). Null
   * means no claim — an account that never said where it is gets the whole
   * catalogue, which is what it got before the column existed and is better
   * than guessing a country and quietly withholding food over it.
   *
   * `slugs`, when given, loads only those rows — the same rows, read the same
   * way — for a caller that needs a few dishes' ingredients, not the shelf
   * (the console's recipe table, `0068`).
   */
  async loadCatalogue(locale: string, country: string | null = null, slugs?: readonly string[]): Promise<readonly CatalogueIngredient[]> {
    if (slugs?.length === 0) {
      return [];
    }

    try {
      const db = database();
      const only = slugs === undefined ? undefined : inArray(ingredients.slug, [...slugs]);
      // Empty means everywhere, so an ingredient survives when it names no
      // country or names this one.
      const sold = country === null ? undefined : sql`(cardinality(${ingredients.countries}) = 0 or ${country} = any(${ingredients.countries}))`;
      // Two joins rather than one, so a missing translation is visible instead of
      // absent: `requested` is null exactly when this locale has no name, and the
      // caller is told which locale it actually got.
      const requested = aliasedTable(ingredientNames, 'requested_name');
      const fallback = aliasedTable(ingredientNames, 'fallback_name');

      const [rows, links] = await Promise.all([
        db
          .select({
            id: ingredients.id,
            carbsPer100g: ingredients.carbsPer100g,
            category: ingredients.category,
            classes: ingredients.classes,
            defaultUnit: ingredients.defaultUnit,
            fallbackName: fallback.name,
            fatPer100g: ingredients.fatPer100g,
            fiberPer100g: ingredients.fiberPer100g,
            gramsPerUnit: ingredients.gramsPerUnit,
            kcalPer100g: ingredients.kcalPer100g,
            mealSlots: ingredients.mealSlots,
            proteinPer100g: ingredients.proteinPer100g,
            requestedName: requested.name,
            seasonMonths: ingredients.seasonMonths,
            slug: ingredients.slug
          })
          .from(ingredients)
          .leftJoin(requested, and(eq(requested.ingredientId, ingredients.id), eq(requested.locale, locale)))
          .leftJoin(fallback, and(eq(fallback.ingredientId, ingredients.id), eq(fallback.locale, FALLBACK_LOCALE)))
          .where(and(sold, only)),
        db
          .select({
            allergenId: ingredientAllergens.allergenId,
            ingredientId: ingredientAllergens.ingredientId,
            presence: ingredientAllergens.presence
          })
          .from(ingredientAllergens)
          .where(only && inArray(ingredientAllergens.ingredientId, db.select({ id: ingredients.id }).from(ingredients).where(only)))
      ]);

      const byIngredient = new Map<string, { allergenId: string; presence: 'contains' | 'may_contain' }[]>();

      for (const link of links) {
        byIngredient.set(link.ingredientId, [
          ...(byIngredient.get(link.ingredientId) ?? []),
          { allergenId: link.allergenId, presence: link.presence }
        ]);
      }

      return rows.map(row => ({
        id: row.id,
        allergens: byIngredient.get(row.id) ?? [],
        carbsPer100g: Number(row.carbsPer100g),
        category: row.category,
        classes: row.classes as readonly FoodClass[],
        defaultUnit: row.defaultUnit,
        fatPer100g: Number(row.fatPer100g),
        fiberPer100g: Number(row.fiberPer100g),
        gramsPerUnit: row.gramsPerUnit === null ? null : Number(row.gramsPerUnit),
        kcalPer100g: Number(row.kcalPer100g),
        // Text in the column, the enum's values or `none` by construction: the
        // seed writes them from `MealEntry`, and nothing else writes the column.
        mealSlots: row.mealSlots as readonly ('none' | MealSlot)[],
        // The slug is the last resort. An ingredient with no name in any locale
        // is a broken seed, and showing "pan-integral" says so; showing nothing
        // hides it.
        name: row.requestedName ?? row.fallbackName ?? row.slug,
        nameLocale: row.requestedName === null ? FALLBACK_LOCALE : locale,
        proteinPer100g: Number(row.proteinPer100g),
        seasonMonths: row.seasonMonths,
        slug: row.slug
      }));
    } catch (error: unknown) {
      throw wrap(error, 'ingredients');
    }
  },

  /**
   * What picture calls have cost since `monthStart`, in dollars: the sum of what
   * was billed, so the cap is read from the calls themselves. Mode: one
   * aggregate over the `created_at` index.
   */
  async monthSpendUsd(monthStart: Date): Promise<number> {
    try {
      const [row] = await database()
        .select({ total: sql<string>`coalesce(sum(${recipeImageCalls.costUsd}), 0)` })
        .from(recipeImageCalls)
        .where(gte(recipeImageCalls.createdAt, monthStart));

      return Number(row?.total ?? 0);
    } catch (error: unknown) {
      throw wrap(error, 'recipe_image_calls');
    }
  },

  /**
   * The whole ingredient catalogue as the picture rule reads it (`0066`): every
   * ingredient's slug, its name in every locale, and the allergens it contains
   * and may contain, by key. Whole on purpose — the rule maps what the judge
   * names only to what it is given, and a catalogue of the dish alone would map
   * every extra food to nothing. Mode: three plain reads, no lock; the
   * catalogue only grows.
   */
  async pictureCatalogue(): Promise<readonly PictureFood[]> {
    try {
      const db = database();
      const [rows, names, links] = await Promise.all([
        db.select({ id: ingredients.id, slug: ingredients.slug }).from(ingredients),
        db.select({ ingredientId: ingredientNames.ingredientId, name: ingredientNames.name }).from(ingredientNames),
        db
          .select({ ingredientId: ingredientAllergens.ingredientId, key: allergens.key, presence: ingredientAllergens.presence })
          .from(ingredientAllergens)
          .innerJoin(allergens, eq(allergens.id, ingredientAllergens.allergenId))
      ]);
      const namesOf = new Map<string, string[]>();
      const containsOf = new Map<string, string[]>();
      const mayOf = new Map<string, string[]>();

      for (const { ingredientId, name } of names) {
        namesOf.set(ingredientId, [...(namesOf.get(ingredientId) ?? []), name]);
      }

      for (const { ingredientId, key, presence } of links) {
        const into = presence === 'contains' ? containsOf : mayOf;

        into.set(ingredientId, [...(into.get(ingredientId) ?? []), key]);
      }

      return rows.map(row => ({
        allergens: containsOf.get(row.id) ?? [],
        mayContain: mayOf.get(row.id) ?? [],
        names: namesOf.get(row.id) ?? [],
        slug: row.slug
      }));
    } catch (error: unknown) {
      throw wrap(error, 'ingredients');
    }
  },

  /**
   * A dish as its picture is drawn from (`0066`): its name, and each of its
   * ingredients' slug, English name — `es-ES` when there is none, the slug as
   * a last resort — and grams. Recipe data only: nothing about any person can
   * be here. Null for a recipe that does not exist. Mode: two plain reads.
   */
  async pictureRecipe(recipeId: string): Promise<PictureDish | null> {
    try {
      const db = database();
      const english = aliasedTable(ingredientNames, 'english_name');
      const spanish = aliasedTable(ingredientNames, 'spanish_name');
      const [recipe] = await db.select({ name: recipes.name }).from(recipes).where(eq(recipes.id, recipeId)).limit(1);

      if (!recipe) {
        return null;
      }

      const rows = await db
        .select({ english: english.name, grams: recipeIngredients.grams, slug: ingredients.slug, spanish: spanish.name })
        .from(recipeIngredients)
        .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
        .leftJoin(english, and(eq(english.ingredientId, ingredients.id), eq(english.locale, 'en-GB')))
        .leftJoin(spanish, and(eq(spanish.ingredientId, ingredients.id), eq(spanish.locale, FALLBACK_LOCALE)))
        .where(eq(recipeIngredients.recipeId, recipeId));

      return {
        ingredients: rows.map(row => ({ grams: Number(row.grams), name: row.english ?? row.spanish ?? row.slug, slug: row.slug })),
        name: recipe.name
      };
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /** Where a dish's picture stands; `none` when no drawing was ever claimed. Mode: one read by primary key. */
  async pictureState(recipeId: string): Promise<PictureState> {
    try {
      const [row] = await database()
        .select({
          attempts: recipeImages.attempts,
          lastAttemptAt: recipeImages.lastAttemptAt,
          released: sql<boolean>`${released}`,
          status: recipeImages.status,
          url: recipeImages.url
        })
        .from(recipeImages)
        .where(eq(recipeImages.recipeId, recipeId))
        .limit(1);

      return pictureStateSchema.parse(row ?? { attempts: 0, lastAttemptAt: null, released: false, status: 'none', url: null });
    } catch (error: unknown) {
      throw wrap(error, 'recipe_images');
    }
  },

  /** Whether a recipe exists. Mode: one read by primary key. */
  async recipeExists(recipeId: string): Promise<boolean> {
    try {
      const [row] = await database().select({ id: recipes.id }).from(recipes).where(eq(recipes.id, recipeId)).limit(1);

      return row !== undefined;
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /** One paid picture call and its cost. Mode: a plain insert; each call is its own row. */
  async recordPictureCall(call: PictureCall): Promise<void> {
    try {
      await database()
        .insert(recipeImageCalls)
        .values({ ...call, costUsd: String(call.costUsd) });
    } catch (error: unknown) {
      throw wrap(error, 'recipe_image_calls');
    }
  },

  /**
   * One more refusal recorded against `stepsVersion`, the way
   * `RewriteStamp.nextRewriteStamp` stamps it — a documented failure counted
   * toward `REWRITE_ATTEMPT_BOUND` instead of a silent claim lapse the sweep
   * would try again unbounded, every day, for ever.
   */
  async recordRewriteRefusal(recipeId: string, stepsVersion: string): Promise<void> {
    try {
      const db = database();
      const [row] = await db.select({ stepsVersion: recipes.stepsVersion }).from(recipes).where(eq(recipes.id, recipeId)).limit(1);

      await db
        .update(recipes)
        .set({ stepsVersion: nextRewriteStamp(row?.stepsVersion ?? null, stepsVersion) })
        .where(eq(recipes.id, recipeId));
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /**
   * Gives a claimed drawing back, for a reason that is not the dish's — the
   * month's cap reached, the key refused. The row is `failed` with
   * `provenance.released` saying why, so it reads as no picture and is not
   * drawing; the next claim takes it at once, with no cool-off, and keeps
   * `attempts` — the attempts the dish already used (`claimPicture`). Mode: the
   * same guarded `UPDATE` as `completePicture`. False when the claim was no
   * longer this caller's.
   */
  async releasePicture(
    recipeId: string,
    claimedAt: Date,
    outcome: { readonly attempts: number; readonly reason: PictureReason; readonly why: string },
    now: Date
  ): Promise<boolean> {
    try {
      const rows = await database()
        .update(recipeImages)
        .set({
          attempts: outcome.attempts,
          lastAttemptAt: now,
          provenance: { reason: outcome.reason, released: outcome.why },
          status: 'failed',
          updatedAt: now
        })
        .where(stillClaimed(recipeId, claimedAt))
        .returning({ recipeId: recipeImages.recipeId });

      return rows.length === 1;
    } catch (error: unknown) {
      throw wrap(error, 'recipe_images');
    }
  },

  /**
   * The owner's retry of a picture (`picture.retried`): claims a `failed` row —
   * released or not — at once, with no cool-off, for a fresh three attempts,
   * and a `drawing` one stuck past `staleAfterMinutes`, as a view's claim would.
   * A fresh `drawing` or a `ready` row, or none, is not touched. `provenance` is
   * cleared, so a retried released row is not counted as released while it draws.
   * Mode: one guarded `UPDATE … WHERE failed OR stale drawing RETURNING`, and the audit row written by
   * `record` in the same transaction, so a retry that did not start leaves none
   * and one that started always has one. False when nothing was claimed.
   */
  async retryPicture(recipeId: string, now: Date, staleAfterMinutes: number, record: RecordAudit): Promise<boolean> {
    try {
      const stale = new Date(now.getTime() - staleAfterMinutes * 60_000);

      return await database().transaction(async tx => {
        const rows = await tx
          .update(recipeImages)
          .set({ attempts: 0, lastAttemptAt: now, provenance: null, status: 'drawing', updatedAt: now })
          .where(
            and(
              eq(recipeImages.recipeId, recipeId),
              or(eq(recipeImages.status, 'failed'), and(eq(recipeImages.status, 'drawing'), lt(recipeImages.lastAttemptAt, stale)))
            )
          )
          .returning({ recipeId: recipeImages.recipeId });

        if (rows.length === 1) {
          await record(tx);
        }

        return rows.length === 1;
      });
    } catch (error: unknown) {
      throw wrap(error, 'recipe_images');
    }
  },

  /**
   * `instructions` alone — for `clean-stored-steps.mjs`, which rewrites a
   * step already stored and must change nothing else about the recipe: not
   * `stepsVersion` (that column answers "which prompt wrote this method",
   * and a deterministic clean-up is not a rewrite by a prompt), not its
   * ingredients, not its name.
   */
  async setInstructionsOnly(recipeId: string, steps: readonly RecipeStep[]): Promise<void> {
    try {
      await database().update(recipes).set({ instructions: steps }).where(eq(recipes.id, recipeId));
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /**
   * Replaces a recipe's method and stamps who wrote it. **Only** `instructions`
   * and `steps_version`: the ingredients, the grams and the macros every plan
   * already computed from them are untouched, so a rewrite cannot change what a
   * past plan says anyone ate.
   */
  /**
   * One verdict per person per recipe: the two tables are cleared for the pair
   * and at most one row written, in one transaction, so a "liked" can never sit
   * beside a "disliked". Returns false when the recipe does not exist, which the
   * controller turns into a 404 rather than a foreign-key error.
   */
  async setVerdict(userId: string, recipeId: string, verdict: RecipeVerdict): Promise<boolean> {
    try {
      const db = database();
      const [exists] = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, recipeId)).limit(1);

      if (!exists) {
        return false;
      }

      await db.transaction(async tx => {
        await tx.delete(favoriteRecipes).where(and(eq(favoriteRecipes.userId, userId), eq(favoriteRecipes.recipeId, recipeId)));
        await tx.delete(dislikedRecipes).where(and(eq(dislikedRecipes.userId, userId), eq(dislikedRecipes.recipeId, recipeId)));

        if (verdict === 'liked') {
          await tx.insert(favoriteRecipes).values({ recipeId, userId });
        }

        if (verdict === 'disliked') {
          await tx.insert(dislikedRecipes).values({ recipeId, userId });
        }
      });

      return true;
    } catch (error: unknown) {
      throw wrap(error, 'favorite_recipes');
    }
  },

  async updateSteps(recipeId: string, steps: readonly RecipeStep[], stepsVersion: string): Promise<void> {
    try {
      await database().update(recipes).set({ instructions: steps, stepsVersion }).where(eq(recipes.id, recipeId));
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  }
};

/**
 * The rewrite sweep's own claim condition, in SQL.
 *
 * Mirrors `core/domain/Method`'s `RewriteStamp.needsRewrite` and
 * `isMethodComplete` by hand — a `WHERE` cannot call a TypeScript function,
 * and the claim has to stay one atomic `FOR UPDATE SKIP LOCKED` statement
 * (see `claimUndocumented`'s own comment) rather than a read-then-write pair.
 * The two must agree, the same way `hasUsableMethod`'s own history is the
 * standing warning against a second copy of one question: change one, change
 * the other, and the numbers this file's callers measure against
 * (`RewriteStamp.needsRewrite`, exercised directly by its own tests) are what
 * both are checked against.
 *
 * A recipe needs the sweep when fewer than `REWRITE_ATTEMPT_BOUND` refusals
 * stand against it under `stepsVersion` (the current standard), **and**
 * either an older prompt wrote its method (or nothing did), or the current
 * one did and the method still has a gap: no step's `cue` is non-empty
 * anywhere it cooks, or no step carries a `minutes` above zero.
 */
export function needsRewriteCondition(stepsVersion: string) {
  return sql`
    not (
      split_part(${recipes.stepsVersion}, '+', 1) is not distinct from ${stepsVersion}
      and coalesce(nullif(split_part(${recipes.stepsVersion}, '+', 2), '')::int, 0) >= ${REWRITE_ATTEMPT_BOUND}::int
    )
    and (
      split_part(${recipes.stepsVersion}, '+', 1) is distinct from ${stepsVersion}
      or not (
        jsonb_array_length(${recipes.instructions}) >= (
          case
            when ${recipes.cookMinutes} >= ${METHOD_RULES.longCookMinutes}::int then ${METHOD_RULES.minStepsCookedLong}::int
            when ${recipes.cookMinutes} > 0 then ${METHOD_RULES.minStepsCooked}::int
            else ${METHOD_RULES.minStepsUncooked}::int
          end
        )
        and (
          ${recipes.cookMinutes} = 0
          or (
            exists (select 1 from jsonb_array_elements(${recipes.instructions}) as step where nullif(trim(step ->> 'cue'), '') is not null)
            and exists (select 1 from jsonb_array_elements(${recipes.instructions}) as step where (step ->> 'minutes')::numeric > 0)
          )
        )
      )
    )
  `;
}

/**
 * The row is still the drawing this caller claimed at `claimedAt`: not ended,
 * not taken over. The claim's token is its timestamp, which is exact only while
 * `claimedAt` is the very Date the claim was made with — a millisecond Date
 * round-trips through `timestamptz` unchanged, but one passed through JSON, a
 * queue or a seconds clock would never match. A claim-id column is the robust
 * form if the drawing ever leaves this process.
 */
/** A row a drawing gave back for a reason that is not the dish's (`releasePicture`). */
const released = sql`(${recipeImages.provenance} ->> 'released') is not null`;

function stillClaimed(recipeId: string, claimedAt: Date): SQL | undefined {
  return and(eq(recipeImages.recipeId, recipeId), eq(recipeImages.status, 'drawing'), eq(recipeImages.lastAttemptAt, claimedAt));
}

function wrap(error: unknown, table: string): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on ${table}: ${error.message}`);
  }

  return new DatabaseOperationError();
}

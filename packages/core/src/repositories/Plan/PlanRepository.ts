import { aliasedTable, and, desc, eq, exists, getTableColumns, inArray, lt, ne, sql } from 'drizzle-orm';

import { database } from 'database';
import { careLinks } from 'database/schema/care';
import { mealCompletions, mealPlans, meals, mealSwaps, planDays, planGenerationJobs } from 'database/schema/plan';
import { professionals } from 'database/schema/professional';
import { ingredientAllergens, ingredientNames, ingredients, ingredientSubstitutions } from 'database/schema/food';
import { recipeImages, recipeIngredients, recipes } from 'database/schema/recipe';
import { shoppingListItems, shoppingLists } from 'database/schema/shopping';

import { ConflictError, DatabaseOperationError, NotFoundError, QuotaExceededError } from 'core/entities/Error';
import { FALLBACK_LOCALE } from '#repositories/Recipe';
import type { Macros, MealSlot, MealStatus, PlanDraft, RecipeDraft, ShoppingItemDraft } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { RecordAccess } from '#repositories/Care';

/**
 * A plan waiting for a professional's review (`0060`). Every read a client
 * makes excludes it — `findActive` by asking for `active`, the rest through
 * `visible` — and only the reads a professional reaches through
 * `CareController.withClient` ask for it by name.
 */
const PENDING = 'pending_review';

/** What a client may see of their own plans: everything but a plan still under review. */
function visible() {
  return ne(mealPlans.status, PENDING);
}

export const PlanRepository = {
  /** Swaps recorded against one plan — what the fortnight's allowance is counted from. */
  async countSwaps(planId: string): Promise<number> {
    try {
      const [row] = await database()
        .select({ n: sql<number>`count(*)::int` })
        .from(mealSwaps)
        .where(eq(mealSwaps.planId, planId));

      return row?.n ?? 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Writes an entire plan, or nothing.
   *
   * Everything happens in one transaction: the AI-generated recipes, the plan, its
   * fourteen days, every meal, the shopping list and its items, **and** completing
   * the plan this one supersedes. A failure anywhere rolls all of it back, which is
   * what stops a user ending up with six days of food and half a shopping list.
   *
   * Two database constraints do real work here rather than merely documenting
   * intent: `meal_plans_one_active_per_user` (a partial unique index) and
   * `meal_plans_user_version_key`. Under a double submit the second transaction
   * violates one of them and is translated to a `ConflictError` — the request fails
   * cleanly instead of racing to produce two active plans.
   *
   * Persisting `newRecipes` inside this transaction is not incidental: it is what
   * grows the reusable library, and without it every user pays to generate dishes
   * that already exist (`docs/decisions/0006-reuse-before-generating.md`).
   *
   * **Review before publishing** (`0060`). When `reviewable` (the `professional`
   * switch is on) and the user has an `active` link, whose professional's grant
   * stands, with `reviewBeforePublish`, the plan goes in as `pending_review` and
   * the active plan is **not** completed: the client keeps the fortnight they
   * have until the professional publishes this one (`publish`). The link is read
   * inside this transaction. Every other case is the path above, unchanged.
   *
   * A plan already pending is **replaced** by any new one, reviewed or not: it
   * is deleted here, its job keeps its row with no plan. What it spent stays
   * spent — a redo it was is carried onto the new plan as `replacedRedos`, so
   * a regeneration of a pending plan is counted as the client's own
   * regeneration would be (`redosInFortnight`). A plan generated while the
   * pending one still had days to run is a redo of it, as of an active one.
   * **Only while it can still be published** (an `active` link, a standing
   * grant, the switch on — review itself may be off): a pending plan stranded
   * by a link that ended, paused or lost its grant costs nothing, is not the
   * fortnight under way, and is replaced at no charge.
   *
   * `byProfessional` is a professional's generation (`0060`), and it **never
   * replaces a fortnight under way**. Re-checked here, when it is saved: while
   * the link can publish and a plan is pending, it lands pending (whatever the
   * review toggle now says); with review on, pending; with no active plan,
   * active. Otherwise — the link ended, paused or lost its grant during the
   * generation, and the client has an active plan — it is refused with a
   * `ConflictError`, nothing is written, and the job fails.
   */
  async createPlanAtomically(userId: string, draft: PlanDraft, reviewable = false, byProfessional = false): Promise<string> {
    try {
      return await database().transaction(async tx => {
        const recipeIdBySlug = await insertRecipes(tx, draft.newRecipes, draft.locale, userId);

        // Resolve every slug the plan references — reused recipes, plus any new one
        // whose insert lost the race above.
        const wanted = [...new Set(draft.days.flatMap(day => day.meals.map(meal => meal.recipeSlug)))];
        const missing = wanted.filter(slug => !recipeIdBySlug.has(slug));

        if (missing.length > 0) {
          const found = await tx.select({ id: recipes.id, slug: recipes.slug }).from(recipes).where(inArray(recipes.slug, missing));

          for (const row of found) {
            recipeIdBySlug.set(row.slug, row.id);
          }
        }

        const unresolved = wanted.filter(slug => !recipeIdBySlug.has(slug));

        if (unresolved.length > 0) {
          throw new DatabaseOperationError(`Plan references recipes that do not exist: ${unresolved.join(', ')}`);
        }

        // Held, so a publish racing this generation either lands first (and this
        // plan follows the one it made active) or waits for this to replace it.
        const [pending] = await tx
          .select({ id: mealPlans.id, endDate: mealPlans.endDate, generationMetadata: mealPlans.generationMetadata, status: mealPlans.status })
          .from(mealPlans)
          .where(and(eq(mealPlans.userId, userId), eq(mealPlans.status, PENDING)))
          .limit(1)
          .for('update');
        const link = reviewable ? await publishingLink(tx, userId) : undefined;
        // A professional's regeneration of a pending plan lands pending again even
        // with review turned off since: it replaces what they were reviewing, and a
        // professional never replaces the fortnight under way.
        const review = link?.reviewBeforePublish === true || (byProfessional && link !== undefined && pending !== undefined);
        // A pending plan nobody can publish any more is not the fortnight under way.
        const counted = link !== undefined ? pending : undefined;

        const previous = await tx
          .select({ id: mealPlans.id, endDate: mealPlans.endDate, status: mealPlans.status, version: mealPlans.version })
          .from(mealPlans)
          .where(and(eq(mealPlans.userId, userId), visible()))
          .orderBy(desc(mealPlans.version))
          .limit(1);

        const nextVersion = (previous.at(0)?.version ?? 0) + 1;
        // A plan generated while the previous one still had days to run is a
        // redo of that fortnight, and is stamped as one here, at the moment it
        // is known. Plans from before this stamp existed are not redos: they
        // carry no flag, and the allowance never counts what it did not see.
        // A pending plan is the fortnight under way for this purpose (`0060`).
        const latest = counted ?? previous.at(0);
        const redo = latest !== undefined && (latest.status === 'active' || latest.status === PENDING) && latest.endDate >= draft.startDate;
        const replacedRedos = counted && redo ? replacedRedosOf(counted.generationMetadata) + (counted.generationMetadata?.redo === true ? 1 : 0) : 0;

        // Asked of the table directly, not read off the latest plan: whatever row is
        // `active` is the one the completion below would complete.
        if (refusesProfessionalSave({ byProfessional, hasActive: await hasActivePlan(tx, userId), review })) {
          throw new ConflictError('The review this plan was generated for has ended; the fortnight under way stays');
        }

        if (pending) {
          await tx.update(planGenerationJobs).set({ planId: null }).where(eq(planGenerationJobs.planId, pending.id));
          await tx.delete(mealPlans).where(eq(mealPlans.id, pending.id));
        }

        // Complete the outgoing plan first: the partial unique index permits only
        // one active row per user, so the new one cannot be inserted until this
        // lands — in the same transaction, so no window exists where a user has none.
        // A plan under review leaves it standing: the client lives it until publishing.
        if (!review) {
          await tx
            .update(mealPlans)
            .set({ completedAt: draft.startDate, status: 'completed' })
            .where(and(eq(mealPlans.userId, userId), eq(mealPlans.status, 'active')));
        }

        const [plan] = await tx
          .insert(mealPlans)
          .values({
            activatedAt: review ? null : new Date(),
            endDate: draft.endDate,
            generationMetadata: { ...draft.generationMetadata, redo, ...(replacedRedos > 0 ? { replacedRedos } : {}) },
            previousPlanId: previous.at(0)?.id ?? null,
            startDate: draft.startDate,
            status: review ? PENDING : 'active',
            strategy: draft.strategy,
            userId,
            version: nextVersion
          })
          .returning({ id: mealPlans.id });

        if (!plan) {
          throw new DatabaseOperationError('Plan insert returned no row');
        }

        const insertedDays = await tx
          .insert(planDays)
          .values(
            draft.days.map(day => ({ date: day.date, dayIndex: day.dayIndex, loadedFor: day.loadedFor, planId: plan.id, targets: day.targets }))
          )
          .returning({ id: planDays.id, dayIndex: planDays.dayIndex });

        const dayIdByIndex = new Map(insertedDays.map(day => [day.dayIndex, day.id]));

        const mealRows = draft.days.flatMap(day =>
          day.meals.map(meal => ({
            carbsG: String(meal.carbsG),
            fatG: String(meal.fatG),
            fiberG: String(meal.fiberG),
            kcal: String(meal.kcal),
            planDayId: dayIdByIndex.get(day.dayIndex) as string,
            proteinG: String(meal.proteinG),
            recipeId: recipeIdBySlug.get(meal.recipeSlug) as string,
            servings: String(meal.servings),
            slot: meal.slot,
            sortOrder: meal.sortOrder
          }))
        );

        if (mealRows.length > 0) {
          await tx.insert(meals).values(mealRows);
        }

        const [list] = await tx.insert(shoppingLists).values({ planId: plan.id, userId }).returning({ id: shoppingLists.id });

        if (!list) {
          throw new DatabaseOperationError('Shopping list insert returned no row');
        }

        if (draft.shoppingItems.length > 0) {
          await tx
            .insert(shoppingListItems)
            .values(
              draft.shoppingItems.map(item => ({
                category: item.category,
                displayQuantity: String(item.displayQuantity),
                displayUnit: item.displayUnit,
                ingredientId: item.ingredientId,
                listId: list.id,
                name: item.name,
                totalGrams: String(item.totalGrams)
              }))
            );
        }

        return plan.id;
      });
    } catch (error: unknown) {
      if (error instanceof ConflictError) {
        throw error;
      }

      if (isUniqueViolation(error)) {
        throw new ConflictError('A plan is already being created for this account');
      }

      throw wrap(error);
    }
  },

  async findActive(userId: string) {
    try {
      const [row] = await database()
        .select()
        .from(mealPlans)
        .where(and(eq(mealPlans.userId, userId), eq(mealPlans.status, 'active')))
        .limit(1);

      return row;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Owner-scoped by construction: a plan id from another account simply is not
   * found — and neither is one still under review (`0060`), unless the caller
   * is a professional's read through `withClient` and says so.
   */
  async findById(userId: string, planId: string, withPending = false) {
    try {
      const [row] = await database()
        .select()
        .from(mealPlans)
        .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId), withPending ? undefined : visible()))
        .limit(1);

      return row;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every plan the user has had, newest first: the chain `redosInFortnight`
   * walks. A plan under review is left out (`0060`) unless `withPending` — the
   * allowance asks for it, because a pending plan spent what it spent.
   */
  async findChain(userId: string, withPending = false) {
    try {
      const rows = await database()
        .select({
          id: mealPlans.id,
          completedAt: mealPlans.completedAt,
          endDate: mealPlans.endDate,
          generationMetadata: mealPlans.generationMetadata,
          startDate: mealPlans.startDate,
          status: mealPlans.status,
          version: mealPlans.version
        })
        .from(mealPlans)
        .where(and(eq(mealPlans.userId, userId), withPending ? undefined : visible()))
        .orderBy(desc(mealPlans.version));

      return rows.map(({ generationMetadata, ...row }) => ({
        ...row,
        redo: generationMetadata?.redo === true,
        replacedRedos: replacedRedosOf(generationMetadata)
      }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Days and meals for a plan the caller has already been confirmed to own. */
  async findDaysWithMeals(planId: string, locale: string) {
    try {
      const db = database();
      const days = await db.select().from(planDays).where(eq(planDays.planId, planId)).orderBy(planDays.dayIndex);

      if (days.length === 0) {
        return [];
      }

      const rows = await db
        // `hasImage` rides on the recipe so every consumer of a recipe row can offer the picture.
        .select({
          meal: meals,
          recipe: {
            ...getTableColumns(recipes),
            hasImage: sql<boolean>`exists (select 1 from ${recipeImages} where ${recipeImages.recipeId} = ${recipes.id})`
          }
        })
        .from(meals)
        .innerJoin(recipes, eq(recipes.id, meals.recipeId))
        .where(
          inArray(
            meals.planDayId,
            days.map(day => day.id)
          )
        )
        .orderBy(meals.sortOrder);

      // One query for the whole fortnight's ingredients rather than one per meal:
      // fourteen days of four meals is fifty-six round trips otherwise, on the
      // screen a user opens most.
      const requested = aliasedTable(ingredientNames, 'requested_name');
      const fallback = aliasedTable(ingredientNames, 'fallback_name');
      const recipeIds = [...new Set(rows.map(row => row.recipe.id))];

      const items =
        recipeIds.length === 0
          ? []
          : await db
              .select({
                fallbackName: fallback.name,
                grams: recipeIngredients.grams,
                recipeId: recipeIngredients.recipeId,
                requestedName: requested.name,
                slug: ingredients.slug
              })
              .from(recipeIngredients)
              .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
              .leftJoin(requested, and(eq(requested.ingredientId, ingredients.id), eq(requested.locale, locale)))
              .leftJoin(fallback, and(eq(fallback.ingredientId, ingredients.id), eq(fallback.locale, FALLBACK_LOCALE)))
              .where(and(inArray(recipeIngredients.recipeId, recipeIds), eq(recipeIngredients.isOptional, false)));

      const byRecipe = new Map<string, { grams: string; name: string; slug: string }[]>();

      for (const item of items) {
        const name = item.requestedName ?? item.fallbackName ?? item.slug;

        byRecipe.set(item.recipeId, [...(byRecipe.get(item.recipeId) ?? []), { grams: item.grams, name, slug: item.slug }]);
      }

      return days.map(day => ({
        ...day,
        meals: rows.filter(row => row.meal.planDayId === day.id).map(row => ({ ...row, items: byRecipe.get(row.recipe.id) ?? [] }))
      }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * What generation needs to know about this user's past plans: the version the
   * next one will carry, and every dish served in the latest one.
   *
   * The version seeds which library dishes the user is handed, so the pick is
   * theirs and reproducible; the dishes are what they will not be served again.
   * One method, because the two answers come from the same plan. The latest
   * plan may be one under review (`0060`): a regeneration of it then avoids its
   * dishes, as a redo avoids the plan it redoes — variety, on purpose, even
   * though the client never saw them.
   */
  async findGenerationHistory(
    userId: string
  ): Promise<{ readonly nextVersion: number; readonly recentDishes: readonly { readonly name: string; readonly slug: string }[] }> {
    try {
      const db = database();
      const [latest] = await db
        .select({ id: mealPlans.id, version: mealPlans.version })
        .from(mealPlans)
        .where(eq(mealPlans.userId, userId))
        .orderBy(desc(mealPlans.version))
        .limit(1);

      if (!latest) {
        return { nextVersion: 1, recentDishes: [] };
      }

      const served = await db
        .selectDistinct({ name: recipes.name, slug: recipes.slug })
        .from(meals)
        .innerJoin(planDays, eq(planDays.id, meals.planDayId))
        .innerJoin(recipes, eq(recipes.id, meals.recipeId))
        .where(eq(planDays.planId, latest.id));

      return { nextVersion: latest.version + 1, recentDishes: served };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Newest first, without a plan under review (`0060`). */
  async findHistory(userId: string, limit: number, offset: number) {
    try {
      return await database()
        .select()
        .from(mealPlans)
        .where(and(eq(mealPlans.userId, userId), visible()))
        .orderBy(desc(mealPlans.version))
        .limit(limit)
        .offset(offset);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One meal, with its recipe and ingredients — owner-scoped through the plan.
   *
   * The join to `meal_plans` on `userId` is what makes a meal id from another
   * account simply not found, rather than a resource we then have to refuse.
   * A meal of a plan under review is not found either, unless `withPending`.
   */
  async findMealDetail(userId: string, mealId: string, locale: string, withPending = false) {
    try {
      const db = database();

      const [row] = await db
        .select({
          day: planDays,
          meal: meals,
          plan: { id: mealPlans.id, status: mealPlans.status },
          recipe: {
            ...getTableColumns(recipes),
            hasImage: sql<boolean>`exists (select 1 from ${recipeImages} where ${recipeImages.recipeId} = ${recipes.id})`
          }
        })
        .from(meals)
        .innerJoin(planDays, eq(planDays.id, meals.planDayId))
        .innerJoin(mealPlans, eq(mealPlans.id, planDays.planId))
        .innerJoin(recipes, eq(recipes.id, meals.recipeId))
        .where(and(eq(meals.id, mealId), eq(mealPlans.userId, userId), withPending ? undefined : visible()))
        .limit(1);

      if (!row) {
        return undefined;
      }

      // Resolved live rather than snapshotted, unlike the shopping list: the
      // ingredient list on a meal is a lookup into the current catalogue, so a
      // user who switches language sees this screen change with them.
      const requested = aliasedTable(ingredientNames, 'requested_name');
      const fallback = aliasedTable(ingredientNames, 'fallback_name');

      const rows = await db
        .select({
          carbsPer100g: ingredients.carbsPer100g,
          fallbackName: fallback.name,
          fatPer100g: ingredients.fatPer100g,
          grams: recipeIngredients.grams,
          ingredientId: ingredients.id,
          kcalPer100g: ingredients.kcalPer100g,
          proteinPer100g: ingredients.proteinPer100g,
          requestedName: requested.name,
          slug: ingredients.slug,
          unit: recipeIngredients.unit
        })
        .from(recipeIngredients)
        .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
        .leftJoin(requested, and(eq(requested.ingredientId, ingredients.id), eq(requested.locale, locale)))
        .leftJoin(fallback, and(eq(fallback.ingredientId, ingredients.id), eq(fallback.locale, FALLBACK_LOCALE)))
        .where(eq(recipeIngredients.recipeId, row.recipe.id));

      const substitutes = await findSubstitutes(
        rows.map(item => item.ingredientId),
        locale
      );

      const items = rows.map(item => ({
        carbsPer100g: Number(item.carbsPer100g),
        fatPer100g: Number(item.fatPer100g),
        grams: item.grams,
        kcalPer100g: Number(item.kcalPer100g),
        name: item.requestedName ?? item.fallbackName ?? item.slug,
        proteinPer100g: Number(item.proteinPer100g),
        slug: item.slug,
        substitutes: substitutes.get(item.ingredientId) ?? [],
        unit: item.unit
      }));

      return { ...row, items };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** The meal, its day and plan, owner-scoped — the anchor of a swap. A plan under review only with `withPending`. */
  async findMealForSwap(userId: string, mealId: string, withPending = false) {
    try {
      const [row] = await database()
        .select({
          day: { id: planDays.id, date: planDays.date, dayIndex: planDays.dayIndex },
          meal: meals,
          plan: {
            id: mealPlans.id,
            endDate: mealPlans.endDate,
            startDate: mealPlans.startDate,
            status: mealPlans.status,
            strategy: mealPlans.strategy
          },
          recipe: {
            id: recipes.id,
            cookMinutes: recipes.cookMinutes,
            name: recipes.name,
            prepMinutes: recipes.prepMinutes,
            servings: recipes.servings,
            slug: recipes.slug
          }
        })
        .from(meals)
        .innerJoin(planDays, eq(planDays.id, meals.planDayId))
        .innerJoin(mealPlans, eq(mealPlans.id, planDays.planId))
        .innerJoin(recipes, eq(recipes.id, meals.recipeId))
        .where(and(eq(meals.id, mealId), eq(mealPlans.userId, userId), withPending ? undefined : visible()))
        .limit(1);

      return row;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The plan waiting for review (`0060`), or undefined — at most one, by
   * `meal_plans_one_pending_review_per_user`. Only a professional's read
   * through `withClient` asks for it.
   */
  async findPending(userId: string) {
    try {
      const [row] = await database()
        .select()
        .from(mealPlans)
        .where(and(eq(mealPlans.userId, userId), eq(mealPlans.status, PENDING)))
        .limit(1);

      return row;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The list for a plan, with every name read in the caller's language.
   *
   * The stored `name` is a snapshot from the day the list was built, so a person
   * who switches language keeps a Spanish shopping list forever — which is what
   * happened. The catalogue's own name for the ingredient is the truth, and it
   * has one per locale; the snapshot survives as the fallback, because an item
   * somebody typed in themselves has no ingredient to look up.
   */
  async findShoppingList(planId: string, locale: string = FALLBACK_LOCALE) {
    try {
      const db = database();
      const [list] = await db.select().from(shoppingLists).where(eq(shoppingLists.planId, planId)).limit(1);

      if (!list) {
        return undefined;
      }

      const translated = aliasedTable(ingredientNames, 'shopping_item_name');
      const rows = await db
        .select({ item: getTableColumns(shoppingListItems), translated: translated.name })
        .from(shoppingListItems)
        .leftJoin(translated, and(eq(translated.ingredientId, shoppingListItems.ingredientId), eq(translated.locale, locale)))
        .where(eq(shoppingListItems.listId, list.id))
        .orderBy(shoppingListItems.category, shoppingListItems.name);

      return { ...list, items: rows.map(row => ({ ...row.item, name: row.translated ?? row.item.name })) };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Whether a plan waiting for this user's review could still be published
   * (`0060`): an `active` link whose professional's grant stands. What the
   * allowance asks before it counts a pending plan; the switch is the caller's.
   */
  async isPublishable(userId: string): Promise<boolean> {
    try {
      return (await publishingLink(database(), userId)) !== undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Publishes the plan waiting for review (`0060`): the active plan is completed
   * and this one set active, in one transaction with the professional's trail
   * row (`record`), or nothing — returns undefined when no plan is pending.
   *
   * The pending row is held `FOR UPDATE`, so a generation replacing it and a
   * publish of it queue behind each other. Completing first is what
   * `meal_plans_one_active_per_user` requires, as in `createPlanAtomically`.
   * A pending plan older than the active one is refused (see below).
   */
  async publish(userId: string, record: RecordAccess, today: string = new Date().toISOString().slice(0, 10)): Promise<string | undefined> {
    try {
      return await database().transaction(async tx => {
        const [pending] = await tx
          .select({ id: mealPlans.id, version: mealPlans.version })
          .from(mealPlans)
          .where(and(eq(mealPlans.userId, userId), eq(mealPlans.status, PENDING)))
          .limit(1)
          .for('update');

        if (!pending) {
          return undefined;
        }

        // A pending plan older than the active one can only be left over by an API
        // rolled back to before `0060`, which generated past it without knowing
        // the state. Publishing it would replace the client's newer plan with a
        // stale draft, so it is refused like nothing pending — and deleted, with
        // no trail row: the professional changed nothing.
        const [active] = await tx
          .select({ version: mealPlans.version })
          .from(mealPlans)
          .where(and(eq(mealPlans.userId, userId), eq(mealPlans.status, 'active')))
          .limit(1);

        if (active && active.version > pending.version) {
          await tx.update(planGenerationJobs).set({ planId: null }).where(eq(planGenerationJobs.planId, pending.id));
          await tx.delete(mealPlans).where(eq(mealPlans.id, pending.id));

          return undefined;
        }

        await tx
          .update(mealPlans)
          .set({ completedAt: today, status: 'completed', updatedAt: new Date() })
          .where(and(eq(mealPlans.userId, userId), eq(mealPlans.status, 'active')));
        await tx.update(mealPlans).set({ activatedAt: new Date(), status: 'active', updatedAt: new Date() }).where(eq(mealPlans.id, pending.id));
        await record(tx);

        return pending.id;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Rewrites the meals of some days of the active plan, and the plan's shopping
   * list with them, in one transaction that also spends the allowance (`0044`).
   *
   * **All of it or none of it.** A fortnight with three days rebuilt and a
   * shopping list still listing what they used to be is worse than a fortnight
   * nobody touched, so the days, the list and the counter commit together.
   *
   * The meal rows are **updated in place** rather than deleted and re-inserted,
   * and that is not a style choice: `meal_swaps.meal_id` cascades on delete, so
   * throwing a meal away would throw away the record that a swap happened and
   * quietly hand the person their swap allowance back. `meals_slot_unique` gives
   * each day one meal per slot, which is what makes the update addressable.
   *
   * The allowance is spent by a guarded `UPDATE … WHERE mid_plan_loads < limit`
   * rather than by reading the count and then writing it. Under READ COMMITTED
   * the second of two racing transactions re-evaluates that predicate against
   * the row the first one wrote, so they cannot both spend the last one.
   */
  async rebuildLoadedDays(
    userId: string,
    planId: string,
    rebuild: {
      readonly days: readonly {
        readonly dayIndex: number;
        readonly loadedFor: string;
        readonly meals: readonly { readonly macros: Macros; readonly recipeSlug: string; readonly servings: number; readonly slot: MealSlot }[];
        readonly targets: NutritionTargets;
      }[];
      readonly limit: number;
    },
    shoppingItems: readonly ShoppingItemDraft[]
  ): Promise<void> {
    try {
      await database().transaction(async tx => {
        const [plan] = await tx
          .select({ id: mealPlans.id, status: mealPlans.status })
          .from(mealPlans)
          .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId)))
          .limit(1);

        if (!plan) {
          throw new NotFoundError('Plan not found');
        }

        if (plan.status !== 'active') {
          throw new ConflictError('Only the active plan can be changed');
        }

        const spent = await tx
          .update(mealPlans)
          .set({ midPlanLoads: sql`${mealPlans.midPlanLoads} + 1` })
          .where(and(eq(mealPlans.id, planId), lt(mealPlans.midPlanLoads, rebuild.limit)))
          .returning({ id: mealPlans.id });

        if (spent.length === 0) {
          throw new QuotaExceededError('mid_plan_event');
        }

        const wanted = [...new Set(rebuild.days.flatMap(day => day.meals.map(meal => meal.recipeSlug)))];
        const recipeIdBySlug = new Map(
          (await tx.select({ id: recipes.id, slug: recipes.slug }).from(recipes).where(inArray(recipes.slug, wanted))).map(row => [row.slug, row.id])
        );
        const unresolved = wanted.filter(slug => !recipeIdBySlug.has(slug));

        if (unresolved.length > 0) {
          throw new DatabaseOperationError(`Rebuild references recipes that do not exist: ${unresolved.join(', ')}`);
        }

        const dayIdByIndex = new Map(
          (
            await tx
              .select({ id: planDays.id, dayIndex: planDays.dayIndex })
              .from(planDays)
              .where(
                and(
                  eq(planDays.planId, planId),
                  inArray(
                    planDays.dayIndex,
                    rebuild.days.map(day => day.dayIndex)
                  )
                )
              )
          ).map(row => [row.dayIndex, row.id])
        );

        for (const day of rebuild.days) {
          const planDayId = dayIdByIndex.get(day.dayIndex);

          if (!planDayId) {
            throw new DatabaseOperationError(`Rebuild references day ${day.dayIndex}, which this plan does not have`);
          }

          // Stamped exactly as generation stamps it: the name is what the day
          // says it ate for once the event itself is gone (`0021`, `0043`).
          await tx.update(planDays).set({ loadedFor: day.loadedFor, targets: day.targets }).where(eq(planDays.id, planDayId));

          for (const meal of day.meals) {
            const updated = await tx
              .update(meals)
              .set({
                carbsG: String(meal.macros.carbsG),
                fatG: String(meal.macros.fatG),
                fiberG: String(meal.macros.fiberG),
                kcal: String(meal.macros.kcal),
                proteinG: String(meal.macros.proteinG),
                recipeId: recipeIdBySlug.get(meal.recipeSlug) as string,
                servings: String(meal.servings),
                updatedAt: new Date()
              })
              .where(and(eq(meals.planDayId, planDayId), eq(meals.slot, meal.slot)))
              .returning({ id: meals.id });

            // A slot the day does not have would leave the old meal standing
            // beside the new ones — a day half rebuilt. Roll the lot back.
            if (updated.length === 0) {
              throw new DatabaseOperationError(`Rebuild references ${meal.slot} on day ${day.dayIndex}, which that day does not eat`);
            }
          }
        }

        await replaceGeneratedItems(tx, planId, shoppingItems);
      });
    } catch (error: unknown) {
      if (error instanceof ConflictError || error instanceof NotFoundError || error instanceof QuotaExceededError) {
        throw error;
      }

      throw wrap(error);
    }
  },

  /**
   * Ticks or unticks one item.
   *
   * Ownership is resolved *inside* the statement, by walking item → list → plan →
   * user, so an item id belonging to another account updates nothing and the
   * caller sees "not found" rather than a refusal. The same rule as every other
   * user-scoped write: the id from the path is never trusted on its own.
   */
  async setItemChecked(userId: string, itemId: string, checked: boolean): Promise<boolean> {
    try {
      const owned = database()
        .select({ id: shoppingListItems.id })
        .from(shoppingListItems)
        .innerJoin(shoppingLists, eq(shoppingLists.id, shoppingListItems.listId))
        .innerJoin(mealPlans, eq(mealPlans.id, shoppingLists.planId))
        .where(and(eq(shoppingListItems.id, itemId), eq(mealPlans.userId, userId), visible()));

      const updated = await database()
        .update(shoppingListItems)
        .set({ checked, updatedAt: new Date() })
        .where(inArray(shoppingListItems.id, owned))
        .returning({ id: shoppingListItems.id });

      return updated.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Marks a meal eaten or skipped, or takes it back. The meal row carries the
   * current answer; `meal_completions` keeps the day it was said, which is what
   * a check-in will read. Owner-scoped in the statement. `missing` when the
   * meal is not theirs (a 404 upstream) or its plan is under review (`0060`);
   * `closed` when its plan is no longer the active one — the past is
   * read-only (0021).
   */
  async setMealStatus(
    userId: string,
    mealId: string,
    status: MealStatus,
    today: string = new Date().toISOString().slice(0, 10)
  ): Promise<'closed' | 'done' | 'future' | 'missing'> {
    try {
      return await database().transaction(async tx => {
        const [owned] = await tx
          .select({ id: meals.id, date: planDays.date, planStatus: mealPlans.status })
          .from(meals)
          .innerJoin(planDays, eq(planDays.id, meals.planDayId))
          .innerJoin(mealPlans, eq(mealPlans.id, planDays.planId))
          .where(and(eq(meals.id, mealId), eq(mealPlans.userId, userId), visible()))
          .limit(1);

        if (!owned) {
          return 'missing';
        }

        if (owned.planStatus !== 'active') {
          return 'closed';
        }

        /*
         * A meal can be marked once it could have been eaten, and not before.
         *
         * Yesterday's lunch marked this morning is somebody catching up, which is
         * ordinary. Tomorrow's dinner marked today is a fact about the future,
         * and adherence is built from these marks — the check-in hands them to
         * the next fortnight, so a wrong one does not just look wrong, it
         * changes what somebody is served.
         */
        if (owned.date > today) {
          return 'future';
        }

        await tx.update(meals).set({ status, updatedAt: new Date() }).where(eq(meals.id, mealId));
        await tx.delete(mealCompletions).where(and(eq(mealCompletions.userId, userId), eq(mealCompletions.mealId, mealId)));

        if (status !== 'planned') {
          await tx.insert(mealCompletions).values({ loggedAt: new Date().toISOString().slice(0, 10), mealId, status, userId });
        }

        return 'done';
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Replaces one meal's dish in place and rebuilds the plan's shopping list, in
   * one transaction that also counts the allowance.
   *
   * The allowance is counted from `meal_swaps` **with the plan row held
   * `FOR UPDATE`**. Counting inside the transaction is not enough on its own:
   * under READ COMMITTED two swaps racing for the last one each count before
   * either has committed, both see four, both pass, and six land. The lock makes
   * the second wait until the first has committed, and a statement that begins
   * after a commit sees it — so the second counts five and is refused. The
   * `0044` counter spends by a guarded `UPDATE` instead; this one keeps the swap
   * rows as the single record and locks the row they belong to.
   *
   * The list is rebuilt from the whole plan rather than patched, because
   * quantities aggregate across meals. What the person had already ticked stays
   * ticked when the ingredient is still on the list; items they added by hand
   * are never touched.
   *
   * `review` is a professional's swap on the plan under review (`0060`): the
   * meal must belong to the pending plan — anything else is not found — and
   * the trail row goes in with the change. Without it, a meal of a pending
   * plan is not found.
   */
  async swapMeal(
    userId: string,
    mealId: string,
    change: {
      readonly limit: number;
      readonly locale: string;
      readonly macros: Macros;
      readonly newRecipe: RecipeDraft | null;
      readonly recipeSlug: string;
      readonly servings: number;
      readonly source: 'library' | 'model';
    },
    shoppingItems: readonly ShoppingItemDraft[],
    review?: { readonly record: RecordAccess }
  ): Promise<void> {
    try {
      await database().transaction(async tx => {
        // Locks the plan row for the rest of the transaction: every other swap
        // of this plan queues here, and counts only once this one has committed.
        const [owned] = await tx
          .select({ mealId: meals.id, planId: mealPlans.id, recipeId: meals.recipeId })
          .from(meals)
          .innerJoin(planDays, eq(planDays.id, meals.planDayId))
          .innerJoin(mealPlans, eq(mealPlans.id, planDays.planId))
          .where(and(eq(meals.id, mealId), eq(mealPlans.userId, userId), review ? eq(mealPlans.status, PENDING) : visible()))
          .limit(1)
          .for('update', { of: mealPlans });

        if (!owned) {
          throw new NotFoundError('Meal not found');
        }

        const [used] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(mealSwaps)
          .where(eq(mealSwaps.planId, owned.planId));

        if ((used?.n ?? 0) >= change.limit) {
          throw new QuotaExceededError('meal_swap');
        }

        const inserted = change.newRecipe ? await insertRecipes(tx, [change.newRecipe], change.locale, userId) : new Map<string, string>();
        let recipeId = inserted.get(change.recipeSlug);

        if (!recipeId) {
          const [found] = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.slug, change.recipeSlug)).limit(1);

          recipeId = found?.id;
        }

        if (!recipeId) {
          throw new DatabaseOperationError(`Swap references a recipe that does not exist: ${change.recipeSlug}`);
        }

        await tx
          .update(meals)
          .set({
            carbsG: String(change.macros.carbsG),
            fatG: String(change.macros.fatG),
            fiberG: String(change.macros.fiberG),
            kcal: String(change.macros.kcal),
            proteinG: String(change.macros.proteinG),
            recipeId,
            servings: String(change.servings),
            updatedAt: new Date()
          })
          .where(eq(meals.id, mealId));

        await tx
          .insert(mealSwaps)
          .values({ fromRecipeId: owned.recipeId, mealId, planId: owned.planId, source: change.source, toRecipeId: recipeId, userId });

        await replaceGeneratedItems(tx, owned.planId, shoppingItems);
        await review?.record(tx);
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundError || error instanceof QuotaExceededError) {
        throw error;
      }

      throw wrap(error);
    }
  }
};

/**
 * Rewrites everything the plan put on the shopping list, leaving alone
 * everything the person did (`0015`).
 *
 * The list is rebuilt from the whole plan rather than patched, because
 * quantities aggregate across meals — two meals using tomato are one line. What
 * they had already ticked stays ticked when the ingredient is still on the
 * list; items they added by hand are never touched.
 *
 * Shared by the swap and the mid-plan rebuild, because "the list matches the
 * active plan" is one rule, and two copies of it are two chances to break it.
 */
async function replaceGeneratedItems(tx: Transaction, planId: string, shoppingItems: readonly ShoppingItemDraft[]): Promise<void> {
  const [list] = await tx.select({ id: shoppingLists.id }).from(shoppingLists).where(eq(shoppingLists.planId, planId)).limit(1);

  if (!list) {
    return;
  }

  const existing = await tx
    .select({
      id: shoppingListItems.id,
      addedManually: shoppingListItems.addedManually,
      checked: shoppingListItems.checked,
      ingredientId: shoppingListItems.ingredientId
    })
    .from(shoppingListItems)
    .where(eq(shoppingListItems.listId, list.id));
  const ticked = new Set(existing.filter(item => item.checked && item.ingredientId).map(item => item.ingredientId));
  const generated = existing.filter(item => !item.addedManually).map(item => item.id);

  if (generated.length > 0) {
    await tx.delete(shoppingListItems).where(inArray(shoppingListItems.id, generated));
  }

  if (shoppingItems.length > 0) {
    await tx
      .insert(shoppingListItems)
      .values(
        shoppingItems.map(item => ({
          category: item.category,
          checked: ticked.has(item.ingredientId),
          displayQuantity: String(item.displayQuantity),
          displayUnit: item.displayUnit,
          ingredientId: item.ingredientId,
          listId: list.id,
          name: item.name,
          totalGrams: String(item.totalGrams)
        }))
      );
  }
}

/**
 * The link a plan under review could be published through (`0060`): `active`,
 * with the professional's grant still standing — a professional who can no
 * longer publish must not be able to hold a plan back. Undefined otherwise.
 * `reviewBeforePublish` says whether the next plan waits for them.
 */
async function publishingLink(
  db: ReturnType<typeof database> | Transaction,
  userId: string
): Promise<{ readonly reviewBeforePublish: boolean } | undefined> {
  const [row] = await db
    .select({ reviewBeforePublish: careLinks.reviewBeforePublish })
    .from(careLinks)
    .where(
      and(
        eq(careLinks.clientId, userId),
        eq(careLinks.status, 'active'),
        exists(db.select({ userId: professionals.userId }).from(professionals).where(eq(professionals.userId, careLinks.professionalId)))
      )
    )
    .limit(1);

  return row;
}

/**
 * Whether a professional's generation must be refused when it is saved
 * (`0060`): it is theirs, it will not wait for review, and saving it active
 * would complete the client's fortnight under way — which a professional never
 * replaces.
 */
export function refusesProfessionalSave(save: { readonly byProfessional: boolean; readonly hasActive: boolean; readonly review: boolean }): boolean {
  return save.byProfessional && !save.review && save.hasActive;
}

/** Whether the user has an `active` plan, read in the caller's transaction. */
async function hasActivePlan(tx: Transaction, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.status, 'active')))
    .limit(1);

  return row !== undefined;
}

/** The redos spent by pending plans this one replaced (`createPlanAtomically`). */
function replacedRedosOf(metadata: Record<string, unknown> | null): number {
  const value = metadata?.replacedRedos;

  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
}

/** Postgres 23505. Here it means the one-active-plan or version constraint fired. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

/**
 * The catalogue's alternatives for these ingredients, with each substitute's own
 * allergen links and macros — what `core/domain/Substitution` needs to filter
 * them per person and order them. Not filtered here: a repository does not know
 * who is asking.
 */
async function findSubstitutes(ingredientIds: readonly string[], locale: string) {
  const bySource = new Map<
    string,
    {
      readonly id: string;
      readonly allergens: { readonly allergenId: string; readonly presence: 'contains' | 'may_contain' }[];
      readonly carbsPer100g: number;
      readonly fatPer100g: number;
      readonly kcalPer100g: number;
      readonly name: string;
      readonly proteinPer100g: number;
      readonly ratio: number;
    }[]
  >();

  if (ingredientIds.length === 0) {
    return bySource;
  }

  const db = database();
  const substitute = aliasedTable(ingredients, 'substitute');
  const requested = aliasedTable(ingredientNames, 'substitute_requested_name');
  const fallback = aliasedTable(ingredientNames, 'substitute_fallback_name');
  const substituteIds = db
    .select({ id: ingredientSubstitutions.substituteId })
    .from(ingredientSubstitutions)
    .where(inArray(ingredientSubstitutions.ingredientId, ingredientIds));

  const [rows, links] = await Promise.all([
    db
      .select({
        id: substitute.id,
        carbsPer100g: substitute.carbsPer100g,
        fallbackName: fallback.name,
        fatPer100g: substitute.fatPer100g,
        ingredientId: ingredientSubstitutions.ingredientId,
        kcalPer100g: substitute.kcalPer100g,
        proteinPer100g: substitute.proteinPer100g,
        ratio: ingredientSubstitutions.ratio,
        requestedName: requested.name,
        slug: substitute.slug
      })
      .from(ingredientSubstitutions)
      .innerJoin(substitute, eq(substitute.id, ingredientSubstitutions.substituteId))
      .leftJoin(requested, and(eq(requested.ingredientId, substitute.id), eq(requested.locale, locale)))
      .leftJoin(fallback, and(eq(fallback.ingredientId, substitute.id), eq(fallback.locale, FALLBACK_LOCALE)))
      .where(inArray(ingredientSubstitutions.ingredientId, ingredientIds)),
    db
      .select({ allergenId: ingredientAllergens.allergenId, ingredientId: ingredientAllergens.ingredientId, presence: ingredientAllergens.presence })
      .from(ingredientAllergens)
      .where(inArray(ingredientAllergens.ingredientId, substituteIds))
  ]);

  const allergensOf = new Map<string, { readonly allergenId: string; readonly presence: 'contains' | 'may_contain' }[]>();

  for (const link of links) {
    allergensOf.set(link.ingredientId, [...(allergensOf.get(link.ingredientId) ?? []), { allergenId: link.allergenId, presence: link.presence }]);
  }

  for (const row of rows) {
    bySource.set(row.ingredientId, [
      ...(bySource.get(row.ingredientId) ?? []),
      {
        id: row.id,
        allergens: allergensOf.get(row.id) ?? [],
        carbsPer100g: Number(row.carbsPer100g),
        fatPer100g: Number(row.fatPer100g),
        kcalPer100g: Number(row.kcalPer100g),
        name: row.requestedName ?? row.fallbackName ?? row.slug,
        proteinPer100g: Number(row.proteinPer100g),
        ratio: Number(row.ratio)
      }
    ]);
  }

  return bySource;
}

type Transaction = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

/**
 * Writes the dishes the model composed, and their ingredient rows, returning
 * slug → id for the ones this call inserted. Shared by a plan's creation and a
 * meal swap, so a recipe is written the same way whichever route wrote it.
 */
async function insertRecipes(tx: Transaction, newRecipes: readonly RecipeDraft[], locale: string, userId: string): Promise<Map<string, string>> {
  const recipeIdBySlug = new Map<string, string>();

  if (newRecipes.length > 0) {
    const inserted = await tx
      .insert(recipes)
      .values(
        newRecipes.map(recipe => ({
          cookMinutes: recipe.cookMinutes,
          createdBy: userId,
          cuisine: recipe.cuisine,
          difficulty: recipe.difficulty,
          instructions: recipe.steps,
          // The language the model was told to write in. Reuse is scoped to
          // it, so this is what keeps a Spanish dish out of an English plan.
          locale: locale,
          mealSlots: [...recipe.mealSlots],
          name: recipe.name,
          prepMinutes: recipe.prepMinutes,
          servings: recipe.servings,
          slug: recipe.slug,
          source: 'ai' as const,
          stepsVersion: recipe.stepsVersion
        }))
      )
      // Another user's generation may have produced the same dish first.
      // That is a race to win harmlessly, not an error.
      .onConflictDoNothing({ target: recipes.slug })
      .returning({ id: recipes.id, slug: recipes.slug });

    for (const row of inserted) {
      recipeIdBySlug.set(row.slug, row.id);
    }

    const ingredientRows = newRecipes
      .filter(recipe => recipeIdBySlug.has(recipe.slug))
      .flatMap(recipe =>
        recipe.ingredients.map(item => ({
          grams: String(item.grams),
          ingredientId: item.ingredientId,
          quantity: String(item.grams),
          recipeId: recipeIdBySlug.get(recipe.slug) as string,
          unit: item.unit
        }))
      );

    if (ingredientRows.length > 0) {
      await tx.insert(recipeIngredients).values(ingredientRows);
    }
  }

  return recipeIdBySlug;
}

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof DatabaseOperationError) {
    return error;
  }

  return new DatabaseOperationError();
}

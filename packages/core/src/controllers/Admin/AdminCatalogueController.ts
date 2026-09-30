import { AdminCatalogueRepository } from '#repositories/Admin';
import { composeMacros, scaleMacros } from 'core/domain/Composition';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { MEAL_SLOTS, toCatalogue } from 'core/entities/Plan';
import { PICTURE_COOL_OFF_DAYS } from 'core/controllers/Recipe';
import { pictureReasonOf } from 'core/entities/DishPicture';
import { RECIPE_SOURCES } from 'core/entities/AdminQuery';
import { SafetyRepository } from '#repositories/Safety';

import { AdminQualityController } from './AdminQualityController';

import type { CatalogueRecipeRow, CompositionRow } from '#repositories/Admin';
import type { Catalogue } from 'core/entities/Plan';
import type { IngredientCatalogueQuery, RecipeCatalogueQuery, SortDirection } from 'core/entities/AdminQuery';
import type { Paged } from 'core/controllers/User';
import type { PictureReason, PictureStatus } from 'core/entities/DishPicture';

/**
 * One recipe on the console's catalogue table (`0068`). What the dish is and
 * where it came from — never who made it: no `created_by`, no id of a person
 * (`0028`). The catalogue is shared reference data.
 */
export type CatalogueRecipeView = {
  /** The recipe's id — what the retry of its picture is addressed by. A dish, never a person. */
  readonly id: string;
  /** Allergen keys a served ingredient contains, sorted. */
  readonly allergens: readonly string[];
  /** Per serving, from the app's own composition (`core/domain/Composition`); null when a recipe cannot be costed. */
  readonly carbsG: number | null;
  readonly fatG: number | null;
  readonly kcal: number | null;
  readonly locale: string;
  /** Allergen keys a served ingredient only may carry as a trace, and no served ingredient contains. */
  readonly mayContain: readonly string[];
  readonly mealSlots: readonly string[];
  readonly name: string;
  /** `ready` with a file, `drawing`, `failed` for the dish's own reasons, or `none` — which a released picture reads as. */
  readonly picture: PictureStatus;
  /**
   * Why the picture failed or was given back, when it did (`picture` is `failed`, or `none` for a
   * released one); null for any other. A closed set — never the provider's words. A picture with
   * a reason can be retried by hand.
   */
  readonly pictureReason: PictureReason | null;
  readonly proteinG: number | null;
  /**
   * When a failed picture leaves its cool-off and a view draws it again, ISO. Null when it is
   * retryable now (the cool-off is over, or the picture was released) and for a picture that is
   * not failed. The owner's retry ignores it.
   */
  readonly retryableAt: string | null;
  readonly slug: string;
  readonly source: string;
};

/** `POST /admin/catalogue/recipes/:id/picture/retry`: the retry was claimed and the drawing is scheduled. */
export type PictureRetryView = { readonly status: 'drawing' };

/** The catalogue's size for the tiles and the chart, whatever the table is filtered by. */
export type CatalogueCountsView = {
  /** Every meal slot in the day's order, zeros included. A recipe with two slots counts in both. */
  readonly bySlot: readonly { readonly n: number; readonly slot: string }[];
  /** Every source (`seed`, `ai`, `user`), zeros included. */
  readonly bySource: readonly { readonly n: number; readonly source: string }[];
  readonly total: number;
  /** Recipes with no `ready` picture. */
  readonly withoutImage: number;
};

/** Recetas (`GET /admin/catalogue/recipes`): one page of the table, and the catalogue's counts. */
export type AdminRecipesView = Paged<CatalogueRecipeView> & { readonly counts: CatalogueCountsView };

/** One ingredient on the console's table, per 100 g. */
export type CatalogueIngredientView = {
  readonly allergens: readonly string[];
  readonly carbsPer100g: number;
  readonly category: string;
  /** Where it is sold, ISO 3166-1 alpha-2. Empty means everywhere (`0034`). */
  readonly countries: readonly string[];
  readonly fatPer100g: number;
  readonly kcalPer100g: number;
  readonly mayContain: readonly string[];
  /** The meals it belongs to. Empty means every meal (`0062`). */
  readonly mealSlots: readonly string[];
  /** Its Spanish name. */
  readonly name: string;
  readonly proteinPer100g: number;
  readonly slug: string;
};

/** Ingredientes (`GET /admin/catalogue/ingredients`). */
export type AdminIngredientsView = Paged<CatalogueIngredientView>;

type Macros = Pick<CatalogueRecipeView, 'carbsG' | 'fatG' | 'kcal' | 'proteinG'>;

const UNCOSTED: Macros = { carbsG: null, fatG: null, kcal: null, proteinG: null };

/**
 * A recipe's macros per serving, from its served ingredients: the app's own
 * composition, `composeMacros` then `scaleMacros` by one serving — exactly
 * `composePerServing`, which a spec pins — and never a formula of its own.
 * Exported for its spec.
 */
export function perServing(items: readonly { readonly grams: number; readonly slug: string }[], servings: number, catalogue: Catalogue): Macros {
  if (!(servings > 0)) {
    return UNCOSTED;
  }

  const composed = composeMacros(items, catalogue);

  if (!composed.ok) {
    return UNCOSTED;
  }

  const { carbsG, fatG, kcal, proteinG } = scaleMacros(composed.macros, 1 / servings);

  return { carbsG, fatG, kcal, proteinG };
}

/**
 * The allergens of a dish: every allergen a served ingredient is linked to,
 * from the same catalogue links the allergy gate reads (`findSafetyViolations`).
 * `contains` is the claim; a trace warning shows only where nothing contains
 * it. Exported for its spec.
 */
export function allergensOf(
  slugs: readonly string[],
  catalogue: Catalogue,
  keyOf: ReadonlyMap<string, string>
): { readonly allergens: readonly string[]; readonly mayContain: readonly string[] } {
  const contained = new Set<string>();
  const traces = new Set<string>();

  for (const slug of slugs) {
    for (const link of catalogue.get(slug)?.allergens ?? []) {
      const key = keyOf.get(link.allergenId);

      if (key !== undefined) {
        (link.presence === 'contains' ? contained : traces).add(key);
      }
    }
  }

  return { allergens: [...contained].sort(), mayContain: [...traces].filter(key => !contained.has(key)).sort() };
}

/**
 * A figure sorted either way with the uncosted last, then the name and the
 * slug, so a page boundary is stable. Exported for its spec.
 */
export function byFigure(figure: 'kcal' | 'proteinG', direction: SortDirection) {
  return (a: CatalogueRecipeView, b: CatalogueRecipeView): number => {
    const [x, y] = [a[figure], b[figure]];

    if (x !== y) {
      if (x === null) {
        return 1;
      }

      if (y === null) {
        return -1;
      }

      return direction === 'asc' ? x - y : y - x;
    }

    return a.name.localeCompare(b.name, 'es') || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  };
}

/**
 * A failed picture's reason and when its cool-off ends. A released row (`released`
 * in what it stored) is claimed by the next view at once, so it has no date.
 * Exported for its spec.
 */
export function pictureFailure(
  row: Pick<CatalogueRecipeRow, 'pictureAt' | 'pictureFailed' | 'pictureProvenance'>,
  now: Date
): Pick<CatalogueRecipeView, 'pictureReason' | 'retryableAt'> {
  if (!row.pictureFailed) {
    return { pictureReason: null, retryableAt: null };
  }

  const released = typeof row.pictureProvenance?.released === 'string';
  const until = row.pictureAt === null ? null : new Date(row.pictureAt.getTime() + PICTURE_COOL_OFF_DAYS * 86_400_000);

  return {
    pictureReason: pictureReasonOf(row.pictureProvenance),
    retryableAt: released || until === null || until.getTime() <= now.getTime() ? null : until.toISOString()
  };
}

/** The rows with their macros and allergens, computed from their served ingredients. */
async function present(rows: readonly CatalogueRecipeRow[], now: Date): Promise<readonly CatalogueRecipeView[]> {
  const compositions = await AdminCatalogueRepository.compositions(rows.map(row => row.id));
  const slugs = [...new Set(compositions.map(item => item.slug))];
  const [ingredients, allergenList] = await Promise.all([
    RecipeRepository.loadCatalogue(FALLBACK_LOCALE, null, slugs),
    SafetyRepository.listAllergens()
  ]);
  const catalogue = toCatalogue(ingredients);
  const keyOf = new Map(allergenList.map(allergen => [allergen.id, allergen.key]));
  const byRecipe = new Map<string, CompositionRow[]>();

  for (const item of compositions) {
    const items = byRecipe.get(item.recipeId) ?? [];

    items.push(item);
    byRecipe.set(item.recipeId, items);
  }

  return rows.map(row => {
    const items = byRecipe.get(row.id) ?? [];

    return {
      ...allergensOf(
        items.map(item => item.slug),
        catalogue,
        keyOf
      ),
      ...perServing(items, row.servings, catalogue),
      id: row.id,
      locale: row.locale,
      mealSlots: row.mealSlots,
      name: row.name,
      picture: row.picture,
      ...pictureFailure(row, now),
      slug: row.slug,
      source: row.source
    };
  });
}

/**
 * The catalogue as the console browses it (`0068`): recipes and ingredients,
 * read only. Editing it stays in the seed file in git (`0028`).
 */
export const AdminCatalogueController = {
  /** One page of ingredients with their allergens, per 100 g. */
  async ingredients(query: IngredientCatalogueQuery): Promise<AdminIngredientsView> {
    const { rows, total } = await AdminCatalogueRepository.ingredientPage(query);
    const links = await AdminCatalogueRepository.ingredientAllergens(rows.map(row => row.slug));

    return {
      offset: query.offset,
      rows: rows.map(row => {
        const own = links.filter(link => link.slug === row.slug);
        const contained = new Set(own.filter(link => link.presence === 'contains').map(link => link.key));

        return {
          allergens: [...contained].sort(),
          carbsPer100g: row.carbsPer100g,
          category: row.category,
          countries: row.countries,
          fatPer100g: row.fatPer100g,
          kcalPer100g: row.kcalPer100g,
          mayContain: [...new Set(own.filter(link => link.presence === 'may_contain' && !contained.has(link.key)).map(link => link.key))].sort(),
          mealSlots: row.mealSlots,
          name: row.name,
          proteinPer100g: row.proteinPer100g,
          slug: row.slug
        };
      }),
      size: query.size,
      total
    };
  },

  /**
   * One page of recipes and the catalogue's counts.
   *
   * By name, SQL orders and pages, and only the page is costed. By a macro,
   * only the app's composition can say the figure, so every recipe the
   * filters match is costed and sorted here, then the page is cut: the
   * catalogue is bounded (about 1,700 recipes, 10,000 ingredient rows at
   * worst), and a second formula in SQL is what `0004` forbids.
   *
   * With `check`, the table is narrowed to the recipes that quality check
   * finds (`AdminQualityController.idsFailing`, the same helpers Catálogo ›
   * Calidad counts with), so a count there and the table it links to agree.
   * `stepsVersion` is the current one, which only the API knows.
   */
  async recipes(query: RecipeCatalogueQuery, stepsVersion: string, now = new Date()): Promise<AdminRecipesView> {
    const ids = query.check === undefined ? undefined : await AdminQualityController.idsFailing(query.check, stepsVersion);
    const [page, counts] = await Promise.all([
      query.sort === 'name'
        ? AdminCatalogueRepository.recipePage(query, ids).then(async ({ rows, total }) => ({ rows: await present(rows, now), total }))
        : AdminCatalogueRepository.matchingRecipes(query, ids).then(async rows => {
            const costed = [...(await present(rows, now))].sort(byFigure(query.sort === 'kcal' ? 'kcal' : 'proteinG', query.dir));

            return { rows: costed.slice(query.offset, query.offset + query.size), total: costed.length };
          }),
      AdminCatalogueRepository.recipeCounts()
    ]);
    const perSlot = new Map(counts.bySlot.map(row => [row.slot, row.n]));
    const perSource = new Map(counts.bySource.map(row => [row.source, row.n]));

    return {
      counts: {
        bySlot: MEAL_SLOTS.map(slot => ({ n: perSlot.get(slot) ?? 0, slot })),
        bySource: RECIPE_SOURCES.map(source => ({ n: perSource.get(source) ?? 0, source })),
        total: counts.total,
        withoutImage: counts.withoutImage
      },
      offset: query.offset,
      rows: page.rows,
      size: query.size,
      total: page.total
    };
  }
};

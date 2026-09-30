import { z } from 'zod';

import { AdminCatalogueRepository } from '#repositories/Admin';
import { composeMacros, scaleMacros } from 'core/domain/Composition';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { MEAL_SLOTS, toCatalogue } from 'core/entities/Plan';
import { NotFoundError } from 'core/entities/Error';
import { candidateFlags, pictureReasonOf } from 'core/entities/DishPicture';
import { PICTURE_COOL_OFF_DAYS, reviewableCandidate } from 'core/controllers/Recipe';
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
   * Whether the picture was accepted by hand, against the judge (`0072`): true only for a `ready`
   * picture the owner published from a candidate. It is what the console offers "Retirar" on, and
   * the only picture `POST …/picture/remove` takes back. A closed flag — never the stored provenance.
   */
  readonly pictureAcceptedByHand: boolean;
  /**
   * The rejected picture this dish holds for the owner to look at (`0072`), while it can be
   * looked at; null for a dish with none and for one whose candidate has expired. Its file is
   * read through `GET /admin/catalogue/recipes/:id/picture/candidate` — never an address here.
   */
  readonly pictureCandidate: PictureCandidateView | null;
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

/**
 * One recipe on its own (`GET /admin/catalogue/recipes/:id`): the table's row, and what the dish is
 * made of — what the review of its rejected picture is read against (`0072`). Still a dish and
 * nobody's: no `created_by`, no id of a person (`0028`).
 */
export type AdminRecipeView = CatalogueRecipeView & {
  /** The served ingredients — not the optional ones, as the app serves them — heaviest first: grams for the recipe's servings, and the catalogue's Spanish name (the slug where it has none). */
  readonly ingredients: readonly { readonly grams: number; readonly name: string; readonly slug: string }[];
  /**
   * The public address of the dish's picture — the same one a person's app is given — when it is `ready`; null otherwise.
   * What the review page shows of a picture that can be removed. Never a candidate's: that file has no address.
   */
  readonly pictureUrl: string | null;
};

/**
 * What the owner is shown of a candidate (`0072`): what the judge flagged, in our own closed words —
 * allergen keys and catalogue ingredients, never what the vision model wrote — and until when it can
 * be looked at. **No path and no address of the file**: it lives in a private store only the API reads.
 */
export type PictureCandidateView = {
  /** Allergen keys the picture shows and the dish does not carry, sorted. */
  readonly allergens: readonly string[];
  /** When it stops being reviewable, ISO: the end of the dish's cool-off. The file is deleted by the next nightly cleanup. */
  readonly expiresAt: string;
  /** The catalogue ingredients the flagged foods were mapped to, by slug, with their Spanish name (the slug where the catalogue has none). */
  readonly ingredients: readonly { readonly name: string; readonly slug: string }[];
};

/** `POST /admin/catalogue/recipes/:id/picture/candidate/accept`: the candidate is the dish's picture now, published by the owner's hand. */
export type PictureAcceptView = { readonly status: 'ready' };

/**
 * `POST /admin/catalogue/recipes/:id/picture/remove`: the dish has no picture again. `fileDeleted` is false when the public
 * file could not be deleted: no screen is given its address any more, and it stays in the public store until deleted by hand.
 * True means the store deleted it, not that every copy is gone: the store's cache may serve it for up to a minute more, and a
 * browser that already fetched it keeps its copy. What is immediate is the row: from the removal on, nothing hands the address out.
 */
export type PictureRemoveView = { readonly fileDeleted: boolean; readonly status: 'removed' };

/** `POST /admin/catalogue/recipes/:id/picture/candidate/discard`: the file and its pointer are gone; the dish waits out its cool-off as before. */
export type PictureDiscardView = { readonly status: 'discarded' };

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

/**
 * The candidate a row holds as the console shows it, or null when it holds none that can be looked
 * at (`reviewableCandidate`: failed, and not expired). Only the flags and the expiry are read from
 * what the row stored — the path stays behind. Exported for its spec.
 */
export function candidateFlagsOf(
  row: Pick<CatalogueRecipeRow, 'pictureAt' | 'pictureFailed' | 'pictureProvenance'>,
  now: Date
): { readonly allergens: readonly string[]; readonly expiresAt: string; readonly ingredients: readonly string[] } | null {
  const found = reviewableCandidate(
    { lastAttemptAt: row.pictureAt, provenance: row.pictureProvenance, status: row.pictureFailed ? 'failed' : null },
    now
  );

  return found === null ? null : { ...candidateFlags(found.candidate), expiresAt: found.expiresAt.toISOString() };
}

/** The rows with their macros and allergens, computed from their served ingredients. */
async function present(rows: readonly CatalogueRecipeRow[], now: Date): Promise<readonly CatalogueRecipeView[]> {
  return (await compose(rows, now)).map(({ view }) => view);
}

/** Each row as the table shows it, beside the served ingredients it was computed from, named by the same catalogue read. */
async function compose(
  rows: readonly CatalogueRecipeRow[],
  now: Date
): Promise<readonly { readonly ingredients: AdminRecipeView['ingredients']; readonly view: CatalogueRecipeView }[]> {
  const compositions = await AdminCatalogueRepository.compositions(rows.map(row => row.id));
  const candidates = new Map(rows.map(row => [row.id, candidateFlagsOf(row, now)]));
  // The flagged ingredients are named from the same catalogue read as the dish's own.
  const slugs = [...new Set([...compositions.map(item => item.slug), ...[...candidates.values()].flatMap(flags => flags?.ingredients ?? [])])];
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
    const flags = candidates.get(row.id) ?? null;
    const ingredients = items
      .map(item => ({ grams: item.grams, name: catalogue.get(item.slug)?.name ?? item.slug, slug: item.slug }))
      .sort((a, b) => b.grams - a.grams || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    const view = {
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
      pictureAcceptedByHand: row.picture === 'ready' && row.pictureAcceptedByHand,
      pictureCandidate:
        flags === null
          ? null
          : {
              allergens: flags.allergens,
              expiresAt: flags.expiresAt,
              ingredients: flags.ingredients.map(slug => ({ name: catalogue.get(slug)?.name ?? slug, slug }))
            },
      ...pictureFailure(row, now),
      slug: row.slug,
      source: row.source
    };

    return { ingredients, view };
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
   * One recipe with its served ingredients: the row the table shows, costed and named by the same
   * reads, so the two cannot disagree. A `NotFoundError` with a fixed message for an id that is
   * not one, before anything is read, and for a recipe that does not exist.
   */
  async recipe(recipeId: string, now = new Date()): Promise<AdminRecipeView> {
    const row = z.uuid().safeParse(recipeId).success ? await AdminCatalogueRepository.recipe(recipeId) : null;

    if (row === null) {
      throw new NotFoundError('Recipe not found');
    }

    const [composed] = await compose([row], now);

    if (composed === undefined) {
      throw new NotFoundError('Recipe not found');
    }

    return { ...composed.view, ingredients: composed.ingredients, pictureUrl: row.picture === 'ready' ? row.pictureUrl : null };
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

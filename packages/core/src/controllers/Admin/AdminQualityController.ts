import { AdminCatalogueRepository, AdminGenerationsRepository } from '#repositories/Admin';
import { failsCheck, qualityFlags } from 'core/domain/CatalogueQuality';
import { fillDays, madridDayKeys, windowFor } from 'core/domain/Period';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { REWRITE_ATTEMPT_BOUND, stepsVersionAttempts } from 'core/domain/Method';
import { RECIPE_SOURCES } from 'core/entities/AdminQuery';
import { toCatalogue } from 'core/entities/Plan';

import { presentWindow } from './AdminSeriesController';

import type { DaySeries, PeriodWindowView } from './AdminSeriesController';
import type { Period } from 'core/entities/Period';
import type { QualityFlags } from 'core/domain/CatalogueQuality';
import type { QualityRecipeRow } from '#repositories/Admin';
import type { RecipeCheck } from 'core/entities/AdminQuery';

/** The rejection reason `PoolBuilder` gives a dish past `OVERSIZED_FACTOR` times its meals' cap. */
const OVERSIZED_REASON = 'oversized';

/**
 * Catálogo › Calidad (`GET /admin/catalogue/quality?period=`, `0071`).
 *
 * Every count is about the catalogue, which is shared reference data and names
 * nobody, or a total over everybody's generations (`0028`). Each figure in
 * `shouldBeZero` except `mealsOutsideServingBounds` links to Recetas with
 * `?check=` set to the same word in `snake_case` (`over_bound`, `uncosted`,
 * `unserved`, `refusal_limit`): the table holds exactly the recipes counted.
 */
export type AdminCatalogueQualityView = {
  readonly period: Period;
  /** Every recipe in the catalogue: what the counts below are out of. */
  readonly recipes: number;
  /** Things that should be zero; a number above zero is a defect somewhere upstream. */
  readonly shouldBeZero: {
    /** Meals stored with servings outside `SERVING_BOUNDS`. A count only: no meal is returned. */
    readonly mealsOutsideServingBounds: number;
    /** Recipes one serving past `OVERSIZED_FACTOR` times their meals' cap (`check=over_bound`). */
    readonly overBound: number;
    /** Recipes at the sweep's refusal limit (`check=refusal_limit`). */
    readonly refusalLimit: number;
    /** Recipes whose macros cannot be computed (`check=uncosted`). */
    readonly uncosted: number;
    /** Dishes whose meals match none of their ingredients' meals (`check=unserved`). */
    readonly unserved: number;
  };
  /** What the sweep of step rewrites has done, out of `recipes`; `current + pending + givenUp = recipes`. */
  readonly sweep: {
    /** Refusals stood against a recipe before the sweep stopped claiming it (`REWRITE_ATTEMPT_BOUND`). */
    readonly attemptBound: number;
    /** Written by the current steps version and complete, so the sweep has nothing to do. */
    readonly current: number;
    /** Refused `attemptBound` times under the current steps version: the sweep no longer asks. Links with `check=refusal_limit`. */
    readonly givenUp: number;
    /** The sweep would still claim it: an older version wrote it, or the method has a gap. */
    readonly pending: number;
    /** The current steps version. */
    readonly stepsVersion: string;
    /** Refused at least once and fewer than `attemptBound` times under the current version. A recipe may also be pending. */
    readonly withRefusals: number;
  };
  /** Things worth a look, not defects. */
  readonly toLookAt: {
    /** Recipes over their meals' cap but within the bound (`check=over_cap`), one entry per source, zeros included. */
    readonly overCapBySource: readonly { readonly n: number; readonly source: string }[];
    /** Dishes refused as `oversized` per Madrid day over the period. */
    readonly oversizedRejections: DaySeries;
    /** Recipes whose picture failed for the dish's own reasons. */
    readonly picturesFailed: number;
  };
  readonly window: PeriodWindowView;
};

/** Every recipe with what the app's own helpers say about it. */
async function judged(stepsVersion: string): Promise<readonly { readonly flags: QualityFlags; readonly row: QualityRecipeRow }[]> {
  const rows = await AdminCatalogueRepository.qualityRecipes(stepsVersion);
  const slugs = [...new Set(rows.flatMap(row => row.items.map(item => item.slug)))];
  const catalogue = toCatalogue(await RecipeRepository.loadCatalogue(FALLBACK_LOCALE, null, slugs));

  return rows.map(row => ({ flags: qualityFlags(row, catalogue, stepsVersion), row }));
}

/**
 * The console's quality pages (`0071`): the same helpers the scheduler and the
 * pool builder use (`composePerServing`, `isOversized`, `servingCap`,
 * `fitSlots`, `stepsVersionAttempts`), read over the whole catalogue in the
 * act. No figure is stored and no second formula exists.
 */
export const AdminQualityController = {
  /**
   * The ids of the recipes failing one check: what Recetas is narrowed to when
   * `?check=` is given, so the table and the count cannot disagree.
   */
  async idsFailing(check: RecipeCheck, stepsVersion: string): Promise<readonly string[]> {
    return (await judged(stepsVersion)).filter(({ flags }) => failsCheck(flags, check)).map(({ row }) => row.id);
  },

  /** The catalogue's quality, and the sweep's state, with the period's `oversized` rejections per day. */
  async quality(period: Period, stepsVersion: string, now = new Date()): Promise<AdminCatalogueQualityView> {
    const window = windowFor(period, now);
    const days = madridDayKeys(window.from, window.to);
    const [recipes, mealsOutsideServingBounds, picturesFailed, rejections] = await Promise.all([
      judged(stepsVersion),
      AdminCatalogueRepository.mealsOutsideServingBounds(),
      AdminCatalogueRepository.picturesFailed(),
      AdminGenerationsRepository.rejectionsPerDay(OVERSIZED_REASON, window.from, window.to)
    ]);
    const count = (test: (flags: QualityFlags) => boolean) => recipes.filter(({ flags }) => test(flags)).length;
    const givenUp = count(flags => flags.refusalLimit);
    const pending = recipes.filter(({ row }) => row.pending).length;
    const overCap = recipes.filter(({ flags }) => flags.overCap);

    return {
      period,
      recipes: recipes.length,
      shouldBeZero: {
        mealsOutsideServingBounds,
        overBound: count(flags => flags.overBound),
        refusalLimit: givenUp,
        uncosted: count(flags => flags.uncosted),
        unserved: count(flags => flags.unserved)
      },
      sweep: {
        attemptBound: REWRITE_ATTEMPT_BOUND,
        current: recipes.length - pending - givenUp,
        givenUp,
        pending,
        stepsVersion,
        withRefusals: recipes.filter(({ row }) => {
          const attempts = stepsVersionAttempts(row.stepsVersion, stepsVersion);

          return attempts > 0 && attempts < REWRITE_ATTEMPT_BOUND;
        }).length
      },
      toLookAt: {
        overCapBySource: RECIPE_SOURCES.map(source => ({ n: overCap.filter(({ row }) => row.source === source).length, source })),
        oversizedRejections: { days, values: fillDays(days, rejections) },
        picturesFailed
      },
      window: presentWindow(window)
    };
  }
};

import type { CandidateDish, Catalogue } from 'core/entities/Plan';
import type { FoodClass } from 'database/schema/food';

/**
 * What a dish is a dish *of*: the food from the protein aisle that carries
 * most of its protein, named by kind rather than by cut or tin.
 *
 * Variety by dish was not enough. A fortnight of forty-seven different dishes
 * served tuna in nine meals and egg whites three times in one day — every
 * dish distinct, the plate the same. The kind is read from the slug, which
 * names the cut first and the animal after it: `pechuga-de-pavo` and
 * `pavo-picado` are both turkey, `clara-de-huevo` is egg, `atun-al-natural`
 * and `ventresca-de-atun` are both tuna.
 *
 * Only the protein aisle counts — meat, fish, seafood, eggs and pulses. A
 * yoghurt at breakfast and cheese on toast are the ordinary shape of those
 * meals, not a repetition anybody notices. Null for a dish with nothing from
 * that aisle.
 */
export function mainProtein(dish: Pick<CandidateDish, 'ingredients'>, catalogue: Catalogue): string | null {
  let main: string | null = null;
  let most = 0;

  for (const item of dish.ingredients) {
    const ingredient = catalogue.get(item.slug);

    if (ingredient?.category !== 'protein') {
      continue;
    }

    const grams = (item.grams * ingredient.proteinPer100g) / 100;

    if (grams > most) {
      most = grams;
      main = item.slug;
    }
  }

  return main === null ? null : proteinKind(main, catalogue);
}

/**
 * The classes that name one animal whatever the cut, the cure or the slug:
 * a real fortnight (017 phase 2) served pork in eight of twenty-eight mains,
 * and by its slugs `lomo-embuchado`, `jamon-serrano`, `chorizo` and
 * `secreto-de-cerdo` are four proteins — the person eats one. `huevo-de-codorniz`
 * read as quail, the bird, not as the egg it is.
 */
const KIND_BY_CLASS: readonly (readonly [FoodClass, string])[] = [
  ['pork', 'cerdo'],
  ['egg', 'huevo']
];

/** The kind a catalogue row is named by: `pechuga-de-pavo` → `pavo`; `atun-al-natural` → `atun`; any pork → `cerdo`. */
export function proteinKind(slug: string, catalogue: Catalogue): string {
  const classes = catalogue.get(slug)?.classes ?? [];
  const byClass = KIND_BY_CLASS.find(([foodClass]) => classes.includes(foodClass));

  return byClass?.[1] ?? /-de-([a-z]+)/.exec(slug)?.[1] ?? slug.split('-')[0] ?? slug;
}

/**
 * **Once a day, in about one meal in ten, three times at most in any one
 * meal, and three times at most in a week of lunches and dinners** (`0051`,
 * `0052`; the week from 017 phase 2).
 *
 * At four meals a day that is six appearances a fortnight — three a week —
 * never twice on one day, and never more than three of one meal's fourteen:
 * a plan kept to six tuna meals still put all six at the afternoon snack.
 * Three lunches and three dinners a fortnight could still all fall in one
 * week, so the mains of each week of the plan (days 1–7, 8–14) hold one
 * protein three times at most (owner, 2026-10-02: "no protein dominates").
 * Unlike `VARIETY_RULES` these are preferences the scheduler keeps whenever
 * the pool lets it, not rules it fails a plan over: a pool that is mostly tuna
 * still gives somebody a plan, with tuna in it more often than this. A person
 * who dislikes fish simply has none in the pool; nothing here asks for it.
 */
export const PROTEIN_RULES = { mealsPerAppearance: 10, perDay: 1, perMainsWeek: 3, perSlot: 3 } as const;

/** The week of the plan a day falls in, from 0: days 1–7 are week 0. */
export function planWeek(dayIndex: number): number {
  return Math.floor((dayIndex - 1) / 7);
}

/** How often one main protein may appear in a plan of `meals` meals. */
export function proteinCap(meals: number): number {
  return Math.max(2, Math.ceil(meals / PROTEIN_RULES.mealsPerAppearance));
}
